import {mountAi} from './ai-workspace.js';
import {orderRoute} from './route-context.js';
import {mountDailyData} from './daily-data.js';
import {mountImport} from './import-page.js';
import {mountImported} from './imported-workspace.js';
import {mountMonitor} from './monitor-workspace.js';
import {monitorMasthead} from './monitor-dashboard.js';
import {icon} from './ui.js';

const app=document.querySelector('#app');let cleanup=null,currentScope=null;
function syncScope(scope){currentScope=scope;document.querySelectorAll('[data-context-page]').forEach(a=>{if(['data','imported'].includes(a.dataset.contextPage))a.href=orderRoute(a.dataset.contextPage,scope);});}
const titles={monitor:['订单动态监测','持续跟踪生产变化，让每一笔订单的利润可见。'],import:['标准数据导入','导入成本表与每日表，核对后生成订单。'],imported:['订单动态利润','按日期推进，比较实际利润与同进度理论利润。'],data:['订单详细数据','按订单与业务日期核查 Excel 中的生产、成本来源及补单记录。'],ai:['AI 订单助手','围绕订单利润与成本提问。']};
function route(){const [name,rawId]=location.hash.slice(1).split('?')[0].split('/');let page=name==='order'?'imported':name;page=Object.hasOwn(titles,page)?page:'monitor';let id=null;try{id=rawId?decodeURIComponent(rawId):null;}catch{}if(name==='demo')history.replaceState(null,'','#monitor');return {page,id,query:new URLSearchParams(location.hash.split('?')[1]??'')};}
function toast(message){const element=document.querySelector('#toast');element.textContent=message;element.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>element.classList.remove('show'),3500);}
function shell(page){const [title,subtitle]=titles[page];const navigation=[['monitor','chart','订单监测'],['data','file','订单详细数据'],['import','file','数据导入'],['imported','chart','订单分析'],['ai','chat','AI 对话']];return `<aside class="sidebar"><a class="brand" href="#monitor" aria-label="企盈智擎首页"><span class="brand-mark"></span><span>企盈智擎</span></a><div class="brand-sub">QIYING INTELLIGENCE</div><div class="nav-label">工作空间</div><nav class="nav" aria-label="主要导航">${navigation.map(([key,symbol,label])=>`<a data-context-page="${key}" href="#${key}" title="${label}" class="${page===key?'active':''}" ${page===key?'aria-current="page"':''}>${icon(symbol)}<span>${label}</span></a>`).join('')}</nav><div class="side-bottom"><div class="side-user"><div class="avatar">企</div><div><strong>企盈智擎</strong><small>订单利润管理</small></div></div></div></aside><main class="main" id="main"><header class="topbar"><div><div class="eyebrow">ORDER INTELLIGENCE / ${page==='monitor'?'OVERVIEW':page.toUpperCase()}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${page==='monitor'?'':'<div class="top-actions"><a class="button" href="#monitor">订单监测</a><a class="button" data-context-page="imported" href="#imported">订单分析</a><a class="button primary" href="#import">导入 Excel</a></div>'}</header><div id="${page==='monitor'?'monitor':'import'}-workspace"></div></main>`;}
function render(){cleanup?.();cleanup=null;const {page,id,query}=route();document.body.classList.toggle('monitor-dashboard',['monitor','data'].includes(page));document.body.classList.toggle('daily-data-page',page==='data');document.title=titles[page][0]+' · 企盈智擎';app.innerHTML=(['monitor','data'].includes(page)?monitorMasthead():'')+shell(page);const root=document.querySelector(page==='monitor'?'#monitor-workspace':'#import-workspace');syncScope(id?{orderId:id,asOf:query.get('asOf'),revision:query.get('revision'),baselineMode:query.get('baselineMode'),knownAt:query.get('knownAt')}:currentScope);
 if(page==='monitor')cleanup=mountMonitor(root);
 else if(page==='import')cleanup=mountImport(root,{onSaved:result=>{toast(result.reused?'已有相同版本，未重复追加':'订单资料已保存');location.hash='#imported/'+encodeURIComponent(result.orderId);}});
 else if(page==='data')cleanup=mountDailyData(root,{orderId:id,initialDate:query.get('asOf')??'',initialRevision:query.get('revision')??'',initialKnownAt:query.get('knownAt')??'',initialMode:query.get('baselineMode')??'ideal',onScopeChange:syncScope});
 else if(page==='imported')cleanup=mountImported(root,{orderId:id,initialView:page==='data'?'detail':'overview',initialDate:query.get('asOf')??'',initialRevision:query.get('revision')??'',initialKnownAt:query.get('knownAt')??'',onScopeChange:syncScope,initialMode:query.get('baselineMode')??'ideal'});
 else cleanup=mountAi(root);
}
window.addEventListener('hashchange',()=>{render();window.scrollTo({top:0,behavior:'instant'});});render();
