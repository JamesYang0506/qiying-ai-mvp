import {randomUUID} from 'node:crypto';
import {readJson} from '../http/uploads.mjs';
import {fail} from './repository.mjs';

export function createOrderRoutes({service,token}){
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/v1/'))return false;
  const send=(status,data,error)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify({schema_version:'1.0',request_id:randomUUID(),...(error?{error}:{data})}));};
  try{
   const host=req.headers.host??'';if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host))throw fail('FORBIDDEN','只允许本机访问',403);
   if(['POST','PUT'].includes(req.method)&&(req.headers.origin!==`http://${host}`||req.headers['x-qiying-token']!==token))throw fail('FORBIDDEN','请从本站页面提交并携带会话令牌',403);
   const parts=url.pathname.slice('/api/v1/'.length).split('/').map(decodeURIComponent),q=Object.fromEntries(url.searchParams),key=req.headers['idempotency-key'];let value,status=200;
   if(req.method==='POST'&&parts.length===1&&parts[0]==='orders'){value=await service.createOrder(await readJson(req),key);status=201;}
   else if(req.method==='PUT'&&parts[0]==='orders'&&parts.length===2)value=await service.updateOrder(parts[1],await readJson(req),key);
   else if(req.method==='POST'&&parts[0]==='orders'&&parts.length===3&&parts[2]==='baselines'){value=await service.baseline(parts[1],await readJson(req),key);status=201;}
   else if(req.method==='POST'&&parts.join('/')==='reports/batches'){value=await service.batch(await readJson(req),key);status=202;}
   else if(req.method==='GET'&&parts[0]==='reports'&&parts[1]==='batches'&&parts.length===3)value=await service.getBatch(parts[2]);
   else if(req.method==='POST'&&parts.length===1&&parts[0]==='manufacturing-pools'){value=await service.pool(await readJson(req),key);status=202;}
   else if(req.method==='POST'&&parts[0]==='orders'&&parts[2]==='recalculations'&&parts.length===3){value=await service.recalculate(parts[1],await readJson(req),key);status=202;}
   else if(req.method==='GET'&&parts[0]==='jobs'&&parts.length===2)value=await service.getJob(parts[1]);
   else if(req.method==='POST'&&parts.join('/')==='portfolio/views'){value=await service.createView(await readJson(req),key);status=201;}
   else if(req.method==='GET'&&parts[0]==='portfolio'&&parts[1]==='views'&&parts.length===3)value=await service.portfolio(parts[2],q);
   else if(req.method==='GET'&&parts[0]==='portfolio'&&parts[1]==='views'&&parts[3]==='trend'&&parts.length===4)value=await service.trend(parts[2],q);
   else if(req.method==='GET'&&parts[0]==='orders'&&parts[2]==='snapshots'&&parts.length===3)value=await service.snapshots(parts[1],q);
   else if(req.method==='GET'&&parts[0]==='orders'&&parts[2]==='snapshots'&&parts.length===4)value=await service.getSnapshot(parts[1],parts[3]);
   else if(req.method==='GET'&&parts[0]==='orders'&&parts[2]==='reports'&&parts.length===3)value=await service.reports(parts[1],q);
   else if(req.method==='GET'&&parts[0]==='snapshots'&&parts[2]==='evidence'&&parts.length===3)value=await service.evidence(parts[1]);
   else throw fail('NOT_FOUND','接口不存在',404);
   send(status,value);
  }catch(e){req.resume();send(e.status??400,null,{code:e.code??'INVALID_REQUEST',message:e.message,details:(e.details??[]).map(d=>({field:d.field??(d.index!=null?`reports[${d.index}]`:''),message:d.message??d.reason??'字段无效'})),retryable:e.status>=500});}
  return true;
 };
}
