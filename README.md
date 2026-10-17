# 企盈智擎 · 订单动态管理

新的订单动态监测应用框架，面向长周期订单的利润变化、多订单监测及AI秘书。主分支已改为本框架，供三位成员分别开发核算、数据管理和AI模块，再整合到同一应用。

当前版本支持标准Excel导入、按日期核算利润及本地数据版本保存，并保留24笔内置演示订单。AI服务及正式财务核算尚未接入。原三模块API契约仍是设计；已实现的本机导入适配API见下文。

## 下载共同开发包

下列是历史v0.1开发包，不包含当前分支新增的Excel导入功能。当前版本以本地开发分支源码及随附runtime运行包为准。

- [完整开发包 ZIP](https://github.com/JamesYang0506/qiying-ai-mvp/releases/download/order-monitor-dev-20261017.1/qiying-order-monitor-dev-20261017.1.zip)：网站源码、修复后的启动入口、三模块设计、OpenAPI契约、联调样例与测试。
- [三模块接口设计包 ZIP](https://github.com/JamesYang0506/qiying-ai-mvp/releases/download/order-monitor-dev-20261017.1/qiying-module-interface-v1.zip)：便于单独分发和评审的接口设计文档。
- [发布说明与文件校验值](https://github.com/JamesYang0506/qiying-ai-mvp/releases/tag/order-monitor-dev-20261017.1)。开发包为预发布版本，须完整解压后使用；协作提交代码仍建议使用Git克隆仓库。

## 启动网站

运行需要 Node.js 20 或以上。仓库包含已打包的runtime服务，无需安装Excel、Python、数据库或npm依赖即可双击启动。修改服务端源码后需先运行 `npm ci`、`npm run build` 更新运行包。

```powershell
git clone https://github.com/JamesYang0506/qiying-ai-mvp.git
cd qiying-ai-mvp
npm start
```

打开 http://127.0.0.1:8787 。终端按Ctrl+C停止；如端口占用，可在PowerShell设置 `$env:PORT=8788` 后运行 `npm start`。

Windows推荐完整解压后双击 `启动网站.cmd`。启动器会检查文件、等待服务就绪后自动打开默认浏览器；已有本站服务时直接打开它，默认端口被其他程序占用时自动改用附近可用端口。请保留服务窗口，关闭窗口会停止新启动的网站。最终网址以窗口内“网站地址”为准。

也可运行 `启动网站.cmd 8788` 指定端口；明确指定的端口被其他应用占用时会报错而不替换它。`--no-browser` 仅用于自动检查；正常双击无需参数。若提示Node缺失或版本过低，请安装Node.js 20或以上；不要在压缩包预览里直接运行启动文件。

## 增量更新已有本地副本

如果对方已持有上一版整站压缩包，无需重发整站，只需覆盖以下运行文件并保持目录结构：

```text
dist/app.js
dist/charts.js
dist/imported-workspace.js
dist/styles.css
runtime/server.mjs
server/profit/evaluate.mjs   # 仅在会重新运行 npm run build 时需要
```

不要覆盖 `data/`（已导入订单）、`node_modules/`、启动脚本和 `dist/index.html`。覆盖后关闭并重新启动网站，浏览器按 Ctrl+F5 强制刷新；`runtime/server.mjs` 的改动必须重启服务才生效。

## 当前页面

| 页面 | 已有交互 |
| --- | --- |
| 多订单监测 | 客户、状态、风险、关键词及日期筛选，汇总指标、利润曲线、关注订单、排序分页 |
| 单订单分析 | 当日/累计趋势、日期节点、生产快照、成本偏差及明细入口 |
| 订单详细数据 | 日报、费用、来源版本和计算过程 |
| AI秘书入口 | 订单选择、快捷问题、输入与明确的未接入提示 |
| 标准数据导入 | 选择成本和每日Excel、字段校验、来源定位、预览确认、缺项版本保存 |
| 订单分析 | 利润概览、差距归因、明细数据三页；订单/修订/日期/基线切换；图表金额常驻、键盘/触摸提示、利润下钻、材料/人工/价格归因、预算模型参考阈值 |

演示日期范围为2026-10-01至2026-10-16，时间范围选择只改变曲线显示窗口，累计从订单开工日开始。实际毛利与同期预期按同范围比较；缺失不按0处理；pp表示百分点。

已导入工作区日期范围由Excel决定，与内置演示分开。理论整单目标固定，实际利润只计算截至选定日期已可见的生产和成本记录。补单已含于加工量及净耗，不重复归集。真实资料的缺项仍需补齐，模拟案例明确标识。

利润概览展示四张指标卡（理论目标、累计实际、同进度理论、少赚差距）、累计毛利曲线和成本构成；少赚为正时使用红色卡片。折线节点和成本扇区可悬停查看具体金额，点击节点可下钻到当天记录。差距归因页把“增加差距”和“抵消差距”分开列示，事实结论与“建议核查”分开；主因占比以正向增支合计为分母并标注“占增支”。顶部按实际毛利率较同进度理论的相对下降分档：0–10% 绿色可接受、10–30% 黄色需关注、超过 30% 红色大型偏差；资料不足时灰色待核算。预算模型参考阈值单独展示毛利率与不良率，附公式、参数、基线、规则版本和适用条件。

## 导入标准Excel

1. 双击 `启动网站.cmd`，点击侧栏“数据导入”。旧服务若仍占端口，启动器会寻找支持新版API的服务或使用空闲端口，请以CMD最终地址为准。
2. 选择A-ORDER-0.2成本文件：只含成本计算、订单信息、原订单用量、补单用量四张业务表。
3. 选择配套每日文件：每日生产、每日材料、每日费用。订单、子项、基线及修订版本须一致，每日数据为增量。
4. 点击“解析并预览”。格式错误须修正；资料缺失可明确保存为待补齐版本，相关利润保持不可用。
5. 确认后进入“订单分析”，选择日期或点击上一天/下一天查看。选择“理想上界”或“含损耗预算基线”时，曲线和差额采用同一口径。

每份.xlsx最多10MiB，请求25MiB，解压上限100MiB。原始输入公式不会以缓存充当依据；计算区公式只作人工核对。首版只支持报价比例校准BOM、生产等价收入和Asia/Shanghai时区，不能冒充正式财务收入确认。

确认后规范化数据保存在项目内 `data/imports/`，重启后仍保留；备份时复制此目录及对应版本源码。原始Excel不长期保存。相同版本重复导入不叠加，内容变更应使用新修订号；冻结基线变更应使用新基线号。该目录已被Git忽略，业务数据不会随代码提交。

本地API使用 `/api/import-v1`：GET session、orders、portfolio、orders/{id}/revisions、orders/{id}/analysis、orders/{id}/trend；POST previews、previews/{id}/commit。写操作使用本站Origin及会话令牌。预览10分钟有效，重启需重新解析；确认保存为原子整批写入。

## 开发和验证

```powershell
npm ci
npm run build
npm test
python contracts/validate_examples.py
```

运行服务使用随附bundle；修改服务端后重新build，浏览器静态文件直接刷新即可。完整本地案例可通过 `node scripts/verify-local-case.mjs --cost <成本文件> --daily <每日文件> --expected <验收JSON>` 核对，不需将企业资料加入仓库。测试使用独立合成文件，包含上传、版本、精确金额、来源、缺项、日期及中文路径启动。

第三方依赖版本已锁定；许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。仅监听127.0.0.1；首版不是多人共享服务。

## 三人开发入口

CC接手请先阅读[开发交接](docs/handoff/01_CC开发交接.md)和[后续开发大纲](docs/handoff/02_后续开发大纲.md)，其中说明本地新版分支、已实现接口、案例核验及推荐执行顺序。

先共同阅读[团队开发与整合说明](docs/modules/00_团队开发与整合说明.md)和[公共数据约定](docs/modules/01_公共数据与版本约定.md)。

| 模块 | 开发说明 | 责任 |
| --- | --- | --- |
| A 单订单核算 | [A模块设计](docs/modules/02_A单订单利润核算.md) | 资料公式、预期实际、毛利率、经营利润、可比性、证据 |
| B 多订单与时间 | [B模块设计](docs/modules/03_B多订单与时间管理.md) | 每日报多单、修订、历史快照、费用池、汇总和查询 |
| C 本地AI秘书 | [C模块设计](docs/modules/04_C本地AI秘书.md) | 问题理解、模型接入、自然回答、引用核验、人工反馈 |

共同契约：[OpenAPI 3.1](contracts/openapi.json)，23个接口操作；[合成联调示例](examples/README.md)；[整合验收清单](docs/modules/05_联调验收清单.md)。

B整理资料→A核算→B保存不可变快照→网站和C读取。A不操作数据库；C不覆盖利润。正式接入后，前端只展示后端核算结果，`dist/metrics.js`仅用于演示模式。

## 目录

```text
dist/                  可直接运行的前端
  data.js              演示数据适配层，后续替换为统一API
  metrics.js           演示计算纯函数
  app.js               页面、筛选和导航
  charts.js / ui.js     图表与展示工具
tests/                 导入、核算、版本及启动回归测试
contracts/             三模块OpenAPI与示例校验脚本
examples/              合成请求、响应及Schema映射
docs/modules/          三模块职责、时间版本与联调说明
docs/reference/        公式与已确认毛利规则参考
server/                Excel解析、逐日核算及本地API源码
runtime/               无node_modules依赖的服务运行包
serve.mjs              本机服务入口
```

## 验证

```powershell
npm test
python -m pip install -r requirements-dev.txt
python contracts/validate_examples.py
```

当前有85项测试，覆盖Excel导入、缺项与日期可见性、利润归因、视图渲染、版本保存及启动回归（Windows `.cmd` 测试在Windows上运行）；契约校验覆盖Schema、路径及引用完整性、7份示例、独立金额复算和AI证据关联。仓库CI在Windows和Linux上执行检查。

## 旧版恢复与资料边界

旧版完整源码保存在Git历史和标签 [`archive/pre-order-monitor-20261017`](https://github.com/JamesYang0506/qiying-ai-mvp/tree/archive/pre-order-monitor-20261017)。需要复用旧计算引擎、Excel适配器或Ollama适配时，从该标签提取相应模块，通过新契约适配后再整合；旧版Python启动及免安装包不适用于当前主分支。

本仓库不提交真实企业工作簿、计算输出、训练材料、模型权重、密钥或本机Sites配置。推送源码不等于部署公共网站。

### 当前导入边界

成本册必须包含命名Table：CostParameters、OriginalRecipe、OriginalSizePlan、SupplementEvents；每日册包含DailyProductionCase、DailyMaterialCase、DailyExpenseCase，每日生产A4以AB-TIME-0.2开头。缺失Table或版本不符会阻止保存，不猜测输入区域。

首版支持完整周期零期初、生产等价收入、模拟报价不拆税及Asia/Shanghai。是否模拟必须明确填写“是”或“否”。缺失基线、分码量及待补录生产均保留待补齐状态；日期范围延长至最后补录可见日期。整单理论一次计算与逐日累计的舍入差单独说明。
