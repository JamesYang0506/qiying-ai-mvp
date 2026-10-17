import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createMonitorRepository} from '../../server/monitor/storage.mjs';
import {hash} from '../../server/orders/repository.mjs';
import {compressMonitorHistory} from '../../scripts/compress-monitor-history.mjs';

test('compression is lossless, resumable and leaves unrelated files untouched',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'qiying-compress-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const original=Buffer.from(JSON.stringify({evidence:'test '.repeat(2000)}));
 for(const folder of ['inputs','snapshots','views']){await mkdir(path.join(dir,folder));await writeFile(path.join(dir,folder,'example.json'),original);}
 await writeFile(path.join(dir,'orders.json'),'unchanged');
 const dry=await compressMonitorHistory({directory:dir});assert.equal(dry.files,3);assert.ok(dry.savedBytes>0);
 assert.deepEqual(await readFile(path.join(dir,'views/example.json')),original);
 // A verified gzip from an interrupted run must also be reusable.
 await writeFile(path.join(dir,'views/example.json.gz'),gzipSync(original));
 const applied=await compressMonitorHistory({directory:dir,apply:true});assert.equal(applied.files,3);
 for(const folder of ['inputs','snapshots','views']){
  const files=await readdir(path.join(dir,folder));assert.deepEqual(files,['example.json.gz']);
  assert.deepEqual(gunzipSync(await readFile(path.join(dir,folder,files[0]))),original);
 }
 assert.equal((await compressMonitorHistory({directory:dir,apply:true})).files,0);
 assert.equal(await readFile(path.join(dir,'orders.json'),'utf8'),'unchanged');
});

test('compression refuses to remove an original when an existing gzip differs',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'qiying-compress-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 for(const folder of ['inputs','snapshots','views'])await mkdir(path.join(dir,folder));
 const original='{"keep":true}',file=path.join(dir,'inputs/example.json');await writeFile(file,original);
 await writeFile(file+'.gz',gzipSync('{"keep":false}'));
 await assert.rejects(compressMonitorHistory({directory:dir,apply:true}),/压缩校验失败/);
 assert.equal(await readFile(file,'utf8'),original);
});

test('compressed archives preserve views, snapshot inputs and immutable archive semantics',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'qiying-compressed-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const inputs={order:{id:'ORDER-1'}},inputHash=hash(inputs);
 const snapshot={snapshot_id:'snapshot-1',input_hash:inputHash,evaluation:{daily:{}},evidence:[]};
 const overview={viewId:'view-1',scope:{versionSet:[{snapshotId:'snapshot-1'}]}};
 for(const [folder,name,value] of [['inputs',inputHash,{hash:inputHash,dataset:inputs}],['snapshots','snapshot-1',{...snapshot,inputRef:inputHash}],['views','view-1',{kind:'import-monitor',view_id:'view-1',overview}]]){
  await mkdir(path.join(dir,folder));await writeFile(path.join(dir,folder,name+'.json.gz'),gzipSync(JSON.stringify(value)));
 }
 const repository=createMonitorRepository(dir);
 assert.deepEqual(await repository.getView('view-1'),overview);
 assert.deepEqual((await repository.getSnapshot('snapshot-1')).inputs,inputs);
 await repository.saveView({overview,snapshots:[{...snapshot,inputs}]});
 await repository.saveView({overview,snapshots:[]});
 for(const folder of ['inputs','snapshots','views'])assert.ok((await readdir(path.join(dir,folder))).every(n=>n.endsWith('.gz')));
 await assert.rejects(repository.saveView({overview:{...overview,changed:true},snapshots:[]}),{code:'VIEW_IMMUTABLE'});
 const file=path.join(dir,'views/view-1.json.gz'),original=await readFile(file);await writeFile(file,original.subarray(0,15));
 await assert.rejects(repository.getView('view-1'),{code:'STORAGE_INVALID'});
 await assert.rejects(repository.getView('absent'),{code:'VIEW_NOT_FOUND'});
});
