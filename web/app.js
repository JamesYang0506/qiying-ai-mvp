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
function setBusy(value){busy=value;for(const id of ['demo','upload'])$(id).disabled=value;$('export').disabled=value||!result||rowsFiltered().length===0;$('notice').setAttribute('aria-busy',String(value));}
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
  $('complete').textContent=`${comparable.length} / ${rows.length}`;$('completeness').textContent=`已确认 ${complete} · 估算 ${estimate} · 无法计算 ${rows.length-comparable.length}`;
  $('metric-scope').textContent=`纳入 ${comparable.length} 笔（估算 ${estimate}），排除 ${rows.length-comparable.length} 笔`;
  $('order-count').textContent=rows.length;$('empty').hidden=rows.length>0;
  if(!rows.some(r=>r.order_id===selected))selected=rows[0]?.order_id??null;
  $('order-table').innerHTML=rows.map(r=>`<tr data-order="${esc(r.order_id)}" tabindex="0" role="button" aria-label="查看订单 ${esc(r.order_id)}" class="${r.order_id===selected?'selected':''}"><td><b>${esc(r.order_id)}</b><small>${esc(r.product)} · ${esc(r.customer)}</small></td><td>${money(r.revenue)}${r.revenue_status==='estimated'?'<small>收入口径待核验</small>':''}</td><td class="${sign(r.production_profit)}">${money(r.production_profit)}</td><td class="${sign(r.management_profit)}">${money(r.management_profit)}</td><td class="${sign(r.management_profit)}">${percent(r.management_margin)}</td><td>生产 ${badge(r.production_status)} / 管理 ${badge(r.management_status)}</td></tr>`).join('');
  for(const el of $('order-table').querySelectorAll('[data-order]')){const choose=()=>{selected=el.dataset.order;render();};el.addEventListener('click',choose);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});}
  chart(rows);attention(rows);details();renderSource(result.source_analysis,rows);
  $('snapshot').innerHTML=[['公式版本',snap.formula_version],['数据截止',snap.cutoff_date],['计算时间',new Date(snap.created_at).toLocaleString('zh-CN',{hour12:false})],['快照编号',snap.snapshot_id],['数量范围',snap.scope],['精度规则',snap.rounding]].map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  $('footer-snapshot').textContent='快照 '+snap.snapshot_id;$('export').disabled=busy||rows.length===0;
}
function chart(rows){const show=rows.slice(0,8);if(!show.length){$('chart').innerHTML='<div class="empty">暂无可展示订单</div>';return;}const max=Math.max(1,...show.flatMap(r=>[Math.abs(Number(r.production_profit)),Math.abs(Number(r.management_profit))]));const negative=show.some(r=>Number(r.production_profit)<0||Number(r.management_profit)<0);const zero=negative?235:130;const scale=(negative?190:360)/max;const height=show.length*37+25;let svg=`<svg viewBox="0 0 650 ${height}" role="img" aria-label="当前订单生产毛利和管理利润比较"><line x1="${zero}" y1="0" x2="${zero}" y2="${height-20}" stroke="#d8e0d2"/><text x="${zero}" y="${height-3}" text-anchor="middle" fill="#99a68e" font-size="9">0 元</text>`;
  show.forEach((r,i)=>{const y=i*37+8;svg+=`<text x="0" y="${y+12}" fill="#7a8a70" font-size="10">${esc(r.order_id)}</text>`;for(const [key,color,dy] of [['production_profit','#23583f',0],['management_profit','#a2c6a3',12]]){const value=r[key];if(value===null){svg+=`<text x="${zero+8}" y="${y+dy+8}" fill="#b5bdaa" font-size="8">成本待补</text>`;continue;}const n=Number(value),width=Math.abs(n)*scale;const x=n<0?zero-width:zero;svg+=`<rect x="${x}" y="${y+dy}" width="${Math.max(1,width)}" height="8" rx="2" fill="${n<0?'#c27f6c':color}"><title>${esc(r.order_id)} ${key==='production_profit'?'生产毛利':'管理利润'}：${money(value)} 元</title></rect><text x="${n<0?x-5:x+width+6}" y="${y+dy+7}" text-anchor="${n<0?'end':'start'}" fill="${n<0?'#b5806b':'#8e9c80'}" font-size="8">${money(value)}</text>`;}});$('chart').innerHTML=svg+'</svg>';}
