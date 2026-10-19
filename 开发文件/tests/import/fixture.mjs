import {zipSync,strToU8} from 'fflate';
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
export function zipWorkbook(sheets,{epoch1904=false}={}){
 const files={};const put=(p,x)=>files[p]=strToU8(x);
 put('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
 put('xl/workbook.xml',`<workbook xmlns:r="r"><workbookPr date1904="${epoch1904?1:0}"/><sheets>${sheets.map((s,i)=>`<sheet name="${esc(s.name)}" sheetId="${i+1}" r:id="r${i+1}"/>`).join('')}</sheets></workbook>`);
 put('xl/_rels/workbook.xml.rels',`<Relationships>${sheets.map((s,i)=>`<Relationship Id="r${i+1}" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`);
 sheets.forEach((s,i)=>put(`xl/worksheets/sheet${i+1}.xml`,`<worksheet><sheetData>${Object.entries(s.cells).map(([ref,v])=>`<row><c r="${ref}" ${typeof v==='string'?'t="inlineStr"':''}>${v?.formula?`<f>${esc(v.formula)}</f><v>99</v>`:typeof v==='string'?`<is><t>${esc(v)}</t></is>`:`<v>${v??''}</v>`}</c></row>`).join('')}</sheetData></worksheet>`));
 sheets.forEach((s,i)=>{if(!s.tables?.length)return;put(`xl/worksheets/_rels/sheet${i+1}.xml.rels`,`<Relationships>${s.tables.map((t,j)=>`<Relationship Id="t${j}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${i}_${j}.xml"/>`).join('')}</Relationships>`);s.tables.forEach((t,j)=>put(`xl/tables/table${i}_${j}.xml`,`<table name="${t.name}" ref="${t.ref}"/>`));});
 return Buffer.from(zipSync(files));
}
const tableDefinitions={'成本计算':[{name:'CostParameters',ref:'A34:C51'}],'原订单用量':[{name:'OriginalRecipe',ref:'A5:D6'},{name:'OriginalSizePlan',ref:'K5:M6'}],'补单用量':[{name:'SupplementEvents',ref:'A5:P5'}],'每日生产':[{name:'DailyProductionCase',ref:'A5:P6'}],'每日材料':[{name:'DailyMaterialCase',ref:'A5:R6'}],'每日费用':[{name:'DailyExpenseCase',ref:'A5:O11'}]};
export function fakeBook(sheets){return {epoch1904:false,hash:'fixture',sheets:sheets.map(s=>({...s,tables:tableDefinitions[s.name]??[],cells:Object.fromEntries(Object.entries(s.cells).map(([ref,v])=>[ref,{ref,value:v===null?null:String(v),kind:typeof v==='number'?'number':'text'}]))}))};}
export const params={material_pct:.65,prep_piece:.7,press_piece:1.6,production_mgmt:.028,energy_pct:.004,company_mgmt:.013,admin_pct:.017,logistics_piece:.7,production_loss_budget:.006,defect_loss_budget:.018,actual_extra_net:.005,actual_price_increase:.02,actual_labor_increase:.03,price_change_date:46200,other_production_piece:0,finance_piece:0};
export function pair(){
 const info={A5:'字段',B5:'填写值'};Object.entries({'模板版本':'A-ORDER-0.2','订单ID':'SIM-TEST','核算子项ID':'LINE-1','合同数量':100,'核算报价':17.2,'模拟标准重量':.65,'生产覆盖开始':46237,'生产覆盖结束':46237,'预期基线版本':'BASE-1','数据修订版本':'REV-1','时区':'Asia/Shanghai','是否模拟':'是','产品':'测试中底','客户代号':'TEST','税口径':'模拟报价不拆税','收入口径':'生产等价','期初加工/不良':0}).forEach(([k,v],i)=>{info[`A${6+i}`]=k;info[`B${6+i}`]=v;});
 const cost={A34:'参数ID',B34:'费用或参数',C34:'输入值'};Object.entries(params).forEach(([k,v],i)=>{cost[`A${35+i}`]=k;cost[`C${35+i}`]=v;});
 const recipe={A5:'材料编号',C5:'原表配方量kg',D5:'原表参考单价元/kg',A6:'0012',C6:1,D6:20,K5:'码号',M5:'分码合同量 双',K6:'4.5#',M6:100};
 const prod={A4:'AB-TIME-0.2 | synthetic',A5:'记录ID',B5:'订单ID',C5:'核算子项ID',D5:'生产日期',E5:'码号',F5:'当日加工量',G5:'当日不良量',H5:'当日状态',I5:'资料状态',J5:'数据可见时间',K5:'来源',L5:'是否模拟',O5:'预期基线版本',P5:'数据修订版本'};
 ['PD-1','SIM-TEST','LINE-1',46237,'4.5#',100,0,'已报工','模拟确认',46237.9999884259,'synthetic','是'].forEach((v,i)=>prod[`${String.fromCharCode(65+i)}6`]=v);prod.O6='BASE-1';prod.P6='REV-1';
 const mat={A5:'记录ID',B5:'订单ID',C5:'核算子项ID',D5:'发生日期',E5:'材料编号',F5:'实际净耗kg',G5:'实际单价元/kg',H5:'材料口径',I5:'资料状态',J5:'数据可见时间',K5:'来源',L5:'是否模拟',Q5:'预期基线版本',R5:'数据修订版本'};
 ['MAT-1','SIM-TEST','LINE-1',46237,'0012',65,17.2,'actual_net','模拟确认',46237.9999884259,'synthetic','是'].forEach((v,i)=>mat[`${String.fromCharCode(65+i)}6`]=v);mat.Q6='BASE-1';mat.R6='REV-1';
 const fee={A5:'记录ID',B5:'订单ID',C5:'核算子项ID',D5:'发生日期',E5:'成本类别',F5:'费用项目',G5:'计价方式',H5:'实际金额元',I5:'资料状态',J5:'数据可见时间',K5:'来源',L5:'是否模拟',N5:'预期基线版本',O5:'数据修订版本'};
 ['人工','制造','其他生产','管理','销售','财务'].forEach((cat,i)=>['F-'+i,'SIM-TEST','LINE-1',46237,cat,'测试费用','直接金额',0,'模拟确认',46237.9999884259,'synthetic','是','BASE-1','REV-1'].forEach((v,j)=>fee[`${j<12?String.fromCharCode(65+j):String.fromCharCode(66+j)}${6+i}`]=v));
 return [fakeBook([{name:'成本计算',cells:cost},{name:'订单信息',cells:info},{name:'原订单用量',cells:recipe},{name:'补单用量',cells:{A5:'补单记录ID'}}]),fakeBook([{name:'每日生产',cells:prod},{name:'每日材料',cells:mat},{name:'每日费用',cells:fee}])];
}
