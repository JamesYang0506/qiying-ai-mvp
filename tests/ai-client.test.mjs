import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAiTransport} from '../dist/ai-client.js';
import {messageMarkup} from '../dist/ai-page.js';

test('AI and user messages are rendered as text after streaming or remounting',()=>{
 const html=messageMarkup([{role:'assistant',text:'<img src=x onerror=alert(1)>'},{role:'user',text:'<script>test</script>'}]);
 assert.doesNotMatch(html,/<img|<script/);assert.match(html,/&lt;img/);assert.match(html,/&lt;script/);
});

function response(text){const bytes=new TextEncoder().encode(text);let i=0;return new Response(new ReadableStream({pull(c){if(i===bytes.length)c.close();else c.enqueue(bytes.slice(i,i+=1));}}),{headers:{'Content-Type':'text/event-stream'}});}
test('chat transport keeps UTF8 split chunks, multi-turn history and scope',async()=>{
 let sent;const client=createAiTransport(async(url,options)=>{sent=JSON.parse(options.body);return response('data: {"type":"delta","data":{"text":"你好"}}\r\n\r\ndata: {"type":"done","data":{}}\n\ndata: [DONE]');});
 const history=[{role:'assistant',content:'上一个回答'}],parts=[];
 assert.equal(await client.sendChat({message:'问题',history,asOf:'2026-08-03',orderId:'A',onDelta:t=>parts.push(t)}),'你好');assert.deepEqual(parts,['你好']);assert.deepEqual(sent.history,history);assert.equal(sent.asOf,'2026-08-03');assert.equal(sent.orderId,'A');
});
test('partial answers followed by errors or abrupt EOF are not reported as completed',async()=>{
 const prefix='data: {"type":"delta","data":{"text":"部分回答"}}\n\n';
 for(const suffix of ['', 'data: {"type":"error","data":{"message":"模型中断"}}\n\ndata: [DONE]\n\n']){
  const parts=[],client=createAiTransport(async()=>response(prefix+suffix));
  await assert.rejects(client.sendChat({message:'问题',onDelta:t=>parts.push(t)}),/中断|未完成/);assert.deepEqual(parts,['部分回答']);
 }
});
