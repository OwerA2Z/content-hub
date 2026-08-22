# 技术设计：通用文章管理平台

## 1. 技术选型

- **前端**：React + TypeScript + Vite；React Router 管理页面，普通 CSS 与 CSS variables 建立轻量视觉系统。
- **后端**：Node.js + TypeScript + Express；前后端同仓库、同一启动入口。
- **数据库**：PostgreSQL + Drizzle ORM；repository 层隔离数据库实现，支持线上多实例部署。
- **校验**：Zod 用于上传 body、查询参数、渠道响应和配置校验。
- **渠道**：定义统一 `ChannelProvider` 接口，首个实现为微信公众号 `WechatProvider`；服务端负责 access token、封面素材上传、草稿和发布，页面和文章服务不直接调用微信。
- **测试**：Vitest 做单元/API 测试，Playwright 覆盖关键浏览器流程。
- **图标**：Lucide React。
- **后台认证**：服务端 HttpOnly、Secure、SameSite 会话 cookie；首版管理员凭证通过环境变量注入，外部 API 继续使用独立 Bearer Token。

## 2. 目录边界

```text
src/
  client/
    app/                 # 路由、布局、全局样式
    components/          # 可复用 UI 组件
    features/
      dashboard/
      articles/
      settings/
    lib/                 # API client、格式化、前端工具
  server/
    app.ts               # Express app 装配
    index.ts             # 生产启动入口
    db/                  # schema、迁移、连接
    modules/
      articles/          # repository、service、routes、schema
      channels/          # provider 接口、微信实现、能力探测、routes
      auth/              # API key middleware
      operations/        # 异步渠道任务、状态查询、重试
      audit/             # 高风险操作审计
    shared/              # 前后端共用 DTO、枚举
  tests/
    api/
    e2e/
```

Vite client bundle 不直接导入 server；服务端通过 `/api/v1` 提供业务能力，生产由 Express 静态托管，开发时使用 Vite proxy。

## 3. 数据模型

### Article

- `id`: UUID 平台主键
- `externalId`, `source`: 可选外部幂等字段，联合唯一
- `title`: 必填，长度 1–120
- `author`, `digest`, `coverUrl`: 可选元数据
- `contentFormat`: 固定 `html`
- `content`: 原始 HTML 正文
- `images`, `metadata`: JSONB，可选
- `status`: `uploaded | draft_ready | publish_pending | published | sync_failed | archived`
- `createdAt`, `updatedAt`, `archivedAt`: 时间字段
- `idempotencyKey`: 可选请求幂等键；与 `source + externalId` 组合形成唯一约束

### ChannelOperation

- `id`, `articleId`, `provider`: 操作主键、文章关联、渠道类型
- `action`: `draft | publish`
- `dedupeKey`: 文章 + 渠道 + 动作 + 内容版本的唯一键
- `externalId`: 渠道草稿/发布任务 ID
- `status`: `pending | succeeded | failed`
- `errorMessage`, `requestId`, `createdAt`, `completedAt`

### AuditLog

- `id`, `actorType`, `actorId`, `action`, `articleId`, `operationId`, `ip`, `userAgent`, `createdAt`
- 不记录 API token、AppSecret、access token 和完整文章正文

### WechatConfig

首版使用服务端环境变量 `WECHAT_APP_ID`、`WECHAT_APP_SECRET` 配置单公众号；通过 `WECHAT_ENABLE_PUBLISH` 显式开启发布能力，AppSecret 绝不返回前端。后续可迁移到 `channel_accounts` 表支持多公众号。

### User / Setup

首启管理员写入 PostgreSQL `users` 表，密码使用 `scrypt` 和随机 salt 哈希，不保存明文。`/api/v1/setup/status` 只返回是否需要初始化；`/api/v1/setup/initialize` 仅在没有任何用户时可调用，成功后设置 HttpOnly 会话 cookie，后续返回 409。

