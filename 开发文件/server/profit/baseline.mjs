import {D,six,money,sum} from './decimal.mjs';
export function prepareBaseline(dataset){
 const {order:o,baseline:b}=dataset;const p=b.params;const q=sum(b.recipe.map(m=>m.quantity));
 const ref=sum(b.recipe.map(m=>m.quantity==null||m.referencePrice==null?null:new D(m.quantity).times(m.referencePrice)));
 const available=q?.gt(0)&&ref?.gt(0)&&o.price!=null&&o.weight!=null&&new D(o.weight).gt(0)&&p.material_pct!=null;
 const factor=available?new D(o.price).times(p.material_pct).div(o.weight).div(ref.div(q)):null;
 const materials=b.recipe.map(m=>({...m,share:available?new D(m.quantity).div(q):null,price:available?six(new D(m.referencePrice).times(factor)):null}));
 function theoretical(quantity,mode='ideal'){
  const revenue=o.price==null||quantity==null?null:new D(quantity).times(o.price);
  const material=quantity==null?null:sum(materials.map(m=>m.price==null?null:new D(money(six(new D(quantity).times(o.weight).times(m.share)).times(m.price)))));
  const byQty=k=>quantity==null||p[k]==null?null:new D(money(new D(quantity).times(p[k])));
  const byRevenue=k=>revenue==null||p[k]==null?null:new D(money(revenue.times(p[k])));
  const labor=p.prep_piece==null||p.press_piece==null||quantity==null?null:new D(money(new D(quantity).times(new D(p.prep_piece).plus(p.press_piece))));
  const management=byRevenue('production_mgmt'),energy=byRevenue('energy_pct'),otherProduction=byQty('other_production_piece');
  const reserve=mode==='budget'?sum([byRevenue('production_loss_budget'),byRevenue('defect_loss_budget')]):new D(0);
  const production=sum([material,labor,management,energy,otherProduction,reserve]);
  const gross=revenue!=null&&production!=null?revenue.minus(production):null;
  const operatingCosts=sum([byRevenue('company_mgmt'),byRevenue('admin_pct'),byQty('logistics_piece'),byQty('finance_piece')]);
  const operating=gross!=null&&operatingCosts!=null?gross.minus(operatingCosts):null;
  return {revenue:money(revenue),material:money(material),labor:money(labor),manufacturing:money(sum([management,energy])),productionManagement:money(management),energy:money(energy),otherProduction:money(otherProduction),reserve:money(reserve),operatingCosts:money(operatingCosts),gross:money(gross),operating:money(operating)};
 }
 return {materials,theoretical};
}
