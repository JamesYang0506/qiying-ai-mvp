import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,unlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createMonitorRepository} from '../../server/monitor/storage.mjs';
import {hash} from '../../server/orders/repository.mjs';

const baseDataset=id=>({order:{id,start:'2026-10-01',end:'2026-10-02'},revision:{id:'REV-1'},baseline:{id:'BASE-1'},production:[],materials:[],expenses:[],supplements:[]});
function snapshot(id,{order='ORDER-1',input='A',evidence=[]}={}){
 const dataset=baseDataset(input==='A'?'ORDER-1':'ORDER-2');
 return {snapshot_id:id,order_id:order,as_of:'2026-10-02',known_at:'2026-10-17T00:00:00Z',revision_id:'REV-1',baseline_mode:'ideal',input_hash:hash(dataset),result:{snapshot_id:id},evaluation:{daily:{date:'2026-10-02',marker:id}},previous:{date:'2026-10-01',marker:id},inputs:dataset,recorded_at:'2026-10-17T00:00:00Z',evidence};
}
function overview(viewId,snapshots){
 return {viewId,scope:{asOf:'2026-10-02',knownAt:'2026-10-17T00:00:00Z',versionSet:snapshots.map(s=>({orderId:s.order_id,revisionId:s.revision_id,baselineId:'BASE-1',snapshotId:s.snapshot_id}))},orders:snapshots.map(s=>({snapshotId:s.snapshot_id}))};
}
const temp=async t=>{const dir=await mkdtemp(path.join(os.tmpdir(),'qiying-monitor-store-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;};

test('views and evidence survive restart and shared inputs are stored once',async t=>{
 const dir=await temp(t),repo=createMonitorRepository(dir),s1=snapshot('S1'),s2=snapshot('S2'),v1=overview('V1',[s1]),v2=overview('V2',[s2]);
 await repo.saveView({overview:v1,snapshots:[s1],recordedAt:'2026-10-17T01:00:00Z'});
 await repo.saveView({overview:v2,snapshots:[s2],recordedAt:'2026-10-17T02:00:00Z'});
 const restarted=createMonitorRepository(dir);
 assert.deepEqual(await restarted.getView('V1'),v1);
 assert.deepEqual(await restarted.getView('V2'),v2);
 assert.deepEqual((await restarted.getSnapshot('S1')).evidence,[]);
 assert.equal((await restarted.getSnapshot('S2')).evaluation.daily.marker,'S2');
 assert.equal((await readdir(path.join(dir,'inputs'))).length,1);
 assert.equal((await readdir(path.join(dir,'snapshots'))).length,2);
});

test('fixed IDs are immutable while identical retries are idempotent',async t=>{
 const dir=await temp(t),repo=createMonitorRepository(dir),s=snapshot('S1',{evidence:[{evidenceId:'E1'}]}),v=overview('V1',[s]);
 await repo.saveView({overview:v,snapshots:[s],recordedAt:'2026-10-17T01:00:00Z'});
 await repo.saveView({overview:v,snapshots:[s],recordedAt:'2026-10-17T09:00:00Z'});
 await assert.rejects(repo.saveView({overview:{...v,orders:[]},snapshots:[],recordedAt:'2026-10-17T01:00:00Z'}),{code:'VIEW_IMMUTABLE'});
 const changed=snapshot('S1',{evidence:[{evidenceId:'E2'}]});
 await assert.rejects(repo.saveView({overview:v,snapshots:[changed]}),{code:'SNAPSHOT_IMMUTABLE'});
});

test('concurrent publishing shares inputs without mixing evidence',async t=>{
 const dir=await temp(t),repo=createMonitorRepository(dir),s1=snapshot('S1',{evidence:[{evidenceId:'E1'}]}),s2=snapshot('S2',{evidence:[{evidenceId:'E2'}]});
 await Promise.all([repo.saveView({overview:overview('V1',[s1]),snapshots:[s1]}),repo.saveView({overview:overview('V2',[s2]),snapshots:[s2]})]);
 assert.deepEqual((await repo.getSnapshot('S1')).evidence,[{evidenceId:'E1'}]);
 assert.deepEqual((await repo.getSnapshot('S2')).evidence,[{evidenceId:'E2'}]);
 assert.equal((await readdir(path.join(dir,'inputs'))).length,1);
});

test('views cannot reference unpublished snapshots',async t=>{
 const dir=await temp(t),repo=createMonitorRepository(dir),s=snapshot('S1');
 await assert.rejects(repo.saveView({overview:overview('V1',[s]),snapshots:[]}),{code:'STORAGE_INVALID'});
 await assert.rejects(repo.getView('V1'),{code:'VIEW_NOT_FOUND'});
});

test('path traversal and invalid digests are rejected',async t=>{
 const dir=await temp(t),repo=createMonitorRepository(dir),s=snapshot('S1');
 await assert.rejects(repo.getView('../outside'),{code:'INVALID_REQUEST'});
 await assert.rejects(repo.getSnapshot('..\\outside'),{code:'INVALID_REQUEST'});
 await assert.rejects(repo.saveView({overview:{...overview('V1',[s]),viewId:'../outside'},snapshots:[s]}),{code:'INVALID_REQUEST'});
 await assert.rejects(repo.saveView({overview:overview('V1',[s]),snapshots:[{...s,input_hash:'bad'}]}),{code:'STORAGE_INVALID'});
});

test('missing shared input is reported instead of silently skipped',async t=>{
 const dir=await temp(t),repo=createMonitorRepository(dir),s=snapshot('S1');
 await repo.saveView({overview:overview('V1',[s]),snapshots:[s]});
 const inputs=await readdir(path.join(dir,'inputs'));
 await unlink(path.join(dir,'inputs',inputs[0]));
 await assert.rejects(repo.getSnapshot('S1'),{code:'STORAGE_INVALID'});
});
