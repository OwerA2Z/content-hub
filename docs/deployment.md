# 生产部署指南

本文介绍使用 Docker Compose 部署内容中台。生产环境建议准备一台 Linux 主机、一个域名和 HTTPS 证书。

## 1. 准备主机

建议：

- Docker Engine 24+ 与 Docker Compose v2
- 至少 2 CPU、4 GB 内存
- PostgreSQL 数据目录使用持久化 volume
- 防火墙只开放 `22`、`80`、`443`

检查 Docker：

```bash
docker --version
docker compose version
```

## 2. 获取代码并配置环境变量

```bash
git clone git@github.com:OwerA2Z/content-hub.git
cd content-hub
cp .env.docker.example .env
```

编辑 `.env`，至少修改以下配置：

```env
POSTGRES_PASSWORD=随机数据库密码
DATABASE_URL=postgresql://article_user:随机数据库密码@postgres:5432/article_platform
API_TOKEN=随机的外部上传令牌
SESSION_SECRET=随机的会话签名密钥
AI_READ_TOKEN=随机的AI只读令牌
AI_WRITE_TOKEN=随机的AI写入令牌
```

如果要接入微信公众号，再配置：

```env
WECHAT_APP_ID=公众号AppID
WECHAT_APP_SECRET=公众号AppSecret
WECHAT_ENABLE_PUBLISH=false
```

只有确认公众号具备发布权限后，才将 `WECHAT_ENABLE_PUBLISH` 改为 `true`。

生成随机值示例：

```bash
openssl rand -hex 32
```

不要把 `.env` 提交到 Git，也不要把 `AppSecret` 写入前端代码或日志。

## 3. 启动服务

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

应用容器启动时会自动执行数据库 migration，然后启动 Node 服务。

检查服务：

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/ready
```

首次访问后台时会进入管理员初始化向导。初始化完成后不会开放公共注册。

## 4. 配置反向代理和 HTTPS

不要直接把应用端口暴露到公网。可以使用 Nginx、Caddy 或云厂商负载均衡终止 HTTPS。

Nginx 示例：

```nginx
server {
    listen 80;
    server_name content.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

申请证书后，将 HTTP 重定向到 HTTPS，并确保应用在生产环境使用 Secure、HttpOnly 会话 cookie。

## 5. 首次上传和 AI 读取

外部系统使用 `API_TOKEN` 上传：

```bash
curl -X POST https://content.example.com/api/v1/articles/upload \
  -H 'Authorization: Bearer <API_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "示例文章",
    "content": "<p>文章正文</p>",
    "contentFormat": "html",
    "source": "content-pipeline",
    "externalId": "article-001",
    "summary": "文章核心梗概",
    "outline": ["背景", "观点", "结论"],
    "topics": ["内容运营"],
    "keywords": ["AI", "文章管理"]
  }'
```

AI 系统使用独立的 `AI_READ_TOKEN`，只能读取已由微信公众号确认发布的文章，不能上传、修改、归档或发布。

AI 上传新文章使用 `AI_WRITE_TOKEN`，管理员也可以在后台 API 中心生成数据库 Token。Token 明文只显示一次。

## 6. 管理员密码恢复

管理员忘记密码时，在应用容器内生成一次性恢复码：

```bash
docker compose exec app npm run admin:recovery-code -- <管理员用户名>
```

恢复码只显示一次，15 分钟有效，使用后立即失效。然后在登录页点击“忘记密码”。

## 7. 数据备份

备份 PostgreSQL：

```bash
docker compose exec postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup-$(date +%Y%m%d-%H%M%S).sql
```

备份文件应保存到独立存储，不要只放在部署主机上。

恢复前先停止应用，避免恢复期间写入新数据：

```bash
docker compose stop app
cat backup.sql | docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose start app
```

恢复操作会覆盖目标数据库，执行前必须确认备份文件和目标环境。

## 8. 升级

```bash
git pull origin main
docker compose build app
docker compose up -d
docker compose logs --tail=100 app
curl http://127.0.0.1:3000/ready
```

migration 会在应用容器启动时按版本执行。升级后应检查后台登录、文章列表、上传接口和 AI 读取接口。

## 9. 回滚

升级前记录当前提交：

```bash
git rev-parse HEAD
```

出现问题时切回已验证版本并重新构建：

```bash
git checkout <previous-commit>
docker compose build app
docker compose up -d
```

数据库 migration 通常只前进不回退；涉及不可逆结构变化时，应先恢复数据库备份，再回滚应用版本。

## 10. 停止与清理

停止服务但保留数据库 volume：

```bash
docker compose down
```

不要在生产环境随意执行以下命令：

```bash
docker compose down -v
```

`-v` 会删除 PostgreSQL 数据 volume，可能导致文章和账号数据丢失。

## 11. 上线检查清单

- [ ] `.env` 使用了独立随机密钥，未提交到 Git
- [ ] PostgreSQL 使用持久化 volume
- [ ] 已配置 HTTPS 和域名
- [ ] `/health` 返回正常
- [ ] `/ready` 返回 PostgreSQL ready
- [ ] 首次管理员已初始化
- [ ] 外部上传 API Token 可用
- [ ] AI_READ_TOKEN 与 API_TOKEN 不同
- [ ] 已完成一次数据库备份和恢复演练
- [ ] 微信权限、草稿和发布状态已实际验证
- [ ] 已配置日志保留和主机磁盘监控
