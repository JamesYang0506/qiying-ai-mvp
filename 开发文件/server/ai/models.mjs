// 本地大模型注册表与选择策略
// 只登记两套已部署的模型：gpt-oss:20b（主力）与 qwen3.5:9b（轻量）
// 任何调用都必须经过这里解析模型名，避免各模块各写一套 tag 互相打脸。

export const MODELS = {
  'gpt-oss:20b': {
    id: 'gpt-oss:20b',
    label: 'GPT-OSS 20B',
    tier: 'large',
    sizeGb: 12.85,
    // 2026-10-17 实测（RTX 3070 Laptop 8 GB + 15.6 GB 内存，num_ctx=6144）：
    //   空闲 6.96 GB → 加载 46.7s，常驻 14.03 GB（显存 6.21 GB + 内存 ~7.8 GB），
    //   生成 38.7 tok/s，加载后仅剩 ~0.9 GB 空闲。取 7.0 GB 作准入线。
    minFreeMemGb: 7.0,
    strength: '复杂推理、经营归因、长文本结构化输出',
    note: '主力模型。可用内存低于 7 GB 会 OOM；接近 7 GB 时属极限运行——能跑但加载约 47s、系统仅剩 1 GB 左右，建议先关浏览器/壁纸。'
  },
  'qwen3.5:9b': {
    id: 'qwen3.5:9b',
    label: 'Qwen3.5 9B',
    tier: 'small',
    sizeGb: 6.1,
    // 2026-10-17 实测（num_ctx=4096）：空闲 4.91 GB 即可加载，常驻 6.22 GB
    //   （显存 5.06 GB + 内存 ~1.2 GB），加载 25.6s，生成 ~42 tok/s。
    minFreeMemGb: 5.0,
    strength: '轻量问答、简报、快速结构化输出',
    note: '降级模型。思考型模型，本服务默认关闭 thinking，否则正文可能为 0 字；ctx 压到 4096 时内存门槛可再降约 0.3 GB。'
  }
};

// 允许前端/其他模块用简写，省得每个人去记 tag
export const MODEL_ALIASES = {
  auto: 'auto',
  default: 'auto',
  'gpt-oss': 'gpt-oss:20b',
  'gpt-oss:20b': 'gpt-oss:20b',
  'gptoss': 'gpt-oss:20b',
  oss: 'gpt-oss:20b',
  large: 'gpt-oss:20b',
  big: 'gpt-oss:20b',
  qwen: 'qwen3.5:9b',
  'qwen:9b': 'qwen3.5:9b',
  'qwen3.5': 'qwen3.5:9b',
  'qwen3.5:9b': 'qwen3.5:9b',
  small: 'qwen3.5:9b',
  lite: 'qwen3.5:9b'
};

export const DEFAULT_MODEL = 'gpt-oss:20b';

export function listModels() {
  return Object.values(MODELS);
}

/**
 * 把各种写法解析成真实模型 tag。
 * @returns {{ok:true, model:string|null, auto:boolean} | {ok:false, message:string}}
 */
export function normalizeModel(input) {
  if (input == null || input === '') return { ok: true, model: null, auto: true };
  const key = String(input).trim().toLowerCase();
  const mapped = Object.hasOwn(MODEL_ALIASES,key)?MODEL_ALIASES[key]:null;
  if (!mapped) {
    return {
      ok: false,
      message: `不认识的模型「${input}」。可用：${Object.keys(MODELS).join('、')}，或传 auto 让服务自己挑。`
    };
  }
  if (mapped === 'auto') return { ok: true, model: null, auto: true };
  return { ok: true, model: mapped, auto: false };
}

/**
 * 选定最终要跑的模型。
 * 规则：显式指定 → 能用就用，内存不够直接报错（不偷偷换模型）；
 *        auto → 已在显卡里的优先，其次按可用内存挑最大的。
 * @param {{requested:string|null, available:string[], loaded:string|null, freeMemGb:number}} ctx
 */
