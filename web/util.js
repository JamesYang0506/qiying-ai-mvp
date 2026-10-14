'use strict';
// 全站共享工具，最先加载。其余脚本不再各自实现金额格式化与请求封装。

const $ = (id) => document.getElementById(id);

// 领域词汇：状态码与成本类别的中文标签
const names = {
  material: '直接材料',
  labor: '直接人工',
  manufacturing: '制造费用',
  production_other: '其他生产成本',
  management: '管理费用',
  sales: '销售费用',
  finance: '财务费用',
  order_other: '其他订单费用',
};
const states = {
  complete: '可计算',
  estimated: '估算',
  blocked: '无法计算',
  disabled: '未启用',
};
const recordStates = {
  confirmed: '已确认',
  estimated: '暂估',
  missing: '待补',
  not_applicable: '不适用',
};

const esc = (x) =>
  String(x ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );

// 金额（元，两位小数）。引擎已按 0.01 量化，此处只补位并加千分位。
function money(value) {
  if (value === null || value === undefined) return '—';
  let [i, f = '00'] = String(value).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + f.padEnd(2, '0');
}
// 比率：0.1234 -> 12.34%。空值文案随页面语义传入。
const percent = (value, empty = '—') =>
  value === null || value === undefined
    ? empty
    : (Number(value) * 100).toFixed(2) + '%';
// 万元：首页与历史记录按万元展示，空值文案同样由调用方决定。
const wan = (value, empty = '待补') =>
  value === null || value === undefined
    ? empty
    : (Number(value) / 10000).toFixed(2);
const sign = (value) => (value !== null && Number(value) < 0 ? 'negative' : '');
const badge = (s) =>
  `<span class="badge ${esc(s)}">${esc(states[s] || s)}</span>`;

// 金额合计：按“分”用 BigInt 累加，避免浮点误差。
// 兼容整数与一两位小数；超过两位的小数按截断处理（引擎输出恒为两位）。
const toCents = (value) => {
  const text = String(value);
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const cents =
    BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2));
  return negative ? -cents : cents;
};
function sum(rows, key) {
  const cents = rows.reduce((acc, row) => acc + toCents(row[key]), 0n);
  const abs = cents < 0n ? -cents : cents;
  return (
    (cents < 0n ? '-' : '') +
    abs / 100n +
    '.' +
    String(abs % 100n).padStart(2, '0')
  );
}

// 请求体上限：JSON 走网关 10MB，Excel 直接解析，服务端放宽到 15MB（见 server.py）。
const UPLOAD_LIMIT = 10 * 1024 * 1024;
const XLSX_LIMIT = 15 * 1024 * 1024;

// 返回原始 Response，供 ZIP 下载复用；非 2xx 时抛出服务端错误文案。
async function request(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    let text = '请求失败';
    try {
      text = (await response.json()).error || text;
    } catch {}
    throw new Error(text);
  }
  return response;
}

// 图表配色：集中一处，避免同一色值散落在各渲染函数里各写一遍。
const PALETTE = {
  // 条形图（订单利润对比）
  axis: '#d8e0d2',
  axisText: '#99a68e',
  label: '#7a8a70',
  valueText: '#8e9c80',
  missing: '#b5bdaa',
  production: '#23583f',
  management: '#a2c6a3',
  negative: '#c27f6c',
  negativeText: '#b5806b',
  // 饼图（成本与利润构成）
  revenue: '#476c9b',
  expense: '#bd8c49',
  profit: '#286b50',
  other: '#9d7aa3',
  pieTrack: '#edf1ec',
  // 趋势图（对照历史）
  trend: '#28644b',
  trendAxis: '#ccd9cf',
  // 成本构成条形，由深到浅
  costShades: [
    '#376b4a',
    '#648864',
    '#8ea77a',
    '#b1c19c',
    '#94a98c',
    '#b4c1a6',
    '#cbd4bc',
    '#dae1d0',
  ],
};
