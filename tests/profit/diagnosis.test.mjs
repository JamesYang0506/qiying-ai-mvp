import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiagnosis,
  buildReferenceThresholds,
  DIAGNOSIS_RULE_VERSION,
  REFERENCE_RULE_VERSION,
  PRIMARY_SHARE_THRESHOLD
} from '../../server/profit/diagnosis.mjs';

const analysis = (total, components, extra = {}) => ({
  order: {quantity: '100'},
  asOf: '2026-10-17',
  revisionId: 'REV-1',
  baselineId: 'BASE-1',
  cumulative: {processed: 108, defects: 8, actual: {margin: '0.10000000'}},
  bridge: {total, components},
  ...extra
});
const components = values => ({
  materialPrice: '0', materialUsage: '0', labor: '0', energy: '0',
  otherManufacturing: '0', otherProduction: '0', budgetAdjustment: '0', rounding: '0',
  ...values
});
const reference = overrides => buildReferenceThresholds({
  order: {quantity: '100'},
  cumulative: {processed: 108, defects: 8, actual: {margin: '0.10000000'}},
  theoreticalBudget: {revenue: '1000', gross: '200', material: '800', labor: '100', reserve: '30'},
  baselineId: 'BASE-1',
  asOf: '2026-10-17',
  ...overrides
});

test('P0-C: increases and offsets are shown separately and shares use the positive increase total', () => {
  const d = buildDiagnosis(analysis('100', components({materialUsage: '200', materialPrice: '-100'})));
  assert.equal(d.state, 'gap');
  assert.equal(d.increasesTotal, '200.00');
  assert.equal(d.offsetsTotal, '-100.00');
  assert.equal(d.increases[0].key, 'materialUsage');
  assert.equal(d.increases[0].shareOfIncrease, '1.00000000');
  assert.equal(d.increases[0].effect, 'increase');
  assert.equal(d.offsets[0].key, 'materialPrice');
  assert.equal(d.offsets[0].effect, 'offset');
  assert.equal(d.primary.key, 'materialUsage');
  assert.equal(d.primary.shareOfIncrease, '1.00000000');
  assert.ok(d.summary.sub.includes('占增支 100.0%'));
  assert.ok(!d.summary.sub.includes('占差距'));
  assert.equal(d.baseline.amount, '0.00');
  assert.equal(d.rounding.amount, '0.00');
  assert.equal(d.rule.primaryShareThreshold, PRIMARY_SHARE_THRESHOLD);
  assert.equal(d.rule.version, DIAGNOSIS_RULE_VERSION);
});

test('P0-A: a negative material price impact is described as an offset, not a price increase', () => {
  const d = buildDiagnosis(analysis('100', components({materialUsage: '200', materialPrice: '-100'})));
  assert.match(d.offsets[0].fact, /低于理论基准/);
  assert.match(d.offsets[0].fact, /抵消差距/);
  assert.doesNotMatch(d.offsets[0].fact, /高于理论基准/);
  assert.ok(!d.suggestions.some(s => s.key === 'materialPrice'));
});

test('P0-A: only a known increase gets a suggestion and at most three suggestions are returned', () => {
  const d = buildDiagnosis(analysis('100', components({
    materialUsage: '50', labor: '40', energy: '30', materialPrice: '20', otherProduction: '10'
  })));
  assert.equal(d.suggestions.length, 3);
  assert.deepEqual(d.suggestions.map(s => s.key), ['materialUsage', 'labor', 'energy']);
  assert.equal(d.suggestions[0].evidence.asOf, '2026-10-17');
  assert.equal(d.suggestions[0].evidence.revisionId, 'REV-1');
  assert.equal(d.suggestions[0].evidence.baselineId, 'BASE-1');
  assert.ok(d.suggestions[0].text.includes('核对'));
});

