import {mkdir,readFile,open,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {hash,fail} from '../orders/repository.mjs';

const idPattern=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const digestPattern=/^[a-f0-9]{64}$/;
const missing=(code,message,status=404)=>fail(code,message,status);
const queues=new Map();
const id=(value,label='ID')=>{if(typeof value!=='string'||!idPattern.test(value))throw missing('INVALID_REQUEST',`${label}无效`,400);return value;};
const queue=directory=>path.resolve(directory);
const settle=key=>queues.get(key)??Promise.resolve();
function enqueue(directory,job){
 const key=queue(directory),prior=settle(key),next=prior.then(job,job);
 queues.set(key,next.catch(()=>{}));return next;
}
async function readJson(file,code,message,status=404){
 try{return JSON.parse(await readFile(file,'utf8'));}
 catch(e){if(e.code==='ENOENT')throw missing(code,message,status);throw missing('STORAGE_INVALID','监测历史文件损坏，请从备份恢复',503);}
}
async function atomicWrite(file,text){
 await mkdir(path.dirname(file),{recursive:true});
 const temp=file+'.'+randomUUID()+'.tmp';let handle;
 try{handle=await open(temp,'wx');await handle.writeFile(text);await handle.sync();await handle.close();handle=null;await rename(temp,file);}
 catch(e){await handle?.close();await unlink(temp).catch(()=>{});throw e;}
}
async function exists(file){try{await readFile(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
const identity=value=>{const {recorded_at,...rest}=value??{};return rest;};
async function immutable(file,value,label,code){
 let existing;
 try{existing=JSON.parse(await readFile(file,'utf8'));}
 catch(e){
  if(e.code==='ENOENT'){await atomicWrite(file,JSON.stringify(value));return;}
  throw missing('STORAGE_INVALID','监测历史文件损坏，请从备份恢复',503);
 }
 if(hash(identity(existing))!==hash(identity(value)))throw missing(code,`${label}已存在且内容不可变`,409);
}

export function createMonitorRepository(directory){
 const root=path.resolve(directory),views=path.join(root,'views'),snapshots=path.join(root,'snapshots'),inputs=path.join(root,'inputs');
 const viewFile=viewId=>path.join(views,id(viewId,'视图 ID')+'.json');
 const snapshotFile=snapshotId=>path.join(snapshots,id(snapshotId,'快照 ID')+'.json');
 const inputFile=inputHash=>{if(!digestPattern.test(inputHash??''))throw missing('INVALID_REQUEST','输入摘要无效',400);return path.join(inputs,inputHash+'.json');};

 async function saveInput(inputHash,dataset){
  if(hash(dataset)!==inputHash)throw missing('STORAGE_INVALID','快照输入摘要与内容不一致',503);
  const file=inputFile(inputHash),record={hash:inputHash,dataset};
  try{const existing=JSON.parse(await readFile(file,'utf8'));if(hash(existing.dataset)!==inputHash)throw missing('STORAGE_INVALID','共享输入文件损坏',503);return;}
  catch(e){if(e.code!=='ENOENT')throw e;}
  await atomicWrite(file,JSON.stringify(record));
 }

 async function saveView({overview,snapshots:incoming=[],recordedAt}={}){
  return enqueue(root,async()=>{
   const viewId=id(overview?.viewId,'视图 ID');
   if(!Array.isArray(incoming))throw missing('INVALID_REQUEST','快照集合无效',400);
   if(!Array.isArray(overview?.scope?.versionSet))throw missing('INVALID_REQUEST','固定监测视图缺少版本集合',400);
   for(const snapshot of incoming){
    const snapshotId=id(snapshot?.snapshot_id,'快照 ID');
    if(!snapshot.input_hash)throw missing('INVALID_REQUEST',`快照 ${snapshotId} 缺少输入摘要`,400);
    if(snapshot.inputs){
     const inputHash=hash(snapshot.inputs);
     if(inputHash!==snapshot.input_hash)throw missing('STORAGE_INVALID','快照输入摘要与内容不一致',503);
     await saveInput(inputHash,snapshot.inputs);
     const {inputs:ignored,...record}=snapshot;
     await immutable(snapshotFile(snapshotId),{...record,inputRef:inputHash},`快照 ${snapshotId}`,'SNAPSHOT_IMMUTABLE');
    }else if(!(await exists(snapshotFile(snapshotId)))){
     throw missing('STORAGE_INVALID',`快照 ${snapshotId} 尚未保存`,503);
    }
   }
   for(const entry of overview.scope.versionSet){
    const snapshotId=id(entry?.snapshotId,'快照 ID');
    if(!(await exists(snapshotFile(snapshotId))))throw missing('STORAGE_INVALID',`视图引用的快照 ${snapshotId} 不存在`,503);
   }
   const record={view_id:viewId,kind:'import-monitor',overview,recorded_at:recordedAt??new Date().toISOString()};
   await immutable(viewFile(viewId),record,`视图 ${viewId}`,'VIEW_IMMUTABLE');
   return overview;
  });
 }

 async function getView(viewId){
  await settle(queue(root));
  const record=await readJson(viewFile(viewId),'VIEW_NOT_FOUND','未找到固定监测视图');
  if(record.kind!=='import-monitor'||!record.overview)throw missing('STORAGE_INVALID','监测视图文件无效',503);
  return record.overview;
 }

 async function getSnapshot(snapshotId){
  await settle(queue(root));
  const record=await readJson(snapshotFile(snapshotId),'SNAPSHOT_NOT_FOUND','未找到固定监测快照');
  if(!record.inputRef)throw missing('STORAGE_INVALID','快照缺少共享输入引用',503);
  const input=await readJson(inputFile(record.inputRef),'STORAGE_INVALID','快照输入文件不存在',503);
  if(!input?.dataset||hash(input.dataset)!==record.inputRef)throw missing('STORAGE_INVALID','快照输入文件损坏',503);
  const {inputRef,...snapshot}=record;
  return {...snapshot,inputs:input.dataset};
 }

 return {saveView,getView,getSnapshot};
}
