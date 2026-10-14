"""Calculation/save and export preparation independent of HTTP handling."""

from .duplicates import find_duplicates, input_fingerprints
from .engine import calculate
from .history import TRASH_LOCK, is_deleted
from .snapshots import load_snapshot, save_snapshot, select_orders
from .comparison_store import auto_check


def calculate_and_save(data, storage, *, source_hash=None, import_review=None):
    fingerprints = input_fingerprints(data)
    result = calculate(data)
    if import_review is not None:
        result['snapshot']['import_review'] = import_review
    # Deletion, duplicate detection and writes must remain one critical section.
    with TRASH_LOCK:
        matches = find_duplicates(storage, result, fingerprints, source_hash)
        duplicates = {
            order['order_id'] for match in matches for order in match['orders']
        }
        if duplicates and duplicates == set(fingerprints):
            return {
                'status': 'duplicate',
                'match': matches[0],
                'matches': matches,
                'message': '相同订单数据已存在，本次未新增记录。',
            }
        if duplicates:
            result = select_orders(result, duplicates, exclude=True)
            result['snapshot']['duplicates_skipped'] = matches
        result['snapshot']['import_identity'] = {
            'schema': 'order-input.v1',
            'source_hash': source_hash,
            'order_hashes': {
                oid: value
                for oid, value in fingerprints.items()
                if oid not in duplicates
            },
        }
        save_snapshot(storage, result)
        try:
            auto_check(storage, result)
        except (ValueError, OSError):
            # The actual snapshot is already durable; a failed auxiliary check must not
            # turn a successful import into a misleading "nothing saved" response.
            result['comparison_warning'] = (
                '订单已保存，但理论对照检测未完成，请进入对照页检查本地资料并重新检测。'
            )
    return result


def prepare_export(request, storage, *, training=False):
    sid = request.get('snapshot_id', '')
    result = load_snapshot(
        storage,
        sid,
        invalid_message='无效快照编号',
        missing_message='计算快照不存在，请重新计算',
    )
    selected = request.get('order_ids')
    if not isinstance(selected, list) or any(
        not isinstance(oid, str) for oid in selected
    ):
        raise ValueError('导出订单范围无效')
    ids = set(selected)
    if any(is_deleted(storage, sid, oid) for oid in ids):
        raise ValueError('所选记录已在回收站，请先恢复')
    if training and (not ids or len(ids) != len(selected)):
        raise ValueError('请导出至少一笔订单，订单编号不能重复')
    if not ids.issubset({row['order_id'] for row in result['orders']}):
        raise ValueError('导出包含未知订单')
    result = select_orders(result, ids)
    result['snapshot']['export_scope'] = selected
    return result
