import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,cp,rm,access} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import net from 'node:net';import {spawn,spawnSync} from 'node:child_process';
import {files} from './http/helpers.mjs';
test('clean Chinese path runs bundled imports without node_modules',{timeout:30000},async t=>{
 const parent=path.resolve(os.tmpdir()),dir=await mkdtemp(path.join(parent,'qiying package 中文-'));let child;
 t.after(async()=>{if(child&&child.exitCode===null){if(process.platform==='win32')spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});else child.kill('SIGTERM');await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));}assert.equal(path.dirname(dir),parent);assert.ok(path.basename(dir).startsWith('qiying package 中文-'));await rm(dir,{recursive:true,force:true});});
 for(const file of ['serve.mjs','start-website.mjs','启动网站.cmd','dist','runtime'])await cp(path.join(process.cwd(),file),path.join(dir,file),{recursive:true});
 await assert.rejects(access(path.join(dir,'node_modules')));
 const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 child=spawn(process.execPath,[path.join(dir,'start-website.mjs'),String(port),'--no-browser'],{cwd:dir,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 const base=`http://127.0.0.1:${port}`;let session;
 for(let i=0;i<150;i++){try{const r=await fetch(base+'/api/import-v1/session');if(r.ok){session=await r.json();break;}}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,50));}
 assert.equal(session?.version,'import-v1',output);assert.equal((await fetch(base+'/#import')).status,200);assert.equal((await fetch(base+'/import-page.js')).status,200);
 const headers={Origin:base,'X-Qiying-Token':session.token};const previewResponse=await fetch(base+'/api/import-v1/previews',{method:'POST',headers,body:files()});assert.equal(previewResponse.status,200);const preview=await previewResponse.json();
 const commit=await fetch(base+`/api/import-v1/previews/${preview.previewId}/commit`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({digest:preview.digest})});assert.equal(commit.status,200);
 if(process.platform==='win32')spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});else child.kill('SIGTERM');
 await new Promise(r=>child.exitCode!==null||child.signalCode!==null?r():child.once('exit',r));
 child=spawn(process.execPath,[path.join(dir,'start-website.mjs'),String(port),'--no-browser'],{cwd:dir,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 let restored;
 for(let i=0;i<150;i++){try{const r=await fetch(base+'/api/import-v1/orders');if(r.ok){restored=await r.json();break;}}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,50));}
 assert.equal(restored?.orders[0]?.id,'SIM-TEST',output);
 const analysis=await(await fetch(base+'/api/import-v1/orders/SIM-TEST/analysis?asOf=2026-08-03')).json();assert.equal(analysis.cumulative.quantity,100);
});
