"""Evidence review for source trial calculations; no unsupported trust score."""
from collections import Counter
from decimal import Decimal,ROUND_HALF_UP

CATEGORIES=(('profit','利润异常'),('consistency','数据一致性异常'),('quality','质量异常'),('process','工艺异常'))
PROFIT_CODES={'PROFIT_SIGN','TAX','ASSET','DEVELOPMENT','CLASSIFICATION','NET_SCOPE'}
QUALITY_CODES={'QUALITY_RATE'}
PROCESS_CODES={'PROCESS_PARAMETERS','MATERIAL'}


def review_source(a):
    checks=[]
    def add(code,status,title,evidence,needed,impact=None):
        checks.append(dict(code=code,status=status,title=title,evidence=evidence,needed=needed,amount=impact))
    p=a['production'];m=a['metrics']
    if Decimal(p['qualified_quantity'])==Decimal(m['quantity']):
        add('QUANTITY','passed','生产数量勾稽',f"生产 {p['gross_quantity']} − 不良 {p['defect_quantity']} = 合格 {p['qualified_quantity']}，与订单数量一致。",'合格数量不能代替出货验收凭证。')
    else:
        add('QUANTITY','difference','合格数量与订单数量不同',f"合格 {p['qualified_quantity']}，订单 {m['quantity']}。",'核对生产日报与订单。')
    original={x['size']:Decimal(x['quantity']) for x in a['materials'][0]['sizes']}
    mismatches=[x['size'] for x in p['sizes'] if Decimal(x['produced'])-Decimal(x['defects'])!=original.get(x['size'])]
    missing_sizes=set(original)-{x['size'] for x in p['sizes']}
    add('SIZE_QUANTITY','difference' if mismatches or missing_sizes else 'passed','分码合格数量勾稽',
        '差异码号：'+', '.join(mismatches+sorted(missing_sizes)) if mismatches or missing_sizes else '各码生产数减不良数，与原订单分码数量分别一致。','核对分码日报，防止总数相等掩盖分码差异。')
    gaps=[x for x in p['sizes'] if Decimal(x['difference'])!=0]
    add('REPLENISHMENT','difference' if gaps else 'passed','分码不良与补单核对',
        '；'.join(f"{x['size']} 生产 {x['produced']} − 不良 {x['defects']} = 合格 {Decimal(x['produced'])-Decimal(x['defects'])} 双；不良 {x['defects']} 与补单 {x['replenishment']} 相差 {x['difference']} 双" for x in gaps) if gaps else '各码不良数与补单数量一致。',
        '核对报废、返工、回收料与补料；差额不能直接认定为材料损失。')
    remaining=a.get('remaining_checks',[])
    differences=[x for x in remaining if x['difference'] is not None and Decimal(x['difference'])!=0]
    missing_remaining=[x for x in remaining if x['reported'] is None]
    add('REMAINING','difference' if differences else 'pending' if missing_remaining or not remaining else 'passed','逐日剩余数量连续性',
        '；'.join(f"{x['date']} {x['size']} {x['cell']} 差{x['difference']}双" for x in differences[:5]) if differences else
        f'检查 {len(remaining)} 个分码日报记录，其中 {len(missing_remaining)} 项缺少剩余数量。' if missing_remaining or not remaining else
        f'{len(remaining)} 个分码日报记录满足：期初订单数量 − 累计合格数量 = 当日剩余数量。',
        '发现差异时核对对应日报；连续性通过也不能解释补单与不良的业务差额。')
    units=a.get('unit_notes',[])
    if units:
        add('UNIT_NORMALIZATION','passed','材料金额单位已规范',
            '；'.join(f"{x['cell']} 原标签 {x['source_unit']}，模型按{x['normalized_unit']}处理" for x in units),
            '源文件保留未覆盖；后续维护原表时同步修正单位标签，防止把总额当作每双单价。')
    exact_material=sum((Decimal(x['amount_exact']) for x in a['materials']),Decimal(0))
    independently_rounded=exact_material.quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
    display_sum=sum((Decimal(x['amount']) for x in a['materials']),Decimal(0))
    add('MATERIAL_ROUNDING','passed' if independently_rounded==Decimal(m['material_total']) else 'difference','材料汇总舍入核对',
        f'分表显示值合计 {display_sum:.2f} 元；未舍入明细汇总后 {independently_rounded:.2f} 元；差 {display_sum-independently_rounded:.2f} 元。',
        '金额按高精度明细汇总后舍入；显示尾差不作额外损耗或费用。')
    audit=a.get('audit',{})
    add('INDEPENDENCE','passed' if audit.get('method')=='independent_inputs_v1' else 'pending','计算与利润答案隔离',
        audit.get('sequence','缺少独立计算记录。'),'可通过修改利润和汇总单元格的隔离测试复核。')
    for x in audit.get('comparisons',[]):
        status='pending' if x['difference'] is None else 'passed' if Decimal(x['difference'])==0 else 'difference'
        add('COMPARE_'+x['cell'],status,x['label']+'事后对照',f"模型 {x['calculated']} 元，保存值 {x['reference']} 元，差额 {x['difference']} 元。",'相同仅说明算术一致，不证明成本凭证真实。')
    add('TRACE','passed','输入文件可追溯',f"SHA-256：{a['source_hash']}",'文件指纹用于识别版本，不能证明业务真实性。')
    external_cells={x['cell'] for x in a['external_links']}
    external_rows=[x for x in a['cost_rows'] if x['cell'] in external_cells]
    known_external=sum((Decimal(x['amount']) for x in external_rows if x['amount'] is not None),Decimal(0))
    add('EXTERNAL','pending','外链费用原始来源',f"{len(external_rows)} 项来自保存费率，已知金额合计 {known_external:.2f} 元；当前允许按表内费用试算。",'后续补原始费用表、期间、全部分摊对象及完整分母。',f'{known_external:.2f}')
    add('TAX','pending','收入与税口径','报价税口径尚未确认，折扣按表内数值计算。','确认含税/不含税、折扣及出货验收依据。',m['revenue'])
    add('MATERIAL','pending','理论材料与实际耗用','材料由配方、SOP重量和数量推算。','补采购单价、领补退料、回收料及在制品明细。',m['material_total'])
    add('ALLOCATION','pending','人工、制造费用及跨月分摊',f"生产期间 {p['start']} 至 {p['end']}，尚无各期费用池和完整分摊依据。",'补计件工资或分摊记录、费用期间及各期完整分母。')
    rows={x['cell']:x for x in a['cost_rows']}
    def exposure(cells):
        values=[rows[c]['amount'] for c in cells if c in rows]
        return None if len(values)!=len(cells) or any(x is None for x in values) else f'{sum(map(Decimal,values)):.2f}'
    add('ASSET','pending','折旧与固定资产摊分可能重叠','机器折旧与固定资产摊分同时列支；暂未发现可证明重复的凭证。','按资产编号、期间和分摊范围交叉核对。',exposure(['E20','E28']))
    add('DEVELOPMENT','pending','开发费用归属','前期开发成本目前列在加工费用内。','确认应由本单承担的范围、适用订单和分摊期限；分类可能影响毛利。',exposure(['E19']))
    add('CLASSIFICATION','pending','生产与经营费用分类','生产管理工资、行政工资、生产及行政物资领用分别列支。','核对人员、领用单、期间及成本中心，确认分类与是否重复。')
    add('NET_SCOPE','pending','经营净利费用范围','经营净利仅扣目前列示费用；财务费用、税费及其他项目适用情况未确认。','逐项确认适用范围、金额或明确不适用；未提供不得自动视为零。')
    missing=[x['cell'] for x in a['cost_rows'] if x['amount'] is None]
    add('REQUIRED_RATES','difference' if missing else 'passed','本次费用输入完整性',
        '缺失：'+', '.join(missing) if missing else '当前列示的加工及行政费率均有数值。','有数值不代表费用范围完整或已经核实。')
    dates=[x['date'] for x in p['days']]
    duplicates=[day for day,count in Counter(dates).items() if count>1]
    add('DAILY_DUPLICATES','difference' if duplicates else 'passed','生产日报日期重复检查',
        '重复日期：'+', '.join(duplicates) if duplicates else f'当前读取的 {len(dates)} 条日报日期未重复。',
        '相同日期可能是不同班次，应以业务记录确认是否重复归集；本检查仅覆盖适配器读取范围。')
    profits=[m['production_profit'],m['management_reference_profit']]
    negative=any(Decimal(x)<0 for x in profits if x is not None)
    add('PROFIT_SIGN','difference' if negative else 'pending' if any(x is None for x in profits) else 'passed','负利润检测',
        f"生产毛利 {profits[0]} 元，经营净利试算 {profits[1]} 元。",'本规则仅检查是否亏损；判断利润率偏低或波动还需目标值及历史数据。')
    rate=Decimal(p['defect_quantity'])/Decimal(p['gross_quantity'])*100 if Decimal(p['gross_quantity'])>0 else None
    add('QUALITY_RATE','pending','不良率是否超标',
        f"日报不良 {p['defect_quantity']} / 生产 {p['gross_quantity']} 双，不良率 {rate:.2f}%。缺少质量阈值与检验明细，暂无法判断是否超标。" if rate is not None else '生产数量为零，不良率无法计算。',
        '补产品/工段质量标准、缺陷分类、检验及返工记录；不把不良数量直接认定为质量超标。')
    add('PROCESS_PARAMETERS','pending','工艺参数与标准偏差',
        '当前材料有SOP重量，未提供温度、压力、时间等实际工艺记录及允许范围，暂无法判断。',
        '补工艺标准、实测参数、设备/批次/工段及参数允许范围。')
    for x in checks:
        x['category']='profit' if x['code'] in PROFIT_CODES else 'quality' if x['code'] in QUALITY_CODES else 'process' if x['code'] in PROCESS_CODES else 'consistency'
        x['judgment']='暂无法判断' if x['code'] in ('QUALITY_RATE','PROCESS_PARAMETERS') else None
    priorities={'difference':0,'pending':1,'passed':2}
    checks.sort(key=lambda x:priorities[x['status']])
    return {'scope':'本次导入文件及模型记录的桌面审查，尚未核实业务原始凭证。',
            'conclusion':'可作参考试算，尚不能认定为已核实经营净利。',
            'counts':dict(Counter(x['status'] for x in checks)),'checks':checks,
            'categories':[{'id':key,'label':label,'counts':dict(Counter(x['status'] for x in checks if x['category']==key))} for key,label in CATEGORIES],
            'note':'涉及金额是需要核验的范围，可能相互重叠，不代表错报或损失，不可相加。'}
