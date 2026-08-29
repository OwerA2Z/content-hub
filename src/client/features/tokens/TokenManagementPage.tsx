import { useEffect, useState } from "react";
import { Alert, Button, Card, Checkbox, Empty, Input, Space, Tag, Typography } from "antd";
import { Check, KeyRound, Pencil, Plus, X } from "lucide-react";
import { adminTokenApi } from "../../lib/api/admin-tokens";
import type { TokenInfo, TokenScope } from "../../lib/api/types";
import { TOKEN_SCOPES, TOKEN_SCOPE_LABELS } from "../../lib/api/types";

function ScopeCheckboxes({ scopes, onToggle }: { scopes: TokenScope[]; onToggle: (scope: TokenScope) => void }) {
  return <div className="app-scope-grid">{TOKEN_SCOPES.map((scope) => <Checkbox className="app-scope-option" checked={scopes.includes(scope)} onChange={() => onToggle(scope)} key={scope}>{TOKEN_SCOPE_LABELS[scope]}</Checkbox>)}</div>;
}

export function TokenManagementPage() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]); const [name, setName] = useState(""); const [scopes, setScopes] = useState<TokenScope[]>(["articles:read"]); const [editingId, setEditingId] = useState<string>(); const [editingScopes, setEditingScopes] = useState<TokenScope[]>([]); const [secret, setSecret] = useState(""); const [notice, setNotice] = useState("");
  const load = () => adminTokenApi.list().then((result) => setTokens(result.data)).catch(() => setNotice("加载 Token 失败"));
  useEffect(() => { void load(); }, []);
  const toggleScope = (scope: TokenScope) => setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  const toggleEditingScope = (scope: TokenScope) => setEditingScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  const create = () => adminTokenApi.create(name, scopes).then((result) => { setSecret(result.data.secret); setName(""); setNotice("Token 已生成，请立即复制保存"); return load(); }).catch(() => setNotice("生成 Token 失败"));
  const revoke = (id: string) => adminTokenApi.revoke(id).then(() => { if (editingId === id) cancelEditing(); setNotice("Token 已撤销"); return load(); }).catch(() => setNotice("撤销 Token 失败"));
  const startEditing = (token: TokenInfo) => { setEditingId(token.id); setEditingScopes([...token.scopes]); };
  const cancelEditing = () => { setEditingId(undefined); setEditingScopes([]); };
  const saveScopes = (id: string) => adminTokenApi.updateScopes(id, editingScopes).then(() => { cancelEditing(); setNotice("Token 权限已更新"); return load(); }).catch(() => setNotice("更新 Token 权限失败"));
  return <div className="app-page"><div><Typography.Text className="app-eyebrow">ACCESS CONTROL</Typography.Text><Typography.Title level={2} className="app-page-title">Token 管理</Typography.Title><Typography.Paragraph className="app-page-description">按权限 Scope 创建、编辑和撤销外部系统访问凭证。</Typography.Paragraph></div><div className="app-grid-token"><Card className="app-panel-card" title={<Space><KeyRound size={18} />创建 Token</Space>}><div className="app-card-stack"><Input placeholder="Token 名称" value={name} onChange={(event) => setName(event.target.value)} /><div><p className="app-field-label">选择权限</p><ScopeCheckboxes scopes={scopes} onToggle={toggleScope} /></div><Button type="primary" block icon={<Plus size={16} />} disabled={!name.trim() || scopes.length === 0} onClick={() => void create()}>生成 Token</Button>{secret && <div className="app-secret"><strong>Token 明文只显示一次</strong><code>{secret}</code></div>}</div></Card><Card className="app-panel-card" title="已创建 Token"><div className="app-token-list">{tokens.length === 0 ? <Empty description="暂无 Token" /> : tokens.map((token) => <div className="app-token" key={token.id}><div className="app-token__row"><div><p className="app-token__name">{token.name}</p><Space wrap style={{ marginTop: 8 }}>{token.scopes.map((scope) => <Tag color="blue" key={scope}>{scope}</Tag>)}</Space><p className="app-token__meta">前缀 {token.prefix} · 创建于 {new Date(token.createdAt).toLocaleString("zh-CN")}</p></div>{token.revokedAt ? <Tag>已撤销</Tag> : <div className="app-token__actions"><Button icon={<Pencil size={14} />} onClick={() => startEditing(token)}>编辑权限</Button><Button danger onClick={() => void revoke(token.id)}>撤销</Button></div>}</div>{editingId === token.id && <div className="app-token__editor"><Typography.Text strong>编辑权限</Typography.Text><ScopeCheckboxes scopes={editingScopes} onToggle={toggleEditingScope} /><div className="app-token__editor-actions"><Button icon={<X size={14} />} onClick={cancelEditing}>取消</Button><Button type="primary" icon={<Check size={14} />} disabled={editingScopes.length === 0} onClick={() => void saveScopes(token.id)}>保存</Button></div></div>}</div>)}</div>{notice && <Alert style={{ marginTop: 16 }} type="info" showIcon message={notice} />}</Card></div></div>;
}
