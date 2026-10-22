// 按账号的个性化记忆。
//
// ── 结构（v2）────────────────────────────────────────────
//   identity  身份：用户"明说"的，稳定，跨会话；改口以最新为准
//   focus     关注：从提问统计出来的（主题 / 订单 / 次数）
//   style     表达：用户主动提过的要求（结论先行 / 简短 / 表格 / 语言）
//
// 为什么把这三层分开：
//   · 身份是"事实"，一次就该记住；
//   · 关注是"统计"，需要累计才可信；
//   · 表达是"指令"，出现即生效。
//   三层门槛不同、生命周期不同，混在一个对象里会导致判断逻辑到处都是 if。
//
// ── 注入给模型时 ────────────────────────────────────────
//   会话级事实（本次对话里说过的）和账号级记忆在这里合并去重，只输出一份，
//   避免模型同时看到"周航"两次而困惑。
//
// ── 三条底线（未变）─────────────────────────────────────
//   1. 只存标签与计数，不存问题原文；
//   2. 只影响称呼与表达方式，不参与任何数字计算；
//   3. 原子写 + 同账号串行。
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const VERSION = 2;
const MAX_COUNT = 500;      // 单条目计数上限
const MAX_ORDER_KEYS = 15;  // 订单键上限，防止长期使用无限增长

// ── 识别规则 ────────────────────────────────────────────

// 关注主题：命中即计数
const TOPICS = [
  ['成本差额', /少赚|差额|成本差|差在哪|亏在/],
  ['首次异常', /异常|哪天开始|首次|什么时候开始/],
  ['趋势变化', /改善|变差|趋势|近期|这两天|这周|本周/],
  ['部门分工', /部门|核查|找谁|谁去查|跟进/],
  ['数据缺口', /数据.{0,4}(不足|缺)|还差什么|不足以|补哪些/],
  ['材料成本', /材料|原料|涨价|用量|采购/],
  ['人工成本', /人工|工时|加班/],
  ['质量不良', /不良|质量|返工|报废/],
  ['订单盈亏', /各订单|所有订单|全部订单|赚得怎么样|盈亏|利润|毛利/],
  // 「在哪」太宽，会把「主要少赚在哪里」误判成使用问题，必须收窄成带宾语的组合
  ['使用指引', /怎么用|教程|使用方法|怎么操作|怎么导入|如何导入|在哪导入|在哪看|入口|这个网站|这个系统/]
];

// 表达偏好：用户主动提过的要求
const STYLES = [
  ['conclusion', /先给结论|结论先行|直接说结果|先说结果|只要结论/],
  ['brief', /简短|简单说|一句话|精简|别太长|简要|短一点|少说/],
  ['detail', /详细|展开|具体|逐条|说清楚|多一点|讲透/],
  ['table', /表格|列表|排个表|列个表/]
];

// 语言偏好：说一次就切
// 🔴 中英双语都要认：原来只匹配「用英文」，用英文说 "respond in English please" 完全识别不到，
//    用户换了语言表达就等于没设置（实测 memory.style 直接是空对象）。
const LANGS = [
  ['ja', /(?:用|说|讲|换成|切换成|改成|改为)\s*(日语|日文)|(?:respond|answer|reply|speak|talk)\s+in\s+japanese|in\s+japanese\s+please/i],
  ['en', /(?:用|说|讲|换成|切换成|改成|改为)\s*(英文|英语)|(?:respond|answer|reply|speak|talk)\s+in\s+english|in\s+english\s+please/i],
  ['zh', /(?:用|说|讲|换成|切换成|改成|改为)\s*(中文|汉语)|(?:respond|answer|reply|speak|talk)\s+in\s+chinese|in\s+chinese\s+please/i]
];

