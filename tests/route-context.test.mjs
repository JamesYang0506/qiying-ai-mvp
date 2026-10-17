import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderRoute} from '../dist/route-context.js';
test('analysis and daily-data navigation retain order, date, revision and visibility context',()=>{
 const scope={orderId:'订单 B',asOf:'2026-08-24',revision:'R-2',baselineMode:'budget',knownAt:'2026-08-25T08:00:00+08:00'};
 for(const page of ['data','imported']){const href=orderRoute(page,scope);assert.ok(href.startsWith('#'+page+'/'+encodeURIComponent(scope.orderId)+'?'));const q=new URLSearchParams(href.split('?')[1]);for(const k of ['asOf','revision','baselineMode','knownAt'])assert.equal(q.get(k),scope[k]);}
 assert.equal(orderRoute('data',null),'#data');
});
