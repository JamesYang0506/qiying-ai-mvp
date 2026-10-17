import {esc} from './ui.js';import {renderTrend,renderCostDonut} from './charts.js';import {importClient} from './import-api.js';
const fmt=x=>x==null?'待补齐':new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(x));
const num=x=>x==null?null:Number(x);
export function renderImportedVariance(items){const max=Math.max(1,...items.map(x=>Math.abs(x.delta??0)));return `<div class="variance-bars">${items.map(x=>`<button class="variance-row" data-variance="${esc(x.key??'')}" ${x.key?'':'tabindex="-1"'}>${x.key?'<span class="variance-name">':'<span>'}${esc(x.name)}</span><div class="bar-track"><div class="bar-fill ${x.delta>0?'red':'green'}" style="width:${Math.abs(x.delta??0)/max*100}%"></div></div><strong class="${x.delta>0?'negative':x.delta<0?'positive':''}">${x.delta===null?'待补齐':(x.delta>0?'+':x.delta<0?'−':'')+'¥'+fmt(Math.abs(x.delta))}</strong></button>`).join('')}</div>`;}
export function renderImportedDiagnosis(a){
 const d=a?.diagnosis,ref=a?.referenceThresholds;
 if(!d)return `<section class="diagnosis-verdict pending"><div class="verdict-mark">…</div><div><h2>差距原因待补齐</h2><p>诊断结果未返回，暂不判断主因。</p></div></section>`;
 const sev=d.severity,sevKnown=sev&&sev.tone&&sev.tone!=='pending';
 let verdictClass=d.state==='gap'?'bad':d.state==='at_target'?'ok':'pending';
 let mark=d.state==='gap'?'!':d.state==='at_target'?'✓':'…';
 let verdictTitle=d.summary.title,verdictSub=d.summary.sub;
 if(sevKnown){
  const one=x=>Number(x).toFixed(1);
  const sevSub=sev.level==='better'
   ?`实际毛利率 ${pct(sev.actual)}，高于同进度理论 ${pct(sev.expected)} ${one(sev.differenceAbsPp)} 个百分点。`
   :sev.level==='normal'&&Number(sev.decline)===0
   ?`实际毛利率 ${pct(sev.actual)}，与同进度理论 ${pct(sev.expected)} 持平。`
   :`实际毛利率 ${pct(sev.actual)}，同进度理论 ${pct(sev.expected)}，下降 ${one(sev.declineAbsPct)}%（${one(sev.differenceAbsPp)} 个百分点），属于${sev.label}。`;
  if(sev.tone==='ok'&&d.state==='pending'){
   verdictClass='pending';mark='…';verdictTitle='毛利率处于可接受范围，差距原因待补齐';verdictSub=`${sevSub} ${d.summary.sub}`;
  }else{
   verdictClass=sev.tone==='bad'?'bad':sev.tone==='caution'?'caution':'ok';
   mark=sev.tone==='ok'?'✓':'!';
   verdictTitle=sev.level==='better'?'毛利率优于同进度理论':sev.level==='normal'?(Number(sev.decline)===0?'毛利率与同进度理论持平':'毛利率处于可接受误差范围'):sev.level==='severe'?'毛利率出现大型偏差':sev.level==='key'?'毛利率偏差较大':'毛利率需要关注';
   verdictSub=(d.state==='gap'||d.state==='pending')?`${sevSub} ${d.summary.sub}`:sevSub;
  }
 }
 const sevNote=sev?`<p class="verdict-rule">偏差分级 ${esc(sev.ruleVersion)}：相对同进度理论毛利率下降 0–10% 为可接受误差，10–20% 需关注，20–30% 重点注意，超过 30% 为大型偏差。</p>`:'';
 const signed=v=>v==null?'待补齐':(Number(v)>0?'+¥':Number(v)<0?'−¥':'¥')+fmt(Math.abs(Number(v)));
 const share=c=>c.shareOfIncrease==null?'':`占增支 ${(Number(c.shareOfIncrease)*100).toFixed(1)}%`;
 const cause=c=>`<article class="cause ${c.effect==='increase'?'bad':c.effect==='offset'?'ok':'pending'}"><span>${esc(c.label)}</span><strong>${signed(c.amount)}</strong><em>${c.effect==='increase'?(share(c)||'增支项'):c.effect==='offset'?'抵消差距':c.effect==='neutral'?'无净影响':'待补齐'}</em><p>${esc(c.fact)}</p>${c.kind==='production'&&c.amount!=null?`<button class="link cause-link" data-variance="${esc(c.key)}">查看逐日来源</button>`:''}</article>`;
 const causeGrid=list=>`<div class="cause-grid">${list.map(cause).join('')}</div>`;
 const incNote=d.increasesTotal!=null?`增支合计 ¥${fmt(d.increasesTotal)}`:`已知增支合计 ¥${fmt(d.knownIncreasesTotal)}，归因不完整`;
 const offNote=d.offsetsTotal!=null?`抵消合计 ${signed(d.offsetsTotal)}`:`已知抵消合计 ${signed(d.knownOffsetsTotal)}，归因不完整`;
 const advice=d.suggestions?.length?`<section class="panel diagnosis-advice"><div class="panel-head"><h2>建议核查</h2><span class="muted">可能原因，需进一步核实</span></div><div class="panel-body"><ol>${d.suggestions.map(s=>`<li><strong>${esc(s.label)}</strong><span>${esc(s.text)}</span><small>证据：截至 ${esc(s.evidence?.asOf??'待补齐')} · 修订 ${esc(s.evidence?.revisionId??'待补齐')} · 基线 ${esc(s.evidence?.baselineId??'待补齐')} · ${esc(s.evidence?.source??'')}</small></li>`).join('')}</ol></div></section>`:'';
 const basisLabels={revenue:'预算理论收入',gross:'预算理论毛利',reserve:'预算损耗准备金',material:'预算材料',labor:'预算人工',quantity:'合同数量',unitCost:'材料及人工单位成本',allowedQuantity:'允许补产量',processed:'累计加工量',defects:'累计不良量'};
 const moneyKeys=new Set(['revenue','gross','reserve','material','labor','unitCost','allowedQuantity']);
 const basisRows=t=>Object.entries(t.basis??{}).map(([k,v])=>`<div><dt>${esc(basisLabels[k]??k)}</dt><dd>${v==null?'待补齐':(moneyKeys.has(k)?'¥'+fmt(v):v)}</dd></div>`).join('');
 const refCard=t=>{
  const bad=t.breached===true,known=t.status==='known',state=!known?'pending':bad?'bad':'ok';
  const verdict=!known?'待核算':bad?`${t.key==='margin'?'低于':'高于'}参考阈值 ${t.gapPp} 个百分点`:'未越过参考阈值';
  return `<div class="limit ${state}"><span>${esc(t.label)}</span><strong>${t.actual==null?'待补齐':pct(t.actual)}<em> / 参考阈值 ${t.threshold==null?'待核算':pct(t.threshold)}</em></strong><p>${verdict}</p>${t.reasons?.length?`<p class="limit-reasons">${esc(t.reasons.join('；'))}</p>`:''}<details class="threshold-detail"><summary>查看公式与参数</summary><div class="threshold-body"><p>${esc(t.formula)}</p><dl class="threshold-kv">${basisRows(t)}</dl><p class="footnote">单位：${esc(t.unit)} · 基线：${esc(ref?.baselineId??'待补齐')} · 规则：${esc(ref?.ruleVersion??'待补齐')}</p><p class="footnote">参数来源：${esc(t.source)}</p><p class="footnote">适用条件：${esc(t.applicability)}</p></div></details></div>`;
 };
 const refState=ref?.state,refTitle=refState==='breach'?'参考阈值提示':refState==='ok'?'未越过参考阈值':'参考阈值待核算';
 const refLines=ref?[...(ref.breaches??[]),...(ref.unknownItems??[]).map(x=>`${x.label}：${x.reasons.join('；')}`)]:[];
 const refAlert=`<div class="limit-alert ${refState==='breach'?'bad':refState==='ok'?'ok':''}"><h3>${esc(refTitle)}</h3><p>${refLines.length?esc(refLines.join('；'))+'。':'毛利率与不良率均未越过参考阈值。'}</p></div>`;
 const refHtml=ref?`<section class="panel diagnosis-limits"><div class="panel-head"><h2>预算模型参考阈值</h2><span class="muted">${esc(ref.ruleVersion)} · 基线 ${esc(ref.baselineId??'待补齐')}</span></div><div class="panel-body"><div class="limit-grid">${refCard(ref.margin)}${refCard(ref.defect)}</div>${refAlert}<p class="footnote">${esc(ref.note)} 适用条件：${esc(ref.applicability)}</p></div></section>`:`<section class="panel diagnosis-limits"><div class="panel-head"><h2>预算模型参考阈值</h2></div><div class="panel-body"><div class="limit-alert"><h3>参考阈值待核算</h3><p>服务端未返回参考阈值结果。</p></div></div></section>`;
 const increaseHtml=d.increases.length?`<section class="panel diagnosis-group"><div class="panel-head"><h2>增加差距的项目</h2><span class="muted">${incNote}</span></div><div class="panel-body">${causeGrid(d.increases)}</div></section>`:'';
 const offsetHtml=d.offsets.length?`<section class="panel diagnosis-group"><div class="panel-head"><h2>抵消差距的项目</h2><span class="muted">${offNote}</span></div><div class="panel-body">${causeGrid(d.offsets)}</div></section>`:'';
 const unknownProd=d.unknowns.filter(c=>c.kind==='production');
 const unknownHtml=unknownProd.length?`<section class="panel diagnosis-group"><div class="panel-head"><h2>待补齐项目</h2><span class="muted">资料不完整时不按零计</span></div><div class="panel-body">${causeGrid(unknownProd)}</div></section>`:'';
 const adjustHtml=`<section class="panel diagnosis-group"><div class="panel-head"><h2>基线调整与舍入</h2><span class="muted">对照口径，不计入生产原因</span></div><div class="panel-body"><div class="adjust-list">${[d.baseline,d.rounding].map(c=>`<div class="adjust-row ${c.amount==null?'pending':''}"><span>${esc(c.label)}</span><strong>${signed(c.amount)}</strong><p>${esc(c.fact)}</p></div>`).join('')}</div><p class="footnote">归因规则 ${esc(d.rule.version)} · 主因阈值 ${esc(d.rule.primaryShareThreshold)} · 占比口径：${esc(d.rule.shareLabel)}（分母为${esc(d.rule.shareDenominator)}）。${esc(d.rule.note)}</p></div></section>`;
 return `<section class="diagnosis-verdict ${verdictClass}"><div class="verdict-mark">${mark}</div><div><h2>${esc(verdictTitle)}</h2><p>${esc(verdictSub)}</p>${sevNote}</div></section>${advice}${increaseHtml}${offsetHtml}${unknownHtml}${adjustHtml}${refHtml}`;
}
const pct=x=>x==null?'—':(Number(x)*100).toFixed(1)+'%';
const stateText={complete:'资料完整',provisional:'含暂估资料',incomplete:'生产或成本待补齐',operating_incomplete:'经营费用待补齐',not_started:'尚未开工'};
const table=(headers,rows,empty='当日没有可见记录。')=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(v=>`<td>${v&&typeof v==='object'&&'html'in v?v.html:esc(v??'待补齐')}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">${esc(empty)}</td></tr>`}</tbody></table></div>`;
const option=(v,label,selected)=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(label)}</option>`;
const card=(title,value,note,key,tone='')=>`<button class="stat-card clickable ${tone?'tone-'+tone:''}" data-drill="${key}"><span class="stat-top"><span>${title}</span><span class="drill-hint">查看依据</span></span><span class="stat-value">${value}</span><span class="stat-foot">${note}</span></button>`;
const kvRows=rows=>rows.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
const offset=(date,n)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const COLORS={material:'#4b8bf5',人工:'#7ac7a8',制造:'#f2b46b',其他生产:'#b79df0',管理:'#8fb3d9',销售:'#e58f9a',财务:'#b9c3d0'};
const labels={materialPrice:'材料价格影响',materialUsage:'材料耗用影响',labor:'人工影响',energy:'能源影响',otherManufacturing:'其他制造影响',otherProduction:'其他生产影响',budgetAdjustment:'预算允许损耗',rounding:'舍入调整'};
const varianceDefs={
 materialPrice:{formula:'Σ(当天各材料实际净耗 × (实际单价 − 理论单价))',source:'每日材料（净耗、单价）；理论单价由成本计算的报价材料占比与标准重量校准。'},
 materialUsage:{formula:'Σ((实际净耗 − 合格量 × 标准重量 × 配方占比) × 理论单价)',source:'每日生产（合格量）、每日材料（净耗）、原订单用量（配方占比）。'},
 labor:{formula:'实际人工费用 − 同进度理论人工（数量 × 准备与压制计件单价）',source:'每日费用（人工）、成本计算 CostParameters。'},
 energy:{formula:'实际“能源”费用 − 同进度理论能源（收入 × 能源占比）',source:'每日费用（制造中的能源项目）、成本计算 CostParameters。'},
 otherManufacturing:{formula:'实际制造费用 − 能源实际 − 同进度理论生产管理（收入 × 生产管理占比）',source:'每日费用（制造）、成本计算 CostParameters。'},
 otherProduction:{formula:'实际其他生产费用 − 同进度理论其他生产（数量 × 单价）',source:'每日费用（其他生产）、成本计算 CostParameters。'},
 budgetAdjustment:{formula:'预算模式下理论损耗预算取相反数；理想模式为 0',source:'成本计算中的生产损耗与不良损耗预算。'},
 rounding:{formula:'总差距 − 其余各项合计，用于保证归因精确闭合',source:'逐日舍入后的差值，不是业务成本。'}
};
export function mountImported(root,{orderId,client=importClient}={}){
 let alive=true,seq=0,orders=[],selected=null,revision='',revisions=[],date='',mode='ideal',analysis=null,points=[],portfolio=null,tab='production',view='overview',drill=null,varianceLimit=30,focus=null,drillNote='',returnState=null;
 const status=()=>root.querySelector('#imported-status');
 const fileRoleLabel={cost:'成本文件',daily:'每日文件'};
 const sourceCell=r=>{const s=r?.source;if(!s)return '待补齐';return {html:`<details class="source-detail"><summary>查看来源</summary><span>${esc(fileRoleLabel[s.fileRole]??s.fileRole??'')} · ${esc(s.sheet??'')} · ${esc(s.cell??'')}</span>${r.availableAt?`<span>可见 ${esc(r.availableAt)}</span>`:''}</details>`};};
 const relatedProduction=r=>r.parentId?{html:`<button class="link" data-focus-production="${esc(r.parentId)}">${esc(r.parentId)}</button>`}:'待补齐';
 const focusLabel=f=>!f?'':f.tab==='materials'?'材料记录':f.tab==='production'?(f.recordId?`生产记录 ${f.recordId}`:'生产记录'):f.tab==='expenses'?`费用记录${f.category?' · '+f.category:''}${f.itemIncludes?' · '+f.itemIncludes:''}${f.excludeItemIncludes?'（不含'+f.excludeItemIncludes+'）':''}`:'原始记录';
 const drillTarget=key=>{
  if(key==='materialPrice'||key==='materialUsage')return {tab:'materials',focus:{tab:'materials'}};
  if(key==='labor')return {tab:'expenses',focus:{tab:'expenses',category:'人工'}};
  if(key==='energy')return {tab:'expenses',focus:{tab:'expenses',category:'制造',itemIncludes:'能源'}};
  if(key==='otherManufacturing')return {tab:'expenses',focus:{tab:'expenses',category:'制造',excludeItemIncludes:'能源'}};
  if(key==='otherProduction')return {tab:'expenses',focus:{tab:'expenses',category:'其他生产'}};
  if(key==='budgetAdjustment')return {tab:'production',focus:null,note:'预算允许损耗来自成本模型基线，不是逐日生产或费用记录。'};
  if(key==='rounding')return {tab:'production',focus:null,note:'舍入调整仅用于金额闭合，没有逐日原始记录。'};
  return {tab:'production',focus:null};
 };
 const renderDetails=()=>{
  const rows=analysis?.daily?.rows??{production:[],materials:[],expenses:[],supplements:[]};
  if(tab==='production'){
   const list=focus?.tab==='production'&&focus.recordId?rows.production.filter(r=>r.id===focus.recordId):rows.production;
   return table(['日期','记录ID','码号','加工量','不良量','合格量','资料状态','来源'],list.map(r=>[r.date,r.id,r.size,r.processed,r.defects,r.processed===null||r.defects===null?null:Number(r.processed)-Number(r.defects),r.status,sourceCell(r)]),focus?.tab==='production'?`当前定位${focus.recordId?`记录 ${focus.recordId}`:''}下没有生产记录。`:'当日没有可见生产记录。');
  }
  if(tab==='materials')return table(['材料编号','净耗kg','单价元/kg','资料状态','记录ID','来源'],rows.materials.map(r=>[r.materialId,r.net,r.price,r.status,r.id,sourceCell(r)]),'当日没有可见材料记录。');
  if(tab==='expenses'){
   const list=rows.expenses.filter(r=>{
    if(!focus||focus.tab!=='expenses')return true;
    if(focus.category&&r.category!==focus.category)return false;
    if(focus.itemIncludes&&!String(r.item??'').includes(focus.itemIncludes))return false;
    if(focus.excludeItemIncludes&&String(r.item??'').includes(focus.excludeItemIncludes))return false;
    return true;
   });
   return table(['类别','项目','实际金额元','资料状态','记录ID','来源'],list.map(r=>[r.category,r.item,fmt(r.amount),r.status,r.id,sourceCell(r)]),focus?.tab==='expenses'?'当前定位下没有费用记录。':'当日没有可见费用记录。');
  }
  return table(['码号','补产数量','补单记录ID','关联生产','计入规则','原因','来源'],rows.supplements.map(r=>[r.size,r.quantity,r.id,relatedProduction(r),r.inclusion,r.reason,sourceCell(r)]),'当日没有补单记录。');
 };
 const donutItems=a=>{const ac=a.cumulative.actual;return [{name:'材料',value:num(ac.material),display:'¥'+fmt(ac.material),color:COLORS.material},...['人工','制造','其他生产','管理','销售','财务'].map(k=>({name:k,value:num(ac.costs?.[k]),display:'¥'+fmt(ac.costs?.[k]),color:COLORS[k]}))];};
 const cardRows=(a,key)=>{
  const c=a.cumulative,t=a.theoreticalTotal;
  if(key==='theoretical')return [['合同数量',`${a.order.quantity??'待补齐'} 双`],['核算报价',`${fmt(a.order.price)} 元/双`],['标准重量',`${a.order.weight??'待补齐'} kg/双`],['理论收入',fmt(t.revenue)],['材料',fmt(t.material)],['人工',fmt(t.labor)],['生产管理',fmt(t.productionManagement)],['能源',fmt(t.energy)],['其他生产',fmt(t.otherProduction)],...(mode==='budget'?[['损耗预算',fmt(t.reserve)]]:[]),['理论生产毛利',fmt(t.gross)]];
  if(key==='actual')return [['累计合格量',`${c.quantity??'待补齐'} 双`],['核算报价',`${fmt(a.order.price)} 元/双`],['收入',fmt(c.revenue)],['材料',fmt(c.actual.material)],['人工',fmt(c.actual.costs?.人工)],['制造',fmt(c.actual.costs?.制造)],['其他生产',fmt(c.actual.costs?.其他生产)],['生产毛利',fmt(c.actual.gross)],['管理',fmt(c.actual.costs?.管理)],['销售',fmt(c.actual.costs?.销售)],['财务',fmt(c.actual.costs?.财务)],['经营利润',fmt(c.actual.operating)]];
  if(key==='expected')return [['累计合格量',`${c.quantity??'待补齐'} 双`],['核算报价',`${fmt(a.order.price)} 元/双`],['理论收入',fmt(c.expected.revenue)],['材料',fmt(c.expected.material)],['人工',fmt(c.expected.labor)],['制造',fmt(c.expected.manufacturing)],['其他生产',fmt(c.expected.otherProduction)],...(mode==='budget'?[['损耗预算',fmt(c.expected.reserve)]]:[]),['同进度理论生产毛利',fmt(c.expected.gross)]];
  return [['同进度理论生产毛利',fmt(c.expected.gross)],['累计实际生产毛利',fmt(c.actual.gross)],['少赚',fmt(c.gap)],...Object.entries(a.bridge.components).filter(([k,v])=>k!=='budgetAdjustment'||mode==='budget'||Number(v)!==0).map(([k,v])=>[labels[k],fmt(v)])];
 };
 const drillPanel=a=>{
  if(!drill)return '';
  if(drill.startsWith('variance:')){
   const key=drill.slice(9),def=varianceDefs[key];if(!def)return '';
   const all=a.daySummaries??[],days=all.map(d=>({date:d.date,quantity:d.quantity,value:d.components?.[key]})).filter(d=>d.value!==null&&Number(d.value)!==0);
   const pending=all.filter(d=>d.components?.[key]===null).length,shown=days.slice().reverse().slice(0,varianceLimit),more=days.length>shown.length;
   return `<section class="panel drill-panel"><div class="panel-head"><h2>${esc(labels[key]??key)} · 明细</h2><button class="button" data-drill-close>收起</button></div><div class="panel-body"><p class="drill-formula">计算依据：${esc(def.formula)}</p><p class="footnote">来源：${esc(def.source)} · 合计 ${fmt(a.bridge.components[key])} 元。</p></div>${days.length?`<div class="table-wrap"><table><thead><tr><th>日期</th><th>合格量双</th><th>当日影响元</th><th>操作</th></tr></thead><tbody>${shown.map(d=>`<tr><td>${esc(d.date)}</td><td>${d.quantity??'待补齐'}</td><td>${(Number(d.value)>0?'+':'')+fmt(d.value)}</td><td><button class="link" data-drill-day="${esc(d.date)}" data-drill-key="${esc(key)}">查看当天记录</button></td></tr>`).join('')}</tbody></table></div><div class="panel-footer">${more?`已显示最近 ${shown.length} / 共 ${days.length} 个有影响的日期。<button class="button" data-drill-more>加载更多</button>`:`共 ${days.length} 个有影响的日期。`}${pending?`另有 ${pending} 天资料待补齐，未计入。`:''}</div>`:`<div class="panel-body"><p class="note">截至所选日期没有产生该项影响。${pending?`另有 ${pending} 天资料待补齐。`:''}</p></div>`}</section>`;
  }
  const defs={
   theoretical:{title:'整单理论目标计算依据',formula:'理论收入 = 合同数量 × 核算报价；理论生产毛利 = 理论收入 − 材料 − 人工 − 生产管理 − 能源 − 其他生产。固定目标，不随当天实际变化。',src:'来源：成本 Excel · 订单信息 / CostParameters / OriginalRecipe。'},
   actual:{title:'累计实际生产毛利计算依据',formula:'收入 = Σ(当日合格量 × 核算报价)；生产毛利 = 收入 − 材料 − 人工 − 制造 − 其他生产；经营利润 = 生产毛利 − 管理 − 销售 − 财务。只使用截至日期已可见的记录。',src:''},
   expected:{title:'同进度理论生产毛利计算依据',formula:'用累计合格量按同一核算器和选定基线重算；与实际使用相同的数量口径，差异只来自成本、价格和效率。',src:'来源：成本 Excel 的基线参数与配方；数量来自每日生产。'},
   gap:{title:'少赚差距计算依据',formula:'少赚 = 同进度理论生产毛利 − 累计实际生产毛利；下列归因项合计与总差距精确一致。',src:'来源：每日生产、每日材料、每日费用与理论基线。'}
  };
  const def=defs[drill];if(!def)return '';
  return `<section class="panel drill-panel"><div class="panel-head"><h2>${def.title}</h2><button class="button" data-drill-close>收起</button></div><div class="panel-body"><div class="kv-grid drill-kv">${kvRows(cardRows(a,drill))}</div><p class="drill-formula">${def.formula}</p></div></section>`;
 };
 const overviewHtml=a=>{
  const c=a.cumulative;
  const reserve=num(a.theoreticalTotal.reserve),revenue=num(a.theoreticalTotal.revenue);
  const budgetNote=mode==='budget'&&reserve!==null&&revenue?`含损耗预算：在理想成本外另扣生产与不良损耗预算 ¥${fmt(reserve)}（占理论收入 ${(reserve/revenue*100).toFixed(2)}%）；实际成本不受影响。`:'理想上界不预留损耗；切换为“含损耗预算”会按收入计提生产与不良损耗预算。';
  const trend=renderTrend(points.map(p=>({...p,actual:p.actual===null?null:Number(p.actual),expected:p.expected===null?null:Number(p.expected)}))).replaceAll('data-day=','data-import-day=');
  return `<section class="stats-grid imported-stats">${card(mode==='ideal'?'整单理论最大生产毛利':'整单预算生产毛利','¥'+fmt(a.theoreticalTotal.gross),'固定目标 · '+(mode==='ideal'?'理想上界':'含损耗预算基线'),'theoretical','target')}${card('累计实际生产毛利','¥'+fmt(c.actual.gross),'截至 '+date+' · 毛利率 '+pct(c.actual.margin),'actual','actual')}${card('同进度理论生产毛利','¥'+fmt(c.expected.gross),'相同累计合格产量','expected','benchmark')}${card('与同进度理论相比少赚','¥'+fmt(c.gap),'截至 '+date+(num(c.gap)>0?' · 已少赚':num(c.gap)<0?' · 高于理论':''),'gap',num(c.gap)>0?'loss':num(c.gap)<0?'gain':'')}</section>${drill?.startsWith('variance:')?'':drillPanel(a)}<div class="overview-charts"><section class="panel imported-summary"><div class="panel-head"><h2>累计生产毛利变化</h2><span class="muted">蓝线实际 · 虚线理论 · 悬停看数值</span></div><div class="chart-wrap">${trend}</div><div class="panel-footer">截至 ${esc(date)} · 点击节点查看当天</div></section><section class="panel imported-summary"><div class="panel-head"><h2>成本构成</h2><span class="muted">截至 ${esc(date)} · 悬停看金额</span></div><div class="panel-body">${renderCostDonut(donutItems(a))}</div><div class="panel-footer">实际已归集材料、人工、制造、其他生产、管理、销售、财务；缺失项不按零计。</div></section></div><p class="baseline-note">${budgetNote}</p>`;
 };
 const detailHtml=a=>{
  const c=a.cumulative;
  const bars=Object.entries(a.bridge.components).filter(([k,v])=>k!=='rounding'&&(k!=='budgetAdjustment'||mode==='budget')&&v!==null&&Math.abs(Number(v))>=0.5).map(([k,v])=>({key:k,name:labels[k],delta:Number(v)}));
  const back=returnState?`<div class="detail-return"><button class="button" data-return-drill>← 返回上一层</button><span>恢复 ${esc(returnState.date)} 的查看位置</span></div>`:'';
  const focusNote=focus?`<div class="detail-focus">当前定位：${esc(focusLabel(focus))}<button class="link" data-focus-clear>清除定位</button></div>`:'';
  const note=drillNote?`<p class="note warning">${esc(drillNote)}</p>`:'';
  return `${back}<section class="panel imported-summary"><div class="panel-head"><h2>生产进度与经营利润</h2><span>${esc(a.baselineId)}</span></div><div class="panel-body kv-grid"><div>累计合格量<strong>${c.quantity??'待补齐'} / ${esc(a.order.quantity)} 双</strong></div><div>完成进度<strong>${pct(c.progress)}</strong></div><div>剩余需求 / 超产<strong>${c.remaining??'—'} / ${c.overproduction??'—'} 双</strong></div><div>累计经营利润<strong>${fmt(c.actual.operating)} 元</strong></div><div>预计完工利润<strong>${a.profitScope?.forecastProfit==null?'待建立':fmt(a.profitScope.forecastProfit)+' 元'}</strong></div><div>已结算最终利润<strong>${a.profitScope?.finalProfit==null?'未结算':fmt(a.profitScope.finalProfit)+' 元'}</strong></div><div>当日生产毛利<strong>${fmt(a.daily?.actual.gross)} 元</strong></div><div>当日合格量<strong>${a.daily?.quantity??'待补齐'} 双</strong></div></div><div class="panel-body note">收入口径：${esc(a.order.incomeBasis)} · 税务口径：${esc(a.order.taxBasis)}。最终利润以结算为准。</div></section>${a.quality.missing.length?`<section class="panel imported-summary"><div class="panel-head"><h2>待补齐资料</h2></div>${table(['日期','项目','提示'],a.quality.missing.slice(0,100).map(x=>[x.date,x.field,x.detail]))}</section>`:''}<section class="panel imported-summary"><div class="panel-head"><h2>利润差距来源</h2><span class="muted">点击查看明细</span></div><div class="panel-body">${renderImportedVariance(bars)}</div></section>${drill?.startsWith('variance:')?drillPanel(a):''}<section class="panel imported-summary"><div class="panel-head"><h2>${esc(date)} 原始记录</h2><div class="table-tools">${[['production','生产'],['supplements','补单'],['materials','材料'],['expenses','费用']].map(([k,t])=>`<button class="button ${tab===k?'primary':''}" data-import-tab="${k}">${t}</button>`).join('')}</div></div>${focusNote}${note}${renderDetails()}<div class="panel-footer">${esc(a.revisionId??'')} · ${esc(a.baselineId??'')} · 可切换日期逐日核查。</div></section>${portfolio?`<section class="panel imported-summary"><div class="panel-head"><h2>同日可比订单</h2><span class="muted">可比 ${portfolio.totals.comparable} 笔 · 排除 ${portfolio.totals.excluded} 笔</span></div><div class="panel-body">已知实际毛利 ${fmt(portfolio.totals.actualGross)} 元 · 可比范围少赚 ${fmt(portfolio.totals.gap)} 元</div>${table(['订单','累计合格双','累计实际毛利元','同进度差距元','资料状态'],portfolio.orders.map(r=>[r.order.id,r.cumulative.quantity,fmt(r.cumulative.actual.gross),fmt(r.cumulative.gap),stateText[r.quality.state]]))}</section>`:''}`;
 };
 function render(){
  if(!alive||!analysis)return;const a=analysis;
  root.innerHTML=`<section class="panel imported-controls"><label>订单<select id="imported-order" class="control">${orders.map(o=>option(o.id,`${o.id} · ${o.product}`,selected.id)).join('')}</select></label>${revisions.length>1?`<label>资料版本<select id="imported-revision" class="control">${revisions.map(r=>option(r.revisionId,r.revisionId,revision)).join('')}</select></label>`:''}<label>对照基线<select id="imported-mode" class="control">${option('ideal','无额外损耗理想上界',mode)}${option('budget','含损耗预算的预期利润',mode)}</select></label><div class="imported-date"><button class="button" id="imported-prev" ${date<=a.order.start?'disabled':''}>上一天</button><input class="control" id="imported-date" type="date" aria-label="模拟截至日期" min="${esc(a.order.start)}" max="${esc((a.visibilityEnd??a.order.end))}" value="${esc(date)}"><button class="button" id="imported-next" ${date>=(a.visibilityEnd??a.order.end)?'disabled':''}>下一天</button></div><span class="demo-pill">${a.order.isDemo?'模拟案例':'导入资料'}</span><span class="imported-state ${['complete','provisional'].includes(a.quality.state)?'':'warn'}">${esc(stateText[a.quality.state])}</span><span id="imported-status" role="status"></span></section><div class="imported-tabs" role="tablist">${[['overview','利润概览'],['diagnosis','差距归因'],['detail','明细数据']].map(([k,t])=>`<button role="tab" aria-selected="${view===k}" class="imported-tab ${view===k?'active':''}" data-view="${k}">${t}</button>`).join('')}</div>${view==='diagnosis'?renderImportedDiagnosis(a):view==='overview'?overviewHtml(a):detailHtml(a)}<div class="chart-tip" id="imported-chart-tip" hidden></div>`;
  root.querySelector('#imported-date').addEventListener('change',e=>{if(!e.target.value||e.target.value<a.order.start||e.target.value>(a.visibilityEnd??a.order.end)){render();return;}date=e.target.value;returnState=null;focus=null;drillNote='';load();});
  root.querySelector('#imported-prev').onclick=()=>{date=offset(date,-1);returnState=null;focus=null;drillNote='';load();};root.querySelector('#imported-next').onclick=()=>{date=offset(date,1);returnState=null;focus=null;drillNote='';load();};
  root.querySelector('#imported-mode').onchange=e=>{mode=e.target.value;drill=null;varianceLimit=30;returnState=null;focus=null;drillNote='';load();};const revSel=root.querySelector('#imported-revision');if(revSel)revSel.onchange=e=>{revision=e.target.value;drill=null;varianceLimit=30;returnState=null;focus=null;drillNote='';load();};
  root.querySelector('#imported-order').onchange=e=>{location.hash='#imported/'+encodeURIComponent(e.target.value);};
  root.querySelectorAll('[data-view]').forEach(btn=>btn.onclick=()=>{view=btn.dataset.view;drill=null;varianceLimit=30;returnState=null;focus=null;drillNote='';render();});
  root.querySelectorAll('[data-import-tab]').forEach(btn=>btn.onclick=()=>{tab=btn.dataset.importTab;focus=null;drillNote='';render();});
  root.querySelectorAll('[data-drill]').forEach(btn=>btn.onclick=()=>{drill=btn.dataset.drill;render();});
  root.querySelectorAll('[data-drill-close]').forEach(btn=>btn.onclick=()=>{drill=null;varianceLimit=30;render();});
  root.querySelectorAll('[data-variance]').forEach(btn=>{if(btn.dataset.variance)btn.onclick=()=>{varianceLimit=30;returnState=null;focus=null;drillNote='';view='detail';drill='variance:'+btn.dataset.variance;render();};});
  root.querySelectorAll('[data-drill-more]').forEach(btn=>btn.onclick=()=>{varianceLimit+=30;render();});
  root.querySelectorAll('[data-drill-day]').forEach(btn=>btn.onclick=()=>{const target=drillTarget(btn.dataset.drillKey);returnState={view,drill,tab,focus,date};date=btn.dataset.drillDay;drill=null;view='detail';tab=target.tab;focus=target.focus??null;drillNote=target.note??'';load();});
  root.querySelectorAll('[data-return-drill]').forEach(btn=>btn.onclick=()=>{if(!returnState)return;view=returnState.view;drill=returnState.drill;tab=returnState.tab;focus=returnState.focus??null;date=returnState.date;returnState=null;drillNote='';load();});
  root.querySelectorAll('[data-focus-clear]').forEach(btn=>btn.onclick=()=>{focus=null;drillNote='';render();});
  root.querySelectorAll('[data-focus-production]').forEach(btn=>btn.onclick=()=>{tab='production';focus={tab:'production',recordId:btn.dataset.focusProduction};drillNote='';render();});
  root.querySelectorAll('[data-import-day]').forEach(el=>{const run=()=>{date=el.dataset.importDay;returnState=null;focus=null;drillNote='';load();};el.onclick=run;el.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();run();}};});
 }
 async function load(){
  const request=++seq;if(status())status().textContent='正在核算…';
  try{const a=await client.getAnalysis(selected.id,{asOf:date,revision,baselineMode:mode});if(!alive||request!==seq)return;
   if(date<a.order.start||date>(a.visibilityEnd??a.order.end)){date=date<a.order.start?a.order.start:(a.visibilityEnd??a.order.end);return load();}
   const [t,p]=await Promise.all([client.getTrend(selected.id,{start:a.order.start,end:date,revision,baselineMode:mode}),client.getPortfolio({asOf:date,baselineMode:mode})]);if(!alive||request!==seq)return;
   analysis=a;points=t.points;portfolio=p;render();
  }catch(e){if(alive&&request===seq){if(status())status().textContent=e.message;else root.innerHTML=`<section class="panel import-intro"><h2>数据载入失败</h2><p>${esc(e.message)}</p><a class="button" href="#import">返回导入</a></section>`;}}
 }
 root.innerHTML='<div class="loading">正在读取本地订单版本…</div>';
 (async()=>{try{orders=(await client.getImportedOrders()).orders;if(!alive)return;if(!orders.length){root.innerHTML='<section class="panel import-intro"><h2>还没有导入订单</h2><p>选择一份标准成本表和配套每日表，开始逐日查看利润。</p><a class="button primary" href="#import">导入 Excel</a></section>';return;}selected=orders.find(o=>o.id===orderId)||orders[0];revision=selected.revisionId;date=selected.start;revisions=(await client.getRevisions(selected.id)).revisions;await load();}catch(e){if(alive)root.innerHTML=`<section class="panel import-intro"><h2>本地服务不可用</h2><p>${esc(e.message)}</p><p>请关闭旧的服务窗口，再双击“启动网站.cmd”。</p></section>`;}})();
 const chartTip=e=>{const tip=root.querySelector('#imported-chart-tip');if(!tip)return;const el=e.target.closest?.('[data-tip]');if(!el){tip.hidden=true;return;}tip.textContent=el.dataset.tip;tip.hidden=false;const r=tip.getBoundingClientRect(),pad=10;let left=e.clientX+14,top=e.clientY+14;if(left+r.width>innerWidth-pad)left=Math.max(pad,e.clientX-r.width-14);if(top+r.height>innerHeight-pad)top=Math.max(pad,e.clientY-r.height-14);tip.style.left=left+'px';tip.style.top=top+'px';};
 root.addEventListener('pointermove',chartTip);root.addEventListener('pointerleave',()=>{const tip=root.querySelector('#imported-chart-tip');if(tip)tip.hidden=true;});
 return ()=>{alive=false;seq++;};
}