// 身份：名字最难抓。
//   真实说法有「我叫小明」「我是小尧」，也有人用「我是采购部的」自我介绍；
//   所以「我是X」抓到后必须过黑名单，否则会把部门当成名字。
//   X 后面还必须是标点或句尾，否则「我是小尧这个网站ai模块的技术负责人」会连成一串。
const NAME_PATTERNS = [
  /我叫\s*([\u4e00-\u9fa5]{2,4}|[A-Za-z][A-Za-z. ]{1,20})(?=[\s，,。！!、；;：]|$|这|的|在|是|负责)/,
  /我是\s*([\u4e00-\u9fa5]{2,4}|[A-Za-z][A-Za-z. ]{1,20})(?=[\s，,。！!、；;：]|$|这|的|在)/,
  /(?:叫我|称呼我)\s*([\u4e00-\u9fa5A-Za-z]{1,10})(?=[\s，,。！!、；;：]|$)/
];
const NAME_STOP = /(部|科|室|中心|组|车间|工厂|公司|负责|经理|主管|总监|工程师|主任|组长|厂长|采购|质量|财务|技术|生产|销售|人事|客服|老板)/;

// 用户「提问」的句式长得跟自我介绍一样：「我叫啥名」「我在哪个部门」「我是谁」。
// 不用疑问词兜住，就会把「啥名」「哪个部门」记成事实，之后模型判定无效 → 表现成「不记得你」
const BAD_FACT = /(什么|啥|谁|哪|几|多少|吗|呢|么)/;

const ROLE_WORDS = /(技术负责人|开发负责人|项目负责人|部门负责人|负责人|项目经理|产品经理|经理|主管|总监|工程师|主任|组长|厂长)/;
// 部门：不只有「我在X部」，真实说法还包括「我调到X部了」「转到质量部」「换到财务部」
// —— 测试里「我调到生产部了」没被识别，导致改口失效、跨会话仍答旧部门。
const DEPT_RULE = /(?:在|属于|来自|我是|调到|转到|换到|调去|去了|换去)\s*([\u4e00-\u9fa5]{1,7}(?:部|科|室|中心|组|车间|工厂|公司))/;
const DUTY_RULE = /负责\s*([\u4e00-\u9fa5A-Za-z]{2,12})/;

// ── 身份提取 ────────────────────────────────────────────

const IDENTITY_LABEL = { name: '姓名', nickname: '称呼', dept: '部门', role: '职务', duty: '职责' };
const IDENTITY_ORDER = ['name', 'nickname', 'dept', 'role', 'duty'];

/**
 * 从一段文字里提取身份事实，返回 {name?, nickname?, dept?, role?, duty?}。
 * 既用于持久化（observe），也用于会话级提取（不落盘，只活在当前对话）。
 */
export function extractFacts(text) {
  const q = String(text || '').trim();
  const out = {};
  if (!q) return out;

  for (const re of NAME_PATTERNS) {
    const hit = q.match(re);
    const raw = hit && hit[1] ? hit[1].trim() : '';
    // 去掉「叫我老尧就行」这类尾缀
    const clean = raw.replace(/(就行|就好了|好了|即可|可以|吧)$/, '').trim();
    if (clean && !NAME_STOP.test(clean) && !BAD_FACT.test(clean)) { out.name = clean.slice(0, 12); break; }
  }

  const role = q.match(ROLE_WORDS);
  if (role) out.role = role[1];

  // 部门取**最后一个**「非否定」的说法：用户更正通常在后半句
  // （「我刚才说错了，我其实不在质量部，我在技术部」→ 技术部）
  const depts = [...q.matchAll(new RegExp(DEPT_RULE.source, 'g'))];
  for (let i = depts.length - 1; i >= 0; i--) {
    const m = depts[i];
    if (q.slice(Math.max(0, m.index - 1), m.index) === '不') continue;   // 不在X部
    const v = m[1] ? m[1].trim() : '';
    if (v && !BAD_FACT.test(v)) { out.dept = v.slice(0, 24); break; }
  }

  const duty = q.match(DUTY_RULE);
  const dutyVal = duty && duty[1] ? duty[1].trim() : '';
  if (dutyVal && !BAD_FACT.test(dutyVal)) out.duty = dutyVal.slice(0, 24);

  return out;
}

// ── 记忆对象 ────────────────────────────────────────────

