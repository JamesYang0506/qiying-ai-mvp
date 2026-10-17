import {evaluate} from './evaluate.mjs';import {addDays} from '../import/validation.mjs';
export function trend(dataset,{start,end,baselineMode='ideal',knownAt}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start??'')||!/^\d{4}-\d{2}-\d{2}$/.test(end??'')||start>end||(new Date(end)-new Date(start))/86400000>3660)throw new Error('趋势日期范围无效');
 const points=[];for(let date=start;date<=end;date=addDays(date,1)){const a=evaluate(dataset,{asOf:date,baselineMode,knownAt});points.push({date,actual:a.cumulative.actual.gross,expected:a.cumulative.expected.gross,gap:a.cumulative.gap,quantity:a.cumulative.quantity,state:a.quality.state});}return points;
}
