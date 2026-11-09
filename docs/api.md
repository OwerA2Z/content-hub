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

文章封面也可以引用素材库中的本地图片：先使用具备 `media:write` 权限的 Token 上传素材，再在文章请求中填写返回的 `coverAssetId`。需要读取或预览素材时再授予 `media:read`。素材 ID 与 `coverUrl` 可以同时保留，微信公众号草稿会优先使用素材文件。

## 新文章自动上传草稿箱

管理员会话可调用 `PUT /api/v1/channels/wechat/options`，请求 `{ "autoDraft": true }`，成功返回 `{ "data": { "autoDraft": true } }`。普通 Token 或未登录返回 401，非布尔值返回 400、`INVALID_WECHAT_OPTIONS`。响应使用 `Cache-Control: no-store`，修改记录 `wechat.options.update` 审计。无需 AppSecret；`GET /channels/wechat/settings` 带出当前 `autoDraft`，凭证为 unreadable 时仍可读写开关。开关文件缺失、JSON 损坏或 autoDraft 非布尔时按关闭处理，GET 不因内容损坏报错；重新保存开关可覆盖修复。权限等非 ENOENT 文件读取错误仍会抛出。

`POST /articles/upload`、`POST /ai/articles` 和候选池采纳接口的 `data` 增加 `autoDraft`：

- `{ "status": "disabled" }`：开关关闭（默认），不创建操作。
- `{ "status": "not_new" }`：幂等命中旧文章，不补传。
- `{ "status": "submitted", "operationId": "…" }`：已提交 draft 操作；使用 `GET /operations/:id` 轮询，需要 `operations:read` 权限。
- `{ "status": "skipped", "code": "COVER_REQUIRED", "reason": "…" }`：文章入库成功，草稿跳过。其他错误码包括 `MEDIA_ASSET_UNAVAILABLE`、`CHANNEL_CAPABILITY_UNAVAILABLE`、`AUTO_DRAFT_ERROR`。

跳过记录 `wechat.draft.auto_skipped:<CODE>` 审计（如 `wechat.draft.auto_skipped:COVER_REQUIRED`），actorType 为 system，actorId 保留触发入库的真实操作者（可为空）；完整原因仅在响应 autoDraft.reason 返回。提交记录 `wechat.draft.auto`，actorType 为 system。草稿异步失败由操作状态反映，不影响文章入库；不会自动发布。原上传字段校验仍有效，例如直接上传引用不存在的封面素材仍返回 400。

## 素材库

素材库首版只支持 JPG、PNG、WebP 和 GIF，单张图片最大 10 MB。素材元数据保存在 PostgreSQL，图片文件保存在 `MEDIA_ROOT` 对应的本地持久化目录。

```bash
curl -X POST http://localhost:3000/api/v1/media/assets \
  -H 'Authorization: Bearer <TOKEN_WITH_media:write>' \
  -F 'file=@cover.png' \
  -F 'tags=["通用","封面"]' \
  -F 'alt=通用封面'
```

素材接口：

```text
GET    /api/v1/media/assets?q=关键词&tag=封面&page=1&pageSize=24   # media:read
GET    /api/v1/media/assets/:id                                    # media:read
POST   /api/v1/media/assets                                        # media:write
PATCH  /api/v1/media/assets/:id                                    # media:write；归档需 media:delete
DELETE /api/v1/media/assets/:id                                    # media:delete（软归档）
GET    /media/assets/:id/content                                  # media:read
```

`POST` 返回的 `data.id` 可作为文章上传或文章媒体更新请求中的 `coverAssetId`。归档素材不会删除已关联文章；读取已归档素材内容会返回 404。

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
PATCH /api/v1/admin/tokens/:id
POST /api/v1/admin/tokens/:id/revoke
DELETE /api/v1/admin/tokens/:id
```

创建 Token 时提交 `{ "name": "AI助手", "scopes": ["articles:read", "planning:read", "dedup:check"] }`。Token 明文只在创建响应中返回一次，数据库只保存 hash。
删除仅适用于已撤销 Token，成功返回 `{ "data": { "deleted": true } }`；不存在或尚未撤销时返回 404。删除会清理凭证记录，保留操作审计。
编辑权限时提交 `{ "scopes": ["articles:read", "planning:read"] }`，仅更新权限，不会生成新的 Token 明文。

返回内容包括战略目标、系列上下文、标题方向、核心问题、必须覆盖、必须避免、创新要求和相关历史文章摘要。生成前仍应调用防重复检测接口。

## 微信操作

后台登录后执行：

```text
POST /api/v1/articles/:id/wechat/draft
POST /api/v1/articles/:id/wechat/publish
POST /api/v1/articles/:id/wechat/retry
```

接口立即返回 operation ID，使用 `GET /api/v1/operations/:id` 查询结果。发布需要先获得草稿 ID，并且公众号具备发布权限。
创建真实微信公众号草稿时，文章必须提供有效的 `coverAssetId`，或 `coverUrl` / `images[0]`（本站素材地址或公网 HTTP(S) 地址）。正文图片先转存到微信，仅支持 JPG/PNG 且单张小于 1MB；下载、格式或微信接口错误会使任务失败。缺少凭证时不生成模拟成功结果。

本站素材图片支持 `/media/assets/{id}/content` 或与 `PUBLIC_BASE_URL` 同源的绝对地址，正文及封面均检查素材存在且 active 后读取本地文件，不进行 HTTP 下载；其他相对或无效地址返回中文错误。正文按魔数识别 JPEG/PNG，封面还支持 GIF/WebP；响应头缺失或为 `application/octet-stream` 不影响合法图片上传，非法魔数被拒绝。封面最大 10MB。

access_token 在进程内按 AppID + AppSecret 共享缓存，同凭证并发获取合并为一次请求；测试连接忽略已完成缓存并强制刷新，仍使用现有 token 接口。

### 公众号接入配置（仅管理员会话）

```text
GET  /api/v1/channels/wechat/settings
PUT  /api/v1/channels/wechat/settings
POST /api/v1/channels/wechat/test
```

保存请求为 `{ "appId": "wx1234567890123456", "appSecret": "填写公众号密钥" }`。AppID 为 wx 开头的 18 位字符；首次保存或更换 AppID 须提交 Secret，同一 AppID 的 Secret 留空或省略则保留。GET/PUT 返回 `{ "data": { "appId": "wx1234567890123456", "hasSecret": true, "source": "saved", "autoDraft": false } }`，不返回密钥。source 也可能为 `environment`、`none` 或 `unreadable`。无法解密时 GET 返回 200 和 `{ "data": { "appId": "", "hasSecret": false, "source": "unreadable", "autoDraft": false } }`，capabilities 返回 200、`draft/publish=false` 及重填原因，不回退环境变量。此时 PUT 必须同时提供有效 AppID 和新的非空 AppSecret，否则返回 400；成功后覆盖旧密文。保存立即生效，优先于环境变量。

测试接口无请求体，验证已保存或环境变量提供的凭证，成功返回 `{ "data": { "connected": true } }`；失败返回 400 和 `WECHAT_CONNECTION_FAILED`。连接成功不代表草稿/发布权限可用。以上接口不允许普通 API Token 访问，均设置 `Cache-Control: no-store`。


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
