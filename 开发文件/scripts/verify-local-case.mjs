import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';import {readXlsx} from '../server/import/xlsx.mjs';import {normalizePair} from '../server/import/normalize.mjs';import {evaluate} from '../server/profit/evaluate.mjs';
import {money} from '../server/profit/decimal.mjs';
const args=Object.fromEntries(Array.from({length:process.argv.slice(2).length/2},(_,i)=>[process.argv[2+i*2].replace(/^--/,''),process.argv[3+i*2]]));
if(!args.cost||!args.daily||!args.expected)throw new Error('用法：node scripts/verify-local-case.mjs --cost 文件 --daily 文件 --expected JSON');
const r=normalizePair(readXlsx(await readFile(args.cost)),readXlsx(await readFile(args.daily)));assert.equal(r.issues.filter(x=>x.severity==='error').length,0,JSON.stringify(r.issues));
const expected=JSON.parse(await readFile(args.expected,'utf8'));const days=expected.daily_expected_results;const selected=[days[0],days[10],days[21],days.at(-1)];
for(const row of selected){const a=evaluate(r.dataset,{asOf:row.date});assert.equal(a.cumulative.actual.gross,money(row.cum_gross));assert.equal(a.cumulative.expected.gross,money(row.cum_theory));assert.equal(a.cumulative.gap,money(row.cum_gap));assert.equal(a.cumulative.quantity,Number(row.cum_good));console.log(row.date,a.cumulative.quantity,a.cumulative.actual.gross,a.cumulative.expected.gross,a.cumulative.gap);}
console.log('完整本地案例四个日期核验通过；补单未重复追加。');
