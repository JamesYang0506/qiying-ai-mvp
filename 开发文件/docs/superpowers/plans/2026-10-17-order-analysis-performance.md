# 多订单分析性能优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除多订单刷新导致的历史整体重写，降低重复核算和页面等待，保持订单利润和证据一致。

**Architecture:** 导入监测历史采用独立不可变视图/快照存储，共享输入按摘要复用。计算层复用每日结果形成累计曲线，导入存储加索引，页面按需读取数据。正式 B 业务仓库保留现有职责。

**Tech Stack:** Node.js ≥20、ES modules、Decimal.js、原生文件系统、现有 HTML/CSS/JavaScript、node:test。

**Spec:** `../../handoff/07_多订单性能优化交接.md`。本文是未来执行计划，本轮仅交付文档。

## 全局约束

- 基线提交 `a750634`，工作目录 `C:/Users/lenovo/Desktop/挑战杯/qiying-ai-mvp`。
- 保留日期可见性、迟录处理、null、补单已含、Decimal 舍入、可比集合与 ideal/budget 口径。
- 固定 viewId/snapshotId 和版本不可变；新数据不能改变旧引用。
- 保留正式 B 的订单、报工、制造池、幂等记录和接口。
- 数据、备份、性能输出均不进 Git；不自动推送主分支。
- 内部签名、HTTP 兼容、迁移和性能验收以交接文档为准。

## 评审重点

1. 迁移中断、重复执行、共享快照：原数据可恢复且旧引用继续可读，由任务 2 测试。
2. 原始文件被外部修改或新增修订：索引和缓存失效，由任务 3/4 测试。
3. 迟录数据或跨日 knownAt：缓存不泄露未来事实，由任务 3/4 测试。
4. 长周期缺项、零产量、预算储备及舍入：趋势与旧算法一致，由任务 3 测试。
5. 快速切换订单/日期和失败重试：旧响应不覆盖新范围，由任务 5 测试。

## 任务 1：建立可重复性能基线

文件：新增 `scripts/benchmark-performance.mjs`、`tests/performance/fixtures.mjs`。

接口：命令 `node scripts/benchmark-performance.mjs --data-dir <隔离目录> --output <Git忽略的JSON路径>`。输出环境版本、订单/版本/记录数量、日期、窗口、p50/p95/max、响应/写入字节及计算次数。

- [ ] 写参数校验测试：不允许默认向真实 data 生成订单或追加监测历史；缺少显式测试目录时失败。
- [ ] 运行该测试确认失败，随后实现基准工具：复制所需数据到临时目录，基准服务使用独立 dataDir，结束后仅清理确认在临时根目录内的文件。
- [ ] 记录当前 16 笔订单和大历史基线；预热 3 次、测量 20 次。大历史循环成本高时先完成小样本，再显式运行完整基线，勿在用户服务上压测。
- [ ] 验证真实数据摘要未改变，输出基线报告；提交 `test: add isolated performance baseline`。

## 任务 2：拆分监测存储并迁移历史（最高优先级）

文件：新增 `server/monitor/storage.mjs`、`scripts/migrate-monitor-history.mjs`、`tests/monitor/storage.test.mjs`、`tests/monitor/migration.test.mjs`；修改 `server/monitor/overview.mjs`、`server/http/routes.mjs`；正式 B 的 `server/orders/repository.mjs` 首轮保留。

接口：实现交接文档的 `createMonitorRepository()`、`saveView/getView/getSnapshot`。保持 monitor create/get/evidence 的 HTTP 输出兼容。

- [ ] 先写测试：保存后重启可读；固定 ID 内容不可变；并发发布无缺失引用；不同快照的证据不能串用；目录穿越被拒绝。
- [ ] 先写迁移测试：原 ID 保留；中断/重跑幂等；正式 B 快照与共享引用保留；失败时原文件不变；校验未过禁止切换。
- [ ] 运行 `node --test tests/monitor/storage.test.mjs tests/monitor/migration.test.mjs`，确认失败来自未实现接口。
- [ ] 实现按 ID 文件读取、输入摘要复用、原子发布，以及显式维护迁移命令 `node scripts/migrate-monitor-history.mjs --source <b-state.json> --target <新目录> --backup <备份目录>`。禁止迁移在请求中自动发生。
- [ ] 修改监测服务使用新仓库，证据请求读取指定视图与快照，不读全历史。正式 B 接口仍用原仓库。
- [ ] 跑定向测试与 `tests/orders/` 全部测试；按交接文档备份、导出、核验本地历史后再切换。保存阶段性能对照。
- [ ] 提交 `perf: separate immutable monitor history storage`。

## 任务 3：趋势单次核算、索引与缓存

文件：新增 `server/profit/series.mjs`、`server/profit/cache.mjs`、`tests/profit/series.test.mjs`、`tests/profit/cache.test.mjs`；修改 `server/profit/evaluate.mjs`、`server/profit/trend.mjs`、`server/monitor/overview.mjs`。

接口：`calculateSeries(dataset,{start,end,baselineMode})` 返回现有 trend points。缓存模块提供 `createCalculationCache({maxEntries})`，实例方法 `getOrCompute(key,compute)`；key 由调用方完整上下文构造，拒绝未限定大小的全局 Map。

