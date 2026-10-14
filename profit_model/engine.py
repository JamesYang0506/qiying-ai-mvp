"""Decimal calculations; missing data is never interpreted as zero."""

from collections import defaultdict
from datetime import datetime, timezone
from decimal import (
    Decimal,
    InvalidOperation,
    DecimalException,
    ROUND_HALF_UP,
    ROUND_FLOOR,
    localcontext,
)
import hashlib
import json

VERSION = 'profit-v0.3-independent-20261013'
CATEGORIES = (
    'material',
    'labor',
    'manufacturing',
    'production_other',
    'management',
    'sales',
    'finance',
    'order_other',
)
PRODUCTION = CATEGORIES[:4]
STATUSES = ('confirmed', 'estimated', 'missing', 'not_applicable')
ZERO = Decimal('0')
CENT = Decimal('0.01')


def number(value, label, *, optional=False):
    if value is None or value == '':
        if optional:
            return None
        raise ValueError(f'{label} 缺失')
    if isinstance(value, bool):
        raise ValueError(f'{label} 必须为数字')
    try:
        n = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError(f'{label} 不是有效数字') from None
    if (
        not n.is_finite()
        or n.copy_abs() > Decimal('1e15')
        or n.as_tuple().exponent < -12
    ):
        raise ValueError(f'{label} 必须为有限数字，绝对值不大于 10^15，最多12位小数')
    return n


def money(n):
    return None if n is None else str(n.quantize(CENT, rounding=ROUND_HALF_UP))


def ratio(a, b):
    return (
        None
        if a is None or b is None or b <= 0
        else str((a / b).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP))
    )


def calculate(dataset):
    with localcontext() as ctx:
        ctx.prec = 100
        try:
            return _calculate(dataset)
        except DecimalException:
            raise ValueError(
                '数字精度或运算范围不受支持，请核对数量、单价和分摊基数'
            ) from None


