# 利润模型与本地看板实施计划

> 执行方式：本会话内完成实现与验证，依据用户“先建立一个模型，然后你选择”授权推进。

**Goal:** 交付可运行的利润计算模型与本地网页看板，后续能够导入标准化企业数据。

**Architecture:** Python Decimal 计算引擎独立于 HTTP 服务；本地网页调用计算接口，图表、详情与导出均读取同一个计算快照。服务只监听 127.0.0.1，无外部资源或 AI 调用。

**Tech Stack:** Python 标准库、HTML/CSS/JavaScript/SVG；可选 openpyxl 提供 Excel 导入导出。

**Spec:** 工作区 output/docs/利润计算初步模型_v0.1.md。

## 约束与裁定

- 模具摊销不纳入模型；实际耗用不重复加损耗。
- 分层利润各自保存完整度；缺失值不能作为零。
- 订单收入与成本采用用户声明的相同数量范围及截止日期；未声明匹配时不能给出完整利润。
- 直接费用与费用池必须由输入方声明已剔重，未声明时分摊阻止。
- 合成数据、实际/预测与暂估状态始终可见。
- 金额 Decimal；最终金额按分 ROUND_HALF_UP；分摊尾差明确记录。
- 不更改原仓库 main、不推送；独立工作目录 qiying-profit-model。
- 本轮完善独立计算接口，既有协作接口不变。

## Review Focus

缺失费用；重复或无主记录；跨期分摊及部分订单上传；零分母及不合法数字；导出与筛选结果一致。

## Task 1：计算引擎

文件：profit_model/engine.py、tests/test_engine.py、data/samples/demo.json。

接口：calculate(dataset: dict) -> dict，输出 orders/costs/allocations/issues/snapshot 五类结果。

- [x] 先写手算例及风险测试，运行 unittest 确认尚未实现而失败。
- [x] 实现输入校验、Decimal 公式、分摊与状态传播。
- [x] 验证标准算例收入19800、材料6250、毛利6050、管理利润4350；覆盖实际损耗、缺失、重复、零分母、跨月、分摊守恒。

## Task 2：本地服务与文件

文件：server.py、profit_model/files.py、tests/test_files.py、启动看板.cmd。

接口：GET /api/demo、/api/template、/api/template.xlsx；POST /api/calculate、/api/import-xlsx；返回与 calculate 相同结果。

- [x] 写标准 Excel 往返测试和接口真实 HTTP 测试，先失败再实现。
- [x] 实现只读静态资源白名单、输入体积限制、同源校验、JSON/Excel 解析、快照保存。
- [x] 导出五类结果 JSON/CSV 包，快照保存在忽略的 reports/snapshots。

## Task 3：看板与交付

文件：web/index.html、web/app.js、web/style.css、README.md、docs/input_format.md。

- [x] 建立总览、订单筛选、详情成本构成、分摊追溯、缺失列表、上传与下载。
- [x] 使用浏览器验证筛选、订单选择、导入、导出、窄屏及错误反馈。
- [x] 运行完整测试、自查计算范围与 UI 一致性，记录验证结果。

## 执行与复核记录

- Task 1 complete：公式、状态和分摊引擎实现；标准算例及风险测试通过。
- Task 2 complete：真实 HTTP 测试、Excel 往返、快照保存和同快照导出通过。
- Task 3 complete：本地网页实现；浏览器检查搜索、缺失筛选、订单详情、实际/预测隔离与下载。
- 独立只读审查发现两项 P2，均先写回归测试复现再修复：微小费用池负分摊/负余额，超小数值导致 Decimal 溢出。
- 裁定：BOM 必须传播估算状态，即使源字段标 confirmed；明确区别公式正确与实际成本已确认。
- 裁定：成本记录先按分舍入再汇总，确保明细、分类、利润及导出可核对。
- 裁定：分摊改为整数分最大余数法，同余数按订单编号倒序，保留调整与未分摊余额。
- 裁定：本轮在原仓库之外建立独立 Git 工作目录；未推送、未合并 main。
- 仍需真实数据验收、源表字段映射及企业口径确认。

不会将合成算例验证表述为企业真实数据验收。
