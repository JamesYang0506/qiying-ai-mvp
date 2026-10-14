'use strict';
let excelSession=null;
const profileKey='qiying.excel-import-profiles.v1';
function excelProfiles(){try{const p=JSON.parse(localStorage.getItem(profileKey)||'[]');return Array.isArray(p)?p.filter(x=>typeof x?.name==='string'&&x.mapping&&typeof x.mapping==='object').slice(0,20):[];}catch{return [];}}
function fillProfiles(){const old=$('excel-profile').value;$('excel-profile').innerHTML='<option value="">自动识别</option>'+excelProfiles().map(x=>`<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('');if(excelProfiles().some(x=>x.name===old))$('excel-profile').value=old;}
function excelMessage(text,error=false){$('excel-import-message').textContent=text;$('excel-import-message').className=error?'error':'help';}
function excelButtons(){
  const s=excelSession,working=s?.working||s?.confirming;
  $('excel-import-confirm').disabled=!s?.preview||working||s.dirty||s.preview.blocking.length>0||!$('excel-import-ack').checked;
  for(const id of ['excel-import-recheck','excel-profile','excel-profile-save','excel-profile-delete','excel-cost-sheet','excel-profile-name'])$(id).disabled=Boolean(working);
  $('excel-import-close').disabled=Boolean(s?.confirming);
  for(const el of document.querySelectorAll('[data-excel-cell],[data-excel-unit]'))el.disabled=Boolean(working);
}
function acceptImport(outcome){
  if(outcome.status==='duplicate'){
    updateAdaptationStatus();showDuplicateNotice(outcome.matches||[outcome.match]);loadHistory();return false;
  }
  const data=outcome.status==='imported'?outcome.result:outcome;
  accept(data);switchView('home');loadHistory();
  if(data.snapshot.duplicates_skipped)showDuplicateNotice(data.snapshot.duplicates_skipped,true);
  return true;
}
function showDuplicateNotice(matches,partial=false){
  $('duplicate-notice').hidden=false;
  $('duplicate-notice').innerHTML=`<div class="panel-head"><div><h2>${partial?'已跳过重复订单':'发现重复订单'}</h2><p>${partial?'新增或变更订单已保存，下面的重复项未再次保存。':'相同的订单计算数据已存在，本次没有新增记录，当前分析保留。'}</p></div><button id="duplicate-close" class="secondary">关闭提示</button></div>`+matches.flatMap(m=>m.orders.map(o=>`<div class="duplicate-row"><div><b>${esc(o.order_id)} · ${esc(o.product||'未提供产品名称')}</b><p>${esc(historyTime(m.created_at))} · ${o.deleted?'已在回收站':'已有分析记录'}</p></div><button class="secondary" data-duplicate-${o.deleted?'restore':'open'}="${esc(o.order_id)}" data-snapshot="${esc(m.snapshot_id)}">${o.deleted?'恢复原记录':'查看已有记录'}</button></div>`)).join('');
  $('duplicate-notice').scrollIntoView({behavior:'smooth',block:'start'});
}
$('duplicate-notice').addEventListener('click',async e=>{
  if(e.target.closest('#duplicate-close')){$('duplicate-notice').hidden=true;return;}
  const open=e.target.closest('[data-duplicate-open]'),restore=e.target.closest('[data-duplicate-restore]');
  if(open){await openHistoricalOrder(open.dataset.snapshot,open.dataset.duplicateOpen);return;}
  if(!restore||busy)return;
  setBusy(true);restore.disabled=true;
  try{
    await request('/api/history/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({snapshot_id:restore.dataset.snapshot,order_id:restore.dataset.duplicateRestore,confirmed:true})});
    try{sessionStorage.setItem('qiying.history.layout','records');}catch{}
    location.hash='history';location.reload();
  }catch(error){setError('恢复失败：'+error.message);restore.disabled=false;setBusy(false);}
});
async function beginExcelImport(file){
  const s={fileName:file.name,encoded:null,preview:null,dirty:false,working:true,confirming:false};excelSession=s;
  $('excel-adaptation-status').hidden=false;$('excel-adaptation-text').textContent='正在自动识别表格、校验字段并准备计算…';$('excel-adaptation-details').hidden=true;
  try{
    const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
    for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
    if(excelSession!==s)return;s.encoded=btoa(binary);
    const outcome=await(await request('/api/auto-import-xlsx',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workbook_base64:s.encoded,profiles:excelProfiles().filter(p=>p.approved===true)})})).json();
    if(excelSession!==s)return;
    if(['imported','duplicate'].includes(outcome.status)){excelSession=null;acceptImport(outcome);return;}
    if(outcome.status!=='needs_review')throw new Error('自动导入返回状态无效');
    showExcelReview(s,outcome.preview,outcome.reasons);
  }catch(e){if(excelSession===s){excelSession=null;updateAdaptationStatus();}throw e;}
}
function showExcelReview(s,preview,reasons){
  s.preview=preview;s.working=false;
  $('excel-import-filename').textContent=s.fileName;$('excel-import-content').innerHTML='';$('excel-cost-sheet-wrap').hidden=true;
  $('excel-import-ack').checked=false;$('excel-show-all').checked=false;fillProfiles();$('excel-profile').value='';$('excel-profile-name').value=s.fileName.replace(/\.xlsx$/i,'').slice(0,60);
  renderExcelPreview(preview);excelMessage('需要确认：'+reasons.join('；'),true);excelButtons();$('excel-import-dialog').showModal();
  updateAdaptationStatus();
}
function updateAdaptationStatus(analysis=!$('analysis-tabs').hidden){
  const r=result?.snapshot?.import_review;
  $('excel-adaptation-status').hidden=!analysis||!r;
  $('excel-adaptation-details').hidden=false;
  if(r)$('excel-adaptation-text').textContent=r.mode==='automatic_profile'?`已复用经过确认的导入方案「${r.profile_name}」并自动计算。业务待核验事项仍保留。`:r.mode==='automatic'?'已自动识别表格并完成计算，读取依据已保存；业务待核验事项仍保留。':'已按确认过的字段和单位完成计算，读取依据已保存。';
}
function rememberExcelMapping(s){
  if(!s.preview)return;
  const name=($('excel-profile').value||$('excel-profile-name').value||s.fileName).trim().slice(0,60);
  try{const profiles=excelProfiles().filter(x=>x.name!==name);profiles.unshift({name,mapping:s.preview.mapping,layout_signature:s.preview.layout_signature,approved:true});localStorage.setItem(profileKey,JSON.stringify(profiles.slice(0,20)));}catch{}
}
function collectExcelMapping(){
  if(excelSession?.preview?.kind!=='eva')return {};
  const fields={};for(const input of document.querySelectorAll('[data-excel-cell]'))fields[input.dataset.excelCell]={cell:input.value.trim().toUpperCase(),unit:document.querySelector(`[data-excel-unit="${input.dataset.excelCell}"]`).value};
  return {cost_sheet:$('excel-cost-sheet').value,fields};
}
async function refreshExcelPreview(mapping){
  const s=excelSession;if(!s?.encoded||s.confirming)return;
  s.controller?.abort();s.controller=new AbortController();s.working=true;s.dirty=true;$('excel-import-ack').checked=false;excelButtons();excelMessage('正在核对字段和读取值…');
  try{
    const p=await(await request('/api/preview-xlsx',{method:'POST',headers:{'Content-Type':'application/json'},signal:s.controller.signal,body:JSON.stringify({workbook_base64:s.encoded,mapping})})).json();
    if(excelSession!==s)return;s.preview=p;s.dirty=false;renderExcelPreview(p);
    excelMessage(p.blocking.length?'请处理以下问题：'+p.blocking.join('；'):'预览完成。请核对后勾选确认，再开始计算。',p.blocking.length>0);
  }catch(e){if(excelSession===s&&e.name!=='AbortError')excelMessage('预览失败：'+e.message+'。当前分析结果未改变。',true);}
  finally{if(excelSession===s){s.working=false;excelButtons();}}
}
function renderExcelPreview(p){
  $('excel-review-filter').hidden=p.kind!=='eva';
  $('excel-cost-sheet-wrap').hidden=p.kind!=='eva';
  $('excel-cost-sheet').innerHTML=(p.sheet_names||[]).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  if(p.mapping.cost_sheet)$('excel-cost-sheet').value=p.mapping.cost_sheet;
  const statuses={label:'按标签识别',manual:'指定位置',template:'模板位置，请重点核对',ambiguous:'多个候选，需选择'};
  const warning=`<ul class="import-warnings">${p.warnings?.map(x=>`<li>${esc(x)}</li>`).join('')||''}</ul>`;
  const content=p.kind==='standard'?`<h3>标准模板读取预览</h3><p class="help">按表头识别以下数据表。费用和数量的有效性将在确认后检查。</p><div class="table-scroll"><table><thead><tr><th>工作表</th><th>数据行数</th><th>读取表头</th></tr></thead><tbody>${p.tables.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.rows}</td><td>${esc(x.headers.join('、'))}</td></tr>`).join('')}</tbody></table></div>`:
  `<h3>订单与费用字段</h3><div class="table-scroll"><table class="import-fields"><thead><tr><th>字段</th><th>数值位置</th><th>按什么单位读取</th><th>读取数值</th><th>识别情况与原单位</th></tr></thead><tbody>${p.fields.map(f=>`<tr class="${f.error?'import-field-error':f.status==='template'?'import-field-review':''}"><td><b>${esc(f.label)}</b><small>${esc(f.group)}</small></td><td><input data-excel-cell="${esc(f.id)}" aria-label="${esc(f.label)}数值位置" value="${esc(f.cell)}" maxlength="9" placeholder="例如 E17" list="excel-candidates-${f.id}"><datalist id="excel-candidates-${f.id}">${f.candidates.map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist></td><td><select data-excel-unit="${f.id}" aria-label="${esc(f.label)}读取单位">${(f.id==='E8'?[['quantity','双']]:f.id==='E4'?[['per_pair','元/双']]:[['per_pair','元/双'],['total','元/整单']]).map(([v,label])=>`<option value="${v}" ${v===f.unit?'selected':''}>${label}</option>`).join('')}</select></td><td><strong>${f.value===null?'缺失或待确认':esc(f.value)}</strong>${f.raw?.startsWith('=')?`<small title="${esc(f.raw)}">公式：${esc(f.raw)}</small>`:''}</td><td>${esc(f.error||statuses[f.status])}<small>原标签：${esc(f.source_label||'未标注')}<br>原单位：${esc(f.source_unit||'未标注，请核对')}</small></td></tr>`).join('')}</tbody></table></div>`;
  const regions=p.regions.map(r=>`<details class="import-region"><summary>${esc(r.sheet)} · ${esc(r.range)} 读取区域</summary><p class="help">这里仍使用固定模板区域。请核对配方、SOP重量、尺码、数量和日报是否确实位于这些位置。</p><div class="table-scroll"><table><tbody>${r.rows.filter(row=>row.some(x=>x.value!=='')).map(row=>`<tr>${row.map(x=>`<td title="${esc(x.value)}"><small>${esc(x.cell)}</small>${esc(x.value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`).join('');
  const samples=p.kind==='standard'?p.tables.map(t=>`<details class="import-region"><summary>${esc(t.name)} · 前3行数据样例</summary><div class="table-scroll"><table><thead><tr>${t.headers.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${(t.samples||[]).map(row=>`<tr>${row.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`).join(''):'';
  $('excel-import-content').innerHTML=warning+content+samples+regions;
  for(const row of $('excel-import-content').querySelectorAll('.import-fields tbody tr')){
    const id=row.querySelector('[data-excel-cell]').dataset.excelCell;
    row.dataset.excelNeedsReview=String(p.fields.find(f=>f.id===id)?.requires_review!==false);
  }
  filterExcelFields();
}
function filterExcelFields(){for(const row of document.querySelectorAll('[data-excel-needs-review]'))row.hidden=!$('excel-show-all').checked&&row.dataset.excelNeedsReview==='false';}
function closeExcelImport(){if(excelSession?.confirming)return;excelSession?.controller?.abort();excelSession=null;$('excel-import-dialog').close();setBusy(false);}
function markExcelDirty(){if(!excelSession)return;excelSession.dirty=true;$('excel-import-ack').checked=false;excelMessage('字段或单位已修改，请先重新预览，核对新的读取值。');excelButtons();}
$('excel-import-content').addEventListener('input',e=>{if(e.target.matches('[data-excel-cell],[data-excel-unit]'))markExcelDirty();});
$('excel-import-ack').addEventListener('change',excelButtons);
$('excel-show-all').addEventListener('change',filterExcelFields);
$('excel-adaptation-details').addEventListener('click',()=>switchView('detail',result?.source_analysis?'import-evidence':'quality'));
$('excel-import-recheck').addEventListener('click',()=>refreshExcelPreview(collectExcelMapping()));
$('excel-cost-sheet').addEventListener('change',()=>refreshExcelPreview({cost_sheet:$('excel-cost-sheet').value}));
$('excel-import-close').addEventListener('click',closeExcelImport);
$('excel-import-dialog').addEventListener('cancel',e=>{e.preventDefault();closeExcelImport();});
$('excel-profile').addEventListener('change',()=>{const profile=excelProfiles().find(x=>x.name===$('excel-profile').value);if(profile)$('excel-profile-name').value=profile.name;refreshExcelPreview(profile?.mapping||{});});
$('excel-profile-save').addEventListener('click',()=>{
  const s=excelSession,name=$('excel-profile-name').value.trim();
  if(!s?.preview||s.dirty||s.preview.blocking.length)return excelMessage('请先完成没有阻塞问题的预览，再保存方案。',true);
  if(!name)return excelMessage('请填写方案名称。',true);
  try{const profiles=excelProfiles().filter(x=>x.name!==name);profiles.unshift({name,mapping:s.preview.mapping,layout_signature:s.preview.layout_signature,approved:$('excel-import-ack').checked});localStorage.setItem(profileKey,JSON.stringify(profiles.slice(0,20)));fillProfiles();$('excel-profile').value=name;excelMessage('导入方案已保存；完成确认计算后，同结构文件可自动复用。');}catch{excelMessage('浏览器本地存储不可用，方案未保存；仍可继续本次导入。',true);}
});
$('excel-profile-delete').addEventListener('click',()=>{try{const name=$('excel-profile').value;localStorage.setItem(profileKey,JSON.stringify(excelProfiles().filter(x=>x.name!==name)));fillProfiles();excelMessage('已删除所选方案，本次字段设置仍保留。');}catch{excelMessage('删除失败：浏览器本地存储不可用。',true);}});
$('excel-import-confirm').addEventListener('click',async()=>{
  const s=excelSession;if(!s?.preview||s.dirty||s.working||s.confirming||s.preview.blocking.length||!$('excel-import-ack').checked)return;
  s.confirming=true;setBusy(true);excelButtons();excelMessage('正在按确认过的位置和单位计算…');
  try{
    const data=await(await request('/api/import-reviewed-xlsx',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workbook_base64:s.encoded,mapping:s.preview.mapping,source_hash:s.preview.source_hash,confirmed:true})})).json();
    rememberExcelMapping(s);excelSession=null;$('excel-import-dialog').close();acceptImport(data);
  }catch(e){excelMessage('计算未完成：'+e.message+'。原分析结果保留。',true);}
  finally{s.confirming=false;setBusy(false);excelButtons();}
});
