import { useEffect, useState } from "react";
import { Alert, Button, Card, Descriptions, Flex, Space, Tag, Typography } from "antd";
import { ArrowUpRight, TerminalSquare } from "lucide-react";
import { integrationApi } from "../../lib/api/integrations";
import type { AiIntegration } from "../../lib/api/types";

export function ApiCenterPage({ onOpenTokens }: { onOpenTokens: () => void }) {
  const [integration, setIntegration] = useState<AiIntegration>();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    integrationApi
      .getAi()
      .then((result) => setIntegration(result.data))
      .catch(() => setNotice("加载 API 信息失败"));
  }, []);

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Flex align="flex-end" justify="space-between" wrap="wrap" gap="middle">
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>
            DEVELOPER CENTER
          </Typography.Text>
          <Typography.Title level={2} style={{ margin: "4px 0 8px 0" }}>
            API 中心
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            查看 API 地址和接口目录，Token 权限请前往独立的 Token 管理。
          </Typography.Paragraph>
        </div>
        <Button icon={<ArrowUpRight size={16} />} onClick={onOpenTokens}>
          管理 Token 密钥
        </Button>
      </Flex>

      <Card
        title={
          <Space>
            <TerminalSquare size={18} />
            <span>API Base URL</span>
          </Space>
        }
        extra={<Tag color="blue">公网 / 内网访问入口</Tag>}
      >
        <Typography.Paragraph type="secondary">
          外部 AI、写作管道及自动化工作流使用此 Base URL 访问中台开放接口：
        </Typography.Paragraph>
        <div style={{ background: "#f8f9fa", padding: "12px 16px", borderRadius: 6, border: "1px solid #eaedf0" }}>
          <Typography.Paragraph copyable={{ text: integration?.baseUrl || "" }} code style={{ margin: 0, fontSize: 14 }}>
            {integration?.baseUrl || "正在获取 API 地址…"}
          </Typography.Paragraph>
        </div>
      </Card>

      <Card title="开放接口目录">
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          接口访问权限由 Token 的 Scopes 控制，请按需为每个客户端分配最小必要权限。
        </Typography.Paragraph>
        <Descriptions bordered column={1} size="middle">
          {integration &&
            Object.entries(integration.endpoints).map(([key, url]) => (
              <Descriptions.Item
                key={key}
                label={
                  <Space>
                    <Typography.Text strong>{key}</Typography.Text>
                    <Tag color="cyan">API</Tag>
                  </Space>
                }
              >
                <Typography.Text code copyable>
                  {url}
                </Typography.Text>
              </Descriptions.Item>
            ))}
        </Descriptions>
        {notice && <Alert type="error" showIcon message={notice} style={{ marginTop: 16 }} />}
      </Card>
    </Space>
  );
}
