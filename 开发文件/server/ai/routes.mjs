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

export function createAiRoutes({ client = createAiClient(), freeMemGb: freeMemSource = localFreeMemGb, clock = Date.now, dataDir = null } = {}) {
  // 项目内部数据摘要（供 AI 回答业务问题时参考）；没有 dataDir 时降级为空
  const getProjectContext = dataDir ? createProjectContext({ dataDir, clock }) : async () => '';
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
    const routed = routeModel({
      messages: Array.isArray(messages) ? messages : (Array.isArray(body.messages) ? body.messages : []),
      question: body.question || body.prompt || '',
      analysis: body.analysis ?? null,
      schema: body.schema ?? body.format ?? null,
      maxTokens: typeof body.max_tokens === 'number' ? body.max_tokens : null,
      effort: body.effort ?? 'auto',
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

      if (obj.type === 'meta') return; // 上游的 meta 已由我们重发
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
        if (body.num_ctx != null) payload.num_ctx = numberOption(body.num_ctx, { min: 512, max: 32768, fallback: 6144, field: 'num_ctx' });
        if (schema && typeof schema === 'object') payload.format = schema;

        const result = await client.completeJson(payload);

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
      }

      // ---------- 流式对话 ----------
      if (route === '/chat/stream' || route === '/answer') {
        const body = await readJson(req);

        if (route === '/answer') {
          // 企盈业务问答：走上游 /api/chat，人格 + 知识库由上游注入
          const question = String(body.question || body.prompt || '').trim();
          if (!question) throw new AiError('AI_BAD_REQUEST', '请提供 question（要问的业务问题）。', { status: 400 });
          const { model, routing } = await decideModel(body, null, null);
          const injected = await getProjectContext({asOf:body.asOf,orderId:body.orderId??''});
          const upstream = await client.openStream('/api/chat', {
            model,
            question: question.slice(0, MAX_CONTENT_CHARS),
            history: Array.isArray(body.history) ? body.history.slice(-20).filter(m=>['user','assistant'].includes(m?.role)&&typeof m.content==='string'&&m.content.trim()).map(m=>({role:m.role,content:m.content.slice(0,4000)})) : [],
            analysis: injected ? String(injected).slice(0, 6000) : undefined,
            useKB: body.use_kb !== false,
            temperature: numberOption(body.temperature, { min: 0, max: 2, fallback: 0.7, field: 'temperature' }),
            thinking: body.think === true
          });
          return await pipeStream(req, res, upstream, { requestId, model, routing }), true;
        }

        const messages = normalizeMessages(body);
        const { model, routing } = await decideModel(body, null, messages);
        const upstream = await client.openStream('/api/complete', {
          model,
          messages,
          temperature: numberOption(body.temperature, { min: 0, max: 2, fallback: 0.4, field: 'temperature' }),
          num_ctx: numberOption(body.num_ctx, { min: 512, max: 32768, fallback: 6144, field: 'num_ctx' }),
          think: body.think === true
        });
        return await pipeStream(req, res, upstream, { requestId, model, routing }), true;
      }

      throw new AiError('AI_NOT_FOUND', `接口不存在：${url.pathname}`, { status: 404 });
    } catch (error) {
      const known = error instanceof AiError ? error : new AiError('AI_INTERNAL', String(error?.message || error), { status: 500 });
      if (res.headersSent) {
        try { res.end(); } catch {}
        return true;
      }
      sendJson(res, known.status, failure(known, requestId));
      return true;
    }
  };
}

export { MODELS };
