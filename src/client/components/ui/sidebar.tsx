import { Button as AntButton, Drawer, Layout } from "antd";
import { Menu, PanelLeft } from "lucide-react";
import * as React from "react";

type SidebarContextValue = { open: boolean; setOpen: (open: boolean) => void; mobileOpen: boolean; setMobileOpen: (open: boolean) => void };
const SidebarContext = React.createContext<SidebarContextValue | null>(null);
function useSidebar() { const value = React.useContext(SidebarContext); if (!value) throw new Error("Sidebar components must be inside SidebarProvider"); return value; }

export function SidebarProvider({ children, defaultOpen = true }: { children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  return <SidebarContext.Provider value={{ open, setOpen, mobileOpen, setMobileOpen }}><Layout className="min-h-svh">{children}</Layout></SidebarContext.Provider>;
}

export function Sidebar({ children }: { children: React.ReactNode }) {
  const { open, mobileOpen, setMobileOpen } = useSidebar();
  return <><Layout.Sider collapsible collapsed={!open} trigger={null} width={256} collapsedWidth={64} className="hidden md:block"><div className="flex h-full flex-col">{children}</div></Layout.Sider><Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} placement="left" width={288} closable={false} styles={{ body: { padding: 0, background: "#182b25" } }}><div className="flex h-full flex-col text-sidebar-foreground">{children}</div></Drawer></>;
}
export function SidebarHeader({ children }: { children: React.ReactNode }) { return <div className="flex h-16 items-center border-b border-white/10 px-4">{children}</div>; }
export function SidebarContent({ children }: { children: React.ReactNode }) { return <div className="flex-1 overflow-auto p-3">{children}</div>; }
export function SidebarFooter({ children }: { children: React.ReactNode }) { return <div className="border-t border-white/10 p-3">{children}</div>; }
export function SidebarMenu({ children }: { children: React.ReactNode }) { return <div className="grid gap-1">{children}</div>; }
export function SidebarMenuItem({ children }: { children: React.ReactNode }) { return <div>{children}</div>; }
export function SidebarMenuButton({ active, children, onClick, title }: { active?: boolean; children: React.ReactNode; onClick?: () => void; title?: string }) {
  const { open, setMobileOpen } = useSidebar();
  return <AntButton type="text" title={title} onClick={() => { onClick?.(); setMobileOpen(false); }} className={`!flex !h-10 !w-full !items-center !justify-start !gap-3 !rounded-md !px-3 !text-left !text-sm !text-sidebar-foreground hover:!bg-white/10 ${active ? "!bg-white/15 !font-medium" : ""} ${!open ? "md:!justify-center md:!px-0" : ""}`}>{children}</AntButton>;
}
export function SidebarTrigger({ className }: { className?: string }) {
  const { open, setOpen, setMobileOpen } = useSidebar();
  return <AntButton type="text" className={`!text-foreground ${className ?? ""}`} onClick={() => {
    setOpen(!open);
    // 桌面端只折叠 Sider，移动端才打开 Drawer，避免桌面点击菜单时出现额外遮罩层。
    if (window.matchMedia("(max-width: 767px)").matches) setMobileOpen(true);
  }} icon={<><PanelLeft className="hidden md:block" /><Menu className="md:hidden" /></>} aria-label="打开导航" />;
}
