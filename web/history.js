'use strict';
let historyOrders = [],
  historyTrashOrders = [],
  historySkipped = 0,
  historyLoadSequence = 0;
let savedAnalysisContext = '';
const chosenVersions = new Map();
const historyTime = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '时间未记录'
    : d.toLocaleString('zh-CN', { hour12: false });
};
const historyMoney = (value) =>
  value === null || value === undefined
    ? '依据待补'
    : (Number(value) / 10000).toFixed(2) + ' 万元';

function updateWorkspace(analysis = !$('analysis-tabs').hidden) {
  if (typeof updateAdaptationStatus === 'function')
    updateAdaptationStatus(analysis);
  $('back-to-history').hidden = !historyViewing || !analysis;
  $('return-current').hidden = !historyViewing;
  $('return-current').disabled = busy || !currentResult;
  $('workspace-context').textContent = historyViewing
    ? '正在回看历史 · 当前分析已保留'
    : currentResult
      ? '当前分析已恢复 · ' + currentResult.orders.length + ' 笔订单'
      : '本机工作空间';
  $('history-banner').hidden = !historyViewing || !analysis;
  $('history-banner').textContent = historyViewing
    ? `历史记录 · ${result.orders[0]?.order_id} · ${historyTime(result.snapshot.created_at)} · ${result.snapshot.is_demo ? '模拟数据' : '导入数据'} · 版本 ${result.snapshot.snapshot_id}。仅回看保存结果，未重新计算。`
    : '';
  $('import-actions').hidden = !analysis || historyViewing;
  $('ai-form').hidden = historyViewing;
  $('saved-analysis').hidden = !historyViewing;
  if (!historyViewing) return;
  const records = result.analysis_records || [];
  const context =
    result.snapshot.snapshot_id + ':' + result.orders[0]?.order_id;
  const previousIndex =
    savedAnalysisContext === context ? $('saved-analysis-select').value : '0';
  savedAnalysisContext = context;
  $('saved-analysis-select').innerHTML = records
    .map(
      (x, i) =>
        `<option value="${i}">${esc(historyTime(x.created_at))} · ${esc(x.model)} · ${esc({ decision: '决策', profit: '利润', cost: '成本', risk: '风险' }[x.request.focus] || '分析')}</option>`,
    )
    .join('');
  $('saved-analysis-select').disabled = !records.length;
  if (records[Number(previousIndex)])
    $('saved-analysis-select').value = previousIndex;
  $('saved-analysis-status').textContent = records.length
    ? `本版本保存了 ${records.length} 份模型建议，建议仍需人工复核。`
    : '该订单在此版本没有保存模型建议；利润与成本结果仍可查看。';
  showSavedAnalysis();
}
function showSavedAnalysis() {
  const record =
    result?.analysis_records?.[Number($('saved-analysis-select').value)];
  if (record) renderAIResult(record);
  else if (historyViewing) {
    $('ai-feedback').textContent = '此版本没有已保存的模型分析结果。';
    document.querySelector('.ai-result-outline').hidden = true;
  }
}
async function loadHistory() {
  const sequence = ++historyLoadSequence;
  $('history-status').textContent = '正在读取本机历史记录…';
  try {
    const [data, trash] = await Promise.all(
      ['/api/history', '/api/history/trash'].map(async (path) =>
        (await request(path)).json(),
      ),
    );
    if (sequence !== historyLoadSequence) return;
    historyTrashOrders = trash.orders;
    historyOrders = data.orders;
    historySkipped = data.skipped_files;
    $('lobby-order-count').textContent = historyOrders.length;
    $('lobby-version-count').textContent = historyOrders.reduce(
      (n, x) => n + x.versions.length,
      0,
    );
    $('lobby-history-status').textContent = historyOrders.length
      ? '每次成功计算都会保存记录；同编号的历次分析也可逐条查看。'
      : '还没有分析记录。导入订单并计算后，会自动保存历史版本。';
    renderHistory();
  } catch (e) {
    if (sequence !== historyLoadSequence) return;
    $('history-status').textContent = '读取失败：' + e.message;
    $('lobby-history-status').textContent =
      '暂时无法读取历史记录，可点击历史入口后重试。';
  }
}
function renderHistory() {
  const q = $('history-search').value.trim().toLowerCase(),
    kind = $('history-kind').value;
  const inTrash = $('history-layout').value === 'trash',
    sourceOrders = inTrash ? historyTrashOrders : historyOrders;
  const groups = sourceOrders
    .map((g) => ({
      ...g,
      versions: g.versions.filter(
        (v) =>
          (kind === 'all' || (kind === 'demo') === v.is_demo) &&
          [g.order_id, v.product, v.customer].some((x) =>
            String(x || '')
              .toLowerCase()
              .includes(q),
          ),
      ),
    }))
    .filter((g) => g.versions.length);
  const byRecord = $('history-layout').value !== 'orders';
  const entries = byRecord
    ? groups
        .flatMap((g) => g.versions.map((v) => ({ group: g, version: v })))
        .sort((a, b) =>
          (b.version.created_at + ':' + b.version.snapshot_id).localeCompare(
            a.version.created_at + ':' + a.version.snapshot_id,
          ),
        )
    : groups.map((g) => ({
        group: g,
        version:
          g.versions.find(
            (x) => x.snapshot_id === chosenVersions.get(g.order_id),
          ) || g.versions[0],
      }));
  $('history-status').textContent =
    (inTrash ? '回收站 · ' : '') +
    `共 ${groups.length} 个订单编号 · ${groups.reduce((n, g) => n + g.versions.length, 0)} 条分析记录` +
    (historySkipped
      ? `；${historySkipped} 个历史文件损坏或不兼容，已跳过。`
      : '');
  $('history-list').innerHTML = entries.length
    ? entries
        .map(({ group: g, version: v }) => {
          return `<article class="panel history-card"><div class="history-card-head"><div><span class="eyebrow">${esc(g.order_id)}</span><h2>${esc(v.product || '未提供产品名称')}</h2><p>${esc(v.customer || '客户未提供')} · ${esc(v.quantity ?? '数量待补')} ${esc(v.unit || '')}</p></div><span class="badge ${v.is_demo ? 'estimated' : 'complete'}">${v.is_demo ? '模拟数据' : '导入数据'}</span></div>${byRecord ? `<p class="history-record-time">分析时间：${esc(historyTime(v.created_at))}</p>` : `<label>选择分析版本<select data-history-version="${esc(g.order_id)}" aria-label="${esc(g.order_id)} 分析版本">${g.versions.map((x) => `<option value="${esc(x.snapshot_id)}" ${x.snapshot_id === v.snapshot_id ? 'selected' : ''}>${esc(historyTime(x.created_at))} · ${x.is_demo ? '模拟' : '导入'} · ${esc(x.snapshot_id.slice(-8))}</option>`).join('')}</select></label>`}<div class="history-profit"><div><span>生产毛利${v.profit_basis === 'trial' ? ' · 试算' : ''}</span><strong class="${sign(v.production_profit)}">${historyMoney(v.production_profit)}</strong></div><div><span>${v.profit_basis === 'trial' ? '经营净利 · 试算' : '订单管理利润'}</span><strong class="${sign(v.management_profit)}">${historyMoney(v.management_profit)}</strong></div></div><p class="help">数据截止 ${esc(v.cutoff_date)} · ${g.versions.length} 个匹配版本</p>${inTrash ? `<button class="secondary" data-history-restore="${esc(g.order_id)}" data-snapshot="${esc(v.snapshot_id)}" ${busy ? 'disabled' : ''}>恢复记录</button>` : `<div class="history-record-actions"><button class="secondary" data-history-open="${esc(g.order_id)}" data-snapshot="${esc(v.snapshot_id)}" ${busy ? 'disabled' : ''}>查看此版本 →</button><button class="secondary history-delete" data-history-delete="${esc(g.order_id)}" data-snapshot="${esc(v.snapshot_id)}" ${busy ? 'disabled' : ''}>删除记录</button></div>`}</article>`;
        })
        .join('')
    : `<div class="panel empty">${sourceOrders.length ? '没有符合筛选条件的记录。' : inTrash ? '回收站为空。删除的记录可以在这里恢复。' : '暂无历史记录。进入订单分析并导入数据后，计算结果会自动保存。'}</div>`;
}
async function changeHistoryRecord(sid, oid, restore = false) {
  if (busy) return;
  const group = (restore ? historyTrashOrders : historyOrders).find(
    (g) => g.order_id === oid,
  );
  const version = group?.versions.find((v) => v.snapshot_id === sid);
  if (!version) return;
  if (
    !restore &&
    !window.confirm(
      `删除这条分析记录？\n订单：${oid}\n产品：${version.product || '未提供'}\n分析时间：${historyTime(version.created_at)}\n版本：${sid}\n\n记录将移入回收站，可恢复。同一订单的其他版本和原始 Excel 文件保留。`,
    )
  )
    return;
  setBusy(true);
  setError('');
  renderHistory();
  try {
    await request('/api/history/' + (restore ? 'restore' : 'delete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snapshot_id: sid,
        order_id: oid,
        confirmed: true,
      }),
    });
    // Reload also clears a deleted current or historical order from every analysis panel.
    try {
      sessionStorage.setItem(
        'qiying.history.layout',
        $('history-layout').value,
      );
    } catch {}
    location.hash = 'history';
    location.reload();
  } catch (e) {
    setError((restore ? '恢复' : '删除') + '失败：' + e.message);
    setBusy(false);
    renderHistory();
  }
}

