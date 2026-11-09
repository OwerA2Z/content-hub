import { useEffect, useState } from "react";
import { Alert, Button, Card, Empty, Flex, List, Row, Col, Space, Spin, Statistic, Tag, Typography } from "antd";
import { ArrowUpRight } from "lucide-react";
import { articleApi } from "../../lib/api/articles";
import type { Article, Capabilities } from "../../lib/api/types";

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

export function DashboardPage({ onOpenArticles }: { onOpenArticles: (articleId?: string) => void }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [caps, setCaps] = useState<Capabilities>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([articleApi.list(), articleApi.capabilities()])
      .then(([list, channel]) => {
        if (!active) return;
        setArticles(list.data);
        setTotal(list.meta.total);
        setCaps(channel.data);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "加载工作台数据失败"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const recent = articles.slice(0, 5);

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      {error && <Alert type="error" showIcon message={error} closable onClose={() => setError("")} />}
      <Card>
        <Flex align="center" justify="space-between" gap={24} wrap="wrap">
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>
              CONTENT OPERATIONS
            </Typography.Text>
            <Typography.Title level={3} style={{ margin: "4px 0 8px 0" }}>
              把内容，变成可持续的资产。
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              从 AI 接入、文章沉淀到微信公众号发布，所有内容都在一个工作台里清晰流转。
            </Typography.Paragraph>
          </div>
          <Button type="primary" icon={<ArrowUpRight size={16} />} onClick={() => onOpenArticles()}>
            查看文章
          </Button>
        </Flex>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <StatCard label="文章总数" value={total} hint="当前可见文章" />
        </Col>
        <Col xs={24} md={8}>
          <StatCard label="微信草稿能力" value={caps?.draft ? "已就绪" : "未配置"} hint={caps?.reason ?? "支持自动同步微信草稿"} />
        </Col>
        <Col xs={24} md={8}>
          <StatCard label="公众号发布能力" value={caps?.publish ? "已就绪" : "按权限"} hint="发布前自动校验权限" />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title="最近文章"
            extra={
              <Button type="link" onClick={() => onOpenArticles()} style={{ padding: 0 }}>
                全部文章 →
              </Button>
            }
          >
            {loading ? (
              <Flex justify="center" style={{ padding: 32 }}>
                <Spin />
              </Flex>
            ) : recent.length === 0 ? (
              <Empty description="还没有文章，先通过 API 或内容池添加一篇吧。" />
            ) : (
              <List
                dataSource={recent}
                renderItem={(article) => {
                  const statusInfo = ARTICLE_STATUS_CONFIG[article.status] ?? { label: article.status, color: "default" };
                  return (
                    <List.Item
                      actions={[
                        <Tag key="status" color={statusInfo.color}>
                          {statusInfo.label}
                        </Tag>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 6,
                              background: "#f0f5ff",
                              color: "#1677ff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "bold",
                              fontSize: 16,
                            }}
                          >
                            {article.title.slice(0, 1)}
                          </div>
                        }
                        title={
                          <Typography.Link strong onClick={() => onOpenArticles(article.id)}>
                            {article.title}
                          </Typography.Link>
                        }
                        description={`${article.author || "未署名"} · ${new Date(article.createdAt).toLocaleDateString("zh-CN")}`}
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="快捷操作">
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Button
                block
                onClick={() => onOpenArticles()}
                style={{
                  height: "auto",
                  padding: "14px 16px",
                  textAlign: "left",
                  display: "block",
                }}
              >
                <Flex justify="space-between" align="center">
                  <div>
                    <Typography.Text strong style={{ display: "block" }}>
                      文章管理与发布
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      管理文章内容、封面图与微信发布
                    </Typography.Text>
                  </div>
                  <ArrowUpRight size={17} style={{ color: "#8c8c8c" }} />
                </Flex>
              </Button>
              <Card size="small" type="inner" title="💡 AI 生成建议">
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  先在“内容规划”中维护系列和任务，再让 AI 结合已发布内容生成，有效降低主题重复率。
                </Typography.Text>
              </Card>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
