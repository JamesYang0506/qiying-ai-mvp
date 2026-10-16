"""Order history with reversible per-order deletion; snapshots remain unchanged."""

import json
import hashlib
import threading
from datetime import datetime, timezone
from pathlib import Path
from .ollama_client import validate_result

from .snapshots import SNAPSHOT_ID, load_snapshot, select_orders, atomic_write_text

TRASH_LOCK = threading.RLock()


def deletion_path(storage, sid, oid):
    if not isinstance(sid, str) or not SNAPSHOT_ID.fullmatch(sid):
        raise ValueError('无效历史版本编号')
    if not isinstance(oid, str) or not oid or len(oid) > 200:
        raise ValueError('请选择有效历史订单')
    root = Path(storage).resolve()
    folder = root / 'history-trash'
    if folder.is_symlink() or folder.resolve().parent != root:
        raise ValueError('回收站路径无效')
    return folder / (sid + '-' + hashlib.sha256(oid.encode()).hexdigest() + '.json')


def is_deleted(storage, sid, oid):
    return deletion_path(storage, sid, oid).exists()


def set_deleted(storage, sid, oid, deleted):
    with TRASH_LOCK:
        data = load_snapshot(storage, sid)
        if not any(x['order_id'] == oid for x in data['orders']):
            raise ValueError('所选订单不属于该历史版本')
        target = deletion_path(storage, sid, oid)
        if target.is_symlink():
            raise ValueError('回收站文件不可操作')
        if deleted and not target.exists():
            atomic_write_text(
                target,
                json.dumps(
                    {
                        'snapshot_id': sid,
                        'order_id': oid,
                        'deleted_at': datetime.now(timezone.utc).isoformat(),
                    },
                    ensure_ascii=False,
                ),
            )
        elif not deleted:
            target.unlink(missing_ok=True)
    return {
        'status': 'deleted' if deleted else 'restored',
        'snapshot_id': sid,
        'order_id': oid,
    }


def visible_snapshot(storage, data):
    sid = data['snapshot']['snapshot_id']
    allowed = {
        x['order_id']
        for x in data['orders']
        if not is_deleted(storage, sid, x['order_id'])
    }
    if not allowed:
        return None
    return select_orders(data, allowed)


def list_history(storage, deleted=False):
    groups = {}
    skipped = 0
    for path in Path(storage).glob('*.json'):
        if not SNAPSHOT_ID.fullmatch(path.stem):
            continue
        try:
            data = load_snapshot(storage, path.stem)
        except ValueError:
            skipped += 1
            continue
        snap = data['snapshot']
        source = data.get('source_analysis') or {}
        for order in data['orders']:
            oid = order['order_id']
            if is_deleted(storage, snap['snapshot_id'], oid) != deleted:
                continue
            group = groups.setdefault(oid, {'order_id': oid, 'versions': []})
            trial = source.get('metrics') if source.get('order_id') == oid else None
            group['versions'].append(
                {
                    'snapshot_id': snap['snapshot_id'],
                    'created_at': snap.get('created_at', ''),
                    'cutoff_date': snap.get('cutoff_date', ''),
                    'is_demo': snap.get('is_demo', False),
                    'formula_version': snap.get('formula_version', ''),
                    'product': order.get('product', ''),
                    'customer': order.get('customer', ''),
                    'quantity': order.get('quantity'),
                    'unit': order.get('unit', ''),
                    'revenue': (
                        trial.get('revenue', order.get('revenue'))
                        if trial
                        else order.get('revenue')
                    ),
                    'production_profit': (
                        trial.get('production_profit')
                        if trial
                        else order.get('production_profit')
                    ),
                    'management_profit': (
                        trial.get('management_reference_profit')
                        if trial
                        else order.get('management_profit')
                    ),
                    'profit_basis': 'trial' if trial else 'standard',
                    'production_status': order.get('production_status'),
                    'management_status': order.get('management_status'),
                }
            )
    for group in groups.values():
        group['versions'].sort(
            key=lambda x: (x['created_at'], x['snapshot_id']), reverse=True
        )
    orders = sorted(
        groups.values(), key=lambda x: x['versions'][0]['created_at'], reverse=True
    )
    return {'orders': orders, 'skipped_files': skipped}


def read_history(storage, sid, order_id):
    if not isinstance(order_id, str) or not order_id or len(order_id) > 200:
        raise ValueError('请选择要查看的历史订单')
    data = load_snapshot(storage, sid)
    if is_deleted(storage, sid, order_id):
        raise ValueError('该分析记录已在回收站，请先恢复')
    if not any(x['order_id'] == order_id for x in data['orders']):
        raise ValueError('所选订单不属于该历史版本')
    data = select_orders(data, {order_id})
    records = []
    for path in (Path(storage) / 'ai-analyses').glob('*.json'):
        if path.is_symlink():
            continue
        try:
            record = json.loads(path.read_text(encoding='utf-8'))
            req = record.get('request', {})
            context = record.get('context', {})
            if req.get('snapshot_id') != sid or req.get('order_id') != order_id:
                continue
            if (
                context.get('order', {}).get('order_id') != order_id
                or context.get('snapshot', {}).get('snapshot_id') != sid
            ):
                continue
            if record.get('status') != 'completed' or not isinstance(
                record.get('result'), dict
            ):
                continue
            evidence = record.get('evidence')
            if not isinstance(evidence, list) or any(
                not isinstance(x, dict) or not isinstance(x.get('id'), str)
                for x in evidence
            ):
                continue
            validate_result(record['result'], {'facts': evidence})
            records.append(record)
        except (OSError, ValueError, TypeError, AttributeError, KeyError):
            continue
    records.sort(key=lambda x: str(x.get('created_at', '')), reverse=True)
    data['analysis_records'] = records
    return data
