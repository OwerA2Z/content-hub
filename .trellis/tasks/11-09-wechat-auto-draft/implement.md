# 实施计划

- [x] 读取 AGENTS.md、.trellis/spec/backend 与 frontend 规范、本任务 prd/design。
- [x] shared/contracts.ts：WechatSettingsInfo 增加 autoDraft；新增 AutoDraftResult 类型。
- [x] wechat-settings.ts：options 文件读写（原子写、默认 false），info() 带出 autoDraft（unreadable 时也返回）。
- [x] services/wechat-draft.ts：checkDraftPreconditions / submitDraftOperation / maybeAutoDraft。
- [x] routes/channels.ts：手动 draft 改用公共函数；新增 PUT /channels/wechat/options。
- [x] services/article-upload.ts 与 routes/candidates.ts 接入 maybeAutoDraft，响应增加 autoDraft；routes/articles.ts、routes/ai.ts 透出。
- [x] 前端 ChannelSettingsPage + api 封装。
- [x] 测试：开关读写权限与持久化、unreadable 下读取；关闭不建任务；开启+条件满足建任务；缺封面/未配置跳过且入库成功；幂等重复不重复建任务；候选池采纳同样触发；手动路由错误码不变。
- [x] docs/api.md、docs/user-guide.md。
- [ ] npm run typecheck、npm test、npm run build、git diff --check。

## 验收（Claude）
范围核对、独立运行检查命令、审查公共草稿函数抽取后手动链路行为不变。

## 实施结果

### 完成事项（对应计划）
- 已完成规范阅读、共享契约、独立开关文件、公共草稿服务、管理员 options 接口、两个入库入口接入、API/AI 响应透出、前端即时保存与失败回滚、测试和文档。
- 默认关闭；开启仅对 created=true 提交 draft。跳过不影响入库，响应说明原因并尝试审计；重复 externalId 不重复建任务。手动草稿校验顺序、状态码和错误码保持不变。
- 测试已补齐开关权限、持久化、unreadable、无需 Secret、关闭无操作、提交及 operationId、draft_ready、缺封面/未配置跳过审计、重复幂等、候选采纳、手动错误码，以及自动路径异常与审计失败隔离。

### 修改文件清单
- `src/shared/contracts.ts`
- `src/server/wechat-settings.ts`
- `src/server/services/wechat-draft.ts`（新增）
- `src/server/routes/channels.ts`
- `src/server/services/article-upload.ts`
- `src/server/routes/candidates.ts`
- `src/server/routes/articles.ts`
- `src/server/routes/ai.ts`
- `src/client/features/channels/ChannelSettingsPage.tsx`
- `src/client/lib/api/articles.ts`
- `tests/wechat-auto-draft.test.ts`（新增）
- `tests/wechat-settings.test.ts`
- `tests/wechat-settings-http.test.ts`
- `docs/api.md`
- `docs/user-guide.md`
- `.trellis/tasks/11-09-wechat-auto-draft/implement.md`

### 检查结果原文（尾部）
`npm run typecheck`：退出码 0。
```text
> content-hub@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
```

`npm test`：退出码 1。
```text
 Test Files  3 failed | 9 passed (12)
      Tests  9 failed | 48 passed (57)
     Errors  8 errors
   Start at  14:40:00
   Duration  30.49s (transform 658ms, setup 0ms, import 2.17s, tests 40.67s, environment 1ms)
```

HTTP 失败根因原文：
```text
Error: listen EPERM: operation not permitted 127.0.0.1
Serialized Error: { code: 'EPERM', errno: -1, syscall: 'listen', address: '127.0.0.1' }
```
其余 8 个 HTTP 用例在监听失败后超时，未跳过或删除测试。具体受影响用例：
- `tests/app.test.ts`：Token 支持全部权限，且仅撤销后可删除；健康检查公开，上传接口需要 Bearer Token；上传 API 具备幂等返回；上传关联 brief 时自动补齐战略和系列；AI 规划写入使用独立 Token，并按 Idempotency-Key 幂等创建；每日候选池支持提交、推荐和接受候选文章。
- `tests/media.test.ts`：支持上传、读取、编辑和归档图片素材，并按 scope 控制操作；没有素材读取权限时拒绝访问。
- `tests/wechat-settings-http.test.ts`：拒绝未登录和普通 Token；保存不回显密钥，连接成功与失败均返回明确结果。此用例包含新增 options 鉴权、unreadable 读写、候选采纳和手动错误码断言，受监听限制未执行到。

