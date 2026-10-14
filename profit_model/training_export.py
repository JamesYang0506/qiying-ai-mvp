"""Candidate order datasets; calculation results are not supervised answers."""
import csv
import hashlib
import io
import json
import zipfile
from datetime import datetime, timezone


ANNOTATION_FIELDS = [
    'sample_id', 'order_id', 'snapshot_id', 'is_demo', 'review_status',
    'task', 'decision_at', 'expert_answer', 'recommendation', 'reason',
    'evidence_refs', 'conditions', 'missing_information', 'reviewer',
    'reviewed_at', 'source_authorization', 'deidentification_status',
]
CSV_FIELDS = [
    'sample_id', 'order_id', 'snapshot_id', 'product', 'customer', 'quantity',
    'unit', 'mode', 'currency', 'cutoff_date', 'formula_version', 'is_demo',
    'revenue', 'revenue_status', 'known_cost',
    'material', 'labor', 'manufacturing', 'production_other',
    'management', 'sales', 'finance', 'order_other',
    'inside_profit', 'production_profit', 'management_profit',
    'production_margin', 'management_margin', 'production_status',
    'management_status', 'missing', 'estimates',
    'reference_production_cost', 'reference_operating_expense',
    'reference_cumulative_cost', 'reference_production_profit',
    'reference_operating_net_profit', 'reference_status',
]


def csv_bytes(rows, fields):
    output = io.StringIO(newline='')
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction='ignore')
    writer.writeheader()
    for row in rows:
        safe = {}
        for key, value in row.items():
            if isinstance(value, (list, dict)):
                value = json.dumps(value, ensure_ascii=False, allow_nan=False)
            # Preserve JSON exactly; protect strings only in spreadsheet exports.
            if isinstance(value, str) and value.startswith(('=', '+', '-', '@', '\t', '\r', '\n')):
                value = "'" + value
            safe[key] = value
        writer.writerow(safe)
    return output.getvalue().encode('utf-8-sig')


README = """# 订单训练候选资料

此包不是可直接投入 SFT 的答案集，不包含经过审核的目标回答。
orders.csv 用 Excel 查看金额；orders.jsonl 每行一个订单快照；annotations.csv
供专家填写建议；manifest.json 保存导出范围和字段说明。CSV 为 UTF-8 BOM，
用 Excel 的“从文本/CSV”导入并将标识符列设为文本，避免修改订单号和时间。

## 金额与状态
金额为元，币种见 currency；利润率为比例（0.1 表示 10%）。JSON 金额保留
十进制字符串精度，未知为 null，CSV 对应为空。确认零值保留为 0.00。
known_cost 仅表示已列成本之和，不代表成本齐全。categories 保留严格口径
的未知状态；costs 保留可追溯的已知成本记录，不要将空值补成零。
production_profit 是生产毛利，management_profit 是订单管理利润，不等同于
财务净利润。reference_* 来自源表已列费用范围的试算，不能覆盖严格口径，
也不能自动作为已确认最终利润。JSON 的 source_analysis 保留试算依据和审查。
complete 表示满足程序计算条件，不代表企业凭证已经审核。
所有字段来自保存的同一计算快照，导出不会重算或修改原快照。

## 专家标注流程
用 sample_id 关联 annotations.csv 和 orders.jsonl。保留 order_id、snapshot_id。
task 填具体任务，如“当前订单利润解释”或“接单前经营建议”。expert_answer
填专家认可的完整答案；recommendation 可填保留/优化后保留/谨慎承接或不再续接/
补数据后判断/人工复核；reason 填理由，evidence_refs 引用输入字段路径或记录 ID，
conditions 填适用条件，missing_information 填需补资料。记录 reviewer 和 reviewed_at。
review_status 初始 unreviewed，复核后可填 approved/rejected；同时确认数据来源授权
source_authorization 和脱敏 deidentification_status。仅修改状态不能证明答案正确。
本版本没有标注回传或自动生成 SFT 的功能：填写后需另行校验、审核和转换。
不读取现有 AI 分析记录；模型草稿和规则建议均不会自动进入答案列。

## 训练前检查
training_eligible 固定 false，annotation.answer 固定 null，避免误用候选数据。
人工核验输入、答案、引用、授权及脱敏后，另行生成 messages 格式的 SFT 文件。
导出不会自动脱敏；客户、产品、来源路径等字段可能含企业信息，发布或送入
云端训练前应处理。is_demo=true 表示源快照声明为演示数据；false 也不证明数据
真实或获授权。合成样本不得用于证明真实经营效果。
接单前建议需填写 decision_at，并剔除当时尚未知的最终结算等信息；cutoff_date
不自动等于决策时间。同一订单全部快照、补单及近重复案例按组划分，时间留出
测试集。后续结果只能作为独立标签或评估信息，不能泄露进决策时输入。
"""


