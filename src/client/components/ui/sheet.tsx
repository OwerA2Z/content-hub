import { Drawer } from "antd";
import * as React from "react";

type SheetContextValue = { open: boolean; onOpenChange?: (open: boolean) => void };
const SheetContext = React.createContext<SheetContextValue | undefined>(undefined);

type SheetContentProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "right" | "bottom" | "left";
  /** AntD Drawer 的实际宽度；未传时沿用原 Sheet 的响应式约束。 */
  width?: number | string;
};

/** 以 Ant Design Drawer 兼容现有 Sheet 组合式调用方式。 */
export function Sheet({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) {
  return <SheetContext.Provider value={{ open: Boolean(open), onOpenChange }}>{children}</SheetContext.Provider>;
}

export function SheetContent({ children, side = "right", className, width, ...props }: SheetContentProps) {
  const sheet = React.useContext(SheetContext);
  const placement = side === "left" ? "left" : side === "top" ? "top" : side === "bottom" ? "bottom" : "right";
  // 原 Sheet 通过 `sm:max-w-2xl` 控制桌面宽度，AntD Drawer 不会解析该 class，
  // 因此显式映射为 CSS width；移动端仍保持 100vw，桌面端约 672px。
  const drawerWidth = width ?? ((placement === "left" || placement === "right") ? "min(100vw, 672px)" : undefined);
  return <Drawer open={sheet?.open} onClose={() => sheet?.onOpenChange?.(false)} placement={placement} width={drawerWidth} className={className} classNames={{ body: className }} {...props}>{children}</Drawer>;
}

export const SheetTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SheetClose = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={className} {...props} />;
export const SheetTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className={className} {...props} />;
export const SheetDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={className} {...props} />;
