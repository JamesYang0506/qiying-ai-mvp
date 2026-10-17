import {renderMonitorDashboard} from './monitor-dashboard.js';
import {renderMonitorEvidence} from './monitor-evidence.js';
const saved={asOf:'',mode:'ideal',period:16,customer:'',status:'',risk:'',search:'',filter:'',sort:'risk',selected:null,page:1,view:null};
export function hideNotStarted(state){return !state.search&&state.status!=='未开工'&&state.filter!=='not_started';}
export function filterMonitorRows(orders,state){
 const hide=hideNotStarted(state);
 return (orders??[]).filter(row=>{
  if(hide&&row.monitoringStatus==='未开工')return false;
  if(!state.filter)return true;
  if(state.filter==='deteriorated')return row.comparison.deteriorated;
  if(state.filter==='incomplete')return row.quality.missing.length>0;
  return row.distribution===state.filter;
 });
}
export function mountMonitor(root,{client=fetch}={}){
 let alive=true,sequence=0,loading=false,error='',data=saved.view,detail=null,searchTimer,controller=null;
 const request=async(path,opts={})=>{const r=await client(path,opts);let body;try{body=await r.json();}catch{throw new Error('监测服务未就绪，请重启网站后重试');}if(!r.ok)throw new Error(body.error?.message??'查询失败');return body;};
 const persist=()=>{saved.view=data;};
 function render(){
  const searchFocused=document.activeElement?.id==='bm-search',searchPosition=searchFocused?document.activeElement.selectionStart:null,searchEnd=searchFocused?document.activeElement.selectionEnd:null,searchDirection=searchFocused?document.activeElement.selectionDirection:'none';
  const d=data,rows=filterMonitorRows(d?.orders??[],saved),hiddenNotStarted=hideNotStarted(saved)?(d?.orders??[]).filter(r=>r.monitoringStatus==='未开工').length:0;
  rows.sort((a,b)=>(saved.sort==='risk'?(a.risk?.priority??5)-(b.risk?.priority??5):saved.sort==='deviation'?(a.marginDeviationPp==null?b.marginDeviationPp==null?0:1:b.marginDeviationPp==null?-1:Number(a.marginDeviationPp)-Number(b.marginDeviationPp)):saved.sort==='yesterday'?(a.comparison.marginChangePp==null?b.comparison.marginChangePp==null?0:1:b.comparison.marginChangePp==null?-1:Number(a.comparison.marginChangePp)-Number(b.comparison.marginChangePp)):0)||a.order.id.localeCompare(b.order.id));
  const pages=Math.max(1,Math.ceil(rows.length/6));saved.page=Math.min(saved.page,pages);const page=rows.slice((saved.page-1)*6,saved.page*6),selected=d?.orders.find(r=>r.order.id===saved.selected)??d?.orders.find(r=>d.attention.includes(r.order.id));
  root.innerHTML=renderMonitorDashboard({data:d,rows,page,pages,selected,state:saved,loading,error,detailMarkup:detail?renderMonitorEvidence(detail):'',hiddenNotStarted});
  root.querySelector('#bm-refresh').onclick=()=>load();
  root.querySelector('#bm-see-all')?.addEventListener('click',()=>{saved.filter='deteriorated';saved.page=1;render();root.querySelector('.bm-orders').scrollIntoView({behavior:'smooth',block:'start'});});
  root.querySelector('#bm-show-not-started')?.addEventListener('click',()=>{saved.filter='not_started';saved.page=1;render();});
  root.querySelector('#bm-date').onchange=e=>{saved.asOf=e.target.value;saved.page=1;load();};
  root.querySelector('#bm-mode').onchange=e=>{saved.mode=e.target.value;load();};
  root.querySelector('#bm-period').onchange=e=>{saved.period=Number(e.target.value);load();};
  for(const [id,key] of [['bm-customer','customer'],['bm-status','status'],['bm-risk','risk']])root.querySelector('#'+id).onchange=e=>{saved[key]=e.target.value;saved.page=1;load();};
  root.querySelector('#bm-reset').onclick=()=>{clearTimeout(searchTimer);Object.assign(saved,{customer:'',status:'',risk:'',search:'',period:16,filter:'',sort:'risk',page:1});load();};
  const search=root.querySelector('#bm-search');search.oninput=e=>{sequence++;saved.search=e.target.value;saved.page=1;clearTimeout(searchTimer);searchTimer=setTimeout(load,250);};
  root.querySelector('#bm-sort')?.addEventListener('change',e=>{saved.sort=e.target.value;saved.page=1;render();});
  root.querySelector('#bm-clear-list')?.addEventListener('click',()=>{saved.filter='';saved.page=1;render();});
  root.querySelectorAll('[data-bm-page]').forEach(button=>button.onclick=()=>{saved.page=Number(button.dataset.bmPage);render();});
  if(searchFocused){search.focus();search.setSelectionRange(searchPosition,searchEnd,searchDirection);}
  root.querySelectorAll('[data-bm-bucket]').forEach(b=>b.onclick=()=>{saved.filter=saved.filter===b.dataset.bmBucket?'':b.dataset.bmBucket;saved.page=1;render();});
  root.querySelectorAll('[data-bm-select]').forEach(b=>b.onclick=()=>{saved.selected=b.dataset.bmSelect;render();});
  root.querySelectorAll('[data-bm-day]').forEach(b=>{const run=()=>{saved.asOf=b.dataset.bmDay;load();};b.onclick=run;b.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();run();}};});
  root.querySelectorAll('[data-bm-evidence]').forEach(b=>b.onclick=()=>showEvidence(b.dataset.bmEvidence));
  const prev=root.querySelector('#bm-prev'),next=root.querySelector('#bm-next');if(prev)prev.onclick=()=>{saved.page--;render();};if(next)next.onclick=()=>{saved.page++;render();};
  root.querySelector('#bm-close')?.addEventListener('click',()=>{detail=null;render();});
  root.querySelector('.bm-dialog')?.addEventListener('keydown',e=>{if(e.key==='Escape'){detail=null;render();}});
 }
 async function showEvidence(snapshotId){const seq=sequence;try{const body=await request(`/api/import-v1/monitor/views/${encodeURIComponent(data.viewId)}/snapshots/${encodeURIComponent(snapshotId)}/evidence`,{signal:controller?.signal});if(!alive||seq!==sequence)return;detail={...body,order:data.orders.find(r=>r.snapshotId===snapshotId)};render();root.querySelector('#bm-close').focus();}catch(e){if(alive&&seq===sequence&&e.name!=='AbortError'){error=e.message;render();}}}
 async function load(){const seq=++sequence;controller?.abort();controller=new AbortController();const signal=controller.signal;loading=true;error='';detail=null;render();try{clearTimeout(searchTimer);const q=new URLSearchParams({period:saved.period,baselineMode:saved.mode,customer:saved.customer,status:saved.status,risk:saved.risk,search:saved.search});if(saved.asOf)q.set('asOf',saved.asOf);const body=await request('/api/import-v1/monitor?'+q,{signal});if(!alive||seq!==sequence)return;data=body;saved.asOf=body.scope.asOf;saved.view=data;persist();}catch(e){if(alive&&seq===sequence&&e.name!=='AbortError')error=e.message;}finally{if(alive&&seq===sequence){loading=false;render();}}}

 function chartTip(e){
  const tip=root.querySelector('#bm-chart-tip'),element=e.target.closest?.('[data-tip]');if(!tip)return;
  if(!element){tip.hidden=true;return;}tip.textContent=element.dataset.tip;tip.hidden=false;
  const box=element.getBoundingClientRect(),r=tip.getBoundingClientRect(),x=e.clientX??box.left+box.width/2,y=e.clientY??box.bottom;
  tip.style.left=Math.max(10,Math.min(x+14,innerWidth-r.width-10))+'px';tip.style.top=Math.max(10,Math.min(y+14,innerHeight-r.height-10))+'px';
 }
 const hideTip=()=>{const tip=root.querySelector('#bm-chart-tip');if(tip)tip.hidden=true;};
 root.addEventListener('pointermove',chartTip);root.addEventListener('pointerleave',hideTip);root.addEventListener('focusin',chartTip);root.addEventListener('focusout',hideTip);
 render();load();return ()=>{alive=false;sequence++;controller?.abort();clearTimeout(searchTimer);persist();root.removeEventListener('pointermove',chartTip);root.removeEventListener('pointerleave',hideTip);root.removeEventListener('focusin',chartTip);root.removeEventListener('focusout',hideTip);};
}
