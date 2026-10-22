// Module C UI, merged from the v5 AI collaborator and adapted to the main app.
import {esc,icon} from './ui.js';
import {createAiTransport} from './ai-client.js';

// 首屏预设问题：严格对应《订单管理AI预设问题与回答设计》第二节 Q01~Q06。
// 按钮文字用文档原文，title 里标出适用范围，避免用户在「全部订单」范围下点 Q02/Q03（那两个需要先选订单）。
const PROMPTS=[
 ['截至今天，各订单赚得怎么样？','Q01 · 当前筛选范围内的全部订单','chart'],
 ['这个订单最早哪天开始异常？','Q02 · 选定单个订单','alert'],
 ['这个订单主要少赚在哪里？','Q03 · 选定单个订单','wallet'],
 ['当天情况是在改善，还是继续变差？','Q04 · 选定单个订单','arrow'],
 ['我应该先让哪个部门核查什么？','Q05 · 选定异常订单','layers'],
 ['有哪些数据还不足以确认原因？','Q06 · 选定订单或当前范围','file']
];

// 模型回答是 Markdown（标题 / 加粗 / 列表 / 表格）。原来直接塞进 textContent，
// 界面上就是满屏的 `##` 和 `| --- |`，Q01 的订单表也会散架。这里做最小渲染。
function mdToHtml(text){
 // 🔴 模型常在表格单元格里用 <br> 换行（Markdown 表格本身写不了换行）。
 //    先整体转义再只把这一种标签还原回来 —— 白名单单项，不会打开 XSS 口子。
 const safe=String(text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/&lt;br\s*\/?&gt;/gi,'<br>');
 const lines=safe.split('\n'),out=[];let table=null;
 const flush=()=>{
  if(!table)return;
  const [head,...body]=table;
  out.push(`<table class="md-table"><thead><tr>${head.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${
   body.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
  table=null;
 };
 for(const line of lines){
  const t=line.trim();
  if(/^\|.*\|$/.test(t)){
   const cells=t.replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
   if(cells.every(c=>/^:?-{2,}:?$/.test(c)))continue;   // 跳过 |---|---| 分隔行
   (table||(table=[])).push(cells);
   continue;
  }
  flush();
  if(!t){out.push('<div class="md-gap"></div>');continue;}
  if(/^#{1,4}\s/.test(t)){out.push(`<div class="md-h">${t.replace(/^#{1,4}\s*/,'')}</div>`);continue;}
  if(/^[-·•]\s+/.test(t)){out.push(`<div class="md-li">· ${t.replace(/^[-·•]\s+/,'')}</div>`);continue;}
  if(/^\d+[.、)]\s+/.test(t)){out.push(`<div class="md-li"><span class="md-num">${(t.match(/^\d+/)||[''])[0]}.</span> ${t.replace(/^\d+[.、)]\s+/,'')}</div>`);continue;}
  out.push(`<div class="md-p">${t}</div>`);
 }
 flush();
 return out.join('').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
}

// 🔴 对话放在模块级：mountAi 每次切页面都会被重建（renderBusiness 先 cleanup 再 innerHTML），
//    局部变量会连同历史一起丢掉。用户的现象就是「问了问题切到别的栏，回来全没了」。
//    sessionStorage 额外兜住刷新页面。
let chatMessages=[];
const CHAT_KEY='qiying.ai.chat.v1';
function loadChat(){
 try{const raw=sessionStorage.getItem(CHAT_KEY);const list=raw?JSON.parse(raw):[];return Array.isArray(list)?list.filter(m=>m&&typeof m.text==='string'):[];}catch{return [];}
}
function saveChat(list){
 try{sessionStorage.setItem(CHAT_KEY,JSON.stringify(list.slice(-40)));}catch{}
}
chatMessages=loadChat();

export function messageMarkup(messages){return messages.map((m,i)=>`<div class="msg ${m.role==='user'?'msg-user':'msg-ai'}"><div class="bubble" id="ai-message-${i}" data-i18n-preserve>${m.text?mdToHtml(m.text):'<span class="cursor"></span>'}${m.hint?`<div class="ai-hint">${m.hint}</div>`:''}</div></div>`).join('');}

// 历史对话侧栏（DeepSeek 风格）：新建 + 列表 + 删除。
// 标题由 AI 在首轮回答结束后生成（见 makeTitle），生成前先用问题前 18 字兜底。
function historyMarkup(chats,currentChatId,busy){
 const items=chats.length
  ? chats.map(c=>`<div class="ai-chat-item ${c.id===currentChatId?'is-active':''}" data-chat="${esc(c.id)}" role="button" tabindex="0" title="${esc(c.title)}">
      <span class="ai-chat-title">${esc(c.title||'未命名对话')}</span>
      <button type="button" class="ai-chat-del" data-del="${esc(c.id)}" title="删除对话" aria-label="删除对话">×</button>
    </div>`).join('')
  : '<p class="ai-history-empty">还没有历史对话</p>';
 return `<aside class="ai-history" aria-label="历史对话">
   <button type="button" class="ai-new" id="ai-new">${icon('spark')}<span>新对话</span></button>
   <div class="ai-history-label">历史对话</div>
   <div class="ai-history-scroll">${items}</div>
 </aside>`;
}

export function renderAiWorkspace({scope,orders=[],messages=[],busy=false,online=false,checked=false,checking=false,model='—',draft='',status='',orderError='',serviceMessage='',chats=[],currentChatId='',memorySummary='',memoryAsks=0}={}){
 const hasMessages=messages.length>0;
 return `<div class="ai-shell">
 ${historyMarkup(chats,currentChatId,busy)}
 <section class="ai-workspace ${hasMessages?'has-conversation':'is-welcome'}" aria-label="AI 对话工作区">
  ${hasMessages?`<div class="chat-stream ai-conversation" aria-live="polite">${messageMarkup(messages)}</div>`:`<div class="ai-welcome"><div class="ai-welcome-mark">${icon('spark')}<span>企盈 AI</span></div><h2>让每一次决策，都有依据</h2><p>从订单出发，聊聊利润、成本与下一步行动。</p></div>`}
  <form class="ai-entry" id="chat-form"><div class="chat-status ai-feedback" role="status">${esc(status)}</div>
   <textarea id="chat-input" aria-label="向 AI 提问" placeholder="问问订单利润，或聊聊下一步怎么做…" maxlength="2000" ${busy?'disabled':''}>${esc(draft)}</textarea>
   <div class="ai-entry-toolbar"><div class="ai-scope-controls">
    <label class="ai-scope-pill" for="ai-date">${icon('calendar')}<span>业务日期</span><input id="ai-date" aria-label="业务日期" type="date" value="${esc(scope.asOf)}" ${busy?'disabled':''}></label>
    <label class="ai-scope-pill ai-order-pill" for="ai-order">${icon('layers')}<span class="ai-order-caption">订单范围</span><select id="ai-order" aria-label="订单范围" ${busy?'disabled':''}><option value="">全部已导入订单</option>${orders.map(o=>`<option data-i18n-preserve value="${esc(o.id)}" ${o.id===scope.orderId?'selected':''}>${esc(o.id)} · ${esc(o.product||'')}</option>`).join('')}</select></label>
   </div><button class="ai-send ${busy?'is-stop':''}" id="ai-send" type="submit" aria-label="${busy?'停止生成':'发送'}" title="${busy?'停止生成':'发送'}" ${!online?'disabled':''}>${busy?'<i class="ai-stop-glyph"></i>':icon('arrow')}</button></div>
  </form>
  ${!hasMessages?`<div class="ai-quick-prompts" aria-label="快捷提问">${PROMPTS.map(([q,d,ic])=>`<button type="button" data-prompt="${esc(q)}" title="${esc(d)}">${icon(ic)}<span>${esc(q)}</span></button>`).join('')}</div>`:''}
  ${orderError?`<p class="ai-order-error" role="alert">${esc(orderError)}</p>`:''}
  <div class="ai-service-line"><span class="ai-connection ${online?'is-online':''}"><i></i>${!checked?'检测中…':online?'AI服务在线':'模型服务未启动'}</span><button type="button" id="ai-recheck" ${busy||checking?'disabled':''}>${icon('refresh')}重新检测</button></div>
  <details class="ai-context-details"><summary>分析范围与使用说明</summary><div><p>按业务日期读取已导入订单，使用网站统一核算口径。</p><p><span>当前模型</span>：<strong data-i18n-preserve>${esc(model)}</strong></p>${memorySummary?`<p><span>AI 已记住你的偏好</span>（累计 ${memoryAsks} 次提问，只影响表达方式，不改数据口径）：</p><div class="ai-memory-notes">${memorySummary.split('\n').filter(Boolean).map(l=>`<p>${esc(l)}</p>`).join('')}</div>`:`<p><span>AI 记忆</span>：${memoryAsks?'记录中，再问几次就会有偏好':'还没有记录，聊几次后会自动形成你的偏好'}</p>`}<p>${esc(serviceMessage)}</p><p>摘要过长时会明确提示截断，可选择单个订单核查。AI回复尚未逐条核验证据，关键结论请与订单明细核对。</p></div></details>
 </section>
</div>`;
}

// 当前打开的会话 id 也放模块级：切到别的栏目再回来，会话要能接上（不只是消息正文）
let currentChat='';
let previousOwner='';

/** 清空会话内缓存（切换账号 / 退出登录时调用，避免看到上一个账号的对话） */
export function resetAiState(){
 chatMessages=[];
 currentChat='';
}

export function mountAi(root){
 // 账号变了就丢掉上一个账号的会话（模块级变量在 SPA 切页时不会自动清）
 const owner=String((window.__qiyingUser&&window.__qiyingUser.id)||'');
 if(previousOwner&&owner&&previousOwner!==owner){chatMessages=[];currentChat='';}
 if(owner)previousOwner=owner;
 const client=createAiTransport();let alive=true,aiState=null,checked=false,checking=false,busy=false,draft='',status='',messages=chatMessages,orders=[],orderError='';
 let chats=[],currentChatId=currentChat;
 let memorySummary='',memoryAsks=0;
 let scope={asOf:new Date(Date.now()+8*3600000).toISOString().slice(0,10),orderId:''};
 const pageController=new AbortController();let chatController=null;
 const scroll=()=>{const box=root.querySelector('.chat-stream');if(box)box.scrollTop=box.scrollHeight;};

 // ---------------- 对话历史（按账号存在服务端，前端只做展示） ----------------
 const aiFetch=async(path,opt={})=>{
  const r=await fetch('/api/v1/ai'+path,{signal:pageController.signal,...opt});
  if(!r.ok){const b=await r.json().catch(()=>null);throw new Error(b?.error?.message||`HTTP ${r.status}`);}
  return r.json();
 };

 async function refreshChats(){
  try{const body=await aiFetch('/conversations');chats=(body.data?.conversations||[]).slice();}
  catch{chats=[];}
  if(alive)render();
 }

 // 读取该账号被记住的交互偏好（只读展示，让用户知道 AI 学了什么）
 async function loadMemory(){
  try{
   const body=await aiFetch('/memory');
   const d=body.data||{};
   memorySummary=String(d.summary||'');
   memoryAsks=Number(d.asks||0);
  }catch{memorySummary='';memoryAsks=0;}
  if(alive)render();
 }

 // 保存当前对话。title 为空时先用提问的前 18 字兜底，等 AI 拟好标题再覆盖一次。
 async function persistChat(title){
  if(!chatMessages.length)return;
  if(!currentChatId){currentChatId='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);currentChat=currentChatId;}
  const firstUser=chatMessages.find(m=>m.role==='user');
  const body={
   id:currentChatId,
   title:(title||ruleTitle(firstUser?.text)).slice(0,40),
   messages:chatMessages.map(m=>({role:m.role==='user'?'user':'ai',text:m.text}))
  };
  try{
   await aiFetch('/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   await refreshChats();
  }catch{}
 }

 // 规则兜底标题：不用模型也能给出可读的概括。
 // 为什么需要它：gpt-oss 是推理模型，对「一句话标题」这种活会长时间思考——
 // 实测给 800 token 仍然 finish=length、正文 0 字、耗时 30s。所以推理模型直接走规则。
 function ruleTitle(question){
  const text=String(question||'').replace(/\s+/g,'');
  const m=text.match(/([A-Za-z]{2,}-[A-Za-z0-9]{2,}(?:-[A-Za-z]{2,})?)/);
  // SIM-A011-QUOTE → A011；取中间那段做简称
  const order=m?m[1].split('-').filter(x=>!/^(SIM|QUOTE|ORDER)$/i.test(x)).join(''):'';
  const rules=[
   // 业务规则放前面：更具体，优先命中；避免被下面的通用词误伤
   [/最早.*异常|首次异常|哪天开始|什么时候开始/, '首次异常日'],
   [/少赚在哪|主要.*少赚|差在哪|成本.*(差|拆)/, '成本差额拆解'],
   [/改善|变差|趋势|近期/, '近期趋势'],
   [/哪个部门|核查什么|找谁|谁去查/, '部门核查建议'],
   [/数据.*不足|缺.*数据|还差什么|不足以/, '数据缺口'],
   [/涨|涨价|用量/, '材料成本动因'],
   [/人工/, '人工成本'],
   [/不良|质量|返工/, '质量与不良'],
   [/各订单|所有订单|全部订单/, '各订单盈亏'],
   [/赚|亏|盈亏|利润|毛利/, '盈亏情况'],
   // 使用/闲聊：收窄关键词。「在哪」这种太宽，会把「少赚在哪里」误判成使用问题
   [/怎么用|教程|使用方法|怎么操作|怎样使用|怎么导入|如何导入|在哪导入|在哪看|入口|这个网站|这个系统/, '使用指引'],
   [/^(你好|您好|hi|hello|在吗|嗨|哈喽|有人|在不在)/i, '打招呼'],
  ];
  const hit=rules.find(([re])=>re.test(text));
  if(hit)return (order?order+' ':'')+hit[1];
  // 🔴 兜底别再写死一个词：从问题本身提炼，否则所有未命中都是一个样
  const core=text
   .replace(/^(请|请问|帮我|帮忙|我想|想|能不能|可以|麻烦|教一下我|教我|给我|说说|讲讲|聊聊)/,'')
   .replace(/^[一下点些的，,\s]+/,'')
   .replace(/[？?。！!，,、；;：:…]+$/,'')
   .trim();
  return (order?order+' ':'')+(core.slice(0,12)||'新对话');
 }

 // 让模型给这次对话拟一个「精辟概括」的标题：只喂首问+回答开头，别把整段塞进去。
 // ⚠️ 8 秒硬超时：qwen 一般 1~2 秒就出；gpt-oss 一旦陷进思考就永远出不来，
 //    宁可退回规则标题，也不能让侧栏一直挂着「未命名对话」。
 async function makeTitle(){
  const u=chatMessages.find(m=>m.role==='user'),a=chatMessages.find(m=>m.role==='assistant'&&m.text);
  if(!u)return '';
  const fallback=ruleTitle(u.text);
  // 🔴 推理模型（gpt-oss 等）拟标题一定超时：它思考 14~37 秒是常态，白等 8 秒没意义，直接用规则标题。
  const reasoning=/gpt-oss|o1|o3|deepseek-r|reason/i.test(String(aiState?.chat_model||''));
  if(reasoning)return fallback;
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),8000);
  try{
   const r=await fetch('/api/v1/ai/chat',{
    method:'POST',headers:{'Content-Type':'application/json'},signal:ctrl.signal,
    body:JSON.stringify({
     messages:[
      {role:'system',content:'你是标题助手。用不超过 12 个汉字概括这段对话在问什么，点出订单或成本项。只输出标题本身，不要标点、引号、序号、markdown 或任何解释。'},
      {role:'user',content:`问：${u.text}\n答：${(a?.text||'').slice(0,240)}`}
     ],
     max_tokens:120,temperature:0.2
    })
   });
   if(!r.ok)return fallback;
   const j=await r.json();
   const raw=String(j.data?.content||'');
   const first=raw.split('\n').map(x=>x.trim()).filter(Boolean)[0]||'';
   const clean=first
    .replace(/^#+\s*/,'')
    .replace(/^["'“”《「『【(（]+|["'“”》」』】)）]+$/g,'')
    .replace(/[。！？!?；;，,、：:*`]+$/,'')
    .trim().slice(0,18);
   // 模型给了实质内容就用它的，否则用规则标题
   return clean.replace(/[\s"'“”《》「」]/g,'').length>=2?clean:fallback;
  }catch{return fallback;}
  finally{clearTimeout(timer);}
 }

 function newChat(){
  if(busy)return;
  chatMessages.length=0;saveChat(chatMessages);
  currentChatId='';currentChat='';status='';draft='';render();
 }

 async function openChat(id){
  if(busy||id===currentChatId)return;
  try{
   const body=await aiFetch('/conversations/'+encodeURIComponent(id));
   const conv=body.data||{};
   chatMessages.length=0;
   for(const m of (conv.messages||[]))chatMessages.push({role:m.role==='ai'?'assistant':'user',text:String(m.text||''),complete:true});
   saveChat(chatMessages);
   currentChatId=id;currentChat=id;status='';render();
  }catch(error){status='打开对话失败：'+error.message;render();}
 }

 async function deleteChat(id){
  if(busy)return;
  try{await aiFetch('/conversations/'+encodeURIComponent(id),{method:'DELETE'});}catch{}
  if(id===currentChatId){chatMessages.length=0;saveChat(chatMessages);currentChatId='';currentChat='';}
  await refreshChats();
 }

 function changeScope(key,value){scope={...scope,[key]:value};chatMessages.length=0;saveChat(chatMessages);currentChatId='';currentChat='';status='';render();}
 function render(){
  if(!alive)return;
  const online=aiState?.status==='ready',model=online?(aiState?.chat_model||aiState?.loaded_model||aiState?.default_model||'—'):'—';
  root.innerHTML=renderAiWorkspace({scope,orders,messages,busy,online,checked,checking,model,draft,status,orderError,chats,currentChatId,memorySummary,memoryAsks,serviceMessage:online?'AI按所选范围解释利润与成本差异。改变范围会开始新对话。':aiState?.message||'正在检测AI服务…'});
  scroll();
  root.querySelector('#ai-new').onclick=newChat;
  root.querySelectorAll('[data-chat]').forEach(el=>{
   el.onclick=()=>openChat(el.dataset.chat);
   el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openChat(el.dataset.chat);}};
  });
  root.querySelectorAll('[data-del]').forEach(b=>{
   b.onclick=e=>{e.stopPropagation();deleteChat(b.dataset.del);};
  });
  root.querySelector('#chat-input').oninput=e=>{draft=e.target.value;};
  // 回车发送 / Shift+Enter 换行。中文输入法组词时的回车不能当发送（isComposing / keyCode 229）
  root.querySelector('#chat-input').onkeydown=e=>{
   if(e.key!=='Enter'||e.shiftKey)return;
   if(e.isComposing||e.keyCode===229)return;
   e.preventDefault();
   const form=root.querySelector('#chat-form');
   if(form&&typeof form.requestSubmit==='function')form.requestSubmit();
  };
  root.querySelector('#ai-date').onchange=e=>changeScope('asOf',e.target.value);
  root.querySelector('#ai-order').onchange=e=>changeScope('orderId',e.target.value);
  root.querySelector('#ai-recheck').onclick=check;
  root.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{draft=b.dataset.prompt;const input=root.querySelector('#chat-input');input.value=draft;input.focus();});
  root.querySelector('#chat-form').onsubmit=async e=>{
   e.preventDefault();
   // 生成中再点发送 = 停止生成（切页不再中断请求，所以必须有一个显式的停止出口）
   if(busy){try{chatController?.abort();}catch{} status='已停止';return;}
   const question=draft.trim();if(!question||!online)return;
   if(!scope.asOf){status='请选择业务日期';render();return;}
   const history=messages.filter(m=>m.complete).slice(-20).map(m=>({role:m.role==='user'?'user':'assistant',content:m.text}));
   busy=true;status='';draft='';const user={role:'user',text:question,complete:false},answer={role:'assistant',text:'',complete:false};messages.push(user,answer);const index=messages.length-1;
   chatController=new AbortController();render();
   // 🔴 流式渲染必须节流：一个 1000 字的回答会推 500~600 个 delta，
   //    每个都跑一遍 mdToHtml + 整块 innerHTML 替换 + 读 scrollHeight（强制重排），
   //    等于每秒重排几十次 —— 这是「回答越长越卡」的直接原因。
   //    这里合并到每帧最多渲染一次（≈60fps），渲染次数降到原来的 1/10。
   const bubbleEl=root.querySelector(`#ai-message-${index}`);
   const startedAt=Date.now();
   let rafPending=false,thinkChars=0,rendered='',spinnerMounted=false;
   const paint=()=>{
    rafPending=false;
    if(!alive||!bubbleEl)return;
    let changed=false;
    const hint=answer.hint?`<div class="ai-hint">${answer.hint}</div>`:'';
    if(answer.text){
     // 正文到了：整体换成 Markdown。结构被替换，下次进思考态要重新挂 spinner。
     const html=mdToHtml(answer.text)+hint;
     if(html===rendered)return;
     rendered=html;spinnerMounted=false;
     bubbleEl.innerHTML=html;
     changed=true;
    }else{
     // 思考中：🔴 spinner 只插一次，之后只改旁边那段文字。
     //    之前每秒重写整个 innerHTML，等于每秒销毁一个正在旋转的 <i> 再建一个新的，
     //    CSS 动画每次从 0° 重来 —— 看起来就是「一卡一卡」。
     const sec=Math.round((Date.now()-startedAt)/1000);
     const label=`正在思考${thinkChars?`（已推理 ${thinkChars} 字）`:''} ${sec}s`;
     if(!spinnerMounted){
      bubbleEl.innerHTML='<span class="ai-thinking"><i class="ai-spinner"></i><span class="ai-think-text"></span></span>';
      spinnerMounted=true;
     }
     const textEl=bubbleEl.querySelector('.ai-think-text');
     if(textEl&&textEl.textContent!==label){textEl.textContent=label;changed=true;}
    }
    // 🔴 只有内容真变了才读 scrollHeight（它会强制同步布局）。
    //    thinking 是按 token 推的，每个都滚一次的话，转圈会被反复重排打断。
    if(!changed)return;
    const box=root.querySelector('.chat-stream');
    if(box)box.scrollTop=box.scrollHeight;
   };
   const schedule=()=>{if(rafPending||!alive)return;rafPending=true;requestAnimationFrame(paint);};
   const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
   // 思考阶段没有 delta，靠定时器让秒数动起来，用户才知道没卡死
   const tick=setInterval(()=>{if(!answer.text)schedule();},1000);
   try{
    await client.sendChat({message:question,history,...scope,signal:chatController.signal,
     onDelta:part=>{answer.text+=part;schedule();},
     onThinking:part=>{thinkChars+=part.length;schedule();},
     // 排队位置：上游算好了「前面还有几个人」，站点转发成 queue 事件。
     // 原来这个数字被整条丢掉，用户只能干等几分钟，以为卡死了。
     onQueue:ahead=>{if(ahead>0){answer.hint=esc(`当前另有 ${ahead} 个问题在处理，这条回答可能要等一会儿`);schedule();}},
     // 回答撞到长度上限被截断：不提示的话用户会以为模型话说一半
     onNote:note=>{if(note&&note.reason){answer.hint=esc(note.reason);schedule();}},
     // 模型写了摘要里没有的数字：业务问答最怕这个，必须让用户看见
     onWarning:warn=>{if(warn&&Array.isArray(warn.numbers)&&warn.numbers.length){answer.hint=esc(`回答里出现摘要中没有的数字：${warn.numbers.join('、')}，请核对后再用`);schedule();}}});
    user.complete=true;answer.complete=true;status='已完成';
   }catch(error){
    const aborted=/abort/i.test(String((error&&error.name)||'')+String((error&&error.message)||''));
    if(aborted){answer.text=answer.text||'（已停止）';}
    else if(answer.text){answer.text+='\n\n〔回答未完成：'+error.message+'〕';}
    else{answer.text=error.message;}
    if(alive)status=aborted?'已停止':error.message;
   }
   finally{
    clearInterval(tick);
    if(!answer.complete){answer.complete=true;user.complete=true;}
    busy=false;chatController=null;saveChat(chatMessages);    if(alive)render();
    // 落库；首轮结束后再让 AI 拟标题覆盖一次（都是异步的，不影响界面）
    if(chatMessages.some(m=>m.complete)){
     const isFirst=chatMessages.filter(m=>m.role==='user').length===1;
     persistChat().then(async()=>{
      if(!isFirst)return;
      const t=await makeTitle();
      if(t)await persistChat(t);
      loadMemory();   // 偏好可能刚更新，刷一下详情里的展示
     }).catch(()=>{});
    }
   }
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
 render();check();loadOrders();refreshChats();loadMemory();
 // 切页只中止「页面数据请求」（status/订单列表），**不中止正在生成的回答**：
 // 用户问完切到别的栏目再回来，回答应该已经生成好了，而不是被掐断。
 // 停止生成本身走「停止」按钮（那里显式 abort chatController）。
 return()=>{alive=false;pageController.abort();};
}
