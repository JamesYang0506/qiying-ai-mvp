import {mkdir,readFile,writeFile,readdir,lstat,copyFile,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {unzipSync} from 'fflate';

const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const git=(root,args)=>execFileSync('git',args,{cwd:root,windowsHide:true,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
async function fileHash(file){const h=createHash('sha256');for await(const part of createReadStream(file))h.update(part);return h.digest('hex');}
const forbidden=rel=>/^(data|node_modules|output|outputs|reports|\.git|\.venv|\.superpowers|\.openai)(\/|$)/i.test(rel)||/^\.env($|\.)/i.test(rel)&&rel!=='.env.example'||/\.(gguf|safetensors|zip|log)$/i.test(rel);
const runtimeFile=rel=>/^(dist|runtime)\//.test(rel)||['serve.mjs','start-website.mjs','启动网站.cmd','package.json','THIRD_PARTY_NOTICES.md'].includes(rel);

async function dataFiles(root,relative=''){
 const folder=path.join(root,relative);let info;
 try{info=await lstat(folder);}catch(e){if(e.code==='ENOENT'&&!relative)return [];throw e;}
 if(info.isSymbolicLink()||!info.isDirectory())throw new Error('数据备份拒绝目录链接：'+folder);
 const files=[];
 for(const entry of await readdir(folder,{withFileTypes:true})){
  const rel=path.join(relative,entry.name);
  if(entry.isSymbolicLink())throw new Error('数据备份拒绝文件链接：'+rel);
  if(entry.isDirectory())files.push(...await dataFiles(root,rel));
  else if(entry.isFile()){if(entry.name.endsWith('.tmp'))throw new Error('数据正在写入，请稍后重试');files.push(rel);}
 }
 return files.sort();
}

export async function exportWorkspace({root=projectRoot,destination,includeData=false,onProgress=()=>{}}={}){
 root=await realpath(root);if(!destination)throw new Error('需要指定导出目标');destination=path.resolve(destination);
 const relative=path.relative(root,destination);
 if(!relative||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))throw new Error('导出目标必须在项目目录之外');
 const commit=git(root,['rev-parse','HEAD']).toString().trim();
 try{git(root,['diff','--quiet','HEAD','--']);}catch{throw new Error('请先保存Git提交，再导出对应版本');}
 const archive=unzipSync(new Uint8Array(git(root,['archive','--format=zip',commit])));
 const names=Object.keys(archive).filter(n=>!n.endsWith('/'));
 for(const name of names)if(forbidden(name)||name.split('/').includes('..')||path.isAbsolute(name))throw new Error('Git提交中包含不应分发的文件：'+name);
 if(git(root,['ls-tree','-r',commit]).toString().split('\n').some(line=>line.startsWith('120000 ')))throw new Error('源码包含链接，请先确认分发范围');
 await mkdir(path.dirname(destination),{recursive:true});
 try{await mkdir(destination);}catch(e){if(e.code==='EEXIST')throw new Error('导出目录已存在，不会覆盖：'+destination);throw e;}
 const manifest={commit,createdAt:new Date().toISOString(),verified:false,runtime:{folder:'01_干净运行版',files:0,bytes:0},source:{folder:'02_开发源码',files:0,bytes:0},data:{folder:includeData?'03_数据备份':null,files:0,bytes:0},sourceFiles:[],dataFiles:[]};
 for(const name of names){
  const content=Buffer.from(archive[name]);
  for(const bucket of [manifest.source,...runtimeFile(name)?[manifest.runtime]:[]]){
   const target=path.join(destination,bucket.folder,name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,content,{flag:'wx'});
   if(await fileHash(target)!==sha(content))throw new Error('代码复制校验失败：'+name);
   bucket.files++;bucket.bytes+=content.length;
  }
  manifest.sourceFiles.push({file:name,sha256:sha(content),bytes:content.length});
 }
 await writeFile(path.join(destination,manifest.runtime.folder,'运行说明.md'),'# 干净运行版\n\n需要Node.js 20或以上，双击“启动网站.cmd”。不需要安装开发依赖。\n\n本包不带账号、订单或模型权重。首次使用需注册并导入数据；AI仍需独立服务。修改源码请使用开发源码版。默认数据保存在本目录data/imports中，升级前先备份该目录。\n');
 if(includeData){
  const dataRoot=path.join(root,'data'),files=await dataFiles(dataRoot);
  for(const name of files){
   const source=path.join(dataRoot,name),before=await fileHash(source),target=path.join(destination,manifest.data.folder,'data',name);
   await mkdir(path.dirname(target),{recursive:true});await copyFile(source,target);
   if(await fileHash(target)!==before)throw new Error('数据复制校验失败：'+name);
   const bytes=(await lstat(target)).size;manifest.dataFiles.push({file:name.replaceAll('\\','/'),sha256:before,bytes});manifest.data.files++;manifest.data.bytes+=bytes;
   if(manifest.data.files%500===0)onProgress({copied:manifest.data.files,total:files.length});
  }
  if(JSON.stringify(await dataFiles(dataRoot))!==JSON.stringify(files))throw new Error('备份期间数据清单变化，请重新导出');
  for(const entry of manifest.dataFiles)if(await fileHash(path.join(dataRoot,entry.file))!==entry.sha256)throw new Error('备份期间原数据发生变化，请重新导出：'+entry.file);
 }
 const readme=`# 企盈智擎：代码、开发资料与数据分离\n\n源码提交：${commit}\n\n- 01_干净运行版：只给使用者运行，不含旧账号、订单或开发环境。\n- 02_开发源码：当前已提交的完整源码、运行包、文档和测试；交给组员或用GitHub协作。开发时执行npm ci；改后端后执行npm run build。\n${includeData?'- 03_数据备份：私有备份，包含订单、账号密码哈希和压缩历史。不要作为公开代码包上传或直接发给其他人。\n':''}\n开发依赖node_modules、Python虚拟环境、Git历史、截图和日志仍留在原开发目录，不复制到分发包。原开发目录和数据路径未移动，也未清理任何原文件。\n\n恢复数据：先关闭网站；备份目标已有data目录，再把03_数据备份中的data复制到运行版目录。不能在网站写入时覆盖数据，也不要把旧版本运行包与新数据混用。\n\nmanifest.json记录版本、文件数量和SHA-256。只有verified为true的导出完成；中途失败的目录不可当完整备份，保留原数据，另选新目录重试。\n`;
 await writeFile(path.join(destination,'分离说明.md'),readme);
 manifest.verified=true;await writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2));
 return {destination,commit,verified:true,runtime:manifest.runtime,source:manifest.source,data:manifest.data};
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);let destination,includeData=false;
 for(let i=0;i<args.length;i++)if(args[i]==='--with-data')includeData=true;else if(args[i]==='--output'&&args[i+1])destination=args[++i];else throw new Error('用法：node scripts/export-workspace.mjs [--with-data] [--output 目录]');
 const commit=git(projectRoot,['rev-parse','--short','HEAD']).toString().trim();
 const stamp=new Date(Date.now()+8*3600000).toISOString().slice(0,19).replaceAll(':','-').replace('T','_');
 destination??=path.resolve(projectRoot,'../项目分发',`企盈智擎-${stamp}-${commit}`);
 console.log(JSON.stringify(await exportWorkspace({destination,includeData,onProgress:progress=>console.log(JSON.stringify(progress))}),null,2));
}
