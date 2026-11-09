# 渠道操作韧性修复实施结果

## 计划与完成事项
1. 已读取 AGENTS.md、完整 PRD、后端规范、指定代码与测试，核对已有改动。
2. 已修复 updateStatus：status = $2，归档判断 CASE WHEN $3，参数 [id, status, status === "archived"]；归档写 now()，其他状态置 NULL。
3. 已将 sync_failed、操作 failed、失败审计三步独立 try/catch，某步失败不阻断后续步骤。错误日志使用固定文案及任务定位字段，不记录凭证、token、异常对象或原始响应。
4. 已兜底恢复查询失败；保留并发恢复并等待各任务安全收口，单个任务失败不影响其他任务。
5. 已覆盖归档/五种非归档 SQL 参数、草稿完成时 updateStatus 抛错、全部回写失败、日志脱敏、查询失败与多任务隔离。
6. 已执行四项检查及定向测试，完成边界复核。未添加全局 unhandledRejection 处理。

## 修改文件清单
- src/server/db/repository.ts：PostgreSQL updateStatus SQL、布尔参数及中文注释。
- src/server/services/channel-operations.ts：独立回写兜底、结构化日志、恢复入口兜底。
- tests/repository.test.ts：mock pg Pool，断言 SQL 与参数；保留内存测试。
- tests/channel-operations.test.ts：服务失败路径与恢复任务隔离测试。
- .trellis/tasks/11-09-channel-operation-resilience/implement.md：本实施记录。

## SQL 逐项排查
已检查 repository.ts 内全部 PostgreSQL 查询：除 updateStatus 外，无同一参数多处不同类型使用问题。
- 构造器 SELECT 1：无参数。
- createOrGet：INSERT 每参数单次使用，JSON 显式 ::jsonb；冲突后 SELECT source/external_id 独立参数。
- list：status 独立；搜索参数复用于 title/digest ILIKE，均为文本匹配上下文；count 与列表复用筛选值，LIMIT/OFFSET 独立参数。
- get：id 单次使用。
- updateMedia：各参数单次使用，images 显式 ::jsonb。
- updateStatus：唯一发现的冲突，已拆分状态赋值参数与布尔归档判断参数。
- createOperation：INSERT 参数各用一次；冲突后 SELECT article_id/action 独立，pending 为字面量。
- getOperation：id 单次使用。
- getLatestFailedOperation：article_id 单次使用，failed 为字面量。
- listPendingOperations：无参数。
- completeOperation：id/status/external_id/error_message 独立，各用一次。
- setOperationExternalId：id/external_id 独立，各用一次。
- recordAudit：七个字段独立绑定，各用一次。
- confirmPublish：id/publish_id/published_at 独立，各用一次。
- listAiArticles：搜索参数仅复用于两个 ILIKE；source/from/to 独立；游标时间/id 独立；LIMIT 独立，无跨类型复用。
- getAiArticle：id 单次使用。
- listDedupCandidates：无参数。
- listPlanArticles：strategy_id/series_id/LIMIT 独立，各用一次。

## 检查结果原文（尾部）

### npm run typecheck（退出码 0）

~~~text

> content-hub@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit

~~~

### 定向测试（退出码 0）

~~~text

 RUN  v4.1.12 /Users/wanghao/Documents/mywork/code/content-hub


 Test Files  2 passed (2)
      Tests  15 passed (15)
   Start at  15:15:57
   Duration  189ms (transform 78ms, setup 0ms, import 183ms, tests 14ms, environment 0ms)

~~~

### npm test（退出码 1）

~~~text
 ❯ node:net:2206:7
 ❯ processTicksAndRejections node:internal/process/task_queues:90:21

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'EPERM', errno: -1, syscall: 'listen', address: '127.0.0.1' }
This error originated in "tests/app.test.ts" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
The latest test that might've caused the error is "每日候选池支持提交、推荐和接受候选文章". It might mean one of the following:
- The error was thrown, while Vitest was running this test.
- If the error occurred after the test had been completed, this was the last documented test before it was thrown.
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯


 Test Files  3 failed | 11 passed (14)
      Tests  9 failed | 76 passed (85)
     Errors  8 errors
   Start at  15:15:31
   Duration  30.51s (transform 655ms, setup 0ms, import 2.34s, tests 40.82s, environment 1ms)

~~~

### npm run build（退出码 0）

~~~text

> content-hub@0.1.0 build
> tsc -p tsconfig.json && vite build

vite v8.2.4 building client environment for production...
transforming...
✓ 3309 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.40 kB │ gzip:   0.28 kB
dist/assets/index-B5BXDqMa.css      2.98 kB │ gzip:   1.13 kB
dist/assets/index-DnyOrOEZ.js   1,271.71 kB │ gzip: 400.50 kB

✓ built in 318ms
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
~~~

### git diff --check（退出码 0）
无输出。

## 未完成项与风险
- 全量测试：3 个文件失败、9 项失败、76 项通过、8 个 unhandled errors。失败位于 app/media/wechat-settings-http HTTP 测试；沙箱拒绝监听 127.0.0.1（listen EPERM），app/media 的 8 项因此等待监听超时。未跳过、删除或弱化测试。验收方需在允许本地监听的环境重跑 npm test。
- 真实 PostgreSQL PREPARE 类型推断验证按 PRD 由验收方执行；本次未连接真实数据库。Mock 只验证 SQL 与参数，不能替代数据库解析。
- 数据库持续不可用时，失败状态与审计可能无法持久化；函数仍 resolve，日志保留任务定位信息。未调整重试策略。
- 构建通过，bundle 大于 500 kB 警告保留，未做范围外拆包。
- 强化草稿成功后状态更新失败场景后再次运行定向测试，15 项全部通过；全量测试与构建对应同一生产代码。

