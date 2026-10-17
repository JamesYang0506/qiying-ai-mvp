import {D,money,six,sum,valid} from './decimal.mjs';
import {prepareBaseline} from './baseline.mjs';
import {addDays} from '../import/validation.mjs';
import {CATEGORIES} from '../model.mjs';
const amountSum=xs=>money(sum(xs));
export function evaluate(dataset,{asOf,baselineMode='ideal'}={}){
 const {order:o,baseline:b}=dataset;if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf??'')||Number.isNaN(Date.parse(asOf))||new Date(asOf).toISOString().slice(0,10)!==asOf)throw new Error('请选择有效日期');
 if(!['ideal','budget'].includes(baselineMode))throw new Error('理论基线模式无效');
 const base=prepareBaseline(dataset),missing=[],cutoff=asOf+'T23:59:59+08:00';const cutoffMs=Date.parse(cutoff);
 const visible=r=>r.availableAt&&Date.parse(r.availableAt)<=cutoffMs;
 const miss=(date,field,detail)=>{if(missing.length<1000)missing.push({date,field,detail});};
 for(const k of ['quantity','price','weight','opening'])if(o[k]==null)miss(null,'order',`订单${k}待补齐`);
 for(const [k,v] of Object.entries(b.params))if(v==null)miss(null,'baseline',`基线参数${k}待补齐`);
 for(const r of b.recipe)if(r.quantity==null||r.referencePrice==null)miss(null,'baseline',`${r.id}配方量或参考价格待补齐`);
 const sizePlanComplete=b.sizePlan.length>0&&b.sizePlan.every(s=>s.quantity!=null);
 if(!sizePlanComplete)miss(null,'production','分码合同量待补齐');
 const activeSizes=b.sizePlan.filter(s=>s.quantity!=null&&new D(s.quantity).gt(0));
 const days=[];
 for(let date=o.start;date<=o.end&&date<=asOf;date=addDays(date,1)){
  const allProduction=dataset.production.filter(r=>r.date===date);const productions=allProduction.filter(visible);
  const complete=sizePlanComplete&&activeSizes.length>0&&productions.every(r=>valid(r)&&r.dayStatus!=='待补录'&&r.processed!=null&&r.defects!=null)&&activeSizes.every(s=>{const rs=productions.filter(r=>r.size===s.id);return rs.length===1&&valid(rs[0])&&rs[0].processed!==null&&rs[0].defects!==null;});
  if(!complete)miss(date,'production','日码数量缺失、待确认或尚不可见');
  const processed=complete?productions.reduce((s,r)=>s+Number(r.processed),0):null,defects=complete?productions.reduce((s,r)=>s+Number(r.defects),0):null,quantity=complete?processed-defects:null;
  const revenue=quantity!==null&&o.price!==null?money(new D(quantity).times(o.price)):null;
  const allMaterials=dataset.materials.filter(r=>r.date===date),materials=allMaterials.filter(visible);let materialCost=new D(0),priceImpact=new D(0),usageImpact=new D(0),materialComplete=true;
  for(const m of base.materials){
   const all=allMaterials.filter(r=>r.materialId===m.id),rs=materials.filter(r=>r.materialId===m.id);
   if(!rs.length||rs.length!==all.length||rs.some(r=>!valid(r)||r.net===null||r.price===null)){materialComplete=false;miss(date,'material',`${m.id}净耗、单价或可见时间待补齐`);continue;}
   materialCost=materialCost.plus(sum(rs.map(r=>money(six(r.net).times(six(r.price))))));
   if(quantity!==null&&m.price!==null){const actualNet=sum(rs.map(r=>six(r.net)));const standard=six(new D(quantity).times(o.weight).times(m.share));
    priceImpact=priceImpact.plus(sum(rs.map(r=>money(six(r.net).times(six(r.price).minus(m.price))))));
    usageImpact=usageImpact.plus(money(actualNet.minus(standard).times(m.price)));
   }
  }
  const allExpenses=dataset.expenses.filter(r=>r.date===date),expenses=allExpenses.filter(visible),costs={};
  for(const cat of CATEGORIES){const all=allExpenses.filter(r=>r.category===cat),rs=expenses.filter(r=>r.category===cat);const good=rs.length>0&&all.length===rs.length&&rs.every(r=>valid(r)&&r.amount!==null);costs[cat]=good?amountSum(rs.map(r=>money(r.amount))):null;if(!good)miss(date,cat,'费用未完整归属、尚不可见或待补齐');}
  const actualCost=materialComplete?sum([money(materialCost),costs.人工,costs.制造,costs.其他生产]):null;
  const gross=revenue!==null&&actualCost!==null?money(new D(revenue).minus(actualCost)):null;
  const operatingCost=sum([costs.管理,costs.销售,costs.财务]);const operating=gross!==null&&operatingCost!==null?money(new D(gross).minus(operatingCost)):null;
  const expected=base.theoretical(quantity,baselineMode),gap=expected.gross!==null&&gross!==null?money(new D(expected.gross).minus(gross)):null;
  const diff=(a,e)=>a!==null&&e!==null?money(new D(a).minus(e)):null;
  // Manufacturing is split only when both labelled items are available; residual remains an explicit other-manufacturing item.
  const energyRows=expenses.filter(r=>r.category==='制造'&&/能源/.test(r.item));const energyActual=costs.制造===null?null:amountSum(energyRows.map(r=>r.amount));
  const energyDiff=diff(energyActual,expected.energy);
  const otherManufacturing=costs.制造!==null&&expected.productionManagement!==null&&energyActual!==null?money(new D(costs.制造).minus(energyActual).minus(expected.productionManagement)):null;
  const components={materialPrice:materialComplete&&matsReady(base)&&quantity!==null?money(priceImpact):null,materialUsage:materialComplete&&matsReady(base)&&quantity!==null?money(usageImpact):null,labor:diff(costs.人工,expected.labor),energy:energyDiff,otherManufacturing,otherProduction:diff(costs.其他生产,expected.otherProduction),budgetAdjustment:expected.reserve===null?null:money(new D(expected.reserve).negated())};
  components.rounding=gap!==null&&Object.values(components).every(v=>v!==null)?money(new D(gap).minus(sum(Object.values(components)))):null;
  days.push({date,quantity,processed,defects,revenue,actual:{material:materialComplete?money(materialCost):null,costs,productionCost:money(actualCost),gross,operating,margin:gross!==null&&Number(revenue)>0?new D(gross).div(revenue).toFixed(8):null},expected,gap,delta:gap===null?null:money(new D(gap).negated()),components,rows:{production:productions,materials,expenses,supplements:dataset.supplements.filter(s=>s.date===date&&visible(s))}});
 }
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
 const daySummaries=days.map(d=>({date:d.date,quantity:d.quantity,revenue:d.revenue,actual:{material:d.actual.material,costs:d.actual.costs,gross:d.actual.gross,operating:d.actual.operating},expected:{gross:d.expected.gross,revenue:d.expected.revenue},gap:d.gap,components:d.components}));
 return {visibilityEnd,theoreticalRounding,order:o,revisionId:dataset.revision.id,baselineId:b.id,baselineMode,asOf,daily:days.find(d=>d.date===asOf)??null,daySummaries,cumulative,theoreticalTotal:base.theoretical(o.quantity,baselineMode),bridge:{total:cumulative.gap,components},profitScope,quality:{state,missing,completeness,isDemo:o.isDemo},evidence:days.flatMap(d=>[...d.rows.production,...d.rows.materials,...d.rows.expenses].map(r=>r.source)),warnings:visibleSupplements.length?[`补单为已含记录，不额外增加产量和成本；不良与补单差异${dataset.production.filter(r=>r.date<=asOf&&visible(r)).reduce((s,r)=>s+Number(r.defects??0),0)-visibleSupplements.reduce((s,r)=>s+Number(r.quantity??0),0)}双`]:[]};
}
function matsReady(base){return base.materials.every(m=>m.price!==null);}
