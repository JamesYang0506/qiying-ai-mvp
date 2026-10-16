"""Local versioned targets, rules, observations and alert handling records."""

import copy
import hashlib
import json
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from .comparison import DEFAULT_RULES, evaluate, numeric, validate_rules
from .history import TRASH_LOCK, is_deleted
from .snapshots import SNAPSHOT_ID, atomic_write_text, load_snapshot
from .theory import normalize_baseline

_local = threading.local()
GROUPS = {
    'baselines',
    'bindings',
    'records',
    'current-records',
    'events',
    'watermarks',
    'rules',
    'settings',
    'handling',
}


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


def root(storage):
    storage = Path(storage).resolve()
    folder = storage / 'comparison-data'
    if folder.is_symlink() or folder.resolve().parent != storage:
        raise ValueError('对照资料路径无效')
    if not getattr(_local, 'active', False) and (folder / 'transaction.json').exists():
        with TRASH_LOCK:
            recover(folder)
    return folder


def recover(folder):
    """An interrupted comparison transaction rolls back before the next read/write."""
    journal = folder / 'transaction.json'
    if not journal.exists():
        return
    if journal.is_symlink():
        raise ValueError('对照事务文件路径无效')
    try:
        originals = json.loads(journal.read_text(encoding='utf-8'))
        if not isinstance(originals, dict):
            raise ValueError()
        for relative, content in originals.items():
            parts = Path(relative).parts
            if (
                len(parts) != 2
                or parts[0] not in GROUPS
                or not parts[1].endswith('.json')
                or content is not None
                and not isinstance(content, str)
            ):
                raise ValueError('对照恢复记录无效')
            target = folder / relative
            if (
                target.is_symlink()
                or target.parent.is_symlink()
                or target.resolve().parent != target.parent.resolve()
            ):
                raise ValueError('对照恢复路径无效')
            if content is None:
                target.unlink(missing_ok=True)
            else:
                atomic_write_text(target, content)
        journal.unlink()
    except (OSError, ValueError, TypeError):
        raise ValueError(
            '对照保存未完成且恢复失败，请检查存储权限与备份后重试'
        ) from None


@contextmanager
def transaction(storage):
    with TRASH_LOCK:
        if getattr(_local, 'active', False):
            yield
            return
        folder = root(storage)
        _local.active = True
        _local.originals = {}
        try:
            yield
            (folder / 'transaction.json').unlink(missing_ok=True)
        except Exception:
            recover(folder)
            raise
        finally:
            _local.active = False
            _local.originals = None


def file_path(storage, group, key):
    folder = root(storage) / group
    if folder.is_symlink() or folder.resolve().parent != root(storage):
        raise ValueError('对照资料子目录无效')
    path = folder / (key + '.json')
    if path.is_symlink() or path.resolve().parent != folder.resolve():
        raise ValueError('对照资料文件不可读取')
    return path


def read_one(storage, group, key):
    path = file_path(storage, group, key)
    if not path.exists():
        return None
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except (OSError, ValueError):
        raise ValueError('对照资料损坏，请检查本地备份') from None


def write_one(storage, group, key, value):
    path = file_path(storage, group, key)
    if getattr(_local, 'active', False):
        relative = str(path.relative_to(root(storage)))
        if relative not in _local.originals:
            _local.originals[relative] = (
                path.read_text(encoding='utf-8') if path.exists() else None
            )
            atomic_write_text(
                root(storage) / 'transaction.json',
                json.dumps(_local.originals, ensure_ascii=False),
            )
    atomic_write_text(
        path, json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)
    )


def rows(storage, group):
    folder = root(storage) / group
    if folder.is_symlink():
        raise ValueError('对照资料子目录无效')
    result = []
    for path in folder.glob('*.json'):
        result.append(read_one(storage, group, path.stem))
    return sorted(
        result,
        key=lambda row: (row.get('created_at', ''), row.get('id', '')),
        reverse=True,
    )


def actual(storage, sid, oid):
    if not isinstance(oid, str) or not oid or len(oid) > 200:
        raise ValueError('请选择有效订单')
    snapshot = load_snapshot(storage, sid)
    if is_deleted(storage, sid, oid):
        raise ValueError('该分析记录已在回收站，请先恢复')
    order = next((row for row in snapshot['orders'] if row['order_id'] == oid), None)
    if order is None:
        raise ValueError('所选订单不属于该快照')
    return snapshot, order


def visible(storage, sid, oid):
    try:
        actual(storage, sid, oid)
        return True
    except ValueError:
        return False


