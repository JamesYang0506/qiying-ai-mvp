'use strict';
// Read-only theory adaptation. Saving remains in comparison.js and the validated API.
(() => {
  let session = null,
    sequence = 0;
  const view = document.getElementById('comparison-view');
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
  const form = () => document.getElementById('comparison-theory');
  const preview = () => document.getElementById('comparison-preview');
  function clearFields() {
    const f = form();
    if (!f) return;
    f.reset();
    for (const input of f.querySelectorAll('input,textarea')) {
      if (input.type === 'checkbox') input.checked = false;
      else input.value = '';
    }
    f.elements.method.value = 'ratio';
    f.elements.tax_basis.value = 'unknown';
    updateComparisonMethod();
  }
  function canSave() {
    if (!session) return true;
    if (session.pending || session.unresolved) return false;
    const a = session.data?.adaptation;
    if (!a) return true;
    if ((a.sheets?.length || 0) > 1 && !a.sheet) return false;
    if ((a.records?.length || 0) > 1 && !session.selection.record_row)
      return false;
    if (
      a.conflicts?.length &&
      (!session.basisConfirmed ||
        session.basisMethod !== form().elements.method.value)
    )
      return false;
    return !(a.fields || []).some(
      (f) =>
        (f.candidates?.length || 0) > 1 &&
        !f.cell &&
        !(f.field in session.manual),
    );
  }
  function syncSave() {
    const f = form();
    if (f) f.querySelector('button[type="submit"]').disabled = !canSave();
  }
  function working(on) {
    if (form()) form().inert = on;
    if (session) session.pending = on;
    syncSave();
  }
  function problem(message) {
    if (session) session.unresolved = true;
    preview().innerHTML = `<p>${escape(message)}</p><button type="button" class="secondary" id="theory-import-manual">取消本次适配，改为手动填写</button>`;
    syncSave();
  }
  window.resetTheoryImport = () => {
    sequence++;
    session?.controller?.abort();
    if (form()) form().inert = false;
    session = null;
  };
  window.theoryImportCanSave = canSave;
  function label(key, a) {
    return (
      a.fields?.find((f) => f.field === key)?.label ||
      form()
        ?.elements[key]?.closest('label')
        ?.childNodes[0]?.textContent?.trim() ||
      key
    );
  }
  function show(data) {
    const a = data.adaptation || {};
    const fields = a.fields || [];
    const warnings = [
      ...new Set(
        [...(data.warnings || []), ...(a.notes || [])].map((x) =>
          typeof x === 'string' ? x : JSON.stringify(x),
        ),
      ),
    ];
    preview().innerHTML = `<section class="theory-adaptation notice"><h3>${data.status === 'ready' ? '自动识别完成' : '自动识别待核对'} · 预览完成，尚未保存</h3><p>${escape(session.name)} · ${escape(a.layout || '字段识别')} · ${escape(a.sheet || '请先选择来源工作表')}</p><p>核价方式：${escape({ quote: '按报价比例核价', costs: '整单成本独立计算', ratio: '比例目标' }[data.baseline?.method] || '待识别')}</p>
    ${(a.sheets?.length || 0) > 1 ? `<label>来源工作表<select id="theory-import-sheet"><option value="">请选择工作表</option>${a.sheets.map((s) => `<option value="${escape(s.name)}" ${s.name === a.sheet ? 'selected' : ''}>${escape(s.name)}</option>`).join('')}</select></label>` : ''}
    ${(a.records?.length || 0) > 1 ? `<label>本次导入的记录<select id="theory-import-record"><option value="">请选择订单记录</option>${a.records.map((r) => `<option value="${r.row}" ${Number(session.selection.record_row) === r.row ? 'selected' : ''}>${escape(r.label)} · 第${r.row}行</option>`).join('')}</select></label>` : ''}
    ${a.missing?.length || 0 ? `<p class="theory-adaptation-missing">待补：${a.missing.map((k) => escape(label(k, a))).join('、')}。请在下方表单填写，未知不能按0处理。</p>` : ''}
    ${warnings.map((w) => `<p class="help">${escape(w)}</p>`).join('')}
    ${a.conflicts?.length || 0 ? `<div class="theory-adaptation-missing">${a.conflicts.map((c) => `<p>${escape(c.message)}</p>`).join('')}<label class="comparison-confirm"><input type="checkbox" id="theory-import-resolve-basis">我已在下方选定核价方式，并确认只采用该方式的输入，另一组成本不会纳入本计划。</label></div>` : ''}
    ${fields.length ? `<details ${data.status === 'needs_review' ? 'open' : ''}><summary>核对识别字段、数值与来源（${fields.length}项）</summary><div class="theory-adaptation-fields">${fields.map((f) => `<div class="theory-adaptation-field"><strong>${escape(f.label || f.field)}</strong><span>${escape(f.value == null || f.value === '' ? '待补' : f.value)}</span><small>${escape(a.sheet || '')} ${escape(f.cell || '来源待确认')}</small>${(f.candidates?.length || 0) > 1 ? `<label>选择字段来源<select data-theory-import-field="${escape(f.field)}"><option value="">请选择来源</option>${f.candidates.map((c) => `<option value="${escape(c.cell)}" ${c.cell === f.cell ? 'selected' : ''}>${escape(c.cell)} · ${escape(c.value == null ? '空白' : c.value)} ${escape(c.label || '')}</option>`).join('')}</select></label>` : ''}</div>`).join('')}</div></details>` : ''}
    <p>识别不会保存预算。先完成来源选择，再核对和修改下方字段；点击“保存新理论版本并检查”才创建计划。</p><button type="button" class="secondary" id="theory-import-manual">取消本次适配，改为手动填写</button></section>`;
  }
  async function identify() {
    const current = session;
    if (!current) return;
    const token = ++sequence;
    current.controller?.abort();
    current.controller = new AbortController();
    current.unresolved = true;
    current.data = null;
    current.basisConfirmed = false;
    clearFields();
    working(true);
    preview().textContent = '正在自动识别理论表字段、布局与单位，尚未保存…';
    try {
      const data = await (
        await request('/api/theory/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workbook_base64: current.encoded,
            selection: current.selection,
          }),
          signal: current.controller.signal,
        })
      ).json();
      if (
        token !== sequence ||
        current !== session ||
        current.key !== comparisonKey() ||
        historyViewing ||
        !document.getElementById('comparison-theory-dialog')?.open
      )
        return;
      if (current.hash && data.source_hash !== current.hash)
        throw Error('文件指纹不一致，请重新上传。');
      current.hash = data.source_hash;
      current.data = data;
      clearFields();
      for (const [key, value] of Object.entries(data.baseline || {}))
        if (form().elements[key]) form().elements[key].value = value ?? '';
      for (const [key, value] of Object.entries(current.manual))
        if (form().elements[key]) form().elements[key].value = value;
      form().elements.scope_confirmed.checked = false;
      updateComparisonMethod();
      show(data);
      current.unresolved = false;
    } catch (error) {
      if (
        token === sequence &&
        current === session &&
        error.name !== 'AbortError'
      ) {
        problem(
          '自动识别未完成：' +
            error.message +
            '。请重新上传，或取消适配后手动填写。',
        );
        current.data = null;
      }
    } finally {
      if (token === sequence && current === session) working(false);
    }
  }
  window.beginTheoryImport = async (file) => {
    if (!file || historyViewing || comparisonBusy) return;
    document.getElementById('comparison-import').value = '';
    window.resetTheoryImport();
    clearFields();
    const current = {
      name: file.name,
      key: comparisonKey(),
      selection: {},
      manual: {},
      pending: true,
      unresolved: true,
    };
    session = current;
    if (file.size > XLSX_LIMIT) {
      working(false);
      problem('文件超过10MB，请缩小文件后再导入。上一文件输入已清除。');
      return;
    }
    working(true);
    const token = ++sequence;
    preview().textContent = '正在读取理论表文件，尚未保存…';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (
        token !== sequence ||
        current !== session ||
        current.key !== comparisonKey()
      )
        return;
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      current.encoded = btoa(binary);
      await identify();
    } catch (error) {
      if (current === session && token === sequence) {
        problem(error.message);
        working(false);
      }
    }
  };
  view.addEventListener('change', (event) => {
    if (!session) return;
    const el = event.target;
    if (el.id === 'theory-import-resolve-basis') {
      session.basisConfirmed = el.checked;
      session.basisMethod = form().elements.method.value;
      syncSave();
      return;
    }
    if (el.id === 'theory-import-sheet') {
      session.selection = el.value ? { sheet: el.value } : {};
      session.manual = {};
      identify();
    } else if (el.id === 'theory-import-record') {
      session.selection.record_row = el.value ? Number(el.value) : null;
      session.selection.mapping = {};
      session.manual = {};
      identify();
    } else if (el.dataset.theoryImportField) {
      const key = el.dataset.theoryImportField;
      session.selection.mapping ||= {};
      if (el.value) session.selection.mapping[key] = el.value;
      else delete session.selection.mapping[key];
      delete session.manual[key];
      identify();
    }
  });
  view.addEventListener('input', (event) => {
    if (
      session &&
      !session.pending &&
      event.target.closest('#comparison-theory') &&
      event.target.name !== 'scope_confirmed'
    ) {
      session.manual[event.target.name] = event.target.value;
      if (event.target.name === 'method') {
        session.basisConfirmed = false;
        const checkbox = document.getElementById('theory-import-resolve-basis');
        if (checkbox) checkbox.checked = false;
      }
      syncSave();
    }
  });
  view.addEventListener('click', (event) => {
    if (event.target.closest('#theory-import-manual')) {
      window.resetTheoryImport();
      preview().textContent = '已取消适配。请核对并手动填写下方计划字段。';
      syncSave();
    }
  });
  document.addEventListener(
    'close',
    (event) => {
      if (event.target.id !== 'comparison-theory-dialog' || event.target.open)
        return;
      sequence++;
      session?.controller?.abort();
      if (session?.pending) {
        clearFields();
        problem(
          '识别已取消，尚未形成新的来源结果。请重新上传，或改为手动填写。',
        );
      }
      working(false);
    },
    true,
  );
})();
