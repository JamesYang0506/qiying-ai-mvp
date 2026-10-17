import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatMarginChange,formatMarginDeviation,formatRecommendationText,renderMonitorEvidence} from '../dist/monitor-evidence.js';
import {filterMonitorRows,hideInactive,matchesSearch} from '../dist/monitor-workspace.js';
import {renderScopeFilters} from '../dist/monitor-table.js';

const source={fileRole:'daily',sheet:'每日生产',cell:'A6',recordId:'RAW-PROD-ID',fileHash:'secret-hash'};
const detail=()=>({asOf:'2026-10-12',knownAt:'2026-10-17T08:00:00Z',revisionId:'INTERNAL-REVISION',snapshotId:'SECRET-SNAPSHOT',baselineMode:'ideal',order:{order:{id:'A-011'},quality:{missing:[]}},previous:{rows:{production:[{id:'RAW-PROD-ID',date:'2026-10-11',size:'38#',processed:'1200',defects:'0',source}]}},daily:{rows:{materials:[{id:'RAW-MAT-ID',date:'2026-10-12',materialId:'EVA-01',net:'65.25',price:'17.2',source:{...source,sheet:'每日材料'}}],expenses:[{id:'RAW-FEE-ID',date:'2026-10-12',category:'人工',item:'计件工资',amount:'0',source:{...source,sheet:'每日费用'}}],supplements:[{id:'RAW-SUP-ID',date:'2026-10-12',size:'38#',quantity:null,parentId:'RAW-PROD-ID',inclusion:'已含当日加工量与净耗，不重复计入',reason:'返工补产',source:{...source,fileRole:'cost',sheet:'补单用量'}}]}}});

test('margin changes use percentage points with honest small-value precision',()=>{
 assert.equal(formatMarginChange('-.05'),'下降 0.05 个百分点');
 assert.equal(formatMarginChange('.05'),'上升 0.05 个百分点');
 assert.equal(formatMarginChange('0'),'与昨日持平');
 assert.equal(formatMarginChange('-.00001'),'下降不足 0.001 个百分点');
 assert.equal(formatMarginChange(null),'不可比较');
 assert.equal(formatMarginDeviation('0'),'与预期持平');
 assert.equal(formatMarginDeviation('-1.5'),'低于 1.5 个百分点');
});

test('risk filter keeps only the three actionable severity levels',()=>{
 const html=renderScopeFilters(null,{asOf:'2026-10-01',mode:'ideal',customer:'',status:'',risk:'',period:7},false);
 const select=html.match(/<select[^>]*id="bm-risk"[^>]*>([\s\S]*?)<\/select>/)?.[1]??'';
 assert.deepEqual([...select.matchAll(/<option value="([^"]*)"/g)].map(m=>m[1]),['','严重','重点','注意']);
 for(const hidden of ['数据不足','缺少基线','不可评级','正常','优于预期'])assert.ok(!select.includes(hidden),hidden);
 const period=html.match(/<select[^>]*id="bm-period"[^>]*>([\s\S]*?)<\/select>/)?.[1]??'';
 assert.deepEqual([...period.matchAll(/<option value="([^"]*)"/g)].map(m=>m[1]),['7','14','30']);
});

test('search matches id, product and customer with spaces and multiple keywords',()=>{
 const row={order:{id:'SIM-M09',product:'EVA 薄利款',customer:'CUST-L1'}};
 assert.equal(matchesSearch(row,' SIM-M09 '),true);
 assert.equal(matchesSearch(row,'薄利  cust-l1'),true);
 assert.equal(matchesSearch(row,'SIM-M09 CUST-H1'),false);
 assert.equal(matchesSearch(row,'   '),true);
});

test('the order table shows only in-progress orders unless inactive statuses are requested',()=>{
 const rows=[
  {order:{id:'ACTIVE'},monitoringStatus:'生产中',distribution:'medium',comparison:{deteriorated:false,marginChangePp:'-0.1'},quality:{missing:[]}},
  {order:{id:'FUTURE'},monitoringStatus:'未开工',distribution:'not_started',comparison:{deteriorated:false,marginChangePp:null},quality:{missing:[]}},
  {order:{id:'DONE'},monitoringStatus:'已完工',distribution:'unknown',comparison:{deteriorated:false,marginChangePp:null},quality:{missing:[]}}
 ];
 const ids=list=>list.map(r=>r.order.id),state={status:'',filter:'',search:''};
 assert.equal(hideInactive(state),true);
 assert.deepEqual(ids(filterMonitorRows(rows,state)),['ACTIVE']);
 assert.deepEqual(ids(filterMonitorRows([rows[1]],{...state,status:'未开工'})),['FUTURE']);
 assert.deepEqual(ids(filterMonitorRows([rows[2]],{...state,status:'已完工'})),['DONE']);
 assert.deepEqual(ids(filterMonitorRows(rows,{...state,filter:'not_started'})),['FUTURE']);
 assert.deepEqual(ids(filterMonitorRows([...rows,{...rows[0],order:{id:'MISSING'},quality:{missing:['baseline']}}],{...state,filter:'incomplete'})),['MISSING']);
 assert.deepEqual(ids(filterMonitorRows(rows,{...state,search:'DONE'})),['DONE']);
});

test('evidence shows business labels, table positions and units rather than raw records',()=>{
 const html=renderMonitorEvidence(detail());
 for(const label of ['订单核查依据','每日生产','第 6 行','加工量','1,200','不良量','净耗量','65.25','千克','元/千克','费用金额','0.00','补产量','待补齐','已含当日加工量'])assert.ok(html.includes(label),label);
 for(const hidden of ['JSON','fileRole','recordId','fileHash','RAW-PROD-ID','RAW-MAT-ID','RAW-FEE-ID','RAW-SUP-ID','SECRET-SNAPSHOT','INTERNAL-REVISION','记录 ID','证据 ID'])assert.ok(!html.includes(hidden),hidden);
 assert.ok(html.includes('A-011'));
});

test('stringified sources are decoded and technical filenames are never shown',()=>{
 const d=detail();d.daily.rows.materials[0].source=JSON.stringify({fileRole:'daily',sheet:'每日材料',cell:'B18',recordId:'HIDDEN'});
 d.previous.rows.production[0].source='C:/data/imports/abcdef.json';
 const html=renderMonitorEvidence(d);
 assert.ok(html.includes('第 18 行'));assert.ok(html.includes('来源位置待补齐'));
 assert.ok(!html.includes('.json'));assert.ok(!html.includes('HIDDEN'));assert.ok(!html.includes('fileRole'));
});

test('untrusted source and item text is escaped, and missing records are explicit',()=>{
 const d=detail();d.daily.rows.expenses[0].item='<img src=x onerror=alert(1)>';
 d.daily.rows.expenses[0].source={sheet:'<script>alert(1)</script>',cell:'A6'};
 const html=renderMonitorEvidence(d);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;img'));
 const empty=renderMonitorEvidence({...d,daily:null,previous:null});assert.ok(empty.includes('暂无可见原始记录'));
});

test('recommendations explain rounded tiny increases without identical before and after values',()=>{
 assert.equal(formatRecommendationText('单位合格品人工费用 2.93 → 2.93 元/双'),'单位合格品人工费用小幅上升（保留两位小数后均为 2.93 元/双）');
 assert.equal(formatRecommendationText('材料 EVA-01 单价 15.1 元/kg'),'材料 EVA-01 单价 15.1 元/千克');
 assert.equal(formatRecommendationText('{"recordId":"secret"}'),'相关情况待核查');
});
