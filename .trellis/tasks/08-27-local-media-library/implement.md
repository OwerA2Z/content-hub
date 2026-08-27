# 本地化图片素材库实施计划

1. 新增 `media_assets` 迁移、`cover_asset_id` 字段和共享素材类型/校验。
2. 实现本地文件存储服务，包含 MIME、大小、路径和原子写入校验。
3. 实现素材仓储和 `/api/v1/media/assets` 路由，接入 Scope 权限。
4. 更新文章/候选池模型与服务，使封面素材可以关联和读取。
5. 更新微信公众号适配器，优先读取本地素材文件上传封面。
6. 在 shadcn-admin 前端新增“素材库”菜单、网格预览、上传、搜索、标签和归档操作。
7. 在文章详情和候选预览中增加素材选择入口与封面状态提示。
8. 更新 Docker Compose、环境变量、部署/后台/AI 文档。
9. 增加仓储、文件安全、接口权限、文章关联和重启持久化测试。
10. 执行：

```text
npm run typecheck
npm test
npm run build
git diff --check
```

验证结果（2026-08-27）：`npm run typecheck`、`npm test`（24 passed）、`npm run build` 和 `git diff --check` 全部通过。
