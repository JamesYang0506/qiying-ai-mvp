'use strict';
let comparisonContext = '',
  comparisonOrder = '',
  comparisonSequence = 0,
  comparisonWorkspace = null,
  comparisonBusy = false;
const comparisonLabels = {
  normal: '未触发预警',
  warning: '黄色提醒',
  danger: '严重预警',
  pending: '待补依据 / 待观察',
};
const comparisonNumber = (v, suffix = '') =>
  v === null || v === undefined || v === ''
    ? '—'
    : `${esc(Number(v).toLocaleString('zh-CN', { minimumFractionDigits: suffix.includes('%') || suffix.includes('百分点') ? 2 : 0, maximumFractionDigits: 2 }))}${suffix}`;
const comparisonTime = (v) =>
  v ? esc(new Date(v).toLocaleString('zh-CN', { hour12: false })) : '未记录';
const comparisonDisplayMessage = (value) =>
  esc(
    String(value || '').replace(/-?\d+\.\d{3,}/g, (number) =>
      Number(number).toFixed(2),
    ),
  );
const comparisonDelta = (value) =>
  value === null || value === undefined || value === ''
    ? '待比较'
    : `${Number(value) < 0 ? '提高' : Number(value) > 0 ? '下降' : '持平'} ${comparisonNumber(Math.abs(Number(value)), ' 个百分点')}`;
const comparisonShortTime = (value) =>
  value
    ? esc(
        new Date(value).toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      )
    : '未记录';
const comparisonMessageDetails = (message) =>
  message
    ? `<details class="comparison-evidence"><summary>查看原始检测依据</summary><p>${esc(message)}</p></details>`
    : '';
function comparisonMarkers(c) {
  return `<span class="comparison-state">${c?.is_demo || result?.snapshot?.is_demo ? '模拟数据' : '导入数据'}</span><span class="comparison-state comparison-pending">暂定规则</span>${c?.metrics?.margin?.basis === 'trial' ? '<span class="comparison-state comparison-warning">源表参考试算 · 尚待核实</span>' : ''}${historyViewing ? '<span class="comparison-state">历史只读</span>' : ''}`;
}
function comparisonKey() {
  return `${result?.snapshot?.snapshot_id || ''}:${comparisonOrder}:${historyViewing}`;
}
function comparisonOrders() {
  return [
    ...new Map((result?.orders || []).map((o) => [o.order_id, o])).values(),
  ];
}
function comparisonStatus(s) {
  return `<span class="comparison-state comparison-${esc(s || 'pending')}">${esc(comparisonLabels[s] || comparisonLabels.pending)}</span>`;
}
function comparisonWarning() {
  if (!result?.comparison_warning) return '';
  const warning = result.comparison_warning;
  return `<p class="comparison-state comparison-warning" role="status">订单数据已保存；辅助自动检测未完成：${esc(typeof warning === 'string' ? warning : JSON.stringify(warning))}。请核对后重新检查。</p>`;
}
function renderComparisonSummary() {
  let box = $('comparison-summary');
  if (!box) {
    box = document.createElement('section');
    box.id = 'comparison-summary';
    box.className = 'panel comparison-summary';
    const executive = $('decision-view').querySelector(
      '.executive-metrics, #executive-metrics',
    );
    if (executive) executive.after(box);
    else $('decision-view').prepend(box);
  }
  const c = comparisonWorkspace?.comparison;
  box.innerHTML = `<div><h2>选定订单理论对照 ${comparisonStatus(c?.severity)}</h2><p><b>${esc(comparisonOrder || '尚无订单')}</b> · ${c ? comparisonDelta(c.metrics?.margin?.delta_pp) : '尚无保存检测'} · 累计不良率 ${comparisonNumber(c?.metrics?.quality?.value_pct, '%')}</p><div class="comparison-markers">${comparisonMarkers(c)}</div>${c?.pending?.length ? `<p class="help">待补 / 待观察：${esc(c.pending.join('；'))}</p>` : ''}${comparisonWarning()}</div><button class="secondary" data-open-comparison>查看订单对照 →</button>`;
}
async function refreshComparison(force = false) {
  const orders = comparisonOrders();
  if (!orders.some((o) => o.order_id === comparisonOrder))
    comparisonOrder = orders[0]?.order_id || '';
  const key = comparisonKey();
  if (!force && key === comparisonContext) {
    renderComparisonSummary();
    return;
  }
  comparisonContext = key;
  comparisonWorkspace = null;
  comparisonBusy = false;
  const seq = ++comparisonSequence;
  renderComparison();
  renderComparisonSummary();
  if (!comparisonOrder) return;
  $('comparison-message').textContent = '正在读取已保存的对照…';
  try {
    const data = await (
      await request(
        `/api/comparison?snapshot_id=${encodeURIComponent(result.snapshot.snapshot_id)}&order_id=${encodeURIComponent(comparisonOrder)}`,
      )
    ).json();
    if (seq !== comparisonSequence || key !== comparisonKey()) return;
    comparisonWorkspace = data;
    renderComparison();
    renderComparisonSummary();
  } catch (e) {
    if (seq === comparisonSequence && key === comparisonKey())
      $('comparison-message').textContent = e.message;
  }
}
const comparisonField = (
  name,
  label,
  value = '',
  type = 'text',
  required = false,
) =>
  `<label>${label}<input name="${name}" type="${type}" value="${esc(value ?? '')}" ${type === 'number' ? 'step="any"' : ''} ${required ? 'required' : ''}></label>`;
