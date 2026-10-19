import {fail} from '../orders/repository.mjs';

// Browsing is temporary, never an audit archive. Bound both memory and lifetime.
export function createLiveViews({clock=Date.now,maxEntries=16,maxBytes=64*1024*1024,ttlMs=30*60*1000}={}){
 const entries=new Map();let bytes=0;
 const remove=id=>{const entry=entries.get(id);if(entry){bytes-=entry.bytes;entries.delete(id);}};
 const prune=()=>{for(const [id,entry] of entries)if(clock()-entry.at>=ttlMs)remove(id);};
 return {
  put({overview,snapshots}){
   prune();
   const included=new Set(overview.scope.versionSet.map(r=>r.snapshotId));
   // Evidence needs today's facts, not the whole evaluation, contract or input dataset.
   const value={overview,snapshots:snapshots.filter(s=>included.has(s.snapshot_id)).map(s=>({snapshot_id:s.snapshot_id,revision_id:s.revision_id,baseline_mode:s.baseline_mode,as_of:s.as_of,known_at:s.known_at,evaluation:{daily:s.evaluation.daily},previous:s.previous,evidence:s.evidence}))};
   const serialized=JSON.stringify(value),size=Buffer.byteLength(serialized);
   if(size>maxBytes)throw fail('MONITOR_VIEW_TOO_LARGE','监测结果过大，请减少查询范围',413);
   remove(overview.viewId);
   while(entries.size>=maxEntries||bytes+size>maxBytes)remove(entries.keys().next().value);
   entries.set(overview.viewId,{at:clock(),bytes:size,serialized});bytes+=size;
  },
  get(id){prune();const entry=entries.get(id);if(!entry)throw fail('MONITOR_VIEW_EXPIRED','监测结果已过期或服务已重启，请刷新监测页面后重试',410);return JSON.parse(entry.serialized);}
 };
}
