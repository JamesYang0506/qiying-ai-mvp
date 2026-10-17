import {mkdir,readFile,open,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';

export const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
export const fail=(code,message,status=400,details=[])=>Object.assign(new Error(message),{code,status,details});
const empty=()=>({version:1,orders:[],baselines:[],reports:[],pools:[],batches:[],jobs:[],snapshots:[],views:[],idempotency:{}});
// One process owns this store. A transaction publishes one fsynced, renamed file.
// The lock also serializes independent repository instances in that process.
const queues=new Map();
export function createRepository(directory){
 const file=path.resolve(directory,'b-state.json');
 const read=async()=>{try{const state=JSON.parse(await readFile(file,'utf8'));if(state.version!==1)throw new Error('不支持的数据版本');return state;}catch(e){if(e.code==='ENOENT')return empty();throw fail('STORAGE_INVALID','B 模块数据无法读取，请保留文件并从备份恢复',503);}};
 const transact=fn=>{const job=(queues.get(file)??Promise.resolve()).then(async()=>{const state=await read(),before=JSON.stringify(state),result=await fn(state),serialized=JSON.stringify(state);if(before===serialized)return structuredClone(result);await mkdir(directory,{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';let fd;try{fd=await open(temp,'wx');await fd.writeFile(serialized);await fd.sync();await fd.close();fd=null;await rename(temp,file);}catch(e){await fd?.close();await unlink(temp).catch(()=>{});throw e;}return structuredClone(result);});queues.set(file,job.catch(()=>{}));return job;};
 const snapshot=async()=>{await(queues.get(file)??Promise.resolve());return read();};
 return {read:snapshot,transact};
}
export function idempotent(state,key,operation,payload,action){
 if(typeof key!=='string'||!key.length||key.length>128)throw fail('INVALID_REQUEST','需要 1–128 字符的 Idempotency-Key');
 const fingerprint=hash({operation,payload}),prior=Object.hasOwn(state.idempotency,key)?state.idempotency[key]:null;
 if(prior){if(prior.fingerprint!==fingerprint)throw fail('IDEMPOTENCY_CONFLICT','同一幂等键的请求内容不同',409);return structuredClone(prior.result);}
 const result=action();Object.defineProperty(state.idempotency,key,{value:{fingerprint,result:structuredClone(result)},enumerable:true,writable:true,configurable:true});return result;
}
export const latest=(rows,knownAt)=>rows.filter(r=>!knownAt||Date.parse(r.recorded_at)<=Date.parse(knownAt)).at(-1);
