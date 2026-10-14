// Run with playwright-cli run-code against the isolated test server.
// Every report request is mocked; this test never saves business data.
async function browserDecisionReport(page) {
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const requests = [];
  let activeScenario = false;
  const pattern = '**/api/comparison?snapshot_id=REPORT-TEST-*';
  await page.route(pattern, async (route) => {
    const req = route.request();
    requests.push(req.method());
    const url = new URL(req.url());
    const id = url.searchParams.get('order_id');
    await route.fulfill({
      json: {
        rules: { version: 'CURRENT-RULE-MUST-NOT-APPEAR' },
        events: [
          {
            detection_status: 'active',
            message: 'CURRENT-EVENT-MUST-NOT-APPEAR',
          },
        ],
        comparison:
          id === 'B'
            ? null
            : {
                id: 'SAVED-DETECTION',
                snapshot_id: url.searchParams.get('snapshot_id'),
                order_id: id,
                created_at: '2025-01-02',
                severity: activeScenario ? 'danger' : 'warning',
                events: activeScenario
                  ? [
                      ...Array.from({ length: 4 }, (_, i) => ({
                        metric: 'margin',
                        detection_status: 'active',
                        message: `历史仍触发事件${i + 1}`,
                      })),
                      {
                        metric: 'margin',
                        detection_status: 'active',
                        message: '历史仍触发事件1',
                      },
                      {
                        metric: 'quality',
                        detection_status: 'recovered',
                        message: 'RECOVERED-MUST-NOT-APPEAR',
                      },
                    ]
                  : [],
                scope_confirmed: false,
                rules: { version: 'HISTORICAL-RULE', provisional: true },
                baseline: {
                  id: 'THEORY-OLD',
                  version: 3,
                  tax_basis: 'unknown',
                },
                pending: ['同单范围待确认'],
                metrics: {
                  margin: {
                    target_pct: '25',
                    value_pct: '20',
                    delta_pp: '5',
                    status: activeScenario ? 'pending' : 'warning',
                    message: activeScenario
                      ? '当前毛利依据待补'
                      : '毛利较理论下降5个百分点。',
                  },
                  quality: {
                    status: 'normal',
                    message: 'NORMAL-MUST-NOT-BE-PENDING',
                  },
                },
              },
      },
    });
  });
  const old = await page.evaluate(() => ({
    result,
    historyViewing,
    selected,
    reportHidden: document.querySelector('#report-actions').hidden,
    reportDisabled: document.querySelector('#decision-report').disabled,
  }));
  try {
    await page.evaluate(() => {
      result = {
        snapshot: {
          snapshot_id: 'REPORT-TEST-ONE',
          cutoff_date: '2025-01-01',
          is_demo: true,
          formula_version: 'test-v1',
        },
        orders: [
          {
            order_id: 'A',
            product: '<img src=x onerror=alert(1)>',
            customer: 'Test',
            quantity: '100',
            unit: '双',
            mode: 'actual',
            revenue: '1000',
            production_profit: '200',
            production_margin: '0.2',
            management_profit: null,
            management_margin: null,
            management_status: 'disabled',
            production_status: 'complete',
            categories: {
              material: '500',
              labor: '100',
              manufacturing: '150',
              production_other: '50',
            },
          },
          {
            order_id: 'B',
            product: '缺失值订单',
            quantity: '50',
            unit: '双',
            mode: 'forecast',
            production_profit: null,
            categories: {},
          },
        ],
        issues: [],
      };
      historyViewing = true;
      selected = 'A';
      document.querySelector('#decision-report').disabled = false;
      document.querySelector('#report-actions').hidden = false;
    });
    await page.locator('#decision-report').click();
    await page.waitForFunction(
      () => !document.querySelector('#report-print').disabled,
    );
    const report = page.locator('#report-content');
    let body = await report.innerText();
    assert(
      body.includes('800.00 元') && body.includes('20.00%'),
      'Standard money/margin missing',
    );
    assert(
      body.includes('未启用') &&
        body.includes('历史只读') &&
        body.includes('模拟数据'),
      'Scope labels missing',
    );
    assert(
      body.includes('HISTORICAL-RULE') &&
        !body.includes('CURRENT-RULE-MUST-NOT-APPEAR'),
      'Historical rule contamination',
    );
    assert(
      (await report.locator('img').count()) === 0 &&
        body.includes('<img src=x'),
      'Unescaped report input',
    );
    await page.locator('#report-order').selectOption('1');
    await page.waitForFunction(
      () =>
        !document.querySelector('#report-print').disabled &&
        document
          .querySelector('#report-content')
          .textContent.includes('缺失值订单'),
    );
    body = await report.innerText();
    assert(
      body.includes('依据待补') && !body.includes('0.00 元'),
      'Missing values converted to zero',
    );
    assert(
      body.includes('尚无匹配本快照') && body.includes('参考试算'),
      'No-detection / forecast labels missing',
    );
    await page.keyboard.press('Escape');
    assert(
      await page.locator('#report-dialog').evaluate((node) => !node.open),
      'Escape did not close report',
    );
    assert(
      await page.evaluate(
        () => document.activeElement.id === 'decision-report',
      ),
      'Opener focus not restored',
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      result.source_analysis = {
        order_id: 'A',
        product: '源表试算',
        metrics: {
          quantity: '100',
          revenue: '2000',
          production_margin: '0.25',
          management_reference_margin: '0.15',
        },
        profit_layers: {
          production_cost: '1500',
          production_profit: '500',
          operating_net_profit: '300',
        },
        trust_review: {
          checks: [
            {
              title: '测试审查',
              status: 'pending',
              evidence: '依据待核验',
              needed: '核对测试原始凭证',
            },
          ],
        },
      };
      openDecisionReport();
    });
    await page.waitForFunction(
      () => !document.querySelector('#report-print').disabled,
    );
    body = await report.innerText();
    assert(
      body.includes('2,000.00 元') &&
        body.includes('300.00 元') &&
        body.includes('经营净利 · 试算') &&
        body.includes('核对测试原始凭证'),
      'Source analysis not preferred',
    );
    assert(
      await page
        .locator('#report-dialog')
        .evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
      'Mobile report overflows',
    );
    assert(
      await report
        .locator('.report-heading')
        .evaluate((node) => getComputedStyle(node).display === 'block'),
      'Report heading inherited website navigation layout',
    );
    await page.evaluate(() => {
      window.reportPrintTest = null;
      document.addEventListener(
        'load',
        function intercept(event) {
          if (
            !event.target.matches?.('.report-print-frame') ||
            !event.target.contentDocument.querySelector('.report-sheet')
          )
            return;
          document.removeEventListener('load', intercept, true);
          const win = event.target.contentWindow;
          win.print = () => {
            window.reportPrintTest = {
              text: win.document.body.textContent,
              controls: !!win.document.querySelector('button, select'),
              stylesheet: win.document.querySelector('link').href,
            };
            win.dispatchEvent(new Event('afterprint'));
          };
        },
        true,
      );
    });
    await page.locator('#report-print').click();
    await page.waitForFunction(() => window.reportPrintTest !== null);
    const printed = await page.evaluate(() => window.reportPrintTest);
    assert(
      printed.text.includes('核对测试原始凭证') &&
        !printed.controls &&
        printed.stylesheet.endsWith('/report.css'),
      'Print frame lost report evidence or included controls',
    );
    assert(
      (await page.locator('.report-print-frame').count()) === 0,
      'Print frame not cleaned up',
    );
    activeScenario = true;
    await page.locator('[data-report-close]').click();
    await page.evaluate(() => openDecisionReport());
    await page.waitForFunction(
      () => !document.querySelector('#report-print').disabled,
    );
    body = await report.innerText();
    assert(
      body.includes('历史仍触发事件1（保存事件仍在触发）') &&
        body.includes('严重预警') &&
        body.includes('当前毛利依据待补'),
      'Active saved event missing when current metric is pending',
    );
    assert(
      !body.includes('CURRENT-EVENT-MUST-NOT-APPEAR') &&
        !body.includes('RECOVERED-MUST-NOT-APPEAR') &&
        !body.includes('NORMAL-MUST-NOT-BE-PENDING'),
      'Live/recovered/normal messages polluted saved report',
    );
    assert(
      (await report.locator('.report-risk li').count()) === 3 &&
        body.includes('列出 3/4 项；其余依据请回网站对应快照。'),
      'Summary limit/count or event deduplication failed',
    );
    assert(
      body.includes('非完整明细') && body.includes('保存检测仍有毛利预警'),
      'Summary scope or active-event action missing',
    );
    assert(
      requests.length === 4 && requests.every((method) => method === 'GET'),
      'Report made a mutation or unexpected request',
    );
    await page.locator('[data-report-close]').click();
    console.log(
      'Decision report: standard/source, escaped content, multi-order, historical rules, nulls, GET-only, mobile, focus and isolated print passed.',
    );
  } finally {
    await page.evaluate((previous) => {
      document.querySelector('#report-dialog')?.close();
      result = previous.result;
      historyViewing = previous.historyViewing;
      selected = previous.selected;
      document.querySelector('#report-actions').hidden = previous.reportHidden;
      document.querySelector('#decision-report').disabled =
        previous.reportDisabled;
    }, old);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.unroute(pattern);
  }
}
