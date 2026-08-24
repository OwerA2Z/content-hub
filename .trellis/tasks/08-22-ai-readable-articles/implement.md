# 实现计划：AI 可读文章接口

## Phase 0：计划门

- [x] 确认目标：为 AI 提供已确认发布文章的安全只读读取能力。
- [x] 确认边界：单 `AI_READ_TOKEN`、纯文本默认、HTML 可选、游标分页、不开放写操作。
- [x] 用户批准最终规划后执行 `task.py start`。

## Phase 1：发布确认数据模型

- [x] 新增 migration：`published_at`、`wechat_publish_id`、`publish_confirmed` 和索引。
- [x] 扩展 Article/ChannelOperation 类型和 PostgreSQL repository。
- [x] 扩展微信公众号 provider 的发布状态查询和任务恢复流程。
- [x] 增加发布状态查询与 pending/succeeded/failed 状态流转实现；真实微信状态需凭证环境验证。

## Phase 2：AI 只读 API

- [x] 增加 `AI_READ_TOKEN` 配置与常量时间认证 middleware。
- [x] 实现 `/api/v1/ai/articles` 游标分页、关键词、来源和时间筛选。
- [x] 实现 `/api/v1/ai/articles/:id`，只返回已确认发布文章。
- [x] 实现 HTML 安全处理和纯文本转换，字段使用白名单 DTO。
- [x] 增加独立限流、响应大小限制和错误语义。

## Phase 3：文档与测试

- [x] 增加 AI API 文档、curl 示例、Token 配置和内容使用边界。
- [x] 测试草稿、失败、本地 pending 和归档文章不会出现在 AI 结果中。
- [x] 测试 HTML/text 两种格式和已发布过滤。
- [x] 运行 typecheck、unit/API tests、build；Docker migration/readiness 因当前 Docker daemon 不可用待环境恢复后复验。

## 风险与回滚点

- 微信状态接口权限或字段变化：保留本地 pending 状态，AI 数据集宁可为空，也不把未确认文章标成已发布。
- HTML 转纯文本规则变化：保留原始 HTML，转换逻辑可独立替换，不修改文章存储。
- AI Token 泄露：支持通过环境变量轮换 Token；轮换期间旧 Token 立即失效。