function blank(userId, clock) {
  const now = new Date(clock()).toISOString();
  return {
    version: VERSION,
    userId,
    createdAt: now,
    updatedAt: now,
    identity: {},
    focus: { topics: {}, orders: {}, asks: 0 },
    style: {}
  };
}

const bump = (bag, key) => { bag[key] = Math.min((bag[key] || 0) + 1, MAX_COUNT); };

/** 把 v1 的扁平结构迁移到 v2。老文件不能因为升级就丢掉用户已经教过的东西。 */
export function migrate(legacy) {
  if (!legacy || legacy.version === VERSION) return legacy;
  const now = new Date().toISOString();
  const map = { '姓名': 'name', '称呼': 'nickname', '部门': 'dept', '职务': 'role', '职责': 'duty' };
  const identity = {};
  for (const [cn, en] of Object.entries(map)) {
    const v = legacy.facts && legacy.facts[cn];
    if (v) identity[en] = v;
  }
  return {
    version: VERSION,
    userId: legacy.userId,
    createdAt: legacy.createdAt || now,
    updatedAt: legacy.updatedAt || now,
    identity,
    focus: {
      topics: legacy.topics || {},
      orders: legacy.orders || {},
      asks: legacy.asks || 0
    },
    style: legacy.style || {}
  };
}

/** 从一次提问里提取特征，就地更新记忆对象 */
export function observe(mem, question, clock = Date.now) {
  const q = String(question || '').trim();
  if (!q) return mem;

  if (!mem.focus) mem.focus = { topics: {}, orders: {}, asks: 0 };
  mem.focus.asks = Math.min((mem.focus.asks || 0) + 1, MAX_COUNT);

  for (const [label, re] of TOPICS) if (re.test(q)) bump(mem.focus.topics, label);

  // SIM-N02 / SIM-A011-QUOTE → N02 / A011
  const found = q.match(/[A-Za-z]{2,}-[A-Za-z0-9]{2,}(?:-[A-Za-z]{2,})?/g) || [];
  for (const raw of found.slice(0, 3)) {
    const key = raw.split('-').filter((x) => !/^(SIM|QUOTE|ORDER|REV)$/i.test(x)).join('');
    if (key && Object.keys(mem.focus.orders).length < MAX_ORDER_KEYS) bump(mem.focus.orders, key);
  }

  if (!mem.style) mem.style = {};
  for (const [key, re] of STYLES) if (re.test(q)) bump(mem.style, key);
  for (const [code, re] of LANGS) if (re.test(q)) mem.style.lang = code;

  // 身份：用户说了就覆盖（改口以最新为准），跨会话保留
  if (!mem.identity) mem.identity = {};
  Object.assign(mem.identity, extractFacts(q));

  mem.updatedAt = new Date(clock()).toISOString();
  return mem;
}

// ── 注入文本 ────────────────────────────────────────────

function topEntries(bag = {}, n = 3) {
  return Object.entries(bag)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
}

/** 身份一行：小尧（技术负责人）｜计划部｜分管排产 */
export function identityLine(identity = {}) {
  const parts = [];
  const name = identity.name || '';
  const nickname = identity.nickname && identity.nickname !== name ? `（称呼「${identity.nickname}」）` : '';
  if (name || nickname) parts.push(`${name}${nickname}`.trim());
  if (identity.dept) parts.push(identity.dept);
  if (identity.role) parts.push(identity.role);
  if (identity.duty) parts.push(`分管${identity.duty}`);
  return parts.join('｜');
}

const LANG_TEXT = { ja: '用日语回答', en: '用英文回答', zh: '用中文回答' };

function styleText(style = {}) {
  const picks = [];
  // 这几种都是用户主动提过的要求（不是猜的），出现一次就照办
  if (style.conclusion >= 1) picks.push('先给结论再展开');
  // 「控制在 200 字内」实测没用：业务问题的表格+分级本身就超 400 字，模型宁可违反也不砍数据。
  // 改成可执行的删减指令——砍铺垫和解释，保留表格与数字。
  if (style.brief >= 1) picks.push('偏简短：第一行给结论，砍掉铺垫与解释性段落；表格和必要数字不算冗长');
  else if (style.detail >= 1) picks.push('展开说明，分点讲清依据');
  if (style.table >= 1) picks.push('能列表时用表格');
  if (style.lang && LANG_TEXT[style.lang]) picks.push(LANG_TEXT[style.lang]);
  return picks.join('；');
}

