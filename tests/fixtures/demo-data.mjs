import {END,categories} from './demo-metrics.mjs';
export const DATA_VERSION='demo-20261016-v1';
export const customers=['恒远运动','星途实业','森迈科技','远行制造'];
const products=['轻量运动鞋中底','户外鞋大底','休闲鞋鞋帮','功能鞋垫','竞速鞋中底','缓震鞋中底'];
const targets=[.132,.185,.204,.179,.192,.22,-.025,.145,.198,.21,.172,.18,.205,.14,.195,.21,.184,.2,.19,.208,.175,.2,.19,.2];
export const demoOrders=Array.from({length:24},(_,i)=>{
 const number=18+i;const price=38+(i%5)*6;const planRate=i===22?null:i===23?0:.2+(i%3)*.01;
 const quantity=12000+(i%6)*2000;const daily=[];
 for(let day=1;day<=16;day++){
  if(i===21&&day===10)continue;
  const qty=240+((i*37+day*29)%180);const revenue=qty*price;
  const rate=targets[i]+.045*(8.5-day)/7.5;
  const cost=Math.round(revenue*(1-rate)*100)/100;const material=Math.round(cost*(.63+day*.001)*100)/100;const labor=Math.round(cost*.265*100)/100;
  daily.push({date:`2026-10-${String(day).padStart(2,'0')}`,quantity:qty,defects:Math.round(qty*(i<2?.045:.012)),costs:{材料:i===20&&day===16?null:material,人工:labor,能耗:Math.round((cost-material-labor)*100)/100},source:`DEMO-${number}-${String(day).padStart(2,'0')}`});
 }
 return {id:`QY-2026-${String(number).padStart(3,'0')}`,customer:customers[i%4],product:products[i%6],quantity:i===19?daily.reduce((sum,row)=>sum+row.quantity,0):quantity,price,planRate,planShares:{材料:.49,人工:.22,能耗:.09},status:i===19?'已完工':'生产中',start:'2026-10-01',end:i===19?'2026-10-16':'2026-11-15',baselineVersion:planRate===null?null:'PLAN-DEMO-v1',daily};
});
export async function getOrders(){return structuredClone(demoOrders);}
export async function sendChat(){throw new Error('AI 接口待接入。当前不会发送数据或生成分析结果。');}
export const dataInfo={asOf:END,version:DATA_VERSION,label:'合成演示数据',source:'内置演示生成器',categories};
