import {D} from './decimal.mjs';

export const DIAGNOSIS_RULE_VERSION = 'DIAG-1.0';
export const REFERENCE_RULE_VERSION = 'REF-1.0';
export const SEVERITY_RULE_VERSION = 'SEV-1.0';
export const PRIMARY_SHARE_THRESHOLD = '0.60';
export const SEVERITY_THRESHOLDS = {normalMax: '0.10', attentionMax: '0.20', keyMax: '0.30'};

const dec = v => v == null || v === '' ? null : new D(v);
const amount = (d, places = 2) => d == null ? null : d.toFixed(places);
const ratio = d => d == null ? null : d.toFixed(8);
const pp = d => d == null ? null : d.times(100).toFixed(2);

const COMPONENTS = {
  materialPrice: {
    label: '材料价格',
    kind: 'production',
    increase: '实际采购单价合计高于理论基准，增加差距。',
    offset: '实际采购单价合计低于理论基准，抵消差距。',
    suggestion: '核对采购单价、供应商报价和调价生效日期，确认是否存在未同步到理论基准的涨价。',
    evidence: '每日材料记录（净耗、单价）'
  },
  materialUsage: {
    label: '材料耗用',
    kind: 'production',
    increase: '实际材料净耗高于同进度标准，增加差距。',
    offset: '实际材料净耗低于同进度标准，抵消差距。',
    suggestion: '核对领退料、配方重量、计量口径和不良品耗料记录，确认净耗偏高的具体批次。',
    evidence: '每日材料记录、原订单配方'
  },
  labor: {
    label: '人工',
    kind: 'production',
    increase: '实际人工费用高于同进度标准，增加差距。',
    offset: '实际人工费用低于同进度标准，抵消差距。',
    suggestion: '核对工价、计件量和人工归属期间，确认人工费用偏高的具体工序。',
    evidence: '每日费用（人工）'
  },
  energy: {
    label: '能源',
    kind: 'production',
    increase: '实际能源费用高于同进度标准，增加差距。',
    offset: '实际能源费用低于同进度标准，抵消差距。',
    suggestion: '核对能源抄表、单价和分摊口径。',
    evidence: '每日费用（制造·能源）'
  },
  otherManufacturing: {
    label: '其他制造',
    kind: 'production',
    increase: '实际其他制造费用高于同进度标准，增加差距。',
    offset: '实际其他制造费用低于同进度标准，抵消差距。',
    suggestion: '核对制造费用项目、分摊口径与归属期间。',
    evidence: '每日费用（制造）'
  },
  otherProduction: {
    label: '其他生产',
    kind: 'production',
    increase: '实际其他生产费用高于同进度标准，增加差距。',
    offset: '实际其他生产费用低于同进度标准，抵消差距。',
    suggestion: '核对其他生产费用项目与归属期间。',
    evidence: '每日费用（其他生产）'
  },
  budgetAdjustment: {
    label: '预算允许损耗',
    kind: 'baseline',
    increase: '预算允许损耗按基线计提，属于对照口径调整。',
    offset: '预算允许损耗按基线计提，属于对照口径调整。',
    suggestion: null,
    evidence: '成本计算中的生产损耗与不良损耗预算'
  },
  rounding: {
    label: '舍入调整',
    kind: 'rounding',
    increase: '舍入调整，仅用于金额闭合。',
    offset: '舍入调整，仅用于金额闭合。',
    suggestion: null,
    evidence: '逐日舍入后的差值'
  }
};

function classify(component, value) {
  if (value == null) return {effect: 'unknown', fact: '该项资料待补齐，暂不判断。'};
  if (value.isZero()) return {effect: 'neutral', fact: '该项净影响为零。'};
  const meta = COMPONENTS[component];
  return {effect: value.gt(0) ? 'increase' : 'offset', fact: value.gt(0) ? meta.increase : meta.offset};
}

function referenceItem({key, label, formula, unit, actual, threshold, actualKnown, thresholdKnown, reasons, basis, source, applicability, compare}) {
  const known = actualKnown && thresholdKnown && actual != null && threshold != null;
  const breached = known ? compare(actual, threshold) : null;
  return {
    key, label, status: known ? 'known' : 'unknown', actualKnown, thresholdKnown,
    actual: ratio(actual), threshold: ratio(threshold),
    breached, gapPp: known ? pp(actual.minus(threshold).abs()) : null,
    relation: known ? (breached ? (key === 'margin' ? 'below' : 'above') : (key === 'margin' ? 'at_or_above' : 'at_or_below')) : null,
    reasons, formula, unit, basis, source, applicability
  };
}