`npm run build`：退出码 0。
```text
rendering chunks...
computing gzip size...
dist/index.html                     0.40 kB │ gzip:   0.28 kB
dist/assets/index-B5BXDqMa.css      2.98 kB │ gzip:   1.13 kB
dist/assets/index-Dfvyhg_D.js   1,268.72 kB │ gzip: 399.63 kB

✓ built in 334ms
[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

`git diff --check`：退出码 0，无输出。

### 未完成项与风险
- 四项命令均已执行，但全量测试尚未通过；验收方需在允许监听端口的沙箱外重跑 `npm test`。非 HTTP 的 48 项测试通过，包括新增自动草稿服务和开关存储测试。
- 前端已通过类型检查和构建，尚未完成浏览器实屏与交互验收。
- 未请求真实公众号；真实草稿结果仍以现有异步操作状态为准。构建有大于 500 kB 的 bundle 提示。
- 审计存储自身不可用时，自动路径仍返回 skipped，不保证该次审计落库。

### 与设计的偏离及原因
- 既有审计表没有原因/详情字段，且禁止改表和修改 repository，因此 `wechat.draft.auto_skipped` 将错误码与原因存入系统 `actorId`（最多 120 字符）；接口仍返回完整原因。这是存储适配，需验收方关注该字段用途。
- 保留原上传入口的素材字段校验：直接上传引用不存在/已归档素材仍返回原有 400；入库后自动校验发现素材失效则跳过草稿。未扩大为更改文章上传契约。

## 验收（Claude，2026-11-09）

### 检查结果（沙箱外重跑）
- `npm run typecheck`：通过。
- `npm test`：12 个文件、57 个用例全部通过；Codex 沙箱内的 9 个失败均为 `listen EPERM`，非代码问题。
- `npm run build`：通过（仅既有大 chunk 提示）。
- `git diff --check`：通过。

### 审查结论
- 改动文件均在授权范围内，未触碰既有未提交的 Trellis 升级文件。
- 手动草稿路由抽取为 `checkDraftPreconditions` / `submitDraftOperation` 后，校验顺序、状态码与错误码不变；发布分支只检查 publish 能力。
- 自动触发仅 `created=true`，两个入口一致；异常与审计失败均不影响入库响应。

### 遗留与建议
- 跳过原因写入审计 `actor_id` 字段（审计表无详情列，Codex 为免改库所做的取舍），会占用操作者字段、丢失原操作者信息。后续如需审计详情，建议另加详情列（需用户执行 SQL）。
- `wechat-options.json` 若被手工改坏，`GET /channels/wechat/settings` 会报错；重新保存开关即可恢复，文件仅由服务原子写入，风险低。
- 配置页开关的实际页面效果尚未在浏览器验收。


## 验收补缺批次

### 完成事项（对应计划）
1. 已只读核对 `migrations/0001_init.sql:43-54` 和 `src/server/db/schema.ts:80-92`：audit_logs.action 为 varchar(60)，没有限制 action 枚举的约束。四个现有跳过码组成的 action 长度分别为 40、49、56、42 字符，完整格式可容纳，无需短格式或改库。
2. maybeAutoDraft 跳过审计改为 action=`wechat.draft.auto_skipped:<CODE>`、actorType=system、actorId=传入的 actor.actorId（可为空）；完整原因仅在 autoDraft.reason 返回。前置失败与 AUTO_DRAFT_ERROR 均新增真实操作者保留断言，原空操作者断言同步更新。
3. options() 分离文件读取与 JSON 解析：缺文件、JSON 解析失败、autoDraft 非布尔均关闭；非 ENOENT 的读取错误仍抛出。新增五种损坏内容的 options()/info() 关闭及 saveOptions 覆盖恢复测试，并以 EISDIR 验证读取错误不被吞掉。
4. 已同步 API 文档、完成静态审查和四项检查；本批次新增的 8 项测试全部通过。未修改数据库、请求真实公众号、安装依赖或执行 Git 写操作。

### 修改文件清单
- `src/server/services/wechat-draft.ts`
- `src/server/wechat-settings.ts`
- `tests/wechat-auto-draft.test.ts`
- `tests/wechat-settings.test.ts`
- `docs/api.md`
- `.trellis/tasks/11-09-wechat-auto-draft/implement.md`

### 检查结果原文（尾部）

`npm run typecheck`：退出码 0。

```text

