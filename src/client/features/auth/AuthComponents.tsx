import type { ReactNode } from "react";
import { eyebrowClass, markClass } from "../../components/ui";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

export function AuthShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-background p-6"><Card className="w-full max-w-[390px] gap-0 p-0 shadow-xl"><CardContent className="p-8"><div className="mb-10 flex items-center gap-3 text-lg font-semibold"><span className={markClass}>文</span><span>内容中台</span></div><p className={eyebrowClass}>{eyebrow}</p><h1 className="mb-7 mt-2 text-3xl font-semibold tracking-tight">{title}</h1>{children}</CardContent></Card></div>;
}

export function AuthInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="my-4 grid gap-2 text-sm text-muted-foreground">{label}<Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function ErrorText({ text }: { text: string }) {
  return text ? <p className="text-[13px] text-[#b35c4d]">{text}</p> : null;
}
