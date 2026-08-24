# 通用文章管理平台

TypeScript 全栈的文章管理后台，首个渠道适配微信公众号。

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
