export const END='2026-10-16';
export const categories=['材料','人工','能耗'];
export const riskRank={'严重':0,'重点':1,'注意':2,'数据不足':3,'缺少基线':4,'不可评级':5,'正常':6,'优于预期':7};
export function dateOffset(date,days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function calculate(order,asOf){
 const rows=order.daily.filter(d=>d.date<=asOf);const quantity=rows.reduce((s,d)=>s+d.quantity,0);const revenue=quantity*order.price;
 const complete=rows.length>0&&rows.every(d=>categories.every(k=>Number.isFinite(d.costs[k])&&d.costs[k]>=0));
 const costs=Object.fromEntries(categories.map(k=>[k,complete?rows.reduce((s,d)=>s+d.costs[k],0):null]));
 const cost=complete?Object.values(costs).reduce((s,v)=>s+v,0):null;
 const profit=complete&&revenue>0?revenue-cost:null;const rate=profit!==null?profit/revenue:null;
 const comparable=rate!==null&&Number.isFinite(order.planRate);
 const expected=comparable?revenue*order.planRate:null;const delta=comparable?profit-expected:null;
 const deviation=comparable?rate-order.planRate:null;const decline=comparable&&order.planRate>0?-deviation/order.planRate:null;
 let risk=rate===null?'数据不足':!Number.isFinite(order.planRate)?'缺少基线':decline===null?'不可评级':decline< -1e-9?'优于预期':decline<=.1+1e-9?'正常':decline<=.2+1e-9?'注意':decline<=.3+1e-9?'重点':'严重';
 return {order,rows,quantity,revenue,cost,costs,profit,rate,expected,delta,deviation,decline,risk,comparable,progress:quantity/order.quantity,defects:rows.reduce((s,d)=>s+(d.defects??0),0),lastDate:rows.at(-1)?.date??null};
}
export function analyzeOrder(order,asOf=END){const a=calculate(order,asOf);const yesterday=dateOffset(asOf,-1);const prev=calculate(order,yesterday);return {...a,yesterdayChange:a.rate!==null&&prev.rate!==null&&a.rows.some(d=>d.date===asOf)&&prev.rows.some(d=>d.date===yesterday)?a.rate-prev.rate:null};}
export function summarizeOrders(orders,asOf=END){
 const analyses=orders.map(o=>analyzeOrder(o,asOf));const known=analyses.filter(a=>a.profit!==null);const comparable=analyses.filter(a=>a.comparable);
 const revenue=known.reduce((s,a)=>s+a.revenue,0);const profit=known.length?known.reduce((s,a)=>s+a.profit,0):null;
 return {count:orders.length,active:orders.filter(o=>o.status==='生产中').length,known:known.length,comparable:comparable.length,excluded:orders.length-comparable.length,revenue,profit,rate:revenue>0?profit/revenue:null,delta:comparable.length?comparable.reduce((s,a)=>s+a.delta,0):null,expected:comparable.length?comparable.reduce((s,a)=>s+a.expected,0):null,compareProfit:comparable.length?comparable.reduce((s,a)=>s+a.profit,0):null,alerts:analyses.filter(a=>['注意','重点','严重'].includes(a.risk)).length,severe:analyses.filter(a=>a.risk==='严重').length,analyses};
}
export function filterOrders(orders,q={}){return orders.filter(o=>(!q.search||[o.id,o.product,o.customer].join(' ').toLowerCase().includes(q.search.toLowerCase()))&&(!q.customer||o.customer===q.customer)&&(!q.status||o.status===q.status)&&(!q.risk||analyzeOrder(o,q.asOf??END).risk===q.risk));}
export function seriesFor(orders,asOf=END,days=16,mode='cumulative'){
 return Array.from({length:days},(_,i)=>{const date=dateOffset(asOf,i-days+1);const slice=mode==='daily'?orders.map(o=>({...o,daily:o.daily.filter(d=>d.date===date)})):orders;
 const s=summarizeOrders(slice,date);return {date,actual:s.compareProfit,expected:s.expected,known:s.comparable,missing:orders.filter(o=>!o.daily.some(d=>d.date===date)).length};});
}
