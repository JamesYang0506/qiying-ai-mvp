import {test} from 'node:test';
import assert from 'node:assert/strict';
import {animateMonitorCharts} from '../../运行文件/dist/monitor-chart-motion.js';

test('reduced motion keeps the final chart visible without creating animations',t=>{
 const prior=globalThis.matchMedia;t.after(()=>{globalThis.matchMedia=prior;});
 globalThis.matchMedia=()=>({matches:true});
 const stop=animateMonitorCharts({querySelectorAll(){throw new Error('Animation must not run');}});
 assert.doesNotThrow(stop);
});

test('disposing a chart cancels its animations and does not change data attributes',t=>{
 const prior=globalThis.matchMedia;t.after(()=>{globalThis.matchMedia=prior;});globalThis.matchMedia=()=>({matches:false});
 let active=0;const element={animate(){active++;return {cancel(){active--;}};},getAttribute:()=> '100 308.407',querySelector:()=>({getAttribute:()=> '200'})};
 const root={querySelectorAll:()=>[element],querySelector:()=>element};
 const stop=animateMonitorCharts(root);assert.ok(active>0);stop();assert.equal(active,0);assert.equal(element.getAttribute('stroke-dasharray'),'100 308.407');
});

test('browsers without animation support still render usable static charts',()=>{
 const root={querySelectorAll:()=>[],querySelector:()=>null};
 assert.doesNotThrow(()=>animateMonitorCharts(root)());
});
