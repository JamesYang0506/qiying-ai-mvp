import copy
import unittest

from profit_model.comparison import DEFAULT_RULES, evaluate, validate_rules

LEGACY_RULES = {
    'version': 'temporary-v1',
    'margin_warning_pp': '3',
    'margin_danger_pp': '5',
    'defect_warning_pct': '3',
    'defect_danger_pct': '5',
    'min_production': '100',
    'provisional': True,
    'created_at': None,
}
RELATIVE_RULES = dict(
    LEGACY_RULES,
    margin_mode='relative',
    margin_attention_pct='10',
    margin_focus_pct='20',
    margin_severe_pct='30',
)


def observation(profit='170.00', produced='1000', defects='30'):
    return {
        'snapshot': {
            'snapshot_id': '20261014T010000000000Z-aaaaaaaa',
            'created_at': '2026-10-14T01:00:00+00:00',
            'cutoff_date': '2026-10-14',
            'is_demo': True,
        },
        'orders': [
            {
                'order_id': 'A',
                'product': 'TEST',
                'quantity': '1000',
                'unit': '双',
                'mode': 'actual',
                'revenue': '1000.00',
                'production_profit': profit,
                'production_status': 'complete',
            }
        ],
        'source_analysis': {
            'order_id': 'A',
            'metrics': {'revenue': '1000.00', 'production_profit': profit},
            'production': {
                'gross_quantity': produced,
                'defect_quantity': defects,
                'days': [],
            },
        },
    }


def target(**changes):
    data = {
        'id': 'test-baseline',
        'actual_order_id': 'A',
        'product': 'TEST',
        'quantity': '1000',
        'unit': '双',
        'target_margin_pct': '20',
        'is_demo': True,
        'tax_basis': 'unknown',
    }
    data.update(changes)
    return data


