import {randomBytes,randomInt,randomUUID,scrypt as rawScrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {readJson} from './uploads.mjs';
const scrypt=promisify(rawScrypt),hash=s=>createHash('sha256').update(s).digest('hex');
const failure=(code,status=400)=>Object.assign(new Error(code),{code,status});
export function createAuth({directory,clock=Date.now,required=true}){
 const challenges=new Map(),sessions=new Map(),rates=new Map();let queue=Promise.resolve();
 const file=path.join(directory,'accounts.json');
 const send=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));};
 const users=async()=>{try{const data=JSON.parse(await readFile(file,'utf8'));if(!Array.isArray(data.users))throw new Error('Invalid account store');return data.users;}catch(e){if(e.code==='ENOENT')return [];throw e;}};
 const limited=(req,kind,max,window)=>{const now=clock(),key=(req.socket.remoteAddress??'local')+':'+kind;for(const [k,r]of rates)if(r.until<=now)rates.delete(k);const r=rates.get(key)??{count:0,until:now+window};r.count++;rates.set(key,r);if(r.count>max)throw failure('RATE_LIMITED',429);};
 function userFor(req){const id=(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('qiying_session='))?.slice(15);if(!id)return null;const key=hash(id),s=sessions.get(key);if(!s)return null;if(s.expires<=clock()){sessions.delete(key);return null;}return s.user;}
 function session(res,user,remember){for(const[k,s]of sessions)if(s.expires<=clock())sessions.delete(k);if(sessions.size>=1000)sessions.delete(sessions.keys().next().value);const token=randomBytes(32).toString('hex'),seconds=remember?7*86400:12*3600;sessions.set(hash(token),{user,expires:clock()+seconds*1000});return `qiying_session=${token}; HttpOnly; SameSite=Strict; Path=/${remember?'; Max-Age='+seconds:''}`;}
 function captcha(req){limited(req,'captcha',90,60000);for(const[k,c]of challenges)if(c.expires<=clock())challenges.delete(k);if(challenges.size>=500)challenges.delete(challenges.keys().next().value);const chars='23456789ABCDEFGHJKLMNPQRSTUVWXYZ',code=Array.from({length:4},()=>chars[randomInt(chars.length)]).join(''),id=randomUUID();challenges.set(id,{code,expires:clock()+300000,address:req.socket.remoteAddress});
  const noise=Array.from({length:7},()=>`<path d="M${randomInt(160)} ${randomInt(52)} Q${randomInt(160)} ${randomInt(52)} ${randomInt(160)} ${randomInt(52)}" stroke="hsl(${randomInt(190,240)} 45% 75%)" stroke-width="1" fill="none"/>`).join('');
  const text=[...code].map((c,i)=>`<text x="${18+i*35}" y="${randomInt(34,41)}" transform="rotate(${randomInt(-18,19)} ${25+i*35} 27)" font-family="Georgia,serif" font-size="30" font-weight="bold" fill="hsl(${randomInt(200,240)} 65% ${randomInt(30,50)}%)">${c}</text>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="52" viewBox="0 0 160 52"><rect width="160" height="52" rx="9" fill="#edf3ff"/>${noise}${text}</svg>`;
  return {id,image:'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'),expiresIn:300};
 }
 const verify=(body,req)=>{const c=challenges.get(body.captchaId);challenges.delete(body.captchaId);if(!c||c.expires<=clock()||c.address!==req.socket.remoteAddress||typeof body.captcha!=='string'||body.captcha.trim().toUpperCase()!==c.code)throw failure('INVALID_CAPTCHA');};
 const route=async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/auth/'))return false;
  try{
   const host=req.headers.host??'';if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host))throw failure('FORBIDDEN',403);
   if(req.method==='GET'&&url.pathname==='/api/auth/session'){const user=userFor(req);send(res,200,{required,authenticated:!!user,user,version:'auth-v1',capabilities:['account-login-v1','monitor-scope-v2','order-diagnosis-v3','optimized-runtime-v1']});return true;}
   if(req.method==='GET'&&url.pathname==='/api/auth/captcha'){send(res,200,captcha(req));return true;}
   if(req.method!=='POST')throw failure('NOT_FOUND',404);
   if(req.headers.origin!==`http://${host}`)throw failure('FORBIDDEN',403);
   if(url.pathname==='/api/auth/logout'){const token=(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('qiying_session='))?.slice(15);if(token)sessions.delete(hash(token));send(res,200,{ok:true},{'Set-Cookie':'qiying_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});return true;}
   if(!['/api/auth/login','/api/auth/register'].includes(url.pathname))throw failure('NOT_FOUND',404);
   limited(req,'credentials',30,600000);const body=await readJson(req);if(!body||typeof body!=='object'||Array.isArray(body))throw failure('INVALID_REQUEST');verify(body,req);
   const username=typeof body.username==='string'?body.username.trim().toLowerCase():'',password=body.password;
   if(!/^[a-z0-9_@.+-]{3,64}$/.test(username))throw failure('INVALID_ACCOUNT');
   if(typeof password!=='string'||password.length<8||password.length>128)throw failure('INVALID_PASSWORD');
   if(url.pathname==='/api/auth/register'){
    const job=queue.then(async()=>{const all=await users();if(all.some(u=>u.username===username))throw failure('ACCOUNT_EXISTS',409);const salt=randomBytes(16).toString('hex'),key=await scrypt(password,salt,64),user={id:randomUUID(),username,salt,passwordHash:key.toString('hex'),createdAt:new Date(clock()).toISOString()};all.push(user);await mkdir(directory,{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,JSON.stringify({version:1,users:all}),{flag:'wx',mode:0o600});await rename(tmp,file);}catch(e){await unlink(tmp).catch(()=>{});throw e;}return {id:user.id,username};});queue=job.catch(()=>{});const user=await job;send(res,201,{user});return true;
   }
   const account=(await users()).find(u=>u.username===username),key=await scrypt(password,account?.salt??'qiying-unknown-user',64),expected=account?Buffer.from(account.passwordHash,'hex'):Buffer.alloc(64);
   if(!account||expected.length!==key.length||!timingSafeEqual(key,expected))throw failure('INVALID_CREDENTIALS',401);
   const user={id:account.id,username:account.username};send(res,200,{user},{'Set-Cookie':session(res,user,body.remember===true)});
  }catch(e){req.resume();const status=e.status??500;send(res,status,{error:{code:status>=500?'AUTH_UNAVAILABLE':e.code??'INVALID_REQUEST'}});}return true;
 };
 const authorize=(req,res,url)=>{if(!required||!url.pathname.startsWith('/api/'))return true;if(userFor(req))return true;req.resume();send(res,401,{error:{code:'LOGIN_REQUIRED',message:'请先登录后访问项目数据'}});return false;};
 return {route,authorize};
}