def confirmed(request):
    if not isinstance(request, dict) or request.get('confirmed') is not True:
        raise ValueError('请确认本次设置或操作')
    if 'scope_confirmed' in request and not isinstance(
        request['scope_confirmed'], bool
    ):
        raise ValueError('可比范围确认须为布尔值')


def active_rules(storage):
    return read_one(storage, 'settings', 'active-rules') or copy.deepcopy(DEFAULT_RULES)


def binding_key(sid, oid):
    return sid + '-' + hashlib.sha256(oid.encode()).hexdigest()


def baseline_id(value):
    if not isinstance(value, str) or not SNAPSHOT_ID.fullmatch(value):
        raise ValueError('理论版本编号无效')
    return value


def matching_baselines(storage, snapshot, oid):
    return [
        row
        for row in rows(storage, 'baselines')
        if row['actual_order_id'] == oid
        and row['is_demo'] == snapshot['snapshot'].get('is_demo', False)
    ]


def selected_baseline(storage, snapshot, order):
    sid = snapshot['snapshot']['snapshot_id']
    oid = order['order_id']
    binding = read_one(storage, 'bindings', binding_key(sid, oid))
    if binding:
        baseline = read_one(storage, 'baselines', baseline_id(binding['baseline_id']))
        if baseline is None:
            raise ValueError('绑定的理论版本不存在')
        return baseline, binding.get('scope_confirmed') is True
    # SRC is a product proxy, not a reliable business key. New snapshots need explicit binding.
    if oid.startswith('SRC-'):
        return None, False
    for baseline in matching_baselines(storage, snapshot, oid):
        quantity = baseline.get('quantity') or baseline.get('bound_quantity')
        if (
            baseline['business_order_id'] == oid
            and not baseline.get('batch_id')
            and quantity is not None
            and numeric(quantity) == numeric(order.get('quantity'))
            and baseline['unit'] == order['unit']
            and baseline['product'] == order.get('product')
        ):
            return baseline, baseline.get('scope_confirmed') is True
    return None, False


def business_key(snapshot, oid, baseline):
    if baseline:
        identity = [oid, baseline['business_order_id'], baseline.get('batch_id', '')]
    else:
        identity = [
            oid,
            snapshot['snapshot']['snapshot_id'] if oid.startswith('SRC-') else oid,
            '',
        ]
    return digest([identity, snapshot['snapshot'].get('is_demo', False)])


def observation_key(snapshot):
    snap = snapshot['snapshot']
    return [
        snap.get('cutoff_date') or '',
        snap.get('created_at') or '',
        snap['snapshot_id'],
    ]


def sync_events(storage, snapshot, record):
    stream = business_key(snapshot, record['order_id'], record['baseline'])
    observed = observation_key(snapshot)
    events = [row for row in rows(storage, 'events') if row['stream'] == stream]
    attached = []
    for metric, indicator in record['metrics'].items():
        related = [row for row in events if row['metric'] == metric]
        # Backfilled observations remain historical evidence and cannot resolve a later incident.
        watermark = read_one(storage, 'watermarks', stream + '-' + metric)
        if watermark and observed < watermark['last_observation']:
            continue
        write_one(
            storage, 'watermarks', stream + '-' + metric, {'last_observation': observed}
        )
        active = next(
            (
                row
                for row in related
                if row['detection_status'] == 'active'
                and visible(storage, row['last_snapshot_id'], row['order_id'])
            ),
            None,
        )
        if indicator['status'] in ('warning', 'focus', 'danger'):
            event = active or {
                'id': str(uuid4()),
                'created_at': now(),
                'first_seen': now(),
                'metric': metric,
                'stream': stream,
                'order_id': record['order_id'],
                'is_demo': record['is_demo'],
                'processing_status': 'pending',
                'note': '',
            }
            event.update(
                detection_status='active',
                severity=indicator['status'],
                message=indicator['message'],
                last_seen=now(),
                last_snapshot_id=record['snapshot_id'],
                last_observation=observed,
                recovered_at=None,
            )
            write_one(storage, 'events', event['id'], event)
            attached.append(copy.deepcopy(event))
        elif indicator['status'] == 'normal' and active:
            active.update(
                detection_status='recovered',
                recovered_at=now(),
                last_seen=now(),
                last_snapshot_id=record['snapshot_id'],
                last_observation=observed,
            )
            write_one(storage, 'events', active['id'], active)
            attached.append(copy.deepcopy(active))
        elif active:
            # Pending data never silently clears an existing alert.
            attached.append(copy.deepcopy(active))
    return attached


