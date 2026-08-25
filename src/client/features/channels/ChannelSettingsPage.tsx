import { useEffect, useState } from "react";
import { articleApi } from "../../lib/api/articles";
import type { Capabilities } from "../../lib/api/types";

export function ChannelSettingsPage() {
  const [caps, setCaps] = useState<Capabilities>();
  useEffect(() => { articleApi.capabilities().then((result) => setCaps(result.data)).catch(() => undefined); }, []);
  return <div className="space-y-6"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-brand-strong">CHANNELS</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">微信公众号</h2><p className="mt-2 text-sm text-slate-500">管理公众号连接状态、草稿和发布能力。</p></div><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-4 sm:grid-cols-2"><div className="flex items-center justify-between rounded-xl bg-slate-50 p-5"><span className="text-sm text-slate-600">草稿能力</span><span className={caps?.draft ? "text-sm font-semibold text-emerald-600" : "text-sm font-semibold text-amber-600"}>{caps?.draft ? "已启用" : "未配置"}</span></div><div className="flex items-center justify-between rounded-xl bg-slate-50 p-5"><span className="text-sm text-slate-600">发布能力</span><span className={caps?.publish ? "text-sm font-semibold text-emerald-600" : "text-sm font-semibold text-amber-600"}>{caps?.publish ? "已启用" : "按公众号权限"}</span></div></div><p className="mt-5 text-sm text-slate-500">{caps?.reason || "凭证只保存在服务端；请在部署环境配置微信公众号参数。"}</p></section></div>;
}