export function buildReferenceThresholds({order, cumulative, theoreticalBudget, baselineId, asOf} = {}) {
  const revenue = dec(theoreticalBudget?.revenue);
  const gross = dec(theoreticalBudget?.gross);
  const actualMargin = dec(cumulative?.actual?.margin);
  const marginReasons = [];
  if (actualMargin == null) marginReasons.push('累计实际毛利率待补齐');
  if (revenue == null) marginReasons.push('预算理论收入待补齐');
  else if (revenue.lte(0)) marginReasons.push('预算理论收入为零，不能作为分母');
  if (gross == null) marginReasons.push('预算理论毛利待补齐');
  const marginThreshold = revenue != null && revenue.gt(0) && gross != null ? gross.div(revenue) : null;
  const margin = referenceItem({
    key: 'margin', label: '毛利率',
    formula: '预算理论毛利 ÷ 预算理论收入',
    unit: '比例', actual: actualMargin, threshold: marginThreshold,
    actualKnown: actualMargin != null, thresholdKnown: marginThreshold != null,
    reasons: marginReasons,
    basis: {revenue: amount(revenue), gross: amount(gross)},
    source: '成本模型 · 含损耗预算基线',
    applicability: '仅作预算模型参考，不是已核定的企业安全底线。',
    compare: (a, t) => a.lt(t)
  });

  const quantity = dec(order?.quantity);
  const reserve = dec(theoreticalBudget?.reserve);
  const material = dec(theoreticalBudget?.material);
  const labor = dec(theoreticalBudget?.labor);
  const processed = dec(cumulative?.processed);
  const defects = dec(cumulative?.defects);
  const actualDefect = processed != null && processed.gt(0) && defects != null ? defects.div(processed) : null;
  const defectReasons = [];
  if (actualDefect == null) {
    if (processed == null) defectReasons.push('累计加工量待补齐');
    else if (processed.lte(0)) defectReasons.push('累计加工量为零，不能作为分母');
    if (defects == null) defectReasons.push('累计不良量待补齐');
  }
  if (quantity == null) defectReasons.push('合同数量待补齐');
  else if (quantity.lte(0)) defectReasons.push('合同数量为零，不能作为分母');
  if (reserve == null) defectReasons.push('预算损耗准备金待补齐');
  else if (reserve.lt(0)) defectReasons.push('预算损耗准备金为负，不能推导参考阈值');
  if (material == null) defectReasons.push('预算材料成本待补齐');
  else if (material.lt(0)) defectReasons.push('预算材料成本为负，不能推导参考阈值');
  if (labor == null) defectReasons.push('预算人工成本待补齐');
  else if (labor.lt(0)) defectReasons.push('预算人工成本为负，不能推导参考阈值');
  const unitCost = material != null && labor != null && quantity != null && quantity.gt(0)
    ? material.plus(labor).div(quantity) : null;
  if (unitCost != null && unitCost.lte(0)) defectReasons.push('预算材料及人工单位成本为零，不能换算参考阈值');
  const allowed = reserve != null && reserve.gte(0) && unitCost != null && unitCost.gt(0)
    ? reserve.div(unitCost) : null;
  const defectThreshold = allowed != null && quantity != null && quantity.gt(0)
    ? allowed.div(quantity.plus(allowed)) : null;
  if (defectThreshold == null && defectReasons.length === 0) defectReasons.push('参考阈值所需参数不完整');
  const defect = referenceItem({
    key: 'defect', label: '产品不良率',
    formula: '允许补产量 = 损耗准备金 ÷（（预算材料 + 预算人工）÷ 合同数量）；参考阈值 = 允许补产量 ÷（合同数量 + 允许补产量）',
    unit: '比例', actual: actualDefect, threshold: defectThreshold,
    actualKnown: actualDefect != null, thresholdKnown: defectThreshold != null,
    reasons: defectReasons,
    basis: {
      reserve: amount(reserve), material: amount(material), labor: amount(labor),
      quantity: quantity == null ? null : quantity.toString(), unitCost: amount(unitCost, 6),
      allowedQuantity: amount(allowed, 6), processed: processed == null ? null : processed.toString(),
      defects: defects == null ? null : defects.toString()
    },
    source: '成本模型 · 含损耗预算基线中的生产损耗与不良损耗预算',
    applicability: '仅作预算模型参考，不是质量检验标准；材料、人工、收入或数量缺失、为零时不推导。',
    compare: (a, t) => a.gt(t)
  });

  const breaches = [margin, defect].filter(x => x.breached).map(x => `${x.label}${x.key === 'margin' ? '低于' : '高于'}参考阈值 ${x.gapPp} 个百分点`);
  const unknownItems = [margin, defect].filter(x => x.status === 'unknown').map(x => ({
    key: x.key,
    label: x.label,
    actualKnown: x.actualKnown,
    thresholdKnown: x.thresholdKnown,
    reasons: x.reasons
  }));
  const state = breaches.length ? 'breach' : unknownItems.length === 2 ? 'unknown' : unknownItems.length ? 'partial' : 'ok';
  return {
    state, breaches, unknownItems,
    margin, defect,
    baselineId: baselineId ?? null,
    asOf: asOf ?? null,
    ruleVersion: REFERENCE_RULE_VERSION,
    model: '预算模型参考阈值',
    source: '成本模型 · 含损耗预算基线',
    applicability: '仅作预算模型参考，不是企业质量检验标准或已核定的经营底线。',
    note: '毛利率与不良率分别判断；任一未知时不作肯定判断。'
  };
}

