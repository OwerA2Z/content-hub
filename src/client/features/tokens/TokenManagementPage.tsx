import { useEffect, useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { adminTokenApi } from "../../lib/api/admin-tokens";
import type { TokenInfo } from "../../lib/api/types";
import { TOKEN_SCOPES, TOKEN_SCOPE_LABELS, type TokenScope } from "../../lib/api/types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

export function TokenManagementPage() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]); const [name, setName] = useState(""); const [scopes, setScopes] = useState<TokenScope[]>(["articles:read"]); const [secret, setSecret] = useState(""); const [notice, setNotice] = useState("");
  const load = () => adminTokenApi.list().then((result) => setTokens(result.data)).catch(() => setNotice("加载 Token 失败"));
  useEffect(() => { load(); }, []);
  const toggleScope = (scope: TokenScope) => setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  const create = () => adminTokenApi.create(name, scopes).then((result) => { setSecret(result.data.secret); setName(""); setNotice("Token 已生成，请立即复制保存"); load(); }).catch(() => setNotice("生成 Token 失败"));
  const revoke = (id: string) => adminTokenApi.revoke(id).then(() => { setNotice("Token 已撤销"); load(); }).catch(() => setNotice("撤销 Token 失败"));
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">ACCESS CONTROL</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Token 管理</h2><p className="mt-2 text-sm text-muted-foreground">按权限 Scope 创建和撤销外部系统访问凭证。</p></div><div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound size={18} />创建 Token</CardTitle></CardHeader><CardContent className="space-y-5"><Input placeholder="Token 名称" value={name} onChange={(event) => setName(event.target.value)} /><div><p className="mb-3 text-sm font-medium">选择权限</p><div className="grid gap-3 sm:grid-cols-2">{TOKEN_SCOPES.map((scope) => <label className="flex items-center gap-2 text-sm text-muted-foreground" key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />{TOKEN_SCOPE_LABELS[scope]}</label>)}</div></div><Button className="w-full" disabled={!name.trim() || scopes.length === 0} onClick={create}><Plus size={16} />生成 Token</Button>{secret && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><strong className="block">Token 明文只显示一次</strong><code className="mt-2 block break-all">{secret}</code></div>}</CardContent></Card><Card><CardHeader><CardTitle>已创建 Token</CardTitle></CardHeader><CardContent><div className="divide-y">{tokens.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">暂无 Token</p> : tokens.map((token) => <div className="flex flex-wrap items-center justify-between gap-4 py-4" key={token.id}><div className="min-w-0"><p className="font-medium">{token.name}</p><div className="mt-2 flex flex-wrap gap-1.5">{token.scopes.map((scope) => <Badge variant="secondary" key={scope}>{scope}</Badge>)}</div><p className="mt-2 text-xs text-muted-foreground">前缀 {token.prefix} · 创建于 {new Date(token.createdAt).toLocaleString("zh-CN")}</p></div>{token.revokedAt ? <Badge variant="outline">已撤销</Badge> : <Button variant="destructive" size="sm" onClick={() => revoke(token.id)}>撤销</Button>}</div>)}</div>{notice && <p className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">{notice}</p>}</CardContent></Card></div></div>;
}
