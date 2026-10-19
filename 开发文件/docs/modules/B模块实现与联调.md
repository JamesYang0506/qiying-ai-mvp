# B 模块实现与联调

本次实现依据 `03_B多订单与时间管理.md`、公共数据约定和《订单监测首页：设计与 CC 交接大纲》。保留现有 A 核算器和单订单页面，不另写利润算法。本文描述当前实现；旧交接文档中的“全部接口仅为设计”和旧测试数量不再代表本次状态。

## 可以直接使用

- 默认 `#monitor` 是已导入订单的监测首页；`#demo` 是独立的内置合成演示。没有业务数据时显示导入入口。
- 页面包含统一日期/基线模式、同集合三张金额卡、今日恶化数量、覆盖说明、固定交集趋势、毛利率分布、重点订单、最多三条核查建议和全部订单。
- 列表支持搜索、今日恶化/待补齐/分布筛选、稳定排序和分页；列表筛选不改变总体统计。返回首页保留查询和选择。
- 当日恶化比较前后日的**当日毛利率**，单位成本按合格量计算。零收入、零合格量、缺日报、迟录、整套导入修订分别说明，不伪造比较。迟录和整套修订采取保守排除。
- 材料、人工、制造及补单建议使用单位量、价格或比例线索，不断言浪费或停机。补单不重复计费。依据窗口读取固定快照的前后日原始记录及缺项。
- 日期快速切换时丢弃旧响应；失败保留上次成功范围并明确标识。

## 两条明确的数据入口

| 入口 | 当前能力 | 核算依赖 |
| --- | --- | --- |
| 现有 Excel `/api/import-v1` | 保留导入及单订单分析，新增首页和持久化固定视图、快照、来源 | 已连接现有 `evaluate`，可直接运行 |
| 正式 `/api/v1` | 订单/基线/日报修订、原子批次、任务、费用池依赖、固定视图、分页、历史和证据接口 | B 调度已完成，需 A 提供正式 `calculateOrder`、`allocateManufacturing` |

不会将旧导入数据静默转换为正式 PeriodInput，也不会用演示答案替代正式 A 计算。正式日报提交后即持久化；未接入 A 时任务明确失败，错误为 `CALCULATOR_UNAVAILABLE`，接入后可通过重算接口恢复。现有 Excel 首页继续正常核算。正式快照尚未接入现有单订单 UI，供 A/C 按契约联调使用。

## 存储和一致性

新文件在 `data/imports/b-module/b-state.json`。原 `data/imports/*.json` 不迁移、不覆盖，保留旧入口。整个 data 目录被 Git 忽略。

B 数据采用版本化 JSON 仓库，包含 orders、baselines、reports、pools、batches、jobs、snapshots、views、idempotency。写事务在同进程串行，完整状态写入临时文件、fsync 后原子替换；校验失败不发布状态。服务重启会重新处理 queued/running 任务。

**运行边界是本机单服务进程。** 本次没有引入 SQL 数据库、多进程写锁、用户鉴权或远程共享部署。多个独立服务不能写同一目录。后续数据库迁移应实现同一 repository 事务接口，保留原始记录、历史版本和幂等结果；不能只导出最新值。

- 日报身份：order_id + business_date + report_key；修改生成整份新修订。
- 来源身份：source_system + source_record_id。重复内容不再新增；同业务不同来源或来源占用冲突返回 409。
- 所有正式写操作要求 Idempotency-Key。相同键相同内容返回原结果；不同内容返回 409。expected_revision 实现乐观锁。
- 批次仅接受 atomic=true，预校验所有条目后一次写入日报与任务。
- 任务冻结输入版本；完成时复核当前版本。旧任务标为 superseded，不能作为当前 ready 结果。
- 快照、固定视图及来源不可变。as_of 管业务日期，known_at 管系统已知时间。系统无法重建首次导入以前不存在的历史。
- 正式视图固定订单/快照集合，游标绑定 view_id、排序、页大小；日报游标还冻结 known_at。过时结果标 stale，并从已知汇总中排除。
- 币种、税、收入、成本等口径分组。毛利率按总毛利/总收入；实际已知集合与可比集合分别返回。
- 共享池修订重算新旧参与订单的并集。池分摊由 A 提供；同池在一个累计范围仅计一次。未覆盖完整池期间的范围标资料不完整，不自行按天摊一遍。正式阶段口径必须由 A/B 明确后扩展。
- 核算预期只使用匹配范围的显式 stage_inputs 或完整基线输入；B 不默认按产量等比例缩放整单费用。

