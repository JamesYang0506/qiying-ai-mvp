// 总项目的本地大模型接口：/api/v1/ai/*
//
// 契约（与 contracts/openapi.json 的 servers=/api/v1 对齐）：
//   GET  /api/v1/ai/status        服务是否就绪、哪个模型在跑、可用内存
//   GET  /api/v1/ai/models        可用模型清单 + 每个模型当前能不能跑
//   POST /api/v1/ai/chat          通用对话（非流式）
//   POST /api/v1/ai/chat/stream   通用对话（SSE 流式）
//   POST /api/v1/ai/answer        企盈业务问答（带人格 + 知识库，SSE）
//   POST /api/v1/ai/json          结构化输出（可传 JSON Schema）
//
// 统一响应包：{schema_version:"1.0", request_id, data} / {..., error:{code,message,details,retryable}}

import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { createAiClient, AiError } from './client.mjs';
import { MODELS, DEFAULT_MODEL, listModels, normalizeModel, pickModel, routeModel } from './models.mjs';
import { isAllowedHost, isAllowedOrigin } from '../http/access.mjs';
import { createProjectContext } from './context.mjs';
import { createChatStore } from './chats.mjs';
import { createMemoryStore, extractFacts, format as formatProfile } from './memory.mjs';

const PREFIX = '/api/v1/ai';
const MAX_BODY = 8 * 1024 * 1024;
const MAX_MESSAGES = 60;
const MAX_CONTENT_CHARS = 60000;

const ROLES = new Set(['system', 'user', 'assistant']);

function envelope(data, requestId) {
  return { schema_version: '1.0', request_id: requestId, data };
}

function failure(error, requestId) {
  return {
    schema_version: '1.0',
    request_id: requestId,
    error: {
      code: error.code || 'AI_REQUEST_FAILED',
      message: error.message || '本地大模型调用失败',
      details: error.details || [],
      retryable: error.retryable === true
    }
  };
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new AiError('AI_REQUEST_TOO_LARGE', '请求体超过 8 MB。', { status: 413 }));
        req.resume();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', (e) => reject(new AiError('AI_REQUEST_ABORTED', String(e?.message || e), { status: 400 })));
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed;
  } catch {
    throw new AiError('AI_BAD_REQUEST', '请求体不是合法的 JSON 对象。', { status: 400 });
  }
}

/** 把三种入参写法统一成 messages：messages[] / prompt / question */
function normalizeMessages(body) {
  let messages = [];

  if (Array.isArray(body.messages)) {
    if (body.messages.length > MAX_MESSAGES) {
      throw new AiError('AI_BAD_REQUEST', `messages 最多 ${MAX_MESSAGES} 条。`, { status: 400 });
    }
    messages = body.messages.map((m, i) => {
      const role = String(m?.role || '').toLowerCase();
      if (!ROLES.has(role)) {
        throw new AiError('AI_BAD_REQUEST', `第 ${i + 1} 条消息的 role 只能是 system/user/assistant。`, {
          status: 400,
          details: [{ field: `messages[${i}].role`, message: String(m?.role ?? '') }]
        });
      }
      const content = typeof m?.content === 'string' ? m.content : '';
      if (!content.trim()) {
        throw new AiError('AI_BAD_REQUEST', `第 ${i + 1} 条消息内容为空。`, {
          status: 400,
          details: [{ field: `messages[${i}].content`, message: '不能为空' }]
        });
      }
      return { role, content: content.slice(0, MAX_CONTENT_CHARS) };
    });
  } else {
    const single = typeof body.prompt === 'string' ? body.prompt
      : typeof body.question === 'string' ? body.question
      : '';
    if (single.trim()) {
      if (body.system) messages.push({ role: 'system', content: String(body.system).slice(0, MAX_CONTENT_CHARS) });
      messages.push({ role: 'user', content: single.slice(0, MAX_CONTENT_CHARS) });
    }
  }

  if (!messages.length) {
    throw new AiError('AI_BAD_REQUEST', '请提供 messages 数组，或 prompt / question 字符串。', { status: 400 });
  }
  if (!messages.some((m) => m.role === 'user')) {
    throw new AiError('AI_BAD_REQUEST', 'messages 里至少要有一条 user 消息。', { status: 400 });
  }
  return messages;
}

