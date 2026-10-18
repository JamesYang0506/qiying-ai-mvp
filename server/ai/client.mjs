// 企盈 AI 客户端：总项目里所有本地大模型调用的唯一出口。
// 上游就是 qiying-ai/ai-service（127.0.0.1:3320），本文件不再直连 Ollama。
//
// 为什么要有这一层：
//   1. 上游跑在独立进程，主站可能没起它 —— 需要把"连不上"翻译成人话，而不是 ECONNREFUSED；
//   2. gpt-oss 冷加载 ~54 秒，必须有合理的超时与可重试标记；
//   3. 模型名、num_ctx、keep_alive 全部由上游统一管理，这里只负责转发与错误归一。

const DEFAULTS = {
  baseUrl: process.env.QIYING_AI_BASE || 'http://127.0.0.1:3320',
  // 冷加载实测 54s，留足余量；超长生成不受这个限制（只卡住"连上/拿到响应头"）
  openTimeoutMs: 180000,
  jsonTimeoutMs: 300000,
  probeTimeoutMs: 2500
};

// Ollama 内存不足时的典型报错，命中就告诉调用方"换 qwen 或释放内存"，而不是丢一个 500
const OOM_PATTERN = /unable to allocate|out of memory|CUDA_Host|runner has unexpectedly stopped|model requires more system memory/i;

export class AiError extends Error {
  constructor(code, message, { status = 502, retryable = false, details = [] } = {}) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

function withTimeout(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(timer) };
}

export function createAiClient(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const base = String(cfg.baseUrl).replace(/\/+$/, '');

  async function request(path, { method = 'GET', body, timeoutMs = cfg.jsonTimeoutMs } = {}) {
    const t = withTimeout(timeoutMs);
    try {
      const res = await fetch(base + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: t.signal
      });
      return { res };
    } catch (error) {
      if (error?.name === 'AbortError' || /timeout/i.test(String(error?.message))) {
        throw new AiError('AI_TIMEOUT', '本地大模型响应超时，请重试或改用 qwen 模型。', {
          status: 504,
          retryable: true
        });
      }
      throw new AiError(
        'AI_SERVICE_UNAVAILABLE',
        `连不上本地大模型服务（${base}）。请先启动「企盈 AI」服务，再重试。`,
        { status: 503, retryable: true, details: [{ field: 'base_url', message: base }] }
      );
    } finally {
      t.clear();
    }
  }

  function translateUpstream(status, text) {
    const detail = String(text || '').slice(0, 500);
    if (OOM_PATTERN.test(detail)) {
      return new AiError(
        'MODEL_UNAVAILABLE',
        '显存/内存不够，模型被系统杀了。改用 qwen3.5:9b（model: "qwen"）或先关掉占内存的程序。',
        { status: 503, retryable: true, details: [{ field: 'upstream', message: detail }] }
      );
    }
    if (status === 404) {
      return new AiError('AI_ENDPOINT_MISSING', `企盈 AI 不认这个接口（HTTP 404）。检查 ai-service 版本是否包含该端点。`, {
        status: 502,
        details: [{ field: 'upstream', message: detail }]
      });
    }
    return new AiError('AI_UPSTREAM_ERROR', `本地大模型服务返回 HTTP ${status}。`, {
      status: 502,
      retryable: status >= 500,
      details: detail ? [{ field: 'upstream', message: detail }] : []
    });
  }

  return {
    baseUrl: base,

    /** 健康检查：上游是否活着、模型是否已加载、可用内存多少 */
    async health() {
      const { res } = await request('/api/health', { timeoutMs: cfg.probeTimeoutMs });
      if (!res.ok) throw translateUpstream(res.status, await res.text().catch(() => ''));
      const data = await res.json().catch(() => ({}));
      return {
        loaded: Boolean(data.loaded),
        loadedModel: data.model ?? null,
        // 🔴 上游真实「对话模型」：ai-service 启动时用 MODEL 环境变量决定的 DEFAULT_MODEL，
        //    它会原样透传回来（chatModel 字段）。ps 列表第一个模型（data.model）可能是 bge-m3 嵌入模型，
        //    不能当对话模型用。这里额外带上 chatModel，供 status 显示「当前对话模型」。
        chatModel: data.chatModel ?? data.model ?? null,
        vramRatio: typeof data.vramRatio === 'number' ? data.vramRatio : null,
        onCpu: data.onCpu === true,
        partiallyOnCpu: data.partiallyOnCpu === true,
        freeMemGb: typeof data.freeMemGB === 'number' ? data.freeMemGB : null,
        kb: data.kb ?? null
      };
    },

    /** 上游已安装的对话模型 */
    async models() {
      const { res } = await request('/api/models', { timeoutMs: cfg.probeTimeoutMs });
      if (!res.ok) throw translateUpstream(res.status, await res.text().catch(() => ''));
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.models) ? data.models : [];
      return {
        list: list.map((m) => ({ id: m.name, sizeBytes: m.size ?? null })),
        upstreamDefault: data.default ?? null
      };
    },

    /** 通用对话（非流式，可带 JSON Schema），上游 /api/json */
    async completeJson(payload) {
      const { res } = await request('/api/json', {
        method: 'POST',
        body: payload,
        timeoutMs: payload.timeout_ms || cfg.jsonTimeoutMs
      });
      if (!res.ok) throw translateUpstream(res.status, await res.text().catch(() => ''));
      const data = await res.json().catch(() => null);
      if (!data) throw new AiError('AI_UPSTREAM_ERROR', '本地大模型返回了非 JSON 响应。', { status: 502, retryable: true });
      return {
        model: data.model ?? payload.model ?? null,
        content: String(data.content ?? ''),
        finishReason: data.done_reason || 'stop',
        latencyMs: data.latency_ms ?? null,
        promptTokens: data.prompt_eval_count ?? null,
        completionTokens: data.eval_count ?? null
      };
    },

    /**
     * 打开一条 SSE 流。调用方负责把 body 转发给浏览器。
     * 先拿到响应头再返回，这样上游报错还能变成正常的 JSON 错误包。
     */
    async openStream(path, payload) {
      const { res } = await request(path, { method: 'POST', body: payload, timeoutMs: cfg.openTimeoutMs });
      if (!res.ok) throw translateUpstream(res.status, await res.text().catch(() => ''));
      return res;
    }
  };
}
