import {D} from './decimal.mjs';
export const MONITOR_RISK_VERSION='RELATIVE-MARGIN-1';
const priorities={'严重':0,'重点':1,'注意':2,'数据不足':3,'缺少基线':4,'不可评级':5,'正常':6,'优于预期':7};
// The relative decline thresholds are the existing, confirmed project rule.
// Classification does not calculate profit or diagnose operational causes.
export function classifyMonitorRisk({actual,expected,revenue,baselineComplete=true}){
 let label,reason,relativeDecline=null;
 if(actual==null||revenue==null||!new D(revenue).gt(0)){label='数据不足';reason='实际生产毛利或正收入尚不完整';}
 else if(expected==null||!baselineComplete){label='缺少基线';reason='同进度理论基线不完整';}
 else if(!new D(expected).gt(0)){label='不可评级';reason='预期毛利率非正，不适用相对下降分级';}
 else{const decline=new D(expected).minus(actual).div(expected);relativeDecline=decline.toString();label=decline.lt(0)?'优于预期':decline.lte('.1')?'正常':decline.lte('.2')?'注意':decline.lte('.3')?'重点':'严重';reason='同进度毛利率相对下降：≤10%正常，≤20%注意，≤30%重点，超过30%严重';}
 return {label,priority:priorities[label],reason,relativeDecline,ruleVersion:MONITOR_RISK_VERSION};
}