def _calculate(data):
    if not isinstance(data, dict):
        raise ValueError('输入必须是包含 orders 等表的对象')
    tables = (
        'orders',
        'order_lines',
        'materials',
        'labor',
        'costs',
        'pools',
        'bases',
        'coverage',
    )
    for table in tables:
        if not isinstance(data.get(table, []), list) or any(
            not isinstance(r, dict) for r in data.get(table, [])
        ):
            raise ValueError(f'{table} 必须为记录数组')
    meta = data.get('metadata', {})
    if not isinstance(meta, dict) or meta.get('currency') != 'CNY':
        raise ValueError('首版仅接受统一到 CNY 的输入，请先确认外币换算口径')
    try:
        datetime.strptime(str(meta.get('cutoff_date', '')), '%Y-%m-%d')
    except ValueError:
        raise ValueError('metadata.cutoff_date 必须为 YYYY-MM-DD') from None
    orders = {}
    lines = defaultdict(list)
    line_ids = set()
    for line in data.get('order_lines', []):
        key = (line.get('order_id'), line.get('line_id'))
        if any(not isinstance(x, str) or not x.strip() for x in key) or key in line_ids:
            raise ValueError('订单行编号缺失或重复')
        line_ids.add(key)
        lines[key[0]].append(line)

    def line_revenue(line, label):
        q = number(line.get('quantity'), label + ' 数量', optional=True)
        p = number(line.get('unit_price'), label + ' 单价', optional=True)
        d = number(line.get('discount'), label + ' 折扣', optional=True)
        if any(x is not None and x < 0 for x in (q, p, d)) or (
            None not in (q, p, d) and d > q * p
        ):
            raise ValueError(label + ' 数量、单价及折扣范围不合法')
        return (
            None
            if None in (q, p, d)
            else (q * p - d).quantize(CENT, rounding=ROUND_HALF_UP)
        )

    for row in data.get('orders', []):
        oid = row.get('order_id')
        if not isinstance(oid, str) or not oid.strip() or oid in orders:
            raise ValueError('订单 ID 必须为非空且唯一的文本')
        if row.get('mode') not in ('forecast', 'actual'):
            raise ValueError(f'{oid}: mode 应为 forecast 或 actual')
        q = number(row.get('quantity'), f'{oid} 数量')
        if q < 0:
            raise ValueError(f'{oid}: 数量不能为负')
        if not row.get('unit'):
            raise ValueError(f'{oid}: 缺少数量单位')
        revenues = []
        if lines[oid]:
            for line in lines[oid]:
                if line.get('unit') != row['unit']:
                    raise ValueError(f'{oid}: 明细行单位与订单汇总单位不一致')
                revenues.append(
                    {
                        'line_id': line['line_id'],
                        'revenue': money(
                            line_revenue(line, oid + '/' + line['line_id'])
                        ),
                    }
                )
            qs = [
                number(x.get('quantity'), '明细数量', optional=True) for x in lines[oid]
            ]
            if all(x is not None for x in qs) and sum(qs) != q:
                raise ValueError(f'{oid}: 明细数量合计与订单数量不符')
            r = (
                None
                if any(x['revenue'] is None for x in revenues)
                else sum(Decimal(x['revenue']) for x in revenues)
            )
        else:
            r = line_revenue(row, oid)
        rstate = row.get('revenue_status', 'confirmed')
        if rstate not in ('confirmed', 'estimated', 'missing'):
            raise ValueError('收入状态无效')
        if rstate == 'missing':
            r = None
        orders[oid] = dict(
            row, _q=q, _revenue=r, _revenue_status=rstate, _lines=revenues
        )
    if set(lines) - set(orders):
        raise ValueError('订单行关联了不存在的订单')
    if not orders:
        raise ValueError('至少需要一笔订单')
    totals = defaultdict(lambda: ZERO)
    inside = defaultdict(lambda: ZERO)
    seen = defaultdict(int)
    blocked = defaultdict(set)
    estimated = defaultdict(set)
    unknown_stage = set()
    costs = []
    allocations = []
    issues = []
    ids = set()

    def issue(oid, category, message, code='MISSING'):
        issues.append(
            {'order_id': oid, 'category': category, 'code': code, 'message': message}
        )

    def reference(row, table, index):
        oid = row.get('order_id')
        if oid not in orders:
            raise ValueError(f'{table} 第 {index} 行关联了不存在的订单 {oid}')
        return oid

    def add_cost(row, table, index, category, amount, status=None):
        oid = reference(row, table, index)
        rid = row.get('record_id')
        if not isinstance(rid, str) or not rid or rid in ids:
            raise ValueError(f'{table} 第 {index} 行成本 ID 缺失或重复：{rid}')
        ids.add(rid)
        status = status or row.get('status', 'missing')
        if status not in STATUSES:
            raise ValueError(f'{rid}: 无效金额状态')
        if category not in CATEGORIES:
            raise ValueError(f'{rid}: 无效成本类别（不支持模具摊销）')
        if row.get('included_elsewhere') is True:
            raise ValueError(f'{rid}: 已计入其他项目，不能再次扣减')
        if amount is None or status == 'missing':
            amount = None
            blocked[oid].add(category)
            issue(oid, category, f'{rid} 金额或计算依据缺失')
        elif status == 'not_applicable' and amount != 0:
            raise ValueError(f'{rid}: 不适用项目不能有非零金额')
        elif status == 'estimated':
            estimated[oid].add(category)
        if amount is not None:
            amount = amount.quantize(CENT, rounding=ROUND_HALF_UP)
        stage = row.get('stage', 'unknown')
        if stage not in ('inside', 'outside', 'unknown'):
            raise ValueError(f'{rid}: stage 应为 inside/outside/unknown')
        seen[oid, category] += 1
        if amount is not None:
            totals[oid, category] += amount
            if category in PRODUCTION:
                if stage == 'inside':
                    inside[oid] += amount
                elif stage == 'unknown':
                    unknown_stage.add(oid)
                    issue(oid, category, f'{rid} 发生阶段未确认', 'STAGE')
        costs.append(
            {
                'record_id': rid,
                'order_id': oid,
                'category': category,
                'stage': stage,
                'period': str(row.get('period', '')),
                'amount': money(amount),
                'status': status if amount is not None else 'missing',
                'source': row.get('source') or f'{table} / 数据行 {index}',
                'method': row.get('method', 'direct'),
                'basis': {
                    k: row[k]
                    for k in (
                        'quantity',
                        'unit_price',
                        'rate',
                        'loss_rate',
                        'loss_definition',
                    )
                    if k in row
                },
            }
        )

    for index, row in enumerate(data.get('materials', []), 1):
        qty = number(row.get('quantity'), '材料数量', optional=True)
        price = number(row.get('unit_price'), '材料单价', optional=True)
        method = row.get('method')
        if method not in ('actual', 'bom'):
            raise ValueError(
                '材料 method 必须为 actual 或 bom；quantity 为整单对应范围用量'
            )
        if (qty is not None and qty < 0) or (price is not None and price < 0):
            raise ValueError('材料净耗用和单价不能为负数')
        amount = None if qty is None or price is None else qty * price
        status = row.get('status', 'missing')
        if method == 'bom':
            loss = number(row.get('loss_rate'), '损耗率', optional=True)
            definition = row.get('loss_definition')
            if loss is not None and not 0 <= loss < 1:
                raise ValueError('损耗率应在 [0,1) 范围内')
            if definition not in ('input', 'net', 'included'):
                raise ValueError('BOM 必须声明损耗率定义 input/net/included')
            if definition != 'included':
                if loss is None:
                    amount = None
                elif amount is not None:
                    amount = (
                        amount / (1 - loss)
                        if definition == 'input'
                        else amount * (1 + loss)
                    )
            if status == 'confirmed':
                status = 'estimated'
        add_cost(row, 'materials', index, 'material', amount, status)

    for index, row in enumerate(data.get('labor', []), 1):
        qty = number(row.get('quantity'), '人工应计薪数量', optional=True)
        rate = number(row.get('rate'), '计件单价', optional=True)
        if (qty is not None and qty < 0) or (rate is not None and rate < 0):
            raise ValueError('人工数量和单价不能为负数')
        add_cost(
            row,
            'labor',
            index,
            'labor',
            None if qty is None or rate is None else qty * rate,
        )
    for index, row in enumerate(data.get('costs', []), 1):
        add_cost(
            row,
            'costs',
            index,
            row.get('category'),
            number(row.get('amount'), '直接费用金额', optional=True),
        )

    pools = {}
    for row in data.get('pools', []):
        pid = row.get('pool_id')
        if not isinstance(pid, str) or not pid or pid in pools:
            raise ValueError('费用池 ID 必须为非空且唯一的文本')
        if row.get('category') not in (
            'manufacturing',
            'management',
            'sales',
            'finance',
            'production_other',
            'order_other',
        ):
            raise ValueError(f'{pid}: 无效费用池类别')
        if row.get('status') not in STATUSES:
            raise ValueError(f'{pid}: 无效费用池状态')
        if not row.get('period') or not row.get('base_unit'):
            raise ValueError(f'{pid}: 缺少期间或分摊基数单位')
        pools[pid] = row
    bases = defaultdict(list)
    base_keys = set()
    for index, row in enumerate(data.get('bases', []), 1):
        oid = reference(row, 'bases', index)
        pid = row.get('pool_id')
        if pid not in pools or (pid, oid) in base_keys:
            raise ValueError('分摊基数引用无效费用池或同一订单重复')
        base_keys.add((pid, oid))
        b = number(row.get('base'), '订单分摊基数', optional=True)
        if b is not None and b < 0:
            raise ValueError('分摊基数不能为负')
        bases[pid].append((oid, b, index))
    for pid, pool in pools.items():
        amount = number(pool.get('amount'), f'{pid} 金额', optional=True)
        denom = number(pool.get('total_base'), f'{pid} 总基数', optional=True)
        rows = sorted(bases[pid], key=lambda r: r[0])
        invalid = (
            amount is None
            or denom is None
            or denom <= 0
            or pool['status'] == 'missing'
            or pool.get('direct_cost_excluded') is not True
            or any(b is None for _, b, _ in rows)
        )
        if amount is not None and amount < 0:
            raise ValueError(f'{pid}: 费用池金额不能为负')
        if not invalid and sum(b for _, b, _ in rows) > denom:
            raise ValueError(f'{pid}: 已导入订单基数超过完整分母')
        if pool['status'] == 'not_applicable' and amount not in (None, ZERO):
            raise ValueError(f'{pid}: 不适用费用池金额非零')
        assigned = {}
        raw_amounts = {}
        if not invalid:
            # Allocate integer cents to the imported scope, then keep the rest in the pool.
            # Largest remainder prevents a last-order adjustment from turning costs negative.
            raw_amounts = {oid: amount * b / denom for oid, b, _ in rows}
            assigned = {
                oid: raw.quantize(CENT, rounding=ROUND_FLOOR)
                for oid, raw in raw_amounts.items()
            }
            target = (amount * sum(b for _, b, _ in rows) / denom).quantize(
                CENT, rounding=ROUND_HALF_UP
            )
            pennies = int((target - sum(assigned.values(), ZERO)) / CENT)
            ranking = sorted(
                raw_amounts,
                key=lambda oid: (raw_amounts[oid] - assigned[oid], oid),
                reverse=True,
            )
            for oid in ranking[:pennies]:
                assigned[oid] += CENT
        running = ZERO
        start = len(allocations)
        for pos, (oid, b, index) in enumerate(rows):
            raw = None if invalid else raw_amounts[oid]
            allocated = None if invalid else assigned[oid]
            adjustment = (
                ZERO
                if invalid
                else allocated - raw.quantize(CENT, rounding=ROUND_HALF_UP)
            )
            if allocated is not None:
                running += allocated
            record = {
                'record_id': f'pool:{pid}:{oid}',
                'order_id': oid,
                'stage': pool.get('stage', 'unknown'),
                'period': pool['period'],
                'status': pool['status'],
                'source': f'费用池 {pid}',
                'method': 'allocation',
            }
            add_cost(record, 'bases', index, pool['category'], allocated)
            if invalid:
                issue(
                    oid,
                    pool['category'],
                    f'费用池 {pid}：金额/基数缺失、分母无效或未确认直接费用已剔除',
                    'POOL',
                )
            allocations.append(
                {
                    'pool_id': pid,
                    'order_id': oid,
                    'category': pool['category'],
                    'period': pool['period'],
                    'pool_amount': money(amount),
                    'base': None if b is None else str(b),
                    'total_base': None if denom is None else str(denom),
                    'base_unit': pool['base_unit'],
                    'ratio': None if invalid else ratio(b, denom),
                    'amount': money(allocated),
                    'rounding_adjustment': money(adjustment),
                    'unallocated': None,
                }
            )
        remainder = (
            None
            if amount is None or invalid
            else amount.quantize(CENT, rounding=ROUND_HALF_UP) - running
        )
        if not rows:
            allocations.append(
                {
                    'pool_id': pid,
                    'order_id': '',
                    'category': pool['category'],
                    'period': pool['period'],
                    'pool_amount': money(amount),
                    'base': None,
                    'total_base': None if denom is None else str(denom),
                    'base_unit': pool['base_unit'],
                    'ratio': None,
                    'amount': None,
                    'rounding_adjustment': '0.00',
                    'unallocated': money(amount),
                }
            )
        else:
            for a in allocations[start:]:
                a['unallocated'] = money(remainder)

    coverage = {}
    for index, row in enumerate(data.get('coverage', []), 1):
        oid = reference(row, 'coverage', index)
        cat = row.get('category')
        status = row.get('status')
        if cat not in CATEGORIES or status not in STATUSES or (oid, cat) in coverage:
            raise ValueError('完整度声明有无效类别、状态或重复记录')
        coverage[oid, cat] = status
    results = []
    for oid, order in orders.items():
        for cat in CATEGORIES:
            state = coverage.get((oid, cat), 'missing')
            if state == 'not_applicable' and (
                totals[oid, cat] != 0 or cat in blocked[oid]
            ):
                raise ValueError(f'{oid} {cat}: 不适用声明与费用记录冲突')
            if state == 'missing' or (state != 'not_applicable' and not seen[oid, cat]):
                blocked[oid].add(cat)
                issue(oid, cat, '费用范围未确认完整，或没有明细支持')
            if state == 'estimated':
                estimated[oid].add(cat)
        aligned = order.get('scope_aligned') is True
        if not aligned:
            issue(oid, 'scope', '收入与成本覆盖范围未确认一致', 'SCOPE')
        r = order['_revenue']
        if r is None:
            issue(
                oid,
                'revenue',
                '收入单价、数量、折扣或状态缺失，不默认扣减额为零',
                'REVENUE',
            )
        elif order['_revenue_status'] == 'estimated':
            issue(oid, 'revenue', '价格税口径或收入依据待核验', 'REVIEW')

        def layer(cats):
            if r is None or not aligned or blocked[oid].intersection(cats):
                return None, 'blocked'
            value = r - sum(totals[oid, c] for c in cats)
            return value, (
                'estimated'
                if order['_revenue_status'] == 'estimated'
                or estimated[oid].intersection(cats)
                else 'complete'
            )

        gp, gps = layer(PRODUCTION)
        mp, mps = layer(CATEGORIES)
        if meta.get('management_enabled') is not True:
            mp = None
            mps = 'disabled'
        ip = (
            None
            if r is None
            or not aligned
            or blocked[oid].intersection(PRODUCTION)
            or oid in unknown_stage
            else r - inside[oid]
        )
        cats = {
            c: None if c in blocked[oid] else money(totals[oid, c]) for c in CATEGORIES
        }
        for key, value in [('production_profit', gp), ('management_profit', mp)]:
            if value is not None and value < 0:
                issue(oid, key, '当前口径利润为负', 'LOSS')
        results.append(
            {
                'order_id': oid,
                'product': order.get('product', ''),
                'customer': order.get('customer', ''),
                'quantity': str(order['_q']),
                'unit': order['unit'],
                'mode': order['mode'],
                'revenue': money(r),
                'revenue_status': 'missing' if r is None else order['_revenue_status'],
                'line_revenues': order['_lines'],
                'categories': cats,
                'known_cost': money(sum(totals[oid, c] for c in CATEGORIES)),
                'inside_profit': money(ip),
                'production_profit': money(gp),
                'management_profit': money(mp),
                'production_margin': ratio(gp, r),
                'management_margin': ratio(mp, r),
                'unit_production_profit': money(
                    None if gp is None or order['_q'] == 0 else gp / order['_q']
                ),
                'unit_management_profit': money(
                    None if mp is None or order['_q'] == 0 else mp / order['_q']
                ),
                'production_status': gps,
                'management_status': mps,
                'missing': sorted(blocked[oid]),
                'estimates': sorted(estimated[oid]),
            }
        )
    digest = hashlib.sha256(
        json.dumps(data, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()
    ).hexdigest()
    snapshot = {
        'snapshot_id': datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        + '-'
        + digest[:8],
        'input_hash': digest,
        'formula_version': VERSION,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'cutoff_date': meta['cutoff_date'],
        'currency': 'CNY',
        'is_demo': meta.get('is_demo') is True,
        'management_enabled': meta.get('management_enabled') is True,
        'formula_source': meta.get('formula_source', '2026-10-13 算法公式与说明汇总'),
        'rounding': 'Decimal / ROUND_HALF_UP / 最终金额0.01元',
        'scope': '输入方声明的同数量范围、同截止日期；forecast/actual分组展示',
        'assumptions': [
            'BOM按理论净用量估算',
            '不计客户提供模具摊销',
            '费用池直接费用已剔除后分摊',
        ],
    }
    result = {
        'orders': results,
        'costs': costs,
        'allocations': allocations,
        'issues': issues,
        'snapshot': snapshot,
    }
    if isinstance(data.get('source_analysis'), dict):
        result['source_analysis'] = data['source_analysis']
    return result
