# 当前模型接口

## 标准计算

`profit_model.engine.calculate(dataset)` 接收 metadata、orders、materials、labor、costs、pools、bases、coverage 等标准结构，返回 orders、costs、allocations、issues、snapshot，可附带 source_analysis。金额使用Decimal，输出金额字符串；缺失为null，不与零混淆。

字段和模板见 [输入格式](input_format.md)，公式见 [公式说明](formula_v0.2.md)。

## 源表适配

`profit_model.eva_source.read_eva_workbook(content)` 接收工作簿字节，识别原订单用量、补单用量、生产周期、成本计算四张表，生成标准输入和source_analysis。

source_analysis含 metrics、profit_layers、cost_rows、materials、production、remaining_checks、unit_notes、audit、trust_review及来源指纹。试算和严格利润字段分开保存。先由数量与成本独立计算，再对照保存利润。

## HTTP

| 接口 | 行为 |
|---|---|
| GET /api/current | 读取本机最新计算快照，无快照时返回空状态 |
| GET /api/history | 按订单汇总历史版本摘要，返回 orders 和 skipped_files；跳过损坏或不兼容快照 |
| GET /api/history/{snapshot_id}?order_id={order_id} | 只读获取指定版本的单笔订单及其成本、分摊、问题和对应来源；analysis_records 仅包含订单与快照均匹配的已保存模型结果 |
| POST /api/calculate | 按标准JSON计算并保存快照 |
| POST /api/import-xlsx | 导入Excel、计算及保存快照 |
| POST /api/export | 按快照和订单范围导出结果 |
| GET /api/template、/api/template.xlsx | 下载空白输入模板 |
| GET /api/ai/status | 检查本机Ollama及指定模型状态 |
| POST /api/ai/analyze | 从订单快照读取事实，调用本地模型并验证结果 |

AI请求与结果说明见 [本地接入](local-qwen-integration.md)。模型输出包含summary、risks、recommendations和unknowns；风险和建议引用有效事实id。分析独立保存，reviewed=false，不改写计算结果。模型未就绪、失败和结构/引用错误均明确反馈，不以模拟结论替代。

服务仅绑定本机地址，支持10MB内输入并限制同源操作。本地模型一次只处理一个生成请求。前端显示精度不改变底层计算及导出精度。
