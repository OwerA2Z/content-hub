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
