# AI 对接说明书

本文面向 AI Agent、内容生成服务和自动化工作流开发者。完整的低层接口清单见 [API 使用说明](./api.md)。

## 1. 对接目标

AI 与内容中台建议采用以下闭环：

```text
读取内容规划
  ↓
读取已发布文章和内容梗概
  ↓
生成候选标题、摘要、提纲和正文
  ↓
调用防重复检测
  ↓
根据警告调整或放弃生成
  ↓
上传新文章
```

内容中台负责保存、检索、去重提示和微信公众号后续管理；AI 负责生成和修改候选内容。

## 2. Base URL 与 Token

在后台“API 中心”获取 API Base URL 和 Token。所有接口都使用 `/api/v1` 前缀。

请求统一使用：

```http
Authorization: Bearer <TOKEN>
Content-Type: application/json
```

建议为不同用途创建不同 Token：

| Token 类型 | 用途 | 允许的主要接口 |
| --- | --- | --- |
| `ai_read` | AI 读取和防重复检测 | `/ai/articles`、`/ai/content-plan/*`、`/ai/articles/check-duplicate` |
| `ai_write` | AI 上传新文章 | `POST /ai/articles` |
| `api` | 外部内容管道和后台查询 | `/articles/upload`、文章查询和内容规划查询 |

Token 明文只在创建时返回一次，数据库只保存 hash。生产环境不要把 Token 写入代码仓库、提示词或日志。

## 3. 推荐调用流程

### 第一步：读取下一个内容任务

```bash
curl "$BASE_URL/api/v1/ai/content-plan/next" \
  -H "Authorization: Bearer $AI_READ_TOKEN"
```

如果没有可用任务，接口返回：

```json
{ "data": null }
```

有任务时会返回战略、系列、文章任务和相关历史文章摘要。生成时应优先遵守 `mustCover`、`mustAvoid`、`noveltyRequirement` 和 `coreQuestion`。

### 第二步：读取已发布文章

```bash
curl "$BASE_URL/api/v1/ai/articles?limit=20&source=content-pipeline" \
  -H "Authorization: Bearer $AI_READ_TOKEN"
```

列表接口只返回：

- 已由微信公众号确认发布的文章
- `publish_confirmed=true`
- 未归档文章

详情默认返回纯文本，需要 HTML 排版时使用 `?format=html`。

### 第三步：生成文章画像

建议 AI 在正式生成正文前，先整理以下字段：

- `title`
- `summary`
- `outline`
- `topics`
- `keywords`
- 可选的 `content`

摘要和梗概应表达文章核心观点，不要只复述标题。提纲应体现文章结构和独立角度。

### 第四步：调用防重复检测

```bash
curl -X POST "$BASE_URL/api/v1/ai/articles/check-duplicate" \
  -H "Authorization: Bearer $AI_READ_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "候选文章标题",
    "summary": "候选文章核心梗概",
    "outline": ["背景", "核心观点", "案例", "结论"],
    "topics": ["内容运营"],
    "keywords": ["AI", "内容中台"],
    "content": "<p>候选正文</p>"
  }'
```

返回示例：

```json
{
  "data": {
    "exactDuplicate": false,
    "risk": "medium",
    "similarity": 0.51,
    "candidates": [
      {
        "articleId": "published-article-id",
        "title": "已发布文章",
        "similarity": 0.51,
        "reason": "重合维度：title、topics",
        "matchedDimensions": ["title", "topics"],
        "matchedKeywords": ["AI"]
      }
    ],
    "warnings": ["存在部分主题重合，建议补充新的角度和独立案例。"],
    "advisory": true
  }
}
```

处理建议：

| 风险 | AI 应采取的动作 |
| --- | --- |
| `exact` | 不要直接上传，重新设计主题和正文 |
| `high` | 更换核心观点、案例或文章结构后重新检测 |
| `medium` | 增加独立角度、案例和新关键词后重新检测 |
| `low` | 可以继续，但仍要做最终语义判断 |

该接口是建议性检查，不会自动阻断上传。AI 应自行决定是否接受警告。

### 第五步：上传新文章

```bash
curl -X POST "$BASE_URL/api/v1/ai/articles" \
  -H "Authorization: Bearer $AI_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "AI 生成的新文章",
    "content": "<h1>AI 生成的新文章</h1><p>文章正文</p>",
    "contentFormat": "html",
    "source": "my-ai-agent",
    "externalId": "agent-task-20260825-001",
    "digest": "文章摘要",
    "summary": "文章核心梗概",
    "outline": ["背景", "核心观点", "案例", "结论"],
    "topics": ["内容运营"],
    "keywords": ["AI", "内容中台"]
  }'
```

必填字段：

- `title`：最长 120 个字符。
- `content`：HTML 正文，最长 2 MB。
- `contentFormat`：固定为 `html`。

推荐填写：

- `summary`：文章梗概，用于 AI 后续判断和去重。
- `outline`：文章结构。
- `topics`、`keywords`：主题和关键词。
- `source`、`externalId`：来源和幂等键。

如果文章来自内容规划，可以附带 `strategyId`、`seriesId`、`briefId`。使用 `briefId` 时，系统会校验并自动补齐对应战略和系列关系。

## 4. 幂等上传

当同时提供 `source` 和 `externalId` 时，两者组成幂等键。网络超时后可以使用相同请求安全重试，重复请求会返回原文章记录而不会重复创建。

建议格式：

```text
source: my-ai-agent
externalId: <工作流名称>-<任务 ID>
```

## 5. 文章状态与读取可见性

AI 上传成功后，文章通常处于 `uploaded` 状态。它不会立即出现在 AI 只读列表中。

常见状态：

- `uploaded`：已保存，等待人工或渠道处理。
- `draft_ready`：微信公众号草稿已创建。
- `publish_pending`：正在等待发布结果确认。
- `published`：已发布，但还需要确认标记完成后才对 AI 只读接口可见。
- `sync_failed`：微信公众号操作失败。
- `archived`：已归档，不对 AI 只读接口展示。

AI 只读接口只返回微信公众号确认发布且未归档的文章，这是为了避免 AI 把草稿或未审核内容当成既有事实。

## 6. 错误处理

成功响应格式：

```json
{ "data": {} }
```

失败响应格式：

```json
{
  "error": {
    "code": "AI_UNAUTHORIZED",
    "message": "AI 只读凭证无效"
  }
}
```

AI 客户端至少应处理：

- `401`：Token 缺失、错误或未配置。
- `400`：请求字段校验失败，应根据 `message/details` 修正请求。
- `404`：文章、内容任务或资源不存在。
- `409`：幂等冲突、规划关系冲突或业务状态冲突。
- `429`：请求过于频繁，使用退避重试。
- `500/503`：服务或数据库暂时不可用，保留任务并稍后重试。

## 7. 安全建议

- `ai_read` 和 `ai_write` 使用不同 Token。
- Token 放在服务端密钥管理系统或运行时环境变量中。
- 不要把完整 Token 写入文章 metadata、日志或模型上下文。
- 上传前先执行防重复检测，生成后再次检查正文。
- 不要把未发布文章当作 AI 的事实库；以 AI 只读接口返回结果为准。

更多低层接口定义见 [API 使用说明](./api.md)，部署和环境变量见 [生产部署指南](./deployment.md)。
