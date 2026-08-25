# API 使用说明

所有业务接口使用 `/api/v1` 前缀。成功响应统一为 `{ "data": ... }`，失败响应统一为 `{ "error": { "code", "message" } }`。

## 外部上传

```bash
curl -X POST http://localhost:3000/api/v1/articles/upload \
  -H 'Authorization: Bearer <API_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "示例文章",
    "content": "<p>正文</p>",
    "contentFormat": "html",
    "source": "content-pipeline",
    "externalId": "article-001",
    "digest": "文章摘要",
    "summary": "文章核心梗概",
    "outline": ["背景", "核心观点", "案例", "结论"],
    "topics": ["内容运营"],
    "keywords": ["文章管理", "AI"],
    "coverUrl": "https://example.com/cover.jpg"
  }'
```

`source + externalId` 是幂等键，重复提交会返回同一文章 ID。

## 查询

后台登录后可查询；外部系统也可以使用相同 Bearer Token 查询：

```text
GET /api/v1/articles?page=1&pageSize=20&q=关键词&status=uploaded
GET /api/v1/articles/:id
GET /api/v1/operations/:id
```

## AI 只读查询

使用具备 `articles:read` 权限的 Token 后，AI 系统只能读取已由微信公众号确认发布的文章：

```bash
curl 'http://localhost:3000/api/v1/ai/articles?limit=20&source=content-pipeline' \
  -H 'Authorization: Bearer <TOKEN_WITH_articles:read>'
```

详情默认返回纯文本；需要排版时使用 `?format=html`：

```text
GET /api/v1/ai/articles/:id
GET /api/v1/ai/articles/:id?format=html
```

只有具备相应 scope 的 Token 才能上传或修改内容；读取 Token 默认没有写入、归档、恢复或发布权限。只有微信公众号确认发布成功的文章才会出现在结果中。

AI 上传新文章使用独立写入 Token：

```bash
curl -X POST http://localhost:3000/api/v1/ai/articles \
  -H 'Authorization: Bearer <TOKEN_WITH_articles:write>' \
  -H 'Content-Type: application/json' \
  -d '{"title":"AI 新文章","content":"<p>正文</p>","contentFormat":"html"}'
```

## AI 防重复检测

外部 AI 生成新文章前，可以提交文章画像进行重复检测：

```bash
curl -X POST http://localhost:3000/api/v1/ai/articles/check-duplicate \
  -H 'Authorization: Bearer <TOKEN_WITH_dedup:check>' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "候选文章标题",
    "summary": "候选文章梗概",
    "outline": ["背景", "核心观点", "案例", "结论"],
    "topics": ["内容运营"],
    "keywords": ["文章管理", "AI"],
    "content": "<p>候选正文</p>"
  }'
```

接口只返回风险提示，不会阻断生成。高风险结果会给出重合维度、命中关键词、相似文章和调整建议。

后台管理员还可以查看某篇文章的相似文章：

```text
GET /api/v1/articles/:id/similar
```

## 内容规划

管理员可以维护“战略 → 系列 → 文章任务”三级内容规划：

```text
GET  /api/v1/strategies
POST /api/v1/strategies
GET  /api/v1/strategies/:id/series
POST /api/v1/strategies/:id/series
GET  /api/v1/series/:id/briefs
POST /api/v1/series/:id/briefs
PATCH /api/v1/strategies/:id
PATCH /api/v1/series/:id
PATCH /api/v1/briefs/:id
```

AI 使用只读接口获取下一个文章任务：

```text
GET /api/v1/ai/content-plan/next
GET /api/v1/ai/content-plan/briefs/:id
```

AI 使用具备 `planning:write` 权限的 Token 创建或更新内容规划：

```text
POST  /api/v1/ai/content-plan/strategies/:id/series
POST  /api/v1/ai/content-plan/series/:id/briefs
PATCH /api/v1/ai/content-plan/briefs/:id
```

两个 POST 接口必须携带 `Idempotency-Key` 请求头，重复请求会返回同一资源。AI 不能修改战略根节点，也不能删除或发布内容规划。

每日候选池接口：

```text
POST /api/v1/ai/candidate-pools/daily/candidates
POST /api/v1/ai/candidate-pools/daily/recheck
GET  /api/v1/candidate-pools/daily
POST /api/v1/candidate-pools/daily/candidates/:id/accept
```

提交候选需要 `recommendations:write`，读取候选池需要 `recommendations:read`，接受候选并保存为文章需要 `recommendations:accept`。发布成功后系统会异步重新评估当天剩余候选。

管理员 Token 管理接口：

```text
GET  /api/v1/admin/tokens
POST /api/v1/admin/tokens
POST /api/v1/admin/tokens/:id/revoke
```

创建 Token 时提交 `{ "name": "AI助手", "scopes": ["articles:read", "planning:read", "dedup:check"] }`。Token 明文只在创建响应中返回一次，数据库只保存 hash。

返回内容包括战略目标、系列上下文、标题方向、核心问题、必须覆盖、必须避免、创新要求和相关历史文章摘要。生成前仍应调用防重复检测接口。

## 微信操作

后台登录后执行：

```text
POST /api/v1/articles/:id/wechat/draft
POST /api/v1/articles/:id/wechat/publish
POST /api/v1/articles/:id/wechat/retry
```

接口立即返回 operation ID，使用 `GET /api/v1/operations/:id` 查询结果。发布需要先获得草稿 ID，并且公众号具备发布权限。

## 运行检查

```text
GET /health   # 进程存活
GET /ready    # PostgreSQL 就绪
```

## 管理员会话

```text
POST /api/v1/auth/logout
```

密码重置会自动递增会话版本，使旧登录 cookie 立即失效。
