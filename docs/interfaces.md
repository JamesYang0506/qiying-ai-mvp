# 当前模型接口

## 服务与快照公共工具

`server.py` 负责 HTTP 校验、请求解析与响应；`profit_model.workflows` 提供计算查重保存和导出准备，保持原有 HTTP 返回约定。

`profit_model.snapshots` 提供统一快照读取校验、订单范围裁剪和原子保存。`select_orders` 返回新的结果外壳、快照元数据和表列表，行对象共享且只读；正常历史/导出按范围包含，部分重复按范围排除以保留全局问题。保存流程仍在与回收站共用的锁内完成查重和写入，演示结果不替换当前记录。导出和模型准备同样拒绝路径无效、损坏或不兼容的快照。

## 标准计算

`profit_model.engine.calculate(dataset)` 接收 metadata、orders、materials、labor、costs、pools、bases、coverage 等标准结构，返回 orders、costs、allocations、issues、snapshot，可附带 source_analysis。金额使用Decimal，输出金额字符串；缺失为null，不与零混淆。

字段和模板见 [输入格式](input_format.md)，公式见 [公式说明](formula_v0.2.md)。

## 源表适配

`profit_model.eva_source.read_eva_workbook(content)` 接收工作簿字节，识别原订单用量、补单用量、生产周期、成本计算四张表，生成标准输入和source_analysis。

source_analysis含 metrics、profit_layers、cost_rows、materials、production、remaining_checks、unit_notes、audit、trust_review及来源指纹。试算和严格利润字段分开保存。先由数量与成本独立计算，再对照保存利润。

## HTTP

| 接口                                               | 行为                                                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GET /api/current                                   | 读取本机最新计算快照，无快照时返回空状态                                                                          |
| GET /api/history/trash                             | 列出已移入回收站的订单分析记录                                                                                    |
| POST /api/history/delete                           | 携带 snapshot_id、order_id、confirmed=true，将指定订单的指定分析版本移入回收站                                    |
| POST /api/history/restore                          | 同样携带订单与版本定位，恢复回收站记录；重复操作幂等                                                              |
| GET /api/history                                   | 按订单汇总历史版本摘要，返回 orders 和 skipped_files；跳过损坏或不兼容快照                                        |
| GET /api/history/{snapshot_id}?order_id={order_id} | 只读获取指定版本的单笔订单及其成本、分摊、问题和对应来源；analysis_records 仅包含订单与快照均匹配的已保存模型结果 |
| POST /api/calculate                                | 按标准JSON计算并保存快照                                                                                          |
| POST /api/import-xlsx                              | 仅内部/测试使用：直接导入标准Excel模板、计算及保存快照；用户界面使用自动检查或预览确认流程                        |
| POST /api/auto-import-xlsx                         | 自动检查字段、单位和布局；通过后计算保存，否则返回 needs_review 预览而不写记录                                    |
| POST /api/preview-xlsx                             | 只读读取Excel，返回字段位置、数值、单位及阻塞提示；不写快照                                                       |
| POST /api/import-reviewed-xlsx                     | 校验文件指纹及确认映射后计算；需 confirmed=true                                                                   |
| POST /api/export                                   | 按保存快照和订单范围导出普通结果ZIP（CSV明细、snapshot.json、result.json）；训练集导出已移除                      |
| GET /api/template、/api/template.xlsx              | 下载空白输入模板                                                                                                  |
| GET /api/ai/status                                 | 检查本机Ollama及指定模型状态                                                                                      |
| POST /api/ai/analyze                               | 从订单快照读取事实，调用本地模型并验证结果                                                                        |
| GET /api/theory/template.xlsx                      | 下载理论毛利标准模板                                                                                              |
| POST /api/theory/preview                           | workbook_base64，只读预览，返回baseline、warnings、source_hash                                                    |
| POST /api/theory                                   | snapshot_id、order_id、baseline、scope_confirmed、confirmed=true；保存新理论版本并检测                            |
| POST /api/theory/bind                              | snapshot_id、order_id、baseline_id、scope_confirmed、confirmed=true；绑定已有理论版本并检测                       |
| GET /api/comparison?snapshot_id=...&order_id=...   | 读取rules、baselines、comparison、records、events、trend、handling，不自动产生检测                                |
| POST /api/comparison/check                         | snapshot_id、order_id；显式检测，完全相同基线/范围/规则/实际快照复用已有检测                                      |
| POST /api/comparison/rules                         | rules、confirmed=true；保存全局规则新版本（毛利已确认、质量暂定），不覆盖旧检测                                   |
| POST /api/comparison/event                         | snapshot_id、order_id、event_id、processing_status、note、confirmed=true；保存处理状态及审计                      |

