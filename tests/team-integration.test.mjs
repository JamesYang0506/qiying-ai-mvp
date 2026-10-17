import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './http/helpers.mjs';
import {createStore} from '../server/storage/store.mjs';
import {normalizePair} from '../server/import/normalize.mjs';
import {pair} from './import/fixture.mjs';
import {evaluate} from '../server/profit/evaluate.mjs';
import {recommendations} from '../server/monitor/recommendations.mjs';
import {readdir} from 'node:fs/promises';

test('integrated monitor preserves current A diagnosis and frozen view evidence',async t=>{
 const {base,dir}=await setup(t);const d=normalizePair(...pair()).dataset;
 await createStore(dir).commit(d);
 const response=await fetch(base+'/api/import-v1/monitor?asOf=2026-08-03&period=1');assert.equal(response.status,200);
 const view=await response.json();assert.equal(view.orders[0].order.id,d.order.id);
 assert.equal(view.summary.actualGross,'602.00');
 const fixed=await fetch(base+'/api/import-v1/monitor/views/'+view.viewId);assert.deepEqual(await fixed.json(),view);
 const analysis=await(await fetch(base+'/api/import-v1/orders/'+d.order.id+'/analysis?asOf=2026-08-03')).json();
 assert.ok(analysis.diagnosis);assert.ok(analysis.referenceThresholds);assert.equal(analysis.cumulative.actual.gross,view.orders[0].cumulative.actual.gross);
 const evidence=await(await fetch(base+`/api/import-v1/monitor/views/${view.viewId}/snapshots/${view.orders[0].snapshotId}/evidence`)).json();
 assert.equal(evidence.revisionId,d.revision.id);assert.equal(evidence.daily.quantity,100);
});
test('daily calendar never exposes production or profit after selected date',async()=>{
 const {buildDailyCalendar}=await import('../dist/daily-data.js');
 const rows=buildDailyCalendar({daySummaries:[{date:'2026-08-03',quantity:100,actual:{gross:'602.00'}},{date:'2026-08-04',quantity:999,actual:{gross:'9999.00'}}]}, {start:'2026-08-03',end:'2026-08-04',asOf:'2026-08-03'});
 assert.equal(rows[0].quantity,100);assert.equal(rows[1].quantity,null);assert.equal(rows[1].actual.gross,null);assert.equal(rows[1].future,true);
});
test('monitor and A analysis share visibility cutoff without rewriting evidence times',async t=>{
 const {base,dir}=await setup(t);const d=normalizePair(...pair()).dataset;
 d.materials[0].availableAt='2026-08-04T00:00:00+08:00';await createStore(dir).commit(d);
 const v=await(await fetch(base+'/api/import-v1/monitor?asOf=2026-08-03&period=1')).json();
 const a=await(await fetch(base+`/api/import-v1/orders/${d.order.id}/analysis?`+new URLSearchParams({asOf:v.scope.asOf,knownAt:v.scope.knownAt,revision:d.revision.id}))).json();
 assert.equal(a.cumulative.actual.gross,v.summary.actualGross);assert.equal(a.cumulative.actual.gross,'602.00');
 const portfolio=await(await fetch(base+'/api/import-v1/portfolio?'+new URLSearchParams({asOf:v.scope.asOf,knownAt:v.scope.knownAt}))).json();
 assert.equal(portfolio.totals.actualGross,a.cumulative.actual.gross);
 const evidence=await(await fetch(base+`/api/import-v1/monitor/views/${v.viewId}/snapshots/${v.orders[0].snapshotId}/evidence`)).json();
 assert.equal(evidence.daily.rows.materials[0].availableAt,d.materials[0].availableAt);
 assert.equal(evaluate(d,{asOf:'2026-08-03'}).cumulative.actual.gross,null);
});
test('repeated equivalent empty-filter monitor reads reuse a lean frozen view',async t=>{
 const {base,dir}=await setup(t);await createStore(dir).commit(normalizePair(...pair()).dataset);
 const url=base+'/api/import-v1/monitor?asOf=2026-08-03&period=1&customer=none';
 const a=await(await fetch(url)).json(),b=await(await fetch(url)).json();
 assert.equal(a.viewId,b.viewId);assert.equal(a.orders.length,0);
 const names=await readdir(dir+'/monitor-state');assert.equal(names.filter(n=>n.startsWith('view-')).length,1);
});
test('material iteration cannot crowd out a large labor increase in top recommendations',()=>{
 const rows=(net)=>['M1','M2','M3'].map(id=>({id,materialId:id,date:'2026-08-03',net,price:'1'}));
 const day=(net,labor)=>({quantity:100,rows:{materials:rows(net),expenses:[{id:'L',category:'人工',amount:labor}],supplements:[]},actual:{costs:{人工:labor,制造:'0'}},components:{materialPrice:'0'}});
 const r=recommendations({today:day('1.001','10001'),previous:day('1','1'),comparison:{status:'comparable'},orderId:'A',revisionId:'R',asOf:'2026-08-03',snapshotId:'S'});
 assert.equal(r[0].ruleId,'LABOR');assert.equal(r.filter(x=>x.ruleId==='MATERIAL_USAGE').length,1);
});
