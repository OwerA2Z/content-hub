import * as React from "react";
import { Menu, PanelLeft } from "lucide-react";
import { Button } from "./button";
import { Sheet, SheetContent } from "./sheet";
import { cn } from "../../lib/utils";

type SidebarContextValue = { open: boolean; setOpen: (open: boolean) => void; mobileOpen: boolean; setMobileOpen: (open: boolean) => void; };
const SidebarContext = React.createContext<SidebarContextValue | null>(null);
function useSidebar() { const value = React.useContext(SidebarContext); if (!value) throw new Error("Sidebar components must be inside SidebarProvider"); return value; }
export function SidebarProvider({ children, defaultOpen = true }: { children: React.ReactNode; defaultOpen?: boolean }) { const [open, setOpen] = React.useState(defaultOpen); const [mobileOpen, setMobileOpen] = React.useState(false); return <SidebarContext.Provider value={{ open, setOpen, mobileOpen, setMobileOpen }}><div className="flex min-h-svh w-full">{children}</div></SidebarContext.Provider>; }
export function Sidebar({ children }: { children: React.ReactNode }) { const { open, mobileOpen, setMobileOpen } = useSidebar(); return <><aside className={cn("hidden shrink-0 border-r bg-sidebar text-sidebar-foreground transition-[width] md:flex", open ? "w-64" : "w-16")}><div className="flex h-full w-full flex-col">{children}</div></aside><Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground"><div className="flex h-full flex-col">{children}</div></SheetContent></Sheet></>; }
export function SidebarHeader({ children }: { children: React.ReactNode }) { return <div className="flex h-16 items-center border-b px-4">{children}</div>; }
export function SidebarContent({ children }: { children: React.ReactNode }) { return <div className="flex-1 overflow-auto p-3">{children}</div>; }
export function SidebarFooter({ children }: { children: React.ReactNode }) { return <div className="border-t p-3">{children}</div>; }
export function SidebarMenu({ children }: { children: React.ReactNode }) { return <div className="grid gap-1">{children}</div>; }
export function SidebarMenuItem({ children }: { children: React.ReactNode }) { return <div>{children}</div>; }
export function SidebarMenuButton({ active, children, onClick, title }: { active?: boolean; children: React.ReactNode; onClick?: () => void; title?: string }) { const { open } = useSidebar(); return <button title={title} onClick={onClick} className={cn("flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground", !open && "justify-center px-0")}>{children}</button>; }
export function SidebarTrigger({ className }: { className?: string }) { const { open, setOpen, setMobileOpen } = useSidebar(); return <Button variant="ghost" size="icon" className={className} onClick={() => { setOpen(!open); setMobileOpen(true); }}><PanelLeft className="hidden md:block" /><Menu className="md:hidden" /><span className="sr-only">打开导航</span></Button>; }