test('P0-B: an unknown total stays pending, keeps null components and never gets a primary cause', () => {
  const d = buildDiagnosis(analysis(null, components({
    materialUsage: null, labor: null, materialPrice: null
  })));
  assert.equal(d.state, 'pending');
  assert.equal(d.total, null);
  assert.equal(d.attributionComplete, false);
  assert.equal(d.primary, null);
  assert.equal(d.increasesTotal, null);
  assert.equal(d.unknowns.length, 3);
  assert.equal(d.unknowns[0].amount, null);
  assert.equal(d.suggestions.length, 0);
  assert.ok(d.summary.title.includes('待补齐'));
});

test('P0-B: a confirmed gap with a missing component keeps the gap red but refuses a complete share', () => {
  const d = buildDiagnosis(analysis('100', components({materialUsage: '200', labor: null})));
  assert.equal(d.state, 'gap');
  assert.equal(d.total, '100.00');
  assert.equal(d.attributionComplete, false);
  assert.equal(d.increasesTotal, null);
  assert.equal(d.primary, null);
  assert.equal(d.increases[0].shareOfIncrease, null);
  assert.ok(d.summary.title.includes('差距已确认'));
  assert.ok(d.summary.sub.includes('暂不判断主因'));
});

test('P0-C: 60% is the primary threshold and a tie is shown as multiple causes', () => {
  const exact = buildDiagnosis(analysis('100', components({materialUsage: '60', labor: '40'})));
  assert.equal(exact.primary.key, 'materialUsage');
  assert.equal(exact.primary.shareOfIncrease, '0.60000000');

  const tie = buildDiagnosis(analysis('100', components({materialUsage: '50', labor: '50'})));
  assert.equal(tie.primary, null);
  assert.equal(tie.summary.title, '差距由多项成本共同造成');
  assert.ok(tie.summary.sub.includes('占增支 50.0%'));
});

test('P0-C: zero and negative net gaps stay at target and do not invent a cause', () => {
  const zero = buildDiagnosis(analysis('0', components({})));
  assert.equal(zero.state, 'at_target');
  assert.equal(zero.summary.title, '当前没有少赚差距');
  assert.equal(zero.primary, null);
  assert.equal(zero.suggestions.length, 0);

  const gain = buildDiagnosis(analysis('-50', components({materialPrice: '-50'})));
  assert.equal(gain.state, 'at_target');
  assert.ok(gain.summary.sub.includes('高于同进度理论'));
  assert.equal(gain.primary, null);
});

test('P0-D: margin and defect thresholds are calculated on the server with Decimal', () => {
  const r = reference();
  assert.equal(r.state, 'breach');
  assert.equal(r.ruleVersion, REFERENCE_RULE_VERSION);
  assert.equal(r.baselineId, 'BASE-1');
  assert.equal(r.margin.actual, '0.10000000');
  assert.equal(r.margin.threshold, '0.20000000');
  assert.equal(r.margin.breached, true);
  assert.equal(r.margin.gapPp, '10.00');
  assert.equal(r.defect.actual, (8 / 108).toFixed(8));
  assert.equal(r.defect.threshold, '0.03225806');
  assert.equal(r.defect.breached, true);
  assert.equal(r.defect.gapPp, '4.18');
  assert.deepEqual(r.breaches, ['毛利率低于参考阈值 10.00 个百分点', '产品不良率高于参考阈值 4.18 个百分点']);
  assert.equal(r.margin.basis.revenue, '1000.00');
  assert.equal(r.margin.basis.gross, '200.00');
  assert.equal(r.defect.basis.unitCost, '9.000000');
  assert.equal(r.defect.basis.allowedQuantity, '3.333333');
  assert.equal(r.margin.unit, '比例');
  assert.ok(r.margin.formula.includes('预算理论毛利'));
  assert.ok(r.defect.formula.includes('允许补产量'));
  assert.ok(r.margin.applicability.includes('不是已核定的企业安全底线'));
});

