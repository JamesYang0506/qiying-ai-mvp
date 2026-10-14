import copy
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from profit_model.comparison_store import (
    workspace,
    create_baseline,
    bind_baseline,
    check_order,
    save_rules,
    update_event,
    auto_check,
)
from profit_model.comparison import DEFAULT_RULES
from profit_model.history import set_deleted
from profit_model.snapshots import save_snapshot
from test_comparison import observation


class ComparisonStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.storage = Path(self.tmp.name)
        self.data = observation()
        self.data.update(costs=[], allocations=[], issues=[])
        save_snapshot(self.storage, self.data)
        self.sid = self.data['snapshot']['snapshot_id']

    def tearDown(self):
        self.tmp.cleanup()

    def request(self, **changes):
        request = {
            'snapshot_id': self.sid,
            'order_id': 'A',
            'scope_confirmed': True,
            'confirmed': True,
            'baseline': {
                'method': 'ratio',
                'business_order_id': 'A',
                'quantity': '1000',
                'unit': '双',
                'target_margin_pct': '20',
            },
        }
        request.update(changes)
        return request

    def later(self, profit, date='2026-10-15', oid='A'):
        data = copy.deepcopy(self.data)
        data['snapshot'].update(
            snapshot_id='20261015T010000000000Z-'
            + str(profit).replace('.', '')
            + 'aaaa',
            cutoff_date=date,
            created_at=date + 'T01:00:00+00:00',
        )
        data['orders'][0]['order_id'] = oid
        data['source_analysis']['order_id'] = oid
        data['source_analysis']['metrics']['production_profit'] = profit
        save_snapshot(self.storage, data)
        return data

    def test_get_is_read_only_and_create_does_not_change_actual_bytes(self):
        before = {p.name: p.read_bytes() for p in self.storage.glob('*.json')}
        self.assertIsNone(workspace(self.storage, self.sid, 'A')['comparison'])
        self.assertFalse((self.storage / 'comparison-data').exists())
        output = create_baseline(self.storage, self.request())
        self.assertEqual(output['comparison']['metrics']['margin']['status'], 'warning')
        self.assertEqual(
            before, {p.name: p.read_bytes() for p in self.storage.glob('*.json')}
        )

    def test_recheck_idempotence_rule_versions_and_history_preservation(self):
        first = create_baseline(self.storage, self.request())
        again = check_order(self.storage, self.request())
        self.assertEqual(len(again['records']), 1)
        self.assertEqual(first['comparison']['id'], again['comparison']['id'])
        save_rules(
            self.storage,
            {
                'confirmed': True,
                'rules': dict(
                    DEFAULT_RULES, margin_warning_pp='4', margin_danger_pp='6'
                ),
            },
        )
        updated = check_order(self.storage, self.request())
        self.assertEqual(len(updated['records']), 2)
        self.assertEqual(updated['comparison']['metrics']['margin']['status'], 'normal')
        old = next(
            row for row in updated['records'] if row['id'] == first['comparison']['id']
        )
        self.assertEqual(old['rules']['margin_warning_pp'], '3')
        self.assertEqual(old['metrics']['margin']['status'], 'warning')

    def test_new_baseline_version_does_not_rewrite_prior_comparison(self):
        first = create_baseline(self.storage, self.request())
        payload = self.request()
        payload['baseline']['target_margin_pct'] = '30'
        second = create_baseline(self.storage, payload)
        self.assertEqual(second['comparison']['baseline']['version'], 2)
        self.assertEqual(first['comparison']['baseline']['target_margin_pct'], '20')
        self.assertEqual(len(second['baselines']), 2)
        rebound = bind_baseline(
            self.storage,
            dict(self.request(), baseline_id=first['comparison']['baseline']['id']),
        )
        self.assertEqual(rebound['comparison']['baseline']['target_margin_pct'], '20')
        self.assertEqual(len(rebound['records']), 2)

    def test_automatic_new_snapshot_and_event_continuity_recovery(self):
        first = create_baseline(self.storage, self.request())
        margin_event = next(row for row in first['events'] if row['metric'] == 'margin')
        later = self.later('150.00')
        auto_check(self.storage, later)
        current = workspace(self.storage, later['snapshot']['snapshot_id'], 'A')
        self.assertEqual(current['comparison']['metrics']['margin']['status'], 'danger')
        event = next(row for row in current['events'] if row['metric'] == 'margin')
        self.assertEqual(event['id'], margin_event['id'])
        normal = self.later('200.00', '2026-10-16')
        auto_check(self.storage, normal)
        recovered = workspace(self.storage, normal['snapshot']['snapshot_id'], 'A')
        self.assertTrue(
            any(
                row['metric'] == 'margin' and row['detection_status'] == 'recovered'
                for row in recovered['events']
            )
        )

    def test_src_requires_explicit_new_snapshot_binding_and_simulation_isolation(self):
        self.data['orders'][0]['order_id'] = 'SRC-P'
        self.data['source_analysis']['order_id'] = 'SRC-P'
        save_snapshot(self.storage, self.data)
        request = self.request(order_id='SRC-P')
        request['baseline']['business_order_id'] = 'BUSINESS-01'
        first = create_baseline(self.storage, request)
        later = self.later('150.00', oid='SRC-P')
        auto_check(self.storage, later)
        current = workspace(self.storage, later['snapshot']['snapshot_id'], 'SRC-P')
        self.assertEqual(
            current['comparison']['metrics']['margin']['status'], 'pending'
        )
        bind_baseline(
            self.storage,
            dict(
                request,
                snapshot_id=later['snapshot']['snapshot_id'],
                baseline_id=first['baselines'][0]['id'],
            ),
        )
        self.assertEqual(
            workspace(self.storage, later['snapshot']['snapshot_id'], 'SRC-P')[
                'comparison'
            ]['metrics']['margin']['status'],
            'danger',
        )
        later['snapshot']['is_demo'] = False
        later['snapshot']['snapshot_id'] = '20261016T010000000000Z-realreal'
        save_snapshot(self.storage, later)
        with self.assertRaises(ValueError):
            bind_baseline(
                self.storage,
                dict(
                    request,
                    snapshot_id=later['snapshot']['snapshot_id'],
                    baseline_id=first['baselines'][0]['id'],
                ),
            )

    def test_deleted_order_blocks_read_write_and_restore_keeps_baseline(self):
        create_baseline(self.storage, self.request())
        set_deleted(self.storage, self.sid, 'A', True)
        with self.assertRaises(ValueError):
            workspace(self.storage, self.sid, 'A')
        with self.assertRaises(ValueError):
            check_order(self.storage, self.request())
        set_deleted(self.storage, self.sid, 'A', False)
        self.assertEqual(len(workspace(self.storage, self.sid, 'A')['baselines']), 1)

    def test_acknowledgement_does_not_clear_active_detection(self):
        first = create_baseline(self.storage, self.request())
        event = first['events'][0]
        updated = update_event(
            self.storage,
            dict(
                self.request(),
                event_id=event['id'],
                processing_status='acknowledged',
                note='核查中',
            ),
        )
        changed = next(row for row in updated['events'] if row['id'] == event['id'])
        self.assertEqual(changed['detection_status'], 'active')
        self.assertEqual(changed['processing_status'], 'acknowledged')
        self.assertEqual(updated['handling'][0]['note'], '核查中')

    def test_old_data_does_not_recover_newer_event(self):
        create_baseline(self.storage, self.request())
        latest = self.later('150.00', '2026-10-16')
        auto_check(self.storage, latest)
        old = self.later('200.00', '2026-10-15')
        auto_check(self.storage, old)
        events = workspace(self.storage, latest['snapshot']['snapshot_id'], 'A')[
            'events'
        ]
        self.assertTrue(
            any(
                row['metric'] == 'margin'
                and row['detection_status'] == 'active'
                and row['severity'] == 'danger'
                for row in events
            )
        )

    def test_latest_normal_observation_blocks_backfilled_new_alert(self):
        self.data['source_analysis']['metrics']['production_profit'] = '200.00'
        self.data['source_analysis']['production']['defect_quantity'] = '0'
        save_snapshot(self.storage, self.data)
        create_baseline(self.storage, self.request())
        latest = self.later('200.00', '2026-10-16')
        auto_check(self.storage, latest)
        old = self.later('100.00', '2026-10-15')
        auto_check(self.storage, old)
        current = workspace(self.storage, latest['snapshot']['snapshot_id'], 'A')
        self.assertEqual(current['comparison']['metrics']['margin']['status'], 'normal')
        self.assertFalse(
            any(
                row['metric'] == 'margin' and row['detection_status'] == 'active'
                for row in current['events']
            )
        )

    def test_historical_event_is_not_overwritten_by_future_recovery(self):
        first = create_baseline(self.storage, self.request())
        later = self.later('200.00', '2026-10-16')
        auto_check(self.storage, later)
        old = workspace(self.storage, self.sid, 'A')
        self.assertTrue(
            any(
                row['metric'] == 'margin' and row['detection_status'] == 'active'
                for row in old['events']
            )
        )
        event = next(row for row in first['events'] if row['metric'] == 'margin')
        with self.assertRaises(ValueError):
            update_event(
                self.storage,
                dict(self.request(), event_id=event['id'], processing_status='closed'),
            )

    def test_failed_record_write_rolls_back_baseline_binding_and_events(self):
        from profit_model import comparison_store

        original = comparison_store.write_one

        def fail_record(storage, group, key, value):
            if group == 'records':
                raise OSError('simulated disk failure')
            return original(storage, group, key, value)

        with patch.object(comparison_store, 'write_one', side_effect=fail_record):
            with self.assertRaises(OSError):
                create_baseline(self.storage, self.request())
        output = workspace(self.storage, self.sid, 'A')
        self.assertEqual(output['baselines'], [])
        self.assertEqual(output['events'], [])
        self.assertIsNone(output['comparison'])

    def test_failed_handling_audit_does_not_change_event(self):
        from profit_model import comparison_store

        output = create_baseline(self.storage, self.request())
        event = output['events'][0]
        original = comparison_store.write_one

        def fail_audit(storage, group, key, value):
            if group == 'handling':
                raise OSError('simulated audit failure')
            return original(storage, group, key, value)

        with patch.object(comparison_store, 'write_one', side_effect=fail_audit):
            with self.assertRaises(OSError):
                update_event(
                    self.storage,
                    dict(
                        self.request(), event_id=event['id'], processing_status='closed'
                    ),
                )
        after = next(
            row
            for row in workspace(self.storage, self.sid, 'A')['events']
            if row['id'] == event['id']
        )
        self.assertEqual(after['processing_status'], 'pending')

    def test_interrupted_transaction_is_recovered_before_next_read(self):
        output = create_baseline(self.storage, self.request())
        event = output['events'][0]
        folder = self.storage / 'comparison-data'
        path = folder / 'events' / (event['id'] + '.json')
        original = path.read_text(encoding='utf-8')
        changed = dict(event, processing_status='closed')
        path.write_text(json.dumps(changed), encoding='utf-8')
        (folder / 'handling').mkdir(exist_ok=True)
        pending = folder / 'handling' / 'uncommitted.json'
        pending.write_text('{}', encoding='utf-8')
        journal = {
            str(path.relative_to(folder)): original,
            str(pending.relative_to(folder)): None,
        }
        (folder / 'transaction.json').write_text(json.dumps(journal), encoding='utf-8')
        restored = workspace(self.storage, self.sid, 'A')
        self.assertEqual(path.read_text(encoding='utf-8'), original)
        self.assertFalse(pending.exists())
        self.assertFalse((folder / 'transaction.json').exists())
        self.assertTrue(
            any(
                row['id'] == event['id'] and row['processing_status'] == 'pending'
                for row in restored['events']
            )
        )

    def test_ratio_only_baseline_can_follow_same_full_order_quantity(self):
        request = self.request()
        request['baseline'].pop('quantity')
        create_baseline(self.storage, request)
        later = self.later('150.00')
        auto_check(self.storage, later)
        output = workspace(self.storage, later['snapshot']['snapshot_id'], 'A')
        self.assertEqual(output['comparison']['metrics']['margin']['status'], 'danger')

    def test_missing_confirmation_invalid_ids_and_scope_type_rejected(self):
        for changes in (
            {'confirmed': False},
            {'snapshot_id': '../latest'},
            {'scope_confirmed': 'true'},
        ):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                create_baseline(self.storage, self.request(**changes))

    def test_missing_new_data_does_not_hide_unresolved_alarm_in_summary(self):
        self.data['source_analysis']['production']['defect_quantity'] = '0'
        save_snapshot(self.storage, self.data)
        create_baseline(self.storage, self.request())
        later = self.later(None)
        auto_check(self.storage, later)
        output = workspace(self.storage, later['snapshot']['snapshot_id'], 'A')
        self.assertEqual(output['comparison']['metrics']['margin']['status'], 'pending')
        self.assertEqual(output['comparison']['severity'], 'warning')
        self.assertTrue(output['comparison']['pending'])
