import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePair} from '../../server/import/normalize.mjs';
import {evaluate} from '../../server/profit/evaluate.mjs';
import {addDays} from '../../server/import/validation.mjs';
import {pair} from '../import/fixture.mjs';
import {calculateSeries,createDailyEvaluator} from '../../server/profit/series.mjs';

const days=['2026-08-03','2026-08-04','2026-08-05','2026-08-06'];
function multiDay(count=3){
 const d=normalizePair(...pair()).dataset,base=d.production[0],mat=d.materials[0];
 d.order.start=days[0];d.order.end=days[count-1];
 d.production=days.slice(0,count).map((date,i)=>({...base,id:`PD-${i}`,date,availableAt:`${date}T18:00:00+08:00`,processed:100+i}));
 d.materials=days.slice(0,count).map((date,i)=>({...mat,id:`MAT-${i}`,date,availableAt:`${date}T18:00:00+08:00`,net:String(65+i),price:String(17.2+i)}));
 d.expenses=d.expenses.map((r,i)=>({...r,id:`F-${i}`,date:days[1],availableAt:`${days[1]}T18:00:00+08:00`}));
 return d;
}
function expectedPoints(d,{start,end,baselineMode='ideal'}){
 const out=[];
 for(let date=start;date<=end;date=addDays(date,1)){
  const a=evaluate(d,{asOf:date,baselineMode});
  out.push({date,actual:a.cumulative.actual.gross,expected:a.cumulative.expected.gross,gap:a.cumulative.gap,quantity:a.cumulative.quantity,state:a.quality.state});
 }
 return out;
}

test('series matches one evaluate per day for ideal and budget modes',()=>{
 const d=multiDay();
 for(const baselineMode of ['ideal','budget']){
  const options={start:days[0],end:days[3],baselineMode};
  assert.deepEqual(calculateSeries(d,options),expectedPoints(d,options));
 }
});

test('series keeps dates before start, after end and around zero quantity',()=>{
 const d=multiDay(2);d.production[1].processed=0;d.production[1].defects=0;
 const options={start:'2026-08-01',end:'2026-08-09',baselineMode:'ideal'};
 assert.deepEqual(calculateSeries(d,options),expectedPoints(d,options));
});

test('late recording and incomplete days keep trend visibility unchanged',()=>{
 const d=multiDay();d.materials[1].availableAt='2026-08-07T18:00:00+08:00';
 const missing=multiDay();missing.expenses.find(r=>r.category==='管理').amount=null;
 for(const dataset of [d,missing]){
  const options={start:days[0],end:days[3],baselineMode:'ideal'};
  assert.deepEqual(calculateSeries(dataset,options),expectedPoints(dataset,options));
 }
});

test('D trend points evaluate each day once instead of D full evaluations',()=>{
 const d=multiDay(4),original=createDailyEvaluator;
 let evaluations=0,dayCalls=0;
 const counting=dataset=>{const ev=original(dataset);evaluations++;const day=ev.day;ev.day=(...args)=>{dayCalls++;return day(...args);};return ev;};
 calculateSeries(d,{start:days[0],end:days[3],baselineMode:'ideal'},{createEvaluator:counting});
 assert.equal(evaluations,1);assert.equal(dayCalls,4);
});