test('P0-D: margin and defect judgments are independent', () => {
  const marginOk = reference({
    cumulative: {processed: 0, defects: 0, actual: {margin: '0.25'}}
  });
  assert.equal(marginOk.margin.breached, false);
  assert.equal(marginOk.defect.status, 'unknown');
  assert.equal(marginOk.defect.actualKnown, false);
  assert.equal(marginOk.state, 'partial');
  assert.ok(marginOk.defect.reasons.some(x => x.includes('累计加工量为零')));

  const defectOk = reference({
    cumulative: {processed: 100, defects: 0, actual: {margin: '0.10000000'}},
    theoreticalBudget: {revenue: '0', gross: '0', material: '800', labor: '100', reserve: '30'}
  });
  assert.equal(defectOk.margin.status, 'unknown');
  assert.equal(defectOk.margin.thresholdKnown, false);
  assert.equal(defectOk.defect.breached, false);
  assert.equal(defectOk.state, 'partial');
  assert.ok(defectOk.margin.reasons.some(x => x.includes('预算理论收入为零')));
});

test('P0-D: equality is not a breach and zero reserve gives a zero ceiling', () => {
  const equal = reference({
    cumulative: {processed: 108, defects: 8, actual: {margin: '0.20000000'}},
    theoreticalBudget: {revenue: '1000', gross: '200', material: '800', labor: '100', reserve: '0'}
  });
  assert.equal(equal.margin.breached, false);
  assert.equal(equal.defect.threshold, '0.00000000');
  assert.equal(equal.defect.breached, true);
  assert.equal(equal.defect.gapPp, '7.41');

  const noDefect = buildReferenceThresholds({
    order: {quantity: '100'},
    cumulative: {processed: 100, defects: 0, actual: {margin: '0.2'}},
    theoreticalBudget: {revenue: '1000', gross: '200', material: '800', labor: '100', reserve: '0'}
  });
  assert.equal(noDefect.defect.threshold, '0.00000000');
  assert.equal(noDefect.defect.breached, false);
});

test('P0-D: missing or zero parameters never become zero denominators', () => {
  const missingMaterial = reference({
    theoreticalBudget: {revenue: '1000', gross: '200', material: null, labor: '100', reserve: '30'}
  });
  assert.equal(missingMaterial.defect.status, 'unknown');
  assert.equal(missingMaterial.defect.threshold, null);
  assert.ok(missingMaterial.defect.reasons.some(x => x.includes('预算材料成本待补齐')));

  const zeroQuantity = reference({order: {quantity: '0'}});
  assert.equal(zeroQuantity.defect.status, 'unknown');
  assert.equal(zeroQuantity.defect.threshold, null);
  assert.ok(zeroQuantity.defect.reasons.some(x => x.includes('合同数量为零')));

  const zeroUnit = reference({
    theoreticalBudget: {revenue: '1000', gross: '200', material: '0', labor: '0', reserve: '30'}
  });
  assert.equal(zeroUnit.defect.status, 'unknown');
  assert.equal(zeroUnit.defect.threshold, null);
  assert.ok(zeroUnit.defect.reasons.some(x => x.includes('单位成本为零')));

  const noBudget = buildReferenceThresholds({order: {quantity: '100'}, cumulative: {processed: 108, defects: 8, actual: {margin: '0.1'}}});
  assert.equal(noBudget.margin.status, 'unknown');
  assert.equal(noBudget.defect.status, 'unknown');
  assert.equal(noBudget.state, 'unknown');
});

test('P0-D: a known actual value is still shown when the baseline threshold is unknown', () => {
  const r = reference({
    theoreticalBudget: {revenue: '1000', gross: null, material: '800', labor: '100', reserve: '30'}
  });
  assert.equal(r.margin.actualKnown, true);
  assert.equal(r.margin.thresholdKnown, false);
  assert.equal(r.margin.actual, '0.10000000');
  assert.equal(r.margin.threshold, null);
  assert.ok(r.margin.reasons.some(x => x.includes('预算理论毛利待补齐')));
});
