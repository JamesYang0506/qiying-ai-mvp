import copy
import unittest

from profit_model.comparison import DEFAULT_RULES, evaluate, validate_rules


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
                    DEFAULT_RULES,
                    scope_confirmed=True,
                )
                self.assertEqual(result['metrics']['margin']['status'], margin)
                self.assertEqual(result['metrics']['quality']['status'], quality)

    def test_unconfirmed_margin_does_not_block_independent_quality(self):
        result = evaluate(observation(defects='50'), 'A', target(), DEFAULT_RULES)
        self.assertEqual(result['metrics']['margin']['status'], 'pending')
        self.assertEqual(result['metrics']['quality']['status'], 'danger')
        self.assertTrue(result['pending'])

    def test_missing_baseline_not_normal_and_not_inferred_from_actual(self):
        result = evaluate(observation(), 'A', None, DEFAULT_RULES, scope_confirmed=True)
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
                    DEFAULT_RULES,
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
                    DEFAULT_RULES,
                    scope_confirmed=True,
                )
                self.assertEqual(result['metrics']['quality']['status'], 'pending')

    def test_null_profit_and_zero_income_never_become_zero_margin(self):
        data = observation(None)
        self.assertEqual(
            evaluate(data, 'A', target(), DEFAULT_RULES, scope_confirmed=True)[
                'metrics'
            ]['margin']['status'],
            'pending',
        )
        data['source_analysis']['metrics'].update(revenue='0', production_profit='-100')
        self.assertEqual(
            evaluate(data, 'A', target(), DEFAULT_RULES, scope_confirmed=True)[
                'metrics'
            ]['margin']['status'],
            'pending',
        )

    def test_trial_label_simulation_and_inputs_preserved(self):
        data = observation()
        before = copy.deepcopy(data)
        result = evaluate(data, 'A', target(), DEFAULT_RULES, scope_confirmed=True)
        self.assertEqual(result['metrics']['margin']['basis'], 'trial')
        self.assertTrue(result['is_demo'])
        self.assertEqual(data, before)

    def test_standard_forecast_is_labelled_estimate(self):
        data = observation()
        data.pop('source_analysis')
        data['orders'][0]['mode'] = 'forecast'
        result = evaluate(data, 'A', target(), DEFAULT_RULES, scope_confirmed=True)
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
                validate_rules(dict(DEFAULT_RULES, **changes))

    def test_changed_rules_are_used_without_mutating_defaults(self):
        rules = validate_rules(
            dict(DEFAULT_RULES, margin_warning_pp='4', margin_danger_pp='6')
        )
        result = evaluate(observation(), 'A', target(), rules, scope_confirmed=True)
        self.assertEqual(result['metrics']['margin']['status'], 'normal')
        self.assertEqual(DEFAULT_RULES['margin_warning_pp'], '3')
