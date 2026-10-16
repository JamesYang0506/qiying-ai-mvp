import base64
import io
import json
import unittest
import urllib.error
import urllib.request

from openpyxl import Workbook
from test_server import ServerTests as _Setup
from test_engine import fixture
from test_comparison import LEGACY_RULES, RELATIVE_RULES


class ComparisonAPITests(unittest.TestCase):
    setUp = _Setup.setUp
    tearDown = _Setup.tearDown

    def post(self, path, payload):
        request = urllib.request.Request(
            self.url + path,
            data=json.dumps(payload).encode(),
            headers={'Content-Type': 'application/json'},
        )
        with urllib.request.urlopen(request) as response:
            return json.load(response)

    def import_order(self):
        return self.post('/api/calculate', fixture())

    def test_import_auto_checks_and_baseline_rules_history_remain_separate(self):
        self.post('/api/comparison/rules', {'confirmed': True, 'rules': LEGACY_RULES})
        order = self.import_order()
        sid = order['snapshot']['snapshot_id']
        with urllib.request.urlopen(
            self.url + '/api/comparison?snapshot_id=' + sid + '&order_id=A'
        ) as response:
            workspace = json.load(response)
        self.assertEqual(
            workspace['comparison']['metrics']['margin']['status'], 'pending'
        )
        result = self.post(
            '/api/theory',
            {
                'snapshot_id': sid,
                'order_id': 'A',
                'confirmed': True,
                'scope_confirmed': True,
                'baseline': {
                    'method': 'ratio',
                    'business_order_id': 'A',
                    'target_margin_pct': '40',
                    'quantity': '1000',
                    'unit': '双',
                },
            },
        )
        self.assertEqual(result['comparison']['metrics']['margin']['status'], 'danger')
        self.assertEqual(result['comparison']['rules']['margin_warning_pp'], '3')
        rules = self.post(
            '/api/comparison/rules',
            {
                'confirmed': True,
                'rules': {
                    'margin_warning_pp': '10',
                    'margin_danger_pp': '15',
                    'defect_warning_pct': '3',
                    'defect_danger_pct': '5',
                    'min_production': '100',
                },
            },
        )
        self.assertNotEqual(
            rules['rules']['version'], result['comparison']['rules']['version']
        )
        updated = self.post(
            '/api/comparison/check', {'snapshot_id': sid, 'order_id': 'A'}
        )
        self.assertEqual(updated['comparison']['metrics']['margin']['status'], 'normal')
        self.assertEqual(len(updated['records']), 3)

    def test_relative_rules_roundtrip_and_check_preserves_prior_record(self):
        order = self.import_order()
        sid = order['snapshot']['snapshot_id']
        legacy = self.post('/api/comparison/rules',
                           {'confirmed': True, 'rules': LEGACY_RULES})
        before = self.post('/api/theory', {
            'snapshot_id': sid, 'order_id': 'A', 'confirmed': True,
            'scope_confirmed': True,
            'baseline': {'method': 'ratio', 'business_order_id': 'A',
                         'target_margin_pct': '40', 'quantity': '1000', 'unit': '双'},
        })
        saved = self.post('/api/comparison/rules',
                          {'confirmed': True, 'rules': RELATIVE_RULES})
        self.assertEqual(saved['rules']['margin_mode'], 'relative')
        self.assertNotEqual(saved['rules']['version'], legacy['rules']['version'])
        result = self.post('/api/comparison/check', {'snapshot_id': sid, 'order_id': 'A'})
        margin = result['comparison']['metrics']['margin']
        self.assertEqual(margin['status'], 'focus')
        self.assertIsNotNone(margin['relative_drop_pct'])
        frozen = next(row for row in result['records'] if row['id'] == before['comparison']['id'])
        self.assertEqual(frozen, before['comparison'])

    def test_template_preview_and_static_assets(self):
        for path in ('/comparison.js', '/comparison.css', '/api/theory/template.xlsx'):
            with urllib.request.urlopen(self.url + path) as response:
                self.assertTrue(response.read())
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = '理论利润表'
        for row in [
            ('字段', '数值'),
            ('method', 'ratio'),
            ('business_order_id', 'A'),
            ('target_margin_pct', '20%'),
        ]:
            sheet.append(row)
        output = io.BytesIO()
        workbook.save(output)
        result = self.post(
            '/api/theory/preview',
            {'workbook_base64': base64.b64encode(output.getvalue()).decode()},
        )
        self.assertEqual(result['baseline']['target_margin_pct'], '20')

    def test_unknown_snapshot_deleted_records_and_unconfirmed_writes_rejected(self):
        order = self.import_order()
        sid = order['snapshot']['snapshot_id']
        self.post(
            '/api/history/delete',
            {'snapshot_id': sid, 'order_id': 'A', 'confirmed': True},
        )
        for path, payload in [
            ('/api/comparison/check', {'snapshot_id': sid, 'order_id': 'A'}),
            ('/api/comparison/rules', {'confirmed': False, 'rules': {}}),
            (
                '/api/theory/bind',
                {
                    'confirmed': True,
                    'snapshot_id': '../latest',
                    'order_id': 'A',
                    'baseline_id': '../bad',
                },
            ),
        ]:
            with (
                self.subTest(path=path),
                self.assertRaises(urllib.error.HTTPError) as error,
            ):
                self.post(path, payload)
            self.assertEqual(error.exception.code, 400)


del _Setup
