import path from 'node:path';

// Runtime assets and mutable business data live in separate sibling folders.
export function resolveDataDir(runtimeRoot,env=process.env){
 return path.resolve(env.QIYING_DATA_DIR||path.join(runtimeRoot,'..','存储文件','data','imports'));
}
