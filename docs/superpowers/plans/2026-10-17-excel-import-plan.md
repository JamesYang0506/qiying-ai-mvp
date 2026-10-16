# 标准Excel导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 推荐在当前会话由主开发者逐项执行；本计划不自动授权派生子代理。

**Goal:** 在现有网站完成两份标准Excel的预览、版本保存、逐日利润计算和来源展示，并维持Windows双击启动。

**Architecture:** Node本地服务拥有解析、精确核算和文件存储；前端通过独立数据适配器展示已导入工作区，旧演示保持独立。原始输入按不可变版本保存，日期和资料完整性决定每次可见结果。库依赖打包到运行产物，使发布包无需npm安装也能启动。

**Tech Stack:** Node.js >=20、ES modules、node:test；fflate 0.8.3（ZIP流式解压）、fast-xml-parser 5.11.2（保留原始数值文本的XML解析）、decimal.js 10.6.0（ROUND_HALF_UP）、busboy 1.6.0（multipart）；esbuild 0.28.2为开发构建依赖。版本来自2026-10-17 npm registry只读核验，安装前再次检查兼容性及锁定依赖审计。

**Spec:** [已批准设计](../specs/2026-10-17-excel-import-design.md)

## Global Constraints

- 成本文件采用A-ORDER-0.2，只有成本计算、订单信息、原订单用量、补单用量四张工作表。
- 每日文件采用AB-TIME-0.2，含每日生产、每日材料、每日费用，记录当日增量。
- 仅绑定127.0.0.1，不改变为局域网服务。
- 每文件上限10MiB，整个请求25MiB；每工作簿最多100000输入行；ZIP解压总量最多100MiB。
- 内存预览10分钟过期；存储位于Git忽略的data/imports目录；并发解析数为1。
- 成本/重量以十进制字符串传输，重量/单价6位，金额ROUND_HALF_UP至分后累计。
- 原始企业文件及完整本地案例不提交Git；CI使用独立合成数据。
- 每阶段先看到测试失败，再完成实现，验证后提交Git。仓库发布、打包结果和业务数据分别处理。

## Review Focus

1. Excel保存后将编号或精确数值转换为科学计数法：读取数值原文，编号按约束检查，不丢前导零（Task 1）。
2. 原始输入出现公式而缓存看似有效：拒绝该输入，不误用缓存；允许输出区公式（Task 1）。
3. 发生日期正确但可见时间在之后：历史视图必须显示缺项，未来实际不泄漏（Task 2）。
4. 同时重复确认或中断写入：一个有效版本、无半份数据、重启可恢复（Task 3）。
5. 干净中文空格目录没有node_modules：双击仍能启动、上传和计算；端口占用有原有回退行为（Task 5）。

## 文件与接口约定

- `server/import/xlsx.mjs`：`readXlsx(buffer, {limits}) -> WorkbookModel`，返回工作表单元格映射、命名表、1904标记和原始摘要。Cell为`{value:string|null,kind:'number'|'text'|'boolean'|'date'|'formula',ref:string}`，formula另保留缓存但禁止作为原始输入。
- `server/import/normalize.mjs`：`normalizePair(costWorkbook,dailyWorkbook) -> {dataset,issues,summary}`，不负责网络或持久化。issue为`{severity:'error'|'missing'|'warning',code,fileRole,sheet,cell,field,recordId,message}`。
- `server/model.mjs`：约定Dataset序列化形状：`{schemaVersion,order,baseline,revision,production,materials,expenses,supplements,sourceFiles}`；公共订单字段`id,lineId,quantity,price,weight,start,end,timezone,isDemo`；基线`id,params,recipe,sizePlan`；修订`id`。来源统一`{fileRole,sheet,cell,recordId,fileHash}`。
- `server/profit/evaluate.mjs`：`evaluate(dataset,{asOf,baselineMode='ideal'}) -> Analysis`，结果包含`daily,cumulative,theoreticalTotal,bridge,quality,evidence`；利润字段为十进制字符串或null。
- `server/profit/trend.mjs`：`trend(dataset,{start,end,baselineMode}) -> TrendPoint[]`，每个点复用evaluate，日期输出yyyy-mm-dd。
- `server/storage/store.mjs`：`createStore(directory) -> {listOrders,listRevisions,get,commit}`，所有方法async；`commit(dataset)->{orderId,revisionId,reused}`。
- `server/http/app.mjs`：`createApp({root,dataDir,clock}) -> http.Server`，由serve.mjs调用listen；静态目录和API同源，clock可注入用于过期测试。
- `dist/import-api.js`：`previewFiles(costFile,dailyFile),commitPreview(id,allowIncomplete),getImportedOrders(),getRevisions(orderId),getAnalysis(orderId,query),getTrend(orderId,query)`；统一检查HTTP错误。
- `dist/import-page.js`、`dist/imported-workspace.js`：独立页面渲染及事件处理，通过挂载函数返回清理句柄；不参与服务端金额计算。

### Task 1: 可独立验证的Excel识别和规范化

