# 训练候选资料导出

导入 Excel/JSON 后，进入“详细数据”，按计算口径、状态和搜索筛选订单，点击
“导出训练资料”。下载 ZIP 只包含当前筛选订单及对应的成本、分摊、异常和适用
源表分析，读取同一份已保存快照，不重算、不修改原快照，也不调用 Ollama。

| 文件 | 内容 |
|---|---|
| orders.csv | 成本和利润摘要，UTF-8 BOM，可用 Excel 检查 |
| orders.jsonl | 每行一个订单快照，保留十进制金额字符串、未知 null、来源和审查 |
| annotations.csv | 专家建议标注模板，与资料通过 sample_id 关联 |
| manifest.json | 数据版本、导出范围、字段解释、演示标记和候选数量 |
| README.md | 字段含义、标注说明及训练前检查 |

金额单位元，利润率为比例；CSV 空白对应 JSON null，不自动补零。已确认的
0.00 保留。known_cost 为已列成本合计，不意味着成本完整。production_profit
和 management_profit 为严格口径，后者是管理利润而非财务净利润。
源表 reference_* 试算单列，其状态一并保留，不作为已确认最终利润。

专家应填写具体任务、决策时间、完整认可答案、建议、理由、证据引用、适用条件、
缺失信息及审核信息。当前版本只导出模板，不接收回传，不生成 SFT messages。
全部记录初始 training_eligible=false、annotation.answer=null、review_status=unreviewed，
sft_ready_count=0；不把 AI 草稿或规则建议自动当作答案。

导出不自动脱敏，也不认定来源授权。is_demo 仅沿用源快照声明，不能证明真实性。
训练前需核验输入和专家答案、处理敏感字段、确认授权。接单前建议输入需限制为
决策时可见信息，不能泄露后续利润。按订单组与时间划分训练和测试，不能随机
拆分同一订单的多个快照。详细字段及标注含义见包内 README。

接口：`POST /api/export-training`，JSON 请求包含 `snapshot_id` 和非空、不重复的
`order_ids` 列表。校验本机同源、快照编号和订单归属后返回 ZIP。使用已有接口
10MB 请求限制；未知订单、空范围或重复编号返回 400。
