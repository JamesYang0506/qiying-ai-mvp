import {readdir,readFile,open,unlink,realpath,lstat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {gzip,gunzip} from 'node:zlib';
import {promisify} from 'node:util';
const zip=promisify(gzip),unzip=promisify(gunzip);
const defaultRoot=fileURLToPath(new URL('../../存储文件/data/imports/monitor-state',import.meta.url));

// Lossless replacement only: verify persisted gzip and unchanged source before unlinking.
// No directory removal, order import modification or archive deduplication takes place.
export async function compressMonitorHistory({directory=defaultRoot,apply=false,onProgress=()=>{}}={}){
 const root=await realpath(directory),summary={apply,files:0,beforeBytes:0,afterBytes:0};
 for(const folder of ['inputs','snapshots','views']){
  const dir=path.join(root,folder),info=await lstat(dir);
  if(info.isSymbolicLink()||!info.isDirectory()||await realpath(dir)!==dir)throw new Error('历史目录必须位于指定目标内且不是链接：'+dir);
  for(const entry of await readdir(dir,{withFileTypes:true})){
   if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\.json$/.test(entry.name))continue;
   const file=path.join(dir,entry.name);
   if(!entry.isFile()||entry.isSymbolicLink())throw new Error('拒绝处理非普通文件：'+file);
   const raw=await readFile(file);JSON.parse(raw.toString('utf8'));
   const packed=await zip(raw,{level:9});
   let stored=packed;
   if(apply){
    const target=file+'.gz';let handle;
    try{handle=await open(target,'wx');await handle.writeFile(packed);await handle.sync();}
    catch(e){if(e.code!=='EEXIST')throw e;const targetInfo=await lstat(target);if(!targetInfo.isFile()||targetInfo.isSymbolicLink())throw new Error('压缩目标不是普通文件：'+target);}
    finally{await handle?.close();}
    stored=await readFile(target);
    if(!(await unzip(stored)).equals(raw))throw new Error('压缩校验失败，保留原文件：'+file);
    const currentInfo=await lstat(file);
    if(!currentInfo.isFile()||currentInfo.isSymbolicLink()||!(await readFile(file)).equals(raw))throw new Error('原文件发生变化，停止替换：'+file);
    await unlink(file);
   }
   summary.files++;summary.beforeBytes+=raw.length;summary.afterBytes+=stored.length;
   if(summary.files%250===0)onProgress({...summary});
  }
 }
 return {...summary,savedBytes:summary.beforeBytes-summary.afterBytes};
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);
 if(args.some(a=>!['--apply','--dry-run'].includes(a))||args.includes('--apply')&&args.includes('--dry-run'))throw new Error('用法：node scripts/compress-monitor-history.mjs [--dry-run|--apply]');
 console.log(JSON.stringify(await compressMonitorHistory({apply:args.includes('--apply'),onProgress:value=>console.log(JSON.stringify(value))})));
}
