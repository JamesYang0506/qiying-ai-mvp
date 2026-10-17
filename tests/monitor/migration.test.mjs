import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,readFile,readdir,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createMonitorRepository} from '../../server/monitor/storage.mjs';
import {hash} from '../../server/orders/repository.mjs';
import {parseMigrationArgs,migrateMonitorHistory} from '../../scripts/migrate-monitor-history.mjs';

const sha=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const dataset=order=>({order:{id:order,start:'2026-10-01',end:'2026-10-02'},revision:{id:'REV-1'},baseline:{id:'BASE-1'},production:[],materials:[],expenses:[],supplements:[]});
function snapshot(id,order,evidence=[],marker=id){
 const input=dataset(order);
 return {snapshot_id:id,order_id:order,as_of:'2026-10-02',known_at:'2026-10-17T00:00:00Z',revision_id:'REV-1',baseline_mode:'ideal',input_hash:hash(input),result:{snapshot_id:id},evaluation:{daily:{date:'2026-10-02',marker}},previous:{marker},inputs:input,recorded_at:'2026-10-17T00:00:00Z',evidence};
}
function view(viewId,snapshots,kind='import-monitor'){
 return {view_id:viewId,kind,overview:{viewId,scope:{asOf:'2026-10-02',knownAt:'2026-10-17T00:00:00Z',versionSet:snapshots.map(s=>({orderId:s.order_id,revisionId:s.revision_id,baselineId:'BASE-1',snapshotId:s.snapshot_id}))},orders:snapshots.map(s=>({snapshotId:s.snapshot_id}))},recorded_at:'2026-10-17T00:00:00Z'};
}
async function fixture(t){
 const dir=await mkdtemp(path.join(os.tmpdir(),'qiying-migrate-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const s1=snapshot('S1','ORDER-1',[{evidenceId:'E1'}],'S1'),s2=snapshot('S2','ORDER-2',[{evidenceId:'E2'}],'S2'),formal=snapshot('FORMAL-S','FORMAL-1',[{evidenceId:'EF'}],'FORMAL');
 const state={version:1,orders:[{id:'FORMAL-1'}],baselines:[],reports:[],pools:[],batches:[],jobs:[],idempotency:{},views:[view('V1',[s1]),view('V2',[s1,s2]),view('FORMAL-VIEW',[formal,s1],'formal-b')],snapshots:[s1,s2,formal]};
 const bmodule=path.join(dir,'b-module');await mkdir(bmodule,{recursive:true});
 const source=path.join(bmodule,'b-state.json');await writeFile(source,JSON.stringify(state));
 return {dir,source,target:path.join(dir,'monitor-state'),backup:path.join(dir,'backup'),state,s1,s2,formal};
}

test('migration arguments require source, target and backup unless dry-run',async t=>{
 assert.throws(()=>parseMigrationArgs([]),/--source/);
 assert.throws(()=>parseMigrationArgs(['--source','x']),/--target/);
 assert.throws(()=>parseMigrationArgs(['--source','x','--target','y']),/--backup/);
 const o=parseMigrationArgs(['--source','x','--target','y','--dry-run']);
 assert.equal(o.dryRun,true);assert.equal(o.backup,null);assert.equal(o.prune,false);
});

test('dry-run validates references without writing target',async t=>{
 const f=await fixture(t),before=await sha(f.source);
 const r=await migrateMonitorHistory({source:f.source,target:f.target,backup:null,dryRun:true});
 assert.equal(r.views,2);assert.equal(r.snapshots,2);assert.equal(r.dryRun,true);
 await assert.rejects(stat(f.target),/ENOENT/);
 assert.equal(await sha(f.source),before);
});

test('migration preserves IDs, evidence and formal B snapshots without changing source',async t=>{
 const f=await fixture(t),before=await sha(f.source);
 const r=await migrateMonitorHistory({source:f.source,target:f.target,backup:f.backup});
 assert.equal(r.views,2);assert.equal(r.uniqueSnapshots,2);assert.equal(r.snapshots,3);assert.equal(await sha(f.source),before);
 const manifest=JSON.parse(await readFile(path.join(f.backup,'manifest.json'),'utf8'));
 assert.equal(manifest.sha256,before);assert.equal(manifest.arrays.views,3);
 const repo=createMonitorRepository(f.target);
 assert.deepEqual(await repo.getView('V1'),f.state.views[0].overview);
 assert.deepEqual((await repo.getSnapshot('S1')).evidence,[{evidenceId:'E1'}]);
 assert.deepEqual((await repo.getSnapshot('S2')).evaluation.daily.marker,'S2');
 await assert.rejects(repo.getSnapshot('FORMAL-S'),{code:'SNAPSHOT_NOT_FOUND'});
 await assert.rejects(repo.getView('FORMAL-VIEW'),{code:'VIEW_NOT_FOUND'});
 assert.equal((await readdir(path.join(f.target,'views'))).length,2);
 assert.equal((await readdir(path.join(f.target,'snapshots'))).length,2);
 assert.equal((await readdir(path.join(f.target,'inputs'))).length,2);
});

test('rerun is idempotent and interruption can resume',async t=>{
 const f=await fixture(t);
 await assert.rejects(migrateMonitorHistory({source:f.source,target:f.target,backup:f.backup,onView:async(id,n)=>{if(n===1)throw new Error('simulated interruption');}}),/simulated interruption/);
 const repo=createMonitorRepository(f.target);
 assert.ok(await repo.getView('V1'));await assert.rejects(repo.getView('V2'),{code:'VIEW_NOT_FOUND'});
 const r=await migrateMonitorHistory({source:f.source,target:f.target,backup:f.backup});
 assert.equal(r.views,2);assert.ok(await repo.getView('V2'));
 const before=await Promise.all((await readdir(path.join(f.target,'views'))).sort().map(n=>sha(path.join(f.target,'views',n))));
 await migrateMonitorHistory({source:f.source,target:f.target,backup:f.backup});
 const after=await Promise.all((await readdir(path.join(f.target,'views'))).sort().map(n=>sha(path.join(f.target,'views',n))));
 assert.deepEqual(after,before);
});

test('invalid references fail before writing target and leave source unchanged',async t=>{
 const f=await fixture(t),broken=structuredClone(f.state);
 broken.snapshots=broken.snapshots.filter(s=>s.snapshot_id!=='S2');await writeFile(f.source,JSON.stringify(broken));
 const before=await sha(f.source);
 await assert.rejects(migrateMonitorHistory({source:f.source,target:f.target,backup:f.backup}),/快照 S2 不存在/);
 assert.equal(await sha(f.source),before);
 await assert.rejects(stat(f.target),/ENOENT/);
});

test('prune removes only migrated import-monitor copies and keeps shared formal snapshots',async t=>{
 const f=await fixture(t);
 await migrateMonitorHistory({source:f.source,target:f.target,backup:f.backup});
 const r=await migrateMonitorHistory({source:f.source,target:f.target,backup:f.backup,prune:true});
 assert.equal(r.pruned,true);assert.equal(r.removedSnapshots,1);
 const state=JSON.parse(await readFile(f.source,'utf8'));
 assert.deepEqual(state.views.map(v=>v.view_id),['FORMAL-VIEW']);
 assert.deepEqual(state.snapshots.map(s=>s.snapshot_id).sort(),['FORMAL-S','S1']);
 assert.deepEqual(JSON.parse(await readFile(path.join(f.backup,'b-module','b-state.json'),'utf8')).views.map(v=>v.view_id).sort(),['FORMAL-VIEW','V1','V2']);
});
