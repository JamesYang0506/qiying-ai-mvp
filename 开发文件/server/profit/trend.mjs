import {calculateSeries} from './series.mjs';
export function trend(dataset,{start,end,baselineMode='ideal'}){
 return calculateSeries(dataset,{start,end,baselineMode});
}
