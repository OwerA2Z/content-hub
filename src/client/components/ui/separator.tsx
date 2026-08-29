import { Divider } from "antd";
import type * as React from "react";

export function Separator({ className, orientation = "horizontal", ...props }: React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }) {
  return <Divider className={className} type={orientation === "vertical" ? "vertical" : "horizontal"} {...props} />;
}
