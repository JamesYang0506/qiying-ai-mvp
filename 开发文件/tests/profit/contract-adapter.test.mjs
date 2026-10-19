import {test} from 'node:test';import assert from 'node:assert/strict';import {evaluate} from '../../server/profit/evaluate.mjs';import {toCalculationResult} from '../../server/profit/contract-adapter.mjs';import {normalizePair} from '../../server/import/normalize.mjs';import {pair} from '../import/fixture.mjs';
const setup=()=>{const dataset=normalizePair(...pair()).dataset;return {dataset,analysis:evaluate(dataset,{asOf:'2026-08-03',baselineMode:'ideal'})};};
const cents=v=>Math.round(Number(v)*100);
test('maps the import evaluation to contract fields without recomputing profit',()=>{
 const {dataset,analysis}=setup(),r=toCalculationResult(analysis,{dataset,snapshotId:'SNAP-1',computedAt:'2026-10-17T00:00:00.000Z'});
 assert.equal(r.snapshot_id,'SNAP-1');assert.equal(r.order_id,'SIM-TEST');assert.equal(r.baseline_id,'BASE-1');assert.equal(r.computed_at,'2026-10-17T00:00:00.000Z');
 assert.equal(r.scope.basis,'cumulative');assert.equal(r.scope.period_start,'2026-08-03');assert.equal(r.scope.period_end,'2026-08-03');assert.equal(r.scope.quantity,'100');assert.equal(r.scope.currency,'CNY');assert.equal(r.scope.tax_basis,'ignored');assert.equal(r.scope.settlement_state,'open');
 assert.equal(r.actual.gross_profit,analysis.cumulative.actual.gross);assert.equal(r.expected.gross_profit,analysis.cumulative.expected.gross);
 assert.equal(r.actual.management_profit,analysis.cumulative.actual.operating);assert.equal(r.actual.forecast_profit,null);assert.equal(r.actual.final_profit,null);
 assert.equal(r.comparison.profit_delta,analysis.cumulative.delta);assert.equal(cents(r.comparison.profit_delta),-cents(analysis.cumulative.gap));
 assert.equal(r.comparison.risk.level,'better');assert.equal(r.comparison.risk.rule_version,'RELATIVE-MARGIN-1');assert.equal(r.comparison.comparable,true);assert.equal(r.comparison.revenue_delta,'0.00');
 assert.equal(cents(r.actual.total_production_cost),cents(analysis.cumulative.revenue)-cents(r.actual.gross_profit));
 assert.equal(r.comparison.cost_variances.reduce((s,v)=>s+cents(v.delta),0),-cents(r.comparison.profit_delta));
});
test('unknown actual values stay null in contract output',()=>{
 const {dataset}=setup();dataset.materials[0].net=null;const a=evaluate(dataset,{asOf:'2026-08-03',baselineMode:'ideal'}),r=toCalculationResult(a,{dataset,snapshotId:'SNAP-2'});
 assert.equal(r.actual.gross_profit,null);assert.equal(r.actual.material_cost,null);assert.equal(r.comparison.comparable,false);assert.equal(r.comparison.profit_delta,null);assert.equal(r.comparison.margin_delta,null);
 assert.ok(r.issues.some(i=>i.code==='IMPORT_MISSING'&&i.severity==='blocking'));
});
test('completeness separates actual, baseline and progress',()=>{
 let {dataset,analysis}=setup();
 assert.equal(analysis.quality.completeness.actual.state,'complete');assert.equal(analysis.quality.completeness.baseline.state,'complete');assert.equal(analysis.quality.completeness.progress.state,'complete');
 ({dataset}=setup());dataset.materials[0].net=null;analysis=evaluate(dataset,{asOf:'2026-08-03'});
 assert.equal(analysis.quality.completeness.actual.state,'incomplete');assert.equal(analysis.quality.completeness.baseline.state,'complete');assert.equal(analysis.quality.completeness.progress.state,'complete');
 ({dataset}=setup());dataset.baseline.params.prep_piece=null;analysis=evaluate(dataset,{asOf:'2026-08-03'});
 assert.equal(analysis.quality.completeness.baseline.state,'incomplete');assert.equal(analysis.quality.completeness.progress.state,'complete');
 ({dataset}=setup());dataset.production=[];analysis=evaluate(dataset,{asOf:'2026-08-03'});
 assert.equal(analysis.quality.completeness.progress.state,'incomplete');assert.equal(analysis.cumulative.actual.gross,null);
});
