# 理论毛利对照与预警实施计划

> **For agentic workers:** Use superpowers:executing-plans for integration and independently delegated theory/frontend modules. Steps use checkbox syntax for tracking.

**Goal:** 为现有本机网站加入可导入/填写的理论毛利基线、实际对照、可修改暂定阈值和可追溯预警。

**Architecture:** 理论输入与对照计算分开；服务模块独立存储理论版本、规则版本、对照记录和预警事件，复用快照校验及回收站锁。前端新增对照页和概览摘要，历史回看只读。

**Tech Stack:** Python标准库、Decimal、openpyxl、原生HTML/CSS/JS，不增加产品运行依赖。

**Spec:** ../../theory-actual-comparison-design.md，用户2026-10-14已授权开始实现。

## Global Constraints

- 复用现有工作树（已经是linked worktree），保留已有未提交修改、outputs和企业数据。
- 毛利提醒下降≥3个百分点，严重≥5个百分点；不良率提醒≥3%，严重≥5%；质量最小观察量暂定100，可修改。
- 暂定阈值明确标记；利润缺失/不可比、零产量、小样本不标正常。实际侧试算和模拟标签保留。
- 不修改严格/源表利润计算，不把利润答案反算为成本，不自行补零。
- 不自动推送、提交所有文件、发布或运行训练；测试用隔离快照。

## Review Focus

1. 同款SRC身份：新快照不能仅靠款号自动沿用范围确认，需明确绑定；模拟与真实基线不可串用。
2. 毛利范围与税口径：无基线/未确认、数量单位不匹配、过程预算不同范围时无法比较。
3. 阈值边界：Decimal精确比较，红色优先；历史规则与基线修订不可覆盖旧记录。
4. 历史/回收站：GET不产生记录，已删订单不能继续读写对照；恢复保留既有资料。
5. 导入安全：10MB/50MB限制、公式拒绝、百分数格式正确、不一致目标不静默覆盖。

## 文件与接口

- theory.py：normalize_baseline(payload)、preview_theory(bytes)、theory_template()。
- comparison.py：evaluate(snapshot,order_id,baseline,rules,scope_confirmed=False)，返回指标及可比性。
- comparison_store.py：工作空间、基线/规则版本、检测记录/事件、导入自动检查。
- server.py：新增同源API路由；workflows.py：保存快照后自动对照。
- web/comparison.js、comparison.css及现有页面接线：理论输入/Excel预览、阈值、对照、趋势、预警处理。
- reports/snapshots/comparison-data/：本地业务数据，随snapshots备份，Git忽略。

API：GET /api/comparison?snapshot_id=...&order_id=... 返回 {rules,baselines,comparison,records,events,trend}，history回看只读取保存结果。
GET /api/theory/template.xlsx；POST /api/theory/preview {workbook_base64} 返回 {baseline,warnings,source_hash}。
POST /api/theory {snapshot_id,order_id,baseline,scope_confirmed,confirmed:true} 创建新版本并检查；POST /api/theory/bind {snapshot_id,order_id,baseline_id,scope_confirmed,confirmed:true} 绑定并检查。
POST /api/comparison/check {snapshot_id,order_id} 保存一次检测；POST /api/comparison/rules {rules,confirmed:true} 保存新规则版本，返回 {rules}。
POST /api/comparison/event {snapshot_id,order_id,event_id,processing_status,note,confirmed:true} 保存人工处理状态，返回工作空间。

## Task 1 理论输入（独立模块）

- [x] 写测试并观察失败：比例目标、成本独立计算、目标冲突、百分数Excel、公式/超限/缺失校验。
- [x] 实现theory.py，限定公开模板和中英文标准字段；无样例不承诺任意企业表自动识别。
- [x] 运行test_theory.py通过。

## Task 2 对照与存储（主线程）

- [x] 写test_comparison.py，确认临界值、范围保护、零产量、不良>产量、小样本、试算/模拟标记失败。
- [x] 实现evaluate；规则、基线、检测不可变版本和事件生命周期另存，GET只读。
- [x] 写服务/HTTP测试，覆盖自动检查、去重、规则变更历史、SRC/模拟隔离、删除保护、恢复和过期观测。
- [x] 接入HTTP与导入保存流程，运行针对性测试。

## Task 3 网站交互（独立前端）

- [x] 新增理论与实际对照页、同口径确认、成本/比例两种方式、Excel模板及预览。
- [x] 暂定规则编辑、预警卡、成本明细与多点趋势、处理记录；历史禁止编辑/重新检查。
- [x] 经营概览显示当前订单提醒摘要，空白无数据也可访问说明。
- [x] 四旧脚本及新脚本语法检查，隔离浏览器验证核心流程与手机布局。

## Task 4 整合与交付

- [x] 全部Python测试、前端语法、格式、diff检查；独立只读审查并修复发现。
- [x] 更新接口/README/设计实现记录，明确首版支持范围；停止隔离服务。

## 执行决策

用户已明确授权实现，沿用现有工作树和本地未提交代码，不增加重复确认。独立模块按dispatching-parallel-agents技能并行实现；主线程负责接口整合与回归。理论模板限定首版字段，质量观察量100按可配置暂定值实现；单日/连续规则和可靠预计完工利润需要额外数据，首版显示其未启用/依据不足。

最终验证：140项Python测试通过（26.800秒）；五个JS语法检查、Black/Prettier和diff检查通过。独立审查发现并修复旧观测水位、历史事件、事务一致性和比例导入数量/单位保留问题。隔离浏览器核心流程及原有查重/历史/回收站通过；最终核心复验含100件对1000双保护，无页面脚本错误。已核对并重启8765本项目服务，资产/模板可访问且原latest快照哈希不变。未提交、推送或发布下载包。