function attention(rows){const loss=rows.filter(r=>r.management_profit!==null&&Number(r.management_profit)<0);const missing=rows.filter(r=>r.production_status==='blocked'||r.management_status==='blocked');const est=rows.filter(r=>r.estimates.length>0||r.revenue_status==='estimated');$('attention').innerHTML=[['loss','↘',`${loss.length} 笔订单管理利润为负`,loss.length?loss.map(r=>r.order_id).join('、'):'当前范围没有管理利润为负的可算订单'],['','!',`${missing.length} 笔订单成本待补`,missing.length?'未知费用保留为空，完整利润暂不计算':'当前范围没有阻止计算的缺失项'],['','≈',`${est.length} 笔订单含估算`,est.length?'包括 BOM 估算或暂估费用，需后续核对':'当前范围未使用暂估成本']].map(([cls,icon,title,sub])=>`<div class="attention-item ${cls}"><span class="attention-icon">${icon}</span><div><b>${esc(title)}</b><p>${esc(sub)}</p></div></div>`).join('');}
function details(){const r=result.orders.find(r=>r.order_id===selected);if(!r){$('detail-title').textContent='订单成本构成';$('detail-subtitle').textContent='当前筛选下没有订单';for(const id of ['breakdown','layers','detail-status','detail-missing','trace-table'])$(id).innerHTML='';return;}
  $('detail-title').textContent=r.order_id+' · 成本构成';$('detail-subtitle').textContent=`${r.product} / ${r.quantity} ${r.unit} / ${r.mode==='forecast'?'整单预测':'已交付实际'}`;$('detail-status').innerHTML=badge(r.management_status);
  const max=Math.max(1,...Object.values(r.categories).map(x=>Math.abs(Number(x))));const colors=['#376b4a','#648864','#8ea77a','#b1c19c','#94a98c','#b4c1a6','#cbd4bc','#dae1d0'];
  $('breakdown').innerHTML=Object.entries(r.categories).map(([key,value],i)=>`<div class="cost-row"><span>${names[key]}</span><div class="track"><div class="fill" style="width:${value===null?0:Math.abs(Number(value))/max*100}%;background:${colors[i]}"></div></div><strong>${value===null?'待补':money(value)}</strong></div>`).join('');
  const orderIssues=result.issues.filter(x=>x.order_id===selected&&x.code!=='LOSS');const stageIssues=orderIssues.filter(x=>x.code==='STAGE');const messages=[...new Set(orderIssues.filter(x=>x.code!=='STAGE').map(x=>(names[x.category]?names[x.category]+'：':'')+x.message))];if(stageIssues.length)messages.push('有'+stageIssues.length+'项成本发生阶段待确认');$('detail-missing').textContent=messages.length?messages.join('；'):r.estimates.length?'估算项：'+r.estimates.map(c=>names[c]).join('、'):'适用成本范围已声明完整。实际准确性仍以企业认可结果核对。';
  $('layers').innerHTML=[['场内暂算利润',r.inside_profit,'阶段观察；仅扣已归集场内生产成本'],['生产毛利',r.production_profit,states[r.production_status]+' · 扣除完整生产成本'],['订单管理利润',r.management_profit,r.management_status==='disabled'?'未启用 · 费用范围与分摊口径尚未确认':states[r.management_status]+' · 再扣期间及其他订单费用']].map(([title,v,sub])=>`<div class="layer"><div><span>${title}</span><small>${sub}</small></div><strong class="${sign(v)}">${v===null?'待补':money(v)}</strong></div>`).join('');trace();
}
function trace(){if(!result)return;const rows=result[traceMode].filter(x=>x.order_id===selected);const columns=traceMode==='costs'?[['record_id','成本记录'],['category','类别'],['amount','金额/元'],['status','状态'],['source','来源'],['method','方法']]:[['pool_id','费用池'],['period','期间'],['pool_amount','池金额'],['base','订单基数'],['total_base','完整分母'],['base_unit','单位'],['amount','本单分摊'],['unallocated','池未分摊余额'],['rounding_adjustment','尾差调整']];
  const display=(key,v)=>v===null?'—':key==='category'?names[v]:key==='status'?recordStates[v]:key==='method'?({actual:'实际净耗用',bom:'BOM估算',direct:'直接归集',allocation:'费用分摊'}[v]||v):v;
  $('trace-table').innerHTML=rows.length?`<table><thead><tr>${columns.map(([,title])=>`<th>${title}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(([key])=>`<td>${esc(display(key,r[key]))}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<div class="empty">该订单没有此类明细</div>';
}
async function exportCurrent(){if(!result||busy)return;setBusy(true);try{const response=await request('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({snapshot_id:result.snapshot.snapshot_id,order_ids:rowsFiltered().map(r=>r.order_id)})});const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download='订单利润结果_'+result.snapshot.cutoff_date+'.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e.message);}finally{setBusy(false);}}
$('demo').addEventListener('click',demo);$('upload').addEventListener('change',e=>upload(e.target.files[0]));$('export').addEventListener('click',exportCurrent);
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

async function restoreCurrent(){try{const data=await (await request('/api/current')).json();if(data.orders)accept(data);}catch(e){setError('无法恢复本地结果：'+e.message);}}
restoreCurrent();