export function pickModel({ requested, available = [], loaded = null, freeMemGb = 0 }) {
  const has = (id) => available.length === 0 || available.includes(id);

  if (requested) {
    // 注意：routes.mjs 的 decideModel 对显式指定的模型是「直接返回、不调本函数」的，
    // 所以下面这段预检属于防御性代码（有人直接调 pickModel 时才生效）。
    // 真实行为以 routes.mjs 为准：显式指定不做内存预检，失败由上游 OOM 兜底翻译。
    const spec = MODELS[requested];
    if (!has(requested)) {
      return {
        ok: false,
        code: 'MODEL_NOT_INSTALLED',
        message: `本机没有安装 ${requested}。可用模型：${available.join('、') || '（读不到 Ollama 模型列表）'}`
      };
    }
    if (freeMemGb > 0 && freeMemGb < spec.minFreeMemGb) {
      return {
        ok: false,
        code: 'MODEL_UNAVAILABLE',
        message: `可用内存 ${freeMemGb.toFixed(1)} GB，跑 ${requested} 至少需要 ${spec.minFreeMemGb} GB。` +
          ` 改用 qwen3.5:9b（model: "qwen"）或先关掉占内存的程序。`,
        retryable: true
      };
    }
    return { ok: true, model: requested, reason: 'explicit' };
  }

  // auto：显卡里已经加载的先接着用，省一次 54 秒冷加载
  if (loaded && MODELS[loaded] && has(loaded)) {
    return { ok: true, model: loaded, reason: 'already_loaded' };
  }
  const order = ['gpt-oss:20b', 'qwen3.5:9b'];
  for (const id of order) {
    if (!has(id)) continue;
    if (freeMemGb > 0 && freeMemGb < MODELS[id].minFreeMemGb) continue;
    return { ok: true, model: id, reason: 'auto_by_memory' };
  }
  const fallback = order.find(has);
  if (!fallback) {
    return {
      ok: false,
      code: 'MODEL_NOT_INSTALLED',
      message: '本机一个可用的对话模型都没有，请先 ollama pull gpt-oss:20b 或 qwen3.5:9b。'
    };
  }
  return {
    ok: false,
    code: 'MODEL_UNAVAILABLE',
    message: `可用内存只剩 ${freeMemGb.toFixed(1)} GB，连 ${fallback} 都跑不动，请先释放内存。`,
    retryable: true
  };
}

// ============================================================ 任务分流
// 目标：小活自动走 qwen3.5:9b（约 6 GB、25 s 冷加载、~42 tok/s），
//       精活走 gpt-oss:20b（约 14 GB、47 s 冷加载、推理与结构化更强）。
// 🔴 硬约束：两者不能同时驻留（2026-10-17 实测 Ollama 会直接驱逐另一个，双向验证过），
//    所以分流规则必须「按任务性质稳定」，否则每个请求来回跳、每次付 25–47 s 冷加载。
//    默认不做「留在已加载模型」的优化——省内存比省加载时间重要；需要时传 keep_current。

export const EFFORTS = ['auto', 'lite', 'deep'];

/** 判定为精活所需的最低分。低于它一律走 lite。 */
// 🔴 阈值 35 → 60：35 分太低，"为什么毛利率下降了"（37 分）就会被判重活切到 gpt-oss，
//    而 gpt-oss 冷加载 47s、常驻 14GB，还会把已加载的 qwen 挤出显存，下轮再切回来又 25s。
//    用户感知就是"问个业务问题要等一分钟"。提到 60 后：纯推理+领域词(45 分)仍走 qwen，
//    只有「结构化输出+推理」这类真正重的任务(80 分)才上 gpt-oss。
export const DEEP_THRESHOLD = 60;

// 命中即加分的语义特征；权重经过场景校准，改之前先对照下面的典型用例。
const DEEP_SIGNALS = [
  { re: /归因|溯源|为什么|原因|诊断|复核|核验|推演|对比分析|利弊|评估|策略|方案|拆解|论证/, weight: 35, tag: 'reasoning' },
  { re: /JSON|json|结构化|字段|schema|数组|枚举|表格/, weight: 35, tag: 'structured' },
  { re: /合同|条款|报表|分录|凭证|毛利|利润|成本|税务|摊销|应收账款|库存/, weight: 10, tag: 'domain' }
];

/**
 * 给一次请求的「活有多重」打分。
 * 典型校准（阈值 35）：
 *   「你好」                          →  -8  → lite
 *   「本月毛利率多少」                 →   2  → lite
 *   「为什么毛利率下降了」             →  37  → deep
 *   「把这段 3000 字总结成五点」       →  15  → lite（摘要是轻活）
 *   「按字段输出 JSON」                →  39  → deep
 * @returns {{score:number, signals:{tag:string,weight:number,note:string}[]}}
 */