**Files:** 创建server/model.mjs、server/import/{xlsx,normalize,validation}.mjs、tests/import/{fixture,xlsx,normalize}.test.mjs；修改package.json，创建package-lock.json及THIRD_PARTY_NOTICES.md。

**Interfaces:** 产生WorkbookModel、Dataset、issues和summary，供Task 2与3消费。

- [ ] 写失败测试：合成成本4表＋每日3表可识别；缺补单表返回`SHEET_REQUIRED`；原始单价公式返回`INPUT_FORMULA`，公式成本输出不影响解析；科学计数值保留十进制语义；文本编号`0012`保持不变。
- [ ] 增加失败测试：1900/1904日期相同业务日；重复日码、不良超过加工、未知材料/码号、版本不一致为error；缺日和缺成本为missing；补单已包含不叠加。断言normalize产物不包含上传文件名构造的路径。
- [ ] 运行`node --test tests/import/*.test.mjs`，确认目标测试因模块缺失而失败。
- [ ] 锁定上述依赖；实现受限ZIP流式读取。按实际输出字节累计限制、拒绝重复/越界ZIP条目、DOCTYPE/外部实体及宏/加密类型；仅解析支持的OOXML部件、sharedStrings、inlineStr、数字、公式、worksheet关系及tables，不实现通用公式引擎。
- [ ] 实现字段名与命名Table映射：订单元数据来自字段名，成本参数来自param ID，实际材料/费用只读原始输入。统一模拟SOP和校准价由基线输入生成，忽略〔核对〕列；保存来源单元格。
- [ ] 验证损坏ZIP、解压超限、100000行限制和不支持版本返回结构化错误；运行本阶段测试及`npm audit --omit=dev`，调查相关风险后再锁定可交付版本。
- [ ] 提交：`feat: parse and validate standardized order workbooks`。

### Task 2: 精确日期核算与偏差桥

**Files:** 创建server/profit/{decimal,baseline,evaluate,trend}.mjs、tests/profit/{evaluate,trend}.test.mjs；创建scripts/verify-local-case.mjs。

**Interfaces:** 消费Task 1 Dataset，产生Analysis、TrendPoint及质量/来源结构。不依赖HTTP、浏览器或存储。

- [ ] 写失败测试：一条合格量100双、净价17.2，收入`1720.00`；实际材料60kg×20元=`1200.00`；生产费用200元，实际毛利`320.00`。明确费用类别为0的完整样本可计算，缺一类则受影响利润null。
- [ ] 增加失败测试：日期晚于asOf或availableAt在次日的实际记录不参与计算；停产0可有20元制造费并产生`-20.00`日毛利，毛利率null；缺经营费用不抹去毛利；早于开工无风险评级。
- [ ] 运行`node --test tests/profit/*.test.mjs`，确认失败。
- [ ] 实现Decimal precision 40、ROUND_HALF_UP；校准价与重量6位、逐日逐材料/费用到分。同进度理论按已完成合格产量及基线计算，费用预算模式独立，整单理论目标不读取实际未来量。
- [ ] 实现价格/用量/人工/能源及额外费用变化桥；income或生产管理发生变化时不得丢失差额；舍入残差独立。返回完整性分层、缺项列表和来源，不使用总和0代替覆盖检查。
- [ ] 用本地两份A011工作簿和验收JSON运行`node scripts/verify-local-case.mjs --cost <成本路径> --daily <每日路径> --expected <验收JSON路径>`；断言四个关键日期到分一致，全周期理论`313218.18`、实际`176146.26`、差距`137071.92`，补单计入次数为0次额外追加。该脚本不复制原始文件进仓库。
- [ ] 运行本阶段测试及18项原有测试，提交：`feat: calculate daily profit and reconcile variance sources`。

### Task 3: 原子保存、预览确认和本地API

**Files:** 创建server/storage/store.mjs、server/http/{app,routes,uploads,previews,errors}.mjs、tests/http/{imports,security}.test.mjs、tests/storage.test.mjs；修改serve.mjs。

**Interfaces:** 消费normalizePair/evaluate/trend；提供设计中的/api/import-v1端点。

- [ ] 写失败测试：preview只读不保存；commit后重建store仍可读取；同版本相同内容返回reused=true，不同内容409；两个并发相同确认只产生一个有效版本；新修订不增加旧数量；模拟写失败不发布版本。
- [ ] 增加失败测试：10分钟预览过期；选文件后摘要不匹配拒绝；写接口Origin错误/令牌缺失403；请求25MiB与单文件10MiB超限413；静态路径不能逃出dist，不能读data/imports。
- [ ] 运行`node --test tests/storage.test.mjs tests/http/*.test.mjs`，确认失败。
- [ ] 实现busboy限额上传，字段只允许costFile/dailyFile；解析并发1，忙碌返回429；preview内存TTL，响应摘要/问题，不持久化原Excel。缺项版本仅在commit显式allowIncomplete=true时保存。
- [ ] 实现内容摘要规范化排序、单进程提交队列、临时文件与原子rename；不单独维护易损坏的索引，列表从有效不可变版本恢复；路径使用服务端ID，用户文件名只作展示。
- [ ] 实现所有查询端点及错误响应；令牌从本站bootstrap读取，写操作检查本次运行令牌及同源Origin；禁止对外CORS。createApp可注入临时dataDir和clock，供测试隔离。
- [ ] 运行集成测试，验证启动服务仍只监听127.0.0.1；提交：`feat: preview and persist local import revisions`。

