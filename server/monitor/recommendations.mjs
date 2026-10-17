import {D,money} from '../profit/decimal.mjs';

const positive=(x,y)=>x!=null&&y!=null&&new D(x).gt(y);
const unit=(x,q)=>x!=null&&q>0?new D(x).div(q):null;
export function recommendations({today,previous,comparison,orderId,revisionId,baselineMode,asOf,snapshotId}){
 const result=[];
 const add=(ruleId,change,advice,rows,impact=null)=>{result.push({ruleId,change,advice,unitCostImpact:impact?.toString()??null,evidence:rows.map(r=>({evidenceId:`${snapshotId}:${r.id}`,snapshotId,orderId,businessDate:r.date,revisionId,baselineMode,category:r.category??null,materialId:r.materialId??null,recordId:r.id,source:r.source??null})),comparisonStatus:comparison.status});};
 if(comparison.status!=='comparable'){
  add('DATA_CHECK',comparison.reasons.join('；'),'先核对缺项、录入时间及版本；资料更新不能直接解释为经营恶化。',[...(today?.rows.production??[]),...(today?.rows.expenses??[])]);return result;
 }
 const tq=today.quantity,pq=previous.quantity;
 const materialIds=[...new Set(today.rows.materials.map(r=>r.materialId))];
 for(const id of materialIds){
  const now=today.rows.materials.filter(r=>r.materialId===id),before=previous.rows.materials.filter(r=>r.materialId===id);
  if(!before.length||[...now,...before].some(r=>r.net==null||r.price==null))continue;
  const net=rs=>rs.reduce((s,r)=>s.plus(r.net),new D(0)),cost=rs=>rs.reduce((s,r)=>s.plus(new D(r.net).times(r.price)),new D(0));
  const n=net(now),b=net(before),price=n.gt(0)?cost(now).div(n):null,oldPrice=b.gt(0)?cost(before).div(b):null;
  if(positive(price,oldPrice)&&positive(unit(today.components.materialPrice,tq),unit(previous.components.materialPrice,pq)))add('MATERIAL_PRICE',`材料 ${id} 加权单价 ${oldPrice.toFixed(6)} → ${price.toFixed(6)} 元/kg`,'核对采购批次、供应商报价、入库单价和录入值。',[...before,...now],price.minus(oldPrice).times(n).div(tq));
  if(positive(unit(n,tq),unit(b,pq)))add('MATERIAL_USAGE',`材料 ${id} 单位合格品净耗 ${unit(b,pq).toFixed(6)} → ${unit(n,tq).toFixed(6)} kg/双`,'核对领退料、标准重量、不良数量及净耗口径；耗用增加原因待核实。',[...before,...now],unit(n,tq).minus(unit(b,pq)).times(oldPrice??0));
 }
 for(const [category,ruleId,advice]of [['人工','LABOR','核对工价、计件量、合格产量与费用归属。'],['制造','MANUFACTURING','核对费用所属日期、订单及分摊依据；现有资料不足以认定停机低效。']]){
  const now=unit(today.actual.costs[category],tq),before=unit(previous.actual.costs[category],pq);
  if(positive(now,before))add(ruleId,`单位合格品${category}费用 ${money(before)} → ${money(now)} 元/双`,advice,[...previous.rows.expenses,...today.rows.expenses].filter(r=>r.category===category),now.minus(before));
 }
 const supplements=today.rows.supplements??[],prior=previous.rows.supplements??[];
 const qty=rs=>rs.reduce((s,r)=>r.quantity==null?s:s.plus(r.quantity),new D(0));
 if(supplements.length&&positive(unit(qty(supplements),tq),unit(qty(prior),pq)))add('SUPPLEMENT_LINK','补单数量占合格产量的比例增加','核对补料/补产用途及关联；已含加工量和净耗的补单不重复扣成本。',supplements);
 const grouped=new Map();for(const item of result){const old=grouped.get(item.ruleId);if(!old){grouped.set(item.ruleId,item);continue;}old.change+='；'+item.change;old.evidence.push(...item.evidence);old.unitCostImpact=old.unitCostImpact==null||item.unitCostImpact==null?null:new D(old.unitCostImpact).plus(item.unitCostImpact).toString();}
 return [...grouped.values()].sort((a,b)=>a.unitCostImpact==null?(b.unitCostImpact==null?0:1):b.unitCostImpact==null?-1:new D(b.unitCostImpact).cmp(a.unitCostImpact)).slice(0,3);
}
