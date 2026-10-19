import {readFile,writeFile,mkdir,stat,copyFile,readdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createMonitorRepository} from '../server/monitor/storage.mjs';
import {hash as contentHash} from '../server/orders/repository.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const fail=(message,code='MIGRATION_INVALID')=>Object.assign(new Error(message),{code});
const digest=text=>createHash('sha256').update(text).digest('hex');

export function parseMigrationArgs(argv=process.argv.slice(2)){
 let source,target,backup,prune=false,dryRun=false;
 for(let i=0;i<argv.length;i++){
  const flag=argv[i],value=argv[i+1];
  if(flag==='--source'){if(!value)throw fail('--source 需要 b-state.json 路径');source=value;i++;}
  else if(flag==='--target'){if(!value)throw fail('--target 需要监测历史目录');target=value;i++;}
  else if(flag==='--backup'){if(!value)throw fail('--backup 需要备份目录');backup=value;i++;}
  else if(flag==='--prune')prune=true;
  else if(flag==='--dry-run')dryRun=true;
  else throw fail(`未知参数 ${flag}`);
 }
 if(!source)throw fail('必须提供 --source <b-state.json>');
 if(!target)throw fail('必须提供 --target <监测历史目录>');
 if(!backup&&!dryRun)throw fail('正式迁移必须先提供 --backup <备份目录>');
 return {source:path.resolve(source),target:path.resolve(target),backup:backup?path.resolve(backup):null,prune,dryRun};
}
async function writeJsonAtomic(file,value){
 await mkdir(path.dirname(file),{recursive:true});
 const temp=file+'.'+randomUUID()+'.tmp';
 await writeFile(temp,JSON.stringify(value,null,2)+'\n');
 await rename(temp,file);
}
async function readManifest(file){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}

async function backupSource({source,backup,sha256,bytes,state}){
 const manifestFile=path.join(backup,'manifest.json'),prior=await readManifest(manifestFile);
 if(prior){if(prior.sha256!==sha256||prior.bytes!==bytes)throw fail('备份目录已有不同的 b-state，请换一个空备份目录','MIGRATION_BACKUP_CONFLICT');return prior;}
 const target=path.join(backup,'b-module','b-state.json');
 await mkdir(path.dirname(target),{recursive:true});
 await copyFile(source,target);
 const imports=path.dirname(path.dirname(source)),targetImports=path.join(backup,'imports');
 await mkdir(targetImports,{recursive:true});
 for(const name of await readdir(imports))if(/^[a-f0-9]{64}\.json$/.test(name))await copyFile(path.join(imports,name),path.join(targetImports,name));
 const manifest={source,sha256,bytes,createdAt:new Date().toISOString(),arrays:{views:state.views?.length??0,snapshots:state.snapshots?.length??0,orders:state.orders?.length??0,baselines:state.baselines?.length??0},backup:target};
 await writeJsonAtomic(manifestFile,manifest);
 return manifest;
}

function planMigration(state){
 const views=(state.views??[]).filter(v=>v.kind==='import-monitor'),snapshots=new Map((state.snapshots??[]).map(s=>[s.snapshot_id,s])),plan=[];
 for(const view of views){
  const viewId=view.view_id,versionSet=view.overview?.scope?.versionSet;
  if(typeof viewId!=='string'||!viewId)throw fail('监测视图缺少 view_id');
  if(!Array.isArray(versionSet))throw fail(`视图 ${viewId} 缺少 scope.versionSet`);
  const ids=[...new Set(versionSet.map(x=>x?.snapshotId).filter(Boolean))],rows=[];
  if(!ids.length)throw fail(`视图 ${viewId} 没有关联快照`);
  for(const id of ids){
   const snapshot=snapshots.get(id);
   if(!snapshot)throw fail(`视图 ${viewId} 引用的快照 ${id} 不存在`);
   if(!snapshot.input_hash||!snapshot.inputs)throw fail(`快照 ${id} 缺少输入或摘要`);
   if(contentHash(snapshot.inputs)!==snapshot.input_hash)throw fail(`快照 ${id} 的输入摘要不一致`);
   if(!snapshot.evaluation||!('evidence'in snapshot))throw fail(`快照 ${id} 缺少核算或证据`);
   rows.push(snapshot);
  }
  plan.push({view,snapshots:rows});
 }
 return plan;
}

