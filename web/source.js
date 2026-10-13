'use strict';
function renderExecutive(data){
  const a=data?.source_analysis,root=document.getElementById('decision-view');
  if(!a?.profit_layers){root.innerHTML=`<div class="panel empty"><h2>暂无可用的订单决策概览</h2><p>导入成本工作簿后展示利润、成本与风险。已有标准订单可在详细数据页查看。</p><button class="secondary" data-detail-target="orders">查看详细数据</button></div>`;return;}
  const m=a.metrics,v=a.profit_layers,r=a.trust_review;
  const wan=x=>x===null||x===undefined?'待补':(Number(x)/10000).toFixed(2);
  const rate=x=>x===null||x===undefined?'待补':(Number(x)*100).toFixed(2)+'%';
  const metric=(label,value,note,highlight=false)=>`<article class="executive-metric ${highlight?'executive-highlight':''}"><span>${label}</span><strong>${wan(value)}${value===null||value===undefined?'':'<small>万元</small>'}</strong><p>${note}</p></article>`;
  const checks=r?.checks||[],differences=checks.filter(x=>x.status==='difference');
  const focusCodes=['NET_SCOPE','TAX','EXTERNAL','ASSET','DEVELOPMENT'];
  const unresolved=focusCodes.map(code=>checks.find(x=>x.code===code&&x.status==='pending')).filter(Boolean);
  const riskText=x=>x.code==='EXTERNAL'?`约 ${wan(x.amount)} 万元费用沿用表内保存费率，已计入试算；原始费用总额和分摊依据后续核验。`:x.code==='TAX'?`报价税口径与收入确认依据尚待核实，涉及本单约 ${wan(m.revenue)} 万元收入。`:x.evidence;
  const riskCard=x=>`<article class="executive-risk review-${x.status}"><span class="review-state">${x.status==='difference'?'发现差异':'待核验'}</span><h3>${esc(x.title)}</h3><p>${esc(riskText(x))}</p><button class="executive-link" data-detail-target="trust-review">查看依据与处理要求 ↗</button></article>`;
  const margins=m.management_reference_margin===null?null:Number(m.management_reference_margin);
  const sensitivity=v.cumulative_cost!==null&&v.operating_net_profit!==null&&Number(v.operating_net_profit)>0?Number(v.cumulative_cost)*.01/Number(v.operating_net_profit):null;
  const netAvailable=v.operating_net_profit!==null;
  const development=a.cost_rows.find(x=>x.cell==='E19'),wages=a.cost_rows.find(x=>x.cell==='E17');
  const emphasis=netAvailable&&Number(v.operating_net_profit)<0?'当前试算亏损，先复核成本与报价，再决定是否追加。':netAvailable?'当前试算有利润，追加订单前先复核报价与成本边界。':'当前费用不完整，先补齐关键成本再判断订单收益。';
  root.innerHTML=`<section id="executive-overview" class="executive-scope"><div><span class="eyebrow">当前订单经营概览</span><h2>${esc(a.product)} · ${Number(m.quantity).toLocaleString('zh-CN')} 双</h2><p>生产期间 ${esc(a.production.start)} — ${esc(a.production.end)} · 当前仅展示本单，不代表公司全部经营情况</p></div><span class="review-state review-pending">参考试算 · 尚待核实</span></section>
  <div class="executive-metrics">${metric('折后收入',m.revenue,'当前订单整单收入试算')}${metric('累计已列成本',v.cumulative_cost,`生产 ${wan(v.production_cost)} 万 + 经营费用 ${wan(v.operating_expense)} 万`)}${metric('生产毛利',v.production_profit,`毛利率 ${rate(m.production_margin)}`)}${metric('经营净利 · 试算',v.operating_net_profit,`净利率 ${rate(m.management_reference_margin)}`,true)}</div>
  <section id="executive-costs"><div class="executive-section-head"><h2>成本花在哪里，利润剩多少</h2><button class="executive-link" data-detail-target="profit-layers">查看精确金额 ↗</button></div><div class="profit-pie-grid">
  ${renderProfitPie('生产阶段',m.revenue,[['材料成本',m.material_total,'#476c9b'],['人工及加工',m.processing_total,'#bd8c49'],['生产毛利',v.production_profit,'#286b50']],true)}
  ${renderProfitPie('经营阶段',m.revenue,[['生产成本',v.production_cost,'#476c9b'],['管理费用',v.management_expense,'#bd8c49'],['销售费用',v.sales_expense,'#9d7aa3'],['经营净利试算',v.operating_net_profit,'#286b50']],true)}
  </div><p class="chart-note">两图均以本单收入为100%，分别表示生产与经营阶段；不能跨图相加。首页金额约至0.01万元，计算及占比仍使用原始精度。费用范围尚未核实完整。</p></section>
  <section id="executive-risks"><div class="executive-section-head"><h2>可信度提醒 · 决策前先看</h2><button class="executive-link" data-detail-target="trust-review">全部审查明细 ↗</button></div><p>${differences.length} 项发现差异 · ${r?.counts.pending||0} 项待核验。待核验不等于数据错误；通过勾稽不等于业务凭证已核实。</p><div class="executive-risk-grid">${[...differences,...unresolved.slice(0,3)].map(riskCard).join('')||'<div class="panel">当前暂无已发现差异，仍需结合完整费用范围与原始凭证判断。</div>'}</div></section>
  <section id="executive-decisions"><div class="executive-section-head"><h2>订单建议决策</h2><span class="muted">基于当前试算与审查规则</span></div>
  <div class="executive-decision-lead"><span>决策提示</span><h3>${emphasis}</h3><p>${netAvailable?`本单经营净利约 ${wan(v.operating_net_profit)} 万元，净利率约 ${rate(m.management_reference_margin)}。`:''}税口径及费用范围尚待确认，当前结果不足以直接决定接单、拒单或降价。</p></div>
  <div class="executive-decision-grid"><article><span>01 · 报价与成本控制</span><h3>${margins!==null&&margins<0?'先评估亏损原因':'评估订单对成本变化的承受力'}</h3><p>${sensitivity===null?'关键费用或利润待补后，再评估报价空间。':`情景测算：收入不变、已列成本整体增加1%，将消耗约 ${(sensitivity*100).toFixed(0)}% 的当前净利。追加单前核实新数量对应的材料、加工和运费报价。此情景不是实际预测。`}</p></article>
  <article><span>02 · 优先核查大额开销</span><h3>材料、工资及开发费用优先复核</h3><p>材料约 ${wan(m.material_total)} 万元，生产工资约 ${wan(wages?.amount)} 万元（已含在加工费内），开发费用约 ${wan(development?.amount)} 万元。确认耗用、工资分摊及开发费用应由本单承担的范围，再评估可优化空间。</p></article>
  <article><span>03 · 关闭数量差异</span><h3>${differences.some(x=>x.code==='REPLENISHMENT')?'解释不良与补单差额后再调整成本':'持续核对生产、补料与交付数量'}</h3><p>${differences.find(x=>x.code==='REPLENISHMENT')?esc(differences.find(x=>x.code==='REPLENISHMENT').evidence):'当前不良与补单未发现数量差异。'}核对返工、回收及补料记录，确认是否存在未归集成本，不能把差额直接当作损失。</p></article></div>
  <button class="secondary" data-detail-target="trust-review">进入详细数据，核查决策依据 →</button></section>`;
}

