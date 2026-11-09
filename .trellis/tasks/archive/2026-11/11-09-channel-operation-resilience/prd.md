# 修复文章状态更新 SQL 与渠道任务异常兜底

## 问题
1. `src/server/db/repository.ts:225` `updateStatus`：`$2` 同时用于 `status = $2`（varchar 列）与 `CASE WHEN $2 = 'archived'`（与 text 字面量比较），Postgres 推断出不一致的参数类型（inconsistent types deduced for parameter $2），Postgres 环境下所有文章状态更新失败：草稿/发布完成回写、文章归档/恢复（`routes/articles.ts:40`）。测试使用内存仓库，未覆盖该 SQL。
2. `src/server/services/channel-operations.ts`：`processChannelOperation` 的 catch 内首句 `updateStatus(...sync_failed)` 同样会抛错，异常逃出函数；所有调用方均为 `void processChannelOperation(...)`（channels.ts:63/86、wechat-draft.ts:26、resumePendingOperations），形成未处理 Promise 拒绝，Node 24 默认终止进程。`resumePendingOperations` 的 `listPendingOperations` 失败同样未兜底（index.ts:18 `void` 调用）。

## 需求
1. 修复 `updateStatus` SQL：不得让同一参数推断出不同类型。推荐改为 `status = $2`，归档判断改为独立布尔参数 `$3`（JS 侧计算 `status === "archived"`）；保持 archived_at 现有语义（归档写 now()，其他状态置 NULL）。检查 repository.ts 内其他 SQL 是否存在同类“同一参数多处不同类型使用”的问题，一并修复并列出。
2. `processChannelOperation` 永不 reject：业务失败时尽力回写（文章 sync_failed、操作 failed、审计），每一步回写独立 try/catch，某步失败不阻断后续步骤；最终仍失败时按项目约定输出结构化错误日志 `console.error(JSON.stringify({ level: "error", message, operationId, articleId, action }))`，不得输出凭证、access_token 或完整 HTTP 响应。
3. `resumePendingOperations` 永不 reject：查询失败记录错误日志后返回；单个任务失败不影响其他任务恢复。
4. 不新增全局 `unhandledRejection` 吞错处理（避免掩盖其他缺陷）。
5. 关键逻辑中文注释。

## 验收
- 新增测试：mock pg pool，断言 updateStatus 的 SQL 与参数（$2 状态、$3 布尔），归档/非归档两种情况。
- 新增测试：仓库 updateStatus 抛错时，processChannelOperation resolve 不抛出，completeOperation/recordAudit 仍被尝试调用；回写全部失败时也 resolve 并记录错误日志。
- 新增测试：listPendingOperations 抛错时 resumePendingOperations resolve；多个待恢复任务中一个失败不影响其他任务被处理。
- typecheck、test、build、git diff --check 通过。
- 验收方另在真实 Postgres 上用 PREPARE（不执行）验证新 SQL 的类型推断。

## 不包含
数据库结构变更、全局异常处理器、重试策略调整。

## 追加需求（2026-11-09）：失败日志补充错误原因
### 问题
当前失败日志只有固定文案，数据库错误（如 `inconsistent types deduced for parameter $2`）与业务失败原因都不可见，无法定位。
### 需求
7. 在 channel-operations.ts 内新增安全的错误描述函数（如 `describeError(error)`），返回可序列化字段：
   - `name`（错误类名）；
   - `code`：Postgres 错误取 SQLSTATE（5 位 `code`），WechatApiError 取微信错误码，其他有 `code` 字段的取其值；
   - `message`：脱敏后截断至 300 字符。脱敏规则：移除 URL 查询参数中 `access_token`、`secret`、`appsecret`（大小写不敏感）的值，替换为 `***`；不输出 stack、原始 HTTP 响应体、请求体。
   - Postgres 错误额外带 `detail`（同样脱敏截断）与 `table`/`column`（若有）。
8. 失败日志改为：业务失败一条（`message: "渠道操作失败"`，附 `error: describeError(业务异常)`），每个回写步骤失败各一条（附该步骤的 `error: describeError(回写异常)`）；`resumePendingOperations` 查询失败日志附 `error`。保留 operationId、articleId、action 定位字段。
9. 不改变对外 API 响应、不改变写入 channel_operations.error_message 的内容。
### 验收
- 测试：pg 风格错误（含 code `42P08`、detail）被记录 code/message/detail；含 `access_token=xxx&secret=yyy` 的消息被脱敏；超长消息被截断；WechatApiError 记录微信错误码；日志不含 stack。
- 回写失败日志能看到对应数据库错误码与信息。
- typecheck、test、build、git diff --check 通过。
