import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {pair} from '../import/fixture.mjs';
import {normalizePair} from '../../server/import/normalize.mjs';
import {buildOverview,createMonitorService,distributionKey} from '../../server/monitor/overview.mjs';
import {createStore} from '../../server/storage/store.mjs';
import {createMonitorRepository} from '../../server/monitor/storage.mjs';
import {D} from '../../server/profit/decimal.mjs';

export function dataset(id='ORDER-A',prices=[17.2,17.2],quantities=[100,100]){
 const d=normalizePair(...pair()).dataset;d.order.id=id;d.order.start='2026-10-11';d.order.end='2026-10-12';
 for(const key of ['production','materials','expenses']){
  const original=d[key];d[key]=[0,1].flatMap(i=>original.map(r=>({...r,id:r.id+'-'+i,date:'2026-10-'+(11+i),availableAt:`2026-10-${11+i}T18:00:00+08:00`,...(key==='production'?{processed:quantities[i]}:key==='materials'?{net:String(quantities[i]*.65),price:String(prices[i])}:{})})));
 }
 return d;
}
const options={asOf:'2026-10-12',period:2,knownAt:'2026-10-17T00:00:00Z'};
test('monitor uses identical comparable set for cards and a fixed intersection for trend',async()=>{
 const a=dataset(),b=dataset('B');b.baseline.params.material_pct=null;
 const {overview:o}=await buildOverview([{dataset:a},{dataset:b}],options);
 assert.equal(o.coverage.total,2);assert.equal(o.coverage.known,2);assert.equal(o.coverage.comparable,1);
 assert.equal(new D(o.summary.expectedGross).minus(o.summary.actualGross).toFixed(2),o.summary.gap);
 assert.equal(o.trend.includedCount,1);assert.equal(o.distribution.reduce((s,b)=>s+b.count,0),2);
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
