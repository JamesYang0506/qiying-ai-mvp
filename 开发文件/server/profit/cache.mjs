export function createCalculationCache({maxEntries=64}={}){
 if(!Number.isInteger(maxEntries)||maxEntries<1)throw new Error('maxEntries 必须是正整数');
 const entries=new Map(),pending=new Map();
 async function getOrCompute(key,compute){
  if(typeof key!=='string'||!key)throw new Error('缓存键必须是非空字符串');
  if(entries.has(key)){
   const value=entries.get(key);entries.delete(key);entries.set(key,value);return value;
  }
  if(pending.has(key))return pending.get(key);
  const job=Promise.resolve().then(compute).then(value=>{
   entries.delete(key);entries.set(key,value);
   while(entries.size>maxEntries)entries.delete(entries.keys().next().value);
   return value;
  }).finally(()=>pending.delete(key));
  pending.set(key,job);
  return job;
 }
 return {getOrCompute,get size(){return entries.size;},clear(){entries.clear();pending.clear();}};
}
