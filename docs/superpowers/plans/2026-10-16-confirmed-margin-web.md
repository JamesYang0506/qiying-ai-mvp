# 已确认毛利标准网站升级

**Goal:** 将用户2026-10-16确认的相对毛利下降标准和报价比例核价接入原网站。

**Spec:** docs/business-rules/2026-10-16-plan-margin-confirmed.md。用户已明确授权继续优化网站。

**Architecture:** Decimal后端核价与判断，快照/基线/规则/事件保留版本。新记录相对下降分四级，旧记录保留百分点两级语义。生产毛利不含公司经管费用；人工未知不按零。

## Contract

- 新规则 margin_mode=relative，margin_attention_pct=10、margin_focus_pct=20、margin_severe_pct=30；右闭边界。status 为normal/warning/focus/danger，优于计划status=normal且performance=better。
- 旧规则缺少margin_mode或mode=points，继续使用margin_warning_pp/margin_danger_pp；历史只读不迁移。质量沿用原有暂定规则，不把不良品成本1.8%当不良数量率。
- 新理论method=quote：quantity/unit_price、material_pct、production_management_pct、production_loss_pct、defect_loss_pct、energy_pct、preparation_labor_per_pair、press_labor_per_pair、company_management_pct、administration_pct。比例按0到100百分数输入。人工空值拒绝保存，0允许。
- quote产出完整成本四大类及目标毛利，另保存经营费用及经营利润。tax_basis=ignored表示本次不计税、不作税额调整，比较仍须范围确认。物流不纳入本轮quote生产/经营预算，明确说明。
- 不预填或自动绑定A-011到真实订单；样例比例按钮只填比例，业务号/数量/报价/人工需核对。
- 当前保存规则若为旧口径，服务更新后显式保存一次新毛利标准，保留当前质量阈值。历史检测、原始实际数据不改写。

## Tasks

- [x] 比较后端：双口径规则、精确边界、0/负计划待补、优于计划、focus事件及历史兼容测试。
- [x] 理论后端：quote计算、成本分类、费用单列、模板字段/预览、缺失/零及ignored税口径测试。
- [x] 前端：规则说明/编辑、相对下降指标、quote输入/实时独立预览/人工缺失提示、导入兼容、报告四级与原始版本。
- [x] 验证：Python全量、语法/格式、隔离浏览器新旧规则及quote/报告/历史/手机、独立审查。
- [x] 本机重启并启用已确认标准、检查实际快照不变、只提交本轮源码文档，不纳入已有browser-history-records与outputs。

## Execution

保留当前工作树与既有未提交修改，按文件责任隔离；仅本地Git保存，不推送。

## 验证与集成结果

- 最终全量153项Python测试通过；比较36项及服务端11项独立验证通过。曾出现一次既有HTTPError读取错误体时文件关闭，服务端子集与完整153项复跑均通过，未修改该测试的断言。
- 生产Python文件Black检查、前端Prettier、JS语法、git diff --check通过。
- browser-confirmed-margin验证quote、人工缺失/0、预览无写入、样例不覆盖税口径、重点/优于计划、规则失败草稿、新旧标准及历史不可变、只读及390px布局，pageErrors为空。
- 报告旧场景与relative focus/better、快速关闭重开、独立打印通过；旧演示动线回归显式使用points规则通过。
- 页面/手机及实际PDF渲染检查通过，合成订单报告为1页A4。
- 精确相对下降额外以relative_drop_exact保存，在依据中展示，用于核对略超边界但格式化后看似等于边界的情况。
- 独立复查无剩余阻断。本机8765已启动并加载新代码，当前使用relative 10/20/30；未发现旧保存配置，无需覆写配置，质量设置与实际/历史文件校验值均保持不变。
- 尚未提供人工单价、过程预警频率和正式实际样表，网站不自动绑定虚拟订单或将不完整计划当正式基线。
