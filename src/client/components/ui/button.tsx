import { Button as AntButton } from "antd";
import type { ButtonHTMLType, ButtonProps as AntButtonProps } from "antd/es/button";

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

type ButtonProps = Omit<AntButtonProps, "type" | "size" | "danger" | "htmlType" | "variant"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 保留旧页面的 asChild 参数，当前页面均以按钮形式使用。 */
  asChild?: boolean;
  htmlType?: ButtonHTMLType;
  /** 兼容原生 button 的 type 属性（主要用于表单内的取消按钮）。 */
  type?: ButtonHTMLType;
};

/** 统一把旧 Button API 映射到 Ant Design，避免业务页面同时维护两套按钮样式。 */
export function Button({ variant = "default", size = "default", asChild: _asChild, type: nativeType, htmlType = nativeType ?? "submit", ...props }: ButtonProps) {
  const buttonType = variant === "link" ? "link" : variant === "ghost" ? "text" : variant === "default" ? "primary" : "default";
  const antSize = size === "sm" ? "small" : size === "lg" ? "large" : "middle";
  const danger = variant === "destructive";
  const variantClass = variant === "secondary" ? "app-button-secondary" : variant === "outline" ? "app-button-outline" : undefined;
  return <AntButton {...props} className={[variantClass, props.className].filter(Boolean).join(" ")} type={buttonType} size={antSize} shape={size === "icon" ? "circle" : undefined} danger={danger} htmlType={htmlType} />;
}
