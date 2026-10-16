"""Snapshot-grounded local model integration and separate analysis records."""

import json
from uuid import uuid4
from datetime import datetime, timezone
from .ollama_client import model_context, validate_result
from .history import is_deleted
from .snapshots import SNAPSHOT_ID, load_snapshot, select_orders

FOCUSES = {
    'decision': '订单决策',
    'profit': '利润分析',
    'cost': '成本优化',
    'risk': '风险审查',
}


def prepare_analysis(request, storage):
    if not isinstance(request, dict):
        raise ValueError('分析请求必须是对象')
    sid = request.get('snapshot_id')
    oid = request.get('order_id')
    focus = request.get('focus')
    question = request.get('question', '')
    if not isinstance(sid, str) or not SNAPSHOT_ID.fullmatch(sid):
        raise ValueError('无效快照编号')
    if not isinstance(oid, str) or not oid or len(oid) > 200:
        raise ValueError('请选择有效订单')
    if not isinstance(focus, str) or focus not in FOCUSES:
        raise ValueError('分析方向无效')
    if not isinstance(question, str) or len(question) > 2000:
        raise ValueError('补充问题最多2000字')
    if is_deleted(storage, sid, oid):
        raise ValueError('该分析记录已在回收站，请先恢复')
    snapshot = load_snapshot(
        storage,
        sid,
        invalid_message='无效快照编号',
        missing_message='订单快照不存在，请重新导入数据',
    )
    order = next((x for x in snapshot['orders'] if x['order_id'] == oid), None)
    if order is None:
        raise ValueError('所选订单不属于该快照')
    scoped = select_orders(snapshot, {oid})
    context = {
        key: scoped[key] for key in ('snapshot', 'costs', 'allocations', 'issues')
    }
    context['order'] = order
    if 'source_analysis' in scoped:
        context['source_analysis'] = scoped['source_analysis']
    return {
        'schema_version': 'order-analysis.v1',
        'request_id': str(uuid4()),
        'status': 'not_configured',
        'message': '本地订单资料已准备完成。大模型尚未接入，未生成分析结论。',
        'request': {
            'snapshot_id': sid,
            'order_id': oid,
            'focus': focus,
            'question': question.strip(),
        },
        'context': context,
        'result': None,
    }


def run_analysis(request, storage, client):
    response = prepare_analysis(request, storage)
    connection = client.status()
    if not connection.get('configured'):
        response['message'] = connection.get('message', response['message'])
        return response
    facts = model_context(response['context'])
    generated = client.generate(facts, response['request'])
    validate_result(generated['result'], facts)
    response.update(
        generated,
        status='completed',
        reviewed=False,
        message='本地模型分析完成；建议尚未经人工复核，不能替代已验证的业务结论。',
        created_at=datetime.now(timezone.utc).isoformat(),
        evidence=facts['facts'],
        model_digest=connection.get('model_digest'),
    )
    saved = storage / 'ai-analyses'
    saved.mkdir(parents=True, exist_ok=True)
    target = saved / (response['request_id'] + '.json')
    target.write_text(
        json.dumps(response, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    return response
