import unittest
import io
import json
import zipfile
from profit_model.files import workbook_bytes, read_workbook, export_bundle
from profit_model.engine import calculate
from test_engine import fixture


class FileTests(unittest.TestCase):
    def test_excel_roundtrip_preserves_amounts_and_boolean(self):
        d=read_workbook(workbook_bytes(fixture()))
        self.assertIs(d['orders'][0]['scope_aligned'],True)
        self.assertEqual(calculate(d)['orders'][0]['management_profit'],'4350.00')

    def test_export_contains_five_outputs_and_same_snapshot(self):
        r=calculate(fixture())
        with zipfile.ZipFile(io.BytesIO(export_bundle(r))) as z:
            self.assertEqual(set(z.namelist()),{'orders.csv','costs.csv','allocations.csv','issues.csv','snapshot.json','result.json'})
            self.assertEqual(json.loads(z.read('result.json'))['snapshot']['snapshot_id'],r['snapshot']['snapshot_id'])

    def test_invalid_excel_rejected(self):
        with self.assertRaises(ValueError): read_workbook(b'not a workbook')
