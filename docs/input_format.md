# 利润模型输入与使用说明

## 运行与入口

双击项目根目录的 `启动看板.cmd`，在浏览器打开 http://127.0.0.1:8765 。保持终端运行；关闭终端或 Ctrl+C 停止服务。也可运行 `python server.py --port 8765`。计算和网页展示仅依赖 Python 3.10+ 标准库；Excel 读写另需 `pip install -r requirements.txt`。

本机启动脚本优先使用 Codex 已配置的 Python，再回退到 PATH 中的 Python。

## 当前范围

支持标准 JSON、多工作表 Excel，以及四工作表“中底成本”原始布局。其他企业原表需建立字段映射。v0.2 的 orders 是订单头；可提供 order_lines 按明细汇总收入，行号唯一，行数量合计与订单头一致，单位必须相同。不同计量单位的产品需拆为独立计算单元，不计算混合单位利润。没有订单行时继续使用订单头的单价、数量和折扣。

本版仅接收 CNY，含税转不含税、外币换算、退货扣款归属及原始领退料转净耗用均需在标准化阶段确认。输入中 `scope_aligned=true` 是输入方声明收入与成本的数量及截止范围相符；如果未确认，填写 false，模型阻止完整利润。

`metadata.is_demo=true` 表示合成数据，真实数据填写 false。`metadata.cutoff_date` 使用 YYYY-MM-DD；`currency` 填 CNY。`mode` 为 forecast（整单预测）或 actual（已交付实际），看板分组展示，不混算合计。

metadata.management_enabled 默认 false；只有明确确认费用范围和分摊规则后填 true。orders.revenue_status 为 confirmed/estimated/missing，税口径待确认时用 estimated；折扣金额未知填 null，正式收入和利润无法计算。

中底源表四张工作表为原订单用量、补单用量、生产周期、成本计算；本地公式复算，外链仅读取缓存并保留待核验状态。源表试算在独立面板显示；正式工时/计薪/费用范围缺失时不输出正式利润。生产数据按码号核对，费用空白不会当作零。

用户导入真实数据后，本地快照保存为 reports/snapshots/latest.json；再次打开页面恢复该快照，不重新计算或加载演示数据。没有本地最新快照时页面保持空白。

## 工作表与字段

Excel 空白模板包含所有表头，演示样例包含可以直接重新导入的合成数据。JSON 使用相同的表名，各表为对象数组，metadata 为对象；字段示例见 `data/samples/demo.json`。

| 表 | 字段及说明 |
| --- | --- |
| orders | order_id 文本唯一编号；product/customer；quantity 数量；unit；unit_price 不含税单价；discount 未包含在净价里的折扣总额；mode；scope_aligned 布尔值 |
| materials | record_id 全局唯一；order_id；quantity 当前计算范围的整单材料用量（不是单件BOM）；unit_price 每相同用量单位的价格；method actual/bom；loss_rate；loss_definition；status；stage；period；source |
| labor | record_id/order_id；quantity 应计薪数量；rate 相同数量单位的计件单价；status/stage/period/source |
| costs | record_id/order_id；category；amount 企业实际承担的净额；status/stage/period/source；included_elsewhere 若已计入其他项目填 true，模型会阻止重复计入 |
| pools | pool_id 唯一；category；period；amount 可分摊总额；total_base 完整适用范围分母；base_unit；status；direct_cost_excluded 布尔值；stage |
| bases | pool_id/order_id；base 当前订单在费用池所处期间的分摊基数，同池同订单一行 |
| coverage | order_id/category/status；每单各类别分别声明范围是否完整；此表不是金额表 |

材料 quantity 的计量单位由单价隐含约定，导入前需确认一致；不自动换算 kg/g。人工数量同样需与计件单位一致。costs.amount 是企业承担后金额；本版不自动推断承担比例。

### 成本类别

material 材料；labor 人工；manufacturing 制造费用；production_other 其他生产成本（例如必要外协）；management 管理；sales 销售；finance 财务；order_other 其他订单费用。当前不允许模具摊销类别。

### 状态

confirmed 已确认；estimated 暂估；missing 待补；not_applicable 确认不适用。费用明细中 not_applicable 只能对应 0；无费用记录不等于不适用。coverage 各项必须声明，未声明按缺失处理；声明 confirmed/estimated 也必须有金额记录支持（已确认实际零可提供金额 0 的记录）。确认不适用需由业务方留存依据，首版由 source 备注记录证据。

### 材料路线

- actual：quantity 是已确认的净耗用，直接乘单价，不再叠加损耗。输入前先处理领料、补料、退料、结余及调拨。
- bom：quantity 是整单理论净用量。loss_definition=input 时除以 (1−loss_rate)；net 时乘 (1+loss_rate)；included 表示已含损耗，不再增加损耗。损耗率使用小数 0.04，范围 [0,1)。BOM 计算结果自动标为估算。

### 费用分摊

period 和 base_unit 必填，基数须覆盖正确期间且单位一致。跨月订单在多个费用池分别填对应月份基数。制造费用默认采用机器工时，期间费用采用产量；模板中显式填写基数与单位，模型按提供的已确认基数计算，不自行选择替代分摊规则。

direct_cost_excluded=true 表示共同费用池已剔除直接归属金额；未声明则阻止分摊。总分母不能只取上传订单之和；部分订单上传时保留池未分摊余额。相同池的每条分摊记录重复展示该池余额，不能把这些余额相加。按已导入范围计算目标分摊金额，再采用整数分最大余数法分配尾差，同余数按订单编号倒序分配；每单记录相对普通四舍五入金额的调整，避免产生负成本或负余额。

stage=inside/outside/unknown，发生阶段与成本类别分开保存。生产成本 stage unknown 时场内暂算利润留空，但不阻止成本归属明确的生产毛利。

## 输出与金额精度

输入金额及单价建议以十进制字符串保存，避免源 JSON 的浮点精度损失。数字绝对值不超过 10^15，最多12位小数。计算使用 Decimal，成本记录与分摊目标金额按分 ROUND_HALF_UP，合计使用这些相同明细金额，利润率保留 6 位小数，页面显示百分比两位。材料与人工的乘除过程保留精度后再按成本记录舍入。

结果：orders 利润；costs 成本；allocations 分摊；issues 缺失/异常；snapshot 版本与假设。完整利润未知时用 null；已知成本是已覆盖项目合计，不代表完整成本。

导出 ZIP 包括四张 CSV、snapshot.json 和完整 result.json。导出使用当前筛选的订单 ID 和同一已保存快照，不重新计算；export_scope 标记导出范围。CSV 的负数金额等以文本形式保护，避免公式注入；计算和分析请以 result.json 为准。

每次计算快照保存在本地 `reports/snapshots/`（已被 Git 忽略）；首版可保留文件进行追溯，尚未提供历史版本对比页面。输入哈希用于定位输入版本，不保存原始上传文件。

## 验证与限制

运行 `python -m unittest discover -s tests -v`。目前算例与测试用于验证程序逻辑，不代表已经通过企业验收。真实数据到位后需核对至少一笔企业认可的手工订单结果，确认范围、单位、计价、分摊及舍入。

本版没有 ERP 自动同步、原始表格智能映射、固定/计时工资分配、跨币种转换、账户权限、云部署、企业财务报表核算或 AI 建议。上述边界不影响本地订单利润模型与展示验证。
