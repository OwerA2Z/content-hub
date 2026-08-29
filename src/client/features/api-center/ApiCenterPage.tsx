import { useEffect, useState } from "react";
import { Alert, Button, Card, Descriptions, Flex, Space, Tag, Typography } from "antd";
import { ArrowUpRight, TerminalSquare } from "lucide-react";
import { integrationApi } from "../../lib/api/integrations";
import type { AiIntegration } from "../../lib/api/types";

export function ApiCenterPage({ onOpenTokens }: { onOpenTokens: () => void }) {
  const [integration, setIntegration] = useState<AiIntegration>(); const [notice, setNotice] = useState("");
  useEffect(() => { integrationApi.getAi().then((result) => setIntegration(result.data)).catch(() => setNotice("加载 API 信息失败")); }, []);
  return <Space direction="vertical" size={24} style={{ width: "100%" }}><Flex align="flex-end" justify="space-between" wrap="wrap" gap="middle"><div><Typography.Text type="secondary">DEVELOPER CENTER</Typography.Text><Typography.Title level={2}>API 中心</Typography.Title><Typography.Paragraph type="secondary">查看 API 地址和接口目录，Token 权限请前往独立的 Token 管理。</Typography.Paragraph></div><Button icon={<ArrowUpRight size={16} />} onClick={onOpenTokens}>管理 Token</Button></Flex><Card title={<Space><TerminalSquare size={18} />API Base URL</Space>} extra={<Tag color="blue">API</Tag>}><Typography.Paragraph type="secondary">外部 AI 和内容管道使用此地址访问平台接口。</Typography.Paragraph><Typography.Paragraph copyable={{ text: integration?.baseUrl || "" }} code>{integration?.baseUrl || "正在加载…"}</Typography.Paragraph></Card><Card title="接口目录"><Typography.Paragraph type="secondary">接口权限由 Token scopes 控制，请只授予调用方需要的最小权限。</Typography.Paragraph><Descriptions bordered column={1}>{integration && Object.entries(integration.endpoints).map(([key, url]) => <Descriptions.Item key={key} label={<Space>{key}<Tag>API</Tag></Space>}><Typography.Text code copyable>{url}</Typography.Text></Descriptions.Item>)}</Descriptions>{notice && <Alert type="error" showIcon message={notice} />}</Card></Space>;
}
