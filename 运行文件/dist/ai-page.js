// Module C UI, merged from the v5 AI collaborator and adapted to the main app.
import {esc,icon} from './ui.js';
import {createAiTransport} from './ai-client.js';
const PROMPTS=[['哪些订单需要优先关注？','查看订单利润偏差'],['与预期相比少赚了多少？','比较同进度理论毛利'],['利润差距体现在哪些成本？','核查材料、人工与能耗'],['还需要补充哪些数据？','识别缺失记录与待核查信息']];
export function messageMarkup(messages){return messages.map((m,i)=>`<div class="msg ${m.role==='user'?'msg-user':'msg-ai'}"><div class="bubble" id="ai-message-${i}" data-i18n-preserve>${m.text?esc(m.text):'<span class="cursor"></span>'}</div></div>`).join('');}

export function renderAiWorkspace({scope,orders=[],messages=[],busy=false,online=false,checked=false,checking=false,model='—',draft='',status='',orderError='',serviceMessage=''}={}){
 const hasMessages=messages.length>0;
 return `<section class="ai-workspace ${hasMessages?'has-conversation':'is-welcome'}" aria-label="AI 对话工作区">
  ${hasMessages?`<div class="chat-stream ai-conversation" aria-live="polite">${messageMarkup(messages)}</div>`:`<div class="ai-welcome"><div class="ai-welcome-mark">${icon('spark')}<span>企盈 AI</span></div><h2>让每一次决策，都有依据</h2><p>从订单出发，聊聊利润、成本与下一步行动。</p></div>`}
  <form class="ai-entry" id="chat-form"><div class="chat-status ai-feedback" role="status">${esc(status)}</div>
   <textarea id="chat-input" aria-label="向 AI 提问" placeholder="问问订单利润，或聊聊下一步怎么做…" maxlength="2000" ${busy?'disabled':''}>${esc(draft)}</textarea>
   <div class="ai-entry-toolbar"><div class="ai-scope-controls">
    <label class="ai-scope-pill" for="ai-date">${icon('calendar')}<span>业务日期</span><input id="ai-date" aria-label="业务日期" type="date" value="${esc(scope.asOf)}" ${busy?'disabled':''}></label>
    <label class="ai-scope-pill ai-order-pill" for="ai-order">${icon('layers')}<span class="ai-order-caption">订单范围</span><select id="ai-order" aria-label="订单范围" ${busy?'disabled':''}><option value="">全部已导入订单</option>${orders.map(o=>`<option data-i18n-preserve value="${esc(o.id)}" ${o.id===scope.orderId?'selected':''}>${esc(o.id)} · ${esc(o.product||'')}</option>`).join('')}</select></label>
   </div><button class="ai-send" id="ai-send" type="submit" aria-label="${busy?'回答中…':'发送'}" title="${busy?'回答中…':'发送'}" ${!online||busy?'disabled':''}>${icon(busy?'clock':'arrow')}</button></div>
  </form>
  ${!hasMessages?`<div class="ai-quick-prompts" aria-label="快捷提问">${PROMPTS.map(([q,d],i)=>`<button type="button" data-prompt="${esc(q)}" title="${esc(d)}">${icon(['alert','chart','wallet','file'][i])}<span>${esc(q)}</span></button>`).join('')}</div>`:''}
  ${orderError?`<p class="ai-order-error" role="alert">${esc(orderError)}</p>`:''}
  <div class="ai-service-line"><span class="ai-connection ${online?'is-online':''}"><i></i>${!checked?'检测中…':online?'AI服务在线':'模型服务未启动'}</span><button type="button" id="ai-recheck" ${busy||checking?'disabled':''}>${icon('refresh')}重新检测</button></div>
  <details class="ai-context-details"><summary>分析范围与使用说明</summary><div><p>按业务日期读取已导入订单，使用网站统一核算口径。</p><p><span>当前模型</span>：<strong data-i18n-preserve>${esc(model)}</strong></p><p>${esc(serviceMessage)}</p><p>摘要过长时会明确提示截断，可选择单个订单核查。AI回复尚未逐条核验证据，关键结论请与订单明细核对。</p></div></details>
 </section>`;
}

export function mountAi(root){
 const client=createAiTransport();let alive=true,aiState=null,checked=false,checking=false,busy=false,draft='',status='',messages=[],orders=[],orderError='';
 let scope={asOf:new Date(Date.now()+8*3600000).toISOString().slice(0,10),orderId:''};
 const pageController=new AbortController();let chatController=null;
 const scroll=()=>{const box=root.querySelector('.chat-stream');if(box)box.scrollTop=box.scrollHeight;};
 function changeScope(key,value){scope={...scope,[key]:value};messages=[];status='';render();}
 function render(){
  if(!alive)return;
  const online=aiState?.status==='ready',model=online?(aiState?.chat_model||aiState?.loaded_model||aiState?.default_model||'—'):'—';
  root.innerHTML=renderAiWorkspace({scope,orders,messages,busy,online,checked,checking,model,draft,status,orderError,serviceMessage:online?'AI按所选范围解释利润与成本差异。改变范围会开始新对话。':aiState?.message||'正在检测AI服务…'});
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
