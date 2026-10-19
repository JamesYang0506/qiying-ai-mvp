import {randomUUID} from 'node:crypto';
import {D,money} from '../profit/decimal.mjs';
import {hash,fail,idempotent,latest} from './repository.mjs';
import {validate} from './validation.mjs';
import {date,timestamp,shift} from '../monitor/overview.mjs';

const id=()=>randomUUID();
const errorDetail=e=>({code:e.code??'CALCULATION_FAILED',message:e.message,details:(e.details??[]).map(d=>({field:d.field??'',message:d.message??d.reason??'字段无效'})),retryable:true});
const sameRevision=(current,expected)=>{if((current?.revision??0)!==expected)throw fail('VERSION_CONFLICT','资料已被修改，请刷新后重试',409);};
const orderAt=(s,orderId,knownAt)=>latest(s.orders.filter(x=>x.order_id===orderId),knownAt);
function requireOrder(s,orderId){const order=orderAt(s,orderId);if(!order)throw fail('ORDER_NOT_FOUND','订单不存在',404);return order;}
function reportRows(s,orderId,knownAt){const map=new Map();for(const r of s.reports)if(r.data.order_id===orderId&&Date.parse(r.recorded_at)<=Date.parse(knownAt))map.set(JSON.stringify([r.data.business_date,r.data.report_key]),r);return [...map.values()];}
const sources=s=>({orders:s.orders,baselines:s.baselines,reports:s.reports,pools:s.pools});
function fingerprint(s,ids,knownAt){return hash(ids.map(orderId=>({order:orderAt(s,orderId,knownAt),reports:reportRows(s,orderId,knownAt),baselines:s.baselines.filter(b=>b.order_id===orderId&&Date.parse(b.recorded_at)<=Date.parse(knownAt)),pools:s.pools.filter(p=>Date.parse(p.recorded_at)<=Date.parse(knownAt)&&p.definition.targets.some(t=>t.order_id===orderId))})));}
const jobPublic=j=>({job_id:j.job_id,status:j.status,snapshot_ids:j.snapshot_ids,error:j.error});
const batchPublic=b=>({batch_id:b.batch_id,job_id:b.job_id,status:b.status,accepted_count:b.accepted_count,snapshot_ids:b.snapshot_ids,issues:b.issues});
function enqueue(s,orderIds,start,end,now,batchId=null){
 date(start);date(end);if(start>end||Date.parse(end)-Date.parse(start)>365*86400000)throw fail('INVALID_REQUEST','单次重算范围不得超过 366 天');
 const j={job_id:id(),status:'queued',snapshot_ids:[],error:null,orderIds:[...new Set(orderIds)],start,end,known_at:now,batchId,inputs:structuredClone(sources(s))};j.fingerprint=fingerprint(s,j.orderIds,now);s.jobs.push(j);return j;
}
function scopeEqual(a,b){return hash(a)===hash(b);}
const mergeInputs=reports=>{
 const fields=['revenue_lines','materials','labor','manufacturing_allocations','expenses'],input={material_basis:'actual_net',material_scope_confirmed:reports.length>0,management_enabled:reports[0]?.data.actual_input.management_enabled??false,coverage_confirmed:reports.length>0,quality:'complete'};
 for(const f of fields)input[f]=[];
 for(const r of reports){const a=r.data.actual_input;if(a.material_basis!=='actual_net')throw fail('SCOPE_MISMATCH','实际日报材料必须使用 actual_net',409);if(a.management_enabled!==input.management_enabled)throw fail('SCOPE_MISMATCH','日报经营费用开关不一致',409);input.material_scope_confirmed&&=a.material_scope_confirmed;input.coverage_confirmed&&=a.coverage_confirmed;if(a.quality!=='complete')input.quality=a.quality;for(const f of fields)input[f].push(...a[f].map(x=>({...x,line_id:hash([r.record_id,r.revision,x.line_id]).slice(0,32)})));}
 const pools=new Map();for(const allocation of input.manufacturing_allocations){const prior=pools.get(allocation.pool_version_id);if(prior&&hash({...prior,line_id:''})!==hash({...allocation,line_id:''}))throw fail('ALLOCATION_INVALID','同费用池存在不一致的分摊记录',422);pools.set(allocation.pool_version_id,allocation);}input.manufacturing_allocations=[...pools.values()];
 return input;
};

