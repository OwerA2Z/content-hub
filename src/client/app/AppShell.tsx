import { useState } from "react";
import { FileText, LayoutDashboard, ListTodo, Menu, Radio, TerminalSquare, X } from "lucide-react";
import { markClass, eyebrowClass } from "../components/ui";
import { ApiCenterPage } from "../features/api-center/ApiCenterPage";
import { ArticlesPage } from "../features/articles/ArticlesPage";
import { ChannelSettingsPage } from "../features/channels/ChannelSettingsPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { PlanningPage } from "../features/planning/PlanningPage";

type PageId = "dashboard" | "articles" | "planning" | "api" | "channels";

const navItems = [{ id: "dashboard", label: "工作台", icon: LayoutDashboard }, { id: "articles", label: "文章管理", icon: FileText }, { id: "planning", label: "内容规划", icon: ListTodo }, { id: "api", label: "API 中心", icon: TerminalSquare }, { id: "channels", label: "微信公众号", icon: Radio }] as const;

export function AppShell({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState<PageId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [articleToOpen, setArticleToOpen] = useState<string>();
  const navigate = (next: PageId) => { setPage(next); setSidebarOpen(false); };
  const openArticles = (articleId?: string) => { setArticleToOpen(articleId); navigate("articles"); };
  const navClass = (active: boolean) => `flex w-full cursor-pointer items-center gap-3 rounded-[10px] border-0 px-3.5 py-3 text-left text-[14px] transition-colors ${active ? "bg-[#294038] text-[#f3faef]" : "bg-transparent text-[#a9bbb0] hover:bg-[#294038] hover:text-[#f3faef]"}`;

  return <div className="flex min-h-screen"><aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-brand-deep px-[18px] py-7 text-[#dce8df] transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}><div className="flex items-center justify-between px-3 pb-[42px]"><div className="flex items-center gap-[11px] text-[18px] font-bold tracking-[-.02em]"><span className={markClass}>文</span><span>内容中台</span></div><button aria-label="关闭导航" className="cursor-pointer border-0 bg-transparent text-[#a9bbb0] lg:hidden" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div><nav className="grid gap-1.5">{navItems.map(({ id, label, icon: Icon }) => <button className={navClass(page === id)} key={id} onClick={() => navigate(id)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></button>)}</nav><div className="mt-auto p-3 text-[12px] text-[#789087]">通用渠道架构 · v0.2</div></aside>{sidebarOpen && <button aria-label="关闭导航遮罩" className="fixed inset-0 z-30 cursor-pointer border-0 bg-slate-950/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}<main className="min-w-0 flex-1"><header className="flex min-h-28 items-center justify-between border-b border-border-soft bg-white/55 px-[5vw] py-6"><div className="flex items-center gap-3"><button aria-label="打开导航" className="cursor-pointer border-0 bg-transparent text-[#52665b] lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button><div><p className={eyebrowClass}>CONTENT OPERATIONS</p><h1 className="mt-1 text-[30px] tracking-[-.05em]">{page === "api" ? "API 中心" : page === "channels" ? "微信公众号" : page === "planning" ? "内容规划" : page === "articles" ? "文章管理" : "工作台"}</h1></div></div><div className="text-[13px] text-[#64756e]"><span className="mr-1.5 inline-block size-2 rounded-full bg-[#76bd4e]" /><span className="hidden sm:inline">系统运行正常</span><button className="ml-3 cursor-pointer rounded-lg border-0 bg-[#edf4e8] px-2.5 py-1.5 text-[12px] text-[#5d7469]" onClick={onLogout}>退出</button></div></header><section className="mx-auto max-w-[1240px] px-[5vw] pb-[60px] pt-[38px]">{page === "dashboard" ? <DashboardPage onOpenArticles={openArticles} /> : page === "articles" ? <ArticlesPage initialArticleId={articleToOpen} onInitialArticleOpened={() => setArticleToOpen(undefined)} /> : page === "planning" ? <PlanningPage /> : page === "api" ? <ApiCenterPage /> : <ChannelSettingsPage />}</section></main></div>;
}
