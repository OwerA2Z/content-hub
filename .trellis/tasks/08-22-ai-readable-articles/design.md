# 技术设计：AI 可读文章接口

## 1. 边界与数据流

```text
微信公众号发布状态
  → ChannelOperation / Article 发布确认
  → PostgreSQL 已发布索引
  → AI 只读 Token middleware
  → 白名单 DTO + HTML 转纯文本
  → AI 读取接口
```

AI 接口不复用后台 session，也不接受管理 API Token；只接受服务端配置的 `AI_READ_TOKEN`。

## 2. 数据模型调整

Article 增加：

- `publishedAt`: 微信确认发布成功的时间，可为空。
- `wechatPublishId`: 微信发布任务/文章 ID，可选，仅服务端内部使用。
- `publishConfirmed`: boolean，只有微信状态查询确认成功才为 `true`。

首版 AI 数据集条件固定为：

```sql
status = 'published'
AND publish_confirmed = true
AND published_at IS NOT NULL
AND archived_at IS NULL
```

增加 `(published_at DESC, id DESC)` 索引，支持稳定游标分页。

## 3. 微信发布确认

- `WechatProvider` 增加 `getPublishStatus(publishId)`。
- 提交发布后文章进入 `publish_pending`，保存微信发布 ID。
- 后台通过任务查询或恢复任务调用状态查询；只有微信返回成功才更新 `publish_confirmed=true`、`status=published`、`published_at`。
- 发布失败进入 `sync_failed`，不进入 AI 数据集。

## 4. AI API

- `GET /api/v1/ai/articles`
- `GET /api/v1/ai/articles/:id`

认证 middleware：

- 读取 `Authorization: Bearer <AI_READ_TOKEN>`。
- 使用常量时间比较；缺失、错误或生产环境未配置时拒绝访问。
- 不允许通过后台 session 或普通 `API_TOKEN` 访问 AI 路由。

列表参数：

- `q`: 标题/摘要关键词
- `source`: 来源
- `from`, `to`: ISO 时间范围，作用于 `publishedAt`
- `limit`: 1–50，默认 20
- `cursor`: `(publishedAt,id)` 的 base64url 编码

游标条件：按 `publishedAt DESC, id DESC`，下一页使用严格小于上一页末项的组合条件，避免重复和漏项。

## 5. 内容转换与 DTO

- 默认字段为 `contentText`：将 HTML 转为纯文本，保留段落换行，图片转为 `[图片]` 占位符，去除脚本、样式和隐藏内容。
- `format=html` 时返回 `contentHtml`，仍需经过安全 sanitizer，不返回未处理脚本。
- DTO 只允许标题、摘要、正文、作者、来源、发布时间、创建时间、封面 URL 和明确白名单 metadata。
- 不返回微信 ID、操作记录、错误信息、凭证、完整内部 metadata。

## 6. 兼容与安全

- 保留现有后台文章查询接口，不改变上传方契约。
- `AI_READ_TOKEN` 只存在服务端环境变量和请求头，不写入响应、日志或前端 bundle。
- AI 接口增加独立限流和最大响应大小；默认不允许批量超过 50 篇。
- 文章是否“已发布”由微信确认状态决定，不以本地提交发布请求代替。