function numberOption(value, { min, max, fallback, field }) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new AiError('AI_BAD_REQUEST', `${field} 必须是 ${min}～${max} 之间的数字。`, {
      status: 400,
      details: [{ field, message: String(value) }]
    });
  }
  return n;
}

function localFreeMemGb() {
  return Number((os.freemem() / 2 ** 30).toFixed(1));
}

export function createAiRoutes({ client = createAiClient(), freeMemGb: freeMemSource = localFreeMemGb, clock = Date.now, dataDir = null, getUser = () => null } = {}) {
  // 本进程里正在用上游推理槽的请求数（流式与非流式都算）。
  // 🔴 必须是「同步检查 + 同步占位」：如果先 await 查上游 inflight 再 ++，
  //    同时到达的 N 个请求会各自读到同一个旧值，全部放行（实测 15 路并发一个都没拦住）。
  // 🔴 覆盖面必须是**所有**会调 Ollama 的接口：只卡 /answer 的话，
  //    /chat/stream、/chat、/json 都是现成的后门（实测 6 路绕过去，最慢等 115 秒）。
  let activeUpstream = 0;
  const upstreamLimit = () => Number(process.env.AI_MAX_INFLIGHT || 5);

  function openSlot(res) {
    const limit = upstreamLimit();
    if (activeUpstream >= limit) {
      throw new AiError(
        'AI_BUSY',
        `现在有 ${activeUpstream} 个问题正在处理（AI 一次只能答一个）。等一会儿再问，或者把问题拆短一点，会快很多。`,
        { status: 429, retryable: true, details: [{ field: 'inflight', message: String(activeUpstream) }] }
      );
    }
    activeUpstream++;
    // 断开监听要在这里就挂上，不能等到 pipeStream —— 用户在「正在思考」时点停止，
    // 那时还卡在 openStream 等响应头，没人取消的话上游会照常跑完，槽一直被占。
    const ac = new AbortController();
    const onGone = () => { if (!res.writableEnded) ac.abort(new Error('client gone')); };
    res.once('close', onGone);
    return {
      signal: ac.signal,
      close: () => { res.off('close', onGone); activeUpstream--; }
    };
  }
  // 项目内部数据摘要（供 AI 回答业务问题时参考）；没有 dataDir 时降级为空
  const getProjectContext = dataDir ? createProjectContext({ dataDir, clock }) : async () => '';
  // 对话历史：按账号隔离，落在 dataDir/ai-chats/<userId>.json
  const chatStore = dataDir ? createChatStore({ dataDir, clock }) : null;
  // 交互偏好记忆：按账号隔离，落在 dataDir/ai-memory/<userId>.json
  // 只存统计与标签，不存问题原文；注入时只影响表达方式，不改数据口径。
  const memoryStore = dataDir ? createMemoryStore({ dataDir, clock }) : null;
  // 允许传函数（每次实时读），也允许传一个固定数字（测试/演示用）
  const freeMemGb = typeof freeMemSource === 'function'
    ? freeMemSource
    : () => Number(freeMemSource);
  /** 探测上游，拿到已装模型与已加载模型；上游没起就返回 null（auto 时降级用默认模型） */
  async function probe() {
    try {
      const [health, models] = await Promise.all([client.health(), client.models()]);
      // 真实「对话模型」优先取上游 chatModel（ai-service 启动时由 MODEL 决定的 DEFAULT_MODEL）；
      // health.loadedModel 是 ollama /api/ps 第一个模型，可能是 bge-m3 嵌入模型，不能当对话模型。
      const chatModel = health.chatModel ?? health.loadedModel ?? null;
      return {
        available: models.list.map((m) => m.id),
        loaded: chatModel,
        chatModel,
        freeMemGb: health.freeMemGb ?? freeMemGb(),
        health,
        models
      };
    } catch {
      return null;
    }
  }

  /**
   * 决定这次请求跑哪个模型。
   * @param {object} body 原始请求体，认 model / effort / keep_current
   * @param {object|null} probeResult 已探测过的上游结果（复用可省一次往返）
   * @param {Array|null} messages 已归一化的消息（评分用，比 body.messages 更准）
   */
  async function decideModel(body = {}, probeResult = null, messages = null) {
    const normalized = normalizeModel(body.model);
    if (!normalized.ok) {
      throw new AiError('AI_BAD_REQUEST', normalized.message, { status: 400, details: [{ field: 'model', message: String(body.model) }] });
    }
    // 显式指定：不做内存预检，直接交给上游；真跑不动时上游的 OOM 会被翻译成 MODEL_UNAVAILABLE
    if (normalized.model) {
      return {
        model: normalized.model,
        routing: { reason: 'explicit', effort: null, score: null, signals: [], degraded: false, stayed: false }
      };
    }

    const probeData = probeResult ?? (await probe());

    // 🔴 probe 返回 null = 连不上上游，这跟「内存不够」完全是两回事。
    //    不单独拦的话，后面 routeModel 会拿到空模型列表，报出
    //    「可用内存 0.5 GB，跑 qwen3.5:9b 至少需要 5 GB，请先释放内存」——
    //    用户会去关一堆程序，但真正该做的是启动「企盈 AI」服务。
    if (!probeData) {
      throw new AiError(
        'AI_SERVICE_UNAVAILABLE',
        `连不上本地大模型服务（${client.baseUrl}）。请先启动「企盈 AI」服务，再重试。`,
        { status: 503, retryable: true, details: [{ field: 'base_url', message: client.baseUrl }] }
      );
    }

    // 🔴 auto = 跟随上游（AI 服务）当前启动的模型，也就是控制台里选的那个，不再自己按任务打分分流。
    //    原因：控制台已经让用户显式选了模型，网站再自作主张切成另一个，会把他选的模型挤出显存，
    //    下一次提问又要付 28~46 s 冷加载 —— 用户看到的就是「选了 gpt，一问又变回 qwen」。
    //    需要强制某档时，前端显式传 effort:'lite' / 'deep' 或 model:'qwen' / 'gpt-oss' 仍然生效。
    const effort = body.effort ?? 'auto';
    if (effort === 'auto' && probeData?.chatModel) {
      return {
        model: probeData.chatModel,
        routing: { reason: 'follow_upstream', effort: 'auto', score: null, signals: [], degraded: false, stayed: true }
      };
    }

    const routed = routeModel({
      messages: Array.isArray(messages) ? messages : (Array.isArray(body.messages) ? body.messages : []),
      question: body.question || body.prompt || '',
      analysis: body.analysis ?? null,
      schema: body.schema ?? body.format ?? null,
      maxTokens: typeof body.max_tokens === 'number' ? body.max_tokens : null,
      effort,
      available: probeData?.available ?? [],
      loaded: probeData?.loaded ?? null,
      freeMemGb: probeData?.freeMemGb ?? freeMemGb(),
      keepCurrent: body.keep_current === true
    });
    if (!routed.ok) {
      throw new AiError(routed.code, routed.message, {
        status: routed.code === 'MODEL_UNAVAILABLE' ? 503 : routed.code === 'AI_BAD_REQUEST' ? 400 : 409,
        retryable: routed.retryable === true,
        details: routed.code === 'AI_BAD_REQUEST' ? [{ field: 'effort', message: String(body.effort) }] : undefined
      });
    }
    return {
      model: routed.model,
      routing: {
        reason: routed.reason,
        effort: routed.effort,
        score: routed.score,
        signals: routed.signals,
        degraded: routed.degraded,
        stayed: routed.stayed
      }
    };
  }

  /** SSE 转发：把上游的 content/thinking/note/error 归一成 type 事件 */
  async function pipeStream(req, res, upstream, { requestId, model, routing = null, collect = false }) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const write = (type, data) => {
      res.write(`data: ${JSON.stringify({ schema_version: '1.0', request_id: requestId, type, data })}\n\n`);
    };

    write('meta', { provider: 'qiying', model, ...(routing ? { routing } : {}) });

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let finishReason = 'stop';
    const started = clock();
    let aborted = false;

    const disconnect=()=>{aborted=true;reader.cancel().catch(()=>{});};
    res.once('close',disconnect);

    const handle = (line) => {
      const s = line.trim();
      if (!s.startsWith('data:')) return;
      const payload = s.slice(5).trim();
      if (payload === '[DONE]') return;
      let obj;
      try { obj = JSON.parse(payload); } catch { return; }

      if (obj.type === 'meta') {
        // 🔴 上游 meta 里的 ahead = 「前面还有几个人」，是排队唯一的可视化信号。
        //    原来一行 return 直接丢掉，前端只能干等；现在转发成 queue 事件。
        const aheadCount = Number(obj.ahead ?? obj.data?.ahead);
        if (Number.isFinite(aheadCount) && aheadCount > 0) write('queue', { ahead: aheadCount });
        return; // 上游的 meta 已由我们重发
      }
      if (typeof obj.thinking === 'string' && obj.thinking) {
        write('thinking', { text: obj.thinking });
        return;
      }
      if (typeof obj.content === 'string' && obj.content) {
        text += obj.content;
        write('delta', { text: obj.content });
        return;
      }
      if (obj.note) {
        write('note', obj.note);
        return;
      }
      // 🔴 上游的数字校验告警（回答里出现了摘要中没有的数字）。
      //    这里只认 thinking/content/note/error，warning 会被整条丢掉 ——
      //    前端就算加了解析也永远收不到，护栏等于没做（实测日志有告警、前端 0 条）。
      if (obj.type === 'warning' && obj.data) {
        write('warning', obj.data);
        return;
      }
      if (obj.error) {
        finishReason = 'error';
        write('error', { code: 'AI_STREAM_INTERRUPTED', message: String(obj.error) });
      }
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (aborted) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) handle(line);
      }
      buffer += decoder.decode();
      if (buffer.trim()) handle(buffer);
    } catch (error) {
      finishReason = 'error';
      if(!aborted)write('error', { code: 'AI_STREAM_INTERRUPTED', message: String(error?.message || error) });
    }

    res.off('close',disconnect);
    if(aborted)return {text,finishReason:'cancelled'};

    write('done', {
      model,
      finish_reason: finishReason,
      chars: text.length,
      latency_ms: clock() - started,
      ...(collect ? {} : {})
    });
    res.write('data: [DONE]\n\n');
    res.end();
    return { text, finishReason };
  }

  return async function aiRoutes(req, res, url) {
    if (url.pathname !== PREFIX && !url.pathname.startsWith(PREFIX + '/')) return false;

    const requestId = randomUUID();
    const route = url.pathname.slice(PREFIX.length) || '/';
    const method = req.method || 'GET';

    try {
      const host = req.headers.host ?? '';
      if (!isAllowedHost(host)) {
        throw new AiError('AI_FORBIDDEN', '本地大模型接口只允许本机或已授权局域网设备访问。', { status: 403 });
      }
      if(method==='POST'&&!isAllowedOrigin(req,host))throw new AiError('AI_FORBIDDEN','请从本站页面发送AI问题',{status:403});

      // ---------- 状态 ----------
      if (method === 'GET' && (route === '/status' || route === '/')) {
        const probeData = await probe();
        if (!probeData) {
          return sendJson(res, 200, envelope({
            configured: true,
            status: 'unavailable',
            provider: 'qiying',
            base_url: client.baseUrl,
            default_model: DEFAULT_MODEL,
            loaded_model: null,
            free_mem_gb: freeMemGb(),
            models: listModels().map((m) => m.id),
            message: `连不上本地大模型服务（${client.baseUrl}），请先启动「企盈 AI」。`
          }, requestId)), true;
        }
        const installed = new Set(probeData.available);
        // 真实对话模型：优先上游 chatModel；拿不到就退回本服务写死的 DEFAULT_MODEL。
        const chatModel = probeData.chatModel ?? DEFAULT_MODEL;
        return sendJson(res, 200, envelope({
          configured: true,
          status: installed.size > 0 ? 'ready' : 'unavailable',
          provider: 'qiying',
          base_url: client.baseUrl,
          default_model: chatModel,
          chat_model: chatModel,
          loaded_model: probeData.loaded,
          vram_ratio: probeData.health.vramRatio,
          on_cpu: probeData.health.onCpu,
          free_mem_gb: probeData.freeMemGb,
          models: listModels().map((m) => m.id),
          message: installed.size > 0
            ? (probeData.loaded ? `已加载 ${probeData.loaded}` : '服务在线，模型未加载（首次调用会冷加载，约 54 秒）')
            : 'Ollama 里没有可用的对话模型，请先 ollama pull。'
        }, requestId)), true;
      }

      // ---------- 模型清单 ----------
      if (method === 'GET' && route === '/models') {
        const probeData = await probe();
        const installed = new Set(probeData?.available ?? []);
        const free = probeData?.freeMemGb ?? freeMemGb();
        return sendJson(res, 200, envelope({
          default_model: DEFAULT_MODEL,
          loaded_model: probeData?.loaded ?? null,
          free_mem_gb: free,
          models: listModels().map((m) => {
            const isInstalled = installed.size === 0 ? null : installed.has(m.id);
            return {
              id: m.id,
              label: m.label,
              tier: m.tier,
              size_gb: m.sizeGb,
              min_free_mem_gb: m.minFreeMemGb,
              strength: m.strength,
              note: m.note,
              installed: isInstalled,
              loaded: probeData?.loaded === m.id,
              runnable: isInstalled === false ? false : free >= m.minFreeMemGb
            };
          }),
          aliases: { auto: '自动选择', large: 'gpt-oss:20b', small: 'qwen3.5:9b' }
        }, requestId)), true;
      }

      // ---------- 个人交互偏好（按账号，可查看 / 可清除） ----------
      if (route === '/memory') {
        if (!memoryStore) throw new AiError('AI_UNAVAILABLE', '偏好记忆未启用（缺少数据目录）。', { status: 503 });
        const user = getUser(req);
        if (!user?.id) throw new AiError('LOGIN_REQUIRED', '请先登录后查看个人偏好。', { status: 401 });
        if (method === 'DELETE') {
          await memoryStore.clear(user.id);
          return sendJson(res, 200, envelope({ cleared: true }, requestId)), true;
        }
        const mem = await memoryStore.read(user.id);
        return sendJson(res, 200, envelope({
          identity: (mem && mem.identity) || {},
          topics: (mem && mem.focus && mem.focus.topics) || {},
          orders: (mem && mem.focus && mem.focus.orders) || {},
          asks: (mem && mem.focus && mem.focus.asks) || 0,
          style: (mem && mem.style) || {},
          updatedAt: (mem && mem.updatedAt) || null,
          summary: formatProfile(mem, null) || ''
        }, requestId)), true;
      }

      // ---------- 对话历史（按账号隔离，DeepSeek 风格侧栏的数据源） ----------
      if (route === '/conversations' || route.startsWith('/conversations/')) {
        if (!chatStore) throw new AiError('AI_UNAVAILABLE', '对话历史存储未启用（缺少数据目录）。', { status: 503 });
        const user = getUser(req);
        if (!user?.id) throw new AiError('LOGIN_REQUIRED', '请先登录后查看对话历史。', { status: 401 });

        if (method === 'GET' && route === '/conversations') {
          return sendJson(res, 200, envelope({ conversations: await chatStore.list(user.id) }, requestId)), true;
        }
        if (method === 'GET' && route.startsWith('/conversations/')) {
          const id = decodeURIComponent(route.slice('/conversations/'.length));
          const conv = await chatStore.get(user.id, id);
          if (!conv) throw new AiError('AI_NOT_FOUND', '对话不存在或已删除。', { status: 404 });
          return sendJson(res, 200, envelope(conv, requestId)), true;
        }
        if (method === 'POST' && route === '/conversations') {
          const body = await readJson(req);
          // 没有消息的会话不落盘：原来 normalize() 会给个随机 id 存个空壳，
          // 每次误调用都占一个名额（单账号上限 50 个），把真实历史挤掉。
          if (!Array.isArray(body.messages) || !body.messages.length) {
            throw new AiError('AI_BAD_REQUEST', '会话至少要包含一条消息。', { status: 400 });
          }
          return sendJson(res, 200, envelope(await chatStore.save(user.id, body), requestId)), true;
        }
        if (method === 'DELETE' && route.startsWith('/conversations/')) {
          const id = decodeURIComponent(route.slice('/conversations/'.length));
          const removed = await chatStore.remove(user.id, id);
          if (!removed) throw new AiError('AI_NOT_FOUND', '对话不存在或已删除。', { status: 404 });
          return sendJson(res, 200, envelope({ deleted: id }, requestId)), true;
        }
        throw new AiError('AI_METHOD_NOT_ALLOWED', `${route} 不支持 ${method}。`, { status: 405 });
      }

      if (method !== 'POST') {
        throw new AiError('AI_METHOD_NOT_ALLOWED', `${route} 只支持 POST。`, { status: 405 });
      }

      // ---------- 非流式对话 / 结构化输出 ----------
      if (route === '/chat' || route === '/json') {
        const body = await readJson(req);
        const messages = normalizeMessages(body);
        const { model, routing } = await decideModel(body, null, messages);

        const wantsJson = route === '/json' || body.schema != null || body.format != null;
        const schema = body.schema ?? body.format;

        const payload = {
          model,
          messages,
          temperature: numberOption(body.temperature, { min: 0, max: 2, fallback: wantsJson ? 0.2 : 0.7, field: 'temperature' }),
          num_predict: numberOption(body.max_tokens, { min: 1, max: 32768, fallback: 2048, field: 'max_tokens' }),
          timeout_ms: numberOption(body.timeout_ms, { min: 1000, max: 600000, fallback: 300000, field: 'timeout_ms' }),
          think: body.think === true
        };
        if (body.num_ctx != null) payload.num_ctx = numberOption(body.num_ctx, { min: 512, max: 32768, fallback: 12288, field: 'num_ctx' });
        if (schema && typeof schema === 'object') payload.format = schema;

        // 非流式同样占一个推理槽（一次可能跑几十秒），也必须排队
        const slot = openSlot(res);
        try {
          const result = await client.completeJson(payload, { signal: slot.signal });

          let parsed = null;
          if (wantsJson) {
            try { parsed = JSON.parse(result.content); } catch {
              throw new AiError('AI_OUTPUT_NOT_JSON', '模型没有按要求返回 JSON（常见于输出被长度截断）。可调大 max_tokens 后重试。', {
                status: 502,
                retryable: true,
                details: [{ field: 'content', message: result.content.slice(0, 200) }]
              });
            }
          }

          return sendJson(res, 200, envelope({
            model: result.model,
            routing,
            content: result.content,
            ...(parsed !== null ? { json: parsed } : {}),
            finish_reason: result.finishReason,
            latency_ms: result.latencyMs,
            usage: {
              prompt_tokens: result.promptTokens,
              completion_tokens: result.completionTokens
            }
          }, requestId)), true;
        } finally {
          slot.close();
        }
      }

      // ---------- 流式对话 ----------
      if (route === '/chat/stream' || route === '/answer') {
        const body = await readJson(req);

        if (route === '/answer') {
          // 企盈业务问答：走上游 /api/chat，人格 + 知识库由上游注入
          const rawQuestion = body.question ?? body.prompt;
          // 🔴 类型必须严检：String(12345) 会变成 "12345" 被当成真问题送进模型，
          //    占掉唯一的推理槽（实测 question:12345 真的跑了 180 秒后 504）。
          //    messages 分支有 typeof 检查，这里之前没有，两条路径强度不一致。
          if (rawQuestion != null && typeof rawQuestion !== 'string') {
            throw new AiError('AI_BAD_REQUEST', 'question 必须是字符串。', {
              status: 400,
              details: [{ field: 'question', message: typeof rawQuestion }]
            });
          }
          const question = String(rawQuestion ?? '').trim();
          if (!question) throw new AiError('AI_BAD_REQUEST', '请提供 question（要问的业务问题）。', { status: 400 });
          // 原来超过 6 万字是静默截断，用户不知道自己问的有一半没进去 —— 直接拒绝更诚实
          if (question.length > MAX_CONTENT_CHARS) {
            throw new AiError('AI_BAD_REQUEST', `问题太长（${question.length} 字，上限 ${MAX_CONTENT_CHARS} 字），请精简后再问。`, { status: 400 });
          }
          // 入口限流 + 断开取消都交给 openSlot（同步占位，无竞态）
          const slot = openSlot(res);
          try {
            const user = getUser(req);
            const { model, routing } = await decideModel(body, null, null);
            const injected = await getProjectContext({asOf:body.asOf,orderId:body.orderId??''});
            // 会话级事实（本次对话里说过的）+ 账号级记忆，交给 memory.format 统一合并去重，
            // 只输出一份，避免模型同时看到两个「周航」而困惑。
            // 两者都只影响称呼与表达方式，不参与任何数字计算。
            const saidText = (Array.isArray(body.history) ? body.history : [])
              .filter((m) => m && m.role === 'user' && typeof m.content === 'string')
              .map((m) => m.content)
              .join('\n');
            const sessionFacts = extractFacts(`${saidText}\n${question}`);
            let profile = '', language = '';
            try {
              const saved = memoryStore && user?.id ? await memoryStore.read(user.id) : null;
              profile = formatProfile(saved, sessionFacts) || '';
              // 语言偏好单独传：只写进 profile 文本压不住 —— system 里有 3400 字中文摘要，
              // 模型会顺着上下文继续说中文。上游会把它放到 system 最末尾强化。
              language = saved?.style?.lang || '';
            } catch { profile = ''; }
            // 🔴 记账放在回答**之前**：放在流结束后会出现「刚问完立刻查 /memory 还是空的」，
            //    因为流结束到落盘之间有几毫秒空档。提前写时序就确定了。
            if (user?.id && memoryStore) await memoryStore.update(user.id, question).catch(() => {});
            const upstream = await client.openStream('/api/chat', {
              model,
              question: question.slice(0, MAX_CONTENT_CHARS),
              history: Array.isArray(body.history) ? body.history.slice(-20).filter(m=>['user','assistant'].includes(m?.role)&&typeof m.content==='string'&&m.content.trim()).map(m=>({role:m.role,content:m.content.slice(0,4000)})) : [],
              analysis: injected ? String(injected).slice(0, 7000) : undefined,
              profile: profile || undefined,
              language: language || undefined,
              useKB: body.use_kb !== false,
              // 🔴 0.7 → 0.3：业务问答要稳定复述数字，高温会让模型把 8,136 写成 8,316、把 10 月写成 11 月。
              temperature: numberOption(body.temperature, { min: 0, max: 2, fallback: 0.3, field: 'temperature' }),
              thinking: body.think === true
            }, { signal: slot.signal });
            const done = await pipeStream(req, res, upstream, { requestId, model, routing });
            return done, true;
          } finally {
            slot.close();
          }
        }

        const messages = normalizeMessages(body);
        const { model, routing } = await decideModel(body, null, messages);
        // /chat/stream 走的是同一个上游推理槽，必须和 /answer 一样排队，
        // 否则它就是绕过限流的后门（实测 6 路并发全部放行，最慢等 115 秒）。
        const slot = openSlot(res);
        try {
          const upstream = await client.openStream('/api/complete', {
            model,
            messages,
            temperature: numberOption(body.temperature, { min: 0, max: 2, fallback: 0.4, field: 'temperature' }),
            num_ctx: numberOption(body.num_ctx, { min: 512, max: 32768, fallback: 12288, field: 'num_ctx' }),
            think: body.think === true
          }, { signal: slot.signal });
          return await pipeStream(req, res, upstream, { requestId, model, routing }), true;
        } finally {
          slot.close();
        }
      }

      throw new AiError('AI_NOT_FOUND', `接口不存在：${url.pathname}`, { status: 404 });
    } catch (error) {
      const known = error instanceof AiError ? error : new AiError('AI_INTERNAL', String(error?.message || error), { status: 500 });
      // 客户端已经走了（点停止 / 关页面 / 断网）：连接都没了，别再去写 504，
      // 否则每次中断都会在日志里留一条假的「超时」。
      if (res.headersSent || res.destroyed || known.code === 'AI_CANCELLED') {
        if (!res.destroyed) { try { res.end(); } catch {} }
        return true;
      }
      sendJson(res, known.status, failure(known, requestId));
      return true;
    }
  };
}

export { MODELS };
