import { useEffect, useState } from "react";
import { Alert, Card, Space, Tag, Typography } from "antd";
import { Radio } from "lucide-react";
import { articleApi } from "../../lib/api/articles";
import type { Capabilities } from "../../lib/api/types";

export function ChannelSettingsPage() {
  const [caps, setCaps] = useState<Capabilities>();
  useEffect(() => { articleApi.capabilities().then((result) => setCaps(result.data)).catch(() => undefined); }, []);
  return <div className="app-page"><div><Typography.Text className="app-eyebrow">CHANNELS</Typography.Text><Typography.Title level={2} className="app-page-title">微信公众号</Typography.Title><Typography.Paragraph className="app-page-description">管理公众号连接状态、草稿和发布能力。</Typography.Paragraph></div><Card className="app-panel-card" title={<Space><Radio size={18} />连接能力</Space>}><div className="app-channel-status"><div className="app-channel-status__item"><span>草稿能力</span><span className={`app-channel-status__value ${caps?.draft ? "app-channel-status__value--ok" : "app-channel-status__value--warn"}`}>{caps?.draft ? "已启用" : "未配置"}</span></div><div className="app-channel-status__item"><span>发布能力</span><span className={`app-channel-status__value ${caps?.publish ? "app-channel-status__value--ok" : "app-channel-status__value--warn"}`}>{caps?.publish ? "已启用" : "按公众号权限"}</span></div></div><Alert style={{ marginTop: 20 }} type="info" showIcon message={caps?.reason || "凭证只保存在服务端；请在部署环境配置微信公众号参数。"} /></Card></div>;
}
