import {randomUUID} from 'node:crypto';
import {D,money} from '../profit/decimal.mjs';
import {evaluate} from '../profit/evaluate.mjs';
import {calculateSeries,createDailyEvaluator} from '../profit/series.mjs';
import {toCalculationResult} from '../profit/contract-adapter.mjs';
import {hash,fail} from '../orders/repository.mjs';
import {recommendations} from './recommendations.mjs';
import {classifyMonitorRisk} from '../profit/monitor-risk.mjs';
import {createLiveViews} from './live-views.mjs';

export function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value??'')||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw fail('INVALID_REQUEST','业务日期无效');return value;}
export const shift=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function timestamp(v){if(typeof v!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))throw fail('INVALID_REQUEST','信息截止时间需要包含时区');return new Date(v).toISOString();}
const sum=(rows,fn)=>rows.length?money(rows.reduce((s,r)=>s.plus(fn(r)),new D(0))):null;
export const distributionKey=day=>{const margin=day?.actual.gross!=null&&day?.revenue!=null&&new D(day.revenue).gt(0)?new D(day.actual.gross).div(day.revenue):day?.actual.margin;return margin==null?'unknown':new D(margin).gte('.3')?'high':new D(margin).gte('.1')?'medium':new D(margin).gte(0)?'low':'negative';};

// Freeze information visibility before invoking A. A still exclusively owns profit formulas.
// Records not yet known remain unavailable; known late records become usable for their business day.
function atKnown(dataset,cutoff){const d=structuredClone(dataset);for(const key of ['production','materials','expenses','supplements'])for(const r of d[key])r.availableAt=r.availableAt&&Date.parse(r.availableAt)<=Date.parse(cutoff)?r.date+'T00:00:00+08:00':'9999-12-31T23:59:59+08:00';return d;}
function compare(dataset,today,previous,asOf){
 const reasons=[];
 if(!today||!previous)reasons.push('缺少当日或昨日明确报工');
 for(const d of [previous,today])if(d){if(d.revenue==null||!new D(d.revenue).gt(0))reasons.push(`${d.date} 收入为零或未知`);if(d.actual.productionCost==null||d.actual.margin==null)reasons.push(`${d.date} 生产成本或毛利率不完整`);if(!(d.quantity>0))reasons.push(`${d.date} 合格量为零或未知`);}
 const affected=[...dataset.production,...dataset.materials,...dataset.expenses,...dataset.supplements].filter(r=>[asOf,shift(asOf,-1)].includes(r.date));
 if(affected.some(r=>r.availableAt&&Date.parse(r.availableAt)>Date.parse(r.date+'T23:59:59.999+08:00')))reasons.push('存在迟录资料，资料更新待核查');
 // Import revisions replace the whole period; their field-level revision history is unavailable.
 if(dataset._revisionCount>1)reasons.push('整套导入修订发生变化，无法可靠区分经营变化与资料修订');
 if(reasons.length)return {status:'unavailable',reasons:[...new Set(reasons)],marginChangePp:null,unitCost:null,previousUnitCost:null,unitCostChange:null,deteriorated:false};
 const change=new D(today.actual.gross).div(today.revenue).minus(new D(previous.actual.gross).div(previous.revenue)).times(100),now=new D(today.actual.productionCost).div(today.quantity),before=new D(previous.actual.productionCost).div(previous.quantity);
 return {status:'comparable',reasons:[],marginChangePp:change.toString(),unitCost:now.toFixed(6),previousUnitCost:before.toFixed(6),unitCostChange:now.minus(before).toFixed(6),deteriorated:change.lt(0)};
}