> content-hub@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit

```

`npm test`：退出码 1。

```text

 Test Files  3 failed | 9 passed (12)
      Tests  9 failed | 56 passed (65)
     Errors  8 errors
   Start at  14:46:16
   Duration  30.48s (transform 580ms, setup 0ms, import 2.16s, tests 40.76s, environment 1ms)

```

`npm run build`：退出码 0。

```text
✓ 3307 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.40 kB │ gzip:   0.28 kB
dist/assets/index-B5BXDqMa.css      2.98 kB │ gzip:   1.13 kB
dist/assets/index-Dfvyhg_D.js   1,268.72 kB │ gzip: 399.63 kB

✓ built in 296ms
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

`git diff --check`：退出码 0。
无输出。

HTTP 失败根因原文：
```text
Error: listen EPERM: operation not permitted 127.0.0.1
Serialized Error: { code: 'EPERM', errno: -1, syscall: 'listen', address: '127.0.0.1' }
```

### 未完成项与风险
- 全量测试受沙箱监听限制未通过：tests/app.test.ts 的 6 项、tests/media.test.ts 的 2 项在 listen EPERM 后超时；tests/wechat-settings-http.test.ts 的 1 项直接报 listen EPERM。未跳过、删除或修改 HTTP 测试。验收方需在允许监听端口的环境重跑 npm test；本批次 56 项通过，新增回归测试包含在其中。
- build 通过，仍有既有大于 500 kB 的 chunk 提示。
- 本批次不涉及页面修改；此前浏览器实屏验收仍未补做。未请求真实公众号，真实外部链路不在本批次验证范围。
- 审计存储不可用时仍按既有逻辑隔离错误，不保证审计落库。
- Rex 会话重命名被沙箱拒绝（operation not permitted），未绕过权限；不影响修复和仓库检查。

### 与设计的偏离及原因
- 按本次授权修订原设计中的固定跳过 action：增加 :<CODE> 后缀以承载错误码，保留操作者字段，撤销上一批次将原因写入 actorId 的适配方式。完整原因仅在响应返回。
- 原设计只规定缺文件关闭；本批次扩展为内容损坏也关闭，避免设置 GET 因损坏内容报错并确保失败即关闭。文件系统读取错误仍抛出。
- 无其他设计偏离，未使用短格式，未改数据库结构；未触碰范围外的既有未提交修改。

## 追加批次：内容池手动上传
- [x] candidates api 类型补 autoDraft。
- [x] useCandidateDraft（含可测试的决策函数）及单元测试。
- [x] CandidatePoolPage / CandidatePreview 按钮、状态、刷新。
- [x] docs/user-guide.md 补内容池上传说明。
- [x] npm run typecheck、npm test、npm run build、git diff --check。


## 追加批次实施结果

