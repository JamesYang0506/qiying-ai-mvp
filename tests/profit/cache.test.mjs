import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCalculationCache} from '../../server/profit/cache.mjs';

test('cache merges concurrent computes and keeps the first value',async()=>{
 const cache=createCalculationCache({maxEntries:4});let calls=0;
 const compute=async()=>{calls++;await new Promise(r=>setTimeout(r,5));return 'value';};
 const [a,b,c]=await Promise.all([cache.getOrCompute('k',compute),cache.getOrCompute('k',compute),cache.getOrCompute('k',compute)]);
 assert.equal(calls,1);assert.deepEqual([a,b,c],['value','value','value']);
 assert.equal(await cache.getOrCompute('k',compute),'value');assert.equal(calls,1);
});

test('failed computes are not cached and can be retried',async()=>{
 const cache=createCalculationCache({maxEntries:2});let calls=0;
 await assert.rejects(cache.getOrCompute('k',async()=>{calls++;throw new Error('boom');}),/boom/);
 assert.equal(await cache.getOrCompute('k',async()=>{calls++;return calls;}),2);
});

test('capacity eviction removes the least recently used entry',async()=>{
 const cache=createCalculationCache({maxEntries:2});
 await cache.getOrCompute('a',async()=>'A');
 await cache.getOrCompute('b',async()=>'B');
 assert.equal(await cache.getOrCompute('a',async()=>'stale'),'A');
 await cache.getOrCompute('c',async()=>'C');
 assert.equal(await cache.getOrCompute('b',async()=>'recomputed'),'recomputed');
 assert.equal(await cache.getOrCompute('c',async()=>'stale'),'C');
 assert.equal(cache.size,2);
});

test('different revision, visibility or formula keys do not share values',async()=>{
 const cache=createCalculationCache({maxEntries:8});const compute=()=>Math.random();
 const keys=['REV-1|2026-10-01T00:00:00Z|v1','REV-2|2026-10-01T00:00:00Z|v1','REV-1|2026-10-02T00:00:00Z|v1','REV-1|2026-10-01T00:00:00Z|v2'];
 const values=await Promise.all(keys.map(key=>cache.getOrCompute(key,compute)));
 assert.equal(new Set(values).size,keys.length);
});

test('invalid capacity and empty keys are rejected',async()=>{
 assert.throws(()=>createCalculationCache({maxEntries:0}),/maxEntries/);
 const cache=createCalculationCache({maxEntries:1});
 await assert.rejects(cache.getOrCompute('',async()=>1),/缓存键/);
});
