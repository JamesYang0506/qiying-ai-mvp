# 企盈智擎 · 订单动态管理

新的订单动态监测应用框架，面向长周期订单的利润变化、多订单监测及AI秘书。主分支已改为本框架，供三位成员分别开发核算、数据管理和AI模块，再整合到同一应用。

当前可运行版本使用24笔合成演示订单；真实企业数据、正式核算后端及AI服务尚未接入。API契约是开发设计，不代表后端接口已经实现。

## 下载共同开发包

- [完整开发包 ZIP](https://github.com/JamesYang0506/qiying-ai-mvp/releases/download/order-monitor-dev-20261017/qiying-order-monitor-dev-20261017.zip)：网站源码、启动文件、三模块设计、OpenAPI契约、联调样例与测试。
- [三模块接口设计包 ZIP](https://github.com/JamesYang0506/qiying-ai-mvp/releases/download/order-monitor-dev-20261017/qiying-module-interface-v1.zip)：便于单独分发和评审的接口设计文档。
- [发布说明与文件校验值](https://github.com/JamesYang0506/qiying-ai-mvp/releases/tag/order-monitor-dev-20261017)。开发包为预发布版本，解压后进入文件夹运行 `npm start`；协作提交代码仍建议使用Git克隆仓库。

## 启动网站

需要 Node.js 20 或以上，无需安装前端依赖。

```powershell
git clone https://github.com/JamesYang0506/qiying-ai-mvp.git
cd qiying-ai-mvp
npm start
```

打开 http://127.0.0.1:8787 。Windows也可双击 `启动网站.cmd`。终端按Ctrl+C停止；如端口占用，可在PowerShell设置 `$env:PORT=8788` 后运行 `npm start`。

## 当前页面

| 页面 | 已有交互 |
| --- | --- |
| 多订单监测 | 客户、状态、风险、关键词及日期筛选，汇总指标、利润曲线、关注订单、排序分页 |
| 单订单分析 | 当日/累计趋势、日期节点、生产快照、成本偏差及明细入口 |
| 订单详细数据 | 日报、费用、来源版本和计算过程 |
| AI秘书入口 | 订单选择、快捷问题、输入与明确的未接入提示 |

演示日期范围为2026-10-01至2026-10-16，时间范围选择只改变曲线显示窗口，累计从订单开工日开始。实际毛利与同期预期按同范围比较；缺失不按0处理；pp表示百分点。

## 三人开发入口

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
tests/                 当前演示业务指标测试
contracts/             三模块OpenAPI与示例校验脚本
examples/              合成请求、响应及Schema映射
docs/modules/          三模块职责、时间版本与联调说明
docs/reference/        公式与已确认毛利规则参考
serve.mjs              本机静态服务
```

## 验证

```powershell
npm test
python -m pip install -r requirements-dev.txt
python contracts/validate_examples.py
```

当前有12项业务指标测试；契约校验覆盖Schema、路径及引用完整性、7份示例、独立金额复算和AI证据关联。仓库CI自动执行以上检查。

## 旧版恢复与资料边界

旧版完整源码保存在Git历史和标签 [`archive/pre-order-monitor-20261017`](https://github.com/JamesYang0506/qiying-ai-mvp/tree/archive/pre-order-monitor-20261017)。需要复用旧计算引擎、Excel适配器或Ollama适配时，从该标签提取相应模块，通过新契约适配后再整合；旧版Python启动及免安装包不适用于当前主分支。

本仓库不提交真实企业工作簿、计算输出、训练材料、模型权重、密钥或本机Sites配置。推送源码不等于部署公共网站。
