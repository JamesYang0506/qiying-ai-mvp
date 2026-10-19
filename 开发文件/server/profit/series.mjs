import {D,money,six,sum,valid} from './decimal.mjs';
import {prepareBaseline} from './baseline.mjs';
import {addDays} from '../import/validation.mjs';
import {CATEGORIES} from '../model.mjs';

const amountSum=xs=>money(sum(xs));
const byDate=rows=>{const map=new Map();for(const row of rows){const list=map.get(row.date);if(list)list.push(row);else map.set(row.date,[row]);}return map;};
const CUTOFF_SUFFIX='T23:59:59+08:00';

// One dataset-level evaluator: baseline and date indexes are built once, then each
// business day is evaluated at a caller-supplied visibility cutoff.
export function createDailyEvaluator(dataset,{baselineMode='ideal'}={}){
 if(!['ideal','budget'].includes(baselineMode))throw new Error('理论基线模式无效');
 const {order:o,baseline:b}=dataset,base=prepareBaseline(dataset),baseMissing=[];
 const miss=(list,date,field,detail)=>{if(list.length<1000)list.push({date,field,detail});};
 for(const k of ['quantity','price','weight','opening'])if(o[k]==null)miss(baseMissing,null,'order',`订单${k}待补齐`);
 for(const [k,v] of Object.entries(b.params))if(v==null)miss(baseMissing,null,'baseline',`基线参数${k}待补齐`);
 for(const r of b.recipe)if(r.quantity==null||r.referencePrice==null)miss(baseMissing,null,'baseline',`${r.id}配方量或参考价格待补齐`);
 const sizePlanComplete=b.sizePlan.length>0&&b.sizePlan.every(s=>s.quantity!=null);
 if(!sizePlanComplete)miss(baseMissing,null,'production','分码合同量待补齐');
 const activeSizes=b.sizePlan.filter(s=>s.quantity!=null&&new D(s.quantity).gt(0));
 const production=byDate(dataset.production),materials=byDate(dataset.materials),expenses=byDate(dataset.expenses),supplements=byDate(dataset.supplements);
 const visibleAt=cutoff=>{const cutoffMs=Date.parse(cutoff+CUTOFF_SUFFIX);return row=>row.availableAt&&Date.parse(row.availableAt)<=cutoffMs;};
 let calls=0;
 function day(date,cutoff=date){
  calls++;
  const visible=visibleAt(cutoff),missing=[];
  const allProduction=production.get(date)??[],productions=allProduction.filter(visible);
  const complete=sizePlanComplete&&activeSizes.length>0&&productions.every(r=>valid(r)&&r.dayStatus!=='待补录'&&r.processed!=null&&r.defects!=null)&&activeSizes.every(s=>{const rs=productions.filter(r=>r.size===s.id);return rs.length===1&&valid(rs[0])&&rs[0].processed!==null&&rs[0].defects!==null;});
  if(!complete)miss(missing,date,'production','日码数量缺失、待确认或尚不可见');
  const processed=complete?productions.reduce((s,r)=>s+Number(r.processed),0):null,defects=complete?productions.reduce((s,r)=>s+Number(r.defects),0):null,quantity=complete?processed-defects:null;
  const revenue=quantity!==null&&o.price!==null?money(new D(quantity).times(o.price)):null;
  const allMaterials=materials.get(date)??[],visibleMaterials=allMaterials.filter(visible);let materialCost=new D(0),priceImpact=new D(0),usageImpact=new D(0),materialComplete=true;
  for(const m of base.materials){
   const all=allMaterials.filter(r=>r.materialId===m.id),rs=visibleMaterials.filter(r=>r.materialId===m.id);
   if(!rs.length||rs.length!==all.length||rs.some(r=>!valid(r)||r.net===null||r.price===null)){materialComplete=false;miss(missing,date,'material',`${m.id}净耗、单价或可见时间待补齐`);continue;}
   materialCost=materialCost.plus(sum(rs.map(r=>money(six(r.net).times(six(r.price))))));
   if(quantity!==null&&m.price!==null){const actualNet=sum(rs.map(r=>six(r.net)));const standard=six(new D(quantity).times(o.weight).times(m.share));
    priceImpact=priceImpact.plus(sum(rs.map(r=>money(six(r.net).times(six(r.price).minus(m.price))))));
    usageImpact=usageImpact.plus(money(actualNet.minus(standard).times(m.price)));
   }
  }
  const allExpenses=expenses.get(date)??[],visibleExpenses=allExpenses.filter(visible),costs={};
  for(const cat of CATEGORIES){const all=allExpenses.filter(r=>r.category===cat),rs=visibleExpenses.filter(r=>r.category===cat);const good=rs.length>0&&all.length===rs.length&&rs.every(r=>valid(r)&&r.amount!==null);costs[cat]=good?amountSum(rs.map(r=>money(r.amount))):null;if(!good)miss(missing,date,cat,'费用未完整归属、尚不可见或待补齐');}
  const actualCost=materialComplete?sum([money(materialCost),costs.人工,costs.制造,costs.其他生产]):null;
  const gross=revenue!==null&&actualCost!==null?money(new D(revenue).minus(actualCost)):null;
  const operatingCost=sum([costs.管理,costs.销售,costs.财务]);const operating=gross!==null&&operatingCost!==null?money(new D(gross).minus(operatingCost)):null;
  const expected=base.theoretical(quantity,baselineMode),gap=expected.gross!==null&&gross!==null?money(new D(expected.gross).minus(gross)):null;
  const diff=(a,e)=>a!==null&&e!==null?money(new D(a).minus(e)):null;
  // Manufacturing is split only when both labelled items are available; residual remains an explicit other-manufacturing item.
  const energyRows=visibleExpenses.filter(r=>r.category==='制造'&&/能源/.test(r.item));const energyActual=costs.制造===null?null:amountSum(energyRows.map(r=>r.amount));
  const energyDiff=diff(energyActual,expected.energy);
  const otherManufacturing=costs.制造!==null&&expected.productionManagement!==null&&energyActual!==null?money(new D(costs.制造).minus(energyActual).minus(expected.productionManagement)):null;
  const components={materialPrice:materialComplete&&matsReady(base)&&quantity!==null?money(priceImpact):null,materialUsage:materialComplete&&matsReady(base)&&quantity!==null?money(usageImpact):null,labor:diff(costs.人工,expected.labor),energy:energyDiff,otherManufacturing,otherProduction:diff(costs.其他生产,expected.otherProduction),budgetAdjustment:expected.reserve===null?null:money(new D(expected.reserve).negated())};
  components.rounding=gap!==null&&Object.values(components).every(v=>v!==null)?money(new D(gap).minus(sum(Object.values(components)))):null;
  return {missing,daily:{date,quantity,processed,defects,revenue,actual:{material:materialComplete?money(materialCost):null,costs,productionCost:money(actualCost),gross,operating,margin:gross!==null&&Number(revenue)>0?new D(gross).div(revenue).toFixed(8):null},expected,gap,delta:gap===null?null:money(new D(gap).negated()),components,rows:{production:productions,materials:visibleMaterials,expenses:visibleExpenses,supplements:(supplements.get(date)??[]).filter(visible)}}};
 }
 return {dataset,order:o,baseline:b,base,baseMissing,sizePlanComplete,activeSizes,day,visibleAt,get calls(){return calls;}};
}
function matsReady(base){return base.materials.every(m=>m.price!==null);}

