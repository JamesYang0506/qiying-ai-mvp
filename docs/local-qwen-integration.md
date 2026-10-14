# 本地 Qwen 接入

第三页通过本机 Ollama 调用 qwen3.5:4b。仅连接127.0.0.1:11434，绕过系统代理，拒绝远程/云端模型标签。服务端环境变量 QIYING_OLLAMA_MODEL 可指定其他已安装本地模型。未下载新模型、启动训练或对外发布资料。

GET /api/ai/status 返回 configured、status（ready/unavailable）、model、model_digest 和说明。POST /api/ai/analyze 仍接收 snapshot_id、order_id、focus、question，从保存快照读取所选订单。前端自带金额不作为依据。

输入为独立计算金额、订单成本记录及可信化审查，不输入工作簿保存利润对照答案。每条风险和建议必须引用当前订单有效事实id。通过动态JSON Schema约束引用，服务端再次校验结构和引用。引用校验通过不代表业务分析真实，须人工复核。

模型可用时返回 status=completed、result（summary/risks/recommendations/unknowns）、evidence、模型摘要、提示版本、耗时和令牌统计。reviewed=false。不可用时只准备资料，返回not_configured/result=null；调用或验证失败返回400，并发生成返回409。

分析独立保存在 reports/snapshots/ai-analyses/<request_id>.json，包含原计算快照、上下文指纹、模型版本、结果及未审核标记。不会改写订单、计算快照或首页规则建议，不自动作为训练标签。人工审核尚未开发；训练导出已移除，后续训练路线已暂缓。

首版推理配置 num_ctx=8192、num_predict=1800、think=false、temperature=0.1，超时180秒；只允许一个生成请求。长订单后续需分块检索。当前主机实测确认后再调整，不视作通用性能保证。

参考：[Chat API](https://docs.ollama.com/api/chat)、[结构化输出](https://docs.ollama.com/capabilities/structured-outputs)。
