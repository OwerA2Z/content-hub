import { Card as AntCard } from "antd";
import type * as React from "react";

/** 复用现有组合式 Card API，底层视觉组件改由 Ant Design 提供。 */
export function Card({ className, children, styles, ...props }: React.ComponentProps<typeof AntCard>) {
  return <AntCard className={className} styles={{ body: { padding: "24px 0", display: "flex", flexDirection: "column", gap: 24 }, ...styles }} {...props}>{children}</AntCard>;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={`grid gap-1.5 px-6 ${className ?? ""}`} {...props} />; }
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={`font-semibold leading-none tracking-tight ${className ?? ""}`} {...props} />; }
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={`text-sm text-muted-foreground ${className ?? ""}`} {...props} />; }
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={`px-6 ${className ?? ""}`} {...props} />; }
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={`flex items-center px-6 ${className ?? ""}`} {...props} />; }
