import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import {mkdtemp,cp,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../运行文件/',import.meta.url));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){const s=net.createServer();await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));const port=s.address().port;await new Promise(resolve=>s.close(resolve));return port;}
function launch(args,{env={},cwd=root,cmd=false,interactive=false}={}){
 const executable=cmd?(process.env.ComSpec||'C:\\Windows\\System32\\cmd.exe'):process.execPath;
 const command=cmd?['/d','/s','/c',`""${path.join(cwd,'启动网站.cmd')}" ${args.join(' ')}"`]:[path.join(cwd,'start-website.mjs'),...args];
 const child=spawn(executable,command,{cwd,env:{...process.env,...env},windowsHide:true,windowsVerbatimArguments:cmd,stdio:[interactive?'pipe':'ignore','pipe','pipe']});
 let output='',ended=false,exitCode=null;
 child.stdout.on('data',b=>output+=b.toString());child.stderr.on('data',b=>output+=b.toString());
 child.on('error',e=>{output+=e.message;ended=true;exitCode=-1;});child.on('exit',code=>{ended=true;exitCode=code;});
 return {child,get output(){return output;},get ended(){return ended;},get exitCode(){return exitCode;},async waitFor(text){const end=Date.now()+18000;while(Date.now()<end){if(output.includes(text))return output;if(ended)throw new Error('Startup exited before '+text+': '+output);await pause(50);}throw new Error('Startup timed out: '+output);},async stop(){if(ended)return;if(process.platform==='win32')spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill('SIGTERM');for(let i=0;i<80&&!ended;i++)await pause(25);}};
}
test('launcher respects PORT and waits for an HTTP-ready site',{timeout:25000},async()=>{const port=await freePort();const p=launch(['--no-browser'],{env:{PORT:String(port)}});try{await p.waitFor(`网站地址：http://127.0.0.1:${port}/`);const r=await fetch(`http://127.0.0.1:${port}/app.js`);assert.equal(r.status,200);const script=await r.text();assert.match(script,/mountMonitor/);assert.doesNotMatch(script,/from ['"]\.\/data\.js['"]/);assert.match(p.output,/启动成功/);assert.ok(p.output.includes('网站 IP：127.0.0.1'));assert.ok(p.output.includes(`网站端口：${port}`));}finally{await p.stop();}});
test('Windows startup window stays open when reusing an existing site',{skip:process.platform!=='win32',timeout:25000},async()=>{
 const port=await freePort(),first=launch([String(port),'--no-browser']);let second;
 try{
  await first.waitFor('启动成功');second=launch([String(port),'--no-browser'],{cwd:path.resolve(root,'..'),cmd:true,interactive:true});
  await second.waitFor('Press any key to close this window...');await pause(200);
  assert.equal(second.ended,false);assert.ok(second.output.includes('网站 IP：127.0.0.1'));assert.ok(second.output.includes(`网站端口：${port}`));
  assert.ok(second.output.includes(`网站地址：http://127.0.0.1:${port}/`));
  await second.stop();assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status,200);
 }finally{await second?.stop();await first.stop();}
});
test('Windows startup window keeps failure details visible',{skip:process.platform!=='win32',timeout:10000},async()=>{
 const p=launch(['not-a-port','--no-browser'],{cmd:true,interactive:true});
 try{await p.waitFor('Press any key to close this window...');await pause(200);assert.equal(p.ended,false);assert.ok(p.output.includes('端口须为'));}finally{await p.stop();}
});
test('default launch automatically finds a free port when another app occupies PORT',{timeout:25000},async()=>{const occupied=http.createServer((req,res)=>res.end('other application'));await new Promise(resolve=>occupied.listen(0,'127.0.0.1',resolve));const port=occupied.address().port;const p=launch(['--no-browser'],{env:{PORT:String(port)}});try{const text=await p.waitFor('网站地址：');const match=text.match(/网站地址：http:\/\/127\.0\.0\.1:(\d+)\//);assert.ok(match,text);const actual=Number(match[1]);assert.notEqual(actual,port);assert.equal((await fetch(`http://127.0.0.1:${actual}/`)).status,200);assert.equal(await (await fetch(`http://127.0.0.1:${port}/`)).text(),'other application');}finally{await p.stop();await new Promise(resolve=>occupied.close(resolve));}});
test('an explicitly occupied port reports an error without replacing the other app',{timeout:10000},async()=>{const s=http.createServer((req,res)=>res.end('keep me'));await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));const port=s.address().port;const p=launch([String(port),'--no-browser']);try{await p.waitFor('已被其他程序占用');for(let i=0;i<40&&!p.ended;i++)await pause(25);assert.equal(p.exitCode,1);assert.equal(await (await fetch(`http://127.0.0.1:${port}/`)).text(),'keep me');}finally{await p.stop();await new Promise(resolve=>s.close(resolve));}});
test('running the launcher again reuses the existing website',{timeout:25000},async()=>{const port=await freePort();const first=launch([String(port),'--no-browser']);let second;try{await first.waitFor('启动成功');second=launch([String(port),'--no-browser']);await second.waitFor('网站服务已经运行');assert.ok(!first.ended);assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status,200);}finally{await second?.stop();await first.stop();}});
test('Windows double-click entry works from a Chinese path with spaces',{skip:process.platform!=='win32',timeout:30000},async()=>{const parent=path.resolve(os.tmpdir());const dir=await mkdtemp(path.join(parent,'qiying startup 中文-'));let p;try{for(const f of ['启动网站.cmd','start-website.mjs','serve.mjs','paths.mjs','dist','runtime'])await cp(path.join(root,f),path.join(dir,f),{recursive:true});const port=await freePort();p=launch([String(port),'--no-browser'],{cwd:dir,cmd:true});await p.waitFor(`网站地址：http://127.0.0.1:${port}/`);assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status,200);}finally{await p?.stop();assert.equal(path.dirname(path.resolve(dir)),parent);assert.ok(path.basename(dir).startsWith('qiying startup 中文-'));await rm(dir,{recursive:true,force:true});}});
test('invalid port fails with a useful message',{timeout:10000},async()=>{const p=launch(['not-a-port','--no-browser']);try{await p.waitFor('端口须为');}finally{await p.stop();}});
