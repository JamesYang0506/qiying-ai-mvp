import {installProjectLanguage,applyProjectLanguage,languageControl} from './project-i18n.js';
import {mountAuth} from './auth-page.js';
import {mountDailyData} from './daily-data.js';
import {mountImport} from './import-page.js';
import {mountImported} from './imported-workspace.js';
import {mountMonitor} from './monitor-workspace.js';
import {monitorMasthead} from './monitor-dashboard.js';
import {icon,esc} from './ui.js';
import {mountAi} from './ai-page.js';

const app=document.querySelector('#app');let cleanup=null;
const titles={monitor:['订单动态监测','持续跟踪生产变化，让每一笔订单的利润可见。'],import:['标准数据导入','导入成本表与每日表，核对后生成订单。'],imported:['订单分析','按日期推进，比较实际利润与同进度理论利润。'],data:['订单详细数据','按订单与业务日期核查 Excel 中的生产、成本来源及补单记录。'],ai:['AI 订单助手','围绕订单利润与成本提问。']};
function route(){const [name,rawId]=location.hash.slice(1).split('?')[0].split('/');let page=name==='order'?'imported':name;page=Object.hasOwn(titles,page)?page:'monitor';let id=null;try{id=rawId?decodeURIComponent(rawId):null;}catch{}if(name==='demo')history.replaceState(null,'','#monitor');return {page,id,query:new URLSearchParams(location.hash.split('?')[1]??'')};}
function toast(message){const element=document.querySelector('#toast');element.textContent=message;element.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>element.classList.remove('show'),3500);}
function shell(page){const [title,subtitle]=titles[page];const navigation=[['import','file','数据导入'],['monitor','chart','订单监测'],['data','file','订单详细数据'],['imported','chart','订单分析'],['ai','chat','AI 对话']];return `<aside class="sidebar"><a class="brand" href="#monitor" aria-label="企盈智擎首页"><img class="project-sidebar-logo" src="assets/qiying-logo.jpg" alt="企盈智擎"><span>企盈智擎</span></a><div class="brand-sub">QIYING INTELLIGENCE</div><div class="nav-label">工作空间</div><nav class="nav" aria-label="主要导航">${navigation.map(([key,symbol,label])=>`<a href="#${key}" title="${label}" class="${page===key?'active':''}" ${page===key?'aria-current="page"':''}>${icon(symbol)}<span>${label}</span></a>`).join('')}</nav><div class="side-bottom"><div class="side-user"><div class="avatar">企</div><div><strong>企盈智擎</strong><small>订单利润管理</small></div></div></div></aside><main class="main" id="main"><header class="topbar"><div><div class="eyebrow">ORDER INTELLIGENCE / ${page==='monitor'?'OVERVIEW':page.toUpperCase()}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${['monitor','data','imported','import','ai'].includes(page)?'':'<div class="top-actions"><a class="button" href="#monitor">订单监测</a><a class="button" href="#imported">订单分析</a><a class="button primary" href="#import">导入 Excel</a></div>'}</header><div id="${page==='monitor'?'monitor':'import'}-workspace"></div></main>`;}
function renderBusiness(){document.body.classList.remove('auth-page');cleanup?.();cleanup=null;const {page,id,query}=route();document.body.classList.add('monitor-dashboard');document.body.classList.toggle('ai-page',page==='ai');document.body.classList.toggle('daily-data-page',page==='data');document.body.classList.toggle('analysis-page',page==='imported');document.body.classList.toggle('import-page',page==='import');document.title=titles[page][0]+' · 企盈智擎';app.innerHTML=monitorMasthead()+shell(page);const root=document.querySelector(page==='monitor'?'#monitor-workspace':'#import-workspace');
 if(page==='monitor')cleanup=mountMonitor(root);
 else if(page==='import')cleanup=mountImport(root,{onSaved:result=>{toast(result.reused?'已有相同版本，未重复追加':'订单资料已保存');location.hash='#imported/'+encodeURIComponent(result.orderId);}});
 else if(page==='data')cleanup=mountDailyData(root,{orderId:id,initialDate:query.get('asOf')??'',initialRevision:query.get('revision')??''});
 else if(page==='imported')cleanup=mountImported(root,{orderId:id,initialView:page==='data'?'detail':'overview',initialDate:query.get('asOf')??'',initialRevision:query.get('revision')??'',initialMode:query.get('baselineMode')??'ideal'});
 else if(page==='ai')cleanup=mountAi(root);
 app.insertAdjacentHTML('beforeend','<div class="project-tools">'+languageControl()+'</div>');
 applyProjectLanguage();
}
let authUser=null,authRequired=true,authReady=false,bootSequence=0,pendingHash='#import';
const originalFetch=window.fetch.bind(window);
window.fetch=async(...args)=>{const response=await originalFetch(...args);const url=typeof args[0]==='string'?args[0]:args[0]?.url??'';if(authReady&&authRequired&&authUser&&response.status===401&&url.startsWith('/api/')&&!url.startsWith('/api/auth/')){authUser=null;authReady=false;pendingHash=location.hash;location.hash='#login';}return response;};
async function render(){
 const sequence=++bootSequence;cleanup?.();cleanup=null;
 if(!authReady){try{const response=await originalFetch('/api/auth/session');if(!response.ok)throw new Error('session');const body=await response.json();if(sequence!==bootSequence)return;authRequired=body.required!==false;authUser=body.user;authReady=true;}catch{if(sequence!==bootSequence)return;authUser=null;authRequired=true;}}
 const publicRoute=['#login','#register'].includes(location.hash);
 if(authRequired&&!authUser){if(!publicRoute){if(/^#(import|monitor|data|imported|ai)([/?]|$)/.test(location.hash))pendingHash=location.hash;history.replaceState(null,'','#login');}document.body.className='auth-page';cleanup=mountAuth(app,{initialMode:location.hash==='#register'?'register':'login',onLogin:user=>{authUser=user;authReady=true;location.hash=pendingHash;}});return;}
 if(publicRoute)history.replaceState(null,'','#import');renderBusiness();
 if(authUser){const actions=document.createElement('div');actions.className='auth-account-actions';actions.innerHTML='<span>'+esc(authUser.username)+'</span><button id="auth-logout" type="button">退出登录</button>';app.querySelector('.project-tools').appendChild(actions);actions.querySelector('button').onclick=async()=>{try{const r=await originalFetch('/api/auth/logout',{method:'POST'});if(!r.ok)throw new Error();authUser=null;authReady=false;pendingHash='#import';location.hash='#login';}catch{toast('退出失败，请重试');}};}
 applyProjectLanguage();
}
installProjectLanguage();
window.addEventListener('hashchange',()=>{render();window.scrollTo({top:0,behavior:'instant'});});render();
