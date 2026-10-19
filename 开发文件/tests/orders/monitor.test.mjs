import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {pair} from '../import/fixture.mjs';
import {normalizePair} from '../../server/import/normalize.mjs';
import {buildOverview,createMonitorService,distributionKey} from '../../server/monitor/overview.mjs';
import {createStore} from '../../server/storage/store.mjs';
import {createMonitorRepository} from '../../server/monitor/storage.mjs';
import {D,money} from '../../server/profit/decimal.mjs';
import {evaluate} from '../../server/profit/evaluate.mjs';
import {calculateSeries} from '../../server/profit/series.mjs';

export function dataset(id='ORDER-A',prices=[17.2,17.2],quantities=[100,100]){
 const d=normalizePair(...pair()).dataset;d.order.id=id;d.order.start='2026-10-11';d.order.end='2026-10-12';
 for(const key of ['production','materials','expenses']){
  const original=d[key];d[key]=[0,1].flatMap(i=>original.map(r=>({...r,id:r.id+'-'+i,date:'2026-10-'+(11+i),availableAt:`2026-10-${11+i}T18:00:00+08:00`,...(key==='production'?{processed:quantities[i]}:key==='materials'?{net:String(quantities[i]*.65),price:String(prices[i])}:{})})));
 }
 return d;
}
const options={asOf:'2026-10-12',period:2,knownAt:'2026-10-17T00:00:00Z'};
test('live evidence stays frozen across revisions, expires without writes and keeps old archives readable',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'b-monitor-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const store=createStore(dir),repository=createMonitorRepository(path.join(dir,'monitor-state'));await store.commit(dataset());
 let now=Date.now(),writes=0;
 const service=createMonitorService({store,repository:{...repository,async saveView(value){writes++;return repository.saveView(value);}},clock:()=>now,liveViewOptions:{maxEntries:2,ttlMs:1000}});
 const a=await service.browse({asOf:options.asOf,period:2}),e=await service.evidence(a.viewId,a.orders[0].snapshotId);
 const d=dataset();d.revision.id='REV-2';d.materials[0].price='19';await store.commit(d);now=Date.now();
 const b=await service.browse({asOf:options.asOf,period:2});
 assert.equal(b.orders[0].revisionId,'REV-2');assert.deepEqual(await service.evidence(a.viewId,a.orders[0].snapshotId),e);
 a.summary.actualGross='999';assert.notEqual((await service.get(a.viewId)).summary.actualGross,'999');
 await assert.rejects(service.evidence(b.viewId,a.orders[0].snapshotId),{code:'SCOPE_MISMATCH'});
 await service.browse({asOf:options.asOf,period:1});
 await assert.rejects(service.get(a.viewId),{status:410});assert.equal(writes,0);
 now+=1000;await assert.rejects(service.get(b.viewId),{status:410});
 const archived=await service.create({asOf:options.asOf,period:2});assert.equal(writes,1);
 const restarted=createMonitorService({store,repository});
 assert.deepEqual(await restarted.get(archived.viewId),archived);
 assert.equal((await restarted.evidence(archived.viewId,archived.orders[0].snapshotId)).revisionId,'REV-2');
 await assert.rejects(restarted.get(b.viewId),{status:410});
});
test('monitor uses identical comparable set for cards and a fixed intersection for trend',async()=>{
 const a=dataset(),b=dataset('B');b.baseline.params.material_pct=null;
 const {overview:o}=await buildOverview([{dataset:a},{dataset:b}],options);
 assert.equal(o.coverage.total,2);assert.equal(o.coverage.known,2);assert.equal(o.coverage.comparable,1);
 assert.equal(new D(o.summary.expectedGross).minus(o.summary.actualGross).toFixed(2),o.summary.gap);
 assert.equal(o.trend.includedCount,1);assert.equal(o.distribution.reduce((s,b)=>s+b.count,0),2);
});
test('cards total only the selected trend window rather than all history',async()=>{
 const d=dataset();d.order.end='2026-10-13';
 for(const key of ['production','materials','expenses'])d[key].push(...d[key].filter(r=>r.date==='2026-10-12').map(r=>({...r,id:r.id+'-13',date:'2026-10-13',availableAt:'2026-10-13T18:00:00+08:00'})));
 const full=await buildOverview([{dataset:d}],{...options,asOf:'2026-10-13',period:3});
 const window=await buildOverview([{dataset:d}],{...options,asOf:'2026-10-13',period:2});
 const points=calculateSeries(d,{start:'2026-10-11',end:'2026-10-13'});
 assert.equal(window.overview.summary.actualGross,money(new D(points[2].actual).minus(points[0].actual)));
 assert.equal(window.overview.coverage.periodComparable,1);
 assert.notEqual(window.overview.summary.actualGross,window.overview.orders[0].cumulative.actual.gross);
 assert.equal(full.overview.summary.actualGross,full.overview.orders[0].cumulative.actual.gross);
});
test('growing cumulative gap or total costs alone does not mean daily deterioration',async()=>{
 const {overview:o}=await buildOverview([{dataset:dataset('A',[17.2,17.2],[100,200])}],options);
 assert.equal(o.summary.deteriorated,0);assert.equal(o.orders[0].comparison.marginChangePp,'0');
 assert.ok(!o.orders[0].recommendations.some(r=>r.ruleId==='MATERIAL_USAGE'));
});
test('labor increases generate labor evidence rather than invented material causes',async()=>{
 const d=dataset();d.expenses.find(r=>r.date==='2026-10-12'&&r.category==='人工').amount='100.00';
 const {overview:o}=await buildOverview([{dataset:d}],options),r=o.orders[0];
 assert.equal(o.summary.deteriorated,1);assert.ok(new D(r.comparison.unitCostChange).gt(0));
 assert.deepEqual(r.recommendations.map(r=>r.ruleId),['LABOR']);assert.ok(r.recommendations[0].evidence.length>0);
});
test('late inputs and replacement revisions do not create a false operating deterioration ranking',async()=>{
 const d=dataset('A',[17.2,20]);d.materials[0].availableAt='2026-10-16T18:00:00+08:00';
 const {overview:o}=await buildOverview([{dataset:d},{dataset:dataset('B'),revisionCount:2}],options);
 assert.equal(o.coverage.dayComparable,0);assert.equal(o.summary.deteriorated,0);assert.equal(o.orders[0].recommendations[0].ruleId,'DATA_CHECK');
});
test('known_at is independent from as_of while future records stay unavailable',async()=>{
 const d=dataset();d.materials[0].availableAt='2026-10-16T18:00:00+08:00';
 const early=await buildOverview([{dataset:d}],{...options,knownAt:'2026-10-13T00:00:00Z'}),late=await buildOverview([{dataset:d}],options);
 assert.equal(early.overview.summary.actualGross,null);assert.notEqual(late.overview.summary.actualGross,null);
});
test('a review view sees the selected business day end while an explicit cutoff stays frozen',async()=>{
 const d=dataset();for(const key of ['production','materials','expenses'])for(const r of d[key])r.availableAt=r.date+'T23:59:59+08:00';
 const knownAt='2026-10-12T10:00:00Z',review={...options,knownAt,visibilityCutoff:'2026-10-12T23:59:59+08:00'};
 assert.notEqual((await buildOverview([{dataset:d}],review)).overview.orders[0].cumulative.actual.gross,null);
 assert.equal((await buildOverview([{dataset:d}],{...options,knownAt})).overview.orders[0].cumulative.actual.gross,null);
 d.materials[0].availableAt='2026-10-13T09:00:00+08:00';
 assert.equal((await buildOverview([{dataset:d}],review)).overview.orders[0].cumulative.actual.gross,null);
});
test('default monitor views see records dated after the clock but within the selected day',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'b-monitor-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const store=createStore(dir),repo=createMonitorRepository(path.join(dir,'monitor-state')),d=dataset();
 d.order.end='2026-10-20';d.production.push({...d.production[0],id:'FUTURE-ROW',date:'2026-10-20',availableAt:'2026-10-20T23:59:59+08:00'});
 await store.commit(d);
 const seen=[],compute=(dataset,opts)=>{seen.push(dataset.production.find(r=>r.id==='FUTURE-ROW')?.availableAt);return evaluate(dataset,opts);};
 const clock=Date.now(),service=createMonitorService({store,repository:repo,clock:()=>clock,compute});
 await service.create({asOf:'2026-10-20',period:2});
 assert.equal(seen.at(-1),'2026-10-20T00:00:00+08:00');
 await service.create({asOf:'2026-10-20',period:2,knownAt:new Date(clock).toISOString()});
 assert.equal(seen.at(-1),'9999-12-31T23:59:59+08:00');
});
test('empty, missing yesterday, zero quantity and unstarted orders stay explicit',async()=>{
 const empty=await buildOverview([],options);assert.equal(empty.overview.summary.actualGross,null);
 const a=dataset('A');a.production=a.production.filter(r=>r.date!=='2026-10-11');
 const b=dataset('B',[17.2,17.2],[100,0]),c=dataset('C');c.order.start='2026-10-13';
 const {overview:o}=await buildOverview([{dataset:a},{dataset:b},{dataset:c}],options);
 assert.equal(o.summary.deteriorated,0);assert.equal(o.orders.find(r=>r.order.id==='B').distribution,'unknown');assert.equal(o.orders.find(r=>r.order.id==='C').distribution,'not_started');
});
test('distribution thresholds are mutually exclusive',()=>{
 for(const [value,key] of [['.3','high'],['.1','medium'],['0','low'],['-.00001','negative'],[null,'unknown']])assert.equal(distributionKey({actual:{margin:value}}),key);
});
test('late recording uses Shanghai midnight even when the source timestamp is UTC',async()=>{
 const d=dataset();d.materials[1].availableAt='2026-10-12T17:00:00Z';
 const {overview:o}=await buildOverview([{dataset:d}],options);assert.equal(o.coverage.dayComparable,0);assert.ok(o.orders[0].comparison.reasons.some(r=>r.includes('迟录')));
});
test('persisted view and evidence remain unchanged after an import revision and restart',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'b-monitor-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const store=createStore(dir),repo=createMonitorRepository(path.join(dir,'monitor-state'));await store.commit(dataset());
 const service=createMonitorService({store,repository:repo}),v=await service.create({...options,knownAt:undefined});
 const d=dataset();d.revision.id='REV-2';d.materials[0].price='19';await store.commit(d);
 const restarted=createMonitorService({store:createStore(dir),repository:createMonitorRepository(path.join(dir,'monitor-state'))});
 assert.deepEqual(await restarted.get(v.viewId),v);
 const e=await restarted.evidence(v.viewId,v.orders[0].snapshotId);assert.equal(e.revisionId,'REV-1');
 await assert.rejects(restarted.evidence(v.viewId,'wrong'),{code:'SCOPE_MISMATCH'});
});
test('scope filters keep cards, trends, distribution and attention on the same frozen order set',async()=>{
 const a=dataset('A'),b=dataset('B');a.order.customer='恒远运动';b.order.customer='星途实业';a.order.quantity='1000';b.order.quantity='1000';b.materials.forEach(r=>r.price='26');
 const all=await buildOverview([{dataset:a},{dataset:b}],options);assert.equal(all.overview.orders.find(r=>r.order.id==='B').risk.label,'严重');
 const filtered=await buildOverview([{dataset:a},{dataset:b}],{...options,customer:'星途实业',status:'生产中',risk:'严重',search:'B'}),o=filtered.overview;
 assert.deepEqual(o.orders.map(r=>r.order.id),['B']);assert.equal(o.coverage.total,1);assert.equal(o.distribution.reduce((s,b)=>s+b.count,0),1);assert.equal(o.summary.actualGross,o.orders[0].cumulative.actual.gross);assert.deepEqual(o.filterOptions.customers,['恒远运动','星途实业']);
 const spaced=await buildOverview([{dataset:a},{dataset:b}],{...options,search:' 恒远   a '}),so=spaced.overview;assert.deepEqual(so.orders.map(r=>r.order.id),['A']);
 const blank=await buildOverview([{dataset:a},{dataset:b}],{...options,search:'   '});assert.equal(blank.overview.coverage.total,2);
 const noMatches=await buildOverview([{dataset:a}],{...options,customer:'不存在'});assert.equal(noMatches.overview.coverage.total,0);assert.equal(noMatches.overview.summary.actualGross,null);
});
