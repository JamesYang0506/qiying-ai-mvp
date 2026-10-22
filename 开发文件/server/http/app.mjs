import {resolveDataDir} from '../../../运行文件/paths.mjs';
import {createAuth} from './auth.mjs';
import http from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';import {createRoutes} from './routes.mjs';
import {createAiRoutes} from '../ai/routes.mjs';import {createAiClient} from '../ai/client.mjs';
export function createApp({root,dataDir=resolveDataDir(root),clock=Date.now,calculateOrder,allocateManufacturing,monitorCompute,authRequired=true,aiClient=createAiClient()}){
 const auth=createAuth({directory:path.join(dataDir,'auth'),clock,required:authRequired});
 const dist=path.join(root,'dist'),api=createRoutes({dataDir,clock,calculateOrder,allocateManufacturing,monitorCompute}),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
 // 本地大模型路由：必须挂在 api 之前（orders 路由会兜住整个 /api/v1/ 前缀）
 // getUser 传进去是为了「按账号存对话历史」——AI 路由要知道当前登录的是谁。
 let ai;try{ai=createAiRoutes({client:aiClient,clock,dataDir,getUser:auth.userFor});}catch(error){console.error(`[ai] 本地大模型接入未启用：${error.message}`);ai=async()=>false;}
 return http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');if(await auth.route(req,res,url))return;if(!auth.authorize(req,res,url))return;if(await ai(req,res,url))return;if(await api(req,res,url))return;if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}const name=decodeURIComponent(url.pathname)==='/'?'/index.html':decodeURIComponent(url.pathname),file=path.resolve(dist,'.'+name),relative=path.relative(dist,file);if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);res.end('Forbidden');return;}const content=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);}catch(e){res.writeHead(e.code==='ENOENT'||e.code==='EISDIR'?404:400,{'Content-Type':'text/plain; charset=utf-8'});res.end('页面不存在或请求无效');}});
}
