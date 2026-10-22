import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {access} from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import os from 'node:os';

const root=fileURLToPath(new URL('./',import.meta.url));

// 取本机局域网 IPv4：同事要用的就是这一条，光给 127.0.0.1 他们打不开
function lanIPv4(){
 const prefer=/^(以太网|Ethernet|WLAN|Wi-?Fi|eth|en)/i;
 const skip=/(vEthernet|VMware|VirtualBox|Hyper-V|Loopback|Tailscale|ZeroTier|docker|veth|br-)/i;
 const list=[];
 for(const [name,addrs] of Object.entries(os.networkInterfaces())){
  if(skip.test(name))continue;
  for(const a of addrs||[]){
   if(a.family!=='IPv4'||a.internal)continue;
   if(String(a.address).startsWith('169.254.'))continue;
   list.push({name,address:a.address,preferred:prefer.test(name)});
  }
 }
 list.sort((x,y)=>Number(y.preferred)-Number(x.preferred));
 return list[0]||null;
}
const args=process.argv.slice(2);
const portArgs=args.filter(arg=>arg!=='--no-browser');
const explicitPort=portArgs.length>0;
const requestedPort=Number(portArgs[0]||process.env.PORT||8787);
const noBrowser=args.includes('--no-browser');
if(Number(process.versions.node.split('.')[0])<20){
  console.error('启动失败：需要 Node.js 20 或更高版本。');
  process.exit(1);
}
if(portArgs.length>1||!Number.isInteger(requestedPort)||requestedPort<1024||requestedPort>65535){
  console.error('启动失败：端口须为 1024 至 65535 的整数，例如：启动网站.cmd 8788');
  process.exit(1);
}
let port=requestedPort;
let url=`http://127.0.0.1:${port}/`;
async function isWebsiteReady(){
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(3000)});
    const html=await response.text();
    if(!response.ok||!html.includes('企盈智擎')||!html.includes('src="app.js"'))return false;
    const script=await fetch(new URL('app.js',url),{signal:AbortSignal.timeout(3000)});
    if(!script.ok||!(script.headers.get('content-type')||'').includes('javascript'))return false;
    const session=await fetch(new URL('api/auth/session',url),{signal:AbortSignal.timeout(3000)});
    const info=await session.json();
    return session.ok&&info.version==='auth-v1'&&info.capabilities?.includes('account-login-v1')&&info.capabilities?.includes('monitor-scope-v2')&&info.capabilities?.includes('order-diagnosis-v3')&&info.capabilities?.includes('ai-chat-v1');
  }catch{return false;}
}
function openBrowser(){
 const lan=lanIPv4();
 console.log('网站 IP：127.0.0.1');
 console.log(`网站端口：${port}`);
 console.log(`网站地址：${url}`);
 if(lan)console.log(`局域网地址：http://${lan.address}:${port}/   ← 同一网络的同事用这个（${lan.name}）`);
 else console.log('局域网地址：未检测到（网线/WiFi 未连？）');
 if(noBrowser||process.platform!=='win32')return;
 const opener=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32','rundll32.exe'),['url.dll,FileProtocolHandler',url],{stdio:'ignore',windowsHide:true});
 opener.on('error',()=>console.log('未能自动打开浏览器，请手动打开上面的网址。'));
 opener.unref();
}
// 判断端口能不能用。必须两重探测，缺一不可：
//   ① 连一下 127.0.0.1：Windows 允许 0.0.0.0:P 与 127.0.0.1:P 同时 bind，
//      此时我们绑得上 0.0.0.0，但用户访问 127.0.0.1 会被对方的 socket 接走（更具体的地址优先）。
//   ② 试绑 0.0.0.0：防止有进程绑在具体网卡地址（如 10.x.x.x:P）上，那种情况连接回环探测不到。
async function portInUse(){
 const listening=await new Promise(resolve=>{
  const socket=net.createConnection({host:'127.0.0.1',port});
  socket.setTimeout(700,()=>{socket.destroy();resolve(false);});
  socket.once('connect',()=>{socket.destroy();resolve(true);});
  socket.once('error',()=>{socket.destroy();resolve(false);});
 });
 if(listening)return true;
 return new Promise(resolve=>{
  const server=net.createServer();
  server.once('error',()=>resolve(true));
  server.once('listening',()=>{server.close(()=>resolve(false));});
  server.listen(port,'0.0.0.0');
 });
}
try{
  await access(path.join(root,'serve.mjs'));
  await access(path.join(root,'runtime','server.mjs'));
  for(const asset of ['ai-page.js','ai-client.js','ai.css'])await access(path.join(root,'dist',asset));
  for(const asset of ['index.html','app.js','styles.css','charts.js','ui.js','import-api.js','import-page.js','imported-workspace.js','daily-data.js','daily-data.css','import-analysis.css','monitor-workspace.js','monitor-dashboard.js','monitor-table.js','monitor.css','monitor-dashboard.css','monitor-filters.css','monitor-evidence.js','monitor-chart-motion.js','auth-page.js','auth.css','project-i18n.js','project-i18n.css','assets/qiying-logo.jpg'])await access(path.join(root,'dist',asset));
  if(!explicitPort){
    for(let offset=0;offset<20;offset++){
      port=requestedPort+offset;
      if(port>65535)throw new Error('没有可用端口，请指定另一个端口。');
      url=`http://127.0.0.1:${port}/`;
      if(await isWebsiteReady()||!(await portInUse()))break;
      if(offset===19)throw new Error('附近端口都已占用，请指定另一个端口。');
    }
    if(port!==requestedPort)console.log(`端口 ${requestedPort} 已被占用，已改用 ${port}。`);
  }
  if(await isWebsiteReady()){
    console.log('网站服务已经运行，正在打开网页。');
    openBrowser();
  }else if(await portInUse()){
    console.error(`端口 ${port} 已被其他程序占用。请运行“启动网站.cmd 8788”换一个端口。`);
    process.exitCode=1;
  }else{
    console.log('正在启动企盈智擎，请稍候…');
    const server=spawn(process.execPath,[path.join(root,'serve.mjs')],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'inherit',windowsHide:true});
    let exited=false,spawnError=null,ready=false;
    server.once('error',error=>{spawnError=error;exited=true;});
    server.once('exit',(code,signal)=>{exited=true;if(ready){process.exitCode=signal==='SIGINT'||signal==='SIGTERM'?0:(code??1);}});
    process.once('SIGINT',()=>{server.kill();process.exitCode=0;});
    process.once('SIGTERM',()=>{server.kill();process.exitCode=0;});
    for(let attempt=0;attempt<40&&!exited;attempt++){
      if(await isWebsiteReady()){ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(ready){
      console.log('启动成功。请保留这个窗口；关闭窗口或按 Ctrl+C 会停止网站。');
      openBrowser();
    }else{
      if(!exited)server.kill();
      console.error('启动失败：'+(spawnError?.message||'服务未能就绪，请查看上方报错。'));
      process.exitCode=1;
    }
  }
}catch(error){
  console.error('启动失败：请确认 start-website.mjs、serve.mjs 及完整 dist、runtime 文件夹都在同一项目目录中；下载后必须先完整解压。');
  console.error(error.message);
  process.exitCode=1;
}
