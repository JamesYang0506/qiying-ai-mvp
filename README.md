# 企盈智擎：订单利润与可信化分析模型

面向制造企业决策人员的本地订单分析网站。由独立计算引擎计算成本和利润，规则审查数据问题，本地 Qwen 解释订单风险和建议。

当前源码新增大厅与历史记录功能，位于 `feat/profit-model-dashboard` 分支。网站只在本机运行；上传源码不等于发布公共在线网站。

## 页面与功能

| 页面 | 主要内容 |
|---|---|
| 工作大厅 | 网站默认入口，进入订单分析或历史分析记录 |
| 历史分析记录 | 按订单搜索、按数据类型筛选，选择历史版本，回看当时的成本、利润、核验状态及已保存模型建议 |
| 决策首页 | 收入、成本、生产毛利、经营净利试算；万元金额保留两位小数；饼图、可信度提醒及有条件的订单建议 |
| 详细数据 | 精确金额、费用明细、独立计算过程、生产与补单核对、来源与快照、结果导出 |
| 智能订单分析 | 选择订单和问题，通过本机 Ollama 调用 Qwen；展示解释、风险、建议、有效依据引用及待确认项 |

可信化审查按利润异常、数据一致性异常、质量异常、工艺异常分类，差异优先展示，待核验与核对通过分开。来源未核验不表示已有费用未计入；缺少质量阈值或工艺记录时不直接判异常。

## 利润计算口径

- 生产毛利试算：收入减材料及人工、加工等生产成本。
- 经营净利试算：生产毛利再减已列管理、销售等经营费用。
- 源工作簿适配器从配方、分码SOP重量、数量及逐项费率独立推导，不用原表利润或汇总答案作计算输入；计算完成后才读取保存利润作对照。
- 原料理论耗用与实际净耗用分开。未知费用保留为空，不用零替代。
- 已知表内能耗等费用可以用于参考试算；税口径、费用范围及分摊依据未完整核验时保留试算状态。经营净利试算不等于已审计的财务净利润。
- 标准数据引擎仍保留严格完整性及阶段归集规则，源表试算与严格核算字段分开，不通过填零或启用未经确认的规则伪造完整结果。

## 启动网站

