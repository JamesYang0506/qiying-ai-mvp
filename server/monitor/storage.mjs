import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fail} from '../orders/repository.mjs';

// Each immutable view is published separately; reading a dashboard never rewrites history.
export function createMonitorRepository(directory){
 const read=async name=>{try{return JSON.parse(await readFile(path.join(directory,name),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw fail('STORAGE_INVALID','监测视图无法读取，请保留文件并检查备份',503);}};
 const viewName=id=>{if(!/^[a-f0-9-]{36}$/.test(id??''))throw fail('VIEW_NOT_FOUND','视图不存在',404);return 'view-'+id+'.json';};
 const publish=async(name,value)=>{await mkdir(directory,{recursive:true});const target=path.join(directory,name),tmp=target+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,JSON.stringify(value),{flag:'wx'});await rename(tmp,target);}catch(e){await unlink(tmp).catch(()=>{});throw e;}};
 return {
  async findCached(key){const index=await read('cache-'+key+'.json');return index?(await read(viewName(index.viewId)))?.overview??null:null;},
  async save(overview,snapshots,key){await publish(viewName(overview.viewId),{overview,snapshots});await publish('cache-'+key+'.json',{viewId:overview.viewId});},
  async getView(id){return (await read(viewName(id)))?.overview??null;},
  async getSnapshot(viewId,id){return (await read(viewName(viewId)))?.snapshots.find(s=>s.snapshot_id===id)??null;}
 };
}