def export_training_bundle(result):
    snapshot = result['snapshot']
    records, csv_rows, annotations = [], [], []
    for order in result['orders']:
        oid = order['order_id']
        identity = json.dumps([snapshot['snapshot_id'], oid], ensure_ascii=False)
        sample_id = hashlib.sha256(identity.encode('utf-8')).hexdigest()
        context = {'snapshot': snapshot, 'order': order}
        for table in ('costs', 'allocations', 'issues'):
            context[table] = [row for row in result[table] if row.get('order_id') == oid]
        source = result.get('source_analysis')
        if source and source.get('order_id') == oid:
            context['source_analysis'] = source
        record = {'schema_version': 'order-training-candidate.v1', 'sample_id': sample_id,
                  'group_id': oid, 'training_eligible': False, 'input': context,
                  'annotation': {'status': 'unreviewed', 'answer': None}}
        records.append(record)
        row = dict(order, **order.get('categories', {}), sample_id=sample_id)
        for key in ('snapshot_id', 'currency', 'cutoff_date', 'formula_version', 'is_demo'):
            row[key] = snapshot.get(key)
        trial = context.get('source_analysis', {}).get('profit_layers', {})
        for key in ('production_cost', 'operating_expense', 'cumulative_cost',
                    'production_profit', 'operating_net_profit', 'status'):
            row['reference_' + key] = trial.get(key)
        csv_rows.append(row)
        annotations.append({'sample_id': sample_id, 'order_id': oid,
                            'snapshot_id': snapshot['snapshot_id'], 'is_demo': snapshot.get('is_demo'),
                            'review_status': 'unreviewed', 'source_authorization': 'unconfirmed',
                            'deidentification_status': 'unconfirmed'})

    manifest = {
        'schema_version': 'order-training-candidate.v1',
        'exported_at': datetime.now(timezone.utc).isoformat(),
        'snapshot_id': snapshot['snapshot_id'], 'formula_version': snapshot.get('formula_version'),
        'cutoff_date': snapshot.get('cutoff_date'), 'currency': snapshot.get('currency'),
        'is_demo': snapshot.get('is_demo'), 'order_ids': [x['order_id'] for x in result['orders']],
        'candidate_count': len(records), 'sft_ready_count': 0,
        'contains_model_answers': False, 'automatically_deidentified': False,
        'field_definitions': {
            'orders.jsonl': '每行一个订单计算快照，input 保留成本、分摊、异常及适用源表审查',
            'orders.csv': '同一快照的金额摘要；未知空白，金额单位元，利润率为比例',
            'annotations.csv': '人工建议标注模板；尚无目标答案，不可直接训练',
            'reference_*': '源表已列费用范围内的参考试算，不能当作已确认最终利润',
            'production_profit': '严格口径生产毛利，读取 production_status',
            'management_profit': '严格口径订单管理利润，读取 management_status，不等同财务净利润',
            'known_cost': '累计已列成本，可能存在遗漏，完整度见 missing/estimates 和审查信息',
            'sample_id': '由快照编号和订单编号生成，关联标注模板',
            'group_id': '订单分组，划分数据集时同一订单全部版本保持同组',
        },
        'csv_columns': CSV_FIELDS, 'annotation_columns': ANNOTATION_FIELDS,
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('orders.csv', csv_bytes(csv_rows, CSV_FIELDS))
        archive.writestr('annotations.csv', csv_bytes(annotations, ANNOTATION_FIELDS))
        archive.writestr('orders.jsonl', ''.join(json.dumps(x, ensure_ascii=False, allow_nan=False) + '\n' for x in records).encode('utf-8'))
        archive.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False).encode('utf-8'))
        archive.writestr('README.md', README.encode('utf-8'))
    return output.getvalue()
