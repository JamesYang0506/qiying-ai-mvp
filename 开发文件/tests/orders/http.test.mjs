import {test} from 'node:test';import assert from 'node:assert/strict';
import {setup} from '../http/helpers.mjs';
import {createStore} from '../../server/storage/store.mjs';
import {pair} from '../import/fixture.mjs';import {normalizePair} from '../../server/import/normalize.mjs';
import {validate} from '../../server/orders/validation.mjs';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

async function diskContents(dir){
 const result={};
 async function visit(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())await visit(file);else result[path.relative(dir,file)]=createHash('sha256').update(await readFile(file)).digest('hex');}}
 await visit(dir);return result;
}
test('repeated monitor browsing, filters and evidence never write history files',async t=>{
 const {base,dir}=await setup(t);await createStore(dir).commit(normalizePair(...pair()).dataset);
 const before=await diskContents(dir);
 for(let i=0;i<8;i++){
  const response=await fetch(base+`/api/import-v1/monitor?asOf=2026-08-0${i%2+2}&period=${i%3+1}&search=${i%2?'':encodeURIComponent(' ')}`);
  assert.equal(response.status,200);const view=await response.json();
  assert.deepEqual(await(await fetch(base+'/api/import-v1/monitor/views/'+view.viewId)).json(),view);
  const evidence=await fetch(base+`/api/import-v1/monitor/views/${view.viewId}/snapshots/${view.orders[0].snapshotId}/evidence`);
  assert.equal(evidence.status,200);
 }
 assert.deepEqual(await diskContents(dir),before,'read-only monitoring must not create snapshots, inputs or views');
});
test('monitor API freezes an actual imported version and exposes only its own evidence',async t=>{
 const {base,dir}=await setup(t);await createStore(dir).commit(normalizePair(...pair()).dataset);
 const r=await fetch(base+'/api/import-v1/monitor?asOf=2026-08-03&period=1'),body=await r.json();assert.equal(r.status,200);assert.equal(body.coverage.total,1);
 assert.deepEqual(await(await fetch(base+'/api/import-v1/monitor/views/'+body.viewId)).json(),body);
 const evidence=await fetch(base+`/api/import-v1/monitor/views/${body.viewId}/snapshots/${body.orders[0].snapshotId}/evidence`);assert.equal(evidence.status,200);
 assert.equal((await fetch(base+'/api/import-v1/monitor?asOf=2026-02-30')).status,400);
});
test('formal writes require origin, token and idempotency key and use contract envelopes',async t=>{
 const {base,token}=await setup(t),body={expected_revision:0,order_number:'HTTP-1',customer_id:'TEST',product_name:'合成',quantity:'100',quantity_unit:'pair',currency:'CNY',status:'producing',planned_start:'2026-10-11',planned_end:'2026-10-12'};
 const opts={method:'POST',headers:{Origin:base,'X-Qiying-Token':token,'Content-Type':'application/json','Idempotency-Key':'create'},body:JSON.stringify(body)};
 assert.equal((await fetch(base+'/api/v1/orders',{...opts,headers:{'Content-Type':'application/json'}})).status,403);
 const response=await fetch(base+'/api/v1/orders',opts),json=await response.json();assert.equal(response.status,201);validate('OrderRecordResponse',json);
 const bad=await fetch(base+'/api/v1/orders',{...opts,body:JSON.stringify({...body,quantity:'NaN'})}),error=await bad.json();assert.equal(bad.status,400);validate('ErrorResponse',error);
});
