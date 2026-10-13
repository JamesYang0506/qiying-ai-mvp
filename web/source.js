'use strict';
function renderSource(analysis,rows){
  const panel=document.getElementById('source-analysis');
  panel.hidden=!analysis||!rows.some(r=>r.order_id===analysis.order_id);
  if(panel.hidden)return;
  const m=analysis.metrics,p=analysis.production;
  const cards=[['源表收入','revenue'],['源表生产毛利试算','production_profit'],['扣行政费用后参考利润','management_reference_profit'],['参考单位利润 · 元/双','unit_management_reference_profit']];
  const metrics=[['订单数量',m.quantity+' 双'],['原报价',money(m.list_unit_price)+' 元/双'],['每双折扣',money(m.discount_per_pair)+' 元/双'],['折后价格',money(m.net_unit_price)+' 元/双'],
    ['材料费用',money(m.material_total)+' 元'],['加工费用',money(m.processing_total)+' 元'],['行政费用',money(m.administrative_total)+' 元'],
    ['生产毛利率试算',percent(m.production_margin)],['扣行政费用后参考利润率',percent(m.management_reference_margin)]];
  panel.innerHTML=`<div class="panel-head"><div><h2>${esc(analysis.product)} · 源表复算</h2><p>${esc(analysis.basis)}</p></div><span class="badge estimated">待核验试算</span></div>
  <div class="notice">税口径未确认，${analysis.external_links.length} 项外链费率仅有保存值；以下为源表计算结果，正式模型结果见下方，尚未通过完整口径核验。</div>
  <div class="metrics source-metrics">${cards.map(([label,key])=>`<article class="metric"><div>${label}</div><strong>${money(m[key])}</strong><small>${key==='unit_management_reference_profit'?'保留六位小数，不能用0.36元反推总额':'单位：元 · 按源表公式复算'}</small></article>`).join('')}</div>
  <div class="source-facts">${metrics.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
  <h2 class="source-heading">生产与补单核对</h2><p>生产日期 ${esc(p.start)} 至 ${esc(p.end)}。总生产 ${esc(p.gross_quantity)} 双，不良 ${esc(p.defect_quantity)} 双，合格 ${esc(p.qualified_quantity)} 双。</p>
  <div class="table-scroll"><table><thead><tr><th>码号</th><th>生产数量</th><th>不良数量</th><th>补单材料数量</th><th>不良−补单</th></tr></thead><tbody>${p.sizes.map(x=>`<tr><td>${esc(x.size)}</td><td>${esc(x.produced)}</td><td>${esc(x.defects)}</td><td>${esc(x.replenishment)}</td><td class="${Number(x.difference)!==0?'negative':''}">${esc(x.difference)}</td></tr>`).join('')}</tbody></table></div>
  <p class="detail-missing">不良 ${esc(p.defect_quantity)} 双，补单表 ${esc(p.replenishment_quantity)} 双，差额 ${esc(p.difference)} 双。不自动补增材料，也不推断为损耗率。</p>
  <details class="source-details"><summary>查看材料重量与金额</summary><div class="table-scroll"><table><thead><tr><th>工作表</th><th>数量/双</th><th>材料重量/kg</th><th>配方均价/元每kg</th><th>金额/元</th></tr></thead><tbody>${analysis.materials.map(x=>`<tr><td>${esc(x.sheet)}</td><td>${esc(x.quantity)}</td><td>${esc(x.weight)}</td><td>${Number(x.price_per_kg).toFixed(6)}</td><td>${money(x.amount)}</td></tr>`).join('')}</tbody></table></div><p class="chart-note">总材料金额按原表未舍入值汇总后保留分位；分表显示值相加可能相差0.01元。</p></details>
  <details class="source-details"><summary>查看加工与行政费用单价和来源</summary><div class="table-scroll"><table><thead><tr><th>费用</th><th>分组</th><th>源单元格</th><th>元/双</th><th>总额/元</th><th>数据依据</th></tr></thead><tbody>${analysis.cost_rows.map(x=>`<tr><td>${esc(x.label)}</td><td>${esc(x.group)}</td><td>${esc(x.cell)}</td><td>${x.unit_rate===null?'待补':Number(x.unit_rate).toFixed(6)}</td><td>${money(x.amount)}</td><td>${esc(x.method)}</td></tr>`).join('')}</tbody></table></div></details>
  <details class="source-details"><summary>查看生产日报（${p.days.length} 天）</summary><div class="table-scroll"><table><thead><tr><th>日期</th><th>生产/双</th><th>不良/双</th><th>合格/双</th></tr></thead><tbody>${p.days.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.produced)}</td><td>${esc(x.defects)}</td><td>${esc(x.qualified)}</td></tr>`).join('')}</tbody></table></div></details>
  <h2 class="source-heading">待核验事项</h2><ul class="source-warnings">${analysis.warnings.map(x=>`<li>${esc(x.message)}</li>`).join('')}</ul>`;
}
