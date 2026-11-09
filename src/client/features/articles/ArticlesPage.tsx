import { useEffect } from "react";
import { Alert, Button, Card, Checkbox, Col, Empty, Flex, Input, Popconfirm, Row, Select, Space, Spin, Statistic, Table, Tag, Typography } from "antd";
import type { Article } from "../../lib/api/types";
import { ArticleDrawer } from "./ArticleDrawer";
import { useArticles } from "./useArticles";

const ARTICLE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  uploaded: { label: "已上传", color: "blue" },
  draft_ready: { label: "草稿已生成", color: "cyan" },
  published: { label: "已发布", color: "green" },
  sync_failed: { label: "同步失败", color: "red" },
  archived: { label: "已归档", color: "default" },
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <Card style={{ height: "100%" }}>
      <Statistic title={label} value={value} />
      <Typography.Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: "block" }}>
        {hint}
      </Typography.Text>
    </Card>
  );
}

export function ArticlesPage({ initialArticleId, onInitialArticleOpened }: { initialArticleId?: string; onInitialArticleOpened: () => void }) {
  const model = useArticles();
  const {
    articles,
    total,
    page,
    caps,
    selected,
    loading,
    actionLoading,
    notice,
    q,
    status,
    includeArchived,
    canPublish,
    setQ,
    setStatus,
    setIncludeArchived,
    setPage,
    load,
    selectArticle,
    archive,
    restore,
    createDraft,
    retry,
    publish,
    updateMedia,
    setNotice,
    setSelected,
  } = model;

  useEffect(() => {
    if (!initialArticleId) return;
    selectArticle({ id: initialArticleId } as Article);
    onInitialArticleOpened();
  }, [initialArticleId, onInitialArticleOpened, selectArticle]);

  const columns = [
    {
      title: "文章标题与摘要",
      key: "title",
      render: (_: unknown, article: Article) => (
        <Space direction="vertical" size={2} style={{ maxWidth: 360 }}>
          <Typography.Link strong onClick={() => selectArticle(article)} style={{ fontSize: 14 }}>
            {article.title}
          </Typography.Link>
          <Typography.Text type="secondary" ellipsis style={{ fontSize: 12 }}>
            {article.digest || "暂无摘要"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "作者",
      dataIndex: "author",
      key: "author",
      width: 120,
      render: (author: string | null) => author || "未署名",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: string) => {
        const statusInfo = ARTICLE_STATUS_CONFIG[value] ?? { label: value, color: "default" };
        return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>;
      },
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (value: string) => new Date(value).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right" as const,
      width: 160,
      render: (_: unknown, article: Article) => (
        <Space size="small">
          <Button size="small" type="primary" ghost onClick={() => selectArticle(article)}>
            详情
          </Button>
          {article.status === "archived" ? (
            <Button size="small" onClick={() => restore(article.id)} loading={actionLoading}>
              恢复
            </Button>
          ) : (
            <Popconfirm title="确认归档这篇文章？" description="归档后文章将移至已归档列表" onConfirm={() => archive(article.id)}>
              <Button size="small" danger loading={actionLoading}>
                归档
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Flex align="flex-end" justify="space-between" wrap="wrap" gap="middle">
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>
            ARTICLE LIBRARY
          </Typography.Text>
          <Typography.Title level={2} style={{ margin: "4px 0 8px 0" }}>
            文章管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            统一接收、保存和管理外部内容，按需连接微信公众号发布与沉淀。
          </Typography.Paragraph>
        </div>
        <Button
          onClick={() => {
            setPage(1);
            load(1, 10);
          }}
          loading={loading}
        >
          刷新列表
        </Button>
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <StatCard label="文章总数" value={total} hint="当前条件下的文章总数" />
        </Col>
        <Col xs={24} md={8}>
          <StatCard label="微信草稿能力" value={caps?.draft ? "已就绪" : "未配置"} hint={caps?.reason ?? "支持自动同步微信草稿"} />
        </Col>
        <Col xs={24} md={8}>
          <StatCard label="公众号发布能力" value={caps?.publish ? "已就绪" : "按权限"} hint="发布前自动校验权限" />
        </Col>
      </Row>

      <Card
        title="文章列表"
        extra={
          <Checkbox checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)}>
            包含已归档
          </Checkbox>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Flex gap="small" wrap>
            <Input
              style={{ flex: 1, minWidth: 220 }}
              placeholder="搜索文章标题或摘要…"
              value={q}
              allowClear
              onChange={(event) => setQ(event.target.value)}
            />
            <Select
              style={{ width: 180 }}
              value={status || undefined}
              placeholder="全部状态"
              allowClear
              onChange={(value) => setStatus(value ?? "")}
              options={[
                { value: "uploaded", label: "已上传" },
                { value: "draft_ready", label: "草稿已生成" },
                { value: "published", label: "已发布" },
                { value: "sync_failed", label: "同步失败" },
                { value: "archived", label: "已归档" },
              ]}
            />
          </Flex>

          {notice && <Alert type="info" showIcon message={notice} closable onClose={() => setNotice("")} />}

          {loading ? (
            <Flex justify="center" style={{ padding: 40 }}>
              <Spin />
            </Flex>
          ) : articles.length === 0 ? (
            <Empty description="暂无符合条件的文章" />
          ) : (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={articles}
              pagination={{ current: page, pageSize: 10, total, showTotal: (count) => `共 ${count} 篇` }}
              onChange={(pagination) => {
                const nextPage = pagination.current ?? 1;
                setPage(nextPage);
                load(nextPage, 10);
              }}
              scroll={{ x: 800 }}
            />
          )}
        </Space>
      </Card>

      <ArticleDrawer
        article={selected}
        notice={notice}
        caps={caps}
        canPublish={canPublish}
        actionLoading={actionLoading}
        onClose={() => setSelected(undefined)}
        onArchive={archive}
        onRestore={restore}
        onDraft={createDraft}
        onRetry={retry}
        onPublish={publish}
        onMediaSave={updateMedia}
        onNotice={setNotice}
      />
    </Space>
  );
}
