import { useEffect, useState } from "react";
import { Alert, Button, Card, Space, Tag, Typography } from "antd";
import { ArrowUpRight, TerminalSquare } from "lucide-react";
import { integrationApi } from "../../lib/api/integrations";
import type { AiIntegration } from "../../lib/api/types";

export function ApiCenterPage({ onOpenTokens }: { onOpenTokens: () => void }) {
  const [integration, setIntegration] = useState<AiIntegration>(); const [notice, setNotice] = useState("");
  useEffect(() => { integrationApi.getAi().then((result) => setIntegration(result.data)).catch(() => setNotice("加载 API 信息失败")); }, []);
  return <div className="app-page"><div className="app-page-header"><div><Typography.Text className="app-eyebrow">DEVELOPER CENTER</Typography.Text><Typography.Title level={2} className="app-page-title">API 中心</Typography.Title><Typography.Paragraph className="app-page-description">查看 API 地址和接口目录，Token 权限请前往独立的 Token 管理。</Typography.Paragraph></div><Button icon={<ArrowUpRight size={16} />} onClick={onOpenTokens}>管理 Token</Button></div><Card className="app-panel-card" title={<Space><TerminalSquare size={18} />API Base URL</Space>} extra={<Tag color="blue">API</Tag>}><Typography.Paragraph className="app-card-description">外部 AI 和内容管道使用此地址访问平台接口。</Typography.Paragraph><code className="app-code">{integration?.baseUrl || "正在加载…"}</code></Card><Card className="app-panel-card" title="接口目录"><Typography.Paragraph className="app-card-description">接口权限由 Token scopes 控制，请只授予调用方需要的最小权限。</Typography.Paragraph><div className="app-endpoint-list">{integration && Object.entries(integration.endpoints).map(([key, url]) => <div className="app-endpoint" key={key}><div><p className="app-endpoint__name">{key}</p><code className="app-endpoint__url">{url}</code></div><Tag>API</Tag></div>)}</div>{notice && <Alert className="app-notice" type="error" showIcon message={notice} />}</Card></div>;
}
