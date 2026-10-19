import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOrderLoader} from '../../运行文件/dist/imported-workspace.js';

const tick=()=>new Promise(r=>setTimeout(r,0));
const deferred=()=>{let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});return {promise,resolve,reject};};
const analysis=(start='2026-08-03',end='2026-08-06')=>({order:{start},visibilityEnd:end,asOf:start});
const scope=(withPortfolio=false,date='2026-08-04')=>({orderId:'A',date,revision:'REV-1',mode:'ideal',withPortfolio});

test('analysis renders before a slow portfolio resolves',async()=>{
 const a=deferred(),t=deferred(),p=deferred(),events=[];
 const client={getAnalysis:()=>a.promise,getTrend:()=>t.promise,getPortfolio:()=>p.promise};
 const done=createOrderLoader(client).load(scope(true),{onAnalysis:()=>events.push('analysis'),onTrend:()=>events.push('trend'),onPortfolio:()=>events.push('portfolio')});
 a.resolve(analysis());await tick();assert.deepEqual(events,['analysis']);
 t.resolve({points:[{date:'2026-08-03'}]});await tick();assert.deepEqual(events,['analysis','trend']);
 p.resolve({orders:[]});await done;assert.deepEqual(events,['analysis','trend','portfolio']);
});

test('portfolio is only requested when the detail section is open',async()=>{
 let portfolioCalls=0;
 const client={getAnalysis:async()=>analysis(),getTrend:async()=>({points:[]}),getPortfolio:async()=>{portfolioCalls++;return {orders:[]};}};
 const loader=createOrderLoader(client);
 await loader.load(scope(false),{onAnalysis:()=>{},onTrend:()=>{}});
 assert.equal(portfolioCalls,0);
 await loader.load(scope(true),{onAnalysis:()=>{},onTrend:()=>{},onPortfolio:()=>{}});
 assert.equal(portfolioCalls,1);
});

test('a slower old response cannot replace the current scope',async()=>{
 const first=deferred(),second=deferred(),events=[];
 const client={getAnalysis:id=>id==='A'?first.promise:second.promise,getTrend:async()=>({points:[]}),getPortfolio:async()=>({orders:[]})};
 const loader=createOrderLoader(client);
 const old=loader.load({...scope(false),orderId:'A'},{onAnalysis:()=>events.push('A')});
 const current=loader.load({...scope(false),orderId:'B'},{onAnalysis:()=>events.push('B')});
 second.resolve(analysis());await current;first.resolve(analysis());await old;
 assert.deepEqual(events,['B']);
});

test('a new scope aborts the previous request and ignores its AbortError',async()=>{
 const signals=[];
 const client={getAnalysis:(id,q,{signal})=>{signals.push(signal);return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})));if(id==='B')resolve(analysis());});},getTrend:async()=>({points:[]}),getPortfolio:async()=>({orders:[]})};
 const loader=createOrderLoader(client),errors=[];
 const old=loader.load({...scope(false),orderId:'A'},{onAnalysis:()=>{},onError:e=>errors.push(e)});
 const current=loader.load({...scope(false),orderId:'B'},{onAnalysis:()=>{}});
 assert.equal(signals[0].aborted,true);
 await current;assert.equal(await old,null);assert.deepEqual(errors,[]);
});

test('retry after failure keeps the retried scope only',async()=>{
 let attempt=0;
 const client={getAnalysis:async(id,q)=>{attempt++;if(attempt===1)throw new Error('网络失败');return analysis();},getTrend:async()=>({points:[]}),getPortfolio:async()=>({orders:[]})};
 const loader=createOrderLoader(client),events=[];
 await assert.rejects(loader.load(scope(false),{onAnalysis:()=>events.push('failed')}),/网络失败/);
 await loader.load({...scope(false),date:'2026-08-05'},{onAnalysis:a=>events.push(a.order.start)});
 assert.deepEqual(events,['2026-08-03']);
});