def _check(storage, snapshot, order):
    baseline, scope = selected_baseline(storage, snapshot, order)
    rules = active_rules(storage)
    sid = snapshot['snapshot']['snapshot_id']
    oid = order['order_id']
    signature = digest(
        [sid, oid, baseline['id'] if baseline else None, rules['version'], scope]
    )
    existing = next(
        (row for row in rows(storage, 'records') if row.get('signature') == signature),
        None,
    )
    if existing:
        active = read_one(storage, 'current-records', binding_key(sid, oid))
        if not active or active['record_id'] != existing['id']:
            sync_events(storage, snapshot, existing)
            write_one(
                storage,
                'current-records',
                binding_key(sid, oid),
                {'record_id': existing['id']},
            )
        return existing
    record = evaluate(snapshot, oid, baseline, rules, scope_confirmed=scope)
    record.update(
        id=str(uuid4()),
        created_at=now(),
        baseline=copy.deepcopy(baseline),
        rules=copy.deepcopy(rules),
        signature=signature,
    )
    record['events'] = sync_events(storage, snapshot, record)
    unresolved = [
        event for event in record['events'] if event['detection_status'] == 'active'
    ]
    if unresolved:
        rank = {'normal': 0, 'pending': 1, 'warning': 2, 'focus': 3, 'danger': 4}
        record['severity'] = max(
            [record['severity'], *(event['severity'] for event in unresolved)],
            key=rank.get,
        )
    write_one(storage, 'records', record['id'], record)
    write_one(
        storage, 'current-records', binding_key(sid, oid), {'record_id': record['id']}
    )
    return record


def workspace(storage, sid, oid):
    with TRASH_LOCK:
        snapshot, order = actual(storage, sid, oid)
        all_records = [
            row
            for row in rows(storage, 'records')
            if row['order_id'] == oid
            and row['is_demo'] == snapshot['snapshot'].get('is_demo', False)
            and visible(storage, row['snapshot_id'], oid)
        ]
        records = [row for row in all_records if row['snapshot_id'] == sid]
        pointer = read_one(storage, 'current-records', binding_key(sid, oid))
        current = next(
            (row for row in records if pointer and row['id'] == pointer['record_id']),
            records[0] if records else None,
        )
        baseline = (
            current['baseline']
            if current
            else selected_baseline(storage, snapshot, order)[0]
        )
        stream = business_key(snapshot, oid, baseline)
        events = []
        frozen = {row['id']: row for row in (current or {}).get('events', [])}
        for row in rows(storage, 'events'):
            if row['stream'] != stream or not visible(
                storage, row['last_snapshot_id'], oid
            ):
                continue
            if row['last_observation'] <= observation_key(snapshot):
                events.append(row)
            elif row['id'] in frozen:
                events.append(frozen[row['id']])
        trend = []
        seen = set()
        # Historical timelines stop at the selected actual snapshot's observation time.
        cutoff = observation_key(snapshot)
        selected_records = []
        for row in all_records:
            active = read_one(
                storage, 'current-records', binding_key(row['snapshot_id'], oid)
            )
            if active and active['record_id'] != row['id']:
                continue
            selected_records.append(row)
        for row in selected_records:
            if row['snapshot_id'] in seen:
                continue
            related_snapshot = load_snapshot(storage, row['snapshot_id'])
            if (
                observation_key(related_snapshot) > cutoff
                or business_key(related_snapshot, oid, row['baseline']) != stream
            ):
                continue
            trend.append(row)
            seen.add(row['snapshot_id'])
        trend.sort(key=lambda row: (row.get('cutoff_date') or '', row['created_at']))
        event_ids = {row['id'] for row in events}
        handling = [
            row
            for row in rows(storage, 'handling')
            if row.get('event_id') in event_ids
            and visible(storage, row['snapshot_id'], oid)
        ]
        return {
            'rules': active_rules(storage),
            'baselines': matching_baselines(storage, snapshot, oid),
            'comparison': current,
            'records': records,
            'events': events,
            'trend': trend,
            'handling': handling,
        }


