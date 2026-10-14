import copy
import csv
import io
import json
import unittest
import zipfile

from profit_model import files
from profit_model.engine import calculate
from test_engine import fixture


class TrainingExportTests(unittest.TestCase):
    def bundle(self, result):
        self.assertTrue(callable(getattr(files, 'export_training_bundle', None)),
                        'Training export must be implemented')
        return zipfile.ZipFile(io.BytesIO(files.export_training_bundle(result)))

    def test_preserves_unknowns_precision_and_has_no_training_answers(self):
        data = fixture()
        data['pools'] = data['pools'][:-1]
        data['bases'] = data['bases'][:-1]
        data['coverage'][-2]['status'] = 'missing'
        result = calculate(data)
        original = copy.deepcopy(result)
        with self.bundle(result) as z:
            record = json.loads(z.read('orders.jsonl'))
            self.assertEqual(record['input']['order']['production_profit'], '6050.00')
            self.assertIsNone(record['input']['order']['management_profit'])
            self.assertIsNone(record['input']['order']['categories']['finance'])
            self.assertEqual(record['annotation']['status'], 'unreviewed')
            self.assertIsNone(record['annotation']['answer'])
            self.assertFalse(record['training_eligible'])
            annotation = list(csv.DictReader(io.StringIO(z.read('annotations.csv').decode('utf-8-sig'))))[0]
            self.assertEqual(annotation['expert_answer'], '')
            self.assertEqual(annotation['sample_id'], record['sample_id'])
            manifest = json.loads(z.read('manifest.json'))
            self.assertTrue(manifest['is_demo'])
            self.assertEqual(manifest['snapshot_id'], result['snapshot']['snapshot_id'])
            self.assertEqual(manifest['sft_ready_count'], 0)
            self.assertNotIn('messages', record)
        self.assertEqual(result, original)

    def test_source_trial_is_separate_from_strict_profit_and_csv_is_safe(self):
        result = calculate(fixture())
        result['orders'][0].update(customer='=UNTRUSTED', management_profit=None, management_status='disabled')
        result['source_analysis'] = {'order_id': 'A', 'profit_layers': {
            'production_profit': '7000.01', 'operating_net_profit': '999.99',
            'status': '参考试算 · 费用待核验'}, 'trust_review': {'pending': ['税口径']}}
        with self.bundle(result) as z:
            record = json.loads(z.read('orders.jsonl'))
            self.assertEqual(record['input']['source_analysis'], result['source_analysis'])
            rows = list(csv.DictReader(io.StringIO(z.read('orders.csv').decode('utf-8-sig'))))
            self.assertEqual(rows[0]['reference_operating_net_profit'], '999.99')
            self.assertEqual(rows[0]['management_profit'], '')
            self.assertEqual(rows[0]['customer'], "'=UNTRUSTED")
            self.assertEqual(rows[0]['reference_status'], '参考试算 · 费用待核验')
            self.assertEqual(record['input']['order']['customer'], '=UNTRUSTED')

    def test_multiple_orders_keep_costs_and_source_separate(self):
        result = calculate(fixture())
        result['orders'].append(dict(result['orders'][0], order_id='B'))
        result['costs'].append({'order_id': 'B', 'record_id': 'b1', 'amount': None})
        result['source_analysis'] = {'order_id': 'B', 'profit_layers': {}}
        with self.bundle(result) as z:
            records = [json.loads(line) for line in z.read('orders.jsonl').decode().splitlines()]
            self.assertNotIn('source_analysis', records[0]['input'])
            self.assertTrue(all(c['order_id'] == 'A' for c in records[0]['input']['costs']))
            self.assertEqual(records[1]['input']['costs'][0]['record_id'], 'b1')
            self.assertNotEqual(records[0]['sample_id'], records[1]['sample_id'])
