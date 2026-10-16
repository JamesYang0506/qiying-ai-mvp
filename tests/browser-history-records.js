async (page) => {
  await page.goto('http://127.0.0.1:8767/#history');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#history-status').textContent.includes('条分析记录'));
  const expected=await page.evaluate(()=>historyOrders.reduce((n,g)=>n+g.versions.length,0));
  const count=await page.locator('[data-history-open]').count();
  if(count!==expected)throw new Error(`Hidden records: ${count}/${expected}`);
  await page.locator('#history-layout').selectOption('orders');
  const groups=await page.evaluate(()=>historyOrders.length);
  if(await page.locator('[data-history-open]').count()!==groups)throw new Error('Grouped view incorrect');
  await page.locator('#history-layout').selectOption('records');
  const buttons=page.locator('[data-history-open]');
  const old=buttons.last();const sid=await old.getAttribute('data-snapshot');
  await old.click();await page.waitForFunction(sid=>result.snapshot.snapshot_id===sid,sid);
  await page.locator('#back-to-history').click();
  if(await page.locator('[data-history-open]').count()!==expected)throw new Error('Return lost records');
  await page.locator('#history-kind').selectOption('demo');
  const demos=await page.evaluate(()=>historyOrders.reduce((n,g)=>n+g.versions.filter(v=>v.is_demo).length,0));
  if(await page.locator('[data-history-open]').count()!==demos)throw new Error('Demo filter incorrect');
  await page.locator('#history-kind').selectOption('all');
  await page.setViewportSize({width:390,height:844});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Mobile overflow');
  await page.screenshot({path:'tmp/history-records-mobile.png'});
  return {records:count,groups,demos,oldVersionOpened:sid,mobile:true};
}
