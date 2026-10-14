'use strict';
const $=id=>document.getElementById(id);
const names={material:'直接材料',labor:'直接人工',manufacturing:'制造费用',production_other:'其他生产成本',management:'管理费用',sales:'销售费用',finance:'财务费用',order_other:'其他订单费用'};
const states={complete:'可计算',estimated:'估算',blocked:'无法计算',disabled:'未启用'};
const recordStates={confirmed:'已确认',estimated:'暂估',missing:'待补',not_applicable:'不适用'};
let result=null,selected=null,traceMode='costs',busy=false;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function money(value){if(value===null||value===undefined)return '—';let [i,f='00']=String(value).split('.');return i.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+f.padEnd(2,'0');}
const percent=value=>value===null||value===undefined?'—':(Number(value)*100).toFixed(2)+'%';
const sign=value=>value!==null&&Number(value)<0?'negative':'';
const badge=s=>`<span class="badge ${esc(s)}">${esc(states[s]||s)}</span>`;
function sum(rows,key){const cents=rows.reduce((s,r)=>s+BigInt(String(r[key]).replace('.','')),0n);const a=cents<0n?-cents:cents;return (cents<0n?'-':'')+(a/100n)+'.'+String(a%100n).padStart(2,'0');}
function rowsFiltered(){if(!result)return [];const query=$('search').value.trim().toLowerCase();return result.orders.filter(r=>r.mode===$('mode').value).filter(r=>{const state=$('state').value;return state==='all'||(state==='loss'?r.management_profit!==null&&Number(r.management_profit)<0:state==='disabled'?r.management_status==='disabled':r.production_status===state);}).filter(r=>[r.order_id,r.product,r.customer].some(x=>String(x).toLowerCase().includes(query)));}
function setError(message){$('error').hidden=!message;$('error').textContent=message;}
function setBusy(value){busy=value;for(const id of ['demo','upload'])$(id).disabled=value;for(const id of ['export','export-training'])$(id).disabled=value||!result||rowsFiltered().length===0;$('notice').setAttribute('aria-busy',String(value));}
async function request(path,options={}){const response=await fetch(path,options);if(!response.ok){let text='请求失败';try{text=(await response.json()).error||text;}catch{}throw new Error(text);}return response;}
async function calculate(data){return (await request('/api/calculate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})).json();}
function accept(data){result=data;selected=null;const modes=new Set(result.orders.map(r=>r.mode));if(!modes.has($('mode').value))$('mode').value=[...modes][0];$('state').value='all';$('search').value='';setError('');render();}
async function demo(){if(busy)return;setBusy(true);try{const data=await (await request('/api/demo')).json();accept(await calculate(data));}catch(e){setError(e.message);}finally{setBusy(false);}}
async function upload(file){if(!file||busy)return;setBusy(true);setError('');try{if(file.size>10*1024*1024)throw new Error('文件超过 10MB，请拆分后导入');let data;if(file.name.toLowerCase().endsWith('.xlsx'))data=await (await request('/api/import-xlsx',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file})).json();else if(file.name.toLowerCase().endsWith('.json'))data=await calculate(JSON.parse(await file.text()));else throw new Error('请导入 .xlsx 或 .json 标准数据文件');accept(data);}catch(e){setError('导入失败：'+e.message+'。当前看板保留上一份计算结果。');}finally{setBusy(false);$('upload').value='';}}
function render(){if(!result)return;const rows=rowsFiltered();const comparable=rows.filter(r=>r.production_profit!==null);const managementRows=rows.filter(r=>r.management_profit!==null);const complete=rows.filter(r=>r.production_status==='complete').length,estimate=rows.filter(r=>r.production_status==='estimated').length;const revenue=comparable.length?sum(comparable,'revenue'):null;const gross=comparable.length?sum(comparable,'production_profit'):null;const profit=managementRows.length?sum(managementRows,'management_profit'):null;const snap=result.snapshot;
  $('notice').classList.toggle('real',!snap.is_demo);$('notice').textContent=(snap.is_demo?'演示模式 · 当前全部为合成数据，仅用于验证模型与展示，不代表企业经营状况。':'导入模式 · 当前为你导入的数据；计算口径仍需结合企业手工结果核对。')+' BOM 成本自动标为估算，未知费用不会按零处理。';
  $('scope').textContent=`截止 ${snap.cutoff_date} · CNY · 当前 ${rows.length} 笔订单`;
  $('revenue').textContent=money(revenue);$('gross').textContent=money(gross);$('profit').textContent=money(profit);$('profit').classList.toggle('negative',profit!==null&&Number(profit)<0);
  $('margin').textContent='加权管理利润率 '+(revenue!==null&&profit!==null&&Number(sum(managementRows,'revenue'))!==0?percent(Number(profit)/Number(sum(managementRows,'revenue'))):'—');
  $('complete').textContent=`${comparable.length} / ${rows.length}`;$('completeness').textContent=`标准口径可计算（含估算） ${comparable.length} 笔 / 已导入 ${rows.length} 笔；表内试算见上方`;
  $('metric-scope').textContent=`纳入 ${comparable.length} 笔（估算 ${estimate}），排除 ${rows.length-comparable.length} 笔`;
  $('order-count').textContent=rows.length;$('empty').hidden=rows.length>0;
  if(!rows.some(r=>r.order_id===selected))selected=rows[0]?.order_id??null;
  $('order-table').innerHTML=rows.map(r=>`<tr data-order="${esc(r.order_id)}" tabindex="0" role="button" aria-label="查看订单 ${esc(r.order_id)}" class="${r.order_id===selected?'selected':''}"><td><b>${esc(r.order_id)}</b><small>${esc(r.product)} · ${esc(r.customer)}</small></td><td>${money(r.revenue)}${r.revenue_status==='estimated'?'<small>收入口径待核验</small>':''}</td><td class="${sign(r.production_profit)}">${money(r.production_profit)}</td><td class="${sign(r.management_profit)}">${money(r.management_profit)}</td><td class="${sign(r.management_profit)}">${percent(r.management_margin)}</td><td>生产 ${badge(r.production_status)} / 管理 ${badge(r.management_status)}</td></tr>`).join('');
  for(const el of $('order-table').querySelectorAll('[data-order]')){const choose=()=>{selected=el.dataset.order;render();};el.addEventListener('click',choose);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});}
  chart(rows);attention(rows);details();renderSource(result.source_analysis,rows);renderExecutive(result);updateAIOrders();
  if(pendingAnchor){const target=document.getElementById(pendingAnchor);if(target){pendingAnchor=null;requestAnimationFrame(()=>target.scrollIntoView({behavior:'instant'}));}}
  $('snapshot').innerHTML=[['公式版本',snap.formula_version],['数据截止',snap.cutoff_date],['计算时间',new Date(snap.created_at).toLocaleString('zh-CN',{hour12:false})],['快照编号',snap.snapshot_id],['数量范围',snap.scope],['精度规则',snap.rounding]].map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  $('footer-snapshot').textContent='快照 '+snap.snapshot_id;for(const id of ['export','export-training'])$(id).disabled=busy||rows.length===0;
}
function chart(rows){const show=rows.slice(0,8);if(!show.length){$('chart').innerHTML='<div class="empty">暂无可展示订单</div>';return;}const max=Math.max(1,...show.flatMap(r=>[Math.abs(Number(r.production_profit)),Math.abs(Number(r.management_profit))]));const negative=show.some(r=>Number(r.production_profit)<0||Number(r.management_profit)<0);const zero=negative?235:130;const scale=(negative?190:360)/max;const height=show.length*37+25;let svg=`<svg viewBox="0 0 650 ${height}" role="img" aria-label="当前订单生产毛利和管理利润比较"><line x1="${zero}" y1="0" x2="${zero}" y2="${height-20}" stroke="#d8e0d2"/><text x="${zero}" y="${height-3}" text-anchor="middle" fill="#99a68e" font-size="9">0 元</text>`;
  show.forEach((r,i)=>{const y=i*37+8;svg+=`<text x="0" y="${y+12}" fill="#7a8a70" font-size="10">${esc(r.order_id)}</text>`;for(const [key,color,dy] of [['production_profit','#23583f',0],['management_profit','#a2c6a3',12]]){const value=r[key];if(value===null){svg+=`<text x="${zero+8}" y="${y+dy+8}" fill="#b5bdaa" font-size="8">${key==='management_profit'&&r.management_status==='disabled'?'未启用':'依据待补'}</text>`;continue;}const n=Number(value),width=Math.abs(n)*scale;const x=n<0?zero-width:zero;svg+=`<rect x="${x}" y="${y+dy}" width="${Math.max(1,width)}" height="8" rx="2" fill="${n<0?'#c27f6c':color}"><title>${esc(r.order_id)} ${key==='production_profit'?'生产毛利':'管理利润'}：${money(value)} 元</title></rect><text x="${n<0?x-5:x+width+6}" y="${y+dy+7}" text-anchor="${n<0?'end':'start'}" fill="${n<0?'#b5806b':'#8e9c80'}" font-size="8">${money(value)}</text>`;}});$('chart').innerHTML=svg+'</svg>';}
