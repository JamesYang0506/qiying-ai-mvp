import Decimal from 'decimal.js';
import {decimal,excelDate,addDays,columnIndex} from './validation.mjs';
import {CATEGORIES,STATUSES,SCHEMA_VERSION} from '../model.mjs';
export function normalizePair(costBook,dailyBook){
 const issues=[];const issue=(severity,code,sheet,cell,field,message,fileRole='daily',recordId=null)=>issues.push({severity,code,fileRole,sheet,cell,field,recordId,message});
 const find=(book,name,role)=>{const s=book.sheets.find(s=>s.name===name);if(!s)issue('error','SHEET_REQUIRED',name,null,null,`缺少工作表“${name}”`,role);return s??{name,cells:{},tables:[]};};
 const info=find(costBook,'订单信息','cost'),cost=find(costBook,'成本计算','cost'),orig=find(costBook,'原订单用量','cost'),supp=find(costBook,'补单用量','cost');
 const prod=find(dailyBook,'每日生产','daily'),mat=find(dailyBook,'每日材料','daily'),fee=find(dailyBook,'每日费用','daily');
 const read=(sheet,ref,role='daily')=>{const c=sheet.cells[ref];if(c?.kind==='formula'||c?.kind==='error'){issue('error',c.kind==='formula'?'INPUT_FORMULA':'INPUT_ERROR',sheet.name,ref,null,'原始输入不能是公式或Excel错误值',role);return null;}return c?.value??null;};
 const num=(sheet,ref,{role='daily',integer=false,required=true}={})=>{let x;try{x=decimal(read(sheet,ref,role));if(x!==null&&integer&&!new Decimal(x).isInteger())throw new Error('数量必须为整数');}catch(e){issue('error','NUMBER_INVALID',sheet.name,ref,null,e.message,role);return null;}if(x===null&&required)issue('missing','VALUE_MISSING',sheet.name,ref,null,'数值待补齐',role);return x;};
 const meta={};for(const [ref,c]of Object.entries(info.cells))if(/^A\d+$/.test(ref)&&c.value)meta[c.value]='B'+ref.slice(1);
 const mv=k=>{const ref=meta[k];if(!ref){issue('error','FIELD_REQUIRED',info.name,null,k,`缺少字段“${k}”`,'cost');return null;}return read(info,ref,'cost');};
 const mn=(k,integer=false)=>{mv(k);return num(info,meta[k]??'B0',{role:'cost',integer});};
 const md=k=>{const x=mv(k);try{return excelDate(x,costBook.epoch1904);}catch(e){issue('error','DATE_INVALID',info.name,meta[k],k,e.message,'cost');return null;}};
 const template=mv('模板版本');if(template!=='A-ORDER-0.2')issue('error','VERSION_UNSUPPORTED',info.name,meta['模板版本'],'模板版本','只支持A-ORDER-0.2','cost');
 const demo=(value,sheet,cell,role)=>{if(!['是','否'].includes(value))issue('error','DEMO_INVALID',sheet.name,cell,null,'是否模拟必须明确为是或否',role);return value==='是';};
 if(!/^AB-TIME-0\.2(?:\s*\||$)/.test(read(prod,'A4')??''))issue('error','VERSION_UNSUPPORTED',prod.name,'A4',null,'每日表只支持AB-TIME-0.2');
 const order={id:mv('订单ID'),lineId:mv('核算子项ID'),quantity:mn('合同数量',true),price:mn('核算报价'),weight:mn('模拟标准重量'),start:md('生产覆盖开始'),end:md('生产覆盖结束'),timezone:mv('时区'),isDemo:demo(mv('是否模拟'),info,meta['是否模拟'],'cost'),product:mv('产品'),customer:mv('客户代号'),taxBasis:mv('税口径'),incomeBasis:mv('收入口径'),opening:mn('期初加工/不良',true)};
 if(order.opening!==null&&order.opening!=='0')issue('error','OPENING_UNSUPPORTED',info.name,meta['期初加工/不良'],null,'首版仅支持完整周期零期初；非零期初需要配套收入和成本','cost');
 if(order.taxBasis!=='模拟报价不拆税')issue('error','TAX_UNSUPPORTED',info.name,meta['税口径'],null,'首版仅支持模拟报价不拆税','cost');
 for(const key of ['id','lineId'])if(!order[key]||order[key].length>128)issue('error','ID_INVALID',info.name,null,key,'订单标识必填且不超过128字符','cost');
 if(order.timezone!=='Asia/Shanghai'||order.incomeBasis!=='生产等价')issue('error','BASIS_UNSUPPORTED',info.name,null,null,'首版只支持Asia/Shanghai和生产等价收入','cost');
 if(order.start&&order.end&&(order.start>order.end||(new Date(order.end)-new Date(order.start))/86400000>3660))issue('error','DATE_RANGE',info.name,null,null,'日期范围须有序且不超过3660天','cost');
 if(order.weight!==null&&new Decimal(order.weight).lte(0))issue('error','WEIGHT_INVALID',info.name,meta['模拟标准重量'],null,'标准重量必须大于0','cost');
 const baseline={id:mv('预期基线版本'),params:{},recipe:[],sizePlan:[]},revision={id:mv('数据修订版本')};
 const source=(s,ref,role,id)=>({fileRole:role,sheet:s.name,cell:ref,recordId:id,fileHash:(role==='cost'?costBook:dailyBook).hash});
 const tableRows=(sheet,tableName,headerRow=5,firstColumn='A')=>{
  const tb=sheet.tables?.find(t=>t.name===tableName);let last=0,lo=0,hi=16384;
  if(!tb){issue('error','TABLE_REQUIRED',sheet.name,null,tableName,`缺少命名Table：${tableName}`,sheet===orig||sheet===cost||sheet===supp?'cost':'daily');return [];}
  if(tb){const mm=tb.ref.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);if(!mm){issue('error','TABLE_INVALID',sheet.name,null,null,'Excel表范围无效');return [];}headerRow=Number(mm[2]);last=Number(mm[4]);lo=columnIndex(mm[1]);hi=columnIndex(mm[3]);}
  const heads={};for(const [ref,c]of Object.entries(sheet.cells)){const mm=ref.match(/^([A-Z]+)(\d+)$/);if(Number(mm?.[2])===headerRow&&columnIndex(mm[1])>=lo&&columnIndex(mm[1])<=hi&&c.value)heads[c.value]=mm[1];}
  if(!last){last=headerRow;while(sheet.cells[firstColumn+(last+1)]?.value!=null&&sheet.cells[firstColumn+(last+1)]?.value!=='')last++;}
  return Array.from({length:Math.max(0,last-headerRow)},(_,i)=>{const r=headerRow+i+1;return {row:r,ref:k=>(heads[k]??'??')+r,get:k=>read(sheet,(heads[k]??'??')+r,sheet===orig||sheet===cost||sheet===supp?'cost':'daily')};});
 };
 for(const r of tableRows(cost,'CostParameters',34)){
  const id=r.get('参数ID');if(!id)continue;if(id in baseline.params)issue('error','PARAM_DUPLICATE',cost.name,r.ref('参数ID'),id,'参数ID重复','cost');
  baseline.params[id]=id==='price_change_date'?r.get('输入值'):num(cost,r.ref('输入值'),{role:'cost'});
 }
 const needed=['material_pct','prep_piece','press_piece','production_mgmt','energy_pct','company_mgmt','admin_pct','logistics_piece','production_loss_budget','defect_loss_budget','other_production_piece','finance_piece'];
 for(const id of needed)if(!(id in baseline.params)){baseline.params[id]=null;issue('missing','PARAM_MISSING',cost.name,null,id,`缺少参数${id}`,'cost');}
 for(const [id,value]of Object.entries(baseline.params))if(id.endsWith('_pct')||['production_mgmt','company_mgmt','production_loss_budget','defect_loss_budget'].includes(id))if(value!==null&&new Decimal(value).gt(1))issue('error','RATE_INVALID',cost.name,null,id,'比例应在0到1之间','cost');
 for(const r of tableRows(orig,'OriginalRecipe')){const id=r.get('材料编号');if(!id)continue;baseline.recipe.push({id,quantity:num(orig,r.ref('原表配方量kg'),{role:'cost'}),referencePrice:num(orig,r.ref('原表参考单价元/kg'),{role:'cost'}),source:source(orig,r.ref('材料编号'),'cost',id)});}
 for(const r of tableRows(orig,'OriginalSizePlan',5,'K')){const id=r.get('码号');if(!id)continue;baseline.sizePlan.push({id,quantity:num(orig,r.ref('分码合同量 双'),{role:'cost',integer:true}),source:source(orig,r.ref('码号'),'cost',id)});}
 if(!baseline.recipe.length||baseline.recipe.every(m=>m.quantity==='0'))issue('error','RECIPE_INVALID',orig.name,null,null,'配方总量必须大于0','cost');
 for(const [items,key]of [[baseline.recipe,'材料编号'],[baseline.sizePlan,'码号']])if(new Set(items.map(x=>x.id)).size!==items.length)issue('error','KEY_DUPLICATE',orig.name,null,key,`${key}重复`,'cost');
 if(order.quantity!==null&&baseline.sizePlan.every(s=>s.quantity!==null)&&!new Decimal(order.quantity).eq(Decimal.sum(...baseline.sizePlan.map(s=>s.quantity))))issue('error','QUANTITY_MISMATCH',orig.name,null,null,'分码合同数量与订单数量不一致','cost');
 const common=(r,s,idKey='记录ID',role='daily')=>{
  const x={id:r.get(idKey),orderId:r.get('订单ID'),lineId:r.get('核算子项ID'),status:r.get('资料状态'),source:source(s,r.ref(idKey),role,r.get(idKey))};
  if(!x.id)issue('error','ID_INVALID',s.name,r.ref(idKey),idKey,'记录ID必填',role);
  if(x.orderId!==order.id||x.lineId!==order.lineId)issue('error','ORDER_MISMATCH',s.name,r.ref('订单ID'),null,'订单与子项跨文件不一致',role);
  if(!STATUSES.includes(x.status))issue('error','STATUS_INVALID',s.name,r.ref('资料状态'),null,'资料状态无效',role);
  try{x.date=excelDate(r.get(s===prod?'生产日期':'发生日期'),role==='cost'?costBook.epoch1904:dailyBook.epoch1904);if(x.date<order.start||x.date>order.end)throw new Error('记录日期超出覆盖区间');}catch(e){x.date=null;issue('error','DATE_INVALID',s.name,r.ref('发生日期'),null,e.message,role);}
  if(role==='daily'){
   if(r.get('预期基线版本')!==baseline.id||r.get('数据修订版本')!==revision.id)issue('error','VERSION_MISMATCH',s.name,r.ref('预期基线版本'),null,'预期基线或修订版本跨文件不一致');
   try{x.availableAt=excelDate(r.get('数据可见时间'),dailyBook.epoch1904,true);if(x.date&&x.availableAt.slice(0,10)<x.date)throw new Error('可见时间早于发生日期');}catch(e){issue('error','DATE_INVALID',s.name,r.ref('数据可见时间'),null,e.message);x.availableAt=null;}
   x.isDemo=demo(r.get('是否模拟'),s,r.ref('是否模拟'),role);if(x.isDemo!==order.isDemo)issue('error','DEMO_MISMATCH',s.name,r.ref('是否模拟'),null,'模拟标记不一致');
   if(!r.get('来源'))issue('error','SOURCE_REQUIRED',s.name,r.ref('来源'),null,'来源必填');
  }else x.availableAt=x.date+'T23:59:59+08:00';
  return x;
 };
 const production=tableRows(prod,'DailyProductionCase').map(r=>{
  const x={...common(r,prod),size:r.get('码号'),processed:num(prod,r.ref('当日加工量'),{integer:true}),defects:num(prod,r.ref('当日不良量'),{integer:true}),dayStatus:r.get('当日状态')};
  if(!baseline.sizePlan.some(s=>s.id===x.size&&s.quantity!=='0'))issue('error','SIZE_UNKNOWN',prod.name,r.ref('码号'),null,'未知或非生产码号');
  if(x.processed!==null&&x.defects!==null&&new Decimal(x.defects).gt(x.processed))issue('error','QUANTITY_INVALID',prod.name,r.ref('当日不良量'),null,'不良量不能大于加工量');
  if(!['已报工','停产','待补录'].includes(x.dayStatus)||(x.dayStatus==='停产'&&(x.processed!=='0'||x.defects!=='0')))issue('error','DAY_STATUS_INVALID',prod.name,r.ref('当日状态'),null,'停产数量应明确为0，或报工状态无效');
  return x;
 });
 const materials=tableRows(mat,'DailyMaterialCase').map(r=>{const x={...common(r,mat),materialId:r.get('材料编号'),net:num(mat,r.ref('实际净耗kg')),price:num(mat,r.ref('实际单价元/kg'))};if(!baseline.recipe.some(m=>m.id===x.materialId))issue('error','MATERIAL_UNKNOWN',mat.name,r.ref('材料编号'),null,'未知材料');if(r.get('材料口径')!=='actual_net')issue('error','MATERIAL_BASIS',mat.name,r.ref('材料口径'),null,'实际材料必须为actual_net净耗口径');return x;});
 const expenses=tableRows(fee,'DailyExpenseCase').map(r=>{const x={...common(r,fee),category:r.get('成本类别'),item:r.get('费用项目'),amount:num(fee,r.ref('实际金额元'))};if(!CATEGORIES.includes(x.category))issue('error','CATEGORY_INVALID',fee.name,r.ref('成本类别'),null,'费用类别无效');if(r.get('计价方式')!=='直接金额')issue('error','METHOD_UNSUPPORTED',fee.name,r.ref('计价方式'),null,'首版每日费用采用已归属直接金额');return x;});
 const supplements=tableRows(supp,'SupplementEvents').map(r=>{const x={...common(r,supp,'补单记录ID','cost'),size:r.get('码号'),quantity:num(supp,r.ref('补产数量双'),{role:'cost',integer:true}),parentId:r.get('生产关联ID'),inclusion:r.get('计入规则'),reason:r.get('原因')};if(!x.inclusion?.startsWith('已含'))issue('error','SUPPLEMENT_BASIS',supp.name,r.ref('计入规则'),null,'首版只支持已含加工/净耗的补单','cost');const p=production.find(p=>p.id===x.parentId);if(!p||p.date!==x.date||p.size!==x.size||(x.quantity!==null&&p.processed!==null&&new Decimal(x.quantity).gt(p.processed)))issue('error','SUPPLEMENT_LINK',supp.name,r.ref('生产关联ID'),null,'补单关联生产记录无效','cost');return x;});
 for(const list of [production,materials,expenses,supplements]){const seen=new Set();for(const x of list){if(seen.has(x.id))issue('error','RECORD_DUPLICATE',x.source.sheet,x.source.cell,null,'记录ID重复',x.source.fileRole,x.id);seen.add(x.id);}}
 const pkeys=new Set();for(const p of production){const k=p.date+'|'+p.size;if(pkeys.has(k))issue('error','DAY_SIZE_DUPLICATE',prod.name,p.source.cell,null,'日码记录重复');pkeys.add(k);}
 if(order.start&&order.end&&order.start<=order.end&&(new Date(order.end)-new Date(order.start))/86400000<=3660)for(let day=order.start;day<=order.end;day=addDays(day,1))for(const sz of baseline.sizePlan.filter(s=>s.quantity!==null&&new Decimal(s.quantity).gt(0)))if(!pkeys.has(day+'|'+sz.id))issue('missing','DAY_MISSING',prod.name,null,day,`${day} ${sz.id}生产记录待补齐`);
 const defectTotal=production.reduce((s,p)=>s+Number(p.defects??0),0),suppTotal=supplements.reduce((s,p)=>s+Number(p.quantity??0),0);if(defectTotal!==suppTotal)issue('warning','SUPPLEMENT_DIFFERENCE',supp.name,null,null,`不良${defectTotal}双与补单${suppTotal}双不同；保留差异，不重复计入`,'cost');
 for(const name of [baseline.id,revision.id])if(!name||name.length>128)issue('error','VERSION_REQUIRED',info.name,null,null,'基线与修订ID必填且不超过128字符','cost');
 const dataset={schemaVersion:SCHEMA_VERSION,order,baseline,revision,production,materials,expenses,supplements,sourceFiles:{cost:costBook.hash,daily:dailyBook.hash}};
 return {dataset,issues,summary:{orderId:order.id,lineId:order.lineId,baselineId:baseline.id,revisionId:revision.id,isDemo:order.isDemo,start:order.start,end:order.end,counts:{production:production.length,supplements:supplements.length,materials:materials.length,expenses:expenses.length}}};
}