### 完成事项（对应追加批次计划）
1. candidates.accept 返回类型增加可选 autoDraft，复用共享 AutoDraftResult；服务端已返回所需字段，无需修改。
2. 新增 useCandidateDraft 和可测试的决策函数：未采纳先采纳；submitted 沿用 operationId，disabled/skipped/not_new/缺省结果调用现有 createDraft；已采纳直接使用 acceptedArticleId；stale/rejected 拒绝上传。
3. 列表与预览增加“上传草稿箱”，处理中禁用重复操作并显示 loading。串行轮询最多 60 次、间隔 1.5 秒；成功显示草稿 ID，失败展示实际接口原因，超时提醒后台可能仍在处理。预览内同步显示结果，页面提示带候选标题。
4. run + candidateId 隔离提交和轮询的过期响应；切换/关闭预览即时作废流程，卸载清理定时器。已提交后台任务不撤销。采纳成功立即按候选 ID 更新状态并刷新，完成、失败或超时再次刷新；列表刷新只接受最后一次请求，避免旧列表覆盖新状态。
5. 新增 10 项决策测试，覆盖授权要求四类分支，以及 not_new/缺省字段、采纳后流程失效、草稿失败仍保留采纳结果。更新使用手册。

### 修改文件清单
- `src/client/lib/api/candidates.ts`
- `src/client/features/candidates/useCandidateDraft.ts`
- `src/client/features/candidates/candidateDraftDecision.ts`
- `src/client/features/candidates/CandidatePoolPage.tsx`
- `src/client/features/candidates/CandidatePreview.tsx`
- `tests/candidate-draft.test.ts`
- `docs/user-guide.md`
- `.trellis/tasks/11-09-wechat-auto-draft/implement.md`

### 检查结果原文（尾部）

`npm run typecheck`：退出码 0。
```text
> content-hub@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
```

`npm test`：退出码 1。
```text

 Test Files  3 failed | 10 passed (13)
      Tests  9 failed | 66 passed (75)
     Errors  8 errors
   Start at  14:51:45
   Duration  30.55s (transform 719ms, setup 0ms, import 2.48s, tests 40.88s, environment 1ms)
```

HTTP 失败根因原文：
```text
Error: listen EPERM: operation not permitted 127.0.0.1
Serialized Error: { code: 'EPERM', errno: -1, syscall: 'listen', address: '127.0.0.1' }
```
单独运行 `npm test -- tests/candidate-draft.test.ts`：退出码 0。
```text
 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  14:53:07
   Duration  104ms (transform 16ms, setup 0ms, import 21ms, tests 4ms, environment 0ms)
```

本批次 tests/candidate-draft.test.ts 的 10 项测试全部通过。失败为 tests/app.test.ts 的 6 项、tests/media.test.ts 的 2 项（监听失败后超时）、tests/wechat-settings-http.test.ts 的 1 项；未跳过或删除测试。