function comparisonTrend(trend) {
  return ['margin', 'quality']
    .map((metric) => {
      const pts = trend.filter((c) => c.metrics?.[metric]?.value_pct != null);
      const label = metric === 'margin' ? '生产毛利率' : '累计不良率';
      if (pts.length < 2)
        return `<article><h3>${label}</h3><p class="help">${pts.length ? '仅有 1 次观测，暂不形成趋势。' : '尚无有效观测。'}</p></article>`;
      const values = pts.map((c) => Number(c.metrics[metric].value_pct));
      const lo = Math.min(...values),
        hi = Math.max(...values),
        span = hi - lo || 1;
      const coords = values.map((v, i) => [
        35 + (i * 410) / (values.length - 1),
        110 - ((v - lo) * 80) / span,
      ]);
      return `<article><h3>${label} · 已存检测</h3><svg viewBox="0 0 480 145" role="img" aria-label="${label}趋势；完整数据见下表"><line x1="35" y1="115" x2="445" y2="115" stroke="${PALETTE.trendAxis}"/><polyline points="${coords.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${PALETTE.trend}" stroke-width="2"/>${coords.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${PALETTE.trend}"><title>${comparisonTime(pts[i].created_at)}：${comparisonNumber(values[i], '%')}</title></circle>`).join('')}<text x="35" y="135">${comparisonNumber(values[0], '%')}</text><text x="445" y="135" text-anchor="end">${comparisonNumber(values.at(-1), '%')}</text></svg><details><summary>查看 ${pts.length} 次观测数据</summary>${pts.map((c) => `<p>${comparisonTime(c.created_at)} · ${comparisonNumber(c.metrics[metric].value_pct, '%')} · ${esc(c.snapshot_id)} · ${esc(c.rules?.version || '')}</p>`).join('')}</details></article>`;
    })
    .join('');
}
function renderComparison() {
  const orders = comparisonOrders(),
    w = comparisonWorkspace,
    c = w?.comparison,
    b = c?.baseline,
    r = c?.rules || (historyViewing ? {} : w?.rules) || {},
    editableRules = (historyViewing ? c?.rules : w?.rules) || {},
    readonly = historyViewing || !comparisonOrder || !w;
  const disabled = readonly || comparisonBusy ? 'disabled' : '';
  $('comparison-view').innerHTML =
    `<div class="panel comparison-controls"><label>对照订单<select id="comparison-order">${orders.length ? orders.map((o) => `<option value="${esc(o.order_id)}" ${o.order_id === comparisonOrder ? 'selected' : ''}>${esc(o.order_id)} · ${esc(o.product || '')}</option>`).join('') : '<option value="">请先导入实际订单数据</option>'}</select></label><div class="comparison-actions"><button class="secondary" id="comparison-check" ${disabled}>重新检查</button><button class="primary" id="comparison-open-theory" data-comparison-dialog="comparison-theory-dialog" ${disabled}>创建 / 绑定理论</button><button class="secondary" id="comparison-open-rules" data-comparison-dialog="comparison-rules-dialog" ${disabled}>编辑暂定规则</button></div><div class="comparison-context"><div class="comparison-markers">${comparisonMarkers(c)}</div><span>数据截至 ${esc(c?.cutoff_date || result?.snapshot?.cutoff_date || '未记录')} · 检测 ${comparisonShortTime(c?.created_at)}</span></div></div><p id="comparison-message" class="help" role="status" aria-live="polite"></p>${comparisonWarning()}
  <section id="comparison-metrics" class="panel comparison-results"><div class="panel-head"><h2>生产毛利与质量 ${comparisonStatus(c?.severity)}</h2></div>${!c ? '<p class="help">尚无保存检测，不能据此认定正常。请导入订单并建立理论目标。</p>' : ''}<div class="comparison-kpis">${[
    [
      '理论毛利率',
      comparisonNumber(c?.metrics?.margin?.target_pct, '%'),
      b ? `理论 v${esc(b.version)}` : '尚未绑定理论',
    ],
    [
      '当前毛利率',
      comparisonNumber(c?.metrics?.margin?.value_pct, '%'),
      comparisonStatus(c?.metrics?.margin?.status),
    ],
    [
      '较理论差异',
      c?.metrics?.margin?.delta_pp == null
        ? '—'
        : `${Math.abs(Number(c.metrics.margin.delta_pp)).toFixed(2)}<small>个百分点</small>`,
      c?.metrics?.margin?.delta_pp == null
        ? '待确认可比范围'
        : Number(c.metrics.margin.delta_pp) < 0
          ? '较理论提高'
          : Number(c.metrics.margin.delta_pp) > 0
            ? '较理论下降'
            : '与理论持平',
    ],
    [
      '累计不良率',
      comparisonNumber(c?.metrics?.quality?.value_pct, '%'),
      comparisonStatus(c?.metrics?.quality?.status),
    ],
  ]
    .map(
      ([label, value, note]) =>
        `<article class="comparison-kpi"><span>${label}</span><strong>${value}</strong><div>${note}</div></article>`,
    )
    .join('')}</div>
  ${c?.pending?.length ? `<div class="comparison-pending"><h3>待补依据 / 待观察</h3><ul>${c.pending.map((p) => `<li>${comparisonDisplayMessage(p)}</li>`).join('')}</ul></div>` : ''}</section>
  <section id="comparison-alerts" class="panel"><h2>预警事件与处理记录</h2><p class="help">检测状态与人工处理分开。已确认 / 已关闭不会消除仍存在的异常。</p>${
    ((historyViewing ? c?.events : w?.events) || [])
      .map(
        (e) =>
          `<article class="comparison-event"><h3>${e.metric === 'margin' ? '毛利偏低' : '质量偏高'} ${comparisonStatus(e.severity)}</h3><p>${comparisonDisplayMessage(e.message)} · ${e.detection_status === 'recovered' ? '已恢复' : '仍在触发'}</p><p class="help">首次 ${comparisonTime(e.first_seen)} · 最近 ${comparisonTime(e.last_seen)}${e.recovered_at ? ' · 恢复 ' + comparisonTime(e.recovered_at) : ''}</p><p class="help">人工处理：${esc({ pending: '待处理', acknowledged: '已确认', in_progress: '处理中', closed: '已关闭' }[e.processing_status] || '待处理')}</p>${comparisonMessageDetails(e.message)}<details class="comparison-event-edit"><summary>更新处理状态 / 备注</summary><form data-comparison-event="${esc(e.id)}"><fieldset ${disabled}><label>人工处理状态<select name="processing_status">${[
            ['pending', '待处理'],
            ['acknowledged', '已确认'],
            ['in_progress', '处理中'],
            ['closed', '已关闭'],
          ]
            .map(
              ([v, l]) =>
                `<option value="${v}" ${e.processing_status === v ? 'selected' : ''}>${l}</option>`,
            )
            .join(
              '',
            )}</select></label><label>核查及处理备注<textarea name="note" rows="2" maxlength="2000">${esc(e.note)}</textarea></label><button class="secondary" type="submit">保存处理记录</button></fieldset></form></details>${comparisonHandling(e, w?.handling || [], c)}</article>`,
      )
      .join('') || '<p>没有保存的预警事件；未检测或依据不足不代表正常。</p>'
  }</section>
  <section class="panel"><h2>指标明细</h2><div class="comparison-grid">${[
    'margin',
    'quality',
  ]
    .map((k) => {
      const m = c?.metrics?.[k];
      return `<article class="comparison-metric"><h3>${k === 'margin' ? '生产毛利率' : '累计不良率'} ${comparisonStatus(m?.status)}</h3><dl><div><dt>理论目标</dt><dd>${m?.target_pct != null ? comparisonNumber(m.target_pct, '%') : k === 'quality' ? '暂定上限见规则' : '—'}</dd></div><div><dt>当前观测</dt><dd>${comparisonNumber(m?.value_pct, '%')}</dd></div><div><dt>差异</dt><dd>${k === 'margin' ? comparisonDelta(m?.delta_pp) : m?.delta_pp == null ? '—' : `${Number(m.delta_pp) < 0 ? '减少' : '增加'} ${comparisonNumber(Math.abs(Number(m.delta_pp)), ' 个百分点')}`}</dd></div><div><dt>提醒 / 严重</dt><dd>${k === 'margin' ? `下降 ≥ ${comparisonNumber(r.margin_warning_pp, ' 个百分点')} / ≥ ${comparisonNumber(r.margin_danger_pp, ' 个百分点')}` : `≥ ${comparisonNumber(r.defect_warning_pct, '%')} / ≥ ${comparisonNumber(r.defect_danger_pct, '%')}`}</dd></div>${k === 'quality' ? `<div><dt>累计生产 / 不良</dt><dd>${comparisonNumber(m?.produced)} / ${comparisonNumber(m?.defects)}</dd></div><div><dt>最低观察量</dt><dd>${comparisonNumber(r.min_production)}</dd></div>` : ''}</dl><p class="help">${comparisonDisplayMessage(m?.message || '尚无保存检测')}</p>${comparisonMessageDetails(m?.message)}</article>`;
    })
    .join('')}</div></section>
  <details id="comparison-evidence" class="panel comparison-evidence"><summary>理论基线与完整检测依据 ${b ? `· 理论 v${esc(b.version)}` : '· 尚未绑定'}</summary><p>${historyViewing ? '历史只读：展示保存时的理论、规则和检测，不重新计算。' : '理论基线独立保存，实际数据更新后检测，尚未接入现场自动监测。'}</p><p>检测 ID：${esc(c?.id || '未检测')}<br>基线 ID：${esc(b?.id || '未绑定')} · 理论 v${esc(b?.version || '—')}<br>规则：${esc(r.version || '—')}<br>检测时间：${comparisonTime(c?.created_at)}</p>${c?.pending?.length ? `<p>原始待补依据：${esc(c.pending.join('；'))}</p>` : ''}<p>${b ? `业务订单 ${esc(b.business_order_id)} · 批次 ${esc(b.batch_id || '无')} · ${b.method === 'costs' ? '独立成本计算' : '比例目标'} · 税口径 ${esc({ unknown: '未知', included: '含税', excluded: '不含税' }[b.tax_basis] || '未知')} · ${c.scope_confirmed ? '范围已人工确认' : '范围未确认'}` : 'SRC 编号仅代表款号来源，请填写真实业务订单与批次。'}</p><p>${esc(b?.source_note || '来源未填写')}</p>${c ? `<details class="comparison-evidence"><summary>本次检测的完整版本信息</summary><p>检测编号 ${esc(c.id)}<br>实际快照 ${esc(c.snapshot_id)}<br>理论基线 ${esc(b?.id || '未绑定')}<br>规则版本 ${esc(r.version || '未记录')}<br>检测时间 ${comparisonTime(c.created_at)}</p></details>` : ''}${
    b
      ? `<div class="comparison-costs">${[
          ['quantity', '理论数量'],
          ['unit_price', '单价'],
          ['discount_per_pair', '每双折扣'],
          ['revenue', '理论收入'],
          ['material_cost', '材料'],
          ['labor_cost', '直接人工'],
          ['manufacturing_cost', '加工 / 制造'],
          ['other_production_cost', '其他生产成本'],
          ['production_cost', '生产成本合计'],
          ['production_profit', '生产毛利'],
        ]
          .map(
            ([k, l]) =>
              `<div><span>${l}</span><strong>${comparisonNumber(b[k])}${k === 'quantity' ? ' ' + esc(b.unit || '') : ' 元'}</strong></div>`,
          )
          .join('')}</div>`
      : ''
  }<p class="help">20% 降至 14% 为下降 6 个百分点。生产毛利为同范围收入减材料、直接人工、制造及其他生产成本，不含管理、销售和财务费用。日报不良 / 生产不等同最终报废率。</p></details>
  ${w?.records?.length > 1 ? `<section class="panel"><label>保存的检测版本<select id="comparison-record">${w.records.map((x, i) => `<option value="${esc(x.id)}" ${x.id === c?.id ? 'selected' : ''}>检测 ${i + 1} · ${comparisonShortTime(x.created_at)} · 理论 v${esc(x.baseline?.version || '—')}</option>`).join('')}</select></label><details class="comparison-evidence"><summary>完整版本编号</summary>${w.records.map((x) => `<p>${comparisonTime(x.created_at)} · 检测 ${esc(x.id)} · 基线 ${esc(x.baseline?.id || '未绑定')} · 规则 ${esc(x.rules?.version || '—')}</p>`).join('')}</details></section>` : ''}
  <section class="panel comparison-trends"><h2>观测趋势</h2><div class="comparison-grid">${comparisonTrend(w?.trend || [])}</div><p class="help">同一快照重检保留时间与规则版本，不代表新增生产进度。</p></section>
  <dialog id="comparison-theory-dialog" class="comparison-dialog" aria-labelledby="comparison-theory-title"><div class="comparison-dialog-head"><h2 id="comparison-theory-title">创建 / 修订理论基线</h2><button type="button" class="secondary" data-comparison-close>关闭</button></div><p class="comparison-dialog-message help" role="status" aria-live="polite"></p><fieldset ${disabled}><div class="comparison-import"><a href="/api/theory/template.xlsx" download>下载理论 Excel 模板 ↙</a><label>导入标准模板（仅预览，最大 10MB）<input id="comparison-import" type="file" accept=".xlsx"></label></div><p class="help">首版仅支持标准字段，不支持公式。预览后仍可修改，点击保存才创建新版本。</p><div id="comparison-preview" role="status"></div><form id="comparison-theory"><div class="comparison-grid"><label>基线方式<select name="method"><option value="ratio">比例目标</option><option value="costs">填写收入与成本，独立计算</option></select></label>${comparisonField('business_order_id', '真实业务订单号', comparisonOrder.startsWith('SRC-') ? '' : comparisonOrder, 'text', true)}${comparisonField('batch_id', '批次（选填）')}<label>税口径<select name="tax_basis"><option value="unknown">未知（同口径确认后仅参考比较）</option><option value="included">含税</option><option value="excluded">不含税</option></select></label><label class="comparison-ratio">理论生产毛利率（%）<input name="target_margin_pct" type="number" step="any" required></label>${comparisonField('target_defect_pct', '理论不良率（%，选填）', '', 'number')}${comparisonField('quantity', '理论数量（比例目标可选）', '', 'number')}${comparisonField('unit', '数量单位', orders.find((o) => o.order_id === comparisonOrder)?.unit || '双', 'text', true)}</div><div id="comparison-cost-fields" class="comparison-grid" hidden>${[
    ['unit_price', '单价（元）'],
    ['discount_per_pair', '每双折扣（元）'],
    ['material_cost', '整单材料成本（元）'],
    ['labor_cost', '整单人工成本（元）'],
    ['manufacturing_cost', '整单加工 / 制造成本（元）'],
    ['other_production_cost', '整单其他生产成本（元）'],
  ]
    .map(([k, l]) => comparisonField(k, l, '', 'number'))
    .join(
      '',
    )}</div><label>来源及成本范围说明<textarea name="source_note" rows="2" maxlength="1000"></textarea></label><label class="comparison-confirm"><input name="scope_confirmed" type="checkbox">我已核对：仅当前实际快照与该理论基线属于同一业务订单 / 批次、同一数量与期间范围、相同收入成本及税口径，成本没有重复归集。</label><p class="help">未勾选仍可保存目标；毛利保持待比较。未知成本请保留空白，明确为零时才填写 0。成本方式由网站独立计算，无需填写目标毛利率。</p><button class="primary" type="submit">保存新理论版本并检查</button></form>
  <form id="comparison-bind"><h3>绑定已有理论版本</h3><label>理论版本<select name="baseline_id" required><option value="">请选择</option>${(w?.baselines || []).map((x) => `<option value="${esc(x.id)}">${esc(x.business_order_id)} / ${esc(x.batch_id || '无批次')} · v${esc(x.version)} · ${x.is_demo ? '模拟' : '导入'}</option>`).join('')}</select></label><label class="comparison-confirm"><input name="scope_confirmed" type="checkbox">我已核对当前快照的同业务、同数量期间及收入成本范围、相同税口径</label><button class="secondary" type="submit">绑定所选版本并检查</button></form></fieldset>${historyViewing ? '<p class="help">历史回看不可创建或绑定基线。</p>' : ''}</dialog>
  <dialog id="comparison-rules-dialog" class="comparison-dialog" aria-labelledby="comparison-rules-title"><div class="comparison-dialog-head"><h2 id="comparison-rules-title">全局暂定阈值 · 规则 ${esc(editableRules.version || '—')}</h2><button type="button" class="secondary" data-comparison-close>关闭</button></div><p class="comparison-dialog-message help" role="status" aria-live="polite"></p><p>毛利下降达到提醒 / 严重阈值触发（pp）；不良率达到阈值触发（%），红色优先。产量低于观察量时待观察。临时规则用于提示核查，不直接作停产或损失认定。</p><p class="help">规则修改时间 ${comparisonTime(editableRules.created_at)}；${historyViewing ? '当前显示保存检测的旧规则。' : '全局设置适用于后续订单检测；可点击重新检查当前订单，历史检测保留原规则。'}</p><form id="comparison-rules"><fieldset ${disabled}><div class="comparison-grid">${[
    ['margin_warning_pp', '毛利提醒（pp）'],
    ['margin_danger_pp', '毛利严重（pp）'],
    ['defect_warning_pct', '不良率提醒（%）'],
    ['defect_danger_pct', '不良率严重（%）'],
    ['min_production', '质量最低观察数量'],
  ]
    .map(([k, l]) => comparisonField(k, l, editableRules[k], 'number', true))
    .join(
      '',
    )}</div><button class="secondary" type="submit">保存新暂定规则</button></fieldset></form></dialog>
`;
  $('comparison-view')
    .querySelectorAll('dialog')
    .forEach((dialog) => {
      dialog.addEventListener('close', () =>
        $(dialog.dataset.returnFocus)?.focus(),
      );
    });
  updateComparisonMethod();
}
function comparisonHandling(event, entries, comparison) {
  const history = entries.filter(
    (row) =>
      row.event_id === event.id &&
      (!historyViewing || row.created_at <= comparison?.created_at),
  );
  if (!history.length) return '';
  const labels = {
    pending: '待处理',
    acknowledged: '已确认',
    in_progress: '处理中',
    closed: '已关闭',
  };
  return `<details><summary>查看 ${history.length} 条处理记录</summary>${history.map((row) => `<p>${comparisonTime(row.created_at)} · ${esc(labels[row.processing_status] || row.processing_status)} · ${esc(row.note || '无备注')}</p>`).join('')}</details>`;
}
function updateComparisonMethod() {
  const f = $('comparison-theory');
  if (!f) return;
  const costs = f.elements.method.value === 'costs';
  $('comparison-cost-fields').hidden = !costs;
  f.querySelector('.comparison-ratio').hidden = costs;
  f.elements.target_margin_pct.required = !costs;
  f.elements.target_margin_pct.disabled = costs;
  f.elements.quantity.required = costs;
  for (const input of $('comparison-cost-fields').querySelectorAll('input')) {
    input.disabled = !costs;
    input.required = costs;
  }
}
async function comparisonWrite(path, payload) {
  if (
    historyViewing ||
    comparisonBusy ||
    !comparisonWorkspace ||
    !comparisonOrder
  )
    return;
  const key = comparisonKey(),
    seq = ++comparisonSequence;
  const activeDialog = $('comparison-view').querySelector('dialog[open]');
  const returnFocus = activeDialog?.dataset.returnFocus;
  comparisonBusy = true;
  $('comparison-view')
    .querySelectorAll('button:not([data-comparison-close]), fieldset')
    .forEach((el) => (el.disabled = true));
  $('comparison-message').textContent = '正在保存…';
  if (activeDialog)
    activeDialog.querySelector('.comparison-dialog-message').textContent =
      '正在保存…';
  try {
    const data = await (
      await request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot_id: result.snapshot.snapshot_id,
          order_id: comparisonOrder,
          ...payload,
        }),
      })
    ).json();
    if (seq !== comparisonSequence || key !== comparisonKey()) return;
    comparisonBusy = false;
    if (path.endsWith('/rules')) {
      comparisonWorkspace.rules = data.rules;
      renderComparison();
      $('comparison-message').textContent =
        '新规则已保存；当前已存检测仍使用旧规则，点击重新检查后应用。';
    } else {
      comparisonWorkspace = data;
      renderComparison();
      $('comparison-message').textContent = '已保存。';
    }
    renderComparisonSummary();
    if (returnFocus) $(returnFocus)?.focus();
  } catch (e) {
    if (seq === comparisonSequence && key === comparisonKey()) {
      comparisonBusy = false;
      $('comparison-view')
        .querySelectorAll('button:not([data-comparison-close]), fieldset')
        .forEach((el) => (el.disabled = false));
      $('comparison-message').textContent = e.message;
      if (activeDialog?.isConnected)
        activeDialog.querySelector('.comparison-dialog-message').textContent =
          e.message;
    }
  }
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-open-comparison]')) switchView('comparison');
  const opener = e.target.closest('[data-comparison-dialog]');
  if (opener && !opener.disabled) {
    const dialog = $(opener.dataset.comparisonDialog);
    dialog.dataset.returnFocus = opener.id;
    dialog.showModal();
  }
  if (e.target.closest('[data-comparison-close]'))
    e.target.closest('dialog').close();
  if (e.target.closest('#comparison-check'))
    comparisonWrite('/api/comparison/check', {});
});
$('comparison-view').addEventListener('change', async (e) => {
  if (e.target.id === 'comparison-order') {
    comparisonOrder = e.target.value;
    refreshComparison(true);
  }
  if (e.target.name === 'method') updateComparisonMethod();
  if (e.target.id === 'comparison-record') {
    const c = comparisonWorkspace.records.find((x) => x.id === e.target.value);
    if (c) {
      comparisonWorkspace.comparison = c;
      renderComparison();
      renderComparisonSummary();
    }
  }
  if (e.target.id !== 'comparison-import' || historyViewing || comparisonBusy)
    return;
  const file = e.target.files[0];
  if (!file) return;
  // 理论利润 Excel 走 /api/theory/preview，与服务端大文件接口同限 15MB。
  if (file.size > XLSX_LIMIT) {
    $('comparison-preview').textContent = `文件超过 ${XLSX_LIMIT / 1048576}MB，请使用标准模板。`;
    return;
  }
  const key = comparisonKey(),
    seq = ++comparisonSequence;
  $('comparison-preview').textContent = '正在预览，尚未保存…';
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const data = await (
      await request('/api/theory/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workbook_base64: btoa(binary) }),
      })
    ).json();
    if (seq !== comparisonSequence || key !== comparisonKey() || historyViewing)
      return;
    const f = $('comparison-theory');
    for (const [k, v] of Object.entries(data.baseline || {}))
      if (f.elements[k] && v != null) f.elements[k].value = v;
    f.elements.scope_confirmed.checked = false;
    updateComparisonMethod();
    $('comparison-preview').innerHTML =
      `<div class="notice"><b>预览完成 · 尚未保存</b><p>业务订单 ${esc(data.baseline?.business_order_id)} · 方式 ${data.baseline?.method === 'costs' ? '收入成本独立复算' : '比例目标'} · 目标毛利率 ${comparisonNumber(data.baseline?.target_margin_pct, '%')} · 理论收入 ${comparisonNumber(data.baseline?.revenue, ' 元')}</p>${(data.warnings || []).map((x) => `<p>${esc(typeof x === 'string' ? x : JSON.stringify(x))}</p>`).join('')}<p>请核对下方可编辑字段，再保存新版本。</p></div>`;
  } catch (err) {
    if (seq === comparisonSequence && key === comparisonKey())
      $('comparison-preview').textContent = err.message;
  }
});
$('comparison-view').addEventListener('submit', (e) => {
  e.preventDefault();
  if (historyViewing || comparisonBusy) return;
  const f = e.target,
    values = Object.fromEntries(new FormData(f));
  if (f.id === 'comparison-theory') {
    const scope = f.elements.scope_confirmed.checked;
    delete values.scope_confirmed;
    if (values.method === 'costs') delete values.target_margin_pct;
    else
      for (const k of [
        'unit_price',
        'discount_per_pair',
        'material_cost',
        'labor_cost',
        'manufacturing_cost',
        'other_production_cost',
      ])
        delete values[k];
    comparisonWrite('/api/theory', {
      baseline: values,
      scope_confirmed: scope,
      confirmed: true,
    });
  }
  if (f.id === 'comparison-bind')
    comparisonWrite('/api/theory/bind', {
      baseline_id: values.baseline_id,
      scope_confirmed: f.elements.scope_confirmed.checked,
      confirmed: true,
    });
  if (f.id === 'comparison-rules')
    comparisonWrite('/api/comparison/rules', {
      rules: { ...values, provisional: true },
      confirmed: true,
    });
  if (f.dataset.comparisonEvent)
    comparisonWrite('/api/comparison/event', {
      event_id: f.dataset.comparisonEvent,
      ...values,
      confirmed: true,
    });
});
refreshComparison();
