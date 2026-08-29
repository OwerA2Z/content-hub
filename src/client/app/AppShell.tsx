import { useState } from "react";
import { Breadcrumb, Button, Drawer, Flex, Grid, Layout, Menu, Space, Typography } from "antd";
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
const menuItems = [
  navItems.find((item) => item.key === "dashboard")!,
  { type: "group" as const, label: "内容管理", children: navItems.filter((item) => ["articles", "planning", "candidates", "media"].includes(item.key)) },
  { type: "group" as const, label: "系统管理", children: navItems.filter((item) => ["api", "tokens", "channels"].includes(item.key)) },
];

export function AppShell({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState<PageId>("dashboard");
  const [articleToOpen, setArticleToOpen] = useState<string>();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // 侧栏状态同时服务桌面手动折叠和 Ant Design 的响应式断点切换。
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const screens = Grid.useBreakpoint();
  const title = navItems.find((item) => item.key === page)?.label ?? "工作台";
  const section = page === "dashboard" ? "工作台" : ["articles", "planning", "candidates", "media"].includes(page) ? "内容管理" : "系统管理";
  // 工作台本身就是根级页面，面包屑只保留根节点和当前页，避免重复显示“工作台”。
  const breadcrumbItems = page === "dashboard" ? [{ title: "内容中台" }, { title }] : [{ title: "内容中台" }, { title: section }, { title }];
  const navigate = (next: PageId) => { setPage(next); setMobileNavOpen(false); };
  const openArticles = (articleId?: string) => { setArticleToOpen(articleId); navigate("articles"); };
  const handleLogout = () => { setMobileNavOpen(false); onLogout(); };

  const desktopMenu = (
    <Menu
      mode="inline"
      theme="dark"
      selectedKeys={[page]}
      items={menuItems}
      onClick={({ key }) => navigate(key as PageId)}
      style={{ flex: 1, borderRight: 0, overflowY: "auto" }}
    />
  );

  // 移动端 Drawer 使用亮色菜单，消除白底黑菜单视觉断层。
  const mobileMenu = (
    <Flex vertical style={{ height: "100%", justifyContent: "space-between" }}>
      <Menu
        mode="inline"
        theme="light"
        selectedKeys={[page]}
        items={menuItems}
        onClick={({ key }) => navigate(key as PageId)}
        style={{ flex: 1, borderRight: 0 }}
      />
      <div style={{ padding: "12px 16px", borderTop: "1px solid #f0f0f0" }}>
        <Button type="text" danger icon={<LogOut size={17} />} onClick={handleLogout} block style={{ textAlign: "left" }}>
          退出登录
        </Button>
      </div>
    </Flex>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider
        theme="dark"
        width={240}
        breakpoint="md"
        collapsedWidth={0}
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 100,
          boxShadow: "2px 0 8px 0 rgba(29,35,41,.05)",
        }}
      >
        <Flex vertical style={{ height: "100%", justifyContent: "space-between" }}>
          <div>
            <Space align="center" size={12} style={{ padding: "18px 20px" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#1677ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: 16,
                }}
              >
                文
              </div>
              {!sidebarCollapsed && (
                <Typography.Text strong style={{ color: "#fff", fontSize: 16 }}>
                  内容中台
                </Typography.Text>
              )}
            </Space>
            {desktopMenu}
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <Button
              type="text"
              icon={<LogOut size={17} />}
              onClick={handleLogout}
              block
              style={{
                color: "rgba(255, 255, 255, 0.75)",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                padding: "8px 12px",
              }}
            >
              {!sidebarCollapsed && "退出登录"}
            </Button>
          </div>
        </Flex>
      </Layout.Sider>
      <Layout>
        <Layout.Header
          style={{
            background: "#fff",
            padding: "0 24px",
            height: 64,
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <Flex align="center" justify="space-between" style={{ width: "100%" }}>
            <Space align="center" size={14}>
              {!screens.md && (
                <Button type="text" icon={<MenuIcon size={20} />} aria-label="打开导航" onClick={() => setMobileNavOpen(true)} />
              )}
              {screens.md && (
                <Button
                  type="text"
                  icon={sidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
                  aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
                  onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                />
              )}
              <Flex vertical justify="center" gap={2}>
                <Breadcrumb items={breadcrumbItems} style={{ fontSize: 12 }} />
                <Typography.Title level={4} style={{ margin: 0, lineHeight: 1.2 }}>
                  {title}
                </Typography.Title>
              </Flex>
            </Space>
            <Typography.Text type="success" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#52c41a", display: "inline-block" }} />
              系统运行正常
            </Typography.Text>
          </Flex>
        </Layout.Header>
        <Layout.Content style={{ padding: "20px 24px", background: "#f5f7fa", minHeight: "calc(100vh - 64px)" }}>
          {page === "dashboard" ? (
            <DashboardPage onOpenArticles={openArticles} />
          ) : page === "articles" ? (
            <ArticlesPage initialArticleId={articleToOpen} onInitialArticleOpened={() => setArticleToOpen(undefined)} />
          ) : page === "planning" ? (
            <PlanningPage />
          ) : page === "candidates" ? (
            <CandidatePoolPage />
          ) : page === "media" ? (
            <MediaLibraryPage />
          ) : page === "api" ? (
            <ApiCenterPage onOpenTokens={() => navigate("tokens")} />
          ) : page === "tokens" ? (
            <TokenManagementPage />
          ) : (
            <ChannelSettingsPage />
          )}
        </Layout.Content>
      </Layout>
      <Drawer
        title="导航菜单"
        placement="left"
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        {mobileMenu}
      </Drawer>
    </Layout>
  );
}
