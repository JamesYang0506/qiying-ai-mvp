import Busboy from 'busboy';
export function readUpload(req){return new Promise((resolve,reject)=>{
 let settled=false,total=0;const files={};let parser;
 const fail=(message,status=400)=>{if(settled)return;settled=true;req.unpipe(parser);req.resume();reject(Object.assign(new Error(message),{status}));};
 try{parser=Busboy({headers:req.headers,limits:{files:2,fields:0,parts:3,fileSize:10*1024*1024}});}catch{fail('请选择两份.xlsx文件');return;}
 req.on('data',b=>{total+=b.length;if(total>25*1024*1024)fail('上传请求超过25MiB',413);});req.on('aborted',()=>fail('上传已中断'));req.on('error',()=>fail('上传读取失败'));
 parser.on('file',(name,stream,info)=>{
  if(!['costFile','dailyFile'].includes(name)||files[name]||!info.filename.toLowerCase().endsWith('.xlsx')){stream.resume();fail('文件字段重复、无效或不是.xlsx');return;}
  const chunks=[];files[name]={name:info.filename,buffer:null};stream.on('data',b=>{if(!settled)chunks.push(b);});stream.on('limit',()=>fail('单个Excel文件超过10MiB',413));stream.on('error',()=>fail('文件上传失败'));stream.on('end',()=>{if(!settled)files[name].buffer=Buffer.concat(chunks);});
 });for(const ev of ['filesLimit','fieldsLimit','partsLimit'])parser.on(ev,()=>fail('只允许上传成本和每日两份Excel'));
 parser.on('error',()=>fail('上传格式损坏'));parser.on('close',()=>{if(settled)return;if(!files.costFile?.buffer||!files.dailyFile?.buffer){fail('请同时选择成本Excel和每日Excel');return;}settled=true;resolve(files);});req.pipe(parser);
});}
export async function readJson(req){let total=0;const chunks=[];for await(const b of req){total+=b.length;if(total>65536)throw Object.assign(new Error('请求内容过大'),{status:413});chunks.push(b);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw Object.assign(new Error('JSON请求无效'),{status:400});}}
