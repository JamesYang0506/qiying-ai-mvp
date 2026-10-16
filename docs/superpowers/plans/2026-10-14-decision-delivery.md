# 决策演示与报告 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement and review the tasks.

**Goal:** 缩短演示路径，收紧非核心入口，让单订单结论可以打印带走。

**Architecture:** 沿用原生网页和Python本机服务，保留计算/快照/历史语义；报告只读取保存结果，不依赖模型生成，不写业务数据。

**Tech Stack:** Python unittest、原生 JavaScript/CSS、浏览器打印、Playwright。

**Spec:** 用户已确认上一轮十项分析；保留普通数据导出，移除训练导出，内部Excel接口留档，有可用概览默认首页，否则详细数据，无订单大厅；AI未配置说明卡且可回看旧建议；理论对照固定入口及明确导入按钮；回收站保持已有下拉；状态语义分开；CSS只安全合并重复；增加favicon。

## Global Constraints

- 保留既有 tests/browser-history-records.js 改动、web/comparison.js 格式改动和 outputs/；不提交真实企业数据。
- 上传上限统一为解析器已有10MB（保留请求封装的15MB运输余量用于base64），避免将运输余量误当Excel文件上限。
- 本轮验证后及时本地Git提交，不推送。
- 显式hash尊重用户导航；历史/模拟/试算、税口径与范围未知不能隐去。

## Tasks

- [x] Backend: 删除训练导出接口/模块/专用测试及workflows开关；内部导入接口和上限文档说明；普通导出不变，针对移除接口和保留导出回归。
- [x] Report: 新增独立report.js/css，单订单选择、金额/毛利对照/主要风险/待补/行动/版本；打印不展示操作，溢出可续页，不截断证据；模板转义；无数据禁用，历史使用保存检测。
- [x] Frontend: 默认落点、AI状态说明及历史访问、理论一级入口/导入按钮、训练按钮清除、状态标签、favicon、统一10MB文件上限。
- [x] CSS: 仅邻近且层叠等价的同断点合并，不强行统一断点。
- [x] Verification: 全量Python、JS语法/Prettier、隔离浏览器覆盖默认路由/显式链接/AI降级/历史/理论导入/报告打印/手机；独立审查后本地提交。

## Decisions

- 先采用打印报告避免新增PDF运行依赖；正常数据一页，长内容允许续页避免损失依据。
- 不迁移当前worktree，保持用户当前项目及既有未提交文件；工作范围按文件隔离。

## Validation

- 最终140项Python回归通过；7个前端脚本语法、前端Prettier、git diff --check通过。
- browser-decision-flow覆盖无数据/源表/标准订单落点、显式链接、异步导航、AI离线及历史回看、理论导入、10MB保护和390px布局；pageErrors为空。
- browser-decision-report覆盖标准与源表、历史规则/事件隔离、未恢复事件、缺失/转义、多订单、摘要计数、键盘焦点、独立打印及网站样式隔离；历史列表回归通过。
- 合成源订单实际打印PDF为1页A4，桌面/手机截图及PDF渲染检查通过；长内容允许续页。
- 独立审查发现的导航恢复与报告漏未恢复事件问题已修复，复查无阻断。
- 本机8765已重启，静态脚本/报告/图标/模型状态读取正常；重启前后保存数据哈希一致。
- CSS仅清除训练导出死样式、合并一处同断点规则；保留原有设备适配，不进行高风险断点重写。
