import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from profit_model.snapshots import atomic_write_text, save_snapshot, select_orders


class SnapshotTests(unittest.TestCase):
    def snapshot(self):
        return {
            'snapshot': {
                'snapshot_id': '20261014T010000000000Z-aaaaaaaa',
                'is_demo': False,
            },
            'orders': [{'order_id': 'A'}, {'order_id': 'B'}],
            'costs': [{'order_id': 'A'}, {'order_id': 'B'}],
            'allocations': [{'order_id': 'B'}],
            'issues': [{'order_id': 'A'}, {'message': 'global'}],
            'source_analysis': {'order_id': 'B'},
        }

    def test_selection_isolates_all_tables_without_changing_original(self):
        original = self.snapshot()
        before = copy.deepcopy(original)
        selected = select_orders(original, {'A'})
        self.assertEqual(selected['orders'], [{'order_id': 'A'}])
        self.assertEqual(selected['costs'], [{'order_id': 'A'}])
        self.assertEqual(selected['allocations'], [])
        self.assertEqual(selected['issues'], [{'order_id': 'A'}])
        self.assertNotIn('source_analysis', selected)
        selected['snapshot']['export_scope'] = ['A']
        self.assertEqual(original, before)

    def test_duplicate_exclusion_keeps_unscoped_issues_and_other_source(self):
        selected = select_orders(self.snapshot(), {'A'}, exclude=True)
        self.assertEqual(selected['orders'], [{'order_id': 'B'}])
        self.assertEqual(selected['issues'], [{'message': 'global'}])
        self.assertEqual(selected['source_analysis'], {'order_id': 'B'})
        self.assertNotIn(
            'source_analysis', select_orders(self.snapshot(), {'B'}, exclude=True)
        )

    def test_demo_save_does_not_replace_current_and_real_save_matches_version(self):
        with tempfile.TemporaryDirectory() as folder:
            storage = Path(folder)
            current = storage / 'latest.json'
            current.write_text('existing current', encoding='utf-8')
            data = self.snapshot()
            data['snapshot']['is_demo'] = True
            save_snapshot(storage, data)
            self.assertEqual(current.read_text(encoding='utf-8'), 'existing current')
            data['snapshot']['is_demo'] = False
            save_snapshot(storage, data)
            self.assertEqual(json.loads(current.read_text(encoding='utf-8')), data)
            self.assertEqual(
                current.read_bytes(),
                (storage / (data['snapshot']['snapshot_id'] + '.json')).read_bytes(),
            )

    def test_failed_atomic_replace_preserves_original_and_cleans_temporary_file(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'latest.json'
            target.write_text('original', encoding='utf-8')
            with patch.object(Path, 'replace', side_effect=OSError('replace failed')):
                with self.assertRaises(OSError):
                    atomic_write_text(target, 'replacement')
            self.assertEqual(target.read_text(encoding='utf-8'), 'original')
            self.assertEqual(list(Path(folder).iterdir()), [target])
