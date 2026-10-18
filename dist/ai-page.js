// Module C UI, merged from the v5 AI collaborator and adapted to the main app.
import {esc,icon} from './ui.js';
import {createAiTransport} from './ai-client.js';
const PROMPTS=[['哪些订单需要优先关注？','查看订单利润偏差'],['与预期相比少赚了多少？','比较同进度理论毛利'],['利润差距体现在哪些成本？','核查材料、人工与能耗'],['还需要补充哪些数据？','识别缺失记录与待核查信息']];
export function messageMarkup(messages){return messages.map((m,i)=>`<div class="msg ${m.role==='user'?'msg-user':'msg-ai'}"><div class="bubble" id="ai-message-${i}" data-i18n-preserve>${m.text?esc(m.text):'<span class="cursor"></span>'}</div></div>`).join('');}

export function mountAi(root){
 const client=createAiTransport();let alive=true,aiState=null,checked=false,checking=false,busy=false,draft='',status='',messages=[],orders=[],orderError='';
 let scope={asOf:new Date(Date.now()+8*3600000).toISOString().slice(0,10),orderId:''};
 const pageController=new AbortController();let chatController=null;
 const scroll=()=>{const box=root.querySelector('.chat-stream');if(box)box.scrollTop=box.scrollHeight;};
 function changeScope(key,value){scope={...scope,[key]:value};messages=[];status='';render();}
 function render(){
  if(!alive)return;
  const online=aiState?.status==='ready',model=online?(aiState?.chat_model||aiState?.loaded_model||aiState?.default_model||'—'):'—';
  root.innerHTML=`<div class="chat-layout"><aside class="panel chat-context"><h2>分析上下文</h2><p>按业务日期读取已导入订单，使用网站统一核算口径。</p><label class="ai-scope-label" for="ai-date">业务日期</label><input id="ai-date" type="date" class="control" value="${esc(scope.asOf)}" ${busy?'disabled':''}><label class="ai-scope-label" for="ai-order">订单范围</label><select id="ai-order" class="control" ${busy?'disabled':''}><option value="">全部已导入订单</option>${orders.map(o=>`<option data-i18n-preserve value="${esc(o.id)}" ${o.id===scope.orderId?'selected':''}>${esc(o.id)} · ${esc(o.product||'')}</option>`).join('')}</select>${orderError?`<p role="alert">${esc(orderError)}</p>`:''}<div class="context-line"><span>服务状态</span><strong class="${online?'ai-on':'ai-off'}">${!checked?'检测中…':online?'已接入':'模型服务未启动'}</strong></div><div class="context-line"><span>当前模型</span><strong data-i18n-preserve>${esc(model)}</strong></div><button class="button ai-recheck" id="ai-recheck" ${busy||checking?'disabled':''}>${icon('refresh')}重新检测</button><div class="help-block">${icon('info')} ${online?'AI按所选范围解释利润与成本差异。改变范围会开始新对话。':esc(aiState?.message||'正在检测AI服务…')}</div><p class="ai-scope-note">摘要过长时会明确提示截断，可选择单个订单核查。AI回复尚未逐条核验证据，关键结论请与订单明细核对。</p></aside><section class="panel chat-panel"><div class="chat-stream" aria-live="polite">${messageMarkup(messages)}</div>${!messages.length?`<div class="chat-center"><div class="ai-orb">${icon('spark')}</div><h2>让订单数据更容易理解</h2><p>选择日期和订单，再提问利润变化与成本偏差。</p><div class="prompts">${PROMPTS.map(([q,d])=>`<button class="prompt" data-prompt="${esc(q)}">${esc(q)}<span>${esc(d)}</span></button>`).join('')}</div></div>`:''}<form class="composer" id="chat-form"><div class="chat-status" role="status">${esc(status)}</div><div class="composer-box"><textarea id="chat-input" aria-label="向 AI 提问" placeholder="输入关于订单利润或生产数据的问题…" maxlength="2000" ${busy?'disabled':''}>${esc(draft)}</textarea><div class="composer-actions"><span>${online?'AI服务在线':'AI接口已整合，等待模型服务启动'}</span><button class="button primary" type="submit" ${!online||busy?'disabled':''}>${icon('send')}${busy?'回答中…':'发送'}</button></div></div><p class="footnote">回答基于本地模型与核算摘要，原因判断仍需结合明细核查。</p></form></section></div>`;
  scroll();
  root.querySelector('#chat-input').oninput=e=>{draft=e.target.value;};
  root.querySelector('#ai-date').onchange=e=>changeScope('asOf',e.target.value);
  root.querySelector('#ai-order').onchange=e=>changeScope('orderId',e.target.value);
  root.querySelector('#ai-recheck').onclick=check;
  root.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{draft=b.dataset.prompt;const input=root.querySelector('#chat-input');input.value=draft;input.focus();});
  root.querySelector('#chat-form').onsubmit=async e=>{
   e.preventDefault();const question=draft.trim();if(!question||busy||!online)return;
   if(!scope.asOf){status='请选择业务日期';render();return;}
   const history=messages.filter(m=>m.complete).slice(-20).map(m=>({role:m.role==='user'?'user':'assistant',content:m.text}));
   busy=true;status='';draft='';const user={role:'user',text:question,complete:false},answer={role:'assistant',text:'',complete:false};messages.push(user,answer);const index=messages.length-1;
   chatController=new AbortController();render();
   try{
    await client.sendChat({message:question,history,...scope,signal:chatController.signal,onDelta:part=>{if(!alive)return;answer.text+=part;const bubble=root.querySelector(`#ai-message-${index}`);if(bubble)bubble.textContent=answer.text;scroll();}});
    user.complete=true;answer.complete=true;status='已完成';
   }catch(error){if(!alive)return;status=error.message;answer.text=answer.text?answer.text+'\n\n〔回答未完成：'+error.message+'〕':error.message;}
   finally{busy=false;chatController=null;if(alive)render();}
  };
 }
 async function check(){
  if(!alive||checking)return;checking=true;render();
  try{aiState=await client.status({signal:pageController.signal});checked=true;}
  catch{if(!alive)return;aiState={status:'offline',message:'检测中断，请重试'};checked=true;}
  finally{checking=false;if(alive)render();}
 }
 async function loadOrders(){
  try{const response=await fetch('/api/import-v1/orders',{signal:pageController.signal});if(!response.ok)throw new Error('订单列表读取失败，请重新登录或刷新');const body=await response.json();orders=body.orders||[];}
  catch(error){if(!alive)return;orderError=error.message;}
  if(alive)render();
 }
 render();check();loadOrders();
 return()=>{alive=false;pageController.abort();chatController?.abort();};
}