`npm run build`：退出码 0。
```text
vite v8.2.4 building client environment for production...
transforming...
✓ 3309 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.40 kB │ gzip:   0.28 kB
dist/assets/index-B5BXDqMa.css      2.98 kB │ gzip:   1.13 kB
dist/assets/index-BIz2zoTy.js   1,271.85 kB │ gzip: 400.52 kB

✓ built in 380ms
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

`git diff --check`：退出码 0，无输出。

### 未完成项与风险
- 全量测试尚未通过：验收方需在允许监听端口的环境重跑 npm test，确认上述 9 项 HTTP 用例。
- 尚未完成浏览器实屏与实际交互验收；类型检查、构建和决策测试不替代该验收。未请求真实公众号，真实草稿状态以现有异步操作结果为准。
- 切换/关闭预览只停止当前页面流程，不撤销后台任务；查询结束或超时后请刷新确认再重试，避免重复上传。
- 构建保留既有大于 500 kB 的 chunk 警告。
- Rex 会话重命名被沙箱拒绝（operation not permitted），未绕过权限。

### 与设计的偏离及原因
- 无接口或流程设计偏离，未修改服务端、数据库或授权范围外文件。
- 在设计的完成后刷新之外，增加采纳成功即时同步与刷新：确保缺封面/未配置等手动上传失败时仍显示已采纳，且关闭预览后可看到真实采纳状态。
- 决策函数独立为 candidateDraftDecision.ts，便于不引入测试依赖直接验证分支；符合设计允许的可测试函数拆分。

## 内容池验收修复

### 完成事项（对应本次计划）
1. 已核对追加需求第 9 条和追加批次实施结果：不串写其他候选不等于中止上传。移除 select() 对 cancel() 的调用，打开、切换、关闭预览仅更新 selected，上传锁、轮询及最终反馈继续保留。
2. 已删除 hook 中无其他调用者的 cancel 实现与返回 API；保留 run + candidateId 过期响应隔离、按 candidateId 过滤预览 draftNotice，以及 useEffect 卸载时作废流程和清理定时器。关键边界已补中文注释。
3. 本小节修正此前“切换/关闭预览即时作废流程”的实施说明及对应风险：现在只有页面卸载会终止页面轮询，预览变化不会；后台任务仍不撤销。
4. 不引入测试依赖、不涉及 DOM；现有决策测试无法直接覆盖 React 预览与 hook 生命周期的联动，采用下述手动验收步骤，不添加仅验证源码字符串的替代测试。

### 修改文件清单
- `src/client/features/candidates/CandidatePoolPage.tsx`
- `src/client/features/candidates/useCandidateDraft.ts`
- `.trellis/tasks/11-09-wechat-auto-draft/implement.md`

### 手动验证步骤（待验收方执行）
使用本地模拟接口/网络拦截返回，不请求真实公众号；准备候选 A、B，使 A 的草稿操作先返回 pending，稍后返回终态。
1. 从列表发起 A 上传，打开 A 预览、关闭、打开 B 预览，再回到 A。全过程 A 保持处理中，上传按钮保持禁用，getOperation 按既有间隔继续串行轮询；B 不出现 A 的 draftNotice，A 显示自己的处理中提示。
2. 在 B 预览打开时令 A 返回 succeeded 和模拟草稿 ID：页面提示包含 A 标题和草稿 ID，B 无 A 提示，按钮解锁并刷新列表；重开 A 可见 A 的结果。
3. 分别模拟 failed（含 errorMessage）及持续 pending 到超时，重复预览开关操作：实际失败原因/后台可能仍在处理提示不丢失，仅在 A 预览显示，结束后刷新列表并解锁。
4. 轮询 pending 时离开内容池页面：等待超过 1.5 秒，不再新增 getOperation 请求；已在途请求返回后不写入页面、不触发后续轮询或完成刷新。重新进入页面没有遗留定时器。

### 检查结果原文（尾部）

`npm run typecheck`：退出码 0。
```text

> content-hub@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit

```

`npm test`：退出码 1。
```text

 Test Files  3 failed | 10 passed (13)
      Tests  9 failed | 66 passed (75)
     Errors  8 errors
   Start at  14:54:50
   Duration  30.49s (transform 677ms, setup 0ms, import 2.23s, tests 40.79s, environment 1ms)

```

`npm run build`：退出码 0。
```text
transforming...
✓ 3309 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.40 kB │ gzip:   0.28 kB
dist/assets/index-B5BXDqMa.css      2.98 kB │ gzip:   1.13 kB
dist/assets/index-DnyOrOEZ.js   1,271.71 kB │ gzip: 400.50 kB

✓ built in 296ms
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

`git diff --check`：退出码 0。
```text
（无输出）
```

HTTP 失败根因原文：
```text
Error: listen EPERM: operation not permitted 127.0.0.1
```

### 未完成项与风险
- 全量测试受沙箱监听限制未通过：3 个 HTTP 测试文件共 9 项失败，66 项通过（含 candidate-draft 的 10 项决策测试）；未跳过或删除测试。验收方需在允许监听端口的环境重跑 `npm test`。
- 上述手动 React 交互与卸载验收尚未执行，需验收方通过本地模拟接口完成；现有纯逻辑测试不能证明预览联动行为。未请求真实公众号。
- 构建通过，保留既有大于 500 kB 的 chunk 警告。
- Rex 会话重命名被沙箱拒绝（operation not permitted），未绕过权限；不影响代码检查。