- [ ] 用旧 evaluate 逐日结果生成测试期望，覆盖 ideal/budget、迟录、缺项、跨窗口累计、开工前、完工后、零产量和舍入；完整逐日深比较。
- [ ] 增加调用次数测试：生成 D 个趋势点不应调用 D 次完整 evaluate；增加缓存并发合并、失败清理、容量淘汰、版本/可见记录/公式变化失效测试。
- [ ] 运行新增测试确认失败，抽取共用每日核算，按日期索引记录并累计；保留 analysis 返回结构、完整诊断及证据行为。若新增内部函数，测试中计数，不增加产品接口。
- [ ] 监测复用序列，修正昨日获取的字段不匹配问题；客户和搜索可前置筛选，但风险/状态筛选保留正确计算依赖，筛选选项范围不回归。
- [ ] 加入计算产物缓存；knownAt 和 availableAt 的有效变化不能漏进键；不把默认最新请求绑定到陈旧视图。
- [ ] 执行 `node --test tests/profit/ tests/orders/monitor.test.mjs`，再跑中底验收；性能工具记录调用次数与不同窗口耗时。
- [ ] 提交 `perf: reuse daily calculations for cumulative trends`。

## 任务 4：订单存储按版本读取、汇总单次扫描

文件：修改 `server/storage/store.mjs`、`server/http/routes.mjs`、`tests/storage.test.mjs`；新增 `tests/storage-index.test.mjs`。

接口：保留 createStore 的现有签名；选定版本读取不能每次扫描并解析所有 JSON。portfolio 一次取固定版本集合计算，保证请求中版本自洽。

- [ ] 写测试：读取目标订单不会解析无关订单；commit 后立即可见；并发重复提交仍去重；外部新增、删除、同名修改触发失效；损坏文件明确报错。
- [ ] 运行 `node --test tests/storage-index.test.mjs` 确认失败，实现索引和有限文件缓存，明确外部变化检测方式。
- [ ] 改 portfolio 读取方式，避免 listOrders 后逐笔 get 触发重复全扫；保留汇总字段和不可比排除语义。
- [ ] 执行 `node --test tests/storage.test.mjs tests/storage-index.test.mjs tests/import-api.test.mjs`，计数核验单次汇总只扫描一次版本集合。
- [ ] 提交 `perf: index imported order revisions`。

## 任务 5：分析页面按需请求并防止过期响应

文件：修改 `dist/import-api.js`、`dist/imported-workspace.js`、`dist/monitor-workspace.js`；扩展 `tests/import-api.test.mjs`；新增 `tests/analysis-loading.test.mjs`。沿用现有样式，必要时仅增局部加载/失败提示。

接口：getAnalysis/getTrend/getPortfolio 支持可选第三参数 `{signal}`，旧调用兼容。HTTP 路径和数据结构不变。

- [ ] 写请求测试：signal 透传，AbortError 不当作服务错误；写页面可控异步测试：主分析不等慢 portfolio；未打开对比不请求；A/B 请求逆序返回仍只显示当前范围；失败重试不混日期。
- [ ] 运行新增测试确认失败；实现 analysis 先显示、趋势独立加载、可比订单按需查询。
- [ ] 统一 loading/error 与范围绑定；旧曲线隐藏或清楚标记原日期，不混配新数据。切换/销毁取消旧请求，并继续保留 seq 校验。
- [ ] 监测保留搜索防抖，取消旧 fetch；说明取消客户端不等于停止服务端计算，依赖任务 3 的后端合并避免浪费。
- [ ] 执行定向测试并实际浏览器检查：连续点击下一天、切换订单、切换基线、进出明细、筛选/刷新、错误重试，截图保存到 Git 忽略输出目录。
- [ ] 提交 `perf: load order analysis sections on demand`。

## 任务 6：整体回归、性能验收与交付

文件：更新 `docs/handoff/07_多订单性能优化交接.md` 的实施状态，新增 `docs/handoff/08_性能优化实施与验收结果.md`。不要覆盖本文原始基线数字。

- [ ] 执行 `npm run build`、`npx --yes --package=node@20 node --test`；所有已有和新增测试通过。
- [ ] 用项目 `.venv/Scripts/python.exe contracts/validate_examples.py` 验证契约；没有依赖时明确补齐环境再验证，不能跳过后写“全部通过”。
- [ ] 执行中底完整案例验收：

```powershell
node scripts/verify-local-case.mjs --cost '../资料/09_A011标准导入与完整案例/A011_标准成本导入案例_v0.2.xlsx' --daily '../资料/09_A011标准导入与完整案例/A011_每日生产材料费用案例_v0.2.xlsx' --expected '../资料/09_A011标准导入与完整案例/A011_逐日核算验收结果_v0.2.json'
```

- [ ] 同环境执行任务 1 基准，按交接文档记录 p50/p95/max 和大小/计算次数；16/50/100 笔、16/30/90 天及 100 次重复刷新；性能目标未达时报告实际结果和剩余原因。
- [ ] 重启当前工作目录所属服务，确认运行新 bundle。旧视图、旧证据、正式 B API 与导入/监测/分析/明细页面均核验，备份摘要和恢复步骤可用。
- [ ] 交付代码清单、性能报告、迁移数量核对、已知限制和截图；提交 `docs: record performance migration and acceptance`。检查 Git 工作区，确保无本地订单、历史或备份入库。

实施按任务 1→2→3→4→5→6 顺序进行。本轮不执行，不自动创建其他任务或分派人员。