export function createOrderService({repository,clock=Date.now,calculateOrder,allocateManufacturing,formulaVersion='A-CONTRACT-1',riskRule={rule_version:'RELATIVE-1',method:'relative_margin_decline',normal_max:'0.1',attention_max:'0.2',key_max:'0.3'}}){
 let worker=null;
 const now=()=>new Date(clock()).toISOString();
 const wake=()=>{if(!worker)worker=Promise.resolve().then(drain).finally(()=>{worker=null;repository.read().then(s=>{if(s.jobs.some(j=>j.status==='queued'))wake().catch(()=>{});}).catch(()=>{});});return worker;};
 async function write(key,operation,payload,action){const result=await repository.transact(s=>idempotent(s,key,operation,payload,()=>action(s,now())));wake().catch(()=>{});return result;}
 async function buildCalculation(s,orderId,day,basis,knownAt,snapshotId){
  const order=orderAt(s,orderId,knownAt),baselines=s.baselines.filter(b=>b.order_id===orderId&&Date.parse(b.recorded_at)<=Date.parse(knownAt)&&b.definition.effective_from<=day&&(!b.definition.effective_to||b.definition.effective_to>=day)),baseline=baselines.at(-1),start=basis==='daily'?day:order.planned_start;
  const reports=reportRows(s,orderId,knownAt).filter(r=>r.data.business_date>=start&&r.data.business_date<=day);
  if(reports.some(r=>r.data.quantity_unit!==order.quantity_unit))throw fail('SCOPE_MISMATCH','日报数量单位与订单不一致',409);
  const actual=mergeInputs(reports),quantity=reports.reduce((sum,r)=>sum.plus(r.data.completed_quantity),new D(0)).toString();
  const template=baseline?.definition.scope;
  const scope={basis,period_start:start,period_end:day,quantity_basis:'completed_good',quantity,quantity_unit:order.quantity_unit,currency:order.currency,tax_basis:template?.tax_basis??'unconfirmed',cost_scope_id:template?.cost_scope_id??'UNCONFIRMED',revenue_basis:template?.revenue_basis??'production_equivalent',settlement_state:order.status==='settled'?'settled':order.status==='completed'?'completed':'open'};
  // An absent day is unknown, including days between two received reports.
  const dates=new Set(reports.map(r=>r.data.business_date));for(let d=start;d<=day;d=shift(d,1))if(!dates.has(d)){actual.coverage_confirmed=false;actual.quality='incomplete';}
  let expected=null,expectedScope=null;
  if(baseline){const b=baseline.definition,stage=b.stage_inputs.find(x=>scopeEqual(x.scope,scope));if(stage){expected=stage.input;expectedScope=stage.scope;}else if(scopeEqual(b.scope,scope)){expected=b.input;expectedScope=b.scope;}}
  // Allocation belongs to a closed accounting scope, never charged again on each day.
  const latestPools=new Map();for(const p of s.pools)if(Date.parse(p.recorded_at)<=Date.parse(knownAt))latestPools.set(p.pool_id,p);
  actual.manufacturing_allocations=actual.manufacturing_allocations.filter(a=>{const p=s.pools.find(p=>p.pool_version_id===a.pool_version_id);if(!p)return true;const current=latestPools.get(p.pool_id);return current?.pool_version_id===a.pool_version_id&&current.definition.targets.some(t=>t.order_id===orderId);});
  for(const p of latestPools.values())if(p.definition.targets.some(t=>t.order_id===orderId)&&p.definition.period_start<=day&&p.definition.period_end>=start){
   if(p.definition.currency!==order.currency)throw fail('SCOPE_MISMATCH','费用池与订单币种不一致',409);
   // Never keep an obsolete version of this same logical pool.
   const oldVersions=new Set(s.pools.filter(x=>x.pool_id===p.pool_id).map(x=>x.pool_version_id));actual.manufacturing_allocations=actual.manufacturing_allocations.filter(a=>!oldVersions.has(a.pool_version_id));
   if(p.definition.period_start<start||p.definition.period_end>day){actual.coverage_confirmed=false;actual.quality='incomplete';continue;}
   if(!allocateManufacturing)throw fail('ALLOCATION_UNAVAILABLE','A 模块费用池分摊入口尚未连接',503);
   const allocation=await allocateManufacturing({pool_version_id:p.pool_version_id,...p.definition});validate('AllocationResult',allocation);
   const allocatedIds=allocation.allocations.map(a=>a.order_id),allocatedTotal=allocation.allocations.reduce((sum,a)=>sum.plus(a.amount),new D(allocation.unassigned_amount));
   if(allocation.pool_version_id!==p.pool_version_id||new Set(allocatedIds).size!==allocatedIds.length||allocatedIds.some(oid=>!p.definition.targets.some(t=>t.order_id===oid))||allocation.allocations.some(a=>new D(a.amount).lt(0))||!allocatedTotal.eq(p.definition.amount))throw fail('ALLOCATION_INVALID','A 返回的费用池分摊版本或金额不守恒',422);
   const amount=allocation.allocations.find(a=>a.order_id===orderId)?.amount;
   if(amount==null)throw fail('ALLOCATION_INVALID','费用池缺少订单分摊结果',422);
   actual.manufacturing_allocations.push({line_id:p.pool_version_id,pool_version_id:p.pool_version_id,period_start:p.definition.period_start,period_end:p.definition.period_end,amount,quality:allocation.quality,source_refs:p.definition.source_refs});
  }
  const input={snapshot_id:snapshotId,order_id:orderId,baseline_id:baseline?.baseline_id??null,input_hash:hash({order,baseline,reports,actual}),formula_version:formulaVersion,scope,expected_scope:expectedScope,expected,actual,risk_rule:riskRule};validate('CalculationRequest',input);return input;
 }
 async function drain(){
  for(;;){const job=await repository.transact(s=>{const j=s.jobs.find(j=>['queued','running'].includes(j.status));if(!j)return null;j.status='running';if(j.batchId)s.batches.find(b=>b.batch_id===j.batchId).status='recalculating';return j;});if(!job)return;
   try{
    if(!calculateOrder)throw fail('CALCULATOR_UNAVAILABLE','正式 A.calculate_order 尚未连接；已保存日报，可接入后请求重算。Excel 导入核算仍可使用。',503);
    const computed=[];for(const orderId of job.orderIds)for(let day=job.start;day<=job.end;day=shift(day,1))for(const basis of ['daily','cumulative']){
     if(day<orderAt(job.inputs,orderId,job.known_at).planned_start)continue;
     const snapshotId=id(),request=await buildCalculation(job.inputs,orderId,day,basis,job.known_at,snapshotId),result=await calculateOrder(request);validate('CalculationResult',result);
     if(result.snapshot_id!==snapshotId||result.order_id!==orderId||result.input_hash!==request.input_hash||result.baseline_id!==request.baseline_id||result.formula_version!==request.formula_version||!scopeEqual(result.scope,request.scope)||result.evidence.some(e=>e.snapshot_id!==snapshotId||e.order_id!==orderId))throw fail('SCOPE_MISMATCH','A 返回结果与请求版本或范围不一致',409);
     computed.push({snapshot_id:snapshotId,order_id:orderId,as_of:day,known_at:job.known_at,recorded_at:now(),fingerprint:job.fingerprint,input_order_fingerprint:fingerprint(job.inputs,[orderId],job.known_at),request,result});
    }
    await repository.transact(s=>{const j=s.jobs.find(x=>x.job_id===job.job_id),stale=fingerprint(s,job.orderIds,now())!==job.fingerprint;s.snapshots.push(...computed);j.snapshot_ids=computed.map(x=>x.snapshot_id);j.status=stale?'superseded':'completed';if(j.batchId){const b=s.batches.find(x=>x.batch_id===j.batchId);b.status=stale?'failed':'completed';b.snapshot_ids=j.snapshot_ids;if(stale)b.issues.push({code:'SUPERSEDED',message:'输入已有新修订，请查询新的重算任务',field:'',severity:'info',source_refs:[]});}});
   }catch(e){await repository.transact(s=>{const j=s.jobs.find(x=>x.job_id===job.job_id);j.status='failed';j.error=errorDetail(e);if(j.batchId){const b=s.batches.find(x=>x.batch_id===j.batchId);b.status='failed';b.issues=[{code:j.error.code,message:j.error.message,field:'',severity:'blocking',source_refs:[]}];}});}
  }
 }
 function queueOrder(s,orderId,at,start){const o=requireOrder(s,orderId);return enqueue(s,[orderId],start??o.planned_start,o.planned_end,at);}
 const api={
  drain:wake,
  createOrder(data,key){validate('OrderWrite',data);if(new D(data.quantity).lt(0)||data.planned_start>data.planned_end)throw fail('INVALID_INPUT','订单数量或日期范围无效',422);return write(key,'createOrder',data,(s,at)=>{sameRevision(null,data.expected_revision);if(s.orders.some(o=>o.order_number===data.order_number))throw fail('VERSION_CONFLICT','订单号已存在',409);const r={...data,order_id:id(),revision:1,recorded_at:at};s.orders.push(r);return r;});},
  updateOrder(orderId,data,key){validate('OrderWrite',data);if(new D(data.quantity).lt(0)||data.planned_start>data.planned_end)throw fail('INVALID_INPUT','订单数量或日期范围无效',422);return write(key,'updateOrder:'+orderId,data,(s,at)=>{sameRevision(requireOrder(s,orderId),data.expected_revision);const r={...data,order_id:orderId,revision:data.expected_revision+1,recorded_at:at};s.orders.push(r);queueOrder(s,orderId,at);return r;});},
  baseline(orderId,data,key){validate('BaselineWrite',data);if(data.effective_to&&data.effective_to<data.effective_from)throw fail('INVALID_INPUT','基线生效日期无效',422);return write(key,'baseline:'+orderId,data,(s,at)=>{requireOrder(s,orderId);sameRevision(latest(s.baselines.filter(b=>b.order_id===orderId)),data.expected_revision);const b={baseline_id:id(),order_id:orderId,revision:data.expected_revision+1,recorded_at:at,definition:data};s.baselines.push(b);queueOrder(s,orderId,at);return b;});},
  batch(data,key){validate('BatchWrite',data);return write(key,'batch',data,(s,at)=>{
   const proposed=[],errors=[],logical=new Set(),sourceKeys=new Set();
   data.reports.forEach((r,index)=>{try{requireOrder(s,r.order_id);if(new D(r.completed_quantity).lt(0))throw fail('INVALID_INPUT','完成量不能为负',422);const sourceKey=JSON.stringify([r.source_system,r.source_record_id]),logicalKey=JSON.stringify([r.order_id,r.business_date,r.report_key]);if(logical.has(logicalKey)||sourceKeys.has(sourceKey))throw fail('VERSION_CONFLICT','批次内日报或来源主键重复',409);logical.add(logicalKey);sourceKeys.add(sourceKey);
    const current=latest(s.reports.filter(x=>x.data.order_id===r.order_id&&x.data.business_date===r.business_date&&x.data.report_key===r.report_key)),bySource=latest(s.reports.filter(x=>x.data.source_system===r.source_system&&x.data.source_record_id===r.source_record_id));
    if(bySource&&JSON.stringify([bySource.data.order_id,bySource.data.business_date,bySource.data.report_key])!==logicalKey)throw fail('SOURCE_CONFLICT','来源主键已经用于另一份日报',409);
    const content=x=>{const {expected_revision,...rest}=x;return hash(rest);};
    if(current&&content(current.data)===content(r)){proposed.push({record:current,reused:true});return;}
    sameRevision(current,r.expected_revision);if(current&&(current.data.source_system!==r.source_system||current.data.source_record_id!==r.source_record_id))throw fail('SOURCE_CONFLICT','相同业务日报来自不同来源，需要人工核查',409);
    proposed.push({record:{record_id:current?.record_id??id(),revision:(current?.revision??0)+1,recorded_at:at,data:r},reused:false});
   }catch(e){errors.push({index,code:e.code,message:e.message,status:e.status});}});
   if(errors.length)throw fail(errors[0].code,'批次校验失败，全部未写入',errors[0].status,errors);
   const fresh=proposed.filter(p=>!p.reused);s.reports.push(...fresh.map(x=>x.record));const ids=[...new Set(data.reports.map(r=>r.order_id))],start=data.reports.reduce((a,r)=>a<r.business_date?a:r.business_date,data.reports[0].business_date),end=ids.reduce((a,oid)=>a>requireOrder(s,oid).planned_end?a:requireOrder(s,oid).planned_end,start),batchId=id(),job=enqueue(s,ids,start,end,at,batchId);
   const b={batch_id:batchId,job_id:job.job_id,status:'accepted',accepted_count:fresh.length,snapshot_ids:[],issues:[]};s.batches.push(b);return batchPublic(b);
  });},
  pool(data,key){validate('PoolWrite',data);const d=data.definition;if(d.period_start>d.period_end||new D(d.amount).lt(0)||!new D(d.total_hours).gt(0))throw fail('ALLOCATION_INVALID','费用池日期、金额或总工时无效',422);const seen=new Set();let hours=new D(0);for(const t of d.targets){if(seen.has(t.order_id)||new D(t.hours).lt(0))throw fail('ALLOCATION_INVALID','订单重复或工时为负',422);seen.add(t.order_id);hours=hours.plus(t.hours);}if(hours.gt(d.total_hours))throw fail('ALLOCATION_INVALID','订单工时合计超过费用池总工时',422);return write(key,'pool',data,(s,at)=>{const old=latest(s.pools.filter(p=>p.pool_id===data.pool_id));sameRevision(old,data.expected_revision);const ids=[...new Set([...d.targets,...(old?.definition.targets??[])].map(t=>t.order_id))];ids.forEach(oid=>requireOrder(s,oid));const p={...data,pool_version_id:id(),revision:data.expected_revision+1,recorded_at:at};s.pools.push(p);const start=old&&old.definition.period_start<d.period_start?old.definition.period_start:d.period_start,end=ids.reduce((a,oid)=>a>requireOrder(s,oid).planned_end?a:requireOrder(s,oid).planned_end,d.period_end),job=enqueue(s,ids,start,end,at);return {pool_id:p.pool_id,pool_version_id:p.pool_version_id,revision:p.revision,job_id:job.job_id,status:'accepted'};});},
  recalculate(orderId,data,key){validate('RecalculationWrite',data);return write(key,'recalculate:'+orderId,data,(s,at)=>{sameRevision(requireOrder(s,orderId),data.expected_order_revision);return jobPublic(enqueue(s,[orderId],data.period_start,data.period_end,at));});},
  async getJob(jobId){const s=await repository.read(),j=s.jobs.find(j=>j.job_id===jobId);if(!j)throw fail('JOB_NOT_FOUND','任务不存在',404);return jobPublic(j);},
  async getBatch(batchId){const s=await repository.read(),b=s.batches.find(b=>b.batch_id===batchId);if(!b)throw fail('BATCH_NOT_FOUND','批次不存在',404);return batchPublic(b);},
  async getSnapshot(orderId,snapshotId){const s=await repository.read(),r=s.snapshots.find(r=>r.snapshot_id===snapshotId&&r.order_id===orderId);if(!r)throw fail('SNAPSHOT_NOT_FOUND','订单快照不存在',404);return r.result;},
  async evidence(snapshotId){const s=await repository.read(),r=s.snapshots.find(r=>r.snapshot_id===snapshotId);if(!r)throw fail('SNAPSHOT_NOT_FOUND','快照不存在',404);return {snapshot_id:snapshotId,items:r.result.evidence??[]};},
  async reports(orderId,query){date(query.start);date(query.end);if(query.start>query.end)throw fail('INVALID_REQUEST','日期范围无效');const s=await repository.read();requireOrder(s,orderId);const knownAt=timestamp(query.known_at??cursorKnown(query.cursor)??now());return page(reportRows(s,orderId,knownAt).filter(r=>r.data.business_date>=query.start&&r.data.business_date<=query.end).sort((a,b)=>a.data.business_date.localeCompare(b.data.business_date)||a.record_id.localeCompare(b.record_id)),query,{type:'reports',orderId,start:query.start,end:query.end,knownAt});},
  async snapshots(orderId,query){date(query.as_of);const s=await repository.read();requireOrder(s,orderId);const cutoff=timestamp(query.known_at??cursorKnown(query.cursor)??now());return page(s.snapshots.filter(r=>r.request&&r.order_id===orderId&&r.as_of===query.as_of&&Date.parse(r.known_at)<=Date.parse(cutoff)).map(r=>({order_id:orderId,snapshot_id:r.snapshot_id,as_of:r.as_of})),query,{type:'snapshots',orderId,asOf:query.as_of,knownAt:cutoff});},
  createView(data,key){validate('ViewWrite',data);if(data.period_start>data.as_of||Date.parse(data.as_of)-Date.parse(data.period_start)>365*86400000)throw fail('INVALID_REQUEST','视图范围不得超过 366 天');return write(key,'view',data,(s,at)=>{
   const knownAt=timestamp(data.known_at??at);if(Date.parse(knownAt)>Date.parse(at))throw fail('INVALID_REQUEST','信息截止时间不能晚于当前时间');const f=data.filters,map=new Map();for(const o of s.orders)if(Date.parse(o.recorded_at)<=Date.parse(knownAt))map.set(o.order_id,o);
   const selected=[...map.values()].filter(o=>(!f.order_ids||f.order_ids.includes(o.order_id))&&(!f.customer_id||o.customer_id===f.customer_id)&&(!f.status||o.status===f.status)&&(!f.search||(o.order_number+' '+o.product_name).toLowerCase().includes(f.search.toLowerCase())));
   const ref={view_id:id(),as_of:data.as_of,period_start:data.period_start,known_at:knownAt,snapshot_refs:[],pending_order_ids:[]},results=[],items=[];
   for(const o of selected){for(let day=data.period_start;day<=data.as_of;day=shift(day,1))for(const basis of ['daily','cumulative']){const candidates=s.snapshots.filter(x=>x.request&&x.order_id===o.order_id&&x.as_of===day&&x.result.scope.basis===basis&&Date.parse(x.known_at)<=Date.parse(knownAt));const snap=candidates.at(-1);if(snap){results.push(snap);ref.snapshot_refs.push({order_id:o.order_id,snapshot_id:snap.snapshot_id,as_of:day});}}
    const snap=results.filter(x=>x.order_id===o.order_id&&x.as_of===data.as_of&&x.result.scope.basis==='cumulative').at(-1),current=fingerprint(s,[o.order_id],knownAt);
    // Compare the per-order frozen input set rather than a multi-order job fingerprint.
    const stale=snap&&snap.input_order_fingerprint!==current;
    if(f.risk_level&&snap?.result.comparison.risk.level!==f.risk_level)continue;
    const groupId=snap?groupKey(snap.result.scope):hash({currency:o.currency,unknown:true}).slice(0,24);
    const risk=snap?.result.comparison.risk??{level:'not_applicable',rule_version:'B-1',reason:'核算尚未完成',loss:false};
    const dailyAt=day=>s.snapshots.filter(x=>x.request&&x.order_id===o.order_id&&x.as_of===day&&x.result.scope.basis==='daily'&&Date.parse(x.known_at)<=Date.parse(knownAt)&&x.input_order_fingerprint===current).at(-1)?.result;
    const today=dailyAt(data.as_of),previous=dailyAt(shift(data.as_of,-1)),dailyComparable=today&&previous&&groupKey(today.scope)===groupKey(previous.scope)&&[today,previous].every(r=>r.actual.gross_margin!=null&&r.actual.total_production_cost!=null&&r.actual.revenue!=null&&new D(r.actual.revenue).gt(0)&&new D(r.scope.quantity).gt(0));
    items.push({order_id:o.order_id,order_number:o.order_number,snapshot_id:snap?.snapshot_id??null,group_id:groupId,status:snap?stale?'stale':'ready':s.jobs.some(j=>j.orderIds.includes(o.order_id)&&['queued','running'].includes(j.status))?'pending':'unavailable',gross_profit:snap?.result.actual.gross_profit??null,gross_margin:snap?.result.actual.gross_margin??null,profit_delta:snap?.result.comparison.profit_delta??null,yesterday_margin_delta:dailyComparable?new D(today.actual.gross_margin).minus(previous.actual.gross_margin).toFixed(6):null,risk});if(!snap||stale)ref.pending_order_ids.push(o.order_id);
   }
   const kept=new Set(items.map(i=>i.order_id));ref.snapshot_refs=ref.snapshot_refs.filter(r=>kept.has(r.order_id));const view={...ref,kind:'formal',items,results:results.filter(r=>kept.has(r.order_id)),orders:selected.filter(o=>kept.has(o.order_id))};s.views.push(view);return viewRef(view);
  });},
  async portfolio(viewId,query={}){const v=await formalView(viewId),items=[...v.items],sort=query.sort??'risk';if(!['risk','profit_delta','order_id'].includes(sort))throw fail('INVALID_REQUEST','排序无效');const rank={severe:0,key:1,attention:2,normal:3,better:4,not_applicable:5};items.sort((a,b)=>(sort==='risk'?rank[a.risk.level]-rank[b.risk.level]:sort==='profit_delta'?(a.profit_delta==null?b.profit_delta==null?0:1:b.profit_delta==null?-1:new D(a.profit_delta).cmp(b.profit_delta)):0)||a.order_id.localeCompare(b.order_id));return {view:viewRef(v),groups:groupSummaries(v),...page(items,query,{type:'portfolio',viewId,sort})};},
  async trend(viewId,query={}){const v=await formalView(viewId),mode=query.mode??'cumulative',start=query.start??v.period_start,end=query.end??v.as_of;date(start);date(end);if(!['daily','cumulative'].includes(mode)||start<v.period_start||end>v.as_of||start>end)throw fail('INVALID_REQUEST','趋势范围或模式无效');const groups=[];for(const group of groupSummaries(v)){const ids=v.items.filter(i=>i.group_id===group.group_id).map(i=>i.order_id),readyIds=new Set(v.items.filter(i=>i.status==='ready').map(i=>i.order_id)),points=[];for(let day=start;day<=end;day=shift(day,1)){const rows=ids.map(oid=>v.results.filter(r=>r.order_id===oid&&r.as_of===day&&r.result.scope.basis===mode&&groupKey(r.result.scope)===group.group_id).at(-1)).filter(Boolean),included=rows.filter(r=>readyIds.has(r.order_id)&&r.result.comparison.comparable&&r.result.actual.gross_profit!=null&&r.result.expected.gross_profit!=null);points.push({date:day,actual_profit:total(included,r=>r.result.actual.gross_profit),expected_profit:total(included,r=>r.result.expected.gross_profit),profit_delta:total(included,r=>r.result.comparison.profit_delta),included_count:included.length,excluded_count:ids.length-included.length,missing_daily_count:ids.length-rows.length});}groups.push({group_id:group.group_id,currency:group.currency,points});}return {view_id:viewId,mode,groups};}
 };
 async function formalView(viewId){const s=await repository.read(),v=s.views.find(v=>v.view_id===viewId&&v.kind==='formal');if(!v)throw fail('VIEW_NOT_FOUND','固定视图不存在',404);return v;}
 return api;
}
function viewRef(v){return Object.fromEntries(['view_id','as_of','period_start','known_at','snapshot_refs','pending_order_ids'].map(k=>[k,v[k]]));}
const groupKey=scope=>hash(Object.fromEntries(['currency','tax_basis','cost_scope_id','revenue_basis','quantity_basis','settlement_state'].map(k=>[k,scope[k]]))).slice(0,24);
const total=(rows,fn)=>rows.length?money(rows.reduce((s,r)=>s.plus(fn(r)),new D(0))):null;
function groupSummaries(v){return [...new Set(v.items.map(i=>i.group_id))].map(groupId=>{const items=v.items.filter(i=>i.group_id===groupId),rows=items.filter(i=>i.status==='ready').map(i=>v.results.find(r=>r.snapshot_id===i.snapshot_id)).filter(Boolean),known=rows.filter(r=>r.result.actual.gross_profit!=null&&r.result.actual.revenue!=null),comparable=known.filter(r=>r.result.comparison.comparable&&r.result.expected.gross_profit!=null),revenue=total(known,r=>r.result.actual.revenue);return {group_id:groupId,currency:rows[0]?.result.scope.currency??v.orders.find(o=>o.order_id===items[0].order_id).currency,scope_label:rows[0]?`${rows[0].result.scope.revenue_basis} / ${rows[0].result.scope.tax_basis} / ${rows[0].result.scope.cost_scope_id}`:'口径待核算',order_count:items.length,known_count:known.length,comparable_count:comparable.length,excluded_count:items.length-comparable.length,revenue,actual_profit:total(known,r=>r.result.actual.gross_profit),gross_margin:revenue!=null&&new D(revenue).gt(0)?new D(total(known,r=>r.result.actual.gross_profit)).div(revenue).toFixed(6):null,comparable_actual_profit:total(comparable,r=>r.result.actual.gross_profit),expected_profit:total(comparable,r=>r.result.expected.gross_profit),profit_delta:total(comparable,r=>r.result.comparison.profit_delta),exclusions:items.filter(i=>!comparable.some(r=>r.order_id===i.order_id)).map(i=>({order_id:i.order_id,reason:i.status==='ready'?'资料不完整或口径不可比':i.status}))};});}
function cursorKnown(cursor){if(!cursor)return null;try{return JSON.parse(Buffer.from(cursor,'base64url').toString()).knownAt;}catch{throw fail('SCOPE_MISMATCH','分页游标无效',409);}}
function page(items,query,binding){const size=Number(query.page_size??50);if(!Number.isInteger(size)||size<1||size>100)throw fail('INVALID_REQUEST','page_size 必须为 1–100');const signature=hash({...binding,size});let offset=0;if(query.cursor){try{const c=JSON.parse(Buffer.from(query.cursor,'base64url').toString());if(c.signature!==signature||!Number.isInteger(c.offset)||c.offset<0)throw new Error();offset=c.offset;}catch{throw fail('SCOPE_MISMATCH','分页游标与视图、筛选、排序或页大小不一致',409);}}return {items:items.slice(offset,offset+size),next_cursor:offset+size<items.length?Buffer.from(JSON.stringify({signature,offset:offset+size,knownAt:binding.knownAt})).toString('base64url'):null};}
