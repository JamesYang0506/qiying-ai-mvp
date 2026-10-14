'use strict';
// Reports read the selected saved result; they never create a detection or AI request.
(() => {
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c],
    );
  const number = (value) =>
    value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value))
      ? Number(value)
      : null;
  const amount = (value) =>
    number(value) === null
      ? '依据待补'
      : `${number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 元`;
  const rate = (value, scale = 1) =>
    number(value) === null
      ? '依据待补'
      : `${(number(value) * scale).toFixed(2)}%`;
  const text = (value) =>
    escape(
      value === null || value === undefined || value === '' ? '未记录' : value,
    );
  const time = (value) => {
    if (!value) return '未记录';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? text(value)
      : escape(date.toLocaleString('zh-CN', { hour12: false }));
  };
  const list = (items, empty) => {
    const seen = new Set();
    const distinct = items.filter(Boolean).filter((item) => {
      const key = String(item)
        .replace(/（保存事件仍在触发）$/, '')
        .replace(/\s+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Keep each selected evidence item intact; long evidence may continue onto another page.
    const visible = distinct.slice(0, 3);
    return visible.length
      ? `<ul>${visible.map((item) => `<li>${escape(item)}</li>`).join('')}</ul><p class="report-note">列出 ${visible.length}/${distinct.length} 项；${distinct.length > visible.length ? '其余' : '完整'}依据请回网站对应快照。</p>`
      : `<p>${escape(empty)}</p>`;
  };
  let dialog,
    opener,
    sequence = 0;

  function reportMarkup(data, order, historical, comparison, readError) {
    const snapshot = data.snapshot || {};
    const source =
      data.source_analysis?.order_id === order.order_id
        ? data.source_analysis
        : null;
    const metrics = source?.metrics || order,
      layers = source?.profit_layers;
    const revenue = metrics.revenue,
      profit = layers ? layers.production_profit : metrics.production_profit;
    const costKeys = ['material', 'labor', 'manufacturing', 'production_other'];
    const cost = layers
      ? layers.production_cost
      : costKeys.every((key) => number(order.categories?.[key]) !== null)
        ? costKeys.reduce(
            (total, key) => total + number(order.categories[key]),
            0,
          )
        : null;
    const net = layers ? layers.operating_net_profit : order.management_profit;
    const trial =
      !!source ||
      order.mode !== 'actual' ||
      order.production_status !== 'complete' ||
      order.revenue_status === 'estimated';
    const managementEstimated =
      !layers && order.management_status === 'estimated';
    const checks = source?.trust_review?.checks || [];
    const activeEvents = (comparison?.events || []).filter(
      (event) => event.detection_status === 'active',
    );
    const alertMetrics = ['margin', 'quality'].filter((key) =>
      ['warning', 'danger'].includes(comparison?.metrics?.[key]?.status),
    );
    const issues = (data.issues || []).filter(
      (issue) => issue.order_id === order.order_id,
    );
    const risks = [
      ...activeEvents.map(
        (event) => event.message && `${event.message}（保存事件仍在触发）`,
      ),
      ...alertMetrics
        .filter(
          (key) =>
            !activeEvents.some(
              (event) =>
                event.metric === key &&
                event.message === comparison.metrics[key].message,
            ),
        )
        .map((key) => comparison.metrics[key].message),
      ...checks
        .filter((check) => check.status === 'difference')
        .map(
          (check) => `${check.title}：${check.evidence || '详见原始审查依据'}`,
        ),
      ...issues
        .filter((issue) => issue.code === 'LOSS')
        .map((issue) => issue.message),
    ];
    const pending = [
      ...(comparison?.pending || []),
      ...['margin', 'quality']
        .filter((key) => comparison?.metrics?.[key]?.status === 'pending')
        .map((key) => comparison.metrics[key].message),
      ...checks
        .filter((check) => check.status === 'pending')
        .map(
          (check) => `${check.title}：${check.evidence || '原始凭证待核验'}`,
        ),
      ...(source?.warnings || []).map((warning) => warning.message),
      ...issues
        .filter((issue) => issue.code !== 'LOSS')
        .map((issue) => issue.message),
    ];
    if (!comparison)
      pending.push(readError || '尚无匹配本快照的保存检测；未检测不代表正常。');
    const actions = [];
    const affectedMetrics = new Set([
      ...alertMetrics,
      ...activeEvents.map((event) => event.metric),
    ]);
    if (affectedMetrics.has('margin'))
      actions.push(
        '保存检测仍有毛利预警：核对理论目标与本单材料、人工、制造成本的变化。',
      );
    if (affectedMetrics.has('quality'))
      actions.push(
        '保存检测仍有质量预警：核对不良、返工及补料记录，确认成本影响；不直接把数量差额当作损失。',
      );
    actions.push(
      ...checks
        .filter(
          (check) =>
            check.status === 'difference' || check.status === 'pending',
        )
        .filter((check) => check.needed || check.action)
        .sort(
          (a, b) =>
            Number(a.status !== 'difference') -
            Number(b.status !== 'difference'),
        )
        .map((check) => `${check.title}：${check.needed || check.action}`),
    );
    if (number(net) !== null && number(net) < 0)
      actions.unshift(
        '当前口径利润为负：先复核报价、成本归集及费用范围，再评估追加订单。',
      );
    if (risks.length && !actions.length)
      actions.push(
        '逐项核对下列预警的原始凭证、数量及归集范围，记录核查结果后再作业务决策。',
      );
    if (pending.length)
      actions.push(
        '补齐待补依据，确认数量范围与税口径后，再评估订单收益及理论偏差。',
      );
    const margin = comparison?.metrics?.margin,
      baseline = comparison?.baseline;
    const delta = number(margin?.delta_pp);
    const tax =
      { included: '含税', excluded: '不含税' }[order.tax_basis] ||
      '未知 / 待核验';
    const unique = (items) => [...new Set(items.filter(Boolean))];
    return `<article class="report-sheet"><header class="report-heading"><p>企盈智擎 · 单订单决策参考</p><h1>${text(source?.product || order.product || order.order_id)}</h1><div class="report-tags">${[snapshot.is_demo ? '模拟数据' : '导入数据', historical ? '历史只读' : '当前保存结果', trial ? '参考试算 · 尚待核实' : managementEstimated ? '管理利润含估算 · 尚待核实' : '标准核算', `税口径：${tax}`].map((tag) => `<span>${escape(tag)}</span>`).join('')}</div></header>
      <dl class="report-facts"><div><dt>订单 / 客户</dt><dd>${text(order.order_id)} / ${text(order.customer)}</dd></div><div><dt>数量 / 范围</dt><dd>${text(metrics.quantity ?? order.quantity)} ${text(order.unit)} · ${order.mode === 'actual' ? '已交付实际' : '整单预测'}</dd></div><div><dt>数据截至</dt><dd>${text(snapshot.cutoff_date)}</dd></div><div><dt>数据保存时间</dt><dd>${time(snapshot.created_at)}</dd></div></dl>
      <section><h2>收入、成本与利润</h2><div class="report-kpis">${[
        ['收入', amount(revenue)],
        ['生产成本', amount(cost)],
        [`生产毛利${trial ? ' · 试算' : ''}`, amount(profit)],
        ['生产毛利率', rate(metrics.production_margin, 100)],
        [
          layers
            ? '经营净利 · 试算'
            : `订单管理利润${managementEstimated ? ' · 估算' : ''}`,
          order.management_status === 'disabled' && !layers
            ? '未启用'
            : amount(net),
        ],
        [
          layers
            ? '经营净利率 · 试算'
            : `订单管理利润率${managementEstimated ? ' · 估算' : ''}`,
          rate(
            layers
              ? metrics.management_reference_margin
              : order.management_margin,
            100,
          ),
        ],
      ]
        .map(
          ([label, value]) =>
            `<div><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`,
        )
        .join(
          '',
        )}</div><p class="report-note">${layers ? '生产毛利 = 收入 − 生产成本；经营净利 = 生产毛利 − 已列经营费用。费用完整性及税口径待核验，不等同于财务报表净利润。' : '生产毛利扣除生产成本；订单管理利润再扣期间及其他订单费用，为管理核算口径，不等同于财务报表净利润。'}缺失值保持待补，未按零处理。</p></section>
      <section><h2>保存的理论对照</h2><div class="report-comparison"><p>理论毛利率 <b>${escape(rate(margin?.target_pct))}</b></p><p>检测当前毛利率 <b>${escape(rate(margin?.value_pct))}</b></p><p>较理论 <b>${delta === null ? '待确认可比范围' : `${delta > 0 ? '下降' : delta < 0 ? '提高' : '持平'} ${Math.abs(delta).toFixed(2)} 个百分点`}</b></p></div><p class="report-note">${comparison ? `${text({ normal: '未触发预警', warning: '黄色提醒', danger: '严重预警', pending: '待补依据 / 待观察' }[comparison.severity] || '状态未记录')} · ${comparison.scope_confirmed ? '范围已人工确认' : '范围未确认'} · 理论税口径 ${text({ included: '含税', excluded: '不含税' }[baseline?.tax_basis] || '未知')} · ${comparison.rules?.provisional === false ? '保存规则' : '暂定规则'}` : '没有可用保存检测，不能据此认定正常。'}${historical ? ' 历史报告仅使用该快照的保存检测、理论和规则。' : ''}</p></section>
      <section class="report-risk"><h2>主要预警</h2>${list(unique(risks), '当前保存结果未列出预警；仍需结合待补依据判断。')}</section>
      <section><h2>待补依据 / 待观察</h2>${list(unique(pending), '保存结果未列出待补事项；准确性仍需企业凭证复核。')}</section>
      <section><h2>依据支持的行动</h2>${list(unique(actions), '保存结果暂无进一步行动依据；结合原始凭证及企业认可口径复核。')}<p class="report-note">本报告由已保存数据与规则整理，无需模型；不能直接替代接单、拒单、降价或财务确认决定。</p></section>
      <footer class="report-footer">本报告为决策摘要，非完整明细；请回网站对应快照核查全部依据。<br>快照 ${text(snapshot.snapshot_id)} · 公式 ${text(snapshot.formula_version)}<br>检测 ${text(comparison?.id)} · 检测时间 ${time(comparison?.created_at)}<br>理论 ${text(baseline?.id)} / v${text(baseline?.version)} · 规则 ${text(comparison?.rules?.version)}</footer></article>`;
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'report-dialog';
    dialog.className = 'report-dialog';
    dialog.setAttribute('aria-labelledby', 'report-title');
    dialog.innerHTML =
      '<div class="report-toolbar"><h2 id="report-title">单订单决策报告</h2><button type="button" data-report-close aria-label="关闭决策报告">关闭</button></div><div class="report-controls"><label>选择报告订单 <select id="report-order"></select></label><button type="button" id="report-print" disabled>打印 / 保存 PDF</button></div><p id="report-status" class="report-status" role="status" aria-live="polite"></p><div id="report-content"></div>';
    document.body.append(dialog);
    dialog
      .querySelector('[data-report-close]')
      .addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      sequence++;
      opener?.focus();
    });
    dialog
      .querySelector('#report-print')
      .addEventListener('click', printReport);
    return dialog;
  }

  function printReport() {
    const content = dialog.querySelector('#report-content').innerHTML;
    if (!content) return;
    const frame = document.createElement('iframe');
    frame.className = 'report-print-frame';
    frame.title = '单订单报告打印';
    document.body.append(frame);
    const cleanup = () => {
      frame.remove();
      dialog.querySelector('#report-print')?.focus();
    };
    frame.onload = async () => {
      const win = frame.contentWindow;
      if (!win) return cleanup();
      await win.document.fonts?.ready;
      win.addEventListener('afterprint', cleanup, { once: true });
      win.focus();
      win.print();
    };
    const css = new URL('report.css', document.baseURI).href;
    frame.srcdoc = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>单订单决策报告</title><link rel="stylesheet" href="${escape(css)}"></head><body class="report-print-body">${content}</body></html>`;
  }

  window.openDecisionReport = function openDecisionReport() {
    if (!result?.orders?.length) return;
    const data = structuredClone(result),
      historical = historyViewing;
    const orders = [
      ...new Map(data.orders.map((order) => [order.order_id, order])).values(),
    ];
    const root = ensureDialog(),
      select = root.querySelector('#report-order');
    opener = document.activeElement;
    select.innerHTML = orders
      .map(
        (order, index) =>
          `<option value="${index}">${text(order.order_id)} · ${text(order.product)}</option>`,
      )
      .join('');
    const preferred = orders.findIndex(
      (order) =>
        order.order_id === (data.source_analysis?.order_id || selected),
    );
    select.value = String(Math.max(0, preferred));
    async function render() {
      const token = ++sequence,
        order = orders[Number(select.value)];
      const content = root.querySelector('#report-content'),
        status = root.querySelector('#report-status'),
        print = root.querySelector('#report-print');
      print.disabled = true;
      content.innerHTML = '';
      status.textContent = '正在读取本快照的保存检测…';
      let comparison = null,
        readError = '';
      try {
        if (!data.snapshot?.snapshot_id)
          throw new Error('快照编号未记录，无法关联保存检测。');
        const workspace = await (
          await request(
            `/api/comparison?snapshot_id=${encodeURIComponent(data.snapshot.snapshot_id)}&order_id=${encodeURIComponent(order.order_id)}`,
          )
        ).json();
        const saved = workspace.comparison;
        if (
          saved &&
          saved.snapshot_id === data.snapshot.snapshot_id &&
          saved.order_id === order.order_id
        )
          comparison = saved;
        else if (saved)
          readError = '保存检测与本快照 / 订单不匹配，已排除，需核验关联依据。';
      } catch (error) {
        readError = `保存检测读取未完成：${error.message}`;
      }
      if (token !== sequence || !root.open) return;
      content.innerHTML = reportMarkup(
        data,
        order,
        historical,
        comparison,
        readError,
      );
      status.textContent =
        readError ||
        (comparison
          ? '已读取匹配本快照的保存检测。'
          : '暂无保存检测；报告仍可打印。');
      print.disabled = false;
    }
    select.onchange = render;
    if (!root.open) root.showModal();
    render();
    select.focus();
  };
  document
    .getElementById('decision-report')
    ?.addEventListener('click', window.openDecisionReport);
})();
