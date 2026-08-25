import { useEffect, useState } from "react";
import { ArrowUpRight, TerminalSquare } from "lucide-react";
import { integrationApi } from "../../lib/api/integrations";
import type { AiIntegration } from "../../lib/api/types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export function ApiCenterPage({ onOpenTokens }: { onOpenTokens: () => void }) {
  const [integration, setIntegration] = useState<AiIntegration>(); const [notice, setNotice] = useState("");
  useEffect(() => { integrationApi.getAi().then((result) => setIntegration(result.data)).catch(() => setNotice("加载 API 信息失败")); }, []);
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">DEVELOPER CENTER</p><h2 className="mt-2 text-3xl font-bold tracking-tight">API 中心</h2><p className="mt-2 text-sm text-muted-foreground">查看 API 地址和接口目录，Token 权限请前往独立的 Token 管理。</p></div><Button variant="outline" onClick={onOpenTokens}><ArrowUpRight size={16} />管理 Token</Button></div><Card><CardHeader><CardTitle className="flex items-center gap-2"><TerminalSquare size={18} />API Base URL</CardTitle><CardDescription>外部 AI 和内容管道使用此地址访问平台接口。</CardDescription></CardHeader><CardContent><code className="block break-all rounded-md bg-muted p-3 text-sm">{integration?.baseUrl || "正在加载…"}</code></CardContent></Card><Card><CardHeader><CardTitle>接口目录</CardTitle><CardDescription>接口权限由 Token scopes 控制，请只授予调用方需要的最小权限。</CardDescription></CardHeader><CardContent><div className="divide-y">{integration && Object.entries(integration.endpoints).map(([key, url]) => <div className="flex items-start justify-between gap-4 py-4" key={key}><div><p className="font-medium">{key}</p><code className="mt-1 block break-all text-xs text-muted-foreground">{url}</code></div><Badge variant="outline">API</Badge></div>)}</div>{notice && <p className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">{notice}</p>}</CardContent></Card></div>;
}
