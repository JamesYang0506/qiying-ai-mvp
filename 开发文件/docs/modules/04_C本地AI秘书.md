# C模块 本地AI秘书

## 产品定位

AI像熟悉订单的秘书：理解问题，先给简明答案，再用数据说明，提出可执行的核查建议，并能继续追问。可以使用自然、形象的表达，但金额、风险和原因判断必须对应事实与证据。

不同问题采用不同回答方式，不强制所有回答套同一模板。例如：

| 问题类型intent | 反馈方式 |
| --- | --- |
| profit_explanation | 先说赚多少/较预期少多少，解释利润口径，再说明关键差额 |
| daily_briefing | 按优先级简报今天最需关注的订单，标出覆盖和待补数据 |
| cost_investigation | 按成本项目解释变化，列出可能原因与具体核查资料 |
| comparison | 按一致范围比较订单或日期，范围不一致时先澄清 |
| data_check | 明确哪些缺失阻止判断、由谁补什么资料 |
| clarification/general | 解释概念或询问订单/日期，不虚构订单事实 |

示例回答（仅合成固定案例）：

“这笔订单当前生产毛利为1,320元，比同产量预期少680元。毛利率从计划20%降至13.2%，下降6.8个百分点，按已确认规则属于严重偏离。差额主要体现在材料多支出500元、人工多支出180元。可以先核对这一天的领退料和工段计件记录；这些是成本线索，还不能认定是浪费或低效率。经营费用若已确认共170元，经营利润为1,150元；订单未结算，最终利润仍待确认。”

数值必须由服务端事实模板/引用渲染得到，不能依赖模型自由口算生成这段金额。

## 服务边界

C从B读取固定view_id或snapshot_id，不相信浏览器提交的金额。多轮对话保存scope与版本，新增问题可显式刷新上下文；刷新产生新context_id，并在界面提示数据已更新。

refresh_context=true仅刷新相同订单集合、业务日期范围内的最新可见修订，known_at重新冻结为刷新时刻；不暗中变更问题范围。更换订单或日期范围须新建conversation。snapshot_refs模式刷新时按原order_id/as_of解析新快照；view_id模式按该视图的固定订单集合与日期创建新视图。返回任务的context_id就是本轮使用版本；expected_context_id不匹配返回409。

读取工具首版仅允许：get_order_snapshot、get_portfolio_view、get_portfolio_trend、get_evidence、search_rules。工具由后端检查用户权限、订单集合、日期和版本。模型不能发任意SQL、访问任意文件或任意URL；不能自行修改价格、停线、换料或生产计划。

高影响建议返回requires_human_approval=true，仅供建议展示。本轮不提供自动执行生产动作的接口。

## 上下文与回答结构

上下文包含context_id、snapshot_refs、view_id、data_as_of、known_at、formula/rule版本、计算指标、证据、未知项及必要历史记录。规模超过上下文预算时，先由B聚合，再按问题检索相关订单；输出coverage说明纳入/未纳入范围，不悄悄截断后声称分析了全部订单。

AssistantAnswer包含intent、summary、blocks、fact_refs、possible_causes、options、recommended_checks、unknowns、follow_up_questions、coverage、requires_human_approval。blocks为paragraph/table/action等类型；事实通过fact_refs关联，前端可链接到证据。

fact_refs里每条包含snapshot_id、evidence_id。不同快照同名证据不能串用。C校验：结构有效、引用存在、属于请求范围与版本、引用值和展示数字一致、未知项没有变成已证实事实。失败最多一次修复尝试，仍失败则job.status=failed/error.code=AI_OUTPUT_INVALID，不展示未经校验的结论。自然段中的自由金额也需验证或由已验证fact占位符替换。

`reviewed`默认false；引用校验通过只代表依据合法，不代表业务原因已核实。

## HTTP接口与长任务

均省略 `/api/v1` 前缀：

| 接口 | 说明 |
| --- | --- |
| GET `/assistant/status` | configured、ready/unavailable、provider/model/model_revision、队列状态 |
| POST `/assistant/conversations` | 创建对话，固定scope与style，返回conversation_id/context_id |
| POST `/assistant/conversations/{conversation_id}/messages` | 提交问题与expected_context_id、refresh_context；返回202/job_id |
| GET `/assistant/jobs/{job_id}` | 轮询状态及最终AssistantAnswer；completed前result=null |
| POST `/assistant/jobs/{job_id}/cancel` | 尽力取消，幂等；已完成返回completed，不伪装已取消 |
| POST `/assistant/messages/{message_id}/feedback` | 人工评分、纠正和审核状态；保存模型原答与修订答 |

首版采用异步任务＋轮询，避免为流式文本增加三人联调成本。以后可加SSE；其token事件只作生成中预览，最终仍经结构和证据校验后发布。

模型不可用返回503 MODEL_UNAVAILABLE，不把模板回答冒充模型生成。任务状态queued/running/completed/failed/cancelled；旧context任务即使完成，也不能自动替换新问题/新context界面。记录模型版本、提示版本、适配器版本、温度、耗时和上下文摘要。

本地显存资源有限时，首版并发1＋有界队列，超限429/Retry-After；服务端超时配置与客户端轮询停止机制分别定义。模型运行配置放服务端，不在前端泄露路径或允许随意改服务地址。

## 本地模型与训练路线

现有旧项目已有Ollama/Qwen适配，可复用ollama_client.py和analysis_gateway.py的思想；当前主机实际可用模型仍以运行检查为准，不在本轮自动下载、训练或变更模型。

建议先按以下次序推进：

1. **提示与结构化输出。** 先固定秘书语气、问题分流、事实引用及未知处理，建立可测试基线。Ollama Chat API支持后端消息调用及JSON Schema输出，适配层负责把其响应转换为本契约。[Chat API](https://docs.ollama.com/api/chat)、[结构化输出](https://docs.ollama.com/capabilities/structured-outputs)。
2. **检索资料。** 企业术语、规则、历史处置按订单权限和生效日期检索，动态数值从B取。资料变化更新索引，不让训练记忆每日利润。
3. **人工审核案例。** 收集不同问法、好回答、引用依据和纠正理由；AI草稿不自动成为标准答案。
4. **必要时做SFT/LoRA。** 主要训练表达模式、问题分类、建议组织和保留未知。LoRA通过训练低秩更新适配冻结的基础模型，具体框架/权重格式和显存可行性须另做实验，不承诺当前硬件可训指定规模。[PEFT LoRA说明](https://huggingface.co/docs/peft/main/en/conceptual_guides/lora)。
5. **同一独立测试集比较后上线。** 原模型、提示/RAG、微调版使用相同订单组测试；保留可回滚版本。

训练样本字段至少有sample_id、order_group_id、input_context_snapshot_refs、question、intent、reviewed_answer、fact_refs、reviewer、reviewed_at、redaction_status、dataset_split、prompt_version。按订单组＋时间划分训练/验证/测试，补单、同订单不同日期和多条问答不能跨集合泄漏。

评测重点：金额及单位引用正确率、证据有效率、未知误判率、关键风险漏报、人工可用性、不同问法稳定性与响应时延；不能只看语言流畅或训练loss。训练材料、权重和企业资料不提交普通源码仓库。

## C独立开发交付

先使用examples中的快照和固定回答构造mock供前端联调，必须标记provider=mock且不当成正式模型结果。再提供真实provider=ollama适配器。交付上述API、回答Schema校验、provider接口、问题案例和评测报告。无需等待B正式数据库；整合时只替换数据读取适配器，不更改对话契约。
