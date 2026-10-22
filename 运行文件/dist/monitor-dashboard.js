import {esc,icon,empty} from './ui.js';
import {renderTrend} from './charts.js';
import {renderScopeFilters,renderOrdersTable} from './monitor-table.js';
import {formatMarginChange,formatRecommendationText} from './monitor-evidence.js';

const fmt=(value,digits=2)=>value==null?'—':Number(value).toLocaleString('zh-CN',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const rate=value=>value==null?'—':`${fmt(Number(value)*100)}%`;
const change=formatMarginChange;
const adviceText=formatRecommendationText;
const colors={high:'#22b58d',medium:'#1689f9',low:'#ffb544',negative:'#f05261',unknown:'#a6b3c4',not_started:'#dce5ef'};
const bucketNames={high:'高毛利订单',medium:'中段毛利订单',low:'低毛利订单',negative:'亏损订单',unknown:'无法计算',not_started:'未开工'};

export function monitorMasthead(){
 return `<header class="bm-masthead"><a class="bm-brand" href="#monitor" aria-label="企盈智擎首页"><img class="bm-brand-logo" src="assets/qiying-logo.jpg" alt="企盈智擎"><span><strong>企盈智擎</strong><small>订单经营分析平台</small></span></a><div class="bm-brand-message"><strong>让制造业经营决策更精准</strong><span>从订单利润出发，让每一次核查都有依据</span></div><div class="bm-masthead-context"><span class="bm-live-dot"></span> 本地订单工作区 <span class="bm-head-divider"></span><span>数据驱动经营</span></div></header>`;
}

function kpi(label,value,unit,foot,type,symbol){
 return `<article class="stat-card bm-kpi bm-kpi-${type} ${String(value).length>11?'bm-kpi-long':''}"><div class="bm-kpi-icon">${icon(symbol)}</div><div class="bm-kpi-content"><div class="stat-top">${label}</div><div class="stat-value"><span class="bm-kpi-number">${value}</span><em>${unit}</em></div><p class="stat-foot">${foot}</p></div><span class="bm-kpi-corner" aria-hidden="true"></span></article>`;
}
function chartPanel(data){
 const points=data.trend.points.map(p=>({...p,actual:p.actual==null?null:Number(p.actual),expected:p.expected==null?null:Number(p.expected)}));
 return `<article class="panel bm-chart-panel"><div class="panel-head"><h2>${icon('chart')}实际与同进度理论毛利趋势</h2><div class="bm-chart-legend"><span><i></i>实际生产毛利</span><span><i class="theory"></i>同进度理论</span></div></div><div class="bm-chart-unit">单位：元 · 累计从各订单开工日计算</div><div class="chart-wrap bm-trend">${renderTrend(points,{expectedColor:'#22b58d',fillArea:true}).replaceAll('data-day=','data-bm-day=')}</div><div class="bm-chart-caption">共同可比 <strong>${data.trend.includedCount}</strong> 笔 · 排除 ${data.trend.excludedCount} 笔 <span>点击日期联动全页</span></div></article>`;
}
function donut(buckets,total){
 let offset=0;const circumference=408.407;
 return `<svg viewBox="0 0 180 180" class="bm-donut" role="img" aria-label="当日生产毛利率分布，共 ${total} 笔"><circle cx="90" cy="90" r="65" fill="none" stroke="#edf3fa" stroke-width="31"/><g class="bm-donut-ring" style="transform-origin:90px 90px;transform-box:view-box">${buckets.map(b=>{const length=total?b.count/total*circumference:0,start=offset;offset+=length;return `<circle class="bm-donut-segment" cx="90" cy="90" r="65" fill="none" stroke="${colors[b.key]}" stroke-width="31" stroke-dasharray="${length} ${circumference-length}" stroke-dashoffset="${-start}" transform="rotate(-90 90 90)"/>`;}).join('')}</g><text x="90" y="88" text-anchor="middle" class="bm-donut-total">${total}</text><text x="90" y="110" text-anchor="middle" class="bm-donut-label">监测订单总数</text></svg>`;
}
function distributionPanel(data,state,distribution,total){
 return `<article class="panel bm-distribution-panel"><div class="panel-head"><h2>${icon('layers')}当日生产毛利率分布</h2></div><div class="bm-distribution">${donut(distribution,total)}<div class="bm-bucket-list">${distribution.map(b=>`<button class="bm-bucket ${state.filter===b.key?'active':''}" data-bm-bucket="${b.key}" aria-pressed="${state.filter===b.key}"><i style="background:${colors[b.key]}"></i><span>${bucketNames[b.key]}<small>${esc(b.label)}</small></span><strong>${b.count}<em> 笔</em></strong><small>${rate(b.ratio)}</small></button>`).join('')}</div></div><p class="bm-caption">点击分类仅筛选全部订单；分布不代表相对预期风险等级。</p></article>`;
}
function attentionPanel(data,selected){
 const items=data.attention.map(id=>data.orders.find(row=>row.order.id===id));
 return `<article class="panel bm-focus-panel"><div class="panel-head"><h2>${icon('grid')}今日重点核查 <span class="bm-top-label">TOP 5</span></h2><button class="link" id="bm-see-all">查看全部 ${icon('chevron')}</button></div><p class="bm-panel-description">按当日毛利率较昨日的下降幅度排序。变化单位为“百分点”：20.00% 降至 19.95%，即下降 0.05 个百分点。</p>${items.length?`<div class="table-wrap bm-focus-table"><table><thead><tr><th>排名</th><th>订单 / 产品</th><th>当日毛利率</th><th>较昨日变化</th></tr></thead><tbody>${items.map((row,index)=>`<tr class="${selected?.order.id===row.order.id?'is-selected':''}"><td><span class="bm-rank ${index<3?'bm-rank-first':''}">${index+1}</span></td><td><button class="link bm-focus-order" data-bm-select="${esc(row.order.id)}">${esc(row.order.id)}</button><small>${esc(row.order.product)}</small>${row.loss?'<span class="bm-loss-tag">累计亏损</span>':''}</td><td>${rate(row.daily?.actual.margin)}</td><td class="negative"><span data-i18n-label>${change(row.comparison.marginChangePp)}</span></td></tr>`).join('')}</tbody></table></div>`:empty('暂无可确认的今日恶化订单','累计偏离和缺项保留在其他提醒中。')}</article>`;
}
function advicePanel(selected){
 const symbols={MATERIAL_PRICE:'wallet',MATERIAL_USAGE:'layers',LABOR:'file',MANUFACTURING:'chart',SUPPLEMENT_LINK:'layers',DATA_CHECK:'info'};
 const attr=selected?.attribution;
 const signedAmount=d=>d.amount==null?'待补齐':`${Number(d.amount)<0?'−¥':'¥'}${fmt(Math.abs(Number(d.amount)))}`;
 const attrHtml=attr?.state==='gap'?`<div class="bm-attr-summary"><strong>累计差距原因</strong>${attr.attributionComplete===false||!attr.increases?.length?'<span>归因待补齐</span>':attr.increases.map(d=>`<span>${esc(d.label)} ${signedAmount(d)}${d.shareOfIncrease!=null?` · ${(Number(d.shareOfIncrease)*100).toFixed(0)}%`:''}</span>`).join('')}</div>`:attr?.operating?.loss?`<div class="bm-attr-summary"><strong>经营利润为负</strong><span>生产毛利未少赚，核查管理、销售、财务费用</span></div>`:'';
 return `<article class="panel bm-advice-panel" id="bm-advice-panel"><div class="panel-head"><h2><span class="bm-advice-heading">${icon('spark')}</span>经营核查建议</h2></div><div class="bm-advice-context">${selected?`<span class="bm-selected-chip">${esc(selected.order.id)}</span>`:'选择一笔订单，查看对应的核查建议'}</div>${attrHtml}<div class="bm-advice-list">${selected?selected.recommendations.length?selected.recommendations.map((r,index)=>`<article class="bm-advice bm-advice-${index}"><div class="bm-advice-icon">${icon(symbols[r.ruleId]??'info')}</div><div class="bm-advice-copy"><strong>${esc(adviceText(r.change))}</strong><p>${esc(adviceText(r.advice))}</p></div><button class="button primary bm-evidence-button" data-bm-evidence="${esc(selected.snapshotId)}">查看依据</button></article>`).join(''):empty('暂无足够依据生成具体建议','可在单订单页面核查原始数据。'):empty('请选择需要核查的订单','点击重点订单或全部订单中的“建议”。')}</div></article>`;
}
const ordersPanel=renderOrdersTable;

export function renderMonitorDashboard({data,rows,page,pages,selected,state,loading,error,detailMarkup='',hiddenNotStarted=0,hiddenCompleted=0,distribution=data?.distribution,distributionTotal=data?.coverage.total}){
 const scope=data?.scope,coverage=data?.coverage;
 const toolbar=renderScopeFilters(data,state,loading);
 const status=`<div class="bm-status ${error?'has-error':''}" role="status" aria-live="polite">${loading?`${icon('clock')}正在更新监测，下方保留上次成功的范围${scope?'（截至 '+esc(scope.asOf)+'）':''}。`:error?`${icon('alert')}<strong>查询失败：${esc(error)}</strong>；已有数据仍属于旧范围${scope?'（截至 '+esc(scope.asOf)+'）':''}。`:data?`${icon('check')}截至 ${esc(scope.asOf)} · ${scope.baselineMode==='ideal'?'理想上界':'含损耗预算'} · 全页按同一批已保存资料计算`:'正在读取本地订单'}</div>`;
 if(!data||data.coverage.unfilteredTotal===0)return toolbar+status+(loading?'<div class="bm-loading" aria-label="正在载入"><div></div><div></div><div></div><div></div></div>':error?'':`<section class="panel bm-empty">${empty('还没有已导入订单','导入标准成本表与每日表，即可开始监测。')}<a class="button primary" href="#import">导入标准 Excel</a></section>`);
 const periodComparable=coverage.periodComparable??coverage.comparable;
 const cards=`<section class="cards bm-kpis" aria-label="订单利润概况">${kpi('累计实际生产毛利',fmt(data.summary.actualGross),'元',`同一可比集合 ${periodComparable} 笔 · 所选区间`,'actual','file')}${kpi('同进度理论生产毛利',fmt(data.summary.expectedGross),'元','相同合格产量 · 同一基线口径 · 所选区间','theory','layers')}${kpi('累计比理论少赚',fmt(data.summary.gap),'元','正值少赚 · 负值表示高于理论 · 所选区间',data.summary.gap!=null&&Number(data.summary.gap)>0?'gap':'gain','chart')}${kpi('今日表现恶化',String(data.summary.deteriorated),'笔',`前后日可比 ${coverage.dayComparable} 笔`,'alert','alert')}</section>`;
 const reminders=data.reminders.length?`<details class="bm-reminders"><summary>${icon('alert')}其他提醒 <b>${data.reminders.length}</b> 笔：累计偏离、亏损或待补齐<span>独立于今日恶化排名 ${icon('chevron')}</span></summary><div class="bm-coverage-body">${data.reminders.map(r=>`<p><button class="link" data-bm-select="${esc(r.orderId)}">${esc(r.orderId)}</button>　${[r.loss?'累计亏损':'',r.cumulativeDeviation?'累计低于理论':'',r.incomplete?'资料待补齐':''].filter(Boolean).join(' · ')}</p>`).join('')}<p>风险采用同进度毛利率相对下降规则；资料不足和缺少基线独立显示。</p></div></details>`:'';
 return `${toolbar}${status}${cards}${data.summary.actualGross==null?`<p class="bm-notice">${coverage.total===0?`已导入 ${coverage.unfilteredTotal} 笔订单，当前筛选结果为 0 笔。请切换为“全部状态”或重置筛选。`:'当前订单暂无完整可比数据，请在订单分析中查看待补齐资料；金额未知，不按零处理。'}</p>`:''}<section class="bm-grid bm-charts">${chartPanel(data)}${distributionPanel(data,state,distribution,distributionTotal)}</section><section class="bm-grid bm-attention">${attentionPanel(data,selected)}${advicePanel(selected)}</section>${reminders}${ordersPanel(data,rows,page,pages,state,hiddenNotStarted,hiddenCompleted)}${detailMarkup}<div class="chart-tip" id="bm-chart-tip" hidden></div>`;
}