// Earliest as-of date on which a provisional row becomes visible.
function provisionalFrom(dataset){
 let earliest=null;
 for(const row of [...dataset.production,...dataset.materials,...dataset.expenses]){
  if(row.status!=='暂估'||!row.availableAt||!Number.isFinite(Date.parse(row.availableAt)))continue;
  let shown=new Date(Date.parse(row.availableAt)+8*3600000).toISOString().slice(0,10);
  if(Date.parse(row.availableAt)>Date.parse(shown+CUTOFF_SUFFIX))shown=addDays(shown,1);
  const from=row.date>shown?row.date:shown;
  if(earliest===null||from<earliest)earliest=from;
 }
 return earliest;
}

export function calculateSeries(dataset,{start,end,baselineMode='ideal'}={},{createEvaluator=createDailyEvaluator}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start??'')||!/^\d{4}-\d{2}-\d{2}$/.test(end??'')||start>end||(new Date(end)-new Date(start))/86400000>3660)throw new Error('趋势日期范围无效');
 const evaluator=createEvaluator(dataset,{baselineMode}),order=dataset.order,provisional=provisionalFrom(dataset);
 const inc={quantity:0,quantityNull:order.opening==null,gross:new D(0),grossNull:false,expected:new D(0),expectedNull:false,gap:new D(0),gapNull:false};
 const blockingFields=new Set(['order','baseline','production','material','人工','制造','其他生产']);
 let blocking=evaluator.baseMissing.some(m=>blockingFields.has(m.field)),anyMissing=evaluator.baseMissing.length>0;
 const apply=({daily,missing})=>{
  if(daily.quantity==null)inc.quantityNull=true;else inc.quantity+=daily.quantity;
  if(daily.actual.gross==null)inc.grossNull=true;else inc.gross=inc.gross.plus(daily.actual.gross);
  if(daily.expected.gross==null)inc.expectedNull=true;else inc.expected=inc.expected.plus(daily.expected.gross);
  if(daily.gap==null)inc.gapNull=true;else inc.gap=inc.gap.plus(daily.gap);
  if(missing.length)anyMissing=true;
  if(missing.some(m=>blockingFields.has(m.field)))blocking=true;
 };
 const state=date=>date<order.start?'not_started':blocking?'incomplete':provisional!==null&&date>=provisional?'provisional':anyMissing?'operating_incomplete':'complete';
 const points=[];let cursor=order.start;
 for(let date=start;date<=end;date=addDays(date,1)){
  while(cursor<=date&&cursor<=order.end){apply(evaluator.day(cursor,cursor));cursor=addDays(cursor,1);}
  points.push({date,actual:inc.grossNull?null:money(inc.gross),expected:inc.expectedNull?null:money(inc.expected),gap:inc.gapNull?null:money(inc.gap),quantity:inc.quantityNull?null:inc.quantity,state:state(date)});
 }
 return points;
}