Windows 10/11 64位使用者可直接下载 [v0.3.0免安装版](https://github.com/JamesYang0506/qiying-ai-mvp/releases/tag/v0.3.0)，完整解压后双击 `QiYingProfit.exe`。不需要另外安装Python、Node.js或Excel；本地Qwen分析仍需自行安装Ollama和模型。使用说明及数据备份见 [下载版说明](docs/windows-release-guide.txt)。

以下为从源码运行的方式：

需要 Python 3.10+。Excel 导入导出使用 openpyxl：

```powershell
git clone --branch feat/profit-model-dashboard https://github.com/JamesYang0506/qiying-ai-mvp.git
cd qiying-ai-mvp
python -m pip install -r requirements.txt
python server.py --port 8765
```

浏览器打开 http://127.0.0.1:8765。Windows 也可双击 `启动看板.cmd`。端口占用时可更换为 `--port 8766`。

新安装首次保持空白，不自动载入演示数据。导入数据后保存在本机，重新打开恢复最新计算快照。支持标准 Excel/JSON 和四工作表中底成本布局；其他企业原表需增加字段映射。开发用 `data/samples/demo.json` 是明确标记的合成数据，不代表企业经营情况。

Excel默认先自动识别并检查，明确的文件直接计算；有疑问时进入预览，仅优先显示需处理字段。可调整费用坐标及元/双、元/整单单位，修改后重新预览；取消不写历史记录。成功确认后自动记住同结构方案，后续读取新文件的数值。材料配方、SOP及日报仍有支持区域限制，不保证任意布局自动识别，详见 [Excel导入说明](docs/excel-import-review.md)。标准模板允许表头列顺序变化。

网站默认进入大厅。历史记录按订单汇总，可选择分析时间不同的版本；打开后仅展示所选订单，并持续标注历史时间和模拟状态。返回当前分析可恢复此前结果。历史读取不会重新计算、覆盖最新快照或自动调用模型。历史模型页面只回看与订单和版本匹配的已保存建议。

大厅开发前的版本已保存为本地标记 `checkpoint/pre-lobby-20261014`，设计见 [大厅与历史设计](docs/lobby-history-design.md)。现有 v0.3.0 下载包尚不包含本次新增大厅功能。

## 本地 Qwen 分析

先安装并启动 Ollama，确保本机已有模型：

```powershell
ollama pull qwen3.5:4b
ollama list
```

启动网站后进入“智能订单分析”，选择订单并点击“开始本地分析”。网站连接 `127.0.0.1:11434`，默认模型 `qwen3.5:4b`，不调用云端模型。其他已安装本地模型可在启动前设置：

```powershell
$env:QIYING_OLLAMA_MODEL = "your-local-model-name"
python server.py --port 8765
```

模型服务未就绪时，利润计算和数据明细仍可使用。模型输出单独保存并标注待人工复核，不覆盖成本、利润和首页规则建议，不自动用于训练。模型结构及引用通过校验不代表业务结论已验证。

## 目录

```text
web/                         大厅、历史记录、分析页面、图表及交互
profit_model/engine.py        标准数据独立计算引擎
profit_model/eva_source.py    源工作簿独立适配与复算
profit_model/trust.py         四类可信化审查
profit_model/ollama_client.py 本地模型请求、结构化结果及引用校验
profit_model/analysis_gateway.py 订单快照准备和分析记录
profit_model/history.py       历史版本索引、单订单读取及已存建议筛选
profit_model/excel_import.py  标签识别、自动适配、读取预览与字段映射
server.py                    本地HTTP接口
tests/                       计算、导入、审查和接口测试
docs/                        当前公式、使用方式、接口与训练路线
data/samples/                合成开发样例
```

## 文档

- [输入格式](docs/input_format.md)与[当前公式](docs/formula_v0.2.md)
- [独立计算与事后对照](docs/independent-calculation.md)
- [利润分层及可信化](docs/profit-layers-and-trust.md)
- [决策首页与详细数据](docs/executive-and-detail-views.md)
- [实际模块接口](docs/interfaces.md)与[本地Qwen接入](docs/local-qwen-integration.md)
- [订单训练数据与微调建议](docs/qwen-order-training-roadmap.md)
- [训练候选资料导出与专家标注](docs/training-data-export.md)：详细数据页导出当前筛选订单，保留严格核算/参考试算及缺失状态，不自动生成训练答案。

## 验证

```powershell
python -m unittest discover -s tests -v
node --check web/app.js
node --check web/source.js
```

当前82项自动测试通过；另已实测Excel预览与确认、方案复用、大厅、历史版本选择、页面切换、图表、明细跳转、手机布局及本地 Qwen 分析。计算隔离测试覆盖修改/删除源表利润和汇总单元格后结果不变，以及成本输入变更后利润相应改变。

Windows发布包使用独立构建环境：安装 `requirements-build.txt` 后执行 `python scripts/build_windows_release.py`。需要64位Windows及64位Python，且源码已提交、工作区干净。构建只包含程序、网页及合成样例，不包含本机业务数据；输出ZIP及SHA256校验文件在Git忽略的 `dist/` 中。

## 本地数据与配置

企业原表、处理结果、计算快照、模型分析记录、训练资料、模型权重、凭证和截图均不随源码提交。相关目录由 `.gitignore` 排除。仓库只包含程序、文档、测试和合成开发样例。

`.env.example` 仅说明服务端可用变量；应用不会自动读取 `.env`，请在启动环境设置变量。更详细的输入说明见 docs/input_format.md。上传源码不会公开本机已导入订单，其他人需要自行导入获准使用的数据。

Excel 默认自动适配：字段、单位和支持的材料/日报结构明确时直接计算；有疑问时只显示需处理内容。人工确认后的同结构导入方案自动复用，读取依据保留在明细及历史记录中。详见 [Excel 导入说明](docs/excel-import-review.md)。
