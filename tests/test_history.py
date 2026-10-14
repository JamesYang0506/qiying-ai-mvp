import copy
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from unittest.mock import Mock
from profit_model.engine import calculate
from server import create_server
from test_engine import fixture


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.storage=Path(self.tmp.name)
        self.server=create_server(0,self.storage,Mock())
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.url=f'http://127.0.0.1:{self.server.server_port}'
        self.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join();self.tmp.cleanup()

    def save(self,sid='20261014T010000000000Z-aaaaaaaa',demo=False):
        data=fixture();data['metadata']['is_demo']=demo
        result=calculate(data);result['snapshot'].update(snapshot_id=sid,created_at='2026-10-14T01:00:00+00:00')
        (self.storage/(sid+'.json')).write_text(json.dumps(result),encoding='utf-8')
        return result

    def get(self,path):
        with self.opener.open(self.url+path) as response:return json.load(response)

    def test_history_groups_versions_and_preserves_zero_and_trial_basis(self):
        old=self.save();new=self.save('20261014T020000000000Z-bbbbbbbb',True)
        new['snapshot']['created_at']='2026-10-14T02:00:00+00:00'
        new['orders'][0]['production_profit']=None
        new['source_analysis']={'order_id':'A','metrics':{'production_profit':'0.00','management_reference_profit':'-5.00'}}
        (self.storage/(new['snapshot']['snapshot_id']+'.json')).write_text(json.dumps(new),encoding='utf-8')
        (self.storage/'latest.json').write_text(json.dumps(old),encoding='utf-8')
        result=self.get('/api/history')
        self.assertEqual(len(result['orders']),1)
        versions=result['orders'][0]['versions'];self.assertEqual(len(versions),2)
        self.assertEqual(versions[0]['production_profit'],'0.00')
        self.assertEqual(versions[0]['profit_basis'],'trial')
        self.assertTrue(versions[0]['is_demo'])
        self.assertEqual(versions[1]['profit_basis'],'standard')

    def test_selected_order_isolated_and_read_does_not_replace_current(self):
        result=self.save();sid=result['snapshot']['snapshot_id']
        result['orders'].append(dict(result['orders'][0],order_id='B',product='OTHER'))
        for table in ('costs','allocations','issues'):
            result[table].append({'order_id':'B','secret':'other-order'})
        result['source_analysis']={'order_id':'B','secret':'other-source'}
        (self.storage/(sid+'.json')).write_text(json.dumps(result),encoding='utf-8')
        (self.storage/'latest.json').write_text('current unchanged',encoding='utf-8')
        before={p.name:p.read_bytes() for p in self.storage.glob('*.json')}
        read=self.get('/api/history/'+sid+'?order_id=A')
        self.assertEqual(len(read['orders']),1)
        self.assertEqual(read['orders'][0]['order_id'],'A')
        self.assertNotIn('other-order',json.dumps(read));self.assertNotIn('source_analysis',read)
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.storage.glob('*.json')})

    def test_corrupt_and_non_snapshot_files_do_not_break_history(self):
        self.save()
        (self.storage/'20261014T030000000000Z-cccccccc.json').write_text('{',encoding='utf-8')
        (self.storage/'20261014T040000000000Z-dddddddd.json').write_text('[]',encoding='utf-8')
        (self.storage/'latest.json').write_text('broken current',encoding='utf-8')
        (self.storage/'unrelated.json').write_text('not a snapshot',encoding='utf-8')
        result=self.get('/api/history')
        self.assertEqual(len(result['orders']),1);self.assertEqual(result['skipped_files'],2)

    def test_invalid_ids_missing_orders_and_missing_snapshots_are_rejected(self):
        result=self.save();sid=result['snapshot']['snapshot_id']
        for path in ['/api/history/..%2F..%2Fsecret?order_id=A','/api/history/'+sid,'/api/history/'+sid+'?order_id=NO','/api/history/20261014T090000000000Z-eeeeeeee?order_id=A']:
            with self.subTest(path=path),self.assertRaises(urllib.error.HTTPError) as e:self.get(path)
            self.assertIn(e.exception.code,(400,404))

    def test_incompatible_source_structure_is_skipped(self):
        for i,source in enumerate((['incompatible'],{'order_id':'A','metrics':[]})):
            result=self.save(f'20261014T0{i}0000000000Z-ffffffff')
            result['source_analysis']=source
            (self.storage/(result['snapshot']['snapshot_id']+'.json')).write_text(json.dumps(result),encoding='utf-8')
        result=self.get('/api/history')
        self.assertEqual(result['orders'],[]);self.assertEqual(result['skipped_files'],2)

    def test_null_optional_source_does_not_break_selected_order_read(self):
        result=self.save();sid=result['snapshot']['snapshot_id'];result['source_analysis']=None
        (self.storage/(sid+'.json')).write_text(json.dumps(result),encoding='utf-8')
        self.assertNotIn('source_analysis',self.get('/api/history/'+sid+'?order_id=A'))

    def test_saved_model_records_match_both_order_and_snapshot(self):
        from profit_model.analysis_gateway import run_analysis
        result=self.save();sid=result['snapshot']['snapshot_id']
        client=Mock();client.status.return_value={'configured':True,'model_digest':'test'}
        client.generate.return_value={'model':'test-model','duration_seconds':1,'result':{'summary':'Saved explanation','risks':[],'recommendations':[],'unknowns':[]}}
        response=run_analysis({'snapshot_id':sid,'order_id':'A','focus':'decision'},self.storage,client)
        other=copy.deepcopy(response);other['request']['order_id']='OTHER'
        (self.storage/'ai-analyses/other.json').write_text(json.dumps(other),encoding='utf-8')
        broken=copy.deepcopy(response);broken['result']['risks']='bad-array'
        (self.storage/'ai-analyses/broken.json').write_text(json.dumps(broken),encoding='utf-8')
        missing=copy.deepcopy(response);missing.pop('evidence')
        (self.storage/'ai-analyses/missing-evidence.json').write_text(json.dumps(missing),encoding='utf-8')
        read=self.get('/api/history/'+sid+'?order_id=A')
        self.assertEqual(len(read['analysis_records']),1)
        self.assertEqual(read['analysis_records'][0]['request_id'],response['request_id'])
        self.assertEqual(read['analysis_records'][0]['result']['summary'],'Saved explanation')
