# 技术方案

## 配置存储
开关为非密信息，但与公众号配置同生命周期。在 `wechat-settings.ts` 中以独立明文文件 `MEDIA_ROOT/.private/wechat-options.json`（原子写入，0600）保存 `{ autoDraft: boolean }`，与加密凭证文件解耦：凭证不可读时开关仍可读写，切换开关无需 AppSecret。缺文件默认 `autoDraft=false`。
- `WechatSettingsInfo` 增加 `autoDraft: boolean`（shared/contracts.ts）。
- 新增管理员接口 `PUT /channels/wechat/options`（`requireAdminSession`，`Cache-Control: no-store`，zod 校验 `{ autoDraft: boolean }`，记录审计 `wechat.options.update`）；`GET /channels/wechat/settings` 返回中带出 `autoDraft`。不修改现有 settings PUT 的契约。

## 草稿提交复用
从 `routes/channels.ts` 抽出 `services/wechat-draft.ts`：
- `checkDraftPreconditions(article)`：封面存在且素材有效、`getCapabilities().draft` 为真，返回 `{ ok } | { ok:false, code, reason }`。
- `submitDraftOperation(article, actor)`：createOperation → 审计 → `void processChannelOperation(...)`，返回 operation。
手动路由改为调用这两个函数，对外行为与错误码（COVER_REQUIRED / MEDIA_ASSET_UNAVAILABLE / CHANNEL_CAPABILITY_UNAVAILABLE）保持不变。

## 自动触发
`services/wechat-draft.ts` 提供 `maybeAutoDraft(article, created, actor)`：
- 开关关闭 → `{ status: "disabled" }`；`created=false` → `{ status: "not_new" }`；前置不满足 → `{ status: "skipped", code, reason }` 并审计 `wechat.draft.auto_skipped`；否则 `{ status: "submitted", operationId }`，审计 actorType `system`、action `wechat.draft.auto`。
- 自身任何异常都捕获并转为 `{ status: "skipped", code: "AUTO_DRAFT_ERROR", reason }`，不影响入库响应。
- 在 `uploadArticle` 末尾和候选池采纳路由中调用，响应 data 增加 `autoDraft` 字段。

## 前端
`ChannelSettingsPage.tsx` 增加独立 Switch（不放进凭证表单，切换即调用 options 接口，失败回滚并提示）；未配置凭证时可切换但提示“需配置凭证才会生效”。文章列表/候选池无需改动（状态由既有轮询/刷新体现）。

## 兼容与风险
默认关闭，不改变现有行为。自动任务与手动任务共享 pending 幂等约束，手动点击不会重复建任务。不涉及数据库结构变更。

## 追加：内容池手动上传
- `src/client/lib/api/candidates.ts`：accept 返回类型补 `autoDraft?: AutoDraftResult`。
- 新增 `src/client/features/candidates/useCandidateDraft.ts`：封装“采纳(按需) → 取得 operationId（沿用 autoDraft 或调用 articleApi.createDraft）→ 串行轮询 articleApi.getOperation”，请求身份（run id + candidateId）隔离过期响应，卸载时清理定时器；最多 60 次、间隔 1.5s，与 useArticles 一致。错误信息直接使用接口返回 message。
- `CandidatePoolPage.tsx` / `CandidatePreview.tsx`：增加按钮与 loading 状态，完成后 load() 刷新；预览弹窗通过 props 接收 onUploadDraft 与 uploadingId。
- 服务端无需改动；如发现采纳路由在 autoDraft 关闭时缺少字段导致前端判断困难，仅允许在 routes/candidates.ts 内补齐响应字段。
- 测试：为 useCandidateDraft 的纯逻辑（决策：沿用 autoDraft / 调用 createDraft / 已采纳直接提交）抽出可测试函数并补单元测试；不引入新测试依赖。
