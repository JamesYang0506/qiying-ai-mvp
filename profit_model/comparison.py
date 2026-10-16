"""Decimal comparison rules; actual calculations and theoretical targets stay separate."""

from decimal import Decimal, InvalidOperation, localcontext

DEFAULT_RULES = {
    'version': 'confirmed-relative-v1',
    'margin_mode': 'relative',
    'margin_attention_pct': '10',
    'margin_focus_pct': '20',
    'margin_severe_pct': '30',
    'defect_warning_pct': '3',
    'defect_danger_pct': '5',
    'min_production': '100',
    'provisional': True,
    'created_at': None,
}


def numeric(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        number = Decimal(str(value))
        if (
            number.is_finite()
            and number.copy_abs() <= Decimal('1e15')
            and number.as_tuple().exponent >= -12
        ):
            return number
    except (ValueError, InvalidOperation):
        pass
    return None


def text(value):
    if value is None:
        return None
    return format(value.quantize(Decimal('0.000001')), 'f')


def validate_rules(payload):
    if not isinstance(payload, dict):
        raise ValueError('预警设置必须是对象')
    mode = payload.get('margin_mode', 'points')
    if mode not in ('points', 'relative'):
        raise ValueError('毛利比较口径无效')
    margin_keys = (
        ('margin_attention_pct', 'margin_focus_pct', 'margin_severe_pct')
        if mode == 'relative'
        else ('margin_warning_pp', 'margin_danger_pp')
    )
    result = {'margin_mode': mode} if 'margin_mode' in payload else {}
    for key in (
        *margin_keys,
        'defect_warning_pct',
        'defect_danger_pct',
        'min_production',
    ):
        value = numeric(payload.get(key))
        if (
            value is None
            or value <= 0
            or value > (Decimal('1e9') if key == 'min_production' else 100)
        ):
            raise ValueError('阈值必须为有效正数；百分点和不良率不得超过100')
        if key == 'min_production' and value != value.to_integral_value():
            raise ValueError('质量观察量须为正整数')
        result[key] = format(value, 'f')
    if any(
        Decimal(result[left]) >= Decimal(result[right])
        for left, right in zip(margin_keys, margin_keys[1:])
    ) or Decimal(result['defect_warning_pct']) >= Decimal(result['defect_danger_pct']):
        raise ValueError('严重阈值必须大于提醒阈值')
    # Trial configuration stays provisional until a separate business verification workflow exists.
    result['provisional'] = True
    return result


def level(value, warning, danger):
    return (
        'danger'
        if value >= Decimal(danger)
        else 'warning' if value >= Decimal(warning) else 'normal'
    )


def evaluate(snapshot, order_id, baseline, rules, *, scope_confirmed=False):
    with localcontext() as context:
        context.prec = 50
        return _evaluate(snapshot, order_id, baseline, rules, scope_confirmed)


def _evaluate(snapshot, order_id, baseline, rules, scope_confirmed):
    order = next(
        (row for row in snapshot['orders'] if row['order_id'] == order_id), None
    )
    if order is None:
        raise ValueError('所选订单不属于该快照')
    source = snapshot.get('source_analysis') or {}
    if source.get('order_id') != order_id:
        source = {}
    metrics = source.get('metrics') or order
    revenue = numeric(metrics.get('revenue'))
    profit = numeric(metrics.get('production_profit'))
    margin_value = (
        profit / revenue * 100
        if profit is not None and revenue is not None and revenue > 0
        else None
    )
    trial = (
        bool(source)
        or order.get('mode') != 'actual'
        or order.get('production_status') != 'complete'
        or order.get('revenue_status') == 'estimated'
    )
    margin = {
        'status': 'pending',
        'target_pct': baseline.get('target_margin_pct') if baseline else None,
        'value_pct': text(margin_value),
        'delta_pp': None,
        'relative_drop_pct': None,
        'relative_drop_exact': None,
        'margin_mode': rules.get('margin_mode', 'points'),
        'performance': None,
        'message': '',
        'basis': 'trial' if trial else 'standard',
        'revenue': text(revenue),
        'production_profit': text(profit),
    }
    reason = None
    if not baseline:
        reason = '尚未建立或绑定理论毛利基线。'
    elif baseline.get('actual_order_id') != order_id or baseline.get(
        'is_demo'
    ) != snapshot['snapshot'].get('is_demo', False):
        reason = '理论基线与当前订单身份或真实/模拟类型不一致。'
    elif baseline.get('product') != order.get('product') or baseline.get(
        'unit'
    ) != order.get('unit'):
        reason = '理论与当前订单产品或数量单位不一致。'
    elif (
        baseline.get('quantity') or baseline.get('bound_quantity')
    ) is not None and numeric(
        baseline.get('quantity') or baseline.get('bound_quantity')
    ) != numeric(
        order.get('quantity')
    ):
        reason = '理论数量与当前订单范围不同，不能将整单预算直接对照过程费用。'
    elif not scope_confirmed:
        reason = '请先确认同一业务订单、收入成本数量范围及税口径；生产未完成时不得将整单理论与部分费用比较。'
    elif margin_value is None:
        reason = '收入不大于零或生产毛利缺失，暂不能计算可比毛利率。'
    elif (
        source
        and (source.get('profit_layers') or {}).get('production_cost') is None
        and source.get('profit_layers')
    ):
        reason = '生产成本依据不完整，暂不可比较。'
    elif not source and order.get('production_status') not in ('complete', 'estimated'):
        reason = '生产成本或收入范围尚未完整，暂不可比较。'
    elif baseline.get('tax_basis', 'unknown') not in (
        'unknown',
        'ignored',
    ) and order.get('tax_basis', 'unknown') not in ('unknown', baseline['tax_basis']):
        reason = '理论与当前税口径不一致。'
    target = numeric(margin['target_pct'])
    if reason is None and target is None:
        reason = '理论毛利率无效，不能以实际值补成目标。'
    if reason is None and margin['margin_mode'] == 'relative' and target <= 0:
        reason = '计划毛利率须大于零，暂不能计算相对下降比例。'
    if reason:
        margin['message'] = reason
    else:
        delta = target - margin_value
        margin.update(
            delta_pp=text(delta),
            performance=(
                'better' if delta < 0 else 'on_plan' if delta == 0 else 'below_plan'
            ),
        )
        if margin['margin_mode'] == 'relative':
            relative_drop = delta / target * 100
            margin.update(
                relative_drop_pct=text(relative_drop),
                relative_drop_exact=format(relative_drop, 'f'),
                status=(
                    'danger'
                    if relative_drop > Decimal(rules['margin_severe_pct'])
                    else (
                        'focus'
                        if relative_drop > Decimal(rules['margin_focus_pct'])
                        else (
                            'warning'
                            if relative_drop > Decimal(rules['margin_attention_pct'])
                            else 'normal'
                        )
                    )
                ),
            )
            margin['message'] = (
                f'毛利率较计划相对下降 {text(relative_drop)}%（下降 {text(delta)} 个百分点）。'
                if delta >= 0
                else f'毛利率优于计划，相对提高 {text(-relative_drop)}%（提高 {text(-delta)} 个百分点）。'
            )
        else:
            margin['status'] = level(
                delta, rules['margin_warning_pp'], rules['margin_danger_pp']
            )
            margin['message'] = (
                f'毛利率较理论下降 {text(delta)} 个百分点。'
                if delta >= 0
                else f'毛利率较理论提高 {text(-delta)} 个百分点。'
            )
        if trial:
            margin['message'] += ' 当前为参考试算/预测，尚非已核实实际毛利。'
        if baseline.get('tax_basis', 'unknown') == 'unknown':
            margin['message'] += ' 税口径待核实，按已确认的相同口径参考比较。'
        elif baseline.get('tax_basis') == 'ignored':
            margin['message'] += ' 本次不计税，不作税额调整。'
    production = source.get('production') or {}
    produced = numeric(production.get('gross_quantity'))
    defects = numeric(production.get('defect_quantity'))
    quality = {
        'status': 'pending',
        'target_pct': baseline.get('target_defect_pct') if baseline else None,
        'value_pct': None,
        'delta_pp': None,
        'message': '',
        'produced': text(produced),
        'defects': text(defects),
    }
    if (
        produced is None
        or defects is None
        or produced <= 0
        or defects < 0
        or defects > produced
    ):
        quality['message'] = (
            '缺少有效产量/不良数量，或数量关系无效；零产量不计算不良率。'
        )
    else:
        rate = defects / produced * 100
        quality['value_pct'] = text(rate)
        quality_target = numeric(quality['target_pct'])
        if quality_target is not None:
            quality['delta_pp'] = text(rate - quality_target)
        days = production.get('days') or []
        dates = [day.get('date') for day in days]
        if len(dates) != len(set(dates)):
            quality['message'] = '存在重复日期日报，需核对是否重复归集后判断质量等级。'
        elif produced < Decimal(rules['min_production']):
            quality['message'] = (
                f'样本较少：累计生产未达到 {rules["min_production"]}，暂不判定等级。'
            )
        else:
            quality['status'] = level(
                rate, rules['defect_warning_pct'], rules['defect_danger_pct']
            )
            quality['message'] = (
                f'按日报不良 / 累计生产计算，不良率 {text(rate)}%；不等于最终报废率。'
            )
    indicators = {'margin': margin, 'quality': quality}
    rank = {'normal': 0, 'pending': 1, 'warning': 2, 'focus': 3, 'danger': 4}
    severity = max((row['status'] for row in indicators.values()), key=rank.get)
    return {
        'snapshot_id': snapshot['snapshot']['snapshot_id'],
        'order_id': order_id,
        'cutoff_date': snapshot['snapshot'].get('cutoff_date'),
        'is_demo': snapshot['snapshot'].get('is_demo', False),
        'scope_confirmed': bool(scope_confirmed),
        'metrics': indicators,
        'severity': severity,
        'pending': [
            row['message'] for row in indicators.values() if row['status'] == 'pending'
        ],
    }
