import {test} from 'node:test';import assert from 'node:assert/strict';
import {translateText} from '../../运行文件/dist/project-i18n.js';
test('language presentation preserves source text in Chinese and raw imported values in English',()=>{
 const raw='客户订单-生产材料-2026';assert.equal(translateText(raw,'zh'),raw);assert.equal(translateText(raw,'en',false),raw);
 assert.equal(translateText('材料','en',false),'Materials');
});
test('English dynamic labels keep IDs, dates, amounts and percentages intact',()=>{
 const s=translateText('截至 2026-10-12 · 同进度理论 18.4% · 已知实际毛利 ¥1,234.50 · REV-001');assert.match(s,/As of/);for(const value of ['2026-10-12','18.4%','¥1,234.50','REV-001'])assert.ok(s.includes(value));assert.doesNotMatch(s,/undefined|NaN/);
 const page=translateText('共 1 笔 · 1–1 笔 · pp 表示百分点');assert.doesNotMatch(page,/undefined|[\u4e00-\u9fff]/);assert.match(page,/1 order/);
});
test('expanded calculation descriptions are translated without changing the formula meaning',()=>{
 const a=translateText('预算理论毛利 ÷ 预算理论收入');assert.equal(a,'Budget theoretical gross profit ÷ budget theoretical revenue');
 assert.equal(translateText('10%–不足30%'),'10%–<30%');assert.equal(translateText('近 16 天趋势'),'Last 16 days');
});

test('new monitor evidence and precise margin changes have English labels without changing numbers',()=>{
 assert.equal(translateText('订单核查依据'),'Order review evidence');
 assert.equal(translateText('下降 0.016 个百分点'),'Down 0.016 percentage points');
 assert.equal(translateText('下降不足 0.001 个百分点'),'Down less than 0.001 percentage points');
 assert.equal(translateText('低于 7.93 个百分点'),'Below by 7.93 percentage points');
 assert.equal(translateText('第 18 行（A18）'),'Row 18 (A18) ');
 assert.ok(translateText('15.965 元/千克').includes('15.965 CNY/kg'));
 assert.equal(translateText('材料编号-2026','en',false),'材料编号-2026');
 assert.equal(translateText('未开工 6 笔已隐藏，查看'),'6 not-started orders hidden, view');
 assert.equal(translateText('已完工 4 笔已隐藏，查看'),'4 completed orders hidden, view');
 assert.equal(translateText('未开工 6 笔已隐藏，点击上方“未开工”查看。'),'6 not-started orders hidden; select "Not started" above to view.');
 assert.equal(translateText('已完工 4 笔已隐藏，点击上方“已完工”查看。'),'4 completed orders hidden; select "Completed" above to view.');
 assert.equal(translateText('未开工 6 笔、已完工 4 笔已隐藏，点击上方状态筛选查看。'),'6 not-started and 4 completed orders hidden; use the status filter above to view.');
});
