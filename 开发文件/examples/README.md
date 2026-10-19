# 合成接口示例

这些JSON用于mock与联调，不是当前应用实际返回的数据，不包含企业经营资料。

| 文件 | 用途 |
| --- | --- |
| calculation-request.json | A模块输入，直接提交POST /api/v1/profit/evaluate的请求体 |
| calculation-response.json | A输出及B保存快照的统一响应示例 |
| allocation-request.json | A全池制造费用分摊输入，与实际成本中的ACT-POOL-v1对应 |
| batch-request.json | B批量日报写入请求体；需另带Idempotency-Key请求头 |
| view-request.json | B冻结多订单视图请求体；需另带Idempotency-Key请求头 |
| conversation-request.json | C按指定快照创建对话；需另带Idempotency-Key请求头 |
| assistant-response.json | C任务完成的固定mock响应，provider=mock且reviewed=false |
| schema-map.json | 示例到OpenAPI Schema的映射，供校验脚本使用 |

示例ID仅在mock里有效，正式接口必须先创建订单、基线与快照，再使用服务端返回的ID。不能把本包的QY-DEMO-001等ID当成线上已有记录。

校验需要Python与jsonschema库，运行 `python contracts/validate_examples.py`（在仓库根目录）。校验内容包括Schema、引用完整性、路径参数、独立重算样例和AI证据关联；不替代各模块的业务测试。
