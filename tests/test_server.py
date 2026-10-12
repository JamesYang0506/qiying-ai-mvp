import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from server import create_server
from test_engine import fixture


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.server=create_server(0,Path(self.tmp.name))
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
