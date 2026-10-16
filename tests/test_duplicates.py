import base64
import copy
import io
import json
import unittest
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from openpyxl import load_workbook
import test_history
from test_auto_import import labeled_source
from test_engine import fixture

class DuplicateTests(unittest.TestCase):
    setUp=test_history.HistoryTests.setUp
    tearDown=test_history.HistoryTests.tearDown
    get=test_history.HistoryTests.get

    def post(self,path,payload):
        req=urllib.request.Request(self.url+path,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
        with self.opener.open(req) as r:return json.load(r)

    def excel(self,content=None):
        return self.post('/api/auto-import-xlsx',{'workbook_base64':base64.b64encode(content or labeled_source()).decode()})

    def test_identical_file_returns_existing_without_writing_or_changing_current(self):
        first=self.excel();before={p.name:p.read_bytes() for p in self.storage.glob('*.json')}
        again=self.excel()
        self.assertEqual(again['status'],'duplicate')
        self.assertEqual(again['match']['snapshot_id'],first['result']['snapshot']['snapshot_id'])
        self.assertFalse(again['match']['orders'][0]['deleted'])
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.storage.glob('*.json')})

    def test_reformatted_file_and_changed_saved_profit_are_duplicates(self):
        self.excel()
        w=load_workbook(io.BytesIO(labeled_source()));w['成本计算'].column_dimensions['E'].width=50;w['成本计算']['H24']='=999999'
        b=io.BytesIO();w.save(b)
        self.assertEqual(self.excel(b.getvalue())['status'],'duplicate')

    def test_changed_price_and_process_inputs_allow_new_versions(self):
        first=self.excel()
        self.assertEqual(self.excel(labeled_source(lambda w:w['成本计算'].__setitem__('E4',25)))['status'],'imported')
        self.assertEqual(self.excel(labeled_source(lambda w:w['生产周期'].__setitem__('F8',7)))['status'],'imported')
        self.assertEqual(len(self.get('/api/history')['orders'][0]['versions']),3)

    def test_deleted_duplicate_suggests_restore_without_restoring_automatically(self):
        r=self.excel()['result'];sid=r['snapshot']['snapshot_id'];oid=r['orders'][0]['order_id']
        self.post('/api/history/delete',{'snapshot_id':sid,'order_id':oid,'confirmed':True})
        held=self.excel();self.assertEqual(held['status'],'duplicate');self.assertTrue(held['match']['orders'][0]['deleted'])
        self.assertEqual(self.get('/api/history')['orders'],[])
        self.assertEqual(self.get('/api/current'),{'current':None})

    def test_json_semantic_values_ignore_key_and_row_order_but_not_cost_changes(self):
        d=fixture();d['metadata']['is_demo']=False
        self.post('/api/calculate',d)
        reordered=copy.deepcopy(d);reordered['coverage'].reverse();reordered['orders'][0]['quantity']='1000.00'
        self.assertEqual(self.post('/api/calculate',reordered)['status'],'duplicate')
        reordered['materials'][0]['quantity']='999'
        self.assertIn('orders',self.post('/api/calculate',reordered))

    def test_legacy_snapshot_without_new_fingerprint_matches_same_file(self):
        r=self.excel()['result'];path=self.storage/(r['snapshot']['snapshot_id']+'.json')
        saved=json.loads(path.read_text(encoding='utf-8'));saved['snapshot'].pop('import_identity',None)
        path.write_text(json.dumps(saved),encoding='utf-8')
        self.assertEqual(self.excel()['status'],'duplicate')

    def test_concurrent_identical_imports_save_only_once(self):
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:self.excel(),range(2)))
        self.assertEqual(sorted(x['status'] for x in results),['duplicate','imported'])
        self.assertEqual(len(self.get('/api/history')['orders'][0]['versions']),1)

    def test_legacy_same_net_price_but_changed_price_and_discount_is_new_data(self):
        r=self.excel()['result'];path=self.storage/(r['snapshot']['snapshot_id']+'.json')
        old=json.loads(path.read_text(encoding='utf-8'));old['snapshot'].pop('import_identity');path.write_text(json.dumps(old),encoding='utf-8')
        def change(w):w['成本计算']['E4']=21;w['成本计算']['E5']=2
        self.assertEqual(self.excel(labeled_source(change))['status'],'imported')

    def test_legacy_same_file_with_corrected_mapping_is_not_duplicate(self):
        content=labeled_source(lambda w:w['成本计算'].__setitem__('G40',2))
        r=self.excel(content)['result'];path=self.storage/(r['snapshot']['snapshot_id']+'.json')
        old=json.loads(path.read_text(encoding='utf-8'));old['snapshot'].pop('import_identity');path.write_text(json.dumps(old),encoding='utf-8')
        payload={'workbook_base64':base64.b64encode(content).decode()}
        preview=self.post('/api/preview-xlsx',payload);mapping=preview['mapping'];mapping['fields']['E17']['cell']='G40'
        data=self.post('/api/import-reviewed-xlsx',dict(payload,mapping=mapping,source_hash=preview['source_hash'],confirmed=True))
        self.assertIn('orders',data)
        self.assertEqual(data['source_analysis']['metrics']['processing_total'],'200.00')

    def test_batch_skips_duplicate_order_and_saves_new_order_only(self):
        d=fixture();d['metadata']['is_demo']=False
        self.post('/api/calculate',d)
        d['orders'].append(dict(d['orders'][0],order_id='B'))
        for table in ('materials','labor','bases','coverage'):
            extra=copy.deepcopy(d[table])
            for row in extra:
                row['order_id']='B'
                if 'record_id' in row:row['record_id']+='-B'
            d[table]+=extra
        result=self.post('/api/calculate',d)
        self.assertEqual([x['order_id'] for x in result['orders']],['B'])
        self.assertEqual(result['snapshot']['duplicates_skipped'][0]['orders'][0]['order_id'],'A')
        history=self.get('/api/history');self.assertEqual({g['order_id']:len(g['versions']) for g in history['orders']},{'A':1,'B':1})
        again=self.post('/api/calculate',d);self.assertEqual(again['status'],'duplicate')
        self.assertEqual({o['order_id'] for m in again['matches'] for o in m['orders']},{'A','B'})

    def test_pool_rounding_change_keeps_updated_order_in_batch(self):
        d=fixture();d['metadata']['is_demo']=False
        d['pools'][0].update(amount='0.01',total_base='2');d['bases'][0]['base']='1'
        first=self.post('/api/calculate',d)
        d['orders'].append(dict(d['orders'][0],order_id='B'))
        for table in ('materials','labor','bases','coverage'):
            extra=copy.deepcopy(d[table])
            for row in extra:
                row['order_id']='B'
                if 'record_id' in row:row['record_id']+='-B'
            d[table]+=extra
        result=self.post('/api/calculate',d)
        self.assertEqual({x['order_id'] for x in result['orders']},{'A','B'})
        old=next(x for x in first['allocations'] if x['pool_id']=='p1')['amount']
        new=next(x for x in result['allocations'] if x['pool_id']=='p1' and x['order_id']=='A')['amount']
        self.assertNotEqual(old,new)
