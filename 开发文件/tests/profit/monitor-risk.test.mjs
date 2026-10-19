import {test} from 'node:test';import assert from 'node:assert/strict';
import {classifyMonitorRisk} from '../../server/profit/monitor-risk.mjs';
test('monitor uses confirmed relative margin boundaries and keeps missingness separate',()=>{
 for(const [actual,label]of [['110','优于预期'],['100','正常'],['90','正常'],['89.99','注意'],['80','注意'],['79.99','重点'],['70','重点'],['69.99','严重'],['-1','严重']])assert.equal(classifyMonitorRisk({actual,expected:'100',revenue:'1000'}).label,label);
 assert.equal(classifyMonitorRisk({actual:null,expected:'100',revenue:'1000'}).label,'数据不足');
 assert.equal(classifyMonitorRisk({actual:'10',expected:null,revenue:'1000'}).label,'缺少基线');
 assert.equal(classifyMonitorRisk({actual:'10',expected:'0',revenue:'1000'}).label,'不可评级');
 assert.equal(classifyMonitorRisk({actual:'10',expected:'100',revenue:'0'}).label,'数据不足');
});
