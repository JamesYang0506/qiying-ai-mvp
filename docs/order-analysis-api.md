# 智能订单分析接入接口 v1

> 本文保留接入前的接口草案。当前已经接入本地Ollama/Qwen，实际状态、返回值和保存方式见 [本地接入说明](local-qwen-integration.md)。

顶部第三页为智能订单分析。当前没有模型提供方、外部请求或模拟结论。页面允许选择订单、分析方向、补充问题，准备本地计算资料。

## 状态

`GET /api/ai/status` 返回 `schema_version: order-analysis.v1`、`configured: false`、`status: not_configured` 和说明文字。不能以“接口可访问”代替“模型已接入”。

## 准备分析

`POST /api/ai/analyze`，JSON 请求示例（替换为真实快照及订单）：

```json
{
  "snapshot_id": "snapshot-id-from-calculation",
  "order_id": "selected-order-id",
  "focus": "decision",
  "question": "追加订单前需要核查哪些成本和风险？"
}
```

focus 可选 decision / profit / cost / risk。question 为选填，最多2000字。接口校验快照与订单关系，从已保存快照读取所选订单、成本、分摊、问题；只有源工作簿分析属于该订单时才附带 source_analysis。客户端额外提交的金额和 context 不用作依据。无效输入返回400，同源检查沿用现有服务规则。

当前响应为200，包含 schema_version、request_id、status（not_configured）、message、request、context，result 固定为 null。该200仅代表资料准备成功。context.snapshot 保留计算版本、精度和输入追溯信息。不会改写计算快照或产生模型结论。页面更换订单、问题、方向或快照时清除旧结果，过期请求不会覆盖新状态。

## 后续接入位置

在 `profit_model/analysis_gateway.py` 增加服务端模型适配器；提供方及密钥仅放服务端，接入时再明确企业资料的发送范围。模型解释引用原始确定性计算结果，不能覆盖成本和利润。前后端同步增加已接入状态和结果校验，再启用模型分析按钮与结果渲染。

建议未来结果结构：summary（结论）、risks（含严重度与依据）、recommendations（含行动与适用条件）、evidence（引用记录或单元格）、unknowns（待确认事项）。这些字段尚未由模型生成，当前页面仅预留展示区域。
