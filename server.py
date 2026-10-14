"""Local-only dashboard server. Run: python server.py --port 8765."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import base64
from pathlib import Path
import re
from urllib.parse import urlparse, parse_qs
from profit_model.engine import calculate
from profit_model.files import empty_template, workbook_bytes, read_workbook, export_bundle, export_training_bundle
from profit_model.analysis_gateway import run_analysis
from profit_model.ollama_client import OllamaClient
from profit_model.history import list_history, read_history
from profit_model.excel_import import preview_excel, confirmed_excel, auto_excel
import threading

ROOT=Path(__file__).resolve().parent
MAX_BODY=10*1024*1024


def create_server(port=8765, snapshot_dir=None, analysis_client=None):
    storage=Path(snapshot_dir) if snapshot_dir else ROOT/'reports'/'snapshots'
    client=analysis_client if analysis_client is not None else OllamaClient()
    analysis_lock=threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass

        def send(self,content,status=200,content_type='application/json; charset=utf-8',filename=None):
            if isinstance(content,(dict,list)): content=json.dumps(content,ensure_ascii=False,allow_nan=False).encode('utf-8')
            elif isinstance(content,str): content=content.encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type',content_type)
            self.send_header('Content-Length',str(len(content)))
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'")
            if filename: self.send_header('Content-Disposition',f'attachment; filename="{filename}"')
            self.end_headers(); self.wfile.write(content)

        def valid_host(self):
            return self.headers.get('Host') in (f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}')

        def do_GET(self):
            if not self.valid_host(): return self.send({'error':'无效本地主机'},403)
            path=urlparse(self.path).path
            static={'/':('index.html','text/html; charset=utf-8'),'/app.js':('app.js','text/javascript; charset=utf-8'),'/source.js':('source.js','text/javascript; charset=utf-8'),'/history.js':('history.js','text/javascript; charset=utf-8'),'/import.js':('import.js','text/javascript; charset=utf-8'),'/style.css':('style.css','text/css; charset=utf-8')}
            try:
                if path in static:
                    name,mime=static[path]; return self.send((ROOT/'web'/name).read_bytes(),content_type=mime)
                if path=='/api/demo': return self.send(json.loads((ROOT/'data/samples/demo.json').read_text(encoding='utf-8')))
                if path=='/api/current':
                    current=storage/'latest.json'
                    return self.send(json.loads(current.read_text(encoding='utf-8')) if current.exists() else {'current':None})
                if path=='/api/history':return self.send(list_history(storage))
                if path.startswith('/api/history/'):
                    values=parse_qs(urlparse(self.path).query).get('order_id',[])
                    if len(values)!=1:raise ValueError('请选择一个历史订单')
                    return self.send(read_history(storage,path.removeprefix('/api/history/'),values[0]))
                if path=='/api/ai/status': return self.send(client.status())
                if path=='/api/template': return self.send(empty_template(),filename='profit-template.json')
                if path in ('/api/template.xlsx','/api/example.xlsx'):
                    data=empty_template() if path=='/api/template.xlsx' else json.loads((ROOT/'data/samples/demo.json').read_text(encoding='utf-8'))
                    return self.send(workbook_bytes(data),content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',filename='profit-template.xlsx' if path=='/api/template.xlsx' else 'profit-demo.xlsx')
                return self.send({'error':'页面不存在'},404)
            except ValueError as e: return self.send({'error':str(e)},400)

        def do_POST(self):
            origin=self.headers.get('Origin')
            if not self.valid_host() or (origin is not None and origin not in (f'http://127.0.0.1:{self.server.server_port}',f'http://localhost:{self.server.server_port}')):
                return self.send({'error':'仅允许本机同源操作'},403)
            try:
                path=urlparse(self.path).path
                length=int(self.headers.get('Content-Length','0'))
                limit=15*1024*1024 if path in ('/api/preview-xlsx','/api/import-reviewed-xlsx','/api/auto-import-xlsx') else MAX_BODY
                if length<=0 or length>limit: return self.send({'error':'文件须在 0～10MB 之间'},413)
                if path not in ('/api/calculate','/api/import-xlsx','/api/export','/api/export-training','/api/ai/analyze','/api/preview-xlsx','/api/import-reviewed-xlsx','/api/auto-import-xlsx'):
                    return self.send({'error':'接口不存在'},404)
                content=self.rfile.read(length)
                reviewed_data=None
                if path in ('/api/preview-xlsx','/api/import-reviewed-xlsx','/api/auto-import-xlsx'):
                    payload=json.loads(content)
                    if not isinstance(payload,dict) or not isinstance(payload.get('workbook_base64'),str):raise ValueError('请选择有效Excel文件')
                    binary=base64.b64decode(payload['workbook_base64'],validate=True)
                    if path=='/api/preview-xlsx':return self.send(preview_excel(binary,payload.get('mapping')))
                    if path=='/api/auto-import-xlsx':
                        adapted=auto_excel(binary,payload.get('profiles'))
                        if adapted['status']=='needs_review':return self.send(adapted)
                        reviewed_data=adapted['data']
                    else:
                        if payload.get('confirmed') is not True:raise ValueError('请先预览并确认字段和单位')
                        reviewed_data=confirmed_excel(binary,payload.get('mapping',{}),payload.get('source_hash'))
                if path=='/api/ai/analyze':
                    if not analysis_lock.acquire(blocking=False):return self.send({'error':'本地模型正在分析另一请求，请稍后再试'},409)
                    try:return self.send(run_analysis(json.loads(content),storage,client))
                    finally:analysis_lock.release()
                if path in ('/api/export','/api/export-training'):
                    request=json.loads(content)
                    sid=request.get('snapshot_id','')
                    if not isinstance(sid,str) or not re.fullmatch(r'[A-Za-z0-9-]{10,80}',sid):
                        raise ValueError('无效快照编号')
                    file=storage/(sid+'.json')
                    if not file.is_file(): raise ValueError('计算快照不存在，请重新计算')
                    result=json.loads(file.read_text(encoding='utf-8'))
                    selected=request.get('order_ids')
                    if not isinstance(selected,list) or any(not isinstance(x,str) for x in selected):
                        raise ValueError('导出订单范围无效')
                    ids=set(selected)
                    if path=='/api/export-training' and (not ids or len(ids)!=len(selected)):
                        raise ValueError('请导出至少一笔订单，订单编号不能重复')
                    if not ids.issubset({x['order_id'] for x in result['orders']}): raise ValueError('导出包含未知订单')
                    for table in ('orders','costs','allocations','issues'):
                        result[table]=[x for x in result[table] if x.get('order_id') in ids]
                    if result.get('source_analysis',{}).get('order_id') not in ids:result.pop('source_analysis',None)
                    result['snapshot']['export_scope']=selected
                    if path=='/api/export-training':
                        return self.send(export_training_bundle(result),content_type='application/zip',filename='order-training-candidates.zip')
                    return self.send(export_bundle(result),content_type='application/zip',filename='profit-results.zip')
                data=reviewed_data if reviewed_data is not None else read_workbook(content) if path=='/api/import-xlsx' else json.loads(content)
                result=calculate(data)
                if reviewed_data is not None:
                    result['snapshot']['import_review']=data['metadata'].get('import_review',{'mode':'reviewed','source_hash':payload.get('source_hash')})
                storage.mkdir(parents=True,exist_ok=True)
                target=storage/(result['snapshot']['snapshot_id']+'.json')
                temp=target.with_suffix('.tmp')
                temp.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8'); temp.replace(target)
                if not result['snapshot']['is_demo']:
                    current=storage/'latest.json'
                    current_temp=current.with_suffix('.tmp')
                    current_temp.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');current_temp.replace(current)
                self.send({'status':'imported','result':result} if path=='/api/auto-import-xlsx' else result)
            except (ValueError,TypeError,KeyError,AttributeError,RecursionError) as e:
                self.send({'error':str(e) or '输入结构不合法'},400)
            except Exception:
                self.send({'error':'服务处理失败，请检查文件结构与本地存储权限'},500)

    return ThreadingHTTPServer(('127.0.0.1',port),Handler)


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=8765)
    args=parser.parse_args()
    server=create_server(args.port)
    print(f'Profit dashboard: http://127.0.0.1:{server.server_port}',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
