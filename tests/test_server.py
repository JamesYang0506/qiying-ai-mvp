import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from server import create_server, POST_ROUTES, LARGE_BODY_PATHS
from test_engine import fixture
from unittest.mock import Mock, patch


class ServerTests(unittest.TestCase):
    def test_report_and_favicon_static_routes(self):
        # Isolate static routing from files being authored by the frontend worker.
        with tempfile.TemporaryDirectory() as static_dir:
            root=Path(static_dir)
            (root/'web').mkdir()
            assets={'report.js':'text/javascript; charset=utf-8',
                    'report.css':'text/css; charset=utf-8',
                    'favicon.svg':'image/svg+xml'}
            with patch('server.ROOT',root):
                for filename,mime in assets.items():
                    content=('test '+filename).encode()
                    (root/'web'/filename).write_bytes(content)
                    with urllib.request.urlopen(self.url+'/'+filename) as response:
                        self.assertEqual(response.headers['Content-Type'],mime)
                        self.assertEqual(response.read(),content)
                with urllib.request.urlopen(self.url+'/favicon.ico') as response:
                    self.assertEqual(response.headers['Content-Type'],'image/svg+xml')
                    self.assertEqual(response.read(),(root/'web/favicon.svg').read_bytes())

    def test_training_export_endpoint_is_removed(self):
        req=urllib.request.Request(self.url+'/api/export-training',data=b'{}')
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(req)
        self.assertEqual(error.exception.code,404)
        self.assertEqual(json.load(error.exception),{'error':'接口不存在'})

    def test_export_uses_saved_snapshot_and_selected_orders(self):
        import io
        import zipfile
        req=urllib.request.Request(self.url+'/api/calculate',data=json.dumps(fixture()).encode())
        with urllib.request.urlopen(req) as response: result=json.load(response)
        sid=result['snapshot']['snapshot_id']
        path=Path(self.tmp.name)/(sid+'.json')
        result['orders'].append(dict(result['orders'][0],order_id='OTHER'))
        result['costs'].append({'order_id':'OTHER','record_id':'foreign','amount':'999'})
        result['source_analysis']={'order_id':'OTHER','private':'not selected'}
        path.write_text(json.dumps(result),encoding='utf-8')
        before=path.read_bytes()
        payload={'snapshot_id':sid,'order_ids':['A']}
        req=urllib.request.Request(self.url+'/api/export',data=json.dumps(payload).encode())
        with urllib.request.urlopen(req) as response:
            self.assertEqual(response.headers['Content-Type'],'application/zip')
            with zipfile.ZipFile(io.BytesIO(response.read())) as z:
                exported=json.loads(z.read('result.json'))
                self.assertEqual([row['order_id'] for row in exported['orders']],['A'])
                self.assertEqual(exported['snapshot']['export_scope'],['A'])
                self.assertNotIn('source_analysis',exported)
                self.assertNotIn('foreign',z.read('costs.csv').decode())
                self.assertEqual(set(z.namelist()),{'orders.csv','costs.csv','allocations.csv','issues.csv','snapshot.json','result.json'})
            self.assertIn('profit-results.zip',response.headers['Content-Disposition'])
        self.assertEqual(path.read_bytes(),before)
        for order_ids in (['UNKNOWN'],None,'A'):
            req=urllib.request.Request(self.url+'/api/export',data=json.dumps(dict(payload,order_ids=order_ids)).encode())
            with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(req)
            self.assertEqual(error.exception.code,400)

    def test_ai_gateway_prepares_snapshot_without_fake_result(self):
        with urllib.request.urlopen(self.url+'/api/ai/status') as response:status=json.load(response)
        self.assertFalse(status['configured'])
        request=urllib.request.Request(self.url+'/api/calculate',data=json.dumps(fixture()).encode())
        with urllib.request.urlopen(request) as response:result=json.load(response)
        sid=result['snapshot']['snapshot_id']
        result['costs'].append({'order_id':'OTHER','record_id':'foreign','amount':'999'})
        result['source_analysis']={'order_id':'OTHER','private':'not selected'}
        (Path(self.tmp.name)/(sid+'.json')).write_text(json.dumps(result),encoding='utf-8')
        request=urllib.request.Request(self.url+'/api/ai/analyze',data=json.dumps({'snapshot_id':sid,'order_id':'A','focus':'decision','question':'追加订单前要注意什么？'}).encode())
        with urllib.request.urlopen(request) as response:analysis=json.load(response)
        self.assertEqual(analysis['status'],'not_configured')
        self.assertIsNone(analysis['result'])
        self.assertEqual(analysis['context']['order']['order_id'],'A')
        self.assertTrue(all(x['order_id']=='A' for x in analysis['context']['costs']))
        self.assertEqual(analysis['context']['snapshot']['snapshot_id'],sid)
        self.assertNotIn('source_analysis',analysis['context'])
        request=urllib.request.Request(self.url+'/api/ai/analyze',data=json.dumps({'snapshot_id':sid,'order_id':'UNKNOWN','focus':'decision'}).encode())
        with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(request)
        self.assertEqual(e.exception.code,400)

    def test_ai_gateway_rejects_bad_snapshot_or_order(self):
        for payload in ({'snapshot_id':'../latest','order_id':'A','focus':'cost'}, {'snapshot_id':'missing-snapshot','order_id':'A','focus':'invalid'}):
            req=urllib.request.Request(self.url+'/api/ai/analyze',data=json.dumps(payload).encode())
            with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(req)
            self.assertEqual(e.exception.code,400)

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.client=Mock()
        self.client.status.return_value={'configured':False,'status':'not_configured','message':'test: no provider'}
        self.server=create_server(0,Path(self.tmp.name),analysis_client=self.client)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True); self.thread.start()
        self.url=f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(); self.tmp.cleanup()

    def test_calculation_persists_snapshot_and_export_uses_it(self):
        req=urllib.request.Request(self.url+'/api/calculate',data=json.dumps(fixture()).encode(),headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req) as response: r=json.load(response)
        self.assertEqual(r['orders'][0]['management_profit'],'4350.00')
        self.assertTrue((Path(self.tmp.name)/(r['snapshot']['snapshot_id']+'.json')).exists())
        req=urllib.request.Request(self.url+'/api/export',data=json.dumps({'snapshot_id':r['snapshot']['snapshot_id'],'order_ids':['A']}).encode(),headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req) as response: self.assertTrue(response.read().startswith(b'PK'))

    def test_cross_origin_and_private_paths_rejected(self):
        req=urllib.request.Request(self.url+'/api/calculate',data=b'{}',headers={'Origin':'https://example.com'})
        with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(req)
        self.assertEqual(e.exception.code,403)
        with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(self.url+'/../.env')
        self.assertEqual(e.exception.code,404)

    def test_invalid_payload_returns_readable_error(self):
        req=urllib.request.Request(self.url+'/api/calculate',data=b'{}')
        with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(req)
        self.assertEqual(e.exception.code,400)
        self.assertIn('error',json.load(e.exception))

    def test_real_input_current_snapshot_restores_without_recalculation(self):
        d=fixture();d['metadata']['is_demo']=False
        req=urllib.request.Request(self.url+'/api/calculate',data=json.dumps(d).encode())
        with urllib.request.urlopen(req) as response:r=json.load(response)
        with urllib.request.urlopen(self.url+'/api/current') as response:restored=json.load(response)
        self.assertEqual(restored['snapshot']['snapshot_id'],r['snapshot']['snapshot_id'])

    def test_local_model_result_is_saved_separately_and_citations_validated(self):
        req=urllib.request.Request(self.url+'/api/calculate',data=json.dumps(fixture()).encode())
        with urllib.request.urlopen(req) as response:r=json.load(response)
        snapshot_path=Path(self.tmp.name)/(r['snapshot']['snapshot_id']+'.json')
        original=snapshot_path.read_bytes()
        self.client.status.return_value={'configured':True,'model':'test-local','model_digest':'test-digest'}
        answer={'summary':'测试输出','risks':[], 'recommendations':[{'action':'核对收入','reason':'使用订单收入','conditions':'确认税口径','evidence_ids':['metric:revenue']}],'unknowns':[]}
        self.client.generate.return_value={'result':answer,'model':'test-local','provider':'ollama'}
        payload={'snapshot_id':r['snapshot']['snapshot_id'],'order_id':'A','focus':'decision'}
        req=urllib.request.Request(self.url+'/api/ai/analyze',data=json.dumps(payload).encode())
        with urllib.request.urlopen(req) as response:analysis=json.load(response)
        self.assertEqual(analysis['status'],'completed')
        self.assertFalse(analysis['reviewed'])
        self.assertEqual(snapshot_path.read_bytes(),original)
        self.assertTrue((Path(self.tmp.name)/'ai-analyses'/(analysis['request_id']+'.json')).exists())
        answer['recommendations'][0]['evidence_ids']=['not-a-real-fact']
        req=urllib.request.Request(self.url+'/api/ai/analyze',data=json.dumps(payload).encode())
        with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(req)
        self.assertEqual(e.exception.code,400)

    def test_post_route_table_dispatches_every_registered_path(self):
        # 路由表与分派同源：登记即进入处理函数，不会静默落到兜底分支；未登记一律 404。
        self.assertTrue(LARGE_BODY_PATHS <= set(POST_ROUTES),'放宽上限的路径必须已登记')
        for path in POST_ROUTES:
            req=urllib.request.Request(self.url+path,data=b'{}')
            with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(req)
            self.assertNotIn('接口不存在',e.exception.read().decode(),f'{path} 未进入处理函数')
        req=urllib.request.Request(self.url+'/api/not-a-route',data=b'{}')
        with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(req)
        self.assertEqual(e.exception.code,404)
        self.assertIn('接口不存在',e.exception.read().decode())
