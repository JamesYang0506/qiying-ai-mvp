import json
import unittest
import urllib.request
import urllib.error
from test_history import HistoryTests as _Setup


class HistoryTrashTests(unittest.TestCase):
    setUp=_Setup.setUp
    tearDown=_Setup.tearDown
    save=_Setup.save
    get=_Setup.get

    def post(self,path,sid,oid='A',confirmed=True):
        payload=json.dumps({'snapshot_id':sid,'order_id':oid,'confirmed':confirmed}).encode()
        request=urllib.request.Request(self.url+path,data=payload,headers={'Content-Type':'application/json'})
        with self.opener.open(request) as response:return json.load(response)

    def test_delete_one_version_and_restore_preserve_original_bytes(self):
        old=self.save();sid=old['snapshot']['snapshot_id']
        new=self.save('20261014T020000000000Z-bbbbbbbb')
        before={p.name:p.read_bytes() for p in self.storage.glob('*.json')}
        self.post('/api/history/delete',sid)
        h=self.get('/api/history');self.assertEqual(len(h['orders'][0]['versions']),1)
        trash=self.get('/api/history/trash');self.assertEqual(trash['orders'][0]['versions'][0]['snapshot_id'],sid)
        with self.assertRaises(urllib.error.HTTPError):self.get('/api/history/'+sid+'?order_id=A')
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.storage.glob('*.json')})
        self.post('/api/history/restore',sid)
        self.assertEqual(len(self.get('/api/history')['orders'][0]['versions']),2)
        self.assertEqual(self.get('/api/history/trash')['orders'],[])
        self.assertEqual(self.get('/api/history/'+sid+'?order_id=A')['orders'],old['orders'])

    def test_partial_current_delete_keeps_other_order_and_all_deleted_is_empty(self):
        data=self.save();sid=data['snapshot']['snapshot_id']
        data['orders'].append(dict(data['orders'][0],order_id='B'))
        for table in ('costs','allocations','issues'):data[table].append({'order_id':'B'})
        data['source_analysis']={'order_id':'A','metrics':{}}
        for name in (sid+'.json','latest.json'):(self.storage/name).write_text(json.dumps(data),encoding='utf-8')
        self.post('/api/history/delete',sid)
        current=self.get('/api/current');self.assertEqual([o['order_id'] for o in current['orders']],['B'])
        self.assertNotIn('source_analysis',current)
        self.assertTrue(all(x['order_id']=='B' for t in ('costs','allocations','issues') for x in current[t]))
        self.post('/api/history/delete',sid,'B')
        self.assertEqual(self.get('/api/current'),{'current':None})
        self.post('/api/history/restore',sid)
        self.assertEqual([o['order_id'] for o in self.get('/api/current')['orders']],['A'])

    def test_invalid_or_unconfirmed_deletions_write_nothing(self):
        sid=self.save()['snapshot']['snapshot_id']
        for bad_sid,oid,confirmed in [(sid,'A',False),(sid,'OTHER',True),('../latest','A',True)]:
            with self.assertRaises(urllib.error.HTTPError):self.post('/api/history/delete',bad_sid,oid,confirmed)
        self.assertEqual(self.get('/api/history/trash')['orders'],[])
        self.assertEqual(len(self.get('/api/history')['orders']),1)

    def test_deleted_record_cannot_export_or_prepare_model_analysis(self):
        from profit_model.analysis_gateway import prepare_analysis
        sid=self.save()['snapshot']['snapshot_id'];self.post('/api/history/delete',sid)
        payload=json.dumps({'snapshot_id':sid,'order_ids':['A']}).encode()
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.opener.open(urllib.request.Request(self.url+'/api/export',data=payload))
        self.assertEqual(error.exception.code,400)
        self.assertIn('回收站',json.load(error.exception)['error'])
        with self.assertRaises(ValueError):prepare_analysis({'snapshot_id':sid,'order_id':'A','focus':'profit'},self.storage)

    def test_delete_and_restore_are_idempotent_and_survive_reloading(self):
        from profit_model.history import list_history
        sid=self.save()['snapshot']['snapshot_id']
        for _ in range(2):self.post('/api/history/delete',sid)
        self.assertEqual(list_history(self.storage)['orders'],[])
        self.assertEqual(len(self.get('/api/history/trash')['orders']),1)
        for _ in range(2):self.post('/api/history/restore',sid)
        self.assertEqual(len(list_history(self.storage)['orders']),1)

del _Setup
