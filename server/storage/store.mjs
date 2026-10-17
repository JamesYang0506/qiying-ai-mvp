import {mkdir,readdir,readFile,writeFile,rename,unlink,stat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';import path from 'node:path';
export function stable(v){if(Array.isArray(v)){const a=v.map(stable);return a.every(x=>x&&typeof x==='object'&&'id'in x)?a.sort((x,y)=>String(x.id).localeCompare(String(y.id))):a;}if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).filter(k=>!['source','sourceFiles'].includes(k)).sort().map(k=>[k,stable(v[k])]));return v;}
export const digest=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const conflict=message=>Object.assign(new Error(message),{status:409});
const fileName=(id,revision)=>createHash('sha256').update(id+'\0'+revision).digest('hex')+'.json';
export function createStore(directory){
 let queue=Promise.resolve();
 const entries=new Map();
 async function load(name){
  const file=path.join(directory,name);
  let info;try{info=await stat(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}
  const prior=entries.get(name);
  if(prior&&prior.mtimeMs===info.mtimeMs&&prior.size===info.size)return prior.record;
  let record;try{record=JSON.parse(await readFile(file,'utf8'));}catch{throw new Error('本地导入数据损坏，请从备份恢复');}
  if(!record.dataset?.order?.id||!record.dataset?.revision?.id)throw new Error('本地导入版本无效');
  entries.set(name,{mtimeMs:info.mtimeMs,size:info.size,record});
  return record;
 }
 async function refresh(){
  await mkdir(directory,{recursive:true});
  const names=(await readdir(directory)).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)),seen=new Set(names),records=[];
  for(const name of names){const record=await load(name);if(record)records.push(record);}
  for(const name of [...entries.keys()])if(!seen.has(name))entries.delete(name);
  return records.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 }
 const readVersion=async(id,revision)=>{
  if(revision){const record=await load(fileName(id,revision));if(!record||record.dataset.order.id!==id||record.dataset.revision.id!==revision)throw Object.assign(new Error('未找到订单或数据版本'),{status:404});return record.dataset;}
  const versions=(await refresh()).filter(x=>x.dataset.order.id===id);
  if(!versions.length)throw Object.assign(new Error('未找到订单或数据版本'),{status:404});
  return versions.at(-1).dataset;
 };
 const listRevisions=async id=>(await refresh()).filter(x=>x.dataset.order.id===id).reverse().map(x=>({revisionId:x.dataset.revision.id,baselineId:x.dataset.baseline.id,createdAt:x.createdAt,hash:x.hash}));
 const get=readVersion;
 const listOrders=async()=>{const latest=new Map();for(const v of await refresh()){const d=v.dataset;latest.set(d.order.id,{...d.order,revisionId:d.revision.id,baselineId:d.baseline.id,createdAt:v.createdAt,counts:{production:d.production.length,supplements:d.supplements.length,materials:d.materials.length,expenses:d.expenses.length}});}return [...latest.values()];};
 const commit=dataset=>{const job=queue.then(async()=>{
  const all=await refresh(),hash=digest(dataset),baseHash=digest(dataset.baseline),same=all.find(v=>v.dataset.order.id===dataset.order.id&&v.dataset.revision.id===dataset.revision.id);
  if(same){if(same.hash!==hash)throw conflict('同一修订号内容已改变，请使用新修订版本');return {orderId:dataset.order.id,revisionId:dataset.revision.id,reused:true};}
  for(const v of all.filter(v=>v.dataset.order.id===dataset.order.id)){
   if(v.dataset.order.lineId!==dataset.order.lineId)throw conflict('首版同订单只支持一个核算子项，请使用独立订单标识');
   if(v.dataset.baseline.id===dataset.baseline.id&&(digest(v.dataset.baseline)!==baseHash||['quantity','price','weight'].some(k=>v.dataset.order[k]!==dataset.order[k])))throw conflict('冻结基线内容已改变，请使用新基线版本');
  }
  const name=fileName(dataset.order.id,dataset.revision.id),target=path.join(directory,name),tmp=path.join(directory,name+'.'+randomUUID()+'.tmp');
  const timestamp=Math.max(Date.now(),all.length?Date.parse(all.at(-1).createdAt)+1:0),createdAt=new Date(timestamp).toISOString();
  try{await writeFile(tmp,JSON.stringify({hash,createdAt,dataset}),{flag:'wx'});await rename(tmp,target);}catch(e){await unlink(tmp).catch(()=>{});throw e;}
  const info=await stat(target);entries.set(name,{mtimeMs:info.mtimeMs,size:info.size,record:{hash,createdAt,dataset}});
  return {orderId:dataset.order.id,revisionId:dataset.revision.id,reused:false};
 });queue=job.catch(()=>{});return job;};
 return {listOrders,listRevisions,get,commit,listVersions:refresh};
}