async function verifyTarget(repository,plan){
 let views=0,snapshots=0;
 for(const item of plan){
  const view=await repository.getView(item.view.view_id);
  if(contentHash(view)!==contentHash(item.view.overview))throw fail(`迁移后视图 ${item.view.view_id} 内容不一致`);
  for(const source of item.snapshots){
   const target=await repository.getSnapshot(source.snapshot_id),{inputs:sourceInputs,...sourceRest}=source,{inputs:targetInputs,...targetRest}=target;
   if(contentHash(sourceRest)!==contentHash(targetRest))throw fail(`迁移后快照 ${source.snapshot_id} 内容不一致`);
   if(contentHash(sourceInputs)!==contentHash(targetInputs))throw fail(`迁移后快照 ${source.snapshot_id} 输入不一致`);
   snapshots++;
  }
  views++;
 }
 return {views,snapshots};
}

export async function migrateMonitorHistory({source,target,backup,prune=false,dryRun=false,onView}={}){
 if(source===target)throw fail('--source 与 --target 不能相同');
 const sourceStat=await stat(source).catch(()=>null);
 if(!sourceStat?.isFile())throw fail(`源文件不存在：${source}`);
 const text=await readFile(source,'utf8'),sha256=digest(text),bytes=Buffer.byteLength(text);
 let state;try{state=JSON.parse(text);}catch{throw fail('源 b-state.json 不是有效 JSON');}
 if(state.version!==1)throw fail('不支持的数据版本');
 if(target.startsWith(path.dirname(source)+path.sep))throw fail('--target 不能写入 b-module 内部');
 const plan=planMigration(state),snapshotCount=new Set(plan.flatMap(item=>item.snapshots.map(s=>s.snapshot_id))).size;
 if(dryRun)return {dryRun:true,sha256,bytes,views:plan.length,snapshots:snapshotCount,pruned:false};
 const manifest=backup?await backupSource({source,backup,sha256,bytes,state}):null;
 const repository=createMonitorRepository(target),manifestFile=path.join(target,'migration-manifest.json'),started=await readManifest(manifestFile);
 if(started?.sha256&&started.sha256!==sha256)throw fail('目标目录已由另一份 b-state 迁移，请换目录或先核对');
 const progress={sha256,source,startedAt:started?.startedAt??new Date().toISOString(),updatedAt:new Date().toISOString(),totalViews:plan.length,completedViews:0,views:[],backup:manifest?.backup??null};
 let completed=0;
 for(const item of plan){
  await repository.saveView({overview:item.view.overview,snapshots:item.snapshots,recordedAt:item.view.recorded_at});
  completed++;
  progress.completedViews=completed;progress.updatedAt=new Date().toISOString();progress.views.push(item.view.view_id);
  await writeJsonAtomic(manifestFile,progress);
  if(onView)await onView(item.view.view_id,completed);
 }
 const verified=await verifyTarget(repository,plan);
 let pruned=false,removedSnapshots=0;
 if(prune){
  const formalViews=(state.views??[]).filter(v=>v.kind!=='import-monitor');
  const formalSnapshots=new Set(formalViews.flatMap(v=>v.overview?.scope?.versionSet?.map(x=>x.snapshotId)??[]));
  const migrated=new Set(plan.flatMap(item=>item.snapshots.map(s=>s.snapshot_id)));
  const removable=new Set([...migrated].filter(id=>!formalSnapshots.has(id)));
  state.views=(state.views??[]).filter(v=>v.kind!=='import-monitor');
  state.snapshots=(state.snapshots??[]).filter(s=>!removable.has(s.snapshot_id));
  const temp=source+'.'+randomUUID()+'.tmp';
  await writeFile(temp,JSON.stringify(state));
  await rename(temp,source);
  pruned=true;removedSnapshots=removable.size;
 }
 return {dryRun:false,sha256,bytes,views:verified.views,snapshots:verified.snapshots,uniqueSnapshots:snapshotCount,pruned,removedSnapshots,manifest};
}

async function main(argv=process.argv.slice(2)){
 const options=parseMigrationArgs(argv),result=await migrateMonitorHistory(options);
 console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(`监测历史迁移失败：${e.message}`);process.exitCode=1;});