function attention(rows){const loss=rows.filter(r=>r.management_profit!==null&&Number(r.management_profit)<0);const missing=rows.filter(r=>r.production_status==='blocked'||r.management_status==='blocked');const est=rows.filter(r=>r.estimates.length>0||r.revenue_status==='estimated');$('attention').innerHTML=[['loss','↘',`${loss.length} 笔订单管理利润为负`,loss.length?loss.map(r=>r.order_id).join('、'):'当前范围没有管理利润为负的可算订单'],['','!',`${missing.length} 笔订单成本待补`,missing.length?'未知费用保留为空，完整利润暂不计算':'当前范围没有阻止计算的缺失项'],['','≈',`${est.length} 笔订单含估算`,est.length?'包括 BOM 估算或暂估费用，需后续核对':'当前范围未使用暂估成本']].map(([cls,icon,title,sub])=>`<div class="attention-item ${cls}"><span class="attention-icon">${icon}</span><div><b>${esc(title)}</b><p>${esc(sub)}</p></div></div>`).join('');}
function details(){const r=result.orders.find(r=>r.order_id===selected);if(!r){$('detail-title').textContent='订单成本构成';$('detail-subtitle').textContent='当前筛选下没有订单';for(const id of ['breakdown','layers','detail-status','detail-missing','trace-table'])$(id).innerHTML='';return;}
  $('detail-title').textContent=r.order_id+' · 成本构成';$('detail-subtitle').textContent=`${r.product} / ${r.quantity} ${r.unit} / ${r.mode==='forecast'?'整单预测':'已交付实际'}`;$('detail-status').innerHTML=badge(r.production_status);
  const displayed=Object.fromEntries(Object.entries(r.categories).map(([k,v])=>{const known=result.costs.filter(x=>x.order_id===r.order_id&&x.category===k&&x.amount!==null);return [k,v===null&&known.length?sum(known,'amount'):v];}));const max=Math.max(1,...Object.values(displayed).map(x=>Math.abs(Number(x))));const colors=['#376b4a','#648864','#8ea77a','#b1c19c','#94a98c','#b4c1a6','#cbd4bc','#dae1d0'];
  $('breakdown').innerHTML=Object.entries(displayed).map(([key,value],i)=>`<div class="cost-row"><span>${names[key]}</span><div class="track"><div class="fill" style="width:${value===null?0:Math.abs(Number(value))/max*100}%;background:${colors[i]}"></div></div><strong>${value===null?'缺少资料':money(value)}${value!==null&&r.categories[key]===null?'<small>已知参考金额 · 待核验</small>':''}</strong></div>`).join('');
  const orderIssues=result.issues.filter(x=>x.order_id===selected&&x.code!=='LOSS');const stageIssues=orderIssues.filter(x=>x.code==='STAGE');const messages=[...new Set(orderIssues.filter(x=>x.code!=='STAGE').map(x=>(names[x.category]?names[x.category]+'：':'')+x.message))];if(stageIssues.length)messages.push('有'+stageIssues.length+'项成本发生阶段待确认');$('detail-missing').textContent=messages.length?messages.join('；'):r.estimates.length?'估算项：'+r.estimates.map(c=>names[c]).join('、'):'适用成本范围已声明完整。实际准确性仍以企业认可结果核对。';
  const source=result.source_analysis?.order_id===r.order_id?result.source_analysis:null;
  const trial=source?.profit_layers;
  $('layer-title').textContent=trial?'生产毛利与经营净利':'三层利润';
  $('layer-subtitle').textContent=trial?'按表内成本独立试算 · 与首页及上方明细一致':'严格核算结果 · 按成本完整性与阶段归集';
  $('layer-note').textContent=trial?'经营净利为已列费用范围内的参考试算，税口径及费用完整性仍待核验。场内阶段利润因缺少成本阶段划分暂不单列。':'订单管理利润为管理核算口径，不等同于财务报表净利润。';
  const layers=trial?[
    ['生产毛利 · 试算',trial.production_profit,`收入 − 生产成本 ${money(trial.production_cost)} 元`],
    ['经营净利 · 试算',trial.operating_net_profit,`生产毛利 − 新增经营费用 ${money(trial.operating_expense)} 元`]
  ]:[['场内暂算利润',r.inside_profit,'阶段观察；仅扣已归集场内生产成本'],['生产毛利',r.production_profit,states[r.production_status]+' · 扣除完整生产成本'],['订单管理利润',r.management_profit,r.management_status==='disabled'?'未启用 · 费用范围与分摊口径尚未确认':states[r.management_status]+' · 再扣期间及其他订单费用']];
  if(trial){$('detail-status').innerHTML=badge('estimated');$('detail-missing').textContent='本处展示已知表内成本和两层利润试算。已有人工及制造费率均已计入；未提供的原始分摊、税口径和费用范围仍需核验，参见上方可信化审查。';}
  $('layers').innerHTML=layers.map(([title,v,sub])=>`<div class="layer"><div><span>${title}</span><small>${sub}</small></div><strong class="${sign(v)}">${v===null?(sub.startsWith('未启用')?'未启用':'依据待补'):money(v)}</strong></div>`).join('');trace();
}
function trace(){if(!result)return;const rows=result[traceMode].filter(x=>x.order_id===selected);const columns=traceMode==='costs'?[['record_id','成本记录'],['category','类别'],['amount','金额/元'],['status','状态'],['source','来源'],['method','方法']]:[['pool_id','费用池'],['period','期间'],['pool_amount','池金额'],['base','订单基数'],['total_base','完整分母'],['base_unit','单位'],['amount','本单分摊'],['unallocated','池未分摊余额'],['rounding_adjustment','尾差调整']];
  const display=(key,v)=>v===null?'—':key==='category'?names[v]:key==='status'?recordStates[v]:key==='method'?({actual:'实际净耗用',bom:'BOM估算',direct:'直接归集',allocation:'费用分摊'}[v]||v):v;
  $('trace-table').innerHTML=rows.length?`<table><thead><tr>${columns.map(([,title])=>`<th>${title}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(([key])=>`<td>${esc(display(key,r[key]))}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<div class="empty">该订单没有此类明细</div>';
}
async function exportCurrent(training=false){if(!result||busy)return;const orderIds=rowsFiltered().map(r=>r.order_id),snapshotId=result.snapshot.snapshot_id,cutoffDate=result.snapshot.cutoff_date;if(!orderIds.length)return;setBusy(true);if(training)$('training-export-status').textContent='正在打包当前筛选范围…';try{const response=await request(training?'/api/export-training':'/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({snapshot_id:snapshotId,order_ids:orderIds})});const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=(training?'订单训练候选资料_':'订单利润结果_')+cutoffDate+'.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);if(training)$('training-export-status').textContent=`已生成 ${orderIds.length} 笔订单的训练候选资料，请在浏览器下载中查看。建议答案尚待专家填写和审核。`;}catch(e){setError(e.message);if(training)$('training-export-status').textContent='导出失败：'+e.message;}finally{setBusy(false);}}
$('demo').addEventListener('click',demo);$('upload').addEventListener('change',e=>upload(e.target.files[0]));$('export').addEventListener('click',()=>exportCurrent());$('export-training').addEventListener('click',()=>exportCurrent(true));
for(const id of ['mode','state'])$(id).addEventListener('change',render);$('search').addEventListener('input',render);
$('cost-tab').addEventListener('click',()=>{traceMode='costs';trace();});$('allocation-tab').addEventListener('click',()=>{traceMode='allocations';trace();});
// Start empty; importing a file is the only automatic calculation trigger.
$('notice').textContent='暂无订单数据 · 请导入真实数据后开始计算。';
$('scope').textContent='等待导入 · 当前 0 笔订单';
$('metric-scope').textContent='尚未导入数据';
$('complete').textContent='0 / 0';
$('completeness').textContent='等待导入后检查成本完整度';
$('order-count').textContent='0';
$('empty').hidden=false;
$('empty').textContent='暂无订单数据，请先导入 Excel 或 JSON 文件';
$('chart').innerHTML='<div class="empty">导入数据后显示订单利润对比</div>';
$('attention').innerHTML='<div class="empty">导入数据后检查亏损与缺失项</div>';
$('breakdown').innerHTML='<div class="empty">暂无成本数据</div>';
$('layers').innerHTML='<div class="empty">导入数据后计算三层利润</div>';
setBusy(false);

let pendingAnchor=location.hash.slice(1);
function switchView(view,target=null){
  const home=view==='home',ai=view==='ai';
  $('decision-view').hidden=!home;$('detail-view').hidden=view!=='detail';$('ai-view').hidden=!ai;
  $('home-navigation').hidden=!home;$('detail-navigation').hidden=view!=='detail';$('ai-navigation').hidden=!ai;
  for(const button of document.querySelectorAll('[data-view]')){const active=button.dataset.view===view;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));}
  $('view-heading').textContent=home?'经营决策，一眼看清。':ai?'智能分析，辅助订单决策。':'订单明细，逐项有据。';
  $('view-description').textContent=home?'看利润、看成本、看风险，让订单决策有依据。':ai?'围绕具体订单提出问题，结合成本、利润与可信度资料开展分析。':'核查精确金额、计算过程、数据来源与费用分摊。';
  const id=target||(home?'executive-overview':ai?'ai-workspace':'overview');
  if(target){history.replaceState(null,'','#'+id);requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:'instant'}));}else{history.replaceState(null,'','#'+id);window.scrollTo({top:0,behavior:'instant'});}
  for(const link of document.querySelectorAll('.sidebar .nav'))link.classList.toggle('active',link.getAttribute('href')==='#'+id);
}
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{pendingAnchor=null;switchView(button.dataset.view);});
$('decision-view').addEventListener('click',event=>{const button=event.target.closest('[data-detail-target]');if(button){pendingAnchor=null;if(result){$('state').value='all';$('search').value='';const sourceOrder=result.orders.find(x=>x.order_id===result.source_analysis?.order_id);if(sourceOrder)$('mode').value=sourceOrder.mode;render();}switchView('detail',button.dataset.detailTarget);}});
for(const link of document.querySelectorAll('.sidebar .nav'))link.addEventListener('click',()=>{for(const other of document.querySelectorAll('.sidebar .nav'))other.classList.toggle('active',other===link);});
const initialHome=!pendingAnchor||pendingAnchor.startsWith('executive-');
switchView(pendingAnchor.startsWith('ai-')?'ai':initialHome?'home':'detail');
if(pendingAnchor)history.replaceState(null,'','#'+pendingAnchor);
async function restoreCurrent(){try{const data=await (await request('/api/current')).json();if(data.orders)accept(data);}catch(e){setError('无法恢复本地结果：'+e.message);}}
let aiSnapshot=null,aiRequestSequence=0,aiReady=false,aiWorking=false;
function updateAIOrders(){
  if(!result)return;
  const old=$('ai-order').value;
  $('ai-order').innerHTML=result.orders.map(x=>`<option value="${esc(x.order_id)}">${esc(x.order_id)} · ${esc(x.product)}</option>`).join('');
  if(result.orders.some(x=>x.order_id===old))$('ai-order').value=old;
  $('ai-submit').disabled=aiWorking||!result.orders.length;
  if(aiSnapshot!==result.snapshot.snapshot_id){aiSnapshot=result.snapshot.snapshot_id;aiRequestSequence++;resetAIOutput();}
  $('ai-data-scope').textContent=`已导入 ${result.orders.length} 笔订单；按选择的订单读取成本、利润及可信度资料。`;
}
function resetAIOutput(){$('ai-feedback').innerHTML=`<div class="ai-placeholder"><span>✧</span><h3>${aiReady?'准备分析你的订单':'等待连接本地模型'}</h3><p>${aiReady?'选择订单和分析方向，点击开始分析。':'可准备订单资料；模型服务可用后生成分析。'}</p></div>`;document.querySelector('.ai-result-outline').hidden=false;}
for(const id of ['ai-order','ai-focus','ai-question'])$(id).addEventListener('input',()=>{aiRequestSequence++;resetAIOutput();});
$('ai-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!result||!$('ai-order').value||aiWorking)return;
  const sequence=++aiRequestSequence;aiWorking=true;$('ai-submit').disabled=true;
  $('ai-feedback').textContent=aiReady?'本地 Qwen 正在分析…首次加载模型可能需要一些时间。':'正在准备本地订单资料…';
  try{
    const payload={snapshot_id:result.snapshot.snapshot_id,order_id:$('ai-order').value,focus:$('ai-focus').value,question:$('ai-question').value};
    const response=await (await request('/api/ai/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})).json();
    if(sequence!==aiRequestSequence)return;
    if(response.status==='completed'){renderAIResult(response);return;}
    if(response.status!=='not_configured')throw new Error('模型响应状态无效');
    $('ai-feedback').innerHTML=`<div class="notice"><b>资料准备完成 · 模型未接入</b><p>${esc(response.message)}</p></div><dl><dt>订单</dt><dd>${esc(response.context.order.order_id)}</dd><dt>成本记录</dt><dd>${response.context.costs.length} 条</dd><dt>计算快照</dt><dd>${esc(response.context.snapshot.snapshot_id)}</dd><dt>分析问题</dt><dd>${esc(payload.question||'按所选方向分析')}</dd></dl><p class="help">暂无模型结论。后续接入后，将显示风险、建议、引用依据及待确认项。</p>`;
  }catch(e){if(sequence===aiRequestSequence)$('ai-feedback').textContent='分析失败：'+e.message;}
  finally{aiWorking=false;$('ai-submit').disabled=!result?.orders.length;}
});
function renderAIResult(response){
  const output=response.result,facts=new Map(response.evidence.map(x=>[x.id,x]));
  function citations(ids){return `<details class="ai-citations"><summary>查看数据依据（${ids.length} 项）</summary>${ids.map(id=>`<p><b>${esc(id)}</b><br>${esc(JSON.stringify(facts.get(id)))}</p>`).join('')}</details>`;}
  const levels={high:'重点关注',medium:'需关注',low:'一般提醒'};
  $('ai-feedback').innerHTML=`<div class="notice"><b>本地模型分析 · 待人工复核</b><p>模型 ${esc(response.model)} · 用时 ${esc(response.duration_seconds)} 秒。引用校验通过不代表建议已被业务审核。</p></div><section class="ai-answer-section"><h3>订单结论</h3><p>${esc(output.summary)}</p></section><section class="ai-answer-section"><h3>主要风险</h3>${output.risks.length?output.risks.map(x=>`<article class="ai-answer-card"><span class="badge ${x.severity==='high'?'blocked':'estimated'}">${levels[x.severity]}</span><h4>${esc(x.title)}</h4><p>${esc(x.explanation)}</p>${citations(x.evidence_ids)}</article>`).join(''):'<p>模型未列出额外风险；仍应结合详细页的可信化审查。</p>'}</section><section class="ai-answer-section"><h3>建议行动</h3>${output.recommendations.map(x=>`<article class="ai-answer-card"><h4>${esc(x.action)}</h4><p>${esc(x.reason)}</p><p class="help">适用条件：${esc(x.conditions)}</p>${citations(x.evidence_ids)}</article>`).join('')||'<p>当前未给出建议。</p>'}</section><section class="ai-answer-section"><h3>待确认事项</h3><ul>${output.unknowns.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><p class="chart-note">记录 ${esc(response.request_id)} · 快照 ${esc(response.context.snapshot.snapshot_id)} · 模型建议未回写成本、利润或首页决策。</p>`;
  document.querySelector('.ai-result-outline').hidden=true;
}
async function loadAIStatus(){try{const status=await (await request('/api/ai/status')).json();aiReady=Boolean(status.configured);$('ai-connection').textContent=status.message;$('ai-model-badge').textContent=aiReady?status.model:'模型未就绪';$('ai-model-badge').className='badge '+(aiReady?'complete':'estimated');$('ai-submit').textContent=aiReady?'开始本地分析':'准备分析资料';if(!aiWorking)resetAIOutput();}catch(e){$('ai-connection').textContent='无法读取模型接入状态：'+e.message;}}
restoreCurrent();loadAIStatus();
