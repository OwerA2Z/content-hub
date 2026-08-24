# 实现计划：文章内容画像与防重复

## Phase 0：计划门

- [x] 确认画像由外部 AI 提供，平台保存和比较。
- [x] 确认高风险返回详尽警告，不自动阻断生成。
- [x] 用户批准最终规划后执行 `task.py start`。

## Phase 1：内容画像与指纹

- [x] 新增 migration：summary、outline、topics、keywords、content_hash。
- [x] 扩展上传 schema、Article DTO、Memory/PostgreSQL repository。
- [x] 实现 HTML 规范化和 SHA-256 contentHash。
- [x] 上传时保存画像；旧文章字段保持兼容。

## Phase 2：重复检测

- [x] 实现 token/Jaccard 规则评分和风险等级。
- [x] 实现 AI `POST /api/v1/ai/articles/check-duplicate`。
- [x] 实现后台 `GET /api/v1/articles/:id/similar`。
- [x] 返回匹配维度、关键词、候选摘要和 AI 调整建议。
- [x] 归档文章排除，发布/草稿/已上传文章参与检测。

## Phase 3：测试与文档

- [x] 测试 exact hash、标题/summary/关键词相似、归档过滤和空画像。
- [x] 测试 AI Token 只能检测不能写入。
- [x] 增加 API 文档和上传字段示例。
- [x] 运行 typecheck、unit/API tests、build；Docker migration 因当前 daemon 不可用待环境恢复后复验。

## 风险与回滚

- 启发式评分可能误判：只返回解释和建议，不自动阻断。
- HTML 规范化规则变化：保存原始正文，hash 算法版本可后续增加。
- 画像字段过大：限制数组数量和单项长度，防止请求体膨胀。
