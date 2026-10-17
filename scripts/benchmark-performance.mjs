import {readFile,readdir,writeFile,mkdir,stat,copyFile,rm,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createApp} from '../server/http/app.mjs';
import {evaluate} from '../server/profit/evaluate.mjs';
import {digest} from '../server/storage/store.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const versionFile=/^[a-f0-9]{64}\.json$/;
const day=/^\d{4}-\d{2}-\d{2}$/;

export function parseBenchmarkArgs(argv=process.argv.slice(2)){
 let sourceDir,output,warmup=3,runs=20,orders=0,period=16,days=16,skipHistory=false,quick=false,warmupSet=false,runsSet=false,historySet=false;
 const integer=(flag,value,{min=0,max=Number.MAX_SAFE_INTEGER}={})=>{const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${flag} 需要 ${min}–${max} 的整数`);return n;};
 for(let i=0;i<argv.length;i++){
  const flag=argv[i],value=argv[i+1];
  if(flag==='--data-dir'){if(!value)throw new Error('必须显式提供 --data-dir <隔离目录>');sourceDir=value;i++;}
  else if(flag==='--output'){if(!value)throw new Error('--output 需要 JSON 路径');output=value;i++;}
  else if(flag==='--warmup'){warmup=integer(flag,value,{min:0,max:100});warmupSet=true;i++;}
  else if(flag==='--runs'){runs=integer(flag,value,{min:1,max:1000});runsSet=true;i++;}
  else if(flag==='--orders'){orders=integer(flag,value,{min:0,max:1000});i++;}
  else if(flag==='--period'){period=integer(flag,value,{min:1,max:90});i++;}
  else if(flag==='--days'){days=integer(flag,value,{min:1,max:3660});i++;}
  else if(flag==='--skip-history'){skipHistory=true;historySet=true;}
  else if(flag==='--quick')quick=true;
  else throw new Error(`未知参数 ${flag}`);
 }
 if(quick){if(!warmupSet)warmup=1;if(!runsSet)runs=5;if(!historySet)skipHistory=true;}
 if(!sourceDir)throw new Error('必须显式提供 --data-dir <隔离目录>，不会默认使用真实 data');
 const resolvedSource=path.resolve(sourceDir);
 const resolvedOutput=path.resolve(output??path.join(root,'output',`performance-${stamp()}.json`));
 return {sourceDir:resolvedSource,output:resolvedOutput,warmup,runs,orders,period,days,skipHistory,quick};
}
export function assertInsideTemp(tempRoot,target){
 const rel=path.relative(path.resolve(tempRoot),path.resolve(target));
 if(rel.startsWith('..')||path.isAbsolute(rel))throw new Error('清理路径必须位于临时目录内');
 return path.resolve(target);
}
const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
const pct=(sorted,p)=>sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(p*sorted.length)-1))];
const round=n=>Number(n.toFixed(3));
function summarize(times,{bytes=0,calls=0,writeBytes=0,extra={}}={}){
 const sorted=[...times].sort((a,b)=>a-b),sum=times.reduce((a,b)=>a+b,0);
 return {runs:times.length,p50:round(pct(sorted,.5)),p95:round(pct(sorted,.95)),max:round(sorted.at(-1)),mean:round(sum/times.length),avgResponseBytes:Math.round(bytes/times.length),evaluateCalls:calls,evaluateCallsPerRun:round(calls/times.length),writeBytes,...extra};
}
async function dataFiles(dir){
 return (await readdir(dir,{withFileTypes:true})).filter(e=>e.isFile()&&versionFile.test(e.name)).map(e=>path.join(dir,e.name)).sort();
}
async function readDatasets(dir){
 const files=await dataFiles(dir),out=[];
 for(const file of files)out.push(JSON.parse(await readFile(file,'utf8')));
 return out;
}
function rowsOf(d){return ['production','materials','expenses','supplements'].reduce((s,k)=>s+(d[k]?.length??0),0);}
function maxEnd(orders){return orders.reduce((end,o)=>o.end>end?o.end:end,orders[0]?.end??'');}
function shiftDay(value,n){const d=new Date(value+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}

async function copyHistory(source,target){
 const bSource=path.join(source,'b-module','b-state.json'),bTarget=path.join(target,'b-module','b-state.json');
 await mkdir(path.dirname(bTarget),{recursive:true});
 try{await copyFile(bSource,bTarget);}catch(e){if(e.code!=='ENOENT')throw e;return 0;}
 return (await stat(bTarget)).size;
}
async function copyVersions(source,target){
 const files=await dataFiles(source);
 for(const file of files)await copyFile(file,path.join(target,path.basename(file)));
 return files.length;
}
// Fixture-only writer mirroring createStore.commit's immutable file layout.
async function writeSyntheticVersions(source,target,count){
 const bases=await readDatasets(source);
 if(!bases.length)throw new Error('源目录没有可复用的导入版本，无法生成合成基准订单');
 const now=Date.now();
 for(let i=0;i<count;i++){
  const d=structuredClone(bases[i%bases.length].dataset);
  d.order.id=`PERF-${String(i+1).padStart(3,'0')}`;
  d.revision.id=`REV-PERF-${String(i+1).padStart(3,'0')}`;
  const hash=digest(d),key=createHash('sha256').update(d.order.id+'\0'+d.revision.id).digest('hex');
  await writeFile(path.join(target,key+'.json'),JSON.stringify({hash,createdAt:new Date(now+i).toISOString(),dataset:d}));
 }
 return count;
}

export async function main(argv=process.argv.slice(2)){
 const options=parseBenchmarkArgs(argv);
 const sourceStat=await stat(options.sourceDir).catch(()=>null);
 if(!sourceStat?.isDirectory())throw new Error(`--data-dir 不是目录：${options.sourceDir}`);
 if(options.output===options.sourceDir||options.output.startsWith(options.sourceDir+path.sep))throw new Error('--output 不能写入源数据目录');
 const existing=await dataFiles(options.sourceDir);
 if(options.orders===0&&!existing.length)throw new Error('源目录没有导入版本 JSON');
 const temp=assertInsideTemp(os.tmpdir(),await mkdtemp(path.join(os.tmpdir(),'qiying-perf-')));
 const bFile=path.join(temp,'b-module','b-state.json');
 let app;
 try{
  await mkdir(temp,{recursive:true});
  const copiedBytes=options.skipHistory?0:await copyHistory(options.sourceDir,temp);
  const versionCount=options.orders>0?await writeSyntheticVersions(options.sourceDir,temp,options.orders):await copyVersions(options.sourceDir,temp);
  const datasets=(await readDatasets(temp)).map(x=>x.dataset);
  const orders=datasets.map(d=>({...d.order,revisionId:d.revision.id,baselineId:d.baseline.id}));
  const rows=datasets.reduce((s,d)=>s+rowsOf(d),0);
  const asOf=maxEnd(orders);
  if(!day.test(asOf))throw new Error('数据中没有有效订单结束日期');
  const knownAt=new Date().toISOString();
  const history=await historyStats(bFile,options.skipHistory);
  let calls=0;
  const monitorCompute=(dataset,opts)=>{calls++;return evaluate(dataset,opts);};
  app=createApp({root,dataDir:temp,monitorCompute,authRequired:false});
  await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${app.address().port}/api/import-v1`;
  const get=async pathname=>{const t0=performance.now();const response=await fetch(base+pathname);const text=await response.text();const ms=performance.now()-t0;let body;try{body=JSON.parse(text);}catch{throw new Error(`接口返回非 JSON：${pathname}`);}if(!response.ok)throw new Error(`${pathname} ${response.status}: ${body.error?.message??text.slice(0,200)}`);return {ms,body,bytes:Buffer.byteLength(text)};};
  const listed=(await get('/orders')).body.orders,order=listed.find(o=>o.id==='A011')??listed.at(-1);
  if(!order)throw new Error('没有可用于分析场景的订单');
  const monitorPath=`/monitor?asOf=${asOf}&period=${options.period}&baselineMode=ideal&knownAt=${encodeURIComponent(knownAt)}`;
  let viewId=history.firstViewId??null,snapshotId=history.firstSnapshotId??null,setupError=null;
  try{const setup=await get(monitorPath);viewId=setup.body.viewId;snapshotId=setup.body.orders?.[0]?.snapshotId??snapshotId;}
  catch(e){setupError=e.message;}
  const scenarios={},orderedCount=body=>body?.orders?.length??body?.totals?.count??null,daysBetween=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/86400000);
  const run=async(name,fn,{write=false,writeDir=bFile}={})=>{
   const size=()=>sizeOfDir(writeDir);
   for(let i=0;i<options.warmup;i++)await fn();
   const before=write?await size():0;calls=0;const times=[];let bytes=0,last;
   for(let i=0;i<options.runs;i++){last=await fn();times.push(last.ms);bytes+=last.bytes;}
   scenarios[name]=summarize(times,{bytes,calls,writeBytes:write?(await size())-before:0,extra:{responseBytes:last.bytes,orderCount:orderedCount(last.body),windowDays:last.body?.scope?.periodStart?daysBetween(last.body.scope.periodStart,last.body.scope.asOf)+1:null}});
  };
  const safeRun=async(name,fn,opts)=>{try{await run(name,fn,opts);}catch(e){scenarios[name]={error:e.message,skipped:true};}};
  if(setupError)scenarios.monitor={error:setupError,skipped:true,note:'当前监测历史已超过可序列化上限，无法追加新视图'};
  else await safeRun('monitor',()=>get(monitorPath),{write:true,writeDir:path.join(temp,'monitor-state')});
  await safeRun('analysis',()=>get(`/orders/${encodeURIComponent(order.id)}/analysis?asOf=${order.end}&baselineMode=ideal`));
  const trendStart=shiftDay(order.end,1-options.days),trendFrom=trendStart<order.start?order.start:trendStart;
  await safeRun('trend',()=>get(`/orders/${encodeURIComponent(order.id)}/trend?start=${trendFrom}&end=${order.end}&baselineMode=ideal`));
  await safeRun('portfolio',()=>get(`/portfolio?asOf=${asOf}&baselineMode=ideal`));
  if(viewId)await safeRun('view',()=>get(`/monitor/views/${encodeURIComponent(viewId)}`));
  if(viewId&&snapshotId)await safeRun('evidence',()=>get(`/monitor/views/${encodeURIComponent(viewId)}/snapshots/${encodeURIComponent(snapshotId)}/evidence`));
  const monitorStateDir=path.join(temp,'monitor-state'),countDir=async sub=>(await readdir(path.join(monitorStateDir,sub)).catch(()=>[])).length;
  const report={generatedAt:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch,cpus:os.cpus().length,totalMemoryMB:Math.round(os.totalmem()/1048576),freeMemoryMB:Math.round(os.freemem()/1048576)},source:{dir:options.sourceDir,versions:versionCount,orders:orders.length,rows,copiedBytes,history},config:{warmup:options.warmup,runs:options.runs,orders:options.orders,period:options.period,days:options.days,skipHistory:options.skipHistory,quick:options.quick??false,asOf,knownAt,analysisOrder:order.id},setupError,scenarios,bStateBytes:await sizeOf(bFile),monitorStateBytes:await sizeOfDir(monitorStateDir),monitorState:{bytes:await sizeOfDir(monitorStateDir),views:await countDir('views'),snapshots:await countDir('snapshots'),inputs:await countDir('inputs')}};
  await mkdir(path.dirname(options.output),{recursive:true});
  await writeFile(options.output,JSON.stringify(report,null,2)+'\n');
  printReport(report,options.output);
  return report;
 }
 finally{
  if(app)await new Promise(resolve=>app.close(resolve));
  await rm(assertInsideTemp(os.tmpdir(),temp),{recursive:true,force:true});
 }
}
async function sizeOf(file){try{return (await stat(file)).size;}catch(e){if(e.code==='ENOENT')return 0;throw e;}}
async function sizeOfDir(dir){
 let total=0;
 for(const entry of await readdir(dir,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
  const file=path.join(dir,entry.name);
  total+=entry.isDirectory()?await sizeOfDir(file):(await stat(file)).size;
 }
 return total;
}
async function historyStats(file,skip){
 if(skip)return {bytes:0,views:0,snapshots:0,readMs:null,parseMs:null,firstViewId:null,firstSnapshotId:null};
 let text;
 try{const t0=performance.now();text=await readFile(file,'utf8');const readMs=round(performance.now()-t0);const t1=performance.now();const state=JSON.parse(text);const parseMs=round(performance.now()-t1),view=state.views?.find(v=>v.kind==='import-monitor')??state.views?.[0];return {bytes:Buffer.byteLength(text),views:state.views?.length??0,snapshots:state.snapshots?.length??0,readMs,parseMs,firstViewId:view?.view_id??null,firstSnapshotId:view?.overview?.scope?.versionSet?.[0]?.snapshotId??null};}
 catch(e){if(e.code==='ENOENT')return {bytes:0,views:0,snapshots:0,readMs:null,parseMs:null,firstViewId:null,firstSnapshotId:null};throw e;}
}
function printReport(report,output){
 console.log(`\n性能基线 · Node ${report.environment.node} · ${report.environment.cpus} CPU · ${report.source.orders} 单 / ${report.source.versions} 版本 / ${report.source.rows} 行`);
 console.log(`历史：${report.source.history.bytes} 字节，${report.source.history.views} 视图，${report.source.history.snapshots} 快照`);
 if(report.setupError)console.log(`\n监测刷新失败：${report.setupError}`);
 console.log('场景                p50      p95      max    响应字节  写入字节  计算次数');
 for(const [name,s]of Object.entries(report.scenarios)){
  if(s.error){console.log(`${name.padEnd(18)}失败：${s.error}`);continue;}
  console.log(`${name.padEnd(18)}${String(s.p50).padStart(8)}${String(s.p95).padStart(9)}${String(s.max).padStart(9)}${String(s.avgResponseBytes).padStart(10)}${String(s.writeBytes).padStart(10)}${String(s.evaluateCalls).padStart(10)}`);
 }
 console.log(`\n报告：${output}\n`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 main().catch(e=>{console.error(`性能基线失败：${e.message}`);process.exitCode=1;});
}
