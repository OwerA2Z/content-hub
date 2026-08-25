# 技术设计：TailAdmin 风格后台界面

- `AppShell` 负责 Sidebar、Topbar、Breadcrumb 和页面导航；`App.tsx` 只负责认证门禁。
- `features/` 下按领域拆分 `DashboardPage`、`ArticlesPage`、`PlanningPage`、`ApiCenterPage`、`ChannelSettingsPage`。
- `lib/api/` 按认证、文章、规划和集成拆分接口，`lib/api.ts` 仅保留兼容门面。
- 组件状态统一采用 Tailwind token、lucide-react 图标和语义按钮样式。
- 文章详情使用右侧 Drawer，避免列表和预览同时挤压主内容区。
- 后端 `routes/` 只处理 HTTP 边界，`services/` 负责文章上传和微信公众号异步操作，`app.ts` 仅负责应用装配。
