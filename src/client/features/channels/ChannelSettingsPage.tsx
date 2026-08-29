import { useEffect, useState } from "react";
import { Alert, Card, Flex, Space, Tag, Typography } from "antd";
import { Radio } from "lucide-react";
import { articleApi } from "../../lib/api/articles";
import type { Capabilities } from "../../lib/api/types";

export function ChannelSettingsPage() {
  const [caps, setCaps] = useState<Capabilities>();
  useEffect(() => { articleApi.capabilities().then((result) => setCaps(result.data)).catch(() => undefined); }, []);
  return <Space direction="vertical" size={24} style={{ width: "100%" }}><div><Typography.Text type="secondary">CHANNELS</Typography.Text><Typography.Title level={2}>微信公众号</Typography.Title><Typography.Paragraph type="secondary">管理公众号连接状态、草稿和发布能力。</Typography.Paragraph></div><Card title={<Space><Radio size={18} />连接能力</Space>}><Flex gap="middle" wrap><Card size="small" style={{ flex: 1, minWidth: 220 }}><Flex justify="space-between"><span>草稿能力</span><Tag color={caps?.draft ? "green" : "orange"}>{caps?.draft ? "已启用" : "未配置"}</Tag></Flex></Card><Card size="small" style={{ flex: 1, minWidth: 220 }}><Flex justify="space-between"><span>发布能力</span><Tag color={caps?.publish ? "green" : "orange"}>{caps?.publish ? "已启用" : "按公众号权限"}</Tag></Flex></Card></Flex><Alert type="info" showIcon message={caps?.reason || "凭证只保存在服务端；请在部署环境配置微信公众号参数。"} /></Card></Space>;
}
