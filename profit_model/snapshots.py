"""Shared snapshot selection and persistence; callers enforce order visibility."""

import json
import re
from pathlib import Path
from uuid import uuid4

SNAPSHOT_ID = re.compile(r'[A-Za-z0-9-]{10,80}')
ORDER_TABLES = ('orders', 'costs', 'allocations', 'issues')


def select_orders(data, order_ids, *, exclude=False):
    """Copy the result envelope and tables; selected row objects remain read-only.

    Exclusion preserves unscoped issues, as required when skipping duplicates.
    Inclusion drops them, as required for history and selected-order exports.
    """
    ids = set(order_ids)
    selected = dict(data, snapshot=dict(data['snapshot']))
    for table in ORDER_TABLES:
        selected[table] = [
            row for row in data[table] if (row.get('order_id') in ids) != exclude
        ]
    source_id = (data.get('source_analysis') or {}).get('order_id')
    if (source_id in ids) == exclude:
        selected.pop('source_analysis', None)
    return selected


def load_snapshot(
    storage,
    sid,
    *,
    invalid_message='无效历史版本编号',
    missing_message='历史版本不存在或不可读取',
):
    if not isinstance(sid, str) or not SNAPSHOT_ID.fullmatch(sid):
        raise ValueError(invalid_message)
    storage = Path(storage).resolve()
    path = storage / (sid + '.json')
    if path.is_symlink() or path.resolve().parent != storage or not path.is_file():
        raise ValueError(missing_message)
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(data, dict) or not isinstance(data.get('snapshot'), dict):
            raise ValueError()
        if data['snapshot'].get('snapshot_id') != sid:
            raise ValueError()
        if not isinstance(data['snapshot'].get('created_at', ''), str):
            raise ValueError()
        source = data.get('source_analysis')
        if source is not None:
            if not isinstance(source, dict):
                raise ValueError()
            if 'metrics' in source and not isinstance(source['metrics'], dict):
                raise ValueError()
        for table in ORDER_TABLES:
            if not isinstance(data.get(table), list) or any(
                not isinstance(row, dict) for row in data[table]
            ):
                raise ValueError()
        if any(
            not isinstance(row.get('order_id'), str) or not row['order_id']
            for row in data['orders']
        ):
            raise ValueError()
        return data
    except (OSError, ValueError, TypeError):
        raise ValueError('历史版本文件损坏或格式不兼容') from None


def atomic_write_text(target, content):
    """Replace one file atomically, leaving its prior contents on failure."""
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix('.' + uuid4().hex + '.tmp')
    try:
        temporary.write_text(content, encoding='utf-8')
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)


def save_snapshot(storage, result):
    """Save a version and, for real imports, current; caller holds the save lock."""
    storage = Path(storage)
    content = json.dumps(result, ensure_ascii=False, indent=2)
    atomic_write_text(storage / (result['snapshot']['snapshot_id'] + '.json'), content)
    if not result['snapshot']['is_demo']:
        atomic_write_text(storage / 'latest.json', content)
