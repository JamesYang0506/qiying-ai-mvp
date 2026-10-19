import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {access,readdir} from 'node:fs/promises';
import {resolveDataDir} from '../../运行文件/paths.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
test('runtime uses sibling storage instead of generating data beside code',()=>{
 const runtime=path.join(root,'运行文件');
 assert.equal(resolveDataDir(runtime,{}),path.join(root,'存储文件','data','imports'));
 assert.equal(resolveDataDir(runtime,{QIYING_DATA_DIR:path.join(root,'custom')}),path.join(root,'custom'));
});
test('workspace has one runtime and one development tree with no duplicate business data',async()=>{
 for(const file of ['运行文件/dist/index.html','运行文件/runtime/server.mjs','运行文件/启动网站.cmd','开发文件/server/http/app.mjs','开发文件/package.json'])await access(path.join(root,file));
 for(const folder of ['运行文件','开发文件'])assert(!(await readdir(path.join(root,folder))).includes('data'));
 const names=await readdir(root);for(const old of ['dist','runtime','server','tests','data','node_modules'])assert(!names.includes(old),old);
});
