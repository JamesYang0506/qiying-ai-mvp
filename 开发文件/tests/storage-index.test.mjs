import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {createStore} from '../server/storage/store.mjs';

const dataset=(id,revision='REV-1',quantity='100',baseline='BASE-1')=>({order:{id,lineId:'LINE-1',start:'2026-08-03',end:'2026-08-03',quantity,price:'17.2',weight:'.65'},revision:{id:revision},baseline:{id:baseline,params:{},recipe:[],sizePlan:[]},production:[],materials:[],expenses:[],supplements:[]});
const fileName=(id,revision)=>createHash('sha256').update(id+'\0'+revision).digest('hex')+'.json';
const temp=async t=>{const dir=await mkdtemp(path.join(os.tmpdir(),'qiying-index-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;};

test('reading one order does not parse unrelated files',async t=>{
 const dir=await temp(t),store=createStore(dir);
 await store.commit(dataset('A'));await store.commit(dataset('B'));
 await writeFile(path.join(dir,fileName('B','REV-1')),'{not json');
 assert.equal((await store.get('A','REV-1')).order.id,'A');
 await assert.rejects(store.listOrders(),/本地导入数据损坏/);
});

test('commits are visible immediately and duplicate commits deduplicate',async t=>{
 const dir=await temp(t),store=createStore(dir);
 const results=await Promise.all([store.commit(dataset('A')),store.commit(dataset('A'))]);
 assert.equal(results.filter(r=>r.reused===false).length,1);
 assert.equal((await readdir(dir)).filter(n=>n.endsWith('.json')).length,1);
 assert.equal((await store.get('A','REV-1')).order.id,'A');
 assert.deepEqual((await store.listOrders()).map(o=>o.id),['A']);
});

test('new, deleted and modified files invalidate the index',async t=>{
 const dir=await temp(t),store=createStore(dir);
 await store.commit(dataset('A'));
 assert.deepEqual((await store.listOrders()).map(o=>o.id),['A']);
 const b=dataset('B'),bFile=path.join(dir,fileName('B','REV-1'));
 await writeFile(bFile,JSON.stringify({hash:'external',createdAt:'2026-10-17T00:00:00.000Z',dataset:b}));
 assert.deepEqual((await store.listOrders()).map(o=>o.id).sort(),['A','B']);
 await unlink(bFile);
 assert.deepEqual((await store.listOrders()).map(o=>o.id),['A']);
 const a=dataset('A','REV-1','200'),aFile=path.join(dir,fileName('A','REV-1'));
 await writeFile(aFile,JSON.stringify({hash:'changed',createdAt:'2026-10-17T00:00:00.000Z',dataset:a}));
 assert.equal((await store.get('A','REV-1')).order.quantity,'200');
 assert.equal((await store.listOrders()).find(o=>o.id==='A').quantity,'200');
});

test('corrupt or invalid files fail explicitly instead of being skipped',async t=>{
 const dir=await temp(t),store=createStore(dir);
 await writeFile(path.join(dir,fileName('X','REV-1')),'{bad');
 await assert.rejects(store.listVersions(),/本地导入数据损坏/);
 await writeFile(path.join(dir,fileName('X','REV-1')),JSON.stringify({dataset:{}}));
 await assert.rejects(store.listVersions(),/本地导入版本无效/);
});

test('revisions and versions keep one fixed dataset per requested version',async t=>{
 const dir=await temp(t),store=createStore(dir);
 await store.commit(dataset('A','REV-1'));await store.commit(dataset('A','REV-2','200','BASE-2'));
 const revisions=await store.listRevisions('A');
 assert.deepEqual(revisions.map(r=>r.revisionId),['REV-2','REV-1']);
 assert.equal((await store.get('A','REV-1')).order.quantity,'100');
 assert.equal((await store.get('A')).order.quantity,'200');
 assert.equal((await store.listVersions()).length,2);
});