export function scoreTask({ messages = [], question = '', analysis = null, schema = null, maxTokens = null } = {}) {
  const signals = [];
  let score = 0;
  const add = (tag, weight, note) => {
    score += weight;
    signals.push({ tag, weight, note });
  };

  const text = [question, analysis, ...messages.map((m) => (m && m.content) || '')]
    .filter(Boolean)
    .join('\n');
  const chars = text.length;

  if (chars >= 4000) add('long_input', 30, `输入 ${chars} 字`);
  else if (chars >= 1500) add('medium_input', 15, `输入 ${chars} 字`);

  if (schema) add('schema', 35, '要求结构化输出');
  if (analysis && String(analysis).length > 200) add('analysis_material', 18, `带 ${String(analysis).length} 字分析材料`);
  if (maxTokens && maxTokens >= 1500) add('long_output', 12, `max_tokens=${maxTokens}`);
  if (messages.length >= 6) add('long_history', 10, `${messages.length} 条历史`);

  for (const s of DEEP_SIGNALS) {
    if (s.re.test(text)) add(s.tag, s.weight, '命中关键词');
  }

  // 短输入本身不代表简单（「为什么毛利率掉了」只有 9 个字却是精活），
  // 所以只有在没有任何语义信号时才因为「短」而下调。带 schema 也属于明确的重活意图。
  const semantic = schema != null || signals.some((x) => ['reasoning', 'structured', 'domain'].includes(x.tag));
  if (!semantic && chars > 0 && chars < 200) add('short_input', -8, `输入仅 ${chars} 字且无深任务特征`);

  return { score: Math.max(-40, Math.min(100, score)), signals };
}

/**
 * 决定这一次请求跑哪个模型。
 * @param {object} o
 * @param {'auto'|'lite'|'deep'} [o.effort] auto=按任务打分；lite=强制轻；deep=强制重
 * @param {boolean} [o.keepCurrent] 目标虽然是 lite、但重模型已在内存时，是否就别切了（仅单向兼容）
 * @returns {{ok:true, model:string, effort:string, score:number|null, signals:object[], reason:string, degraded:boolean, stayed:boolean}
 *          | {ok:false, code:string, message:string}}
 */
export function routeModel({
  messages = [],
  question = '',
  analysis = null,
  schema = null,
  maxTokens = null,
  effort = 'auto',
  available = [],
  loaded = null,
  freeMemGb = 0,
  keepCurrent = false
} = {}) {
  const has = (id) => available.length === 0 || available.includes(id);
  // 已加载在显存里的模型不再需要冷加载，豁免内存门槛（freeMemGb 偏低是因为模型本身占了内存）。
  // 只有「要从冷加载拉起」时才要求空闲内存 >= minFreeMemGb。
  const fits = (id) => freeMemGb <= 0 || freeMemGb >= MODELS[id].minFreeMemGb || loaded === id;

  const LARGE = 'gpt-oss:20b';
  const SMALL = 'qwen3.5:9b';

  if (!EFFORTS.includes(effort)) {
    return { ok: false, code: 'AI_BAD_REQUEST', message: `effort 只支持 ${EFFORTS.join(' / ')}，收到「${effort}」。` };
  }

  let preferred;
  let reason;
  let score = null;
  let signals = [];

  if (effort === 'lite') {
    preferred = SMALL;
    reason = 'effort_lite';
    score = null;
  } else if (effort === 'deep') {
    preferred = LARGE;
    reason = 'effort_deep';
    score = null;
  } else {
    const scored = scoreTask({ messages, question, analysis, schema, maxTokens });
    score = scored.score;
    signals = scored.signals;
    preferred = score >= DEEP_THRESHOLD ? LARGE : SMALL;
    reason = score >= DEEP_THRESHOLD ? 'auto_deep' : 'auto_lite';
  }

  // 单向黏着：目标是轻模型、但重模型已经在内存里，为了不付 26 s 冷加载就留着。
  // 反过来（目标重、当前轻）绝不黏着——质量优先。
  let stayed = false;
  if (keepCurrent && preferred === SMALL && loaded === LARGE && has(LARGE) && fits(LARGE)) {
    stayed = true;
    reason = 'stayed_on_loaded';
    preferred = LARGE;
  }

  let degraded = false;
  let chosen = preferred;
  if (!has(chosen) || !fits(chosen)) {
    const other = chosen === LARGE ? SMALL : LARGE;
    if (has(other) && fits(other)) {
      chosen = other;
      degraded = true;
    } else if (!has(chosen)) {
      return { ok: false, code: 'MODEL_NOT_INSTALLED', message: `本机没有安装 ${chosen}，${other} 也跑不动，请先 ollama pull。` };
    } else {
      return {
        ok: false,
        code: 'MODEL_UNAVAILABLE',
        message: `可用内存 ${freeMemGb.toFixed(1)} GB，跑 ${chosen} 至少需要 ${MODELS[chosen].minFreeMemGb} GB，${other} 也不满足。请先释放内存。`,
        retryable: true
      };
    }
  }

  return { ok: true, model: chosen, effort, score, signals, reason, degraded, stayed };
}
