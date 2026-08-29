import { useEffect, useState } from "react";
import { Check, KeyRound, Pencil, Plus, X } from "lucide-react";
import { adminTokenApi } from "../../lib/api/admin-tokens";
import type { TokenInfo } from "../../lib/api/types";
import { TOKEN_SCOPES, TOKEN_SCOPE_LABELS, type TokenScope } from "../../lib/api/types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

function ScopeCheckboxes({ scopes, onToggle }: { scopes: TokenScope[]; onToggle: (scope: TokenScope) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    {TOKEN_SCOPES.map((scope) => <label className="flex items-center gap-2 text-sm text-muted-foreground" key={scope}>
      <input type="checkbox" checked={scopes.includes(scope)} onChange={() => onToggle(scope)} />
      {TOKEN_SCOPE_LABELS[scope]}
    </label>)}
  </div>;
}

export function TokenManagementPage() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<TokenScope[]>(["articles:read"]);
  const [editingId, setEditingId] = useState<string>();
  const [editingScopes, setEditingScopes] = useState<TokenScope[]>([]);
  const [secret, setSecret] = useState("");
  const [notice, setNotice] = useState("");

  const load = () => adminTokenApi.list().then((result) => setTokens(result.data)).catch(() => setNotice("加载 Token 失败"));
  useEffect(() => { void load(); }, []);

  const toggleScope = (scope: TokenScope) => setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  const toggleEditingScope = (scope: TokenScope) => setEditingScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  const create = () => adminTokenApi.create(name, scopes).then((result) => {
    setSecret(result.data.secret);
    setName("");
    setNotice("Token 已生成，请立即复制保存");
    return load();
  }).catch(() => setNotice("生成 Token 失败"));
  const revoke = (id: string) => adminTokenApi.revoke(id).then(() => {
    if (editingId === id) cancelEditing();
    setNotice("Token 已撤销");
    return load();
  }).catch(() => setNotice("撤销 Token 失败"));
  const startEditing = (token: TokenInfo) => {
    // 编辑态使用独立数组，避免勾选过程中直接修改列表里的 Token 数据。
    setEditingId(token.id);
    setEditingScopes([...token.scopes]);
  };
  const cancelEditing = () => {
    setEditingId(undefined);
    setEditingScopes([]);
  };
  const saveScopes = (id: string) => adminTokenApi.updateScopes(id, editingScopes).then(() => {
    cancelEditing();
    setNotice("Token 权限已更新");
    return load();
  }).catch(() => setNotice("更新 Token 权限失败"));

  return <div className="space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">ACCESS CONTROL</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Token 管理</h2><p className="mt-2 text-sm text-muted-foreground">按权限 Scope 创建、编辑和撤销外部系统访问凭证。</p></div>
    <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound size={18} />创建 Token</CardTitle></CardHeader><CardContent className="space-y-5">
        <Input placeholder="Token 名称" value={name} onChange={(event) => setName(event.target.value)} />
        <div><p className="mb-3 text-sm font-medium">选择权限</p><ScopeCheckboxes scopes={scopes} onToggle={toggleScope} /></div>
        <Button className="w-full" disabled={!name.trim() || scopes.length === 0} onClick={() => void create()}><Plus size={16} />生成 Token</Button>
        {secret && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><strong className="block">Token 明文只显示一次</strong><code className="mt-2 block break-all">{secret}</code></div>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>已创建 Token</CardTitle></CardHeader><CardContent><div className="divide-y">
        {tokens.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">暂无 Token</p> : tokens.map((token) => <div className="py-4" key={token.id}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0"><p className="font-medium">{token.name}</p><div className="mt-2 flex flex-wrap gap-1.5">{token.scopes.map((scope) => <Badge variant="secondary" key={scope}>{scope}</Badge>)}</div><p className="mt-2 text-xs text-muted-foreground">前缀 {token.prefix} · 创建于 {new Date(token.createdAt).toLocaleString("zh-CN")}</p></div>
            {token.revokedAt ? <Badge variant="outline">已撤销</Badge> : <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => startEditing(token)}><Pencil size={14} />编辑权限</Button><Button variant="destructive" size="sm" onClick={() => void revoke(token.id)}>撤销</Button></div>}
          </div>
          {editingId === token.id && <div className="mt-4 space-y-4 rounded-md border bg-muted/30 p-4"><p className="text-sm font-medium">编辑权限</p><ScopeCheckboxes scopes={editingScopes} onToggle={toggleEditingScope} /><div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={cancelEditing}><X size={14} />取消</Button><Button size="sm" disabled={editingScopes.length === 0} onClick={() => void saveScopes(token.id)}><Check size={14} />保存</Button></div></div>}
        </div>)}
      </div>{notice && <p className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">{notice}</p>}</CardContent></Card>
    </div>
  </div>;
}
