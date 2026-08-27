# 本地化图片素材库技术设计

## 模块边界

```text
前端素材库页面
  ↓ multipart / JSON API
素材路由
  ↓
素材服务（校验、文件写入、URL 生成）
  ↓                 ↓
素材元数据仓储       本地文件存储
  ↓                 ↓
PostgreSQL        MEDIA_ROOT volume
```

- `features/media` 只负责素材列表、上传、预览、标签和归档交互。
- `media-storage` 负责文件系统读写、命名、路径安全和静态读取。
- `media-library` 负责图片校验、元数据和素材状态。
- 文章、候选池和微信公众号服务只依赖素材 ID/读取接口，不直接拼接磁盘路径。

## 数据模型

新增 `media_assets`：

- `id uuid primary key`
- `kind varchar(20)`，首版固定为 `image`
- `original_name varchar(255)`
- `storage_key varchar(500)`，相对 `MEDIA_ROOT` 的安全路径
- `mime_type varchar(100)`
- `size_bytes bigint`
- `width integer`、`height integer`（可选，无法解析时为空）
- `alt text`
- `tags jsonb`
- `status varchar(20)`：`active` / `archived`
- `created_at`、`updated_at`

文章关联首版增加 `cover_asset_id uuid`；正文图片仍保留 HTML URL，后续再增加关联表和批量替换工具。候选池增加 `cover_asset_id uuid`，接受候选时复制到文章。

## API

```text
GET    /api/v1/media/assets
POST   /api/v1/media/assets              multipart/form-data
GET    /api/v1/media/assets/:id
PATCH  /api/v1/media/assets/:id          标签、alt、状态
DELETE /api/v1/media/assets/:id          软删除/归档
GET    /media/assets/:id/content         图片内容读取
```

权限：

- 列表、详情和内容读取：`media:read`
- 上传和修改：`media:write`
- 删除/归档：`media:delete`

## 文件安全

- 只接受允许的图片 MIME 和扩展名，大小限制 10 MB。
- 文件名不直接作为存储路径；使用 UUID + 可信扩展名生成 `storage_key`。
- 所有路径通过 `path.resolve(MEDIA_ROOT, storage_key)` 校验，拒绝路径穿越。
- 上传写入临时文件后再原子移动到目标路径，避免半文件可见。
- 图片内容读取不执行任何脚本，响应设置正确的 `Content-Type` 和缓存策略。
- 删除素材只更新数据库状态；物理删除由后续清理任务负责。

## 与微信公众号的衔接

- 文章关联 `cover_asset_id` 时，微信适配器通过素材服务读取本地文件并上传为微信封面素材。
- 没有关联素材时兼容现有公网 `coverUrl`/`images[0]` 流程。
- 本地素材上传微信失败只影响草稿任务，不回滚文章或素材库记录。
- 复制文章到公众号时，正文中的远程图片仍按当前 HTML 复制策略处理；首版不自动将正文远程图批量转入素材库。

## Docker 与运维

- 增加 `MEDIA_ROOT` 环境变量，默认 `/app/data/media`（本地开发可为 `./data/media`）。
- Compose 增加 `media_data:/app/data/media` volume。
- 备份文档同时说明 PostgreSQL 和 `media_data` 的备份/恢复。
- 不把 `data/media` 纳入 Git。

## 兼容与回滚

- `coverUrl` 保留，历史文章无需迁移即可继续读取。
- 新迁移只增加可空字段和素材表，不删除已有图片字段。
- 回滚应用版本时保留素材 volume 和数据库表，旧版本忽略新增字段即可运行。
