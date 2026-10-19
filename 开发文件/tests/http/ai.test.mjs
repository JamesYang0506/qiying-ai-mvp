import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createApp} from '../../server/http/app.mjs';
import {createStore} from '../../server/storage/store.mjs';
import {normalizePair} from '../../server/import/normalize.mjs';
import {pair} from '../import/fixture.mjs';

async function setup(t,{offline=false,authRequired=false}={}){
 const dir=await mkdtemp(path.join(os.tmpdir(),'qiying-ai-')),calls=[];
 const aiClient={baseUrl:'http://127.0.0.1:3320',async health(){if(offline)throw new Error('offline');return {loadedModel:'qwen3.5:9b',chatModel:'qwen3.5:9b',freeMemGb:16};},async models(){return {list:[{id:'qwen3.5:9b'}]};},async openStream(endpoint,payload){calls.push({endpoint,payload});let i=0;const chunks=['data: {"content":"第一段"}\n\n','data: {"content":"第二段"}\n\ndata: [DONE]\n\n'];return new Response(new ReadableStream({async pull(controller){await new Promise(r=>setTimeout(r,20));if(i<chunks.length)controller.enqueue(new TextEncoder().encode(chunks[i++]));else controller.close();}}));},async completeJson(payload){calls.push({payload});return {content:'{"answer":"ok"}',model:payload.model};}};
 const app=createApp({root:fileURLToPath(new URL('../../../运行文件/',import.meta.url)),dataDir:dir,aiClient,authRequired});await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${app.address().port}`;
 t.after(async()=>{app.closeAllConnections();await new Promise(r=>app.close(r));await rm(dir,{recursive:true,force:true});});
 const post=(body,origin=base,endpoint='answer')=>fetch(base+'/api/v1/ai/'+endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 return {base,dir,calls,post,aiClient};
}
test('disconnecting the browser cancels its upstream stream',async t=>{
 const {base,aiClient}=await setup(t);let cancelled;
 const closed=new Promise(resolve=>{cancelled=resolve;});
 aiClient.openStream=async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {"content":"正在回答"}\n\n'));},cancel(){cancelled(true);}}));
 const controller=new AbortController(),response=await fetch(base+'/api/v1/ai/answer',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({question:'test',model:'qwen'}),signal:controller.signal});
 const reader=response.body.getReader();await reader.read();controller.abort();
 let timer;try{assert.equal(await Promise.race([closed,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),1000);})]),true);}finally{clearTimeout(timer);await reader.cancel().catch(()=>{});}
});
test('AI routes precede formal orders routes and forward a complete SSE answer with history',async t=>{
 const {base,calls,post}=await setup(t),status=await fetch(base+'/api/v1/ai/status');
 assert.equal(status.status,200);assert.equal((await status.json()).data.status,'ready');
 const history=[{role:'user',content:'上一个问题'},{role:'assistant',content:'上一个回答'}];
 const response=await post({question:'继续解释',history}),text=await response.text();assert.equal(response.status,200);
 assert.match(response.headers.get('content-type'),/text\/event-stream/);assert.match(text,/第一段/);assert.match(text,/第二段/);assert.match(text,/\[DONE\]/);
 assert.deepEqual(calls[0].payload.history,history);assert.equal(calls[0].endpoint,'/api/chat');
});
test('AI retains login and origin boundaries and validates questions before inference',async t=>{
 const secured=await setup(t,{authRequired:true});assert.equal((await fetch(secured.base+'/api/v1/ai/status')).status,401);
 const {post,calls}=await setup(t);assert.equal((await post({question:'test'},'https://other.example')).status,403);
 assert.equal((await post({question:'  '})).status,400);assert.equal(calls.length,0);
 const json=await post({prompt:'test',model:'qwen'},undefined,'json');assert.equal(json.status,200);assert.deepEqual((await json.json()).data.json,{answer:'ok'});
});
test('AI offline status is explicit and does not impersonate a model answer',async t=>{
 const {base}=await setup(t,{offline:true}),response=await fetch(base+'/api/v1/ai/status');
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.status,'unavailable');assert.match(body.data.message,/启动/);
});
test('AI order context uses the same dated calculations as module A and excludes future production',async t=>{
 const {dir,post,calls}=await setup(t),d=normalizePair(...pair()).dataset;
 d.production.push({...d.production[0],id:'future-production',date:'2026-08-04',availableAt:'2026-08-04T00:00:00+08:00',processed:'987654'});d.order.end='2026-08-04';await createStore(dir).commit(d);
 const response=await post({question:'毛利情况',asOf:'2026-08-03'});assert.equal(response.status,200);await response.text();
 assert.match(calls[0].payload.analysis,/2026-08-03/);assert.match(calls[0].payload.analysis,/SIM-TEST/);assert.match(calls[0].payload.analysis,/602.00/);assert.doesNotMatch(calls[0].payload.analysis,/987654/);
 assert.equal((await post({question:'test',asOf:'2026-02-30'})).status,400);
});
