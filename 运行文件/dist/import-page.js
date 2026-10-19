import {esc} from './ui.js';import {importClient} from './import-api.js';
const table=(headers,rows)=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v??'待补齐')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const SEVERITY={error:'错误',missing:'缺失',warning:'提示'};
const FILE_ROLE={cost:'成本Excel',daily:'每日Excel'};
const csvCell=v=>`"${String(v??'').replaceAll('"','""')}"`;
export function issuesCsv(issues){
 const head=['严重级别','文件角色','工作表','单元格','记录ID','字段','错误代码','说明','修正建议'];
 const rows=issues.map(x=>[SEVERITY[x.severity]??x.severity,FILE_ROLE[x.fileRole]??x.fileRole??'',x.sheet??'',x.cell??'',x.recordId??'',x.field??'',x.code??'',x.message??'',x.hint??'']);
 return '﻿'+[head,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
const numText=v=>v==null?'待补齐':Number.isFinite(Number(v))?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(Number(v)):String(v);
const statBlock=p=>{const st=p.previewStats;if(!st)return'';const cats=Object.entries(st.expenses.byCategory??{}).map(([k,v])=>`${esc(k)} ${numText(v)}`).join(' · ');return `<div class="kv-grid"><div>生产<strong>${esc(st.production.count)} 条 · 加工 ${esc(numText(st.production.processed))} / 不良 ${esc(numText(st.production.defects))} / 合格 ${esc(numText(st.production.good))} 双</strong></div><div>补单<strong>${esc(st.supplements.count)} 条 · 补产 ${esc(numText(st.supplements.quantity))} 双（已含，不重复计入）</strong></div><div>材料<strong>${esc(st.materials.count)} 条 · 净耗 ${esc(numText(st.materials.net))} kg · 单价 ${esc(numText(st.materials.priceMin))}–${esc(numText(st.materials.priceMax))} 元/kg</strong></div><div>费用<strong>${esc(st.expenses.count)} 条 · 合计 ${esc(numText(st.expenses.amount))} 元${cats?' · '+cats:''}</strong></div></div>`;};
export function mountImport(root,{onSaved,client=importClient}={}){
 let alive=true,preview=null,busy=false,generation=0;
 root.innerHTML=`<section class="panel import-intro"><h2>导入标准订单数据</h2><div class="import-steps"><span>1 选择两份 Excel</span><span>2 校验并预览</span><span>3 确认保存</span></div><div class="import-file-grid"><label class="file-card">成本 Excel<input id="cost-file" type="file" accept=".xlsx" aria-label="选择成本Excel"><small>订单信息、原订单用量、补单用量、成本计算 · A-ORDER-0.2</small></label><label class="file-card">每日 Excel<input id="daily-file" type="file" accept=".xlsx" aria-label="选择每日Excel"><small>每日生产、每日材料、每日费用 · 配套 v0.2</small></label></div><div class="import-actions"><button class="button primary" id="preview-files" disabled>解析并预览</button><span class="muted">每份最大10MiB · .xlsx</span></div><div id="import-status" role="status" aria-live="polite"></div></section><div id="import-preview"></div>`;
 const cost=root.querySelector('#cost-file'),daily=root.querySelector('#daily-file'),parse=root.querySelector('#preview-files'),status=root.querySelector('#import-status'),output=root.querySelector('#import-preview');
 const changed=()=>{generation++;preview=null;output.innerHTML='';status.textContent='';parse.disabled=busy||!cost.files[0]||!daily.files[0];};cost.addEventListener('change',changed);daily.addEventListener('change',changed);
 const showSaved=async p=>{
  const el=output.querySelector('#saved-version-state');if(!el)return;
  try{
   const {revisions}=await client.getRevisions(p.summary.orderId);if(!alive||!output.contains(el))return;
   const latest=revisions[0],same=revisions.find(r=>r.revisionId===p.summary.revisionId);
   if(!latest){el.className='note';el.textContent=`当前没有已保存版本；确认后将新增 ${p.summary.revisionId}。`;return;}
   if(same&&same.hash===p.digest){el.className='note';el.textContent=`${p.summary.revisionId} 与已保存版本内容一致；确认不会重复追加。当前最新：${latest.revisionId}（${(latest.createdAt??'').slice(0,19).replace('T',' ')}）。`;return;}
   if(same){el.className='note warning';el.textContent=`修订号 ${p.summary.revisionId} 已存在但内容不同，保存会被拒绝。请修改成本表中的“数据修订版本”后重新导入。当前最新：${latest.revisionId}（${(latest.createdAt??'').slice(0,19).replace('T',' ')}）。`;return;}
   el.className='note';el.textContent=`将新增资料版本 ${p.summary.revisionId}。当前最新已保存版本：${latest.revisionId}（${(latest.createdAt??'').slice(0,19).replace('T',' ')}）。`;
  }catch(e){if(alive&&output.contains(el)){el.className='note warning';el.textContent='未能读取已保存版本：'+e.message;}}
 };
 const draw=()=>{
  const p=preview,s=p.summary,errors=p.issues.filter(x=>x.severity==='error'),missing=p.issues.filter(x=>x.severity==='missing');
  output.innerHTML=`<section class="panel import-preview"><div class="panel-head"><h2>识别结果 · ${esc(s.orderId||'订单待确认')}</h2><span class="demo-pill">${s.isDemo?'模拟数据':'导入资料'}</span></div><div class="panel-body"><div class="kv-grid"><div>核算子项<strong>${esc(s.lineId)}</strong></div><div>日期范围<strong>${esc(s.start)} — ${esc(s.end)}</strong></div><div>基线版本<strong>${esc(s.baselineId)}</strong></div><div>资料版本<strong>${esc(s.revisionId)}</strong></div></div><div class="import-counts">生产 ${s.counts.production} 条 · 补单 ${s.counts.supplements} 条 · 材料 ${s.counts.materials} 条 · 费用 ${s.counts.expenses} 条</div>${statBlock(p)}<div class="note ${errors.length||missing.length?'warning':''}">${errors.length?`${errors.length} 项错误需要修正`:missing.length?`${missing.length} 项资料待补齐，相关利润暂不可用`:'格式校验通过，可以确认导入'}。补单关联保留，已包含的加工量和材料不会再叠加。</div><p class="note" id="saved-version-state">正在核对已保存版本…</p></div>${p.issues.length?`<div class="panel-body import-actions"><button class="button" id="download-issues">下载错误清单（CSV）</button><span class="muted">含工作表、单元格、原因和修正建议</span></div>${table(['级别','文件角色','工作表 / 单元格','字段 / 记录','说明','修正建议'],p.issues.slice(0,200).map(x=>[SEVERITY[x.severity]??x.severity,FILE_ROLE[x.fileRole]??x.fileRole??'',`${x.sheet||''} ${x.cell||''}`,x.field||x.recordId||'',x.message,x.hint||'']))}`:''}<div class="panel-body import-actions">${missing.length?'<label><input type="checkbox" id="allow-incomplete"> 明确保存为待补齐版本</label>':''}<button class="button primary" id="commit-import" ${!p.canCommit?'disabled':''}>${missing.length?'保存待补齐版本':'确认导入'}</button><span class="muted">预览有效期10分钟</span></div></section><section class="panel import-preview"><div class="panel-head"><h2>每日生产预览</h2><span class="muted">${p.preview.production.length<s.counts.production?'最多展示前200条，确认后保存全部':`共 ${s.counts.production} 条`}</span></div>${table(['日期','码号','加工量','不良量','记录状态','来源单元格'],p.preview.production.map(r=>[r.date,r.size,r.processed,r.defects,r.dayStatus,`${r.source.sheet}!${r.source.cell}`]))}</section><details class="panel import-preview"><summary>展开材料、费用和补单预览</summary><h3>每日材料</h3>${table(['日期','材料编号','实际净耗kg','实际单价元/kg'],p.preview.materials.map(r=>[r.date,r.materialId,r.net,r.price]))}<h3>每日费用</h3>${table(['日期','类别','项目','金额元'],p.preview.expenses.map(r=>[r.date,r.category,r.item,r.amount]))}<h3>补单关联</h3>${table(['日期','码号','数量','生产记录','计入规则'],p.preview.supplements.map(r=>[r.date,r.size,r.quantity,r.parentId,r.inclusion]))}</details>`;
  output.querySelector('#download-issues')?.addEventListener('click',()=>{
   const blob=new Blob([issuesCsv(p.issues)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=`导入错误清单_${s.orderId||'order'}_${s.revisionId||'revision'}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
  });
  output.querySelector('#commit-import')?.addEventListener('click',async()=>{
   if(busy)return;const allow=output.querySelector('#allow-incomplete')?.checked??false;if(p.requiresIncomplete&&!allow){status.textContent='请先勾选保存为待补齐版本，或修正数据后重新解析。';return;}
   busy=true;const btn=output.querySelector('#commit-import');btn.disabled=true;status.textContent='正在保存数据版本…';
   try{const r=await client.commitPreview(p.previewId,allow,p.digest);if(alive){status.textContent=r.reused?'此版本已存在，未重复追加。':'数据版本已保存。';showSaved(p);onSaved?.(r);}}catch(e){if(alive){status.textContent=e.message;btn.disabled=!p.canCommit;}}finally{busy=false;}
  });
  showSaved(p);
 };
 parse.addEventListener('click',async()=>{
  if(busy)return;const c=cost.files[0],d=daily.files[0];if(!c||!d)return;
  if([c,d].some(f=>!f.name.toLowerCase().endsWith('.xlsx')||f.size>10*1024*1024)){status.textContent='请选择不超过10MiB的.xlsx文件。';return;}
  const gen=++generation;busy=true;parse.disabled=true;cost.disabled=true;daily.disabled=true;status.textContent='正在读取并校验两份表格…';output.innerHTML='';
  try{const r=await client.previewFiles(c,d);if(alive&&gen===generation){preview=r;draw();status.textContent='预览已生成，请核对订单与校验结果。';}}catch(e){if(alive)status.textContent=e.message;}finally{busy=false;if(alive){cost.disabled=false;daily.disabled=false;parse.disabled=!cost.files[0]||!daily.files[0];}}
 });
 return ()=>{alive=false;generation++;};
}