/**
 * 生成注入给模型的画像文本。
 *
 * @param mem            账号级记忆（可为 null）
 * @param sessionFacts   本次对话里提取到的身份事实（不落盘）
 *
 * 会话级与账号级在这里**合并去重**：只输出一份身份，避免模型看到两遍"周航"而困惑；
 * 会话里新出现、账号里还没有的信息，单独用「本次新提到」标出，让模型知道是本轮才出现的。
 */
export function format(mem, sessionFacts = null) {
  const identity = { ...(mem && mem.identity ? mem.identity : {}) };
  const fresh = {};
  if (sessionFacts && typeof sessionFacts === 'object') {
    for (const key of IDENTITY_ORDER) {
      const v = sessionFacts[key];
      if (!v) continue;
      if (!identity[key]) { identity[key] = v; fresh[key] = v; }
      else if (identity[key] !== v) { identity[key] = v; fresh[key] = v; }  // 会话里改口了
    }
  }

  const asks = (mem && mem.focus && mem.focus.asks) || 0;
  const idLine = identityLine(identity);
  const style = styleText((mem && mem.style) || {});
  // 身份和表达偏好都是用户**主动说出来**的，有一次就生效；
  // 只有纯统计（主题/订单）才要求样本 >= 2，避免拿偶发行为给用户画像。
  if (!idLine && !style && asks < 2) return '';

  const lines = [];
  if (idLine) lines.push(`【身份】${idLine}`);

  const freshLine = Object.keys(fresh).length
    ? IDENTITY_ORDER.filter((k) => fresh[k]).map((k) => `${IDENTITY_LABEL[k]}${fresh[k]}`).join('，')
    : '';
  if (freshLine) lines.push(`【本次对话】用户说明：${freshLine}`);

  if (mem && mem.focus) {
    const topics = topEntries(mem.focus.topics, 3);
    if (topics.length) lines.push(`【关注】${topics.map(([k, v]) => `${k} ${v} 次`).join('｜')}`);
    const orders = topEntries(mem.focus.orders, 3);
    if (orders.length) lines.push(`【常查订单】${orders.map(([k, v]) => `${k} ${v} 次`).join('｜')}`);
  }

  if (style) lines.push(`【表达】${style}`);

  return lines.join('\n');
}

// ── 存储 ────────────────────────────────────────────────

export function createMemoryStore({ dataDir = null, clock = Date.now } = {}) {
  const dir = dataDir ? path.join(dataDir, 'ai-memory') : null;
  const queues = new Map();
  const fileOf = (userId) => path.join(dir, `${userId}.json`);

  async function read(userId) {
    if (!dir || !userId) return null;
    try {
      const raw = JSON.parse(await readFile(fileOf(userId), 'utf8'));
      const mem = migrate(raw);
      return mem && mem.version === VERSION ? mem : null;
    } catch {
      return null;
    }
  }

  /** 记录一次提问。返回 Promise；调用方应 await，保证下一轮能读到。 */
  function update(userId, question) {
    if (!dir || !userId) return Promise.resolve(null);
    const job = (queues.get(userId) || Promise.resolve()).then(async () => {
      const mem = (await read(userId)) || blank(userId, clock);
      observe(mem, question, clock);
      await mkdir(dir, { recursive: true });
      const target = fileOf(userId);
      const tmp = `${target}.${randomUUID()}.tmp`;
      await writeFile(tmp, JSON.stringify(mem), { flag: 'wx', mode: 0o600 });
      await rename(tmp, target);
      return mem;
    });
    queues.set(userId, job.catch(() => {}));
    return job;
  }

  async function clear(userId) {
    if (!dir || !userId) return false;
    try {
      await unlink(fileOf(userId));
      return true;
    } catch {
      return false;
    }
  }

  return { read, update, clear, format };
}
