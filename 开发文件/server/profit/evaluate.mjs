import {D,money,sum} from './decimal.mjs';
import {buildDiagnosis,buildReferenceThresholds} from './diagnosis.mjs';
import {addDays} from '../import/validation.mjs';
import {CATEGORIES} from '../model.mjs';
import {createDailyEvaluator} from './series.mjs';
const amountSum=xs=>money(sum(xs));
export function evaluate(dataset,{asOf,baselineMode='ideal'}={}){
 const {order:o,baseline:b}=dataset;if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf??'')||Number.isNaN(Date.parse(asOf))||new Date(asOf).toISOString().slice(0,10)!==asOf)throw new Error('请选择有效日期');
 const evaluator=createDailyEvaluator(dataset,{baselineMode}),base=evaluator.base,missing=[...evaluator.baseMissing],days=[];
 for(let date=o.start;date<=o.end&&date<=asOf;date=addDays(date,1)){
  const result=evaluator.day(date,asOf);
  for(const entry of result.missing)if(missing.length<1000)missing.push(entry);
  days.push(result.daily);
 }
 const visible=evaluator.visibleAt(asOf);
 const aggregate=(field,side)=>amountSum(days.map(d=>side?d[side][field]:d[field]));
 const totalQuantity=days.some(d=>d.quantity===null)||o.opening===null?null:days.reduce((s,d)=>s+d.quantity,0);
 const dailySum=fn=>amountSum(days.map(fn));
 const cumulative={quantity:totalQuantity,processed:days.some(d=>d.processed===null)?null:days.reduce((s,d)=>s+d.processed,0),defects:days.some(d=>d.defects===null)?null:days.reduce((s,d)=>s+d.defects,0),revenue:aggregate('revenue'),actual:{gross:aggregate('gross','actual'),operating:aggregate('operating','actual')},expected:{gross:aggregate('gross','expected'),operating:aggregate('operating','expected')},gap:aggregate('gap'),delta:aggregate('delta')};
 cumulative.actual.material=dailySum(d=>d.actual.material);
 cumulative.actual.costs=Object.fromEntries(CATEGORIES.map(c=>[c,dailySum(d=>d.actual.costs[c])]));
 for(const k of ['material','labor','manufacturing','otherProduction','reserve','operatingCosts'])cumulative.expected[k]=dailySum(d=>d.expected[k]);
 cumulative.actual.margin=cumulative.actual.gross!==null&&Number(cumulative.revenue)>0?new D(cumulative.actual.gross).div(cumulative.revenue).toFixed(8):null;
 cumulative.expected.margin=cumulative.expected.gross!==null&&Number(cumulative.revenue)>0?new D(cumulative.expected.gross).div(cumulative.revenue).toFixed(8):null;
 cumulative.progress=totalQuantity!==null&&Number(o.quantity)>0?new D(totalQuantity).div(o.quantity).toFixed(8):null;cumulative.remaining=totalQuantity===null?null:Math.max(0,Number(o.quantity)-totalQuantity);cumulative.overproduction=totalQuantity===null?null:Math.max(0,totalQuantity-Number(o.quantity));
 const components=Object.fromEntries(['materialPrice','materialUsage','labor','energy','otherManufacturing','otherProduction','budgetAdjustment','rounding'].map(k=>[k,amountSum(days.map(d=>d.components[k]))]));
 const state=asOf<o.start?'not_started':missing.some(m=>['order','baseline','production','material','人工','制造','其他生产'].includes(m.field))?'incomplete':dataset.production.concat(dataset.materials,dataset.expenses).some(r=>r.date<=asOf&&visible(r)&&r.status==='暂估')?'provisional':missing.length?'operating_incomplete':'complete';
 const visibleSupplements=dataset.supplements.filter(r=>r.date<=asOf&&visible(r));
 const visibilityEnd=dataset.production.concat(dataset.materials,dataset.expenses,dataset.supplements).reduce((end,r)=>r.availableAt?.slice(0,10)>end?r.availableAt.slice(0,10):end,o.end);
 const sameQuantityTheory=base.theoretical(totalQuantity,baselineMode);
 cumulative.expected.revenue=sameQuantityTheory.revenue;
 const theoreticalRounding=sameQuantityTheory.gross!==null&&cumulative.expected.gross!==null?money(new D(sameQuantityTheory.gross).minus(cumulative.expected.gross)):null;
 const dimension=items=>({state:items.length?'incomplete':'complete',missing:items});
 const completeness={
  actual:dimension(missing.filter(m=>m.field!=='baseline'&&m.field!=='production')),
  baseline:dimension(missing.filter(m=>m.field==='baseline')),
  progress:dimension(missing.filter(m=>m.field==='production'||m.field==='order'))
 };
 const profitScope={grossProfit:cumulative.actual.gross,managementProfit:cumulative.actual.operating,forecastProfit:null,finalProfit:null,settlement:{state:'open',reason:'导入首版不包含正式结算资料；最终利润待结算后提供'}};
 const daySummaries=days.map(d=>({date:d.date,quantity:d.quantity,revenue:d.revenue,actual:{material:d.actual.material,costs:d.actual.costs,productionCost:d.actual.productionCost,gross:d.actual.gross,operating:d.actual.operating,margin:d.actual.margin},expected:{gross:d.expected.gross,revenue:d.expected.revenue},gap:d.gap,components:d.components}));
 const result={visibilityEnd,theoreticalRounding,order:o,revisionId:dataset.revision.id,baselineId:b.id,baselineMode,asOf,daily:days.find(d=>d.date===asOf)??null,daySummaries,cumulative,theoreticalTotal:base.theoretical(o.quantity,baselineMode),bridge:{total:cumulative.gap,components},profitScope,quality:{state,missing,completeness,isDemo:o.isDemo},evidence:days.flatMap(d=>[...d.rows.production,...d.rows.materials,...d.rows.expenses].map(r=>r.source)),warnings:visibleSupplements.length?[`补单为已含记录，不额外增加产量和成本；不良与补单差异${dataset.production.filter(r=>r.date<=asOf&&visible(r)).reduce((s,r)=>s+Number(r.defects??0),0)-visibleSupplements.reduce((s,r)=>s+Number(r.quantity??0),0)}双`]:[]};
 result.referenceThresholds=buildReferenceThresholds({order:o,cumulative,theoreticalBudget:base.theoretical(o.quantity,'budget'),baselineId:b.id,asOf});
 result.diagnosis=buildDiagnosis(result);
 return result;
}
