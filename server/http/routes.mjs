import path from 'node:path';
import {createMonitorRepository} from '../monitor/storage.mjs';
import {createMonitorService} from '../monitor/overview.mjs';
import {randomUUID,randomBytes} from 'node:crypto';
import {readXlsx} from '../import/xlsx.mjs';import {normalizePair,FIX_HINTS} from '../import/normalize.mjs';import {evaluate} from '../profit/evaluate.mjs';import {trend} from '../profit/trend.mjs';import {createStore,digest} from '../storage/store.mjs';import {readUpload,readJson} from './uploads.mjs';
import {D,money,sum} from '../profit/decimal.mjs';import {CATEGORIES} from '../model.mjs';
const decTotal=(rows,key)=>!rows.length?null:rows.some(r=>r[key]==null)?null:rows.reduce((s,r)=>s.plus(r[key]),new D(0)).toString();
function previewStats(ds){
 const processed=decTotal(ds.production,'processed'),defects=decTotal(ds.production,'defects');
 const good=processed!==null&&defects!==null?new D(processed).minus(defects).toString():null;
 const prices=ds.materials.map(r=>r.price).filter(v=>v!=null);
 return {production:{count:ds.production.length,processed,defects,good},supplements:{count:ds.supplements.length,quantity:decTotal(ds.supplements,'quantity')},materials:{count:ds.materials.length,net:decTotal(ds.materials,'net'),priceMin:prices.length?prices.reduce((a,b)=>new D(b).lt(a)?b:a):null,priceMax:prices.length?prices.reduce((a,b)=>new D(b).gt(a)?b:a):null},expenses:{count:ds.expenses.length,amount:decTotal(ds.expenses,'amount'),byCategory:Object.fromEntries(CATEGORIES.map(c=>[c,decTotal(ds.expenses.filter(r=>r.category===c),'amount')]).filter(([,v])=>v!==null))}};
}
export function createRoutes({dataDir,clock=Date.now}){
 const store=createStore(dataDir),token=randomBytes(24).toString('hex'),previews=new Map();let busy=false;
 const repository=createMonitorRepository(path.join(dataDir,'monitor-state'));
 const monitor=createMonitorService({store,repository,clock});
 const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));};
 return async(req,res,url)=>{
  const prefix='/api/import-v1';if(!url.pathname.startsWith(prefix+'/'))return false;
  try{
   const route=url.pathname.slice(prefix.length),parts=route.split('/').filter(Boolean).map(decodeURIComponent),host=req.headers.host??'';
   if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host))throw Object.assign(new Error('只允许本机访问'),{status:403});
   if(req.method==='POST'&&(req.headers.origin!==`http://${host}`||req.headers['x-qiying-token']!==token))throw Object.assign(new Error('请从本站页面提交，或刷新页面后重试'),{status:403});
   if(req.method==='GET'&&route==='/session'){send(res,200,{token,version:'import-v1',templateVersion:'A-ORDER-0.2',capabilities:['monitor-scope-v3']});return true;}
   if(req.method==='GET'&&route==='/monitor'){send(res,200,await monitor.create({asOf:url.searchParams.get('asOf')||undefined,period:Number(url.searchParams.get('period')??7),baselineMode:url.searchParams.get('baselineMode')??'ideal',knownAt:url.searchParams.get('knownAt')||undefined,customer:url.searchParams.get('customer')??'',status:url.searchParams.get('status')??'',risk:url.searchParams.get('risk')??'',search:url.searchParams.get('search')??''}));return true;}
   if(req.method==='GET'&&parts[0]==='monitor'&&parts[1]==='views'&&parts.length===3){send(res,200,await monitor.get(parts[2]));return true;}
   if(req.method==='GET'&&parts[0]==='monitor'&&parts[1]==='views'&&parts[3]==='snapshots'&&parts[5]==='evidence'&&parts.length===6){send(res,200,await monitor.evidence(parts[2],parts[4]));return true;}
   if(req.method==='POST'&&route==='/previews'){
    if(busy)throw Object.assign(new Error('正在解析另一份文件，请稍后重试'),{status:429});busy=true;
    try{
     for(const [id,p]of previews)if(clock()-p.at>=600000)previews.delete(id);
     if(previews.size>=20)throw Object.assign(new Error('预览数量过多，请等待旧预览过期'),{status:429});
     const files=await readUpload(req);let result;try{result=normalizePair(readXlsx(files.costFile.buffer),readXlsx(files.dailyFile.buffer));}catch(e){throw Object.assign(new Error(e.message),{status:422});}
     if(!result.issues.some(i=>i.severity==='error')){const a=evaluate(result.dataset,{asOf:result.dataset.order.end});for(const m of a.quality.missing)result.issues.push({severity:'missing',code:'SCOPE_INCOMPLETE',fileRole:'daily',sheet:m.field==='material'?'每日材料':m.field==='production'?'每日生产':'每日费用',cell:null,field:m.field,recordId:null,message:`${m.date} ${m.detail}`,hint:FIX_HINTS.SCOPE_INCOMPLETE});}
     const previewId=randomUUID(),hash=digest(result.dataset);previews.set(previewId,{at:clock(),result,digest:hash});
     send(res,200,{previewId,digest:hash,summary:result.summary,issues:result.issues,previewStats:previewStats(result.dataset),canCommit:!result.issues.some(i=>i.severity==='error'),requiresIncomplete:result.issues.some(i=>i.severity==='missing'),preview:Object.fromEntries(['production','materials','expenses','supplements'].map(k=>[k,result.dataset[k].slice(0,200)]))});
    }finally{busy=false;}return true;
   }
   if(req.method==='POST'&&parts[0]==='previews'&&parts[2]==='commit'&&parts.length===3){const p=previews.get(parts[1]);if(!p||clock()-p.at>=600000)throw Object.assign(new Error('预览已过期或服务已重启，请重新解析文件'),{status:410});const body=await readJson(req);if(body.digest!==p.digest)throw Object.assign(new Error('预览内容摘要不一致，请重新解析'),{status:409});if(p.result.issues.some(i=>i.severity==='error'))throw Object.assign(new Error('请先修正格式和业务校验错误'),{status:422});if(p.result.issues.some(i=>i.severity==='missing')&&body.allowIncomplete!==true)throw Object.assign(new Error('资料不完整，请明确选择保存为待补齐版本'),{status:422});send(res,200,await store.commit(p.result.dataset));return true;}
   if(req.method==='GET'&&route==='/orders'){send(res,200,{orders:await store.listOrders()});return true;}
   if(req.method==='GET'&&route==='/portfolio'){
    const knownAt=url.searchParams.get('knownAt')||undefined;
    if(knownAt!==undefined&&(!Number.isFinite(Date.parse(knownAt))||Date.parse(knownAt)>clock()))throw new Error('信息截止时间无效或晚于当前时间');
    let orders=await store.listOrders();if(knownAt){const latest=new Map();for(const v of await store.listVersions())if(Date.parse(v.createdAt)<=Date.parse(knownAt))latest.set(v.dataset.order.id,{...v.dataset.order,revisionId:v.dataset.revision.id});orders=[...latest.values()];}
    const asOf=url.searchParams.get('asOf')??orders[0]?.start??new Date().toISOString().slice(0,10),baselineMode=url.searchParams.get('baselineMode')??'ideal';
    const rows=[];for(const order of orders){const a=evaluate(await store.get(order.id,order.revisionId),{asOf,baselineMode,knownAt});rows.push({order,cumulative:a.cumulative,quality:a.quality});}
    const known=rows.filter(r=>r.quality.state!=='not_started'&&r.cumulative.actual.gross!==null),comparable=known.filter(r=>r.cumulative.expected.gross!==null);
    send(res,200,{asOf,orders:rows,totals:{count:orders.length,known:known.length,comparable:comparable.length,excluded:orders.length-comparable.length,actualGross:known.length?money(sum(known.map(r=>r.cumulative.actual.gross))):null,expectedGross:comparable.length?money(sum(comparable.map(r=>r.cumulative.expected.gross))):null,gap:comparable.length?money(sum(comparable.map(r=>r.cumulative.gap))):null}});return true;
   }
   if(req.method==='GET'&&parts[0]==='orders'&&parts.length===3){const id=parts[1],action=parts[2];if(action==='revisions'){send(res,200,{revisions:await store.listRevisions(id)});return true;}const dataset=await store.get(id,url.searchParams.get('revision'));const knownAt=url.searchParams.get('knownAt')||undefined;if(knownAt!==undefined&&(!Number.isFinite(Date.parse(knownAt))||Date.parse(knownAt)>clock()))throw new Error('信息截止时间无效或晚于当前时间');if(action==='analysis'){send(res,200,evaluate(dataset,{asOf:url.searchParams.get('asOf')??dataset.order.start,baselineMode:url.searchParams.get('baselineMode')??'ideal',knownAt}));return true;}if(action==='trend'){send(res,200,{points:trend(dataset,{start:url.searchParams.get('start')??dataset.order.start,end:url.searchParams.get('end')??dataset.order.end,baselineMode:url.searchParams.get('baselineMode')??'ideal',knownAt})});return true;}}
   throw Object.assign(new Error('接口不存在'),{status:404});
  }catch(e){req.resume();send(res,e.status??400,{error:{message:e.message,code:e.status??'REQUEST_FAILED'}});return true;}
 };
}
