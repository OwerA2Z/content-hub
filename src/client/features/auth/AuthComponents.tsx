import type { ReactNode } from "react";
import { Card, Input, Typography } from "antd";

export function AuthShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <div className="app-auth-page"><Card className="app-auth-card"><div className="app-auth-brand"><span className="app-brand-mark">文</span><span>内容中台</span></div><Typography.Text className="app-eyebrow">{eyebrow}</Typography.Text><Typography.Title level={1} className="app-auth-title">{title}</Typography.Title>{children}</Card></div>;
}

export function AuthInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="app-field-stack"><span className="app-field-label">{label}</span><Input size="large" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function ErrorText({ text }: { text: string }) {
  return text ? <div className="app-auth-error" role="alert">{text}</div> : null;
}