def create_baseline(storage, request):
    confirmed(request)
    with transaction(storage):
        snapshot, order = actual(
            storage, request.get('snapshot_id'), request.get('order_id')
        )
        normalized = normalize_baseline(request.get('baseline'))
        if normalized['method'] == 'ratio' and 'unit' not in request['baseline']:
            normalized['unit'] = order['unit']
        oid = order['order_id']
        sid = snapshot['snapshot']['snapshot_id']
        if oid.startswith('SRC-') and normalized['business_order_id'] == oid:
            raise ValueError('款号不是独立业务订单号，请填写真实业务编号或批次对应编号')
        peers = [
            row
            for row in matching_baselines(storage, snapshot, oid)
            if row['business_order_id'] == normalized['business_order_id']
            and row.get('batch_id') == normalized.get('batch_id')
        ]
        baseline = dict(
            normalized,
            id=str(uuid4()),
            version=max((row['version'] for row in peers), default=0) + 1,
            created_at=now(),
            actual_order_id=oid,
            product=order.get('product'),
            bound_quantity=order.get('quantity'),
            is_demo=snapshot['snapshot'].get('is_demo', False),
            scope_confirmed=request.get('scope_confirmed') is True,
        )
        write_one(storage, 'baselines', baseline['id'], baseline)
        write_one(
            storage,
            'bindings',
            binding_key(sid, oid),
            {
                'baseline_id': baseline['id'],
                'scope_confirmed': baseline['scope_confirmed'],
            },
        )
        _check(storage, snapshot, order)
        return workspace(storage, sid, oid)


def bind_baseline(storage, request):
    confirmed(request)
    with transaction(storage):
        snapshot, order = actual(
            storage, request.get('snapshot_id'), request.get('order_id')
        )
        baseline = read_one(
            storage, 'baselines', baseline_id(request.get('baseline_id'))
        )
        if (
            not baseline
            or baseline['actual_order_id'] != order['order_id']
            or baseline['is_demo'] != snapshot['snapshot'].get('is_demo', False)
        ):
            raise ValueError('理论版本与当前订单或真实/模拟类型不匹配')
        write_one(
            storage,
            'bindings',
            binding_key(snapshot['snapshot']['snapshot_id'], order['order_id']),
            {
                'baseline_id': baseline['id'],
                'scope_confirmed': request.get('scope_confirmed') is True,
            },
        )
        _check(storage, snapshot, order)
        return workspace(
            storage, snapshot['snapshot']['snapshot_id'], order['order_id']
        )


def check_order(storage, request):
    if not isinstance(request, dict):
        raise ValueError('检测请求必须是对象')
    with transaction(storage):
        snapshot, order = actual(
            storage, request.get('snapshot_id'), request.get('order_id')
        )
        _check(storage, snapshot, order)
        return workspace(
            storage, snapshot['snapshot']['snapshot_id'], order['order_id']
        )


def save_rules(storage, request):
    confirmed(request)
    with transaction(storage):
        rules = validate_rules(request.get('rules'))
        rules.update(version=str(uuid4()), created_at=now())
        write_one(storage, 'rules', rules['version'], rules)
        write_one(storage, 'settings', 'active-rules', rules)
        return {'rules': rules}


def update_event(storage, request):
    confirmed(request)
    with transaction(storage):
        current = workspace(
            storage, request.get('snapshot_id'), request.get('order_id')
        )
        event = next(
            (row for row in current['events'] if row['id'] == request.get('event_id')),
            None,
        )
        if event is None:
            raise ValueError('所选预警不属于当前订单')
        snapshot, _ = actual(storage, request['snapshot_id'], request['order_id'])
        watermark = read_one(
            storage, 'watermarks', event['stream'] + '-' + event['metric']
        )
        if watermark and watermark['last_observation'] > observation_key(snapshot):
            raise ValueError('历史观测仅供回看，请在最新订单对照中处理预警')
        status = request.get('processing_status')
        note = request.get('note', '')
        if (
            status not in ('pending', 'acknowledged', 'in_progress', 'closed')
            or not isinstance(note, str)
            or len(note) > 2000
        ):
            raise ValueError('预警处理状态或备注无效（最多2000字）')
        event.update(processing_status=status, note=note, handled_at=now())
        write_one(storage, 'events', event['id'], event)
        entry = dict(
            event_id=event['id'],
            processing_status=status,
            note=note,
            created_at=now(),
            snapshot_id=request['snapshot_id'],
            order_id=request['order_id'],
            id=str(uuid4()),
        )
        write_one(storage, 'handling', entry['id'], entry)
        return workspace(storage, request['snapshot_id'], request['order_id'])


def auto_check(storage, snapshot):
    with transaction(storage):
        for order in snapshot['orders']:
            _check(storage, snapshot, order)