function renderSource(analysis,rows){
  const panel=document.getElementById('source-analysis');
  panel.hidden=!analysis||!rows.some(r=>r.order_id===analysis.order_id);
  if(panel.hidden)return;
  const m=analysis.metrics,p=analysis.production;
  const cards=[['折后收入试算','revenue'],['生产毛利 · 试算','production_profit'],['经营净利 · 试算','management_reference_profit'],['单位经营净利试算 · 元/双','unit_management_reference_profit']];
  const metrics=[['订单数量',m.quantity+' 双'],['原报价',money(m.list_unit_price)+' 元/双'],['每双折扣',money(m.discount_per_pair)+' 元/双'],['折后价格',money(m.net_unit_price)+' 元/双'],
    ['材料费用',money(m.material_total)+' 元'],['加工费用',money(m.processing_total)+' 元'],['行政费用',money(m.administrative_total)+' 元'],
    ['生产毛利率试算',percent(m.production_margin)],['扣行政费用后参考利润率',percent(m.management_reference_margin)]];
  panel.innerHTML=`<div class="panel-head"><div><h2>${esc(analysis.product)} · 成本与利润独立试算</h2><p>${esc(analysis.basis)}</p></div><span class="badge estimated">待核验试算</span></div>
  <div class="notice">电费、天然气费、水费先按表内单位成本 × 订单数量参与试算，原始凭证后续核验，不阻止当前参考利润计算。税口径仍未确认；${analysis.external_links.length} 项外链费率沿用文件保存值。</div>
  <div class="metrics source-metrics">${cards.map(([label,key])=>`<article class="metric"><div>${label}</div><strong>${money(m[key])}</strong><small>${key==='unit_management_reference_profit'?'保留六位小数，不能用显示值反推总额':'单位：元 · 由成本明细与数量计算'}</small></article>`).join('')}</div>
  <div class="source-facts">${metrics.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
  ${renderProfitLayers(analysis)}
  ${renderTrustReview(analysis.trust_review)}
  ${renderCalculationEvidence(analysis)}
  <h2 class="source-heading">生产与补单核对</h2><p>生产日期 ${esc(p.start)} 至 ${esc(p.end)}。总生产 ${esc(p.gross_quantity)} 双，不良 ${esc(p.defect_quantity)} 双，合格 ${esc(p.qualified_quantity)} 双。</p>
  <div class="table-scroll"><table><thead><tr><th>码号</th><th>生产数量</th><th>不良数量</th><th>补单材料数量</th><th>不良−补单</th></tr></thead><tbody>${p.sizes.map(x=>`<tr><td>${esc(x.size)}</td><td>${esc(x.produced)}</td><td>${esc(x.defects)}</td><td>${esc(x.replenishment)}</td><td class="${Number(x.difference)!==0?'negative':''}">${esc(x.difference)}</td></tr>`).join('')}</tbody></table></div>
  <p class="detail-missing">不良 ${esc(p.defect_quantity)} 双，补单表 ${esc(p.replenishment_quantity)} 双，差额 ${esc(p.difference)} 双。不自动补增材料，也不推断为损耗率。</p>
  <details class="source-details"><summary>查看材料重量与金额</summary><div class="table-scroll"><table><thead><tr><th>工作表</th><th>数量/双</th><th>材料重量/kg</th><th>配方均价/元每kg</th><th>金额/元</th></tr></thead><tbody>${analysis.materials.map(x=>`<tr><td>${esc(x.sheet)}</td><td>${esc(x.quantity)}</td><td>${esc(x.weight)}</td><td>${Number(x.price_per_kg).toFixed(6)}</td><td>${money(x.amount)}</td></tr>`).join('')}</tbody></table></div><p class="chart-note">总材料金额按原表未舍入值汇总后保留分位；分表显示值相加可能相差0.01元。</p></details>
  <details class="source-details"><summary>查看加工与行政费用单价和来源</summary><div class="table-scroll"><table><thead><tr><th>费用</th><th>分组</th><th>源单元格</th><th>元/双</th><th>总额/元</th><th>数据依据</th></tr></thead><tbody>${analysis.cost_rows.map(x=>`<tr><td>${esc(x.label)}</td><td>${esc(x.group)}</td><td>${esc(x.cell)}</td><td>${x.unit_rate===null?'待补':Number(x.unit_rate).toFixed(6)}</td><td>${money(x.amount)}</td><td>${esc(x.method)}</td></tr>`).join('')}</tbody></table></div></details>
  <details class="source-details"><summary>查看生产日报（${p.days.length} 天）</summary><div class="table-scroll"><table><thead><tr><th>日期</th><th>生产/双</th><th>不良/双</th><th>合格/双</th></tr></thead><tbody>${p.days.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.produced)}</td><td>${esc(x.defects)}</td><td>${esc(x.qualified)}</td></tr>`).join('')}</tbody></table></div></details>
  <h2 class="source-heading">来源说明与后续核验</h2><p>下列来源提示不表示已知费用未计入。已有表内费率均用于试算；尚缺的是原始凭证或分摊依据。</p><ul class="source-warnings">${analysis.warnings.map(x=>`<li>${esc(x.message)}</li>`).join('')}</ul>`;
}

function renderProfitLayers(a){
  const v=a.profit_layers;if(!v)return '';
  const m=a.metrics;
  function costRows(group){return a.cost_rows.filter(x=>x.group===group).map(x=>`<tr><td>${esc(x.label)}</td><td>${x.amount===null?'待补':money(x.amount)}</td><td>${esc(x.cell)} · ${esc(x.method)}</td></tr>`).join('');}
  return `<h2 class="source-heading" id="profit-layers">生产毛利与经营净利</h2><p>${esc(v.classification)} 经营净利暂按已列费用试算，财务费用、税费及其他适用项目仍需确认。</p>
  <div class="profit-layer-grid">
  <article class="profit-stage"><h3>① 生产毛利</h3><p>收入 − 生产成本</p><strong>${money(v.production_profit)} 元</strong><p>毛利率 ${percent(m.production_margin)}</p><dl><dt>收入</dt><dd>${money(m.revenue)} 元</dd><dt>材料费</dt><dd>${money(m.material_total)} 元</dd><dt>人工及加工费</dt><dd>${money(m.processing_total)} 元</dd><dt>生产成本合计</dt><dd>${money(v.production_cost)} 元</dd></dl><details class="source-details"><summary>展开生产成本开销</summary><div class="table-scroll"><table><thead><tr><th>费用</th><th>金额 / 元</th><th>来源</th></tr></thead><tbody><tr><td>材料成本</td><td>${money(m.material_total)}</td><td>原单及补单配方 × SOP重量 × 数量</td></tr>${costRows('加工成本')}</tbody></table></div></details></article>
  <article class="profit-stage"><h3>② 经营净利 · 参考试算</h3><p>生产毛利 − 经营费用</p><strong>${money(v.operating_net_profit)} 元</strong><p>经营净利率试算 ${percent(m.management_reference_margin)}</p><dl><dt>生产毛利</dt><dd>${money(v.production_profit)} 元</dd><dt>管理费用</dt><dd>${money(v.management_expense)} 元</dd><dt>销售费用（运费）</dt><dd>${money(v.sales_expense)} 元</dd><dt>新增经营费用</dt><dd>${money(v.operating_expense)} 元</dd><dt>累计已列成本</dt><dd>${money(v.cumulative_cost)} 元</dd></dl><details class="source-details"><summary>展开经营费用开销</summary><div class="table-scroll"><table><thead><tr><th>费用</th><th>金额 / 元</th><th>来源</th></tr></thead><tbody>${costRows('行政成本')}</tbody></table></div></details></article>
  </div>
  <div class="profit-pie-grid">
  ${renderProfitPie('生产阶段 · 收入如何分配',m.revenue,[['材料成本',m.material_total,'#476c9b'],['人工及加工成本',m.processing_total,'#bd8c49'],['生产毛利',v.production_profit,'#286b50']])}
  ${renderProfitPie('经营阶段 · 收入最终去向',m.revenue,[['生产成本',v.production_cost,'#476c9b'],['管理费用',v.management_expense,'#bd8c49'],['销售费用（运费）',v.sales_expense,'#9d7aa3'],['经营净利试算',v.operating_net_profit,'#286b50']])}
  </div><p class="chart-note">两张图均以本单折后收入为100%，分别展示生产和经营阶段，不能把两张图的金额相加。生产工资已包含在人工及加工费中，不能再次扣除。逐项舍入与汇总舍入可能有分位尾差。经营净利试算的费用范围尚未确认完整。</p>`;
}

function renderProfitPie(title,revenue,segments,compact=false){
  const display=compact?value=>(value===null||value===undefined?'待补':(Number(value)/10000).toFixed(2)+' 万元'):value=>money(value)+' 元';
  const present=revenue!==null&&revenue!==undefined&&segments.every(([,value])=>value!==null&&value!==undefined);
  const total=Number(revenue),sum=segments.reduce((s,[,value])=>s+Number(value),0);
  const valid=present&&Number.isFinite(total)&&total>0&&segments.every(([,value])=>Number.isFinite(Number(value))&&Number(value)>=0)&&Math.abs(sum-total)<0.02;
  let offset=0;
  const arcs=valid?segments.map(([label,value,color])=>{const share=Number(value)/sum*100,start=offset;offset+=share;return `<circle cx="110" cy="110" r="82" pathLength="100" fill="none" stroke="${color}" stroke-width="30" stroke-dasharray="${share} ${100-share}" stroke-dashoffset="${-start}" transform="rotate(-90 110 110)"><title>${esc(label)}：${display(value)}，占收入 ${percent(Number(value)/total)}</title></circle>`;}).join(''):'';
  const reason=!present?'费用或利润数据待补，暂不生成占比图。':segments.some(([,value])=>Number(value)<0)?'当前包含负值，饼图无法准确表达，改为列示金额。':total<=0?'收入不大于零，暂不计算收入占比。':'金额暂未勾稽平衡，暂不生成占比图。';
  return `<article class="profit-pie-card"><h3>${esc(title)}</h3><p>金额与占比均为当前参考试算</p><div class="profit-pie-body">
  ${valid?`<svg class="profit-donut" viewBox="0 0 220 220" role="img" aria-label="${esc(title)}，各项金额及占比见图例"><circle cx="110" cy="110" r="82" fill="none" stroke="#edf1ec" stroke-width="30"/>${arcs}<text x="110" y="101" text-anchor="middle" class="donut-caption">本单折后收入${compact?'':' / 元'}</text><text x="110" y="126" text-anchor="middle" class="donut-total">${compact?display(revenue):money(revenue)}</text></svg>`:`<div class="profit-pie-unavailable">${reason}</div>`}
  <ul class="profit-pie-legend">${segments.map(([label,value,color])=>`<li><span class="pie-key" style="background:${color}"></span><div><span>${esc(label)}</span><strong>${value===null||value===undefined?'待补':display(value)}</strong></div><b>${valid?(compact?(Number(value)/total*100).toFixed(2)+'%':percent(Number(value)/total)):'—'}</b></li>`).join('')}</ul></div></article>`;
}

function renderTrustReview(r){
  if(!r)return '';
  const labels={passed:'核对通过',difference:'发现差异',pending:'待核验'};
  const categories=r.categories||[{id:'consistency',label:'数据一致性异常',counts:r.counts}];
  const priority={difference:0,pending:1,passed:2};
  const ordered=[...r.checks].sort((a,b)=>priority[a.status]-priority[b.status]);
  function card(x){return `<article class="review-item review-${x.status}"><div class="review-item-head"><h4>${esc(x.title)}</h4><span class="review-state">${esc(x.judgment||labels[x.status])}</span></div><p>${esc(x.evidence)}</p>${x.amount===null?'':`<p class="review-exposure">涉及核验范围 ${money(x.amount)} 元</p>`}<p class="review-next">下一步：${esc(x.needed)}</p></article>`;}
  const problems=ordered.filter(x=>x.status==='difference');
  return `<h2 class="source-heading" id="trust-review">数据可信化审查</h2><p>${esc(r.scope)}</p>
  <div class="trust-summary">${['difference','pending','passed'].map(key=>`<span class="review-state review-${key}">${labels[key]} ${r.counts[key]||0} 项</span>`).join('')}</div>
  <p><b>${esc(r.conclusion)}</b></p>
  ${problems.length?`<div class="review-priority"><h3>优先处理 · 已发现差异</h3>${problems.map(card).join('')}</div>`:''}
  <div class="review-category-grid">${categories.map(c=>`<a class="review-category ${(c.counts.difference||0)>0?'review-difference':(c.counts.pending||0)>0?'review-pending':'review-passed'}" href="#review-${esc(c.id)}"><b>${esc(c.label)}</b><span>差异 ${c.counts.difference||0} · 待核验 ${c.counts.pending||0} · 通过 ${c.counts.passed||0}</span></a>`).join('')}</div>
  ${categories.map(c=>{const items=ordered.filter(x=>(x.category||'consistency')===c.id),unresolved=items.filter(x=>x.status!=='passed'),passed=items.filter(x=>x.status==='passed');return `<section class="review-group" id="review-${esc(c.id)}"><h3>${esc(c.label)}</h3>${unresolved.map(card).join('')}${passed.length?`<details class="review-passed-list"><summary>已核对通过 ${passed.length} 项 · 展开查看</summary>${passed.map(card).join('')}</details>`:''}</section>`;}).join('')}
  <p class="chart-note">红色：已发现差异；橙色：待核验或暂无法判断；绿色：本项核对通过。${esc(r.note)}</p>`;
}

function renderCalculationEvidence(a){
  const m=a.metrics, audit=a.audit;
  const steps=[
    ['折后收入',`（${money(m.list_unit_price)} − ${money(m.discount_per_pair)}）元/双 × ${esc(m.quantity)} 双`,m.revenue],
    ['材料费用','各配方均价 = Σ（原料单价 × 配方用量）÷ Σ配方用量；材料费 = Σ（分码数量 × SOP重量 × 对应配方均价）',m.material_total],
    ['加工费用',`逐项加工费率 × ${esc(m.quantity)} 双，再汇总（含生产工资）`,m.processing_total],
    ['毛利润',`${money(m.revenue)} − ${money(m.material_total)} − ${money(m.processing_total)}`,m.production_profit],
    ['行政费用',`逐项行政费率 × ${esc(m.quantity)} 双，再汇总（含运费）`,m.administrative_total],
    ['扣行政费用后参考利润',`${money(m.production_profit)} − ${money(m.administrative_total)}`,m.management_reference_profit]
  ];
  const ranked=[{label:'材料合计',amount:m.material_total,method:'配方与SOP数量推算'},...a.cost_rows].filter(x=>x.amount!==null).sort((x,y)=>Number(y.amount)-Number(x.amount));
  const total=ranked.reduce((s,x)=>s+Number(x.amount),0),max=Math.max(1,...ranked.map(x=>Math.abs(Number(x.amount))));
  const missing=[
    ['后续核验','电费及加工费原始工作簿','当前先用表内成本计算；后续补费用总额、期间、全部分摊对象及分母','核验外链来源和分摊；不阻止当前参考试算'],
    ['优先确认','报价税口径与折扣、收入依据','12.8 元/双是否含税、适用税率；5%折扣是否另扣；订单、出货/验收数量和退货记录','把整单收入试算转为同口径收入'],
    ['待补明细','材料采购及领补退料记录','采购单价和税口径、实领、补领、退料、回收料、在制品；对应订单/日期/物料','把SOP理论材料费核实为实际耗用成本'],
    ['待补依据','工资及制造费用分摊表','工段计件单价与应计薪数量，或实际工资分摊依据；各期费用总额、全期工时、订单工时','核验人工与制造费用，跨月按期归集'],
    ['待确认范围','行政、开发、资产与其他费用','开发成本适用订单及分摊期限；机器折旧与固定资产摊分的资产清单；财务费用、税费及其他项目是否适用','核对重复归集和遗漏，明确最终利润范围'],
    ['待解释差额','不良与补单记录','提供分码报废、返工、回收、补料记录，解释不良数与补单数之差','确认是否需追加材料成本'],
    ['待补标识','订单编号、客户、成本阶段','正式订单号、客户；成本对应生产阶段。阶段分析不使用时可不提供阶段字段','建立订单追溯及阶段利润']
  ];
  return `<h2 class="source-heading">利润是怎样算出来的</h2>
    <p>${audit?'模型先计算明细，再读取表内利润保存值进行对比。修改或删除表内利润及汇总单元格，不会改变模型的计算结果。':'当前快照尚无独立计算审计记录，请重新导入原始工作簿。'}</p>
    <div class="table-scroll"><table class="evidence-table"><thead><tr><th>步骤</th><th>计算依据</th><th>结果 / 元</th></tr></thead><tbody>${steps.map(([name,formula,value])=>`<tr><td>${esc(name)}</td><td>${formula}</td><td>${value===null?'数据待补':money(value)}</td></tr>`).join('')}</tbody></table></div>
    <p class="chart-note">内部用高精度数值计算，汇总后保留两位小数。单位费率属于来源数据：外链保存费率仍需原表验证。理论用料与实耗可能不同，参考利润尚不代表已核实净利润。</p>
    <details class="source-details"><summary>展开材料计算输入：配方、重量与数量</summary>${a.materials.map(x=>`<h3>${esc(x.sheet)}</h3><div class="table-scroll"><table><thead><tr><th>物料</th><th>单价 / 元每kg</th><th>配方用量</th><th>来源</th></tr></thead><tbody>${(x.recipe||[]).map(r=>`<tr><td>${esc(r.material)}</td><td>${esc(r.unit_price)}</td><td>${esc(r.usage)}</td><td>${esc(r.source)}</td></tr>`).join('')}</tbody></table><table><thead><tr><th>码号</th><th>数量 / 双</th><th>SOP重量 / kg每双</th><th>总重量 / kg</th></tr></thead><tbody>${x.sizes.map(r=>`<tr><td>${esc(r.size)}</td><td>${esc(r.quantity)}</td><td>${esc(r.weight_per_pair)}</td><td>${esc(r.weight_total)}</td></tr>`).join('')}</tbody></table></div>`).join('')}</details>
    <h2 class="source-heading">费用从大到小排列</h2><p>占比按已列费用明细合计计算；未知费用未填零。金额大不等于浪费，应结合分摊范围核验。</p>
    <div class="expense-ranking">${ranked.map(x=>`<div class="expense-row"><span>${esc(x.label)}<small>${esc(x.method)}</small></span><div class="track"><div class="fill" style="width:${Math.abs(Number(x.amount))/max*100}%"></div></div><strong>${money(x.amount)}<small>${total>0?percent(Number(x.amount)/total):'占比不适用'}</small></strong></div>`).join('')}</div>
    <h2 class="source-heading">计算完成后的对照</h2><p>对照对象是工作簿保存的利润，不代表已审计的真实利润。差额为模型减表内值，按分比较；两者相同只能证明本次算术一致。</p>
    <div class="table-scroll"><table><thead><tr><th>指标</th><th>模型独立计算 / 元</th><th>表内保存值折算总额 / 元</th><th>差额 / 元</th></tr></thead><tbody>${(audit?.comparisons||[]).map(x=>`<tr><td>${esc(x.label)}</td><td>${money(x.calculated)}</td><td>${x.reference===null?'无可用保存值':money(x.reference)}</td><td>${x.difference===null?'无法对照':money(x.difference)}</td></tr>`).join('')}</tbody></table></div>
    <details class="source-details"><summary>查看计算隔离记录与源文件指纹</summary><p>${esc(audit?.sequence||'待重新导入')}<br>源文件 SHA-256：<span class="source-hash">${esc(a.source_hash)}</span><br>不作为计算输入的单元格：${esc((audit?.excluded_cells||[]).join('、'))}</p></details>
    <h2 class="source-heading" id="source-missing">还需要哪些材料</h2><div class="table-scroll"><table class="evidence-table"><thead><tr><th>状态</th><th>资料</th><th>具体需要什么</th><th>用于解决什么</th></tr></thead><tbody>${missing.map(row=>`<tr>${row.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="detail-missing">确实没有发生的费用，请明确注明“本单不适用”或“已确认金额为0”；空白表示未知。原表可保持原格式，并附上订单和期间对应关系。</p>`;
}