async function openHistoricalOrder(sid, oid) {
  if (busy) return;
  setBusy(true);
  renderHistory();
  try {
    const data = await (
      await request(
        '/api/history/' +
          encodeURIComponent(sid) +
          '?order_id=' +
          encodeURIComponent(oid),
      )
    ).json();
    accept(data, { historical: true });
    switchView(data.source_analysis ? 'home' : 'detail');
  } catch (e) {
    setError('历史记录读取失败：' + e.message);
  } finally {
    setBusy(false);
    updateWorkspace();
    renderHistory();
  }
}
function enterCurrentAnalysis() {
  if (busy) return;
  if (historyViewing && !currentResult) {
    location.hash = 'executive-overview';
    location.reload();
    return;
  }
  if (historyViewing) accept(currentResult);
  switchView('home');
}
$('enter-analysis').addEventListener('click', enterCurrentAnalysis);
$('return-current').addEventListener('click', enterCurrentAnalysis);
$('history-refresh').addEventListener('click', loadHistory);
$('history-search').addEventListener('input', renderHistory);
$('history-kind').addEventListener('change', renderHistory);
$('history-layout').addEventListener('change', renderHistory);
$('saved-analysis-select').addEventListener('change', showSavedAnalysis);
$('history-list').addEventListener('change', (event) => {
  const el = event.target.closest('[data-history-version]');
  if (el) {
    chosenVersions.set(el.dataset.historyVersion, el.value);
    renderHistory();
  }
});
$('history-list').addEventListener('click', (event) => {
  const del = event.target.closest('[data-history-delete]'),
    restore = event.target.closest('[data-history-restore]');
  if (del)
    return changeHistoryRecord(del.dataset.snapshot, del.dataset.historyDelete);
  if (restore)
    return changeHistoryRecord(
      restore.dataset.snapshot,
      restore.dataset.historyRestore,
      true,
    );
  const el = event.target.closest('[data-history-open]');
  if (el) openHistoricalOrder(el.dataset.snapshot, el.dataset.historyOpen);
});
try {
  const layout = sessionStorage.getItem('qiying.history.layout');
  if (['records', 'orders', 'trash'].includes(layout))
    $('history-layout').value = layout;
} catch {}
switchView(
  !pendingAnchor || pendingAnchor === 'lobby'
    ? 'lobby'
    : pendingAnchor === 'history'
      ? 'history'
      : pendingAnchor.startsWith('comparison')
        ? 'comparison'
        : pendingAnchor.startsWith('ai-')
          ? 'ai'
          : pendingAnchor.startsWith('executive-')
            ? 'home'
            : 'detail',
);
restoreCurrent();
loadHistory();
loadAIStatus();
