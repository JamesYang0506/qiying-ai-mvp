import {test} from 'node:test';import assert from 'node:assert/strict';import {issuesCsv} from '../dist/import-page.js';
test('downloadable error list carries location and fix suggestion',()=>{
 const csv=issuesCsv([{severity:'error',fileRole:'daily',sheet:'每日材料',cell:'E6',recordId:'MAT-1',field:'材料编号',code:'MATERIAL_UNKNOWN',message:'未知材料',hint:'材料编号必须存在于原订单用量表中。'}]);
 assert.ok(csv.startsWith('﻿'));
 for(const value of ['"修正建议"','"每日Excel"','"每日材料"','"E6"','"MAT-1"','"MATERIAL_UNKNOWN"','"材料编号必须存在于原订单用量表中。"'])assert.ok(csv.includes(value),value);
 assert.ok(!csv.includes('"undefined"'));
});
test('error list escapes quotes and keeps empty fields explicit',()=>{
 const csv=issuesCsv([{severity:'warning',fileRole:'cost',sheet:'a"b',cell:null,recordId:null,field:null,code:'X',message:'m',hint:null}]);
 assert.ok(csv.includes('"a""b"'));
 assert.ok(csv.includes('"成本Excel"'));
});
