import { useState } from "react";
import { Button, Drawer, Layout, Menu, Typography } from "antd";
import { FileText, Image, KeyRound, LayoutDashboard, ListTodo, LogOut, Menu as MenuIcon, PanelLeft, PanelLeftClose, Radio, Sparkles, TerminalSquare } from "lucide-react";
import { ApiCenterPage } from "../features/api-center/ApiCenterPage";
import { ArticlesPage } from "../features/articles/ArticlesPage";
import { ChannelSettingsPage } from "../features/channels/ChannelSettingsPage";
import { CandidatePoolPage } from "../features/candidates/CandidatePoolPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { PlanningPage } from "../features/planning/PlanningPage";
import { TokenManagementPage } from "../features/tokens/TokenManagementPage";
import { MediaLibraryPage } from "../features/media/MediaLibraryPage";

type PageId = "dashboard" | "articles" | "planning" | "candidates" | "media" | "api" | "tokens" | "channels";
const navItems = [
  { key: "dashboard", label: "工作台", icon: <LayoutDashboard size={17} /> },
  { key: "articles", label: "文章管理", icon: <FileText size={17} /> },
  { key: "planning", label: "内容规划", icon: <ListTodo size={17} /> },
  { key: "candidates", label: "内容池", icon: <Sparkles size={17} /> },
  { key: "media", label: "素材库", icon: <Image size={17} /> },
  { key: "api", label: "API 中心", icon: <TerminalSquare size={17} /> },
  { key: "tokens", label: "Token 管理", icon: <KeyRound size={17} /> },
  { key: "channels", label: "微信公众号", icon: <Radio size={17} /> },
] satisfies { key: PageId; label: string; icon: React.ReactNode }[];

export function AppShell({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState<PageId>("dashboard");
  const [articleToOpen, setArticleToOpen] = useState<string>();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // 侧栏状态同时服务桌面手动折叠和 Ant Design 的响应式断点切换。
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const title = navItems.find((item) => item.key === page)?.label ?? "工作台";
  const navigate = (next: PageId) => { setPage(next); setMobileNavOpen(false); };
  const openArticles = (articleId?: string) => { setArticleToOpen(articleId); navigate("articles"); };
  const handleLogout = () => { setMobileNavOpen(false); onLogout(); };
  const menu = <Menu mode="inline" theme="dark" selectedKeys={[page]} items={navItems} onClick={({ key }) => navigate(key as PageId)} />;
  // 移动端 Drawer 复用同一份菜单，并补齐桌面侧栏页脚中的退出操作。
  const mobileMenu = <div className="app-mobile-nav">{menu}<div className="app-mobile-nav__footer"><Button type="text" icon={<LogOut size={17} />} onClick={handleLogout} block>退出登录</Button></div></div>;

  return <Layout className="app-shell">
    <Layout.Sider className="app-sider" width={240} breakpoint="md" collapsedWidth={0} trigger={null} collapsible collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed}>
      <div className="app-sider__header"><div className="app-brand"><span className="app-brand-mark">文</span>{!sidebarCollapsed && <span>内容中台</span>}</div></div>
      <div className="app-sider__content">{menu}</div>
      <div className="app-sider__footer"><Button type="text" icon={<LogOut size={17} />} onClick={handleLogout} block>{!sidebarCollapsed && "退出登录"}</Button></div>
    </Layout.Sider>
    <Layout>
      <header className="app-header"><div className="app-header__left"><Button className="app-header__menu-button" type="text" icon={<MenuIcon size={20} />} aria-label="打开导航" onClick={() => setMobileNavOpen(true)} /><Button className="app-header__collapse-button" type="text" icon={sidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />} aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"} onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} /><div><Typography.Text className="app-eyebrow">CONTENT OPERATIONS</Typography.Text><Typography.Title level={3} style={{ margin: 4 }}>{title}</Typography.Title></div></div><span className="app-header__status">系统运行正常</span></header>
      <Layout.Content className="app-main"><div className="app-main__inner">{page === "dashboard" ? <DashboardPage onOpenArticles={openArticles} /> : page === "articles" ? <ArticlesPage initialArticleId={articleToOpen} onInitialArticleOpened={() => setArticleToOpen(undefined)} /> : page === "planning" ? <PlanningPage /> : page === "candidates" ? <CandidatePoolPage /> : page === "media" ? <MediaLibraryPage /> : page === "api" ? <ApiCenterPage onOpenTokens={() => navigate("tokens")} /> : page === "tokens" ? <TokenManagementPage /> : <ChannelSettingsPage />}</div></Layout.Content>
    </Layout>
    <Drawer title="导航" placement="left" open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} styles={{ body: { padding: 0 } }}>{mobileMenu}</Drawer>
  </Layout>;
}
