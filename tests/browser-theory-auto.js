// Use only the isolated server with synthetic tmp/theory-sample/auto fixtures.
async function theoryAuto(page) {
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:8767/?auto=' + Date.now() + '#comparison');
  assert(
    (await page
      .locator('.workspace-links [data-view="comparison"]')
      .count()) === 0,
    'Duplicate sidebar entry remains',
  );
  await page.locator('#upload').setInputFiles('tmp/delivery/standard.json');
  await page.waitForFunction(
    () => result?.orders?.[0]?.order_id === 'A' && !busy,
  );
  await page.locator('[data-view="comparison"]').first().click();
  await page.waitForFunction(() => comparisonWorkspace);
  await page.locator('#comparison-open-theory').click();
  const upload = async (name) => {
    await page
      .locator('#comparison-import')
      .setInputFiles('tmp/theory-sample/auto/' + name);
    await page.waitForFunction(() =>
      document
        .querySelector('#comparison-preview')
        .textContent.includes('预览完成'),
    );
  };
  const field = (name) => page.locator(`#comparison-theory [name="${name}"]`);
  const save = page.locator('#comparison-theory button[type="submit"]');
  const before = await page.evaluate(
    () => comparisonWorkspace.baselines.length,
  );
  await upload('offset.xlsx');
  assert(
    (await field('business_order_id').inputValue()) === 'A',
    'Offset order not recognized',
  );
  assert(
    (await field('target_margin_pct').inputValue()) === '40',
    'Alias percent not recognized',
  );
  assert(
    (await page.locator('#comparison-preview').textContent()).includes('C5'),
    'Source cell missing',
  );
  await upload('multi.xlsx');
  assert(
    (await field('business_order_id').inputValue()) === '',
    'Old file identity remained',
  );
  assert(await save.isDisabled(), 'Multiple sources allow saving');
  await page.locator('#theory-import-sheet').selectOption('预算二');
  await page.waitForSelector('#theory-import-record');
  assert(await save.isDisabled(), 'Multiple records auto-selected');
  await page.locator('#theory-import-record').selectOption('6');
  await page.waitForFunction(
    () =>
      document.querySelector('#comparison-theory [name="business_order_id"]')
        .value === 'A',
  );
  assert(
    (await field('target_margin_pct').inputValue()) === '40',
    'Wrong selected record',
  );
  await page.locator('#theory-import-sheet').selectOption('');
  await page.waitForSelector('#theory-import-sheet');
  assert(
    (await field('business_order_id').inputValue()) === '',
    'Deselection kept old data',
  );
  assert(await save.isDisabled(), 'Deselection permits stale save');
  await page.locator('#theory-import-sheet').selectOption('预算一');
  await page.waitForFunction(
    () =>
      document.querySelector('#comparison-theory [name="target_margin_pct"]')
        .value === '30',
  );
  await page.route('**/api/theory/preview', (route) =>
    route.fulfill({ status: 500, json: { error: 'Synthetic source failure' } }),
  );
  await page.locator('#theory-import-sheet').selectOption('预算二');
  await page.waitForFunction(() =>
    document
      .querySelector('#comparison-preview')
      .textContent.includes('Synthetic source failure'),
  );
  assert(
    (await field('target_margin_pct').inputValue()) === '',
    'Failed source kept old data',
  );
  assert(await save.isDisabled(), 'Failed source unlocks save');
  await page.unroute('**/api/theory/preview');
  await upload('conflict.xlsx');
  assert(await save.isDisabled(), 'Duplicate candidates allow save');
  await page
    .locator('[data-theory-import-field="target_margin_pct"]')
    .selectOption('B3');
  await page.waitForFunction(
    () =>
      document.querySelector('#comparison-theory [name="target_margin_pct"]')
        .value === '40',
  );
  assert(await save.isEnabled(), 'Selected candidate remains blocked');
  await page.locator('#comparison-import').setInputFiles({
    name: 'oversize.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  assert(
    (await field('target_margin_pct').inputValue()) === '',
    'Oversize file kept old budget',
  );
  assert(await save.isDisabled(), 'Oversize file permits stale save');
  await upload('unit-bad.xlsx');
  assert(
    (await field('target_margin_pct').inputValue()) === '',
    'Money treated as margin',
  );
  assert(
    (await page.locator('#comparison-preview').textContent()).includes('待补'),
    'Missing unit warning',
  );
  await upload('formula-cache.xlsx');
  assert(
    (await field('target_margin_pct').inputValue()) === '40',
    'Formula cache not read',
  );
  assert(
    (await page.locator('#comparison-preview').textContent()).includes(
      '未执行公式',
    ),
    'Formula evidence warning lost',
  );
  await upload('formula-missing.xlsx');
  assert(
    (await field('target_margin_pct').inputValue()) === '',
    'Uncached formula became budget',
  );
  await field('target_margin_pct').fill('40');
  await upload('mixed.xlsx');
  assert(await save.isDisabled(), 'Mixed cost basis not blocked');
  await page.locator('#theory-import-resolve-basis').check();
  assert(await save.isEnabled(), 'Explicit cost choice not accepted');
  await field('method').selectOption('costs');
  assert(await save.isDisabled(), 'Changed cost basis retained confirmation');
  await upload('quote-partial.xlsx');
  assert(
    (await field('method').inputValue()) === 'quote',
    'Quote layout not recognized',
  );
  assert(
    (await page.locator('#comparison-quote-preview').textContent()).includes(
      '29.40%',
    ),
    'Partial quote preview wrong',
  );
  assert(
    (await field('preparation_labor_per_pair').inputValue()) === '',
    'Missing labor became zero',
  );
  for (const name of ['preparation_labor_per_pair', 'press_labor_per_pair'])
    await field(name).fill('0');
  assert(
    (await page.evaluate(() => comparisonWorkspace.baselines.length)) ===
      before,
    'Preview created records',
  );
  await save.click();
  await page.waitForFunction(
    () => comparisonWorkspace?.comparison?.baseline?.method === 'quote',
  );
  assert(
    (await page.evaluate(
      () => comparisonWorkspace.comparison.baseline.target_margin_pct,
    )) === '29.4',
    'Manual completion not independently calculated',
  );
  await page.locator('#comparison-open-theory').click();
  await upload('offset.xlsx');
  await page.route('**/api/theory/preview', async (route) => {
    await new Promise((r) => setTimeout(r, 500));
    try {
      await route.continue();
    } catch {}
  });
  await page
    .locator('#comparison-import')
    .setInputFiles('tmp/theory-sample/auto/multi.xlsx');
  await page.keyboard.press('Escape');
  await page.locator('#comparison-open-theory').click();
  await page.waitForTimeout(650);
  assert(
    (await field('business_order_id').inputValue()) === '',
    'Closed request refilled data',
  );
  assert(await save.isDisabled(), 'Cancelled import became saveable');
  await page.unroute('**/api/theory/preview');
  await upload('multi.xlsx');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page
      .locator('#comparison-theory-dialog')
      .evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
    'Mobile adaptation overflow',
  );
  await page.screenshot({ path: 'tmp/theory-sample/auto-mobile.png' });
  await page.keyboard.press('Escape');
  const sid = await page.evaluate(() => result.snapshot.snapshot_id);
  await page.evaluate(async (sid) => openHistoricalOrder(sid, 'A'), sid);
  await page.evaluate(() => switchView('comparison'));
  await page.waitForFunction(() => historyViewing && comparisonWorkspace);
  assert(
    await page.locator('#comparison-open-theory').isDisabled(),
    'Historical import enabled',
  );
  assert(!errors.length, errors.join('\n'));
  return {
    navigation: true,
    offset: true,
    multipleSources: true,
    conflict: true,
    failedSelection: true,
    oversize: true,
    formulaCache: true,
    missingLabor: true,
    explicitCostBasis: true,
    noPreviewWrites: true,
    save: true,
    cancelRace: true,
    mobile: true,
    history: true,
    pageErrors: errors,
  };
}
