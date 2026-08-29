import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import { KeyRound, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { adminTokenApi } from "../../lib/api/admin-tokens";
import type { TokenInfo, TokenScope } from "../../lib/api/types";
import { TOKEN_SCOPES, TOKEN_SCOPE_LABELS } from "../../lib/api/types";

function ScopeCheckboxes({ scopes, onToggle }: { scopes: TokenScope[]; onToggle: (scope: TokenScope) => void }) {
  return (
    <Flex wrap gap="small">
      {TOKEN_SCOPES.map((scope) => (
        <Checkbox checked={scopes.includes(scope)} onChange={() => onToggle(scope)} key={scope}>
          {TOKEN_SCOPE_LABELS[scope]}
        </Checkbox>
      ))}
    </Flex>
  );
}

export function TokenManagementPage() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [keyword, setKeyword] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailToken, setDetailToken] = useState<TokenInfo>();
  const [editingToken, setEditingToken] = useState<TokenInfo>();
  const [createScopes, setCreateScopes] = useState<TokenScope[]>(["articles:read"]);
  const [editingScopes, setEditingScopes] = useState<TokenScope[]>([]);
  const [secret, setSecret] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [createForm] = Form.useForm<{ name: string }>();

  // 列表请求集中处理 loading 和错误提示，创建、编辑、撤销成功后复用同一入口刷新数据。
  const load = () => {
    setLoading(true);
    adminTokenApi
      .list()
      .then((result) => setTokens(result.data))
      .catch(() => setNotice("加载 Token 失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // 创建和编辑弹窗共享权限切换逻辑，避免两套 Scope 状态产生不一致。
  const toggleScope = (scope: TokenScope, setter: React.Dispatch<React.SetStateAction<TokenScope[]>>) => {
    setter((current) => (current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]));
  };

  const create = async () => {
    if (createScopes.length === 0) return;
    let values: { name: string };
    try {
      values = await createForm.validateFields();
    } catch {
      return;
    }
    setActionLoading(true);
    adminTokenApi
      .create(values.name.trim(), createScopes)
      .then((result) => {
        setSecret(result.data.secret);
        createForm.resetFields();
        setCreateScopes(["articles:read"]);
        setCreateOpen(false);
        setNotice("Token 已生成，请立即复制保存");
        load();
      })
      .catch(() => setNotice("生成 Token 失败"))
      .finally(() => setActionLoading(false));
  };

  const startEditing = (token: TokenInfo) => {
    setEditingToken(token);
    setEditingScopes([...token.scopes]);
  };

  const saveScopes = () => {
    if (!editingToken || editingScopes.length === 0) return;
    setActionLoading(true);
    adminTokenApi
      .updateScopes(editingToken.id, editingScopes)
      .then(() => {
        setEditingToken(undefined);
        setNotice("Token 权限已更新");
        load();
      })
      .catch(() => setNotice("更新 Token 权限失败"))
      .finally(() => setActionLoading(false));
  };

  const revoke = (id: string) => {
    setActionLoading(true);
    adminTokenApi
      .revoke(id)
      .then(() => {
        setNotice("Token 已撤销");
        if (detailToken?.id === id) setDetailToken(undefined);
        if (editingToken?.id === id) setEditingToken(undefined);
        load();
      })
      .catch(() => setNotice("撤销 Token 失败"))
      .finally(() => setActionLoading(false));
  };

  // 搜索仅作用于当前列表，不改变服务端数据和原有 API 查询参数。
  const filteredTokens = tokens.filter((token) => {
    const normalized = keyword.trim().toLowerCase();
    return !normalized || token.name.toLowerCase().includes(normalized) || token.prefix.toLowerCase().includes(normalized);
  });

  const columns: TableProps<TokenInfo>["columns"] = [
    {
      title: "Token 名称",
      dataIndex: "name",
      key: "name",
      render: (name: string, token) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{name}</Typography.Text>
          <Typography.Text type="secondary" copyable={{ text: token.prefix }}>
            {token.prefix}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "权限 Scope",
      dataIndex: "scopes",
      key: "scopes",
      render: (scopes: TokenScope[]) => (
        <Space wrap size={[4, 4]}>
          {scopes.map((scope) => (
            <Tag color="blue" key={scope}>
              {TOKEN_SCOPE_LABELS[scope]}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (createdAt: string) => new Date(createdAt).toLocaleString("zh-CN"),
    },
    {
      title: "状态",
      key: "status",
      render: (_, token) => (token.revokedAt ? <Tag color="default">已撤销</Tag> : <Tag color="success">启用中</Tag>),
    },
    {
      title: "操作",
      key: "actions",
      width: 220,
      render: (_, token) => (
        <Space size="small">
          <Button type="link" onClick={() => setDetailToken(token)}>
            详情
          </Button>
          {!token.revokedAt && (
            <>
              <Button type="link" icon={<Pencil size={14} />} onClick={() => startEditing(token)}>
                编辑
              </Button>
              <Popconfirm title="确认撤销此 Token？" description="撤销后将无法恢复，请确认操作。" onConfirm={() => revoke(token.id)}>
                <Button type="link" danger loading={actionLoading}>
                  撤销
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Flex align="flex-end" justify="space-between" wrap="wrap" gap="middle">
        <div>
          <Typography.Text type="secondary">ACCESS CONTROL</Typography.Text>
          <Typography.Title level={2}>Token 管理</Typography.Title>
          <Typography.Paragraph type="secondary">统一管理外部系统访问凭证，支持按 Scope 编辑权限或撤销 Token。</Typography.Paragraph>
        </div>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
          新建 Token
        </Button>
      </Flex>

      <Card
        title={
          <Space>
            <KeyRound size={18} />
            <span>Token 列表</span>
            <Tag>{filteredTokens.length}</Tag>
          </Space>
        }
        extra={
          <Space>
            <Input allowClear prefix={<Search size={15} />} placeholder="搜索名称或前缀" value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 220 }} />
            <Button aria-label="刷新 Token 列表" icon={<RefreshCw size={15} />} onClick={load} loading={loading} />
          </Space>
        }
      >
        <Table<TokenInfo>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredTokens}
          locale={{ emptyText: <Empty description="暂无 Token" /> }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 个 Token` }}
          scroll={{ x: 760 }}
        />
        {notice && <Alert type="info" showIcon message={notice} closable onClose={() => setNotice("")} />}
      </Card>

      <Modal title="新建 Token" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void create()} confirmLoading={actionLoading} okText="生成 Token" cancelText="取消">
        <Form form={createForm} layout="vertical" requiredMark="optional">
          <Form.Item name="name" label="Token 名称" rules={[{ required: true, whitespace: true, message: "请输入 Token 名称" }]}>
            <Input placeholder="例如：数据同步服务" maxLength={80} />
          </Form.Item>
          <Form.Item label="权限 Scope" required>
            <ScopeCheckboxes scopes={createScopes} onToggle={(scope) => toggleScope(scope, setCreateScopes)} />
            {createScopes.length === 0 && <Typography.Text type="danger">至少选择一项权限</Typography.Text>}
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Token 详情" open={Boolean(detailToken)} onCancel={() => setDetailToken(undefined)} footer={null}>
        {detailToken && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="名称">{detailToken.name}</Descriptions.Item>
            <Descriptions.Item label="前缀">{detailToken.prefix}</Descriptions.Item>
            <Descriptions.Item label="权限">
              <Space wrap>{detailToken.scopes.map((scope) => <Tag color="blue" key={scope}>{TOKEN_SCOPE_LABELS[scope]}</Tag>)}</Space>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{new Date(detailToken.createdAt).toLocaleString("zh-CN")}</Descriptions.Item>
            <Descriptions.Item label="状态">{detailToken.revokedAt ? `已撤销（${new Date(detailToken.revokedAt).toLocaleString("zh-CN")}）` : "启用中"}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal title={`编辑权限${editingToken ? `：${editingToken.name}` : ""}`} open={Boolean(editingToken)} onCancel={() => setEditingToken(undefined)} onOk={saveScopes} confirmLoading={actionLoading} okText="保存" cancelText="取消">
        <Typography.Paragraph type="secondary">调整后仅影响后续请求，Token 密钥本身不会变化。</Typography.Paragraph>
        <ScopeCheckboxes scopes={editingScopes} onToggle={(scope) => toggleScope(scope, setEditingScopes)} />
        {editingScopes.length === 0 && <Typography.Text type="danger">至少选择一项权限</Typography.Text>}
      </Modal>

      <Modal title="Token 密钥" open={Boolean(secret)} onCancel={() => setSecret("")} footer={<Button type="primary" onClick={() => setSecret("")}>我已保存</Button>}>
        <Alert type="warning" showIcon message="Token 明文只显示一次" description="请立即复制并保存，关闭后将无法再次查看。" />
        <Typography.Paragraph copyable={{ text: secret }} code style={{ marginTop: 16, wordBreak: "break-all" }}>
          {secret}
        </Typography.Paragraph>
      </Modal>
    </Space>
  );
}
