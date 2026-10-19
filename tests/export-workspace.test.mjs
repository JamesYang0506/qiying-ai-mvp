import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {exportWorkspace} from '../scripts/export-workspace.mjs';

async function fixture(t){
 const parent=await mkdtemp(path.join(os.tmpdir(),'qiying-export-'));t.after(()=>rm(parent,{recursive:true,force:true}));
 const root=path.join(parent,'project');await mkdir(root);
 for(const file of ['dist/index.html','runtime/server.mjs','server/feature.mjs','tests/check.mjs','serve.mjs','start-website.mjs','启动网站.cmd','package.json']){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),file==='package.json'?'{}':file);}
 const git=args=>execFileSync('git',args,{cwd:root,windowsHide:true,stdio:'pipe'});
 git(['init','-q']);git(['add','.']);git(['-c','user.name=Export Test','-c','user.email=test@example.invalid','commit','-qm','fixture']);
 for(const [file,text] of [['data/imports/order.json','private-order'],['data/imports/auth/accounts.json','private-account'],['node_modules/package/file','dependency'],['.env','secret'],['output/log.txt','debug']]){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),text);}
 return {root,parent,git};
}
test('export separates committed runtime/source from data and verifies originals are unchanged',async t=>{
 const {root,parent}=await fixture(t),destination=path.join(parent,'export');
 const result=await exportWorkspace({root,destination,includeData:true});
 assert.equal(result.data.files,2);assert.equal(result.verified,true);
 assert.equal(await readFile(path.join(destination,'03_数据备份/data/imports/order.json'),'utf8'),'private-order');
 assert.equal(await readFile(path.join(root,'data/imports/order.json'),'utf8'),'private-order');
 for(const folder of ['01_干净运行版','02_开发源码']){const files=await readdir(path.join(destination,folder));for(const excluded of ['data','node_modules','.env','output','.git'])assert.ok(!files.includes(excluded));}
 assert.ok((await readdir(path.join(destination,'02_开发源码'))).includes('server'));
 assert.ok(!(await readdir(path.join(destination,'01_干净运行版'))).includes('server'));
 await assert.rejects(exportWorkspace({root,destination,includeData:true}),/已存在/);
});
test('export defaults to no data and rejects destinations inside the project',async t=>{
 const {root,parent}=await fixture(t),destination=path.join(parent,'export');
 const result=await exportWorkspace({root,destination});assert.equal(result.data.files,0);
 assert.ok(!(await readdir(destination)).includes('03_数据备份'));
 await assert.rejects(exportWorkspace({root,destination:path.join(root,'nested')}),/项目目录之外/);
});
test('export refuses business data or secrets committed to Git',async t=>{
 const {root,parent,git}=await fixture(t);git(['add','data']);git(['-c','user.name=Export Test','-c','user.email=test@example.invalid','commit','-qm','unsafe fixture']);
 await assert.rejects(exportWorkspace({root,destination:path.join(parent,'export')}),/不应分发/);
});
