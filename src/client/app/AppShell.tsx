import { useState } from "react";
import { FileText, KeyRound, LayoutDashboard, ListTodo, LogOut, Radio, Sparkles, TerminalSquare } from "lucide-react";
import { markClass, eyebrowClass } from "../components/ui";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "../components/ui/sidebar";
import { ApiCenterPage } from "../features/api-center/ApiCenterPage";
import { ArticlesPage } from "../features/articles/ArticlesPage";
import { ChannelSettingsPage } from "../features/channels/ChannelSettingsPage";
import { CandidatePoolPage } from "../features/candidates/CandidatePoolPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { PlanningPage } from "../features/planning/PlanningPage";
import { TokenManagementPage } from "../features/tokens/TokenManagementPage";

type PageId = "dashboard" | "articles" | "planning" | "candidates" | "api" | "tokens" | "channels";
const navItems = [{ id: "dashboard", label: "工作台", icon: LayoutDashboard }, { id: "articles", label: "文章管理", icon: FileText }, { id: "planning", label: "内容规划", icon: ListTodo }, { id: "candidates", label: "内容池", icon: Sparkles }, { id: "api", label: "API 中心", icon: TerminalSquare }, { id: "tokens", label: "Token 管理", icon: KeyRound }, { id: "channels", label: "微信公众号", icon: Radio }] as const;

export function AppShell({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState<PageId>("dashboard");
  const [articleToOpen, setArticleToOpen] = useState<string>();
  const navigate = (next: PageId) => { setPage(next); };
  const openArticles = (articleId?: string) => { setArticleToOpen(articleId); navigate("articles"); };
  const title = page === "api" ? "API 中心" : page === "tokens" ? "Token 管理" : page === "channels" ? "微信公众号" : page === "planning" ? "内容规划" : page === "candidates" ? "内容池" : page === "articles" ? "文章管理" : "工作台";

  return <SidebarProvider><Sidebar><SidebarHeader><div className="flex items-center gap-3"><span className={markClass}>文</span><span className="truncate text-sm font-semibold">内容中台</span></div></SidebarHeader><SidebarContent><SidebarMenu>{navItems.map(({ id, label, icon: Icon }) => <SidebarMenuItem key={id}><SidebarMenuButton active={page === id} title={label} onClick={() => navigate(id)}><Icon size={17} /><span>{label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent><SidebarFooter><SidebarMenu><SidebarMenuItem><SidebarMenuButton title="退出登录" onClick={onLogout}><LogOut size={17} /><span>退出登录</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter></Sidebar><div className="flex min-w-0 flex-1 flex-col"><header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:px-6"><div className="flex items-center gap-3"><SidebarTrigger /><div><p className={eyebrowClass}>CONTENT OPERATIONS</p><h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1></div></div><div className="text-xs text-muted-foreground md:text-sm"><span className="mr-1.5 inline-block size-2 rounded-full bg-emerald-500" />系统运行正常</div></header><main className="min-w-0 flex-1 px-4 py-6 md:px-6"><div className="mx-auto w-full max-w-7xl">{page === "dashboard" ? <DashboardPage onOpenArticles={openArticles} /> : page === "articles" ? <ArticlesPage initialArticleId={articleToOpen} onInitialArticleOpened={() => setArticleToOpen(undefined)} /> : page === "planning" ? <PlanningPage /> : page === "candidates" ? <CandidatePoolPage /> : page === "api" ? <ApiCenterPage onOpenTokens={() => navigate("tokens")} /> : page === "tokens" ? <TokenManagementPage /> : <ChannelSettingsPage />}</div></main></div></SidebarProvider>;
}
