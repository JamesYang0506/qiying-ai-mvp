// 对话历史存储：按账号隔离，存成 data/imports/ai-chats/<userId>.json
//
// 设计：
//  · 一个用户一个文件，内含多个会话（conversation）
//  · 只在「一轮问答结束」时整体保存，不做逐字持久化（避免频繁写盘）
//  · 每用户最多 50 个会话、每会话最多 120 条消息，超出按时间淘汰最旧的
import {mkdir, readFile, writeFile, rename, unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES = 120;
const MAX_TITLE = 40;

export function createChatStore({dataDir, clock = Date.now}) {
  const dir = path.join(dataDir, 'ai-chats');

  // 🔴 同账号的写操作必须串行。
  //    save() 是「读全量 → 改数组 → 整体覆盖」，并发时两个请求都读到同一份旧数据，
  //    后写的把前写的整个抹掉。实测 20 个并发保存只活下来 1 个（丢 19 个）。
  //    memory.mjs 早就有这个队列，chats.mjs 一直缺 —— 两个模块的存储策略要一致。
  const queues = new Map();
  function serialize(userId, fn) {
    const job = (queues.get(userId) || Promise.resolve()).then(fn);
    queues.set(userId, job.catch(() => {}));
    return job;
  }

  const fileOf = (userId) => path.join(dir, String(userId).replace(/[^a-zA-Z0-9-]/g, '') + '.json');

  async function readAll(userId) {
    try {
      const raw = await readFile(fileOf(userId), 'utf8');
      const data = JSON.parse(raw);
      if (!Array.isArray(data.conversations)) return [];
      return data.conversations;
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      return [];
    }
  }

  async function writeAll(userId, conversations) {
    await mkdir(dir, {recursive: true});
    const file = fileOf(userId);
    const tmp = file + '.' + randomUUID() + '.tmp';
    const payload = JSON.stringify({version: 1, updatedAt: new Date(clock()).toISOString(), conversations}, null, 0);
    try {
      await writeFile(tmp, payload, {flag: 'wx', mode: 0o600});
      // Windows 上并发 rename 到同一个目标会 EPERM（目标文件正被占用），
      // 以前直接冒成 500 让前端把整轮对话丢掉；退避重试两次即可。
      for (let attempt = 0; ; attempt++) {
        try {
          await rename(tmp, file);
          break;
        } catch (e) {
          if (attempt >= 2 || e.code !== 'EPERM') throw e;
          await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
        }
      }
    } catch (e) {
      await unlink(tmp).catch(() => {});
      throw e;
    }
  }

  const normalize = (c) => ({
    id: String(c.id || randomUUID()),
    title: String(c.title || '未命名对话').slice(0, MAX_TITLE),
    createdAt: c.createdAt || new Date(clock()).toISOString(),
    updatedAt: new Date(clock()).toISOString(),
    messages: Array.isArray(c.messages)
      ? c.messages
          .filter((m) => m && (m.role === 'user' || m.role === 'ai') && typeof m.text === 'string')
          .slice(-MAX_MESSAGES)
          .map((m) => ({role: m.role, text: String(m.text).slice(0, 20000)}))
      : [],
  });

  return {
    /** 列表：只返回摘要，不带正文 */
    async list(userId) {
      const all = await readAll(userId);
      return all
        .slice()
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        .map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt,
          count: Array.isArray(c.messages) ? c.messages.length : 0,
        }));
    },

    async get(userId, id) {
      const all = await readAll(userId);
      const found = all.find((c) => c.id === id);
      if (!found) return null;
      return {id: found.id, title: found.title, createdAt: found.createdAt, updatedAt: found.updatedAt, messages: found.messages || []};
    },

    /** 保存（存在则覆盖，不存在则追加） */
    save(userId, conv) {
      return serialize(userId, async () => {
        const all = await readAll(userId);
        const next = normalize(conv);
        const idx = all.findIndex((c) => c.id === next.id);
        if (idx >= 0) {
          next.createdAt = all[idx].createdAt || next.createdAt;
          all[idx] = next;
        } else {
          all.push(next);
        }
        // 超出上限就淘汰最旧的
        all.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        const trimmed = all.slice(0, MAX_CONVERSATIONS);
        await writeAll(userId, trimmed);
        return {id: next.id, title: next.title, updatedAt: next.updatedAt, count: next.messages.length};
      });
    },

    remove(userId, id) {
      return serialize(userId, async () => {
        const all = await readAll(userId);
        const kept = all.filter((c) => c.id !== id);
        if (kept.length === all.length) return false;
        await writeAll(userId, kept);
        return true;
      });
    },
  };
}
