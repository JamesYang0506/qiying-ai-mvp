import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import request from '../../examples/calculation-request.json' with {type:'json'};
import result from '../../examples/calculation-response.json' with {type:'json'};
import {createRepository} from '../../server/orders/repository.mjs';
import {createOrderService} from '../../server/orders/service.mjs';
import {validate} from '../../server/orders/validation.mjs';
const write=(number='A')=>({expected_revision:0,order_number:number,customer_id:'TEST',product_name:'合成订单',quantity:'100',quantity_unit:'pair',currency:'CNY',status:'producing',planned_start:'2026-10-11',planned_end:'2026-10-12'});
const report=(oid,date='2026-10-11',key='line')=>({order_id:oid,business_date:date,report_key:key,source_system:'test',source_record_id:oid+date+key,expected_revision:0,completed_quantity:'100',quantity_unit:'pair',actual_input:structuredClone(request.actual)});
const mock=async req=>{const r=structuredClone(result.data);r.snapshot_id=req.snapshot_id;r.order_id=req.order_id;r.input_hash=req.input_hash;r.scope=req.scope;r.baseline_id=req.baseline_id;r.formula_version=req.formula_version;r.evidence=[];for(const c of r.comparison.cost_variances)c.evidence_ids=[];return r;};
async function setup(t,opts={}){const dir=await mkdtemp(path.join(os.tmpdir(),'b-orders-'));t.after(()=>rm(dir,{recursive:true,force:true}));const repository=createRepository(dir);let clock=Date.parse('2026-10-13T00:00:00Z');const s=createOrderService({repository,clock:()=>clock,calculateOrder:mock,...opts});return {s,repository,advance:()=>clock+=86400000};}
test('two orders in one atomic batch, retries and optimistic conflicts',async t=>{
 const {s,repository}=await setup(t),a=await s.createOrder(write('A'),'a'),b=await s.createOrder(write('B'),'b'),data={atomic:true,reports:[report(a.order_id),report(b.order_id)]};
 const batch=await s.batch(data,'batch');await s.drain();assert.equal((await s.getBatch(batch.batch_id)).status,'completed',JSON.stringify(await s.getJob(batch.job_id)));
 assert.deepEqual(await s.batch(data,'batch'),batch);assert.equal((await repository.read()).reports.length,2);
 await assert.rejects(s.batch({...data,reports:[{...data.reports[0],completed_quantity:'101'}]},'batch'),{code:'IDEMPOTENCY_CONFLICT'});
 await assert.rejects(s.batch({atomic:true,reports:[{...report(a.order_id),completed_quantity:'120'},report(b.order_id,'2026-10-12')]},'bad'),{code:'VERSION_CONFLICT'});
 assert.equal((await repository.read()).reports.length,2);
});
test('concurrent updates accept exactly one revision and preserve old master data',async t=>{
 const {s,repository}=await setup(t),a=await s.createOrder(write(),'create');
 const results=await Promise.allSettled([s.updateOrder(a.order_id,{...write(),expected_revision:1,product_name:'first'},'u1'),s.updateOrder(a.order_id,{...write(),expected_revision:1,product_name:'second'},'u2')]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal((await repository.read()).orders.length,2);await s.drain();
});
test('late revision changes current view but old view, snapshot and known_at stay frozen',async t=>{
 const {s,repository,advance}=await setup(t),a=await s.createOrder(write(),'a');await s.batch({atomic:true,reports:[report(a.order_id)]},'r1');await s.drain();
 const def={as_of:'2026-10-12',period_start:'2026-10-11',filters:{}},v=await s.createView(def,'v1'),old=await s.portfolio(v.view_id);validate('PortfolioPage',old);
 const snap=old.items[0].snapshot_id,original=await s.getSnapshot(a.order_id,snap);advance();
 await s.batch({atomic:true,reports:[{...report(a.order_id),expected_revision:1,completed_quantity:'120'}]},'r2');await s.drain();
 assert.deepEqual(await s.portfolio(v.view_id),old);assert.deepEqual(await s.getSnapshot(a.order_id,snap),original);
 const historical=await s.createView({...def,known_at:v.known_at},'history'),current=await s.createView(def,'v2');
 assert.equal((await s.portfolio(historical.view_id)).items[0].snapshot_id,snap);assert.notEqual((await s.portfolio(current.view_id)).items[0].snapshot_id,snap);
 await assert.rejects(s.getSnapshot('another-order',snap),{code:'SNAPSHOT_NOT_FOUND'});
 validate('ViewRef',current);validate('Trend',await s.trend(current.view_id));
 assert.ok((await repository.read()).snapshots.length>=8);
});
test('cursor binds view, sort and page size; different currencies stay in different groups',async t=>{
 const {s}=await setup(t),a=await s.createOrder(write('A'),'a'),b=await s.createOrder({...write('B'),currency:'USD'},'b');await s.batch({atomic:true,reports:[report(a.order_id),report(b.order_id)]},'batch');await s.drain();
 const v=await s.createView({as_of:'2026-10-12',period_start:'2026-10-11',filters:{}},'view'),first=await s.portfolio(v.view_id,{page_size:1,sort:'order_id'});
 assert.equal(first.groups.length,2);assert.ok(first.next_cursor);const second=await s.portfolio(v.view_id,{page_size:1,sort:'order_id',cursor:first.next_cursor});assert.notEqual(first.items[0].order_id,second.items[0].order_id);
 await assert.rejects(s.portfolio(v.view_id,{page_size:2,sort:'order_id',cursor:first.next_cursor}),{code:'SCOPE_MISMATCH'});
});
test('unconnected A fails clearly while keeping raw reports available for retry',async t=>{
 const {s,repository}=await setup(t,{calculateOrder:undefined}),a=await s.createOrder(write(),'a'),b=await s.batch({atomic:true,reports:[report(a.order_id)]},'batch');await s.drain();
 assert.equal((await s.getBatch(b.batch_id)).status,'failed');const job=await s.getJob(b.job_id);assert.equal(job.error.code,'CALCULATOR_UNAVAILABLE');validate('Job',job);assert.equal((await repository.read()).reports.length,1);
});
test('formal schema rejects bad dates, negative quantities and malformed inputs',async t=>{
 const {s}=await setup(t);assert.throws(()=>s.createOrder({...write(),planned_start:'2026-02-30'},'bad'),{code:'INVALID_REQUEST'});assert.throws(()=>s.createOrder({...write(),quantity:'-1'},'neg'),{code:'INVALID_INPUT'});assert.throws(()=>s.batch({atomic:false,reports:[]},'bad'),{code:'INVALID_REQUEST'});
});
test('an obsolete running task is superseded instead of publishing the latest pointer',async t=>{
 let release,start;const started=new Promise(r=>start=r),gate=new Promise(r=>release=r);let first=true;
 const {s}=await setup(t,{calculateOrder:async req=>{if(first){first=false;start();await gate;}return mock(req);}}),a=await s.createOrder(write(),'a');
 const old=await s.batch({atomic:true,reports:[report(a.order_id)]},'old');await started;
 const newer=await s.batch({atomic:true,reports:[{...report(a.order_id),expected_revision:1,completed_quantity:'120'}]},'new');release();await s.drain();
 assert.equal((await s.getJob(old.job_id)).status,'superseded');assert.equal((await s.getJob(newer.job_id)).status,'completed');
 const v=await s.createView({as_of:'2026-10-12',period_start:'2026-10-11',filters:{}},'v'),p=await s.portfolio(v.view_id);assert.equal(p.items[0].status,'ready');assert.ok((await s.getJob(newer.job_id)).snapshot_ids.includes(p.items[0].snapshot_id));
});
test('pool revisions recalculate all participating orders and include each pool once per cumulative scope',async t=>{
 const calls=[],allocate=async req=>({pool_version_id:req.pool_version_id,allocations:req.targets.map(t=>({order_id:t.order_id,amount:'50.00'})),unassigned_amount:req.targets.length===2?'0.00':'50.00',unassigned_hours:'0',quality:'complete',issues:[]});
 const {s,repository}=await setup(t,{allocateManufacturing:allocate,calculateOrder:async req=>{calls.push(req);return mock(req);}}),a=await s.createOrder(write('A'),'a'),b=await s.createOrder(write('B'),'b');
 const def={period_start:'2026-10-11',period_end:'2026-10-12',currency:'CNY',amount:'100.00',total_hours:'20',targets:[{order_id:a.order_id,hours:'10'},{order_id:b.order_id,hours:'10'}],quality:'complete',source_refs:[]};
 const pool=await s.pool({pool_id:'M-1',expected_revision:0,definition:def},'pool1');await s.drain();assert.equal((await s.getJob(pool.job_id)).status,'completed');
 const requests=calls.filter(r=>r.scope.basis==='cumulative'&&r.scope.period_end==='2026-10-12');assert.equal(requests.length,2);for(const r of requests)assert.equal(r.actual.manufacturing_allocations.filter(a=>a.pool_version_id===pool.pool_version_id).length,1);
 calls.length=0;const updated=await s.pool({pool_id:'M-1',expected_revision:1,definition:{...def,targets:[def.targets[0]]}},'pool2');await s.drain();
 assert.equal((await s.getJob(updated.job_id)).status,'completed');assert.deepEqual(new Set(calls.map(r=>r.order_id)),new Set([a.order_id,b.order_id]));assert.equal((await repository.read()).pools.length,2);
});
test('source conflicts roll back the batch and report pagination freezes its information cutoff',async t=>{
 const {s,advance}=await setup(t),a=await s.createOrder(write(),'a');await s.batch({atomic:true,reports:[report(a.order_id),report(a.order_id,'2026-10-12')]},'r');await s.drain();
 const q={start:'2026-10-11',end:'2026-10-12',page_size:1},first=await s.reports(a.order_id,q);assert.ok(first.next_cursor);advance();
 await s.batch({atomic:true,reports:[{...report(a.order_id,'2026-10-12'),expected_revision:1,completed_quantity:'200'}]},'update');await s.drain();
 const second=await s.reports(a.order_id,{...q,cursor:first.next_cursor});assert.equal(second.items[0].data.completed_quantity,'100');
 await assert.rejects(s.batch({atomic:true,reports:[{...report(a.order_id),source_system:'other',expected_revision:1,completed_quantity:'150'}]},'conflict'),{code:'SOURCE_CONFLICT'});
});
