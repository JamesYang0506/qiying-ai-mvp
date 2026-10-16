// Run on isolated tmp/delivery/serve.py, never business storage.
async function confirmedMargin(page) {
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(
    'http://127.0.0.1:8767/?confirmed-test=' + Date.now() + '#comparison',
  );
  await page.locator('#upload').setInputFiles('tmp/delivery/standard.json');
  await page.waitForFunction(
    () => result?.orders?.[0]?.order_id === 'A' && !busy,
  );
  await page.locator('[data-view="comparison"]').first().click();
  await page.waitForFunction(() => comparisonWorkspace);
  await page.locator('#comparison-open-theory').click();
  await page
    .locator('#comparison-theory [name="method"]')
    .selectOption('quote');
  await page
    .locator('#comparison-theory [name="tax_basis"]')
    .selectOption('included');
  await page.locator('#comparison-quote-example').click();
  assert(
    (await page
      .locator('#comparison-theory [name="tax_basis"]')
      .inputValue()) === 'included',
    'Example overwrote tax choice',
  );
  await page
    .locator('#comparison-theory [name="tax_basis"]')
    .selectOption('ignored');
  assert(
    (await page
      .locator('#comparison-theory [name="quantity"]')
      .inputValue()) === '',
    'Example filled identity/quantity',
  );
  await page.locator('#comparison-theory [name="business_order_id"]').fill('A');
  await page.locator('#comparison-theory [name="quantity"]').fill('1000');
  await page.locator('#comparison-theory [name="unit_price"]').fill('17.2');
  assert(
    (await page.locator('#comparison-quote-preview').textContent()).includes(
      '29.40%',
    ),
    'Known cost preview wrong',
  );
  const count = await page.evaluate(() => comparisonWorkspace.baselines.length);
  await page.locator('#comparison-theory button[type="submit"]').click();
  assert(
    (await page.evaluate(() => comparisonWorkspace.baselines.length)) === count,
    'Missing labor saved',
  );
  assert(
    await page
      .locator('#comparison-theory [name="preparation_labor_per_pair"]')
      .evaluate((n) => !n.validity.valid),
    'Missing input not required',
  );
  for (const name of ['preparation_labor_per_pair', 'press_labor_per_pair'])
    await page.locator(`#comparison-theory [name="${name}"]`).fill('0');
  await page.locator('#comparison-theory [name="scope_confirmed"]').check();
  await page.locator('#comparison-theory button[type="submit"]').click();
  await page.waitForFunction(
    () => comparisonWorkspace?.comparison?.baseline?.method === 'quote',
  );
  const quote = await page.evaluate(() => comparisonWorkspace.comparison);
  assert(quote.baseline.target_margin_pct === '29.4', 'Wrong complete plan');
  assert(
    quote.baseline.operating_expense === '516',
    'Company costs mixed into gross margin',
  );
  assert(
    quote.metrics.margin.performance === 'better',
    'Better result not detected',
  );
  assert(
    (await page.locator('.comparison-kpis').textContent()).includes('优于计划'),
    'Better result not shown',
  );
  const sid = await page.evaluate(() => result.snapshot.snapshot_id);
  await page.locator('#comparison-open-theory').click();
  await page.locator('#comparison-theory [name="business_order_id"]').fill('A');
  await page
    .locator('#comparison-theory [name="target_margin_pct"]')
    .fill('40');
  await page.locator('#comparison-theory [name="scope_confirmed"]').check();
  await page.locator('#comparison-theory button[type="submit"]').click();
  await page.waitForFunction(
    () => comparisonWorkspace?.comparison?.metrics?.margin?.status === 'focus',
  );
  assert(
    (await page.locator('.comparison-kpis').textContent()).includes(
      '相对计划下降比例',
    ),
    'Relative metric absent',
  );
  assert(
    (await page.locator('#comparison-alerts').textContent()).includes('重点'),
    'Focus event absent',
  );
  await page.locator('#comparison-open-rules').click();
  await page
    .locator('#comparison-rules [name="margin_attention_pct"]')
    .fill('20');
  await page.locator('#comparison-rules [name="margin_focus_pct"]').fill('10');
  await page.locator('#comparison-rules button[type="submit"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector(
        '#comparison-rules-dialog .comparison-dialog-message',
      ).textContent.length > 0,
  );
  assert(
    await page.locator('#comparison-rules-dialog').evaluate((n) => n.open),
    'Invalid rules lost draft',
  );
  await page
    .locator('#comparison-rules [name="margin_mode"]')
    .selectOption('points');
  await page.locator('#comparison-rules button[type="submit"]').click();
  await page.waitForFunction(
    () => comparisonWorkspace?.rules?.margin_mode === 'points',
  );
  await page.locator('#comparison-check').click();
  await page.waitForFunction(
    () => comparisonWorkspace?.comparison?.rules?.margin_mode === 'points',
  );
  const old = await page.evaluate(() =>
    structuredClone(comparisonWorkspace.comparison),
  );
  await page.locator('#comparison-open-rules').click();
  await page
    .locator('#comparison-rules [name="margin_mode"]')
    .selectOption('relative');
  await page
    .locator('#comparison-rules [name="margin_attention_pct"]')
    .fill('10');
  await page.locator('#comparison-rules [name="margin_focus_pct"]').fill('20');
  await page.locator('#comparison-rules button[type="submit"]').click();
  await page.waitForFunction(
    () => comparisonWorkspace?.rules?.margin_mode === 'relative',
  );
  assert(
    (await page.evaluate(() => comparisonWorkspace.comparison.id)) === old.id,
    'Rules silently rewrote detection',
  );
  await page.locator('#comparison-check').click();
  await page.waitForFunction(
    () => comparisonWorkspace?.comparison?.rules?.margin_mode === 'relative',
  );
  const savedOld = await page.evaluate(
    (id) => comparisonWorkspace.records.find((c) => c.id === id),
    old.id,
  );
  assert(
    JSON.stringify(savedOld) === JSON.stringify(old),
    'Historical record changed',
  );
  await page.locator('#comparison-record').selectOption(old.id);
  assert(
    (await page.locator('#comparison-metrics').textContent()).includes(
      '旧标准',
    ),
    'Old metric mislabeled',
  );
  await page
    .locator('#comparison-record')
    .selectOption(
      await page.evaluate(
        () =>
          comparisonWorkspace.records.find(
            (c) => c.rules.margin_mode === 'relative',
          ).id,
      ),
    );
  await page.locator('#decision-report').click();
  await page.waitForFunction(
    () => !document.querySelector('#report-print').disabled,
  );
  assert(
    (await page.locator('#report-content').textContent()).includes('重点'),
    'Report missing focus',
  );
  assert(
    (await page.locator('#report-content').textContent()).includes(
      '相对计划下降',
    ),
    'Report missing relative metric',
  );
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Mobile comparison overflow',
  );
  await page.locator('#comparison-open-theory').click();
  await page
    .locator('#comparison-theory [name="method"]')
    .selectOption('quote');
  await page.locator('#comparison-quote-example').click();
  assert(
    await page
      .locator('#comparison-theory-dialog')
      .evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
    'Mobile quote overflow',
  );
  const beforeImport = await page.evaluate(
    () => comparisonWorkspace.baselines.length,
  );
  await page
    .locator('#comparison-import')
    .setInputFiles('tmp/theory-sample/quote-standard.xlsx');
  await page.waitForFunction(() =>
    document
      .querySelector('#comparison-preview')
      .textContent.includes('预览完成'),
  );
  assert(
    (await page.locator('#comparison-preview').textContent()).includes(
      '按报价比例核价',
    ),
    'Quote import mislabeled',
  );
  assert(
    (await page.evaluate(() => comparisonWorkspace.baselines.length)) ===
      beforeImport,
    'Preview wrote a baseline',
  );
  await page.screenshot({ path: 'tmp/theory-sample/quote-mobile.png' });
  await page.keyboard.press('Escape');
  await page.evaluate(async (sid) => openHistoricalOrder(sid, 'A'), sid);
  await page.evaluate(() => switchView('comparison'));
  await page.waitForFunction(() => comparisonWorkspace && historyViewing);
  assert(
    await page.locator('#comparison-open-theory').isDisabled(),
    'History allows writing',
  );
  assert(!errors.length, errors.join('\n'));
  return {
    quote: true,
    missingVersusZero: true,
    better: true,
    focus: true,
    ruleDraft: true,
    legacy: true,
    historyImmutable: true,
    report: true,
    mobile: true,
    pageErrors: errors,
  };
}