class ComparisonTests(unittest.TestCase):
    def test_relative_right_closed_boundaries_without_rounding(self):
        for profit, status, relative in [
            ('180', 'normal', '10.000000'),
            ('179.999999999', 'warning', '10.000000'),
            ('160', 'warning', '20.000000'),
            ('159.999999999', 'focus', '20.000000'),
            ('140', 'focus', '30.000000'),
            ('139.999999999', 'danger', '30.000000'),
            ('210', 'normal', '-5.000000'),
        ]:
            with self.subTest(profit=profit):
                result = evaluate(
                    observation(profit, defects='0'),
                    'A',
                    target(),
                    RELATIVE_RULES,
                    scope_confirmed=True,
                )
                margin = result['metrics']['margin']
                self.assertEqual(margin['status'], status)
                self.assertEqual(margin['relative_drop_pct'], relative)
                if profit == '179.999999999':
                    self.assertEqual(margin['relative_drop_exact'], '10.000000000500')
                self.assertEqual(result['severity'], status)
                self.assertEqual(
                    margin['performance'], 'better' if profit == '210' else 'below_plan'
                )

    def test_nonpositive_relative_target_is_pending(self):
        for value in ('0', '-5'):
            result = evaluate(
                observation(),
                'A',
                target(target_margin_pct=value),
                RELATIVE_RULES,
                scope_confirmed=True,
            )
            self.assertEqual(result['metrics']['margin']['status'], 'pending')
            self.assertIsNone(result['metrics']['margin']['relative_drop_pct'])

    def test_ignored_tax_skips_conflict_but_requires_scope(self):
        data = observation()
        data['orders'][0]['tax_basis'] = 'included'
        for scope, expected in ((False, 'pending'), (True, 'warning')):
            result = evaluate(
                data,
                'A',
                target(tax_basis='ignored'),
                RELATIVE_RULES,
                scope_confirmed=scope,
            )
            self.assertEqual(result['metrics']['margin']['status'], expected)
        self.assertIn('不计税', result['metrics']['margin']['message'])

    def test_relative_rule_validation_preserves_quality_and_rejects_bad_order(self):
        rules = validate_rules(RELATIVE_RULES)
        self.assertEqual(rules['margin_mode'], 'relative')
        self.assertEqual(rules['defect_warning_pct'], '3')
        for changes in (
            {'margin_attention_pct': 'NaN'},
            {'margin_focus_pct': '10'},
            {'margin_severe_pct': '20'},
            {'margin_mode': 'other'},
        ):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                validate_rules(dict(RELATIVE_RULES, **changes))

    def test_default_rules_apply_confirmed_relative_standard(self):
        result = evaluate(
            observation('140', defects='0'),
            'A',
            target(),
            DEFAULT_RULES,
            scope_confirmed=True,
        )
        self.assertEqual(result['metrics']['margin']['status'], 'focus')

    def test_exact_thresholds_and_red_precedence(self):
        for profit, defects, margin, quality in [
            ('170.00', '30', 'warning', 'warning'),
            ('150.00', '50', 'danger', 'danger'),
            ('170.01', '29', 'normal', 'normal'),
        ]:
            with self.subTest(profit=profit):
                result = evaluate(
                    observation(profit, defects=defects),
                    'A',
                    target(),
                    LEGACY_RULES,
                    scope_confirmed=True,
                )
                self.assertEqual(result['metrics']['margin']['status'], margin)
                self.assertEqual(result['metrics']['quality']['status'], quality)

    def test_unconfirmed_margin_does_not_block_independent_quality(self):
        result = evaluate(observation(defects='50'), 'A', target(), LEGACY_RULES)
        self.assertEqual(result['metrics']['margin']['status'], 'pending')
        self.assertEqual(result['metrics']['quality']['status'], 'danger')
        self.assertTrue(result['pending'])

    def test_missing_baseline_not_normal_and_not_inferred_from_actual(self):
        result = evaluate(observation(), 'A', None, LEGACY_RULES, scope_confirmed=True)
        self.assertEqual(result['metrics']['margin']['status'], 'pending')
        self.assertIsNone(result['metrics']['margin']['target_pct'])

    def test_quantity_unit_identity_and_simulation_guards(self):
        for changes in (
            {'quantity': '2000'},
            {'unit': '件'},
            {'is_demo': False},
            {'actual_order_id': 'OTHER'},
            {'product': 'OTHER'},
        ):
            with self.subTest(changes=changes):
                result = evaluate(
                    observation(),
                    'A',
                    target(**changes),
                    LEGACY_RULES,
                    scope_confirmed=True,
                )
                self.assertEqual(result['metrics']['margin']['status'], 'pending')

    def test_unknown_and_invalid_quality_are_pending(self):
        for produced, defects in [
            ('0', '0'),
            ('99', '10'),
            ('100', '101'),
            ('100', None),
            ('100', '-1'),
        ]:
            with self.subTest(produced=produced, defects=defects):
                result = evaluate(
                    observation(produced=produced, defects=defects),
                    'A',
                    target(),
                    LEGACY_RULES,
                    scope_confirmed=True,
                )
                self.assertEqual(result['metrics']['quality']['status'], 'pending')

    def test_null_profit_and_zero_income_never_become_zero_margin(self):
        data = observation(None)
        self.assertEqual(
            evaluate(data, 'A', target(), LEGACY_RULES, scope_confirmed=True)[
                'metrics'
            ]['margin']['status'],
            'pending',
        )
        data['source_analysis']['metrics'].update(revenue='0', production_profit='-100')
        self.assertEqual(
            evaluate(data, 'A', target(), LEGACY_RULES, scope_confirmed=True)[
                'metrics'
            ]['margin']['status'],
            'pending',
        )

    def test_trial_label_simulation_and_inputs_preserved(self):
        data = observation()
        before = copy.deepcopy(data)
        result = evaluate(data, 'A', target(), LEGACY_RULES, scope_confirmed=True)
        self.assertEqual(result['metrics']['margin']['basis'], 'trial')
        self.assertTrue(result['is_demo'])
        self.assertEqual(data, before)

    def test_standard_forecast_is_labelled_estimate(self):
        data = observation()
        data.pop('source_analysis')
        data['orders'][0]['mode'] = 'forecast'
        result = evaluate(data, 'A', target(), LEGACY_RULES, scope_confirmed=True)
        self.assertEqual(result['metrics']['margin']['basis'], 'trial')
        self.assertEqual(result['metrics']['quality']['status'], 'pending')

    def test_rules_reject_nonfinite_bool_negative_and_inverted_levels(self):
        for changes in (
            {'margin_warning_pp': 'NaN'},
            {'min_production': True},
            {'margin_warning_pp': '-1'},
            {'margin_warning_pp': '6', 'margin_danger_pp': '5'},
            {'defect_danger_pct': '101'},
        ):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                validate_rules(dict(LEGACY_RULES, **changes))

    def test_changed_rules_are_used_without_mutating_defaults(self):
        rules = validate_rules(
            dict(LEGACY_RULES, margin_warning_pp='4', margin_danger_pp='6')
        )
        result = evaluate(observation(), 'A', target(), rules, scope_confirmed=True)
        self.assertEqual(result['metrics']['margin']['status'], 'normal')
        self.assertEqual(LEGACY_RULES['margin_warning_pp'], '3')
