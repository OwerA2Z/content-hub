import { useEffect, useState } from "react";
import { Alert, Button, Card, Flex, Form, Input, Space, Tag, Typography } from "antd";
import { Radio } from "lucide-react";
import { articleApi, type WechatSettingsInfo } from "../../lib/api/articles";
import type { Capabilities } from "../../lib/api/types";

export function ChannelSettingsPage() {
  const [caps, setCaps] = useState<Capabilities>();
  const [error, setError] = useState("");

  const [settings, setSettings] = useState<WechatSettingsInfo>();
  const [form] = Form.useForm<{ appId: string; appSecret?: string }>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "test">();
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    articleApi.wechatSettings().then(({ data }) => {
      // unreadable 仍是可编辑状态，由页面提示完整重填，不将表单锁死在加载错误中。
      setSettings(data);
      form.setFieldsValue({ appId: data.appId });
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "加载配置失败"))
      .finally(() => setLoading(false));
  }, [form]);

  const save = async (values: { appId: string; appSecret?: string }) => {
    setBusy("save"); setError(""); setNotice("");
    try {
      const { data } = await articleApi.saveWechatSettings(values);
      setSettings(data);
      // 成功后立即清除浏览器内的密钥输入，服务端从不回显 Secret。
      form.setFieldsValue({ appSecret: "" });
      setDirty(false);
      setNotice("配置已保存并生效，请测试连接后上传文章。");
      const result = await articleApi.capabilities();
      setCaps(result.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); }
    finally { setBusy(undefined); }
  };

  const test = async () => {
    setBusy("test"); setError(""); setNotice("");
    try { await articleApi.testWechatConnection(); setNotice("连接成功：公众号凭证有效。草稿接口权限仍以实际上传结果为准。"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "连接失败"); }
    finally { setBusy(undefined); }
  };

  useEffect(() => {
    articleApi
      .capabilities()
      .then((result) => setCaps(result.data))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "加载微信公众号能力失败"));
  }, []);

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      {error && <Alert type="error" showIcon message={error} closable onClose={() => setError("")} />}
      {notice && <Alert type="success" showIcon message={notice} />}
      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>
          CHANNELS
        </Typography.Text>
        <Typography.Title level={2} style={{ margin: "4px 0 8px 0" }}>
          微信公众号
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          管理公众号连接状态、草稿箱同步和发布能力。
        </Typography.Paragraph>
      </div>

      <Card title="公众号接入配置" loading={loading}>
        {settings?.source === "unreadable" && <Alert type="warning" showIcon message="公众号配置无法解密，请重新填写凭证" description="请同时填写 AppID 和新的 AppSecret，保存后将覆盖旧配置。" style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical" onFinish={save} onValuesChange={() => setDirty(true)} disabled={Boolean(busy) || !settings} style={{ maxWidth: 560 }}>
          <Typography.Paragraph type="secondary">
            在微信公众平台获取开发者凭证，并将部署服务器的出口 IP 加入公众号 IP 白名单。
            配置仅供管理员管理，保存后立即生效，不会自动发布文章。
          </Typography.Paragraph>
          <Form.Item name="appId" label="AppID" rules={[{ required: true, message: "请输入 AppID" }, { pattern: /^wx[a-zA-Z0-9]{16}$/, message: "请输入 wx 开头的 18 位 AppID" }]}>
            <Input placeholder="wx…" autoComplete="off" />
          </Form.Item>
          <Form.Item name="appSecret" label="AppSecret" extra={settings?.source === "unreadable" ? "旧配置无法读取，必须填写新的 AppSecret，不能留空沿用。" : settings?.hasSecret ? "已配置密钥，留空保持不变；更换 AppID 时需填写新密钥。" : "首次配置必须填写。密钥保存后不回显。"} rules={[{ required: !settings?.hasSecret, whitespace: true, message: "请输入 AppSecret" }]}>
            <Input.Password placeholder={settings?.hasSecret ? "已配置，留空不修改" : "请输入 AppSecret"} autoComplete="new-password" />
          </Form.Item>
          <Space wrap>
            <Button type="primary" htmlType="submit" loading={busy === "save"}>保存配置</Button>
            <Button onClick={test} loading={busy === "test"} disabled={dirty || !settings?.appId || !settings.hasSecret}>测试已保存连接</Button>
            <Typography.Text type="secondary">{dirty ? "请先保存修改，再测试连接" : settings?.source === "saved" ? "使用页面保存的配置" : settings?.source === "environment" ? "当前使用环境变量配置" : settings?.source === "unreadable" ? "请重新填写凭证" : "尚未配置"}</Typography.Text>
          </Space>
        </Form>
      </Card>

      <Card
        title={
          <Space>
            <Radio size={18} />
            <span>微信连接状态与能力</span>
          </Space>
        }
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Flex gap="middle" wrap>
            <Card size="small" style={{ flex: 1, minWidth: 220, background: "#fafafa" }}>
              <Flex justify="space-between" align="center">
                <Typography.Text strong>微信草稿箱能力</Typography.Text>
                <Tag color={caps?.draft ? "green" : "orange"}>{caps?.draft ? "凭证已配置" : "未配置"}</Tag>
              </Flex>
              <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: "block" }}>
                支持将已上传的文章连同封面图一键同步至微信草稿箱。
              </Typography.Text>
            </Card>
            <Card size="small" style={{ flex: 1, minWidth: 220, background: "#fafafa" }}>
              <Flex justify="space-between" align="center">
                <Typography.Text strong>公众号群发/发布能力</Typography.Text>
                <Tag color={caps?.publish ? "green" : "orange"}>
                  {caps?.publish ? "凭证已配置" : "按公众号权限限制"}
                </Tag>
              </Flex>
              <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: "block" }}>
                微信草稿生成完成后，可直接发起群发推送（需微信认证账号权限）。
              </Typography.Text>
            </Card>
          </Flex>

          <Alert
            type={caps?.draft ? "success" : "info"}
            showIcon
            message="安全与配置提示"
            description={
              caps?.reason ||
              "AppSecret 仅在服务端加密保存，不向浏览器回显。请稳定保留部署环境的 SESSION_SECRET 与持久化卷，避免配置无法解密。"
            }
          />
        </Space>
      </Card>
    </Space>
  );
}