### Task 4: 网站导入和已导入工作区

**Files:** 创建dist/{import-api,import-page,imported-workspace}.js及tests/import-api.test.mjs；修改dist/app.js、dist/styles.css、dist/charts.js、dist/ui.js。保持旧dist/metrics.js只用于演示。

**Interfaces:** 消费Task 3 API，前端只展示Analysis和TrendPoint。

- [ ] 写失败测试：客户端HTTP失败不返回假成功，缺项提交必须带allowIncomplete，查询传递revision/asOf/baselineMode；需要切换文件时旧previewId失效，重复点击确认不会发出并行提交。
- [ ] 运行`node --test tests/import-api.test.mjs`，确认失败。
- [ ] 新增`#import`路由、两文件选择、摘要预览、可定位问题表、确认导入及失败重试。模拟与缺项提示使用业务语言，所有输入文本转义。
- [ ] 新增内置演示/已导入工作区选择；数据源改变时清理演示日期和订单筛选。导入成功选择该订单，日期来自覆盖区间，提供上一天/下一天及基线模式选择。
- [ ] 展示理论整单目标、累计实际、同进度理论、利润差距；经营利润独立，缺项显示待补齐；渲染截至当天曲线和价格/耗用/人工/能源/舍入明细，点击可见来源。不套用原演示风险阈值。
- [ ] 支持已导入订单列表、修订选择以及按各自期间计算的组合可比汇总，标明被排除数量；未知或未开工不强行评级。保留演示四页面原交互。
- [ ] 浏览器实际走合成文件选择→预览→确认→重载→切日期→来源；再用本地完整案例核对日期和差额。保存可核对的截图；提交：`feat: show imported orders and daily profit changes`。

### Task 5: 离线运行包、启动回归和交付

**Files:** 创建scripts/build-runtime.mjs、runtime/server.mjs及许可证文件；修改serve.mjs、start-website.mjs、tests/startup.test.mjs、README.md、package.json及.github/workflows/ci.yml；添加tests/package-startup.test.mjs。

**Interfaces:** 开发源码从server加载；serve.mjs作为小入口加载已打包createApp，明确传入项目root避免bundle位置改变静态/数据目录。运行产物不依赖node_modules。

- [ ] 写失败测试：复制serve/start/cmd/dist/runtime到中文空格临时目录，node_modules不存在仍启动HTTP与导入API；关闭并重启后导入版本仍在该副本data目录；指定/占用/回退端口行为与原6项回归一致。
- [ ] 运行`node --test tests/package-startup.test.mjs tests/startup.test.mjs`，确认待实现运行包测试失败。
- [ ] 用esbuild生成Node20 ESM运行bundle，处理busboy的CJS内置模块加载，附带依赖许可证；第三方库不通过CDN加载。打包产物入Git，构建确定性在CI验证；启动器检查运行包缺失时显示可操作提示并保留窗口。
- [ ] 更新CI为npm ci→npm run build→npm test→Python契约验证；在Windows与Linux运行。原契约尚未实现的状态说明保留，为新增本地适配API提供文档。
- [ ] 验证完整本地案例、各项测试、git diff --check及依赖构建产物一致性；README注明首次源码开发需npm ci，运行包仅需Node20，数据本地保存及备份位置。
- [ ] 最后代码审查仅检查本次范围及遗留回归；如执行方式要求独立审查，依该方式调用可用审查工具，不另派未授权子代理。修复后只复跑受影响检查。
- [ ] 提交：`build: preserve one-click startup with bundled import service`。汇报各阶段commit及验证结果；本轮默认只提交本地Git，不自动上传完整业务案例。

## 计划自审

设计1–5对应Task1和3，设计6对应Task2，设计7对应Task3，设计8对应Task4，设计9对应Task1/3/5，设计10逐条分配到测试和完整案例验收，设计11维持排除范围。所有后续调用名与前述接口一致；临时文件、预览和上传限额均有拥有模块和验证。三个已知新依赖风险（XML解析、ZIP膨胀、busboy ESM打包）分别有输入测试与干净运行包验证。

计划已经自审，等待用户评审及执行方式确认。批准后推荐当前会话逐项执行（Native），每阶段通过测试即提交Git。

### 技术参考（仅主项目文档）

- [fflate流式ZIP文档](https://github.com/101arrowz/fflate)
- [fast-xml-parser选项文档](https://github.com/NaturalIntelligence/fast-xml-parser)
- [decimal.js精确小数文档](https://github.com/MikeMcl/decimal.js)
- [busboy上传限制文档](https://github.com/mscdex/busboy)