理论与实际记录独立保存，详见 [使用及备份说明](theory-comparison.md)。金额与百分比差异使用Decimal。新规则margin_mode=relative，margin_attention_pct/margin_focus_pct/margin_severe_pct默认10/20/30，相对下降阈值右闭；旧规则缺少margin_mode或为points，继续按margin_warning_pp/margin_danger_pp百分点阈值解释，不改写历史。defect_warning_pct/defect_danger_pct仍为暂定百分数阈值，默认3/5，min_production默认100且为正整数；provisional保留质量规则暂定标记。comparison.metrics.margin新增relative_drop_pct、margin_mode和performance（better/on_plan/below_plan），status新增focus；正常/注意/重点/严重对应normal/warning/focus/danger，better的status仍normal。实际与计划范围不可比或计划毛利率≤0时保持pending。新计算保存后自动检测；SRC新快照需要明确绑定，历史只读页面不执行写接口。正常GET不写检测；中断事务的恢复可能修复未提交的存储。

AI请求与结果说明见 [本地接入](local-qwen-integration.md)。模型输出包含summary、risks、recommendations和unknowns；风险和建议引用有效事实id。分析独立保存，reviewed=false，不改写计算结果。模型未就绪、失败和结构/引用错误均明确反馈，不以模拟结论替代。

服务仅绑定本机地址并限制同源操作。Excel 文件上限为10MB，前端和解析器均执行此限制；普通请求体上限为10MB。`/api/preview-xlsx`、`/api/import-reviewed-xlsx`、`/api/auto-import-xlsx`、`/api/theory/preview` 的JSON请求体上限为15MB，专门容纳base64约三分之一的体积增长及封装字段，不代表允许15MB的Excel文件。用户界面优先自动导入，遇到字段或单位不确定时进入预览确认。本地模型一次只处理一个生成请求。前端显示精度不改变底层计算及导出精度。

回收站按订单和快照隔离，标记位于 reports/snapshots/history-trash；不改写计算快照或删除原始文件。正常历史、当前分析、导出及模型准备均排除已删除订单；恢复后原结果及对应已保存模型建议可重新读取。最新快照的全部订单均删除时，当前分析为空；不会自动将更早版本当作当前分析。

所有计算/导入保存接口均进行逐单查重；全部重复返回 status=duplicate 及 matches，不写快照；部分重复在 snapshot.duplicates_skipped 中列出，只保存新增或变更订单。详见 [导入查重](import-duplicates.md)。

理论baseline新增method=quote：quantity、unit_price、material_pct、production_management_pct、production_loss_pct、defect_loss_pct、energy_pct、preparation_labor_per_pair、press_labor_per_pair、company_management_pct、administration_pct。比例按0～100百分数输入，人工空白拒绝保存、0允许。生成生产成本分类及计划毛利，单列operating_expense、operating_profit，保留原输入。公司及行政费用不混入生产毛利，不反推实际费用。tax_basis=ignored为本次不计税；本轮quote不含物流预算。网站理论模板不含公式；线下公式核价输出表不能直接导入。以上仅扩展字段，无新增HTTP接口。