export function buildSeverity(analysis = {}) {
  const actual = dec(analysis.cumulative?.actual?.margin);
  const expected = dec(analysis.cumulative?.expected?.margin);
  const reasons = [];
  if (actual == null) reasons.push('累计实际毛利率待补齐');
  if (expected == null) reasons.push('同进度理论毛利率待补齐');
  else if (expected.lte(0)) reasons.push('同进度理论毛利率为零或负，不能计算相对下降');
  const base = {
    actual: ratio(actual), expected: ratio(expected),
    decline: null, declinePct: null, declineAbsPct: null,
    differencePp: null, differenceAbsPp: null,
    thresholds: {
      normalMaxPct: new D(SEVERITY_THRESHOLDS.normalMax).times(100).toFixed(2),
      attentionMaxPct: new D(SEVERITY_THRESHOLDS.attentionMax).times(100).toFixed(2),
      keyMaxPct: new D(SEVERITY_THRESHOLDS.keyMax).times(100).toFixed(2)
    },
    ruleVersion: SEVERITY_RULE_VERSION,
    source: '累计实际毛利率 vs 同进度理论毛利率（当前对照基线）',
    note: '按相对下降分档：0–10% 可接受误差，10–20% 需关注，20–30% 重点注意，超过 30% 为大型偏差；该分级不是预算参考阈值越线判断。',
    reasons
  };
  if (reasons.length) return {...base, level: 'not_applicable', label: '待核算', tone: 'pending'};
  const decline = expected.minus(actual).div(expected);
  const difference = actual.minus(expected);
  let level, label, tone;
  if (decline.lt(0)) { level = 'better'; label = '优于同进度理论'; tone = 'ok'; }
  else if (decline.isZero()) { level = 'normal'; label = '与同进度理论持平'; tone = 'ok'; }
  else if (decline.lte(SEVERITY_THRESHOLDS.normalMax)) { level = 'normal'; label = '可接受误差'; tone = 'ok'; }
  else if (decline.lte(SEVERITY_THRESHOLDS.attentionMax)) { level = 'attention'; label = '需要关注'; tone = 'caution'; }
  else if (decline.lte(SEVERITY_THRESHOLDS.keyMax)) { level = 'key'; label = '重点注意'; tone = 'caution'; }
  else { level = 'severe'; label = '大型偏差'; tone = 'bad'; }
  return {
    ...base,
    level, label, tone,
    decline: ratio(decline), declinePct: pp(decline), declineAbsPct: pp(decline.abs()),
    differencePp: pp(difference), differenceAbsPp: pp(difference.abs())
  };
}

