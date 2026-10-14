"""Local-only dashboard server. Run: python server.py --port 8765."""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import base64
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from profit_model.files import (
    empty_template,
    workbook_bytes,
    read_workbook,
    export_bundle,
)
from profit_model.analysis_gateway import run_analysis
from profit_model.ollama_client import OllamaClient
from profit_model.history import (
    list_history,
    read_history,
    set_deleted,
    visible_snapshot,
)
from profit_model.excel_import import preview_excel, confirmed_excel, auto_excel
import threading
import hashlib
from profit_model.workflows import calculate_and_save, prepare_export
from profit_model.theory import preview_theory, theory_template
from profit_model.comparison_store import (
    workspace,
    create_baseline,
    bind_baseline,
    check_order,
    save_rules,
    update_event,
)

ROOT = Path(__file__).resolve().parent
MAX_BODY = 10 * 1024 * 1024
# Excel 文件仍限 10MB；JSON 内的 base64 约增大三分之一，15MB 仅作封装运输余量。
LARGE_BODY = 15 * 1024 * 1024
LARGE_BODY_PATHS = frozenset(
    {
        '/api/preview-xlsx',
        '/api/import-reviewed-xlsx',
        '/api/auto-import-xlsx',
        '/api/theory/preview',
    }
)

# POST 路由表：路径 -> Handler 方法名。允许清单与分派同源，避免两处清单不同步。
POST_ROUTES = {
    '/api/calculate': 'handle_calculation',
    '/api/import-xlsx': 'handle_calculation',  # 仅内部/测试：标准模板直接导入。
    '/api/preview-xlsx': 'handle_excel',
    '/api/import-reviewed-xlsx': 'handle_excel',
    '/api/auto-import-xlsx': 'handle_excel',
    '/api/export': 'handle_export',
    '/api/ai/analyze': 'handle_analysis',
    '/api/history/delete': 'handle_history',
    '/api/history/restore': 'handle_history',
    '/api/theory': 'handle_theory_comparison',
    '/api/theory/bind': 'handle_theory_comparison',
    '/api/theory/preview': 'handle_theory_comparison',
    '/api/comparison/check': 'handle_theory_comparison',
    '/api/comparison/rules': 'handle_theory_comparison',
    '/api/comparison/event': 'handle_theory_comparison',
}