export async function buildOverview(entries,{asOf,period=7,baselineMode='ideal',knownAt,visibilityCutoff,viewId=randomUUID(),compute=evaluate,cache=null,customer='',status='',risk='',search=''}={}){
 date(asOf);knownAt=timestamp(knownAt??new Date().toISOString());const cutoff=timestamp(visibilityCutoff??knownAt);
 if(!['ideal','budget'].includes(baselineMode)||!Number.isInteger(period)||period<1||period>90)throw fail('INVALID_REQUEST','理论模式或趋势窗口无效（1–90 天）');
 const requestedStart=shift(asOf,1-period),firstStart=entries.map(e=>e.dataset.order.start).sort()[0],start=firstStart&&firstStart<=asOf&&firstStart>requestedStart?firstStart:requestedStart,seriesStart=shift(start,-1),snapshots=[],orders=[];

 for(const entry of entries){
  const dataset=entry.dataset,visible=atKnown(dataset,cutoff),evaluation=compute(visible,{asOf,baselineMode}),snapshotId=randomUUID();
  const previousDay=shift(asOf,-1),previousKnown=evaluation.daySummaries.some(d=>d.date===previousDay),previous=previousKnown?createDailyEvaluator(visible,{baselineMode}).day(previousDay,previousDay).daily:null;
  const comparison=compare({...dataset,_revisionCount:entry.revisionCount},evaluation.daily,previous,asOf);
  const contract=toCalculationResult(evaluation,{dataset,snapshotId,computedAt:new Date().toISOString()});
  const cumulative=evaluation.cumulative,eligible=asOf>=dataset.order.start&&cumulative.actual.gross!=null&&cumulative.expected.gross!=null;
  const monitoringStatus=asOf<dataset.order.start?'未开工':cumulative.quantity==null?'待确认':dataset.order.quantity!=null&&new D(cumulative.quantity).gte(dataset.order.quantity)?'已完工':'生产中';
  const riskInfo=classifyMonitorRisk({actual:cumulative.actual.gross,expected:cumulative.expected.gross,revenue:cumulative.revenue,baselineComplete:evaluation.quality.completeness?.baseline.state==='complete'});
  const marginDeviationPp=eligible&&cumulative.revenue!=null&&new D(cumulative.revenue).gt(0)?new D(cumulative.actual.gross).minus(cumulative.expected.gross).div(cumulative.revenue).times(100).toString():null;
  const seriesKey=`monitor-series|${dataset.revision.id}|${cutoff}|${seriesStart}|${asOf}|${baselineMode}|v1`,points=await (cache?cache.getOrCompute(seriesKey,()=>calculateSeries(visible,{start:seriesStart,end:asOf,baselineMode})):Promise.resolve(calculateSeries(visible,{start:seriesStart,end:asOf,baselineMode})));for(const p of points)p.comparable=p.actual!=null&&p.expected!=null&&p.date>=dataset.order.start;
  // Series points are cumulative from each order's start; the opening point one day before the
  // window gives the window-only total without re-running daily evaluation.
  const opening=points[0],closing=points[points.length-1],windowTotal=(from,to)=>from!=null&&to!=null?money(new D(to).minus(from)):null;
  const row={order:dataset.order,revisionId:dataset.revision.id,baselineId:dataset.baseline.id,snapshotId,cumulative,daily:evaluation.daily,comparison,quality:evaluation.quality,comparable:eligible,period:{actual:windowTotal(opening.actual,closing.actual),expected:windowTotal(opening.expected,closing.expected),gap:windowTotal(opening.gap,closing.gap)},distribution:asOf<dataset.order.start?'not_started':distributionKey(evaluation.daily),points,loss:cumulative.actual.gross!=null&&new D(cumulative.actual.gross).lt(0),cumulativeDeviation:eligible&&new D(cumulative.gap).gt(0),recommendations:recommendations({today:evaluation.daily,previous,comparison,orderId:dataset.order.id,revisionId:dataset.revision.id,baselineMode,asOf,snapshotId})};
  row.evidence=[...evaluation.evidence.map((source,i)=>({evidenceId:`${snapshotId}:source-${i}`,source})),...row.recommendations.flatMap(r=>r.evidence)];
  Object.assign(row,{monitoringStatus,risk:riskInfo,marginDeviationPp});
  // Persist the actual immutable daily inputs too; evidence never reads latest mutable records.
  snapshots.push({snapshot_id:snapshotId,order_id:dataset.order.id,as_of:asOf,known_at:knownAt,revision_id:dataset.revision.id,baseline_mode:baselineMode,input_hash:hash(dataset),result:contract,evaluation,previous,inputs:dataset,recorded_at:new Date().toISOString(),evidence:row.evidence});orders.push(row);
 }
 const filterOptions={customers:[...new Set(orders.map(r=>r.order.customer).filter(Boolean))].sort(),statuses:['生产中','已完工','未开工','待确认'],risks:['严重','重点','注意','数据不足','缺少基线','不可评级','正常','优于预期']};
 if(status&&!filterOptions.statuses.includes(status)||risk&&!filterOptions.risks.includes(risk)||search.length>200)throw fail('INVALID_REQUEST','筛选条件无效');
 const searchTokens=String(search??'').trim().replace(/\s+/g,' ').toLowerCase().split(' ').filter(Boolean);
 orders.splice(0,orders.length,...orders.filter(r=>(!customer||r.order.customer===customer)&&(!status||r.monitoringStatus===status)&&(!risk||r.risk.label===risk)&&(!searchTokens.length||searchTokens.every(token=>[r.order.id,r.order.product,r.order.customer].join(' ').toLowerCase().includes(token)))));
 const firstFiltered=orders.map(r=>r.order.start).sort()[0],displayStart=firstFiltered&&firstFiltered<=asOf&&firstFiltered>start?firstFiltered:start;
 for(const row of orders)row.points=row.points.filter(p=>p.date>=displayStart);
 const filteredPointCount=Math.round((Date.parse(asOf)-Date.parse(displayStart))/86400000)+1;
 orders.sort((a,b)=>{const x=a.comparison.marginChangePp,y=b.comparison.marginChangePp;return x==null?(y==null?a.order.id.localeCompare(b.order.id):1):y==null?-1:new D(x).cmp(y)||a.order.id.localeCompare(b.order.id);});
 const comparable=orders.filter(r=>r.comparable),periodCompatible=orders.filter(r=>r.comparable&&r.period.actual!=null&&r.period.expected!=null),intersection=orders.filter(r=>r.points.every(p=>p.comparable));
 const trend=Array.from({length:filteredPointCount},(_,i)=>{const day=shift(displayStart,i),rows=intersection.map(r=>r.points[i]);return {date:day,actual:sum(rows,r=>r.actual),expected:sum(rows,r=>r.expected),includedCount:rows.length,excludedCount:orders.length-rows.length};});
 const buckets=[['high','≥30%'],['medium','10%–不足30%'],['low','0%–不足10%'],['negative','<0%'],['unknown','无法计算'],['not_started','未开工']].map(([key,label])=>({key,label,count:orders.filter(r=>r.distribution===key).length,ratio:orders.length?new D(orders.filter(r=>r.distribution===key).length).div(orders.length).toFixed(6):null}));
 const overview={viewId,filterOptions,filters:{customer,status,risk,search},scope:{asOf,knownAt,periodStart:displayStart,baselineMode,source:'imported',currency:'CNY',versionSet:orders.map(r=>({orderId:r.order.id,revisionId:r.revisionId,baselineId:r.baselineId,snapshotId:r.snapshotId})),note:'本地标准导入口径：CNY、生产等价收入、模拟报价不拆税。迟录和整套修订不纳入纯经营恶化判断。'},coverage:{total:orders.length,known:orders.filter(r=>r.cumulative.actual.gross!=null&&asOf>=r.order.start).length,comparable:comparable.length,periodComparable:periodCompatible.length,dayComparable:orders.filter(r=>r.comparison.status==='comparable').length,incomplete:orders.filter(r=>r.quality.missing.length>0).length,exclusions:orders.filter(r=>!r.comparable||r.comparison.status!=='comparable').map(r=>({orderId:r.order.id,reasons:[...r.comparison.reasons,...r.quality.missing.map(m=>`${m.date??''} ${m.detail}`)]}))},summary:{actualGross:sum(periodCompatible,r=>r.period.actual),expectedGross:sum(periodCompatible,r=>r.period.expected),gap:sum(periodCompatible,r=>r.period.gap),deteriorated:orders.filter(r=>r.comparison.deteriorated).length},trend:{includedCount:intersection.length,excludedCount:orders.length-intersection.length,points:trend},distribution:buckets,attention:orders.filter(r=>r.comparison.deteriorated).slice(0,5).map(r=>r.order.id),reminders:orders.filter(r=>r.loss||r.cumulativeDeviation||r.quality.missing.length).map(r=>({orderId:r.order.id,loss:r.loss,cumulativeDeviation:r.cumulativeDeviation,incomplete:r.quality.missing.length>0})),orders};
 return {overview,snapshots};
}