export function buildDiagnosis(analysis = {}) {
  const raw = analysis.bridge?.components ?? {};
  const total = dec(analysis.bridge?.total);
  const components = Object.entries(COMPONENTS).map(([key, meta]) => {
    const value = dec(raw[key]);
    const stated = classify(key, value);
    return {
      key, label: meta.label, kind: meta.kind,
      amount: amount(value), effect: stated.effect, fact: stated.fact,
      shareOfIncrease: null, evidence: meta.evidence
    };
  });
  const production = components.filter(c => c.kind === 'production');
  const increases = production.filter(c => c.effect === 'increase')
    .sort((a, b) => Number(b.amount) - Number(a.amount));
  const offsets = production.filter(c => c.effect === 'offset')
    .sort((a, b) => Number(a.amount) - Number(b.amount));
  const unknowns = components.filter(c => c.effect === 'unknown');
  const productionComplete = production.every(c => c.amount != null);
  const closureComplete = components.every(c => c.amount != null);
  const knownIncreasesTotal = increases.reduce((s, c) => s.plus(c.amount), new D(0));
  const knownOffsetsTotal = offsets.reduce((s, c) => s.plus(c.amount), new D(0));
  const increasesTotal = productionComplete ? knownIncreasesTotal : null;
  const offsetsTotal = productionComplete ? knownOffsetsTotal : null;
  if (productionComplete && knownIncreasesTotal.gt(0)) {
    for (const c of increases) c.shareOfIncrease = new D(c.amount).div(knownIncreasesTotal).toFixed(8);
  }
  const primary = productionComplete && increasesTotal != null && increasesTotal.gt(0) && increases.length
    && new D(increases[0].shareOfIncrease).gte(PRIMARY_SHARE_THRESHOLD) ? increases[0] : null;
  const operating = dec(analysis.cumulative?.actual?.operating);
  const costOf = key => dec(analysis.cumulative?.actual?.costs?.[key]);
  const operatingInfo = {
    profit: amount(operating),
    loss: operating != null && operating.lt(0),
    expenses: [
      {key: 'management', label: '管理', amount: amount(costOf('管理'))},
      {key: 'sales', label: '销售', amount: amount(costOf('销售'))},
      {key: 'finance', label: '财务', amount: amount(costOf('财务'))}
    ],
    note: '经营费用为实际发生额，未做同进度理论分解，仅用于说明经营亏损构成。'
  };
  const baseline = components.find(c => c.key === 'budgetAdjustment');
  const rounding = components.find(c => c.key === 'rounding');
  const top = increases[0] ?? null;
  const missingLabels = unknowns.map(c => c.label).join('、');

  let state, title, sub;
  if (total == null) {
    state = 'pending';
    title = '差距原因待补齐';
    sub = `总差距或关键资料缺失，暂不判断主因${missingLabels ? `；待补齐：${missingLabels}` : ''}。`;
  } else if (total.lte(0)) {
    state = 'at_target';
    title = '当前没有少赚差距';
    sub = total.isZero() ? '实际生产毛利与同进度理论持平。' : `实际生产毛利高于同进度理论 ¥${total.abs().toFixed(2)}，未形成少赚。`;
    if (!closureComplete) sub += '部分归因资料待补齐，不影响已确认的总差距状态。';
  } else if (!productionComplete) {
    state = 'gap';
    title = '差距已确认，部分归因待补齐';
    sub = `已确认少赚 ¥${total.toFixed(2)}；${missingLabels || '部分生产归因项'}资料不完整，暂不判断主因，也不计算完整占比。`;
  } else if (primary) {
    state = 'gap';
    title = `差距主要体现在${primary.label}`;
    sub = `${primary.label}影响 ¥${new D(primary.amount).abs().toFixed(2)}，占增支 ${(new D(primary.shareOfIncrease).times(100)).toFixed(1)}%。`;
    if (offsetsTotal != null && offsetsTotal.lt(0)) sub += `另有抵消项 ¥${offsetsTotal.abs().toFixed(2)}。`;
  } else if (increasesTotal != null && increasesTotal.gt(0)) {
    state = 'gap';
    title = '差距由多项成本共同造成';
    sub = `增支合计 ¥${increasesTotal.toFixed(2)}；最大项为${top.label} ¥${new D(top.amount).toFixed(2)}（占增支 ${(new D(top.shareOfIncrease).times(100)).toFixed(1)}%）。`;
    if (offsetsTotal != null && offsetsTotal.lt(0)) sub += `另有抵消项 ¥${offsetsTotal.abs().toFixed(2)}。`;
  } else {
    state = 'gap';
    title = '差距主要来自预算调整';
    sub = '未发现生产成本增支项；差额来自预算允许损耗、舍入或其他调整，需结合基线口径核对。';
  }

  const suggestions = total != null && total.gt(0)
    ? increases.slice(0, 3).map(c => ({
      key: c.key, label: c.label, amount: c.amount,
      shareOfIncrease: c.shareOfIncrease,
      text: COMPONENTS[c.key].suggestion,
      evidence: {
        asOf: analysis.asOf ?? null,
        revisionId: analysis.revisionId ?? null,
        baselineId: analysis.baselineId ?? null,
        source: COMPONENTS[c.key].evidence
      }
    }))
    : [];

  return {
    state,
    severity: buildSeverity(analysis),
    total: amount(total),
    attributionComplete: productionComplete,
    closureComplete,
    increases,
    offsets,
    unknowns,
    baseline,
    rounding,
    components,
    increasesTotal: amount(increasesTotal),
    offsetsTotal: amount(offsetsTotal),
    knownIncreasesTotal: amount(knownIncreasesTotal),
    knownOffsetsTotal: amount(knownOffsetsTotal),
    primary: primary ? {key: primary.key, label: primary.label, amount: primary.amount, shareOfIncrease: primary.shareOfIncrease} : null,
    operating: operatingInfo,
    summary: {title, sub},
    suggestions,
    evidence: {
      asOf: analysis.asOf ?? null,
      revisionId: analysis.revisionId ?? null,
      baselineId: analysis.baselineId ?? null
    },
    rule: {
      version: DIAGNOSIS_RULE_VERSION,
      primaryShareThreshold: PRIMARY_SHARE_THRESHOLD,
      shareDenominator: '正向增支合计',
      shareLabel: '占增支',
      note: '主因仅在单一增支项占正向增支合计不低于60%时标识；否则按多项共同造成展示。该阈值是展示规则，不是企业已确认的风险标准。'
    }
  };
}
