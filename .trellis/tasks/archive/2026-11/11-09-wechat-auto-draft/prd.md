# 新文章自动上传微信草稿箱开关

## 目标
管理员可在“微信公众号”配置页开启或关闭“新文章自动上传草稿箱”。开启后，新文章入库即自动提交微信草稿任务；关闭时保持现状（只能手动上传）。不自动发布。

## 已确认事实
- 文章入库有两个入口：`uploadArticle`（src/server/services/article-upload.ts，供后台 `/articles` 与 AI 路由 `routes/ai.ts` 使用）和候选池采纳（`routes/candidates.ts` 直接调用 `repository.createOrGet`）。
- 手动草稿链路：`routes/channels.ts` 校验封面与能力 → `repository.createOperation`（同文章同动作 pending 幂等）→ `processChannelOperation`。
- 公众号配置由 `src/server/wechat-settings.ts` 加密保存在 `MEDIA_ROOT/.private/wechat.json`，页面为 `ChannelSettingsPage.tsx`。

## 需求
1. 配置页新增“新文章自动上传草稿箱”开关，默认关闭；仅管理员会话可读写，保存后即时生效、重启保留；普通 Token 不可读写。
2. 开启时，仅对新创建的文章（`created=true`）触发；幂等重复上传、编辑、恢复归档不触发。两个入口（uploadArticle、候选池采纳）行为一致。
3. 自动提交与手动上传使用同一套前置校验（封面有效、公众号能力可用）和同一操作链路；不新增并行上传机制。
4. 前置条件不满足（未配置凭证/配置不可读/缺封面/封面素材失效）时跳过自动上传：文章正常入库，响应和审计中说明跳过原因；不得让文章上传本身失败或返回 5xx。
5. 上传/采纳接口响应增加自动草稿结果字段（已提交时含 operation id，跳过时含原因，关闭时标明未启用），供 API/AI 调用方轮询；保持现有字段兼容。
6. 关键逻辑中文注释；更新 docs/api.md、docs/user-guide.md。

## 验收标准
- 开关默认关闭，关闭时上传/采纳行为与现状完全一致（无新操作记录）。
- 开启且条件满足：新文章入库后产生 draft 操作，结果字段含 operation id；任务成功后文章状态为 draft_ready。
- 开启但缺封面/未配置：文章入库成功，无操作记录，结果字段说明原因，有审计记录。
- 幂等重复上传同一 externalId 不产生第二个草稿任务。
- 配置读写仅管理员；响应不含 Secret；切换开关不要求重填 AppSecret；配置不可读（unreadable）状态下开关读取不报 5xx。
- typecheck、test、build、git diff --check 通过。

## 不包含
自动发布、按来源/分类区分开关、批量补传历史文章、定时上传、多公众号。

## 追加需求（2026-11-09）：内容池文章手动上传草稿箱
### 需求
7. 内容池（`CandidatePoolPage`，列表项操作与预览弹窗 `CandidatePreview`）增加“上传草稿箱”按钮，状态为 stale/rejected 的候选不显示。
8. 未采纳候选：先调用现有采纳接口生成文章；若采纳响应 `autoDraft.status === "submitted"`，直接沿用其 operationId，不再重复提交；否则对生成的文章调用现有手动草稿接口。已采纳候选：直接对 `acceptedArticleId` 调用手动草稿接口。
9. 提交后按钮处理中并阻止重复点击；轮询操作结果，成功提示草稿 ID，失败显示实际原因（含封面缺失、公众号未配置等现有错误码提示）；超时提示后台可能仍在处理；切换/关闭预览、离开页面不串写其他候选。完成后刷新内容池列表。
10. 后端不新增并行上传接口，复用 `/candidate-pools/daily/candidates/:id/accept` 与 `/articles/:id/wechat/draft`、`/operations/:id`。
### 验收
- 未采纳候选一键完成“采纳 + 提交草稿”，内容池显示已采纳，文章库可见该文章且状态最终为 draft_ready。
- 自动开关开启时，采纳已自动提交的不再产生第二个草稿任务。
- 已采纳候选可重复手动上传（失败后重试）；缺封面/未配置时文章仍已采纳，提示明确原因。
- stale/rejected 候选无按钮；类型检查、测试、构建通过。