## 与需求的偏离及原因
- 实现范围无偏离；无需修改 index.ts，未改数据库结构、规范、其他未提交文件，未安装依赖、部署、请求真实公众号或执行 Git 写操作。
- 验收检查未全部通过：npm test 受到沙箱 listen EPERM 限制，保留原始失败结果。
- resumePendingOperations 保留并发，但返回时机从仅启动任务改为等待全部完成，使入口具有明确完成边界；index.ts 仍 void 调用，不阻塞服务监听。


## 追加批次实施结果

### 计划与完成事项
1. 按追加需求第 7–9 条在服务内部增加 describeError，仅提取可序列化标量字段；记录错误 name/code/message，SQLSTATE 风格错误额外记录 detail/table/column。微信数字错误码沿用 WechatApiError.code。
2. message/detail 先对 access_token、secret、appsecret 参数值做大小写不敏感脱敏，再截断到 300 字符；使用字段白名单，不输出 stack、请求体和原始响应对象。
3. 业务失败、三步回写失败分别附带各自 error；恢复查询失败也附 error。保留任务定位字段，不改变 API 响应和 channel_operations.error_message 写入表达式。
4. 补充数据库业务与各回写不同错误码、detail 脱敏、大小写参数脱敏、300 字符截断、微信错误码、禁止 stack/请求响应对象、原始持久化消息不变的回归断言。定向 7 项全部通过。
5. 完成四项指定检查及范围复核；未回退既有改动，未执行 Git 写操作、安装依赖、连接真实数据库、请求真实公众号或部署。

### 本批次修改文件清单
- src/server/services/channel-operations.ts：安全错误描述和失败日志改造，关键流程中文注释。
- src/server/channels/wechat.ts：仅给 WechatApiError 增加 export，供测试构造真实错误类。
- tests/channel-operations.test.ts：更新原有日志断言，新增追加需求测试。
- .trellis/tasks/11-09-channel-operation-resilience/implement.md：追加本批次结果，保留前批次记录。

### 检查结果原文（尾部）

#### npm run typecheck（退出码 0）

~~~text

> content-hub@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit

~~~

#### npx vitest run tests/channel-operations.test.ts（退出码 0）

~~~text

 RUN  v4.1.12 /Users/wanghao/Documents/mywork/code/content-hub


 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  15:20:45
   Duration  205ms (transform 47ms, setup 0ms, import 140ms, tests 6ms, environment 0ms)

~~~

#### npm test（退出码 1）

~~~text

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'EPERM', errno: -1, syscall: 'listen', address: '127.0.0.1' }
This error originated in "tests/app.test.ts" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
The latest test that might've caused the error is "AI 规划写入使用独立 Token，并按 Idempotency-Key 幂等创建". It might mean one of the following:
- The error was thrown, while Vitest was running this test.
- If the error occurred after the test had been completed, this was the last documented test before it was thrown.

⎯⎯⎯⎯⎯ Uncaught Exception ⎯⎯⎯⎯⎯
Error: listen EPERM: operation not permitted 127.0.0.1
 ❯ Server.setupListenHandle [as _listen2] node:net:1918:21
 ❯ listenInCluster node:net:1997:12
 ❯ node:net:2206:7
 ❯ processTicksAndRejections node:internal/process/task_queues:90:21

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'EPERM', errno: -1, syscall: 'listen', address: '127.0.0.1' }
This error originated in "tests/app.test.ts" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
The latest test that might've caused the error is "每日候选池支持提交、推荐和接受候选文章". It might mean one of the following:
- The error was thrown, while Vitest was running this test.
- If the error occurred after the test had been completed, this was the last documented test before it was thrown.
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯


 Test Files  3 failed | 11 passed (14)
      Tests  9 failed | 79 passed (88)
     Errors  8 errors
   Start at  15:20:52
   Duration  30.57s (transform 803ms, setup 0ms, import 2.45s, tests 40.84s, environment 1ms)

~~~

#### npm run build（退出码 0）

~~~text

> content-hub@0.1.0 build
> tsc -p tsconfig.json && vite build

vite v8.2.4 building client environment for production...
transforming...
✓ 3309 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.40 kB │ gzip:   0.28 kB
dist/assets/index-B5BXDqMa.css      2.98 kB │ gzip:   1.13 kB
dist/assets/index-DnyOrOEZ.js   1,271.71 kB │ gzip: 400.50 kB

✓ built in 329ms
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
~~~

#### git diff --check（退出码 0）

~~~text
（无输出）
~~~

### 未完成项与风险
- 全量测试未通过：3 个文件失败、9 项失败、79 项通过、8 个 unhandled errors。失败位于 app/media/wechat-settings-http HTTP 用例；堆栈为 Server.setupListenHandle → listenInCluster，沙箱 listen EPERM 拒绝 127.0.0.1 监听，另 8 项等待监听超时。未跳过、删除或弱化测试；验收方需在允许本地监听的环境重跑 npm test。
- build 成功但仍提示 bundle 大于 500 kB，未做范围外拆包。
- error_message 按要求仍存储原始业务错误消息；本批次脱敏仅应用于日志，不改变已有存储契约。

### 偏离及原因
- 实现范围及行为无偏离；四项检查均已执行，但全量测试因沙箱监听限制未通过。
- Rex 会话重命名尝试被沙箱拒绝（operation not permitted），未绕过权限；不影响本次代码与测试结果。
