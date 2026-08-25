import type { ReactNode } from "react";
import { eyebrowClass, inputClass, markClass } from "../../components/ui";

export function AuthShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_right,#e6f0d6,#f5f7f2_48%)] p-6"><section className="w-full max-w-[390px] rounded-[22px] border border-border-soft bg-white p-[34px] shadow-[0_20px_70px_rgba(35,57,43,.08)]"><div className="mb-10 flex items-center gap-[11px] text-[18px] font-bold text-[#29453a]"><span className={markClass}>文</span><span>内容中台</span></div><p className={eyebrowClass}>{eyebrow}</p><h1 className="mb-[26px] mt-2 text-[32px] tracking-[-.06em]">{title}</h1>{children}</section></div>;
}

export function AuthInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="my-4 grid gap-2 text-[13px] text-[#53665d]">{label}<input className={inputClass} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function ErrorText({ text }: { text: string }) {
  return text ? <p className="text-[13px] text-[#b35c4d]">{text}</p> : null;
}
