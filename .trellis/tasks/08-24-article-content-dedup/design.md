# 技术设计：文章内容画像与防重复

## 1. 数据流

```text
外部 AI 上传文章画像
  → Zod 校验与正文规范化
  → SHA-256 contentHash + 画像字段持久化
  → 规则相似度计算
  → AI 只读重复检测接口
  → 详尽警告与调整建议
```

平台不生成 summary/outline/topics/keywords，只负责保存、标准化和比较。

## 2. 数据模型

Article 增加：

- `summary`: 外部 AI 提供的核心梗概
- `outline`: JSONB 字符串数组
- `topics`: JSONB 字符串数组
- `keywords`: JSONB 字符串数组
- `contentHash`: 规范化 HTML 正文的 SHA-256

增加索引：

- `content_hash` 唯一/非唯一索引，用于精确重复快速查询
- `status` 和 `archived_at`，过滤归档内容

## 3. 规范化与精确重复

- HTML 去除 script/style/comment、折叠空白、统一换行和大小写规则后计算 hash。
- 图片 URL 保留为占位符，避免 CDN query 参数变化导致正文指纹失真。
- 相同 `contentHash` 的文章返回 `exactDuplicate=true`。

## 4. 首版相似度规则

对候选文章计算 0–1 相似度：

- 标题 token 重合：30%
- summary token 重合：30%
- topics/keywords Jaccard 重合：20%
- 正文 token 重合：20%

风险等级：

- `low`: `< 0.45`
- `medium`: `0.45–0.75`
- `high`: `> 0.75`
- `exact`: contentHash 完全相同

候选范围包含已发布、草稿和已上传文章，排除归档文章；结果返回最多 10 个候选。

## 5. API

### AI 检测

`POST /api/v1/ai/articles/check-duplicate`

- 使用 `AI_READ_TOKEN`。
- 接受标题、summary、outline、topics、keywords 和可选 HTML content。
- 不写入数据库，不改变任何文章状态。

### 后台相似文章

`GET /api/v1/articles/:id/similar`

- 使用后台 session 或管理 API Token。
- 返回当前文章的相似候选和解释。

响应警告包括：

- `risk`
- `similarity`
- `exactDuplicate`
- `matchedDimensions`: `title | summary | topics | keywords | content`
- `matchedKeywords`
- `candidates`: 文章 ID、标题、摘要、相似度、原因
- `warnings`: 面向 AI 的具体建议，例如“更换核心观点”“缩小到新的案例”“避免沿用原提纲”。

## 6. 安全与兼容

- 上传字段保持可选，旧文章没有画像时仍可读取。
- AI 检测不接受管理写操作，不返回敏感 metadata。
- 相似度是启发式结果，不包装成事实；响应明确标记为建议。
- 后续增加 embedding 时保留本规则评分作为 fallback。
