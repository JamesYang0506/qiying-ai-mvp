import {D,money} from './decimal.mjs';
import {digest} from '../storage/store.mjs';
export const FORMULA_VERSION='IMPORT-FORMULA-0.2';
export const RULE_VERSION='IMPORT-RULES-0.2';
const ratio=x=>x==null?null:new D(x).toFixed(6);
const mapQuality=state=>({complete:'complete',provisional:'estimated',not_started:'incomplete',incomplete:'incomplete',operating_incomplete:'incomplete'}[state]??'incomplete');
const unitProfit=(gross,quantity)=>gross===null||quantity===null||Number(quantity)<=0?null:new D(gross).div(quantity).toFixed(6);
const metrics=(c,side,quality)=>{const x=c[side],revenue=side==='actual'?c.revenue:c.expected.revenue;return {revenue:revenue??null,material_cost:x.material??null,labor_cost:side==='actual'?(x.costs?.人工??null):x.labor??null,manufacturing_cost:side==='actual'?(x.costs?.制造??null):x.manufacturing??null,other_production_cost:side==='actual'?(x.costs?.其他生产??null):x.otherProduction??null,total_production_cost:revenue!=null&&x.gross!=null?money(new D(revenue).minus(x.gross)):null,gross_profit:x.gross??null,unit_gross_profit:unitProfit(x.gross??null,c.quantity),gross_margin:ratio(x.margin),management_profit:x.operating??null,forecast_profit:null,final_profit:null,quality};};
const variance=(category,expected,actual)=>({category,expected:expected??null,actual:actual??null,delta:expected!=null&&actual!=null?money(new D(actual).minus(expected)):null,evidence_ids:[]});
export function toCalculationResult(evaluation,{dataset,snapshotId,computedAt}={}){
 if(!dataset)throw new Error('契约适配需要原始数据集');
 const {cumulative:c,order:o,quality}=evaluation,mapped=mapQuality(quality.state),comparable=c.actual.gross!==null&&c.expected.gross!==null;
 const profitDelta=comparable?c.delta:null;
 const marginDelta=comparable&&c.actual.margin!=null&&c.expected.margin!=null?ratio(new D(c.actual.margin).minus(c.expected.margin)):null;
 const relativeDecline=comparable&&c.expected.margin!=null&&new D(c.expected.margin).gt(0)?ratio(new D(c.expected.margin).minus(c.actual.margin).div(c.expected.margin)):null;
 const hash=digest(dataset),costVariances=[variance('material',c.expected.material,c.actual.material),variance('labor',c.expected.labor,c.actual.costs?.人工),variance('manufacturing',c.expected.manufacturing,c.actual.costs?.制造),variance('other_production',c.expected.otherProduction,c.actual.costs?.其他生产)];
 const issues=[...quality.missing.map(m=>({code:'IMPORT_MISSING',message:m.detail,field:m.field??'',severity:'blocking',source_refs:[]})),...(evaluation.warnings??[]).map(message=>({code:'IMPORT_WARNING',message,field:'',severity:'warning',source_refs:[]}))];
 return {
  snapshot_id:snapshotId??`local-${hash.slice(0,16)}-${evaluation.asOf}-${evaluation.baselineMode}`,
  order_id:o.id,
  baseline_id:evaluation.baselineId??null,
  input_hash:hash,
  formula_version:FORMULA_VERSION,
  rule_version:RULE_VERSION,
  computed_at:computedAt??new Date().toISOString(),
  scope:{basis:'cumulative',period_start:o.start,period_end:evaluation.asOf,quantity_basis:'completed_good',quantity:c.quantity==null?null:String(c.quantity),quantity_unit:'双',currency:'CNY',tax_basis:'ignored',cost_scope_id:evaluation.baselineId??'IMPORT-0.2',revenue_basis:'production_equivalent',settlement_state:'open'},
  expected:metrics(c,'expected',mapped),
  actual:metrics(c,'actual',mapped),
  comparison:{comparable,quality:mapped,reasons:quality.missing.slice(0,10).map(m=>m.detail).concat(comparable?[]:['实际或同进度理论毛利缺失，暂不可比']),profit_delta:profitDelta,revenue_delta:comparable?'0.00':null,margin_delta:marginDelta,relative_decline:relativeDecline,risk:{level:'not_applicable',rule_version:RULE_VERSION,reason:'导入适配层未接入风险分级；差距与质量状态以导入核算结果为准',loss:c.actual.gross!==null&&new D(c.actual.gross).lt(0)},cost_variances:costVariances},
  issues,
  evidence:[]
 };
}
