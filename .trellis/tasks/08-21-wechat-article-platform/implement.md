# 实现计划：通用文章管理平台

## Phase 0：计划评审门

- [x] 锁定产品范围：文章上传、保存、预览、归档；微信公众号为首个可插拔渠道。
- [x] 锁定关键决策：PostgreSQL、JSON + HTML + 图片 URL、只读内容、软删除、单公众号配置、人工触发草稿/发布。
- [x] 计划确认后执行 `task.py start`，再修改业务代码。

## Phase 1：项目骨架与开发体验

- [ ] 初始化 `package.json`、TypeScript、Vite、Express、Drizzle、Vitest、Playwright 和 lint 配置。
- [ ] 建立 `src/client`、`src/server`、`src/shared` 目录边界。
- [ ] 添加 PostgreSQL 连接配置、迁移脚本、`.env.example`、`.gitignore` 和 README。
- [x] 增加 Dockerfile、docker-compose.yml 和 PostgreSQL 持久化 volume。
- [ ] 增加后台登录会话、API Token 双认证边界，以及 `/health`/`/ready` 存活与就绪检查。
- [x] 增加一次性管理员初始化向导、scrypt 密码哈希和初始化完成后的注册关闭。
- [x] 增加服务器生成的一次性恢复码、密码重置 API 和登录页恢复流程。
- [ ] 配置开发模式 Vite proxy、生产模式 Express 静态托管。
- **验证**：`npm run typecheck`、`npm run build` 通过。

## Phase 2：PostgreSQL 数据层与文章 API

- [x] 定义 Article、ChannelOperation、AuditLog schema、索引、联合幂等约束和迁移。
- [ ] 为渠道操作增加 `dedupeKey` 与进行中任务唯一约束，防止重复草稿/发布。
- [ ] 实现 repository/service：上传幂等、列表筛选、分页、详情、归档、恢复。
- [ ] 实现 Bearer Token middleware、统一错误处理和响应格式。
- [ ] 实现请求体大小限制、基础限流、API 版本前缀和认证失败审计。
- [ ] 实现 `/health`、上传、查询、归档、恢复接口。
- [ ] 编写 API 测试：认证、校验、重复上传、分页/筛选、持久化、归档恢复。
- **验证**：使用真实 PostgreSQL 完成“上传 → 查询 → 重启后仍存在”的链路。

## Phase 3：通用渠道层与微信公众号适配

- [ ] 定义 `ChannelProvider`、能力模型、异步 operation 状态和操作记录。
- [ ] 实现 `WechatProvider`：access token 缓存、草稿创建、发布提交、状态查询、错误映射和超时。
- [ ] 实现微信公众号图片转换：安全下载封面/正文图片、上传微信素材、重写文章图片引用；失败不回滚本地文章。
- [ ] 实现能力探测；无发布权限的账号隐藏/禁用发布动作并显示原因。
- [x] 实现草稿、发布、失败重试接口和状态流转。
- [ ] 实现重复点击/网络重试复用已有 operation 的幂等行为。
- [ ] 增加 mock provider，测试不依赖真实公众号凭证。
- **验证**：mock 环境完成“创建草稿 → 发布成功/失败 → 重试”流程。

## Phase 4：前端应用壳与文章管理

- [ ] 建立 App layout、侧边栏、顶部工具栏、路由和响应式断点。
- [ ] 建立状态标签、卡片、表格、预览容器、确认弹窗、Toast 等基础组件。
- [ ] 实现工作台真实指标、文章列表、关键词搜索、状态/时间筛选。
- [x] 实现详情页公众号样式 HTML 预览、归档/恢复、渠道操作按钮和反馈状态。
- [ ] 对 HTML 预览做 sanitizer/sandbox 隔离，防止脚本执行和会话窃取。
- [ ] 根据渠道能力动态展示草稿/发布入口；不提供正文编辑器。
- **验证**：完成“上传 API → 后台列表 → 预览 → 创建草稿/发布 → 查看结果”浏览器流程。

## Phase 5：文档与质量收尾

- [ ] 补充 API 示例、JSON 字段说明、PostgreSQL 初始化、公众号配置和权限说明。
- [ ] 运行 typecheck、lint、unit/API tests、build 和关键 e2e。
- [ ] 检查敏感信息、HTML 预览安全、幂等、归档恢复、失败重试和移动端布局。
- [ ] 检查图片 URL SSRF 防护、接口限流、后台登录、审计日志、`/ready` 和任务轮询。
- [ ] 检查微信素材转换失败、重复素材操作和渠道错误映射。
- [ ] 将稳定的前后端约定更新到 Trellis spec。
- [ ] 完成提交并归档任务。

## 风险与回滚点

- 微信账号权限不确定：保留 provider 与本地文章管理主链路，按能力降级，不阻塞保存功能。
- 微信图片要求变化：先保留图片 URL 与渠道转换边界，后续再增加素材上传，不改文章 API。
- PostgreSQL 连接或迁移失败：保留 repository/service/API 合约，修复迁移或替换实现，不改变前端契约。
