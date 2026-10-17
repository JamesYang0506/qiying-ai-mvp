import {esc,icon} from './ui.js';
import {importClient} from './import-api.js';
const fmt=v=>v==null?'—':Number(v).toLocaleString('zh-CN',{maximumFractionDigits:2});
const opt=(v,t,s)=>`<option value="${esc(v)}" ${v===s?'selected':''}>${esc(t)}</option>`;
const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function buildDailyCalendar(analysis,{start,end,asOf}){
 const known=new Map((analysis.daySummaries??[]).filter(r=>r.date<=asOf).map(r=>[r.date,r]));
 const result=[];for(let date=start;date<=end;date=shift(date,1))result.push(known.get(date)??{date,quantity:null,actual:{gross:null},future:date>asOf});
 return result;
}
const table=(heads,rows)=>`<div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c??'—')}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${heads.length}" class="dd-empty">当天没有可见记录</td></tr>`}</tbody></table></div>`;
const source=r=>[r.source?.fileRole==='cost'?'成本表':r.source?.fileRole==='daily'?'每日表':'',r.source?.sheet,r.source?.cell].filter(Boolean).join(' · ')||'来源未提供';
const section=(title,n,content,note='')=>`<section class="panel dd-section"><div class="panel-head"><h2>${icon('file')}${title} <span class="bm-panel-tag">${n} 条</span></h2></div>${content}${note?`<p class="dd-note">${esc(note)}</p>`:''}</section>`;
const card=(label,value,unit,symbol)=>`<article class="stat-card bm-kpi"><div class="bm-kpi-icon">${icon(symbol)}</div><div class="bm-kpi-content"><div class="stat-top">${label}</div><div class="stat-value">${fmt(value)}<em>${unit}</em></div><p class="stat-foot">所选业务日数据</p></div></article>`;
export function mountDailyData(root,{orderId,initialDate='',initialRevision='',initialKnownAt='',initialMode='ideal',onScopeChange=()=>{},client=importClient}={}){
 let alive=true,seq=0,orders=[],revisions=[],selected=null,revision='',date='',analysis=null,calendar=[],loading=false,error='';
 const route=(id,day,rev)=>{location.hash='#data/'+encodeURIComponent(id)+(day?'?'+new URLSearchParams({asOf:day,...(rev?{revision:rev}:{}),baselineMode:initialMode,...(initialKnownAt?{knownAt:initialKnownAt}:{})}):'');};
 function render(){
  if(!alive)return;
  if(!selected){root.innerHTML=`<section class="panel import-intro"><h2>${loading?'正在读取订单…':error?'载入失败':'还没有导入订单'}</h2><p>${esc(error||'导入成本表和配套每日表后，可逐日核查原始数据。')}</p><a class="button primary" href="#import">导入 Excel</a></section>`;return;}
  const a=analysis,d=a?.daily,rows=d?.rows??{production:[],materials:[],expenses:[],supplements:[]},end=a?.visibilityEnd??selected.end;
  const supplementCount=rows.supplements.length&&rows.supplements.every(r=>r.quantity!=null)?rows.supplements.reduce((s,r)=>s+Number(r.quantity),0):rows.supplements.length?null:0;
  root.innerHTML=`<section class="dd-controls panel"><label>订单<select id="dd-order" class="control">${orders.map(o=>opt(o.id,o.id+' · '+(o.product||o.customer||''),selected.id)).join('')}</select></label><label>资料版本<select id="dd-revision" class="control">${revisions.map(r=>opt(r.revisionId,r.revisionId,revision)).join('')}</select></label><label>业务日期<input id="dd-date" class="control" type="date" min="${esc(selected.start)}" max="${esc(end)}" value="${esc(date)}"></label><div class="dd-date-actions"><button class="button" id="dd-prev" ${loading||date<=selected.start?'disabled':''}>上一天</button><button class="button" id="dd-next" ${loading||date>=end?'disabled':''}>下一天</button><button class="button primary" id="dd-refresh">${icon('refresh')}刷新数据</button></div></section><p class="dd-status" role="status">${esc(loading?'正在载入所选订单与日期…':error?'查询失败：'+error:'正在查看 '+selected.id+' · '+date+' · '+revision)}</p>${a?`<section class="panel dd-order-info"><div><small>订单 / 产品</small><strong>${esc(a.order.id)} · ${esc(a.order.product||'未提供')}</strong></div><div><small>客户</small><strong>${esc(a.order.customer||'未提供')}</strong></div><div><small>合同数量</small><strong>${fmt(a.order.quantity)} 双</strong></div><div><small>订单单价 / 标准重量</small><strong>${fmt(a.order.price)} 元 · ${fmt(a.order.weight)} kg</strong></div></section><section class="cards bm-kpis">${card('当日合格产量',d?.quantity,'双','file')}${card('当日生产成本',d?.actual.productionCost,'元','wallet')}${card('当日生产毛利',d?.actual.gross,'元','chart')}${card('当日补单数量',supplementCount,'双','layers')}</section><section class="panel dd-calendar"><div class="panel-head"><h2>${icon('grid')}每日情况</h2><span class="muted">点击日期查看当日记录</span></div><div class="dd-days">${calendar.map(p=>`<button class="dd-day ${p.date===date?'active':''}" data-dd-day="${esc(p.date)}" aria-pressed="${p.date===date}"><strong>${esc(p.date.slice(5))}</strong>${p.future?'<span>尚未推进</span><small>点击推进至当天</small>':`<span>合格 ${fmt(p.quantity)} 双</span><small>毛利 ${fmt(p.actual.gross)} 元</small>`}</button>`).join('')}</div></section>${!d?'<p class="bm-notice">该日期无生产核算记录，未知金额不按零处理。可切换至订单生产期间查看。</p>':''}${section('当日生产记录',rows.production.length,table(['记录编号','码号','加工量 / 双','不良量 / 双','合格量 / 双','报工状态','资料状态','Excel 来源'],rows.production.map(r=>[r.id,r.size,fmt(r.processed),fmt(r.defects),r.processed==null||r.defects==null?'—':fmt(Number(r.processed)-Number(r.defects)),r.dayStatus,r.status,source(r)])))}${section('材料耗用与成本来源',rows.materials.length,table(['记录编号','材料编号','净耗 / kg','单价 / 元/kg','资料状态','Excel 来源'],rows.materials.map(r=>[r.id,r.materialId,fmt(r.net),fmt(r.price),r.status,source(r)])),`当日材料成本：${fmt(d?.actual.material)} 元。金额沿用原核算结果；净耗和单价为 Excel 导入值。`)}${section('费用明细与成本来源',rows.expenses.length,table(['记录编号','费用类别','具体项目','金额 / 元','资料状态','Excel 来源'],rows.expenses.map(r=>[r.id,r.category,r.item,fmt(r.amount),r.status,source(r)])),'生产成本包含材料、人工、制造及其他生产费用；管理、销售、财务保留为经营费用。')}${section('补单记录',rows.supplements.length,table(['补单编号','码号','数量 / 双','关联生产记录','补单原因','计入口径','资料状态','Excel 来源'],rows.supplements.map(r=>[r.id,r.size,fmt(r.quantity),r.parentId,r.reason,r.inclusion,r.status,source(r)])),'补单数量按原始记录展示；已包含于当日加工量和净耗的记录不重复增加产量或成本。')}${a.quality.missing.filter(m=>!m.date||m.date===date).length?section('当日待补齐资料',a.quality.missing.filter(m=>!m.date||m.date===date).length,table(['日期','字段','原因'],a.quality.missing.filter(m=>!m.date||m.date===date).map(m=>[m.date,m.field,m.detail]))):''}`:''}`;
  root.querySelector('#dd-order').onchange=e=>route(e.target.value);
  root.querySelector('#dd-revision').onchange=e=>route(selected.id,date,e.target.value);
  root.querySelector('#dd-date').onchange=e=>{if(e.target.value>=selected.start&&e.target.value<=end)route(selected.id,e.target.value,revision);else render();};
  root.querySelector('#dd-prev').onclick=()=>route(selected.id,shift(date,-1),revision);
  root.querySelector('#dd-next').onclick=()=>route(selected.id,shift(date,1),revision);
  root.querySelector('#dd-refresh').onclick=()=>load();
  root.querySelectorAll('[data-dd-day]').forEach(b=>b.onclick=()=>route(selected.id,b.dataset.ddDay,revision));
 }
 async function load(){const n=++seq;loading=true;error='';analysis=null;render();try{
  const a=await client.getAnalysis(selected.id,{asOf:date,revision,knownAt:initialKnownAt||undefined,baselineMode:initialMode});
  if(!alive||n!==seq)return;
  const end=a.visibilityEnd??a.order.end;
  if(date<a.order.start||date>end){date=date<a.order.start?a.order.start:end;return load();}
  analysis=a;calendar=buildDailyCalendar(a,{start:a.order.start,end:a.order.end,asOf:date});onScopeChange({orderId:selected.id,asOf:date,revision,knownAt:initialKnownAt,baselineMode:initialMode});
 }catch(e){if(alive&&n===seq)error=e.message;}finally{if(alive&&n===seq){loading=false;render();}}}
 (async()=>{loading=true;render();try{orders=(await client.getImportedOrders()).orders;if(!alive)return;selected=orders.find(o=>o.id===orderId)||orders[0];if(!selected){loading=false;render();return;}revisions=(await client.getRevisions(selected.id)).revisions;if(!alive)return;revision=revisions.some(r=>r.revisionId===initialRevision)?initialRevision:selected.revisionId;date=initialDate||selected.start;await load();}catch(e){if(alive){loading=false;error=e.message;render();}}})();
 return ()=>{alive=false;seq++;};
}
