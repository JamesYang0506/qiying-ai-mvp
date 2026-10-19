import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseBenchmarkArgs,assertInsideTemp} from '../../scripts/benchmark-performance.mjs';

test('benchmark requires an explicit source data directory',()=>{
 assert.throws(()=>parseBenchmarkArgs([]),/--data-dir/);
});

test('benchmark defaults to three warmups and twenty measured runs',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'qiying-perf-args-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const o=parseBenchmarkArgs(['--data-dir',dir]);
 assert.equal(o.sourceDir,path.resolve(dir));assert.equal(o.warmup,3);assert.equal(o.runs,20);assert.equal(o.orders,0);assert.equal(o.days,16);assert.equal(o.period,16);
 const q=parseBenchmarkArgs(['--data-dir',dir,'--quick']);
 assert.equal(q.quick,true);assert.equal(q.warmup,1);assert.equal(q.runs,5);assert.equal(q.skipHistory,true);
 const overridden=parseBenchmarkArgs(['--data-dir',dir,'--quick','--runs','9']);
 assert.equal(overridden.runs,9);
});

test('benchmark rejects invalid run counts and unsafe output paths',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'qiying-perf-args-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 assert.throws(()=>parseBenchmarkArgs(['--data-dir',dir,'--runs','0']),/--runs/);
 assert.throws(()=>parseBenchmarkArgs(['--data-dir',dir,'--warmup','-1']),/--warmup/);
 assert.throws(()=>parseBenchmarkArgs(['--data-dir',dir,'--period','0']),/--period/);
});

test('cleanup is confined to the benchmark temporary root',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'qiying-perf-root-'));t.after(()=>rm(root,{recursive:true,force:true}));
 assert.equal(assertInsideTemp(root,path.join(root,'data')),path.join(root,'data'));
 assert.throws(()=>assertInsideTemp(root,path.join(root,'..','outside')),/临时目录/);
});
