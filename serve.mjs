import {fileURLToPath} from 'node:url';
import {createApp} from './runtime/server.mjs';
const root=fileURLToPath(new URL('./',import.meta.url));
const port=Number(process.env.PORT||8787);
const app=createApp({root});
app.on('error',e=>{console.error(`网站启动失败：${e.message}`);process.exitCode=1;});
app.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
