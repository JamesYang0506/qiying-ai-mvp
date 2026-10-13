"""Windows download-and-run entry point; persistent user data stays outside the bundle."""
import argparse
import json
import os
from pathlib import Path
import re
import sys
import webbrowser
from server import create_server

APP_VERSION='0.3.0'


def default_data_dir():
    root=Path(os.environ['LOCALAPPDATA']) if os.environ.get('LOCALAPPDATA') else Path.home()/'.local'/'share'
    return root/'QiYingProfit'


def lock_instance(directory):
    """OS-owned lock is automatically released if the console/app is closed."""
    handle=(directory/'desktop.lock').open('a+b')
    if handle.seek(0,2)==0:handle.write(b'0');handle.flush()
    handle.seek(0)
    if os.name=='nt':
        import msvcrt
        try:msvcrt.locking(handle.fileno(),msvcrt.LK_NBLCK,1)
        except OSError:handle.close();return None
    return handle


def main(argv=None):
    parser=argparse.ArgumentParser(description='QiYing Profit portable desktop launcher')
    parser.add_argument('--port',type=int,default=0,help='0 selects an available local port')
    parser.add_argument('--data-dir',type=Path,default=None)
    parser.add_argument('--no-browser',action='store_true')
    parser.add_argument('--version',action='version',version=APP_VERSION)
    args=parser.parse_args(argv)
    if not 0<=args.port<=65535:parser.error('port must be between 0 and 65535')
    data=(args.data_dir or default_data_dir()).resolve()
    data.mkdir(parents=True,exist_ok=True)
    lock=lock_instance(data)
    if lock is None:
        try:
            url=json.loads((data/'instance.json').read_text(encoding='utf-8'))['url']
            if re.fullmatch(r'http://127\.0\.0\.1:\d{1,5}/',url) and not args.no_browser:webbrowser.open(url)
        except (OSError,ValueError,KeyError,TypeError):pass
        print('QiYing Profit is already running. Use the existing browser window.',flush=True)
        return 0
    server=None
    try:
        server=create_server(args.port,data/'snapshots')
        url=f'http://127.0.0.1:{server.server_port}/'
        (data/'instance.json').write_text(json.dumps({'url':url,'pid':os.getpid(),'version':APP_VERSION}),encoding='utf-8')
        print(f'QiYing Profit v{APP_VERSION}',flush=True)
        print(f'Website: {url}',flush=True)
        print(f'Local data: {data}',flush=True)
        print('Keep this window open. Close it or press Ctrl+C to exit.',flush=True)
        if not args.no_browser:webbrowser.open(url)
        server.serve_forever()
    except KeyboardInterrupt:pass
    finally:
        if server:server.server_close()
        lock.close()
    return 0


if __name__=='__main__':
    try:sys.exit(main())
    except OSError as error:
        print(f'Unable to start QiYing Profit: {error}',flush=True)
        if getattr(sys,'frozen',False) and sys.stdin and sys.stdin.isatty():input('Press Enter to close...')
        sys.exit(1)