管理员恢复使用 `admin_recovery_codes` 表：服务器命令生成高熵恢复码，仅保存 SHA-256 哈希，15 分钟过期；Web 端 `POST /api/v1/auth/reset-password` 校验并在事务内更新密码、标记恢复码已使用。恢复码不通过公开 API 生成。密码重置会递增用户 session version，使旧会话失效。

### API Key

MVP 使用环境变量 `API_TOKEN` 做单租户 Bearer 校验，不把 token 存入数据库；后续保留扩展 `api_keys` 表的空间。

## 4. Provider 合约

```ts
interface ChannelProvider {
  getCapabilities(): Promise<{ draft: boolean; publish: boolean }>;
  createDraft(article: Article): Promise<ChannelResult>;
  publish(article: Article, draftId: string): Promise<ChannelResult>;
  retry(operationId: string): Promise<ChannelResult>;
}
```

`WechatProvider` 负责 access token 获取/缓存、封面与正文图片 URL 的安全下载及微信素材转换、HTML 重写、微信错误映射、超时和安全日志；文章 service 只依赖 provider 合约。素材转换失败只影响渠道操作，不回滚本地文章。

## 5. API 合约

统一成功响应 `{ "data": {}, "meta": {} }`，统一错误响应 `{ "error": { "code": "...", "message": "...", "details": [] } }`。

- `GET /health`
- `GET /ready`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/setup/status`
- `POST /api/v1/setup/initialize`
- `POST /api/v1/articles/upload`
- `GET /api/v1/articles?page=1&pageSize=20&status=uploaded&q=关键词`
- `GET /api/v1/articles/:id`
- `POST /api/v1/articles/:id/archive`
- `POST /api/v1/articles/:id/restore`
- `GET /api/v1/channels/wechat/capabilities`
- `POST /api/v1/articles/:id/wechat/draft`
- `POST /api/v1/articles/:id/wechat/publish`
- `POST /api/v1/articles/:id/wechat/retry`
- `GET /api/v1/operations/:id`

所有业务接口统一挂在 `/api/v1`；上传接口使用 Bearer Token/API Key，后台高风险操作使用登录会话。`/health` 为存活检查，`/ready` 检查 PostgreSQL 连接。启动日志不得输出完整凭证。

## 6. 核心数据流

1. 外部系统调用上传接口，服务端校验 JSON、计算 `source + externalId` 幂等键并写入 PostgreSQL。
2. 后台读取同一数据源，展示原始 HTML 的公众号样式预览。
3. 用户明确点击“创建草稿”或“发布”；服务端先检查渠道能力，并按 `dedupeKey` 复用进行中的 `ChannelOperation`，再异步调用 `WechatProvider`。
4. 接口立即返回 operation ID；前端轮询任务状态。成功时保存渠道返回 ID 与时间；失败时保存安全的错误摘要和 request id，文章进入 `sync_failed`。
5. 失败操作可在后台重试；归档只改变本地可见性，不删除渠道审计信息；所有高风险动作写入 `AuditLog`。

## 7. 安全与可靠性

- body/query 进行 schema 校验并限制标题、正文、URL、分页参数大小。
- 对上传和登录接口限流；统一设置请求超时、body 大小上限和反向代理信任边界。
- HTML 预览使用严格 sanitizer 或 sandbox iframe，禁止脚本、表单、顶层跳转和读取父页面 cookie。
- 服务端抓取图片前校验协议、解析 DNS/目标 IP、限制重定向次数、响应体大小和下载时长，阻止 SSRF。
- 微信素材上传结果与 `ChannelOperation` 关联保存；不把临时素材凭证写入文章正文或前端。
- API token、AppSecret、access token 不写入前端响应和普通日志。
- 微信请求设置超时，错误区分可重试/不可重试，并保存 request id。
- PostgreSQL 迁移由 `migrations/` 管理并可重复执行；应用启动不隐式建表；`.env` 不入库，提供 `.env.example`。
