# 文章内容画像与防重复

## Goal

让外部 AI 在上传文章时提供文章梗概、提纲、主题和关键词，平台保存这些内容并提供精确重复与高相似文章检测，帮助 AI 生成新文章时避开已有内容。

## Repository evidence

- 当前上传接口支持 `title`、`digest`、`content`、`metadata`，但没有结构化梗概、提纲、主题、关键词和正文指纹字段。
- 当前 AI 接口只读取已确认发布文章，还没有专门的重复检测接口。
- 当前没有向量数据库或 embedding 服务，首版应采用可解释的规则和文本指纹，不引入外部模型依赖。

## Product decisions

- 梗概、提纲、主题和关键词由外部 AI/内容系统提供，平台不在首版自动生成。
- 平台对正文做规范化后计算 `contentHash`，用于精确重复判断。
- 首版相似度使用标题、梗概、关键词和正文 token 的可解释规则；embedding/向量检索延期。
- 检测结果默认是风险提示，不阻止上传或生成；高风险时返回详尽、可解释的警告，让 AI 端自行决定是否调整主题、角度或放弃生成。
- 归档文章默认不参与重复检测，已确认发布和草稿文章参与检测。

## Upload fields

新增可选字段：

- `summary`: 文章核心梗概，建议 50–2,000 字。
- `outline`: 文章结构提纲，字符串数组，最多 30 项。
- `topics`: 主题/分类数组，最多 20 项。
- `keywords`: 关键词数组，最多 50 项。

平台生成并保存：

- `contentHash`: 规范化正文 SHA-256 指纹。

## Proposed API

- `POST /api/v1/ai/articles/check-duplicate`
  - 接受待生成文章的标题、梗概、提纲、主题、关键词和可选正文。
  - 返回 `exactDuplicate`、`risk`、`similarity` 和候选历史文章。
- `GET /api/v1/articles/:id/similar`
  - 后台管理员查看某篇文章的相似历史文章。

AI Token 只能调用 `check-duplicate`，不能调用后台相似文章管理接口的写操作。

## Response shape

```json
{
  "exactDuplicate": false,
  "risk": "medium",
  "similarity": 0.82,
  "candidates": [
    {
      "articleId": "article-id",
      "title": "历史文章标题",
      "similarity": 0.82,
      "reason": "主题和核心观点高度相似"
    }
  ]
}
```

## Acceptance Criteria

- [ ] 上传接口可接收并持久化 summary、outline、topics、keywords。
- [ ] 同一规范化正文生成稳定 `contentHash`，重复正文可被识别。
- [ ] AI 可调用重复检测接口，并且不能通过该接口修改文章。
- [ ] 检测结果包含风险等级、相似度、候选文章和可解释原因。
- [ ] 高风险结果包含具体重合维度、命中的关键词/主题、相似文章摘要和建议的调整方向。
- [ ] 归档文章默认不参与检测。
- [ ] 不使用 embedding 或外部模型也能完成首版检测。
- [ ] 已发布、草稿和上传文章的重复检测行为有测试覆盖。

## Out of scope

- 平台自动生成梗概、提纲、主题和关键词。
- 向量数据库、embedding、语义召回和模型调用。
- 自动阻断所有相似文章上传。
- 多租户独立相似度索引。
