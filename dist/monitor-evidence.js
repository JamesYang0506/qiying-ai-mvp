import {esc} from './ui.js';

export function formatMarginChange(value){
 if(value==null||!Number.isFinite(Number(value)))return '不可比较';
 const n=Number(value),magnitude=Math.abs(n);
 if(n===0)return '与昨日持平';
 const direction=n<0?'下降':'上升';
 if(magnitude<.001)return `${direction}不足 0.001 个百分点`;
 return `${direction} ${magnitude.toLocaleString('zh-CN',{maximumFractionDigits:3})} 个百分点`;
}

export function formatMarginDeviation(value){
 if(value==null||!Number.isFinite(Number(value)))return '不可比较';
 if(Number(value)===0)return '与预期持平';
 return formatMarginChange(value).replace(/^下降/,'低于').replace(/^上升/,'高于');
}

export function formatRecommendationText(value){
 const label=text(value,'相关情况待核查').replaceAll('kg/双','千克/双').replaceAll('元/kg','元/千克');
 return label.replace(/^(单位合格品.+费用) (\d+\.\d{2}) → (\d+\.\d{2}) 元\/双$/,(_,title,before,after)=>before===after?`${title}小幅上升（保留两位小数后均为 ${before} 元/双）`:`${title}由 ${before} 上升至 ${after} 元/双`);
}

// Only business text reaches the view; internal objects, paths and hashes stay in the API.
function text(value,fallback='未提供'){
 if(typeof value!=='string'&&typeof value!=='number')return fallback;
 const s=String(value).trim();
 if(!s||/^[{\[]/.test(s)||/\.json(?:$|[?#\s])/i.test(s)||/^[a-f0-9]{32,}$/i.test(s))return fallback;
 return s;
}
function number(value,unit,money=false){
 if(value==null||value===''||!Number.isFinite(Number(value)))return '待补齐';
 return `${Number(value).toLocaleString('zh-CN',{minimumFractionDigits:money?2:0,maximumFractionDigits:money?2:6})} ${unit}`;
}
function field(label,value,unit,money=false){return `<div class="bm-evidence-value"><span>${label}</span><strong>${esc(number(value,unit,money))}</strong></div>`;}
function sourceLabel(value){
 let source=value;
 if(typeof source==='string'){try{source=JSON.parse(source);}catch{return '来源位置待补齐';}}
 if(!source||typeof source!=='object'||Array.isArray(source))return '来源位置待补齐';
 const book=source.fileRole==='cost'?'成本表':source.fileRole==='daily'?'每日数据表':'导入表格';
 const sheet=text(source.sheet,''),cell=typeof source.cell==='string'&&/^\$?[A-Z]{1,3}\$?\d+$/i.test(source.cell)?source.cell.replaceAll('$',''):'';
 const row=cell?.match(/\d+$/)?.[0];
 return [book,sheet?`《${sheet}》`:'',row?`第 ${Number(row)} 行（${cell}）`:'来源位置待补齐'].filter(Boolean).join(' · ');
}
function description(type,r){
 if(type==='production')return `生产报工 · ${text(r.size,'码号未提供').replace(/#$/,'码')}`;
 if(type==='materials')return `材料领用 · ${text(r.materialId,'材料未提供')}`;
 if(type==='expenses')return `${text(r.category,'其他')}费用 · ${text(r.item,'费用项目未提供')}`;
 return `补产记录 · ${text(r.size,'码号未提供').replace(/#$/,'码')}`;
}
function values(type,r){
 if(type==='production')return field('加工量',r.processed,'双')+field('不良量',r.defects,'双');
 if(type==='materials')return field('净耗量',r.net,'千克')+field('材料单价',r.price,'元/千克');
 if(type==='expenses')return field('费用金额',r.amount,'元',true);
 return field('补产量',r.quantity,'双')+`<small>${esc(text(r.inclusion,'补产计入口径待确认'))}</small>${r.reason?`<small>原因：${esc(text(r.reason))}</small>`:''}`;
}
function time(value){const date=new Date(value);return Number.isNaN(date.getTime())?'未提供':date.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});}

export function renderMonitorEvidence(d){
 const all=['previous','daily'].flatMap(day=>['production','materials','expenses','supplements'].flatMap(type=>(d[day]?.rows?.[type]??[]).map(record=>({type,record}))));
 const missing=d.order?.quality?.missing??[];
 return `<div class="bm-overlay"><section class="panel bm-dialog bm-business-evidence" role="dialog" aria-modal="true" aria-label="订单核查依据" tabindex="-1"><div class="panel-head"><h2>订单核查依据</h2><button class="button" id="bm-close">关闭</button></div><div class="panel-body"><div class="bm-evidence-summary"><span>订单 <strong>${esc(text(d.order?.order?.id))}</strong></span><span>业务截至 <strong>${esc(text(d.asOf))}</strong></span><span>对照方式 <strong>${d.baselineMode==='budget'?'含损耗预算':'理想上界'}</strong></span></div><p class="bm-evidence-note">下列记录来自本次分析使用的已保存资料，包含当日与前一日数据，方便对照核查。资料获取时间：${esc(time(d.knownAt))}。</p>${missing.length?`<div class="bm-evidence-warning"><strong>待补齐资料</strong>${missing.map(m=>`<p>${esc(text(m.date,''))} ${esc(text(m.detail,'相关资料待补齐'))}</p>`).join('')}</div>`:''}<div class="table-wrap"><table><thead><tr><th>序号</th><th>业务日期</th><th>业务项目</th><th>数量与费用</th><th>信息来源</th></tr></thead><tbody>${all.map(({type,record:r},i)=>`<tr><td>${i+1}</td><td>${esc(text(r.date))}</td><td>${esc(description(type,r))}</td><td>${values(type,r)}</td><td>${esc(sourceLabel(r.source))}</td></tr>`).join('')}</tbody></table></div>${!all.length?'<p>该日暂无可见原始记录。</p>':''}<p class="bm-evidence-note">“待补齐”表示当前资料不足，不代表数量或金额为零。材料金额以订单分析的核算结果为准。</p></div></section></div>`;
}
