// Run against a fresh isolated tmp/delivery/serve.py instance, never real storage.
async function browserDecisionFlow(page) {
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = 'http://127.0.0.1:8767';
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + '/?flow=' + Date.now());
  await page.waitForFunction(() => aiStatusLoaded && !defaultLandingPending);
  assert(
    await page.evaluate(() => document.body.dataset.view === 'lobby'),
    'Empty workspace landing',
  );
  assert(
    await page.locator('#decision-report').isDisabled(),
    'Empty report must be disabled',
  );
  assert(
    (await page.locator('#export-training').count()) === 0,
    'Training export remains',
  );
  assert(
    (await page.request.get(base + '/favicon.svg')).status() === 200,
    'Missing favicon',
  );
  assert(
    (
      await page.request.post(base + '/api/export-training', { data: {} })
    ).status() === 404,
    'Training route remains',
  );
  await page.locator('.workspace-links [data-view="comparison"]').click();
  assert(
    await page.locator('#comparison-open-theory').isDisabled(),
    'Empty theory write',
  );
  await page.locator('#upload').setInputFiles('tmp/delivery/actual-first.xlsx');
  await page.waitForFunction(
    () => result?.source_analysis?.order_id === 'SRC-COMP-E2E' && !busy,
  );
  assert(
    await page.locator('#ai-view-button').isHidden(),
    'Offline AI tab shown',
  );
  assert(
    await page.locator('#ai-availability').isVisible(),
    'Offline card missing',
  );
  await page.goto(base + '/?flow=' + Date.now());
  await page.waitForFunction(
    () => result?.source_analysis && !defaultLandingPending,
  );
  assert(
    await page.evaluate(
      () => location.hash === '#home' && document.body.dataset.view === 'home',
    ),
    'Source default home',
  );
  await page.goto(base + '/#history');
  await page.reload();
  await page.waitForFunction(() => currentResult && historyOrders.length);
  assert(
    await page.evaluate(() => document.body.dataset.view === 'history'),
    'Explicit history overridden',
  );
  await page.route('**/api/current', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await page.goto(base + '/?flow=' + Date.now());
  await page.locator('.workspace-links [data-view="history"]').click();
  await page.waitForFunction(() => currentResult);
  assert(
    await page.evaluate(() => document.body.dataset.view === 'history'),
    'Restore hijacked user navigation',
  );
  await page.unroute('**/api/current');
  await page.locator('.workspace-links [data-view="comparison"]').click();
  await page.waitForFunction(() => comparisonWorkspace && !comparisonBusy);
  await page.locator('#comparison-open-theory').click();
  assert(
    await page.locator('#comparison-import').isVisible(),
    'Theory import not discoverable',
  );
  await page.locator('#comparison-import').setInputFiles({
    name: 'too-large.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  assert(
    (await page.locator('#comparison-preview').textContent()).includes('10MB'),
    'Theory 10MB guard',
  );
  await page
    .locator('#comparison-import')
    .setInputFiles('tmp/delivery/theory.xlsx');
  await page.waitForFunction(() =>
    document
      .querySelector('#comparison-preview')
      .textContent.includes('预览完成'),
  );
  await page
    .locator('#comparison-theory [name="target_margin_pct"]')
    .fill('91.5');
  await page.locator('#comparison-theory [name="scope_confirmed"]').check();
  await page.locator('#comparison-theory button[type="submit"]').click();
  await page.waitForFunction(
    () =>
      comparisonWorkspace?.comparison?.metrics?.margin?.status === 'warning',
  );
  const sourceSid = await page.evaluate(() => result.snapshot.snapshot_id);
  await page.locator('#decision-report').click();
  await page.waitForFunction(
    () => !document.querySelector('#report-print').disabled,
  );
  assert(
    (await page.locator('#report-content').textContent()).includes('91.50%'),
    'Report theory target',
  );
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => document.activeElement.id === 'decision-report',
  );
  await page.route(`**/api/history/${sourceSid}?*`, async (route) => {
    const data = await (await route.fetch()).json();
    data.analysis_records = [
      {
        created_at: '2026-01-01',
        model: 'saved-local',
        duration_seconds: 1,
        request_id: 'saved-test',
        request: { focus: 'decision' },
        result: {
          summary: '历史建议可以离线回看',
          risks: [],
          recommendations: [],
          unknowns: [],
        },
        evidence: [],
        context: { snapshot: data.snapshot },
      },
    ];
    await route.fulfill({ json: data });
  });
  await page.evaluate(
    async (sid) => openHistoricalOrder(sid, 'SRC-COMP-E2E'),
    sourceSid,
  );
  assert(
    await page.locator('#ai-view-button').isVisible(),
    'Saved offline AI inaccessible',
  );
  await page.locator('#ai-view-button').click();
  assert(
    (await page.locator('#ai-feedback').textContent()).includes(
      '历史建议可以离线回看',
    ),
    'Saved AI lost',
  );
  assert(await page.locator('#ai-form').isHidden(), 'History AI write enabled');
  await page.unroute(`**/api/history/${sourceSid}?*`);
  await page.locator('#return-current').click();
  await page.route('**/api/ai/status', (route) =>
    route.fulfill({
      json: { configured: true, model: 'test-local', message: '连接成功' },
    }),
  );
  await page.locator('#ai-retry').click();
  assert(await page.locator('#ai-view-button').isVisible(), 'Ready AI hidden');
  assert(
    await page.locator('#ai-availability').isHidden(),
    'Ready fallback remains',
  );
  await page.unroute('**/api/ai/status');
  await page.evaluate(async () => loadAIStatus());
  await page.route('**/api/calculate', async (route) => {
    const data = route.request().postDataJSON();
    data.metadata.is_demo = false;
    await route.continue({ postData: JSON.stringify(data) });
  });
  await page.locator('#upload').setInputFiles('tmp/delivery/standard.json');
  await page.waitForFunction(
    () => result?.orders?.[0]?.order_id === 'A' && !busy,
  );
  await page.unroute('**/api/calculate');
  assert(
    await page.evaluate(() => document.body.dataset.view === 'detail'),
    'Standard import shows empty home',
  );
  await page.locator('#back-to-lobby').click();
  await page.locator('#enter-analysis').click();
  assert(
    await page.evaluate(() => document.body.dataset.view === 'detail'),
    'Standard return shows empty home',
  );
  await page.goto(base + '/?flow=' + Date.now());
  await page.waitForFunction(
    () => result?.orders?.[0]?.order_id === 'A' && !defaultLandingPending,
  );
  assert(
    await page.evaluate(() => document.body.dataset.view === 'detail'),
    'Standard default shows empty home',
  );
  await page.locator('#upload').setInputFiles({
    name: 'too-large.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  assert(
    (await page.locator('#error').textContent()).includes('10MB'),
    'Actual 10MB guard',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ['home', 'detail', 'comparison', 'history']) {
    await page.evaluate((view) => switchView(view), view);
    await page.waitForFunction(() => !comparisonBusy);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'Mobile overflow: ' + view,
    );
  }
  assert(!errors.length, errors.join('\n'));
  return {
    sourceLanding: true,
    standardLanding: true,
    explicitHistory: true,
    restoreRace: true,
    offlineAI: true,
    savedAI: true,
    readyAI: true,
    theoryImport: true,
    fileLimits: true,
    report: true,
    mobile: true,
    pageErrors: errors,
  };
}
