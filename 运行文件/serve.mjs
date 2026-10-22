import {fileURLToPath} from 'node:url';
import os from 'node:os';
import {createApp} from './runtime/server.mjs';
const root=fileURLToPath(new URL('./',import.meta.url));
const port=Number(process.env.PORT||8787);
// 默认监听所有网卡，局域网里的同事才能打开（原来硬编码 127.0.0.1，只有本机能访问）。
// 只想本机用就设 HOST=127.0.0.1。
const host=process.env.HOST||'0.0.0.0';

// 取本机局域网 IPv4（优先物理网卡，跳过虚拟网卡）
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

const app=createApp({root});
app.on('error',e=>{console.error(`网站启动失败：${e.message}`);process.exitCode=1;});
app.listen(port,host,()=>{
 const lan=lanIPv4();
 console.log(`Local: http://127.0.0.1:${port}`);
 console.log(`Bind:  ${host}:${port}`);
 if(lan)console.log(`局域网: http://${lan.address}:${port}/   ← 同一网络的同事用这个`);
});
