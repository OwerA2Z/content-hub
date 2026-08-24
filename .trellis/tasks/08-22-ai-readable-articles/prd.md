# AI 可读文章接口

## Goal

为 AI 和外部内容生成系统提供稳定、安全、只读的已发布文章读取能力，使其可以基于历史文章生成新内容，同时不能修改、归档或发布文章。

## Repository evidence

- 当前已有 `GET /api/v1/articles` 和 `GET /api/v1/articles/:id`，但它们复用后台/API Token 访问边界，没有专门的 AI 只读契约。
- 当前文章使用 `uploaded`、`draft_ready`、`published`、`sync_failed`、`archived` 等本地状态；后续需要补充微信公众号发布状态确认，只有微信确认成功的文章才进入 AI 可读数据集。
- 当前上传正文固定为 HTML，文章包含标题、摘要、作者、来源、图片 URL、外部 ID 和 JSON metadata。

## Product direction

- AI 读取接口与后台管理接口分离，使用独立只读凭证或权限 scope。
- 默认只返回已确认发布的文章，不返回草稿、失败、归档和未发布文章。
- AI 只能读取平台明确暴露的内容字段，不返回 API Token、微信凭证、操作错误、内部审计信息或敏感 metadata。
- 首版支持分页、关键词、时间范围和来源筛选；使用稳定文章 ID 和游标，避免重复读取。
- 首版不在平台内调用具体 AI 模型，也不负责生成文章；只提供可供 AI 消费的数据接口。
- “已发布”以微信公众号接口确认成功为准，本地提交发布任务但尚未确认成功的文章不可被 AI 读取。
- AI 文章详情默认返回去除 HTML 标签后的纯文本；通过 `format=html` 才返回原始 HTML。

## Proposed API

- `GET /api/v1/ai/articles`
  - 服务端强制限制为已确认发布文章。
  - 支持 `q`、`source`、`from`、`to`、`limit`、`cursor`。
  - 返回 `items`、`nextCursor`、`hasMore` 和数据版本信息。
- `GET /api/v1/ai/articles/:id`
  - 只返回符合 AI 读取范围的文章。
  - 默认返回 `contentText`；`format=html` 时返回 `contentHtml`。
- 认证使用独立只读 Token，首版配置单个 `AI_READ_TOKEN`；后续迁移到带 scope 的 API key 表。

## AI article response

允许返回：

- `id`
- `title`
- `digest`
- `contentText`（默认）或 `contentHtml`（`format=html`）
- `contentFormat`
- `author`
- `source`
- `publishedAt`
- `createdAt`
- `coverUrl`（可选）
- 经过白名单过滤的 `metadata`

禁止返回：

- API Token、AppSecret、access token
- 微信草稿 ID、内部错误详情、审计日志
- 未发布正文、归档正文和任意未审核 metadata

## Acceptance Criteria

- [ ] AI Token 可以读取已确认发布文章列表。
- [ ] AI Token 可以读取单篇已确认发布文章。
- [ ] AI Token 无法上传、修改、归档、恢复或发布文章。
- [ ] 草稿、发布失败、归档和未确认发布的文章不会出现在 AI 结果中。
- [ ] 列表支持稳定分页/游标，重复请求不会无边界重复返回数据。
- [ ] 详情默认返回纯文本，`format=html` 时返回原始 HTML。
- [ ] 返回字段经过白名单过滤，不包含敏感凭证和内部操作信息。
- [ ] 认证失败、过期或缺失时返回明确但不泄露资源存在性的错误。
- [ ] API 文档包含请求示例、字段说明、限流和内容使用边界。

## Out of scope

- 平台内置 AI 模型调用、生成、改写和润色。
- 向量数据库、语义检索和 embedding 管理。
- 多租户复杂 scope、OAuth、第三方账号授权。
- 自动判断文章是否适合生成新文章。

## Open Questions