def create_server(port=8765, snapshot_dir=None, analysis_client=None):
    storage = Path(snapshot_dir) if snapshot_dir else ROOT / 'reports' / 'snapshots'
    client = analysis_client if analysis_client is not None else OllamaClient()
    analysis_lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def send(
            self,
            content,
            status=200,
            content_type='application/json; charset=utf-8',
            filename=None,
        ):
            if isinstance(content, (dict, list)):
                content = json.dumps(
                    content, ensure_ascii=False, allow_nan=False
                ).encode('utf-8')
            elif isinstance(content, str):
                content = content.encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header(
                'Content-Security-Policy',
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
            )
            if filename:
                self.send_header(
                    'Content-Disposition', f'attachment; filename="{filename}"'
                )
            self.end_headers()
            self.wfile.write(content)

        def valid_host(self):
            return self.headers.get('Host') in (
                f'127.0.0.1:{self.server.server_port}',
                f'localhost:{self.server.server_port}',
            )

        def do_GET(self):
            if not self.valid_host():
                return self.send({'error': '无效本地主机'}, 403)
            path = urlparse(self.path).path
            static = {
                '/': ('index.html', 'text/html; charset=utf-8'),
                '/util.js': ('util.js', 'text/javascript; charset=utf-8'),
                '/app.js': ('app.js', 'text/javascript; charset=utf-8'),
                '/source.js': ('source.js', 'text/javascript; charset=utf-8'),
                '/history.js': ('history.js', 'text/javascript; charset=utf-8'),
                '/import.js': ('import.js', 'text/javascript; charset=utf-8'),
                '/style.css': ('style.css', 'text/css; charset=utf-8'),
                '/comparison.js': ('comparison.js', 'text/javascript; charset=utf-8'),
                '/comparison.css': ('comparison.css', 'text/css; charset=utf-8'),
                '/report.js': ('report.js', 'text/javascript; charset=utf-8'),
                '/report.css': ('report.css', 'text/css; charset=utf-8'),
                '/favicon.svg': ('favicon.svg', 'image/svg+xml'),
                '/favicon.ico': ('favicon.svg', 'image/svg+xml'),
            }
            try:
                if path in static:
                    name, mime = static[path]
                    return self.send(
                        (ROOT / 'web' / name).read_bytes(), content_type=mime
                    )
                if path == '/api/demo':
                    return self.send(
                        json.loads(
                            (ROOT / 'data/samples/demo.json').read_text(
                                encoding='utf-8'
                            )
                        )
                    )
                if path == '/api/comparison':
                    query = parse_qs(urlparse(self.path).query)
                    if (
                        len(query.get('snapshot_id', [])) != 1
                        or len(query.get('order_id', [])) != 1
                    ):
                        raise ValueError('请选择订单及分析版本')
                    return self.send(
                        workspace(
                            storage, query['snapshot_id'][0], query['order_id'][0]
                        )
                    )
                if path == '/api/theory/template.xlsx':
                    return self.send(
                        theory_template(),
                        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        filename='theory-margin-template.xlsx',
                    )
                if path == '/api/current':
                    current = storage / 'latest.json'
                    data = (
                        visible_snapshot(
                            storage, json.loads(current.read_text(encoding='utf-8'))
                        )
                        if current.exists()
                        else None
                    )
                    return self.send(data or {'current': None})
                if path == '/api/history/trash':
                    return self.send(list_history(storage, deleted=True))
                if path == '/api/history':
                    return self.send(list_history(storage))
                if path.startswith('/api/history/'):
                    values = parse_qs(urlparse(self.path).query).get('order_id', [])
                    if len(values) != 1:
                        raise ValueError('请选择一个历史订单')
                    return self.send(
                        read_history(
                            storage, path.removeprefix('/api/history/'), values[0]
                        )
                    )
                if path == '/api/ai/status':
                    return self.send(client.status())
                if path == '/api/template':
                    return self.send(empty_template(), filename='profit-template.json')
                if path in ('/api/template.xlsx', '/api/example.xlsx'):
                    data = (
                        empty_template()
                        if path == '/api/template.xlsx'
                        else json.loads(
                            (ROOT / 'data/samples/demo.json').read_text(
                                encoding='utf-8'
                            )
                        )
                    )
                    return self.send(
                        workbook_bytes(data),
                        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        filename=(
                            'profit-template.xlsx'
                            if path == '/api/template.xlsx'
                            else 'profit-demo.xlsx'
                        ),
                    )
                return self.send({'error': '页面不存在'}, 404)
            except (ValueError, TypeError, KeyError, AttributeError, OSError) as e:
                return self.send({'error': str(e)}, 400)

        def do_POST(self):
            origin = self.headers.get('Origin')
            if not self.valid_host() or (
                origin is not None
                and origin
                not in (
                    f'http://127.0.0.1:{self.server.server_port}',
                    f'http://localhost:{self.server.server_port}',
                )
            ):
                return self.send({'error': '仅允许本机同源操作'}, 403)
            try:
                path = urlparse(self.path).path
                handler = POST_ROUTES.get(path)
                if handler is None:
                    return self.send({'error': '接口不存在'}, 404)
                length = int(self.headers.get('Content-Length', '0'))
                limit = LARGE_BODY if path in LARGE_BODY_PATHS else MAX_BODY
                if length <= 0 or length > limit:
                    return self.send(
                        {'error': f'请求体须大于 0 且不超过 {limit // (1024 * 1024)}MB；Excel 文件上限为 10MB'},
                        413,
                    )
                content = self.rfile.read(length)
                return getattr(self, handler)(path, content)
            except (
                ValueError,
                TypeError,
                KeyError,
                AttributeError,
                RecursionError,
            ) as e:
                self.send({'error': str(e) or '输入结构不合法'}, 400)
            except Exception:
                self.send({'error': '服务处理失败，请检查文件结构与本地存储权限'}, 500)

        def handle_history(self, path, content):
            payload = json.loads(content)
            if not isinstance(payload, dict) or payload.get('confirmed') is not True:
                raise ValueError('请确认操作的订单及分析版本')
            return self.send(
                set_deleted(
                    storage,
                    payload.get('snapshot_id'),
                    payload.get('order_id'),
                    path.endswith('/delete'),
                )
            )

        def handle_theory_comparison(self, path, content):
            payload = json.loads(content)
            if not isinstance(payload, dict):
                raise ValueError('请求必须是对象')
            if path == '/api/theory/preview':
                encoded = payload.get('workbook_base64')
                if not isinstance(encoded, str):
                    raise ValueError('请选择理论利润Excel文件')
                return self.send(
                    preview_theory(base64.b64decode(encoded, validate=True))
                )
            handlers = {
                '/api/theory': create_baseline,
                '/api/theory/bind': bind_baseline,
                '/api/comparison/check': check_order,
                '/api/comparison/rules': save_rules,
                '/api/comparison/event': update_event,
            }
            return self.send(handlers[path](storage, payload))

        def handle_calculation(self, path, content):
            data = (
                read_workbook(content)
                if path == '/api/import-xlsx'
                else json.loads(content)
            )
            source_hash = (
                hashlib.sha256(content).hexdigest()
                if path == '/api/import-xlsx'
                else None
            )
            return self.send(calculate_and_save(data, storage, source_hash=source_hash))

        def handle_excel(self, path, content):
            payload = json.loads(content)
            if not isinstance(payload, dict) or not isinstance(
                payload.get('workbook_base64'), str
            ):
                raise ValueError('请选择有效Excel文件')
            binary = base64.b64decode(payload['workbook_base64'], validate=True)
            if path == '/api/preview-xlsx':
                return self.send(preview_excel(binary, payload.get('mapping')))
            if path == '/api/auto-import-xlsx':
                adapted = auto_excel(binary, payload.get('profiles'))
                if adapted['status'] == 'needs_review':
                    return self.send(adapted)
                data = adapted['data']
            else:
                if payload.get('confirmed') is not True:
                    raise ValueError('请先预览并确认字段和单位')
                data = confirmed_excel(
                    binary, payload.get('mapping', {}), payload.get('source_hash')
                )
            review = data['metadata'].get(
                'import_review',
                {'mode': 'reviewed', 'source_hash': payload.get('source_hash')},
            )
            outcome = calculate_and_save(
                data,
                storage,
                source_hash=hashlib.sha256(binary).hexdigest(),
                import_review=review,
            )
            if path == '/api/auto-import-xlsx' and outcome.get('status') != 'duplicate':
                outcome = {'status': 'imported', 'result': outcome}
            return self.send(outcome)

        def handle_analysis(self, path, content):
            if not analysis_lock.acquire(blocking=False):
                return self.send({'error': '本地模型正在分析另一请求，请稍后再试'}, 409)
            try:
                return self.send(run_analysis(json.loads(content), storage, client))
            finally:
                analysis_lock.release()

        def handle_export(self, path, content):
            result = prepare_export(json.loads(content), storage)
            return self.send(
                export_bundle(result),
                content_type='application/zip',
                filename='profit-results.zip',
            )

    return ThreadingHTTPServer(('127.0.0.1', port), Handler)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    server = create_server(args.port)
    print(f'Profit dashboard: http://127.0.0.1:{server.server_port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
