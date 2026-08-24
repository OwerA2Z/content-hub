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

配置 `AI_READ_TOKEN` 后，AI 系统只能读取已由微信公众号确认发布的文章：

```bash
curl 'http://localhost:3000/api/v1/ai/articles?limit=20&source=content-pipeline' \
  -H 'Authorization: Bearer <AI_READ_TOKEN>'
```

详情默认返回纯文本；需要排版时使用 `?format=html`：

```text
GET /api/v1/ai/articles/:id
GET /api/v1/ai/articles/:id?format=html
```

AI Token 没有上传、修改、归档、恢复或发布权限。只有微信公众号确认发布成功的文章才会出现在结果中。

## AI 防重复检测

外部 AI 生成新文章前，可以提交文章画像进行重复检测：

```bash
curl -X POST http://localhost:3000/api/v1/ai/articles/check-duplicate \
  -H 'Authorization: Bearer <AI_READ_TOKEN>' \
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
