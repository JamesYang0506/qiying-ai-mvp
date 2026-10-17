import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {mkdtemp,rm,mkdir} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {createApp} from '../runtime/server.mjs';import {createStore} from '../server/storage/store.mjs';import {normalizePair} from '../server/import/normalize.mjs';import {pair} from '../tests/import/fixture.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.QIYING_PLAYWRIGHT_PATH??'playwright');
const dir=await mkdtemp(path.join(os.tmpdir(),'qiying-daily-')),out=fileURLToPath(new URL('../output/daily-data/',import.meta.url));await mkdir(out,{recursive:true});
const store=createStore(dir);
for(let i=0;i<2;i++){
 const d=normalizePair(...pair()).dataset;d.order.id='DAILY-'+i;d.order.product='每日记录核查订单';d.order.start='2026-10-11';d.order.end='2026-10-12';
 for(const k of ['production','materials','expenses']){const records=d[k];d[k]=[0,1].flatMap(day=>records.map(r=>({...r,id:r.id+'-'+day,date:'2026-10-'+(11+day),availableAt:`2026-10-${11+day}T18:00:00+08:00`,...(k==='production'?{processed:String(100+i*10+day),defects:'2'}:{})})));}
 d.supplements=[{id:'SUP-'+i,date:'2026-10-12',availableAt:'2026-10-12T18:00:00+08:00',size:'38',quantity:'7',parentId:d.production.at(-1).id,reason:'返工补产',inclusion:'已含当日加工量与净耗，不重复计入',status:'已确认',source:{fileRole:'cost',sheet:'补单用量',cell:'A6'}}];
 await store.commit(d);
 if(i===0){const rev=structuredClone(d);rev.revision.id='REV-2';rev.supplements[0].quantity='9';await store.commit(rev);}
}
const server=createApp({root:fileURLToPath(new URL('../',import.meta.url)),dataDir:dir});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,channel:process.env.QIYING_BROWSER_CHANNEL??'msedge'}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/fonts.googleapis.com/**',r=>r.abort());await page.route('**/fonts.gstatic.com/**',r=>r.abort());
 await page.goto(base+'/#data/DAILY-0');await page.waitForSelector('.dd-order-info');assert.equal(await page.locator('[data-view]').count(),0);assert.equal(await page.locator('.topbar .top-actions,.dd-calendar').count(),0);assert.equal(await page.locator('.bm-masthead').count(),1);assert.equal(await page.locator('[data-dd-day]').count(),0);
 const dailyStatus=()=>page.locator('.dd-status');assert.match(await dailyStatus().innerText(),/2026-10-11/);
 await page.locator('#dd-next').click();await page.waitForFunction(()=>document.querySelector('.dd-status')?.textContent.includes('2026-10-12')&&!document.querySelector('.dd-status')?.textContent.includes('载入'));
 const a=await(await fetch(base+'/api/import-v1/orders/DAILY-0/analysis?asOf=2026-10-12&revision=REV-2')).json();
 assert.ok((await page.locator('.bm-kpis').innerText()).includes(Number(a.daily.quantity).toLocaleString('zh-CN')));
 assert.match(await page.locator('.dd-section').last().innerText(),/SUP-0/);assert.match(await page.locator('.dd-section').last().innerText(),/补单用量 · A6/);
 await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
 await page.locator('#dd-revision').selectOption('REV-1');await page.waitForFunction(()=>document.querySelector('.dd-status')?.textContent.includes('REV-1'));assert.equal(await page.locator('#dd-date').inputValue(),'2026-10-12');assert.match(await page.locator('.dd-section').last().innerText(),/7/);
 await page.locator('#dd-prev').click();await page.waitForFunction(()=>document.querySelector('.dd-status')?.textContent.includes('2026-10-11')&&!document.querySelector('.dd-status')?.textContent.includes('载入'));assert.match(await page.locator('.dd-section').last().innerText(),/当天没有可见记录/);
 await page.locator('#dd-order').selectOption('DAILY-1');await page.waitForFunction(()=>document.querySelector('.dd-status')?.textContent.includes('DAILY-1'));assert.equal(await page.locator('#dd-order').inputValue(),'DAILY-1');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.goto(base+'/#imported/DAILY-0');await page.waitForSelector('[data-view="diagnosis"]');assert.equal(await page.locator('[data-view]').count(),3);assert.equal(await page.locator('.bm-masthead').count(),1);
 assert.deepEqual(errors,[]);console.log('Daily data browser verification passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
