import Decimal from 'decimal.js';
export const D=Decimal.clone({precision:40,rounding:Decimal.ROUND_HALF_UP});
export const money=x=>x==null?null:new D(x).toDecimalPlaces(2).toFixed(2);
export const six=x=>new D(x).toDecimalPlaces(6);
export const sum=xs=>xs.some(x=>x==null)?null:xs.reduce((s,x)=>s.plus(x),new D(0));
export const valid=r=>['已确认','模拟确认','暂估','不适用'].includes(r.status);