export function createMonitorService({store,repository,clock=Date.now,compute=evaluate,cache=null,liveViewOptions={}}){
 const liveViews=createLiveViews({...liveViewOptions,clock});
 async function build(options){
   const explicitKnown=options.knownAt!=null,knownAt=timestamp(options.knownAt??new Date(clock()).toISOString());if(explicitKnown&&Date.parse(knownAt)>clock())throw fail('INVALID_REQUEST','信息截止时间不能晚于服务端当前时间');
   const versions=await store.listVersions();
   const selected=new Map();for(const v of versions)if(Date.parse(v.createdAt)<=Date.parse(knownAt)){const old=selected.get(v.dataset.order.id);selected.set(v.dataset.order.id,{...v,revisionCount:(old?.revisionCount??0)+1});}
   const entries=[...selected.values()],asOf=options.asOf??(entries.length?entries.reduce((s,v)=>v.dataset.order.end>s?v.dataset.order.end:s,entries[0].dataset.order.end):new Date(clock()+8*3600000).toISOString().slice(0,10));
   // A review view sees everything up to the end of its business date. An explicit knownAt still
   // freezes information earlier. Revision selection always uses knownAt (when it was known).
   const visibilityCutoff=explicitKnown?knownAt:asOf+'T23:59:59+08:00';
   const built=await buildOverview(entries,{...options,asOf,knownAt,visibilityCutoff,compute,cache});
   built.overview.coverage.unfilteredTotal=entries.length;
   return built;
 }
 return {
  async browse(options={}){
   const built=await build({...options,viewId:`live-${randomUUID()}`});
   liveViews.put(built);
   return built.overview;
  },
  // Explicit archive operation for compatibility; ordinary HTTP reads must use browse().
  async create(options={}){
   const built=await build(options);
   await repository.saveView({overview:built.overview,snapshots:built.snapshots,recordedAt:new Date(clock()).toISOString()});
   return built.overview;
  },
  async get(viewId){return viewId.startsWith('live-')?liveViews.get(viewId).overview:repository.getView(viewId);},
  async evidence(viewId,snapshotId){const live=viewId.startsWith('live-')?liveViews.get(viewId):null,v=live?.overview??await this.get(viewId);if(!v.scope.versionSet.some(r=>r.snapshotId===snapshotId))throw fail('SCOPE_MISMATCH','快照不属于此视图',409);const snapshot=live?live.snapshots.find(s=>s.snapshot_id===snapshotId):await repository.getSnapshot(snapshotId);return {viewId,snapshotId,revisionId:snapshot.revision_id,baselineMode:snapshot.baseline_mode,asOf:snapshot.as_of,knownAt:snapshot.known_at,daily:snapshot.evaluation.daily,previous:snapshot.previous,evidence:snapshot.evidence};}
 };
}
