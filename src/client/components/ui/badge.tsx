import { Tag } from "antd";
import type * as React from "react";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";
type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant };

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  const color = variant === "destructive" ? "error" : variant === "secondary" ? "blue" : variant === "default" ? "green" : undefined;
  return <Tag color={color} className={className} {...props} />;
}