## 接口

以下正式路由均已接入，字段仍以 `contracts/openapi.json` 为准：

```text
POST /api/v1/orders
PUT  /api/v1/orders/{order_id}
POST /api/v1/orders/{order_id}/baselines
POST /api/v1/reports/batches
GET  /api/v1/reports/batches/{batch_id}
POST /api/v1/manufacturing-pools
POST /api/v1/orders/{order_id}/recalculations
GET  /api/v1/jobs/{job_id}
POST /api/v1/portfolio/views
GET  /api/v1/portfolio/views/{view_id}
GET  /api/v1/portfolio/views/{view_id}/trend
GET  /api/v1/orders/{order_id}/snapshots
GET  /api/v1/orders/{order_id}/snapshots/{snapshot_id}
GET  /api/v1/orders/{order_id}/reports
GET  /api/v1/snapshots/{snapshot_id}/evidence
```

统一响应为 schema_version/request_id/data 或 error。写请求除幂等键外还需同源 Origin 和 X-Qiying-Token，令牌从原 `/api/import-v1/session` 读取。首版依旧只监听本机。

首页本地适配接口（不是正式契约的替代品）：

```text
GET /api/import-v1/monitor?asOf=YYYY-MM-DD&period=7&baselineMode=ideal
GET /api/import-v1/monitor/views/{viewId}
GET /api/import-v1/monitor/views/{viewId}/snapshots/{snapshotId}/evidence
```

首次 monitor 请求冻结并持久化本次视图，后续按 viewId 读取原结果。可选 knownAt 必须是带时区时间。趋势窗口上限 90 天，正式单次任务/视图日期范围上限 366 天；这是资源保护范围，不是容量承诺。

## A、C 联调入口

`createApp` 和 `createRoutes` 接受以下依赖：

```js
createApp({
  root,
  calculateOrder: request => A.calculate_order(request),
  allocateManufacturing: request => A.allocate_manufacturing(request),
});
```

A 返回裸 CalculationResult/AllocationResult，不包含 HTTP envelope；异步函数也可。B 校验结构、订单、范围、快照、基线和输入摘要；费用池另校验分摊守恒。可在 `serve.mjs` 接入 A 适配器；服务端源码改动后重建运行包。

C 应先获取固定 view_id 或 snapshot_id，再从 B 获取对应事实和证据，不能以最新修订解释旧快照。

## 验证和后续

```powershell
npm run build
npm test
python contracts/validate_examples.py
```

新增 tests/orders 覆盖原子批次、并发修订、来源冲突、任务过时、费用池关联重算、补录/known_at、不可变快照、分页期间更新、汇总集合、单位成本、分布阈值及正式 HTTP 响应。正式 A 联调用合成 mock 验证 B，不代表 A 公式完成。

可选 `node scripts/verify-b-browser.mjs` 使用 Playwright，自动创建并删除合成数据，检查桌面/390px 窄屏、搜索、分布筛选、固定依据、旧响应竞争和错误状态。需要单独可用的 Playwright 与浏览器；可用 QIYING_PLAYWRIGHT_PATH 指定模块、QIYING_BROWSER_CHANNEL 指定浏览器。截图输出 output/b-module，不进入业务库。

后续仍需：A 正式入口联调、Excel 与正式模型的显式迁移映射、真正的数据库事务与多进程治理、容量实测、业务费用池阶段归属确认，以及真实企业验收案例复算。本次未获取旧电脑路径下的完整企业验收材料，因此没有声称通过企业案例验收。
