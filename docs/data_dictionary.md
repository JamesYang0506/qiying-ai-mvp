# 数据字典草案

以下为标准字段候选，尚未与企业数据确认。拿到样本后，逐项记录源文件、工作表、源字段、含义、单位、是否必填、转换方式和业务确认人。

| 数据表 | 候选字段 | 需要确认的口径 |
| --- | --- | --- |
| 订单 | order_id, product_id, quantity, unit_price, occurred_at | 数量单位、价格含税情况、折扣、订单明细标识 |
| BOM | product_id, bom_version, material_id, unit_usage, unit | 生效日期、单件或整单用量、是否已含损耗 |
| 材料收发 | document_id, line_id, order_id, material_id, movement_type, quantity, unit, occurred_at | 领料、补料、退料、正负号和订单归属 |
| 材料价格 | material_id, unit_price, price_period | 加权均价范围、币种、计价单位 |
| 生产 | batch_id, order_id, process_id, produced_quantity, qualified_quantity, scrap_quantity, machine_hours, occurred_at | 数量关系、返工口径、工时单位 |
| 人工 | order_id, process_id, piece_rate, actual_quantity | 计件计时方式、重复归集风险 |
| 月度制造费用 | period, expense_amount, total_machine_hours | 费用包含项、工时分母及模具是否已计入 |

所有处理记录保留导入批次、源文件、源工作表、源行号。业务发生时间、录入时间和导入时间分别保存，核算期间由确认后的业务规则确定。

编号按文本保留前导零。编码映射按企业及来源区分；无法匹配时保留待核验项。名称相似匹配只能作为候选关系。跨表单位转换须有明确依据。
