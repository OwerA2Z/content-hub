# 通用内容管理平台

TypeScript 全栈的文章管理后台，首个渠道适配微信公众号。

前端使用 React + TypeScript + Vite + Tailwind CSS v4，设计 token 统一维护在 `src/client/styles.css` 的 `@theme` 中。

## 本地启动

```bash
npm install --ignore-scripts
cp .env.example .env
npm run dev
```

## Docker Compose 部署

```bash
cp .env.docker.example .env
docker compose up -d --build
```

应用和 PostgreSQL 会一起启动，文章数据保存在 `postgres_data` volume 中。查看日志：

完整生产部署、HTTPS、备份恢复、升级和回滚说明见 [docs/deployment.md](docs/deployment.md)。

```bash
docker compose logs -f app
```

停止服务但保留数据：

```bash
docker compose down
```

没有配置 `DATABASE_URL` 时会使用仅供开发和测试的内存 repository；配置 PostgreSQL 连接后会使用 PostgreSQL repository。生产启动前会执行 `npm run db:migrate`，不会在应用请求期间隐式建表。

前端开发服务器：

```bash
npm run dev:client
```

## 使用文档

- [后台使用手册](docs/user-guide.md)：首次启动、文章管理、内容规划、API 中心和微信公众号操作。
- [AI 对接说明书](docs/ai-integration.md)：Token 权限、推荐调用流程、防重复检测、文章上传和错误处理。
- [API 使用说明](docs/api.md)：完整接口清单和请求示例。

首次打开后台会进入初始化向导，创建第一个管理员账号。外部上传 API 使用 `API_TOKEN`：

管理员忘记密码时，在服务端或应用容器中生成一次性恢复码：

```bash
npm run admin:recovery-code -- <管理员用户名>
# Docker：docker compose exec app npm run admin:recovery-code -- <管理员用户名>
```

恢复码只显示一次，15 分钟内有效；在登录页点击“忘记密码”完成重置。

```bash
curl -X POST http://localhost:3000/api/v1/articles/upload \
  -H 'Authorization: Bearer replace-with-a-long-random-api-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "示例文章",
    "content": "<p>文章正文</p>",
    "contentFormat": "html",
    "source": "demo",
    "externalId": "demo-001"
  }'
```

## 校验命令

```bash
npm run typecheck
npm test
npm run build
```

更多接口说明见 [docs/api.md](docs/api.md)。生产环境建议定期备份 PostgreSQL：

```bash
docker compose exec postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
```

微信公众号真实草稿/发布调用需要补充服务端凭证和账号权限；未配置凭证时平台会安全降级为文章保存与管理。

AI 只读接口需要配置 `AI_READ_TOKEN`，只返回微信公众号确认发布的文章，详情默认返回纯文本，接口说明见 [docs/api.md](docs/api.md)。

AI 上传文章使用独立的 `AI_WRITE_TOKEN`；管理员可以在后台“API 中心”生成和撤销数据库 Token，Token 明文只显示一次。

内容规划采用“内容战略 → 内容系列 → 文章任务”三级结构，AI 可读取下一个任务和相关历史文章后再生成内容。
