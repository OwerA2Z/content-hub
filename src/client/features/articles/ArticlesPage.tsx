import { useEffect } from "react";
import { Button, Card, Checkbox, Col, Empty, Flex, Input, Popconfirm, Row, Select, Space, Spin, Statistic, Table, Tag, Typography } from "antd";
import type { Article } from "../../lib/api/types";
import { ArticleDrawer } from "./ArticleDrawer";
import { useArticles } from "./useArticles";

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <Card><Statistic title={label} value={value} /><Typography.Text type="secondary">{hint}</Typography.Text></Card>;
}

export function ArticlesPage({ initialArticleId, onInitialArticleOpened }: { initialArticleId?: string; onInitialArticleOpened: () => void }) {
  const model = useArticles();
  const { articles, total, caps, selected, loading, notice, q, status, includeArchived, canPublish, setQ, setStatus, setIncludeArchived, load, selectArticle, archive, restore, createDraft, retry, publish, updateMedia, setNotice, setSelected } = model;
  useEffect(() => { if (!initialArticleId) return; selectArticle({ id: initialArticleId } as Article); onInitialArticleOpened(); }, [initialArticleId, onInitialArticleOpened, selectArticle]);
  const columns = [
    { title: "文章", key: "title", render: (_: unknown, article: Article) => <Space direction="vertical" size={0}><Typography.Link strong onClick={() => selectArticle(article)}>{article.title}</Typography.Link><Typography.Text type="secondary" ellipsis>{article.digest || "暂无摘要"}</Typography.Text></Space> },
    { title: "作者", dataIndex: "author", key: "author", render: (author: string | null) => author || "未署名" },
    { title: "状态", dataIndex: "status", key: "status", render: (value: string) => <Tag color={value === "archived" ? "default" : "blue"}>{value}</Tag> },
    { title: "创建时间", dataIndex: "createdAt", key: "createdAt", render: (value: string) => new Date(value).toLocaleString("zh-CN") },
    { title: "操作", key: "actions", fixed: "right" as const, render: (_: unknown, article: Article) => <Space size="small"><Button size="small" onClick={() => selectArticle(article)}>详情</Button>{article.status === "archived" ? <Button size="small" onClick={() => restore(article.id)}>恢复</Button> : <Popconfirm title="确认归档这篇文章？" onConfirm={() => archive(article.id)}><Button size="small" danger>归档</Button></Popconfirm>}</Space> },
  ];
  return <Space direction="vertical" size={24} style={{ width: "100%" }}><Flex align="flex-end" justify="space-between" wrap="wrap" gap="middle"><div><Typography.Text type="secondary">ARTICLE LIBRARY</Typography.Text><Typography.Title level={2}>文章管理</Typography.Title><Typography.Paragraph type="secondary">统一接收、保存和管理外部内容，按需连接微信公众号。</Typography.Paragraph></div><Button onClick={load}>刷新列表</Button></Flex><Row gutter={[16, 16]}><Col xs={24} md={8}><StatCard label="文章总数" value={total} hint="当前可见文章" /></Col><Col xs={24} md={8}><StatCard label="微信草稿" value={caps?.draft ? "可用" : "未配置"} hint={caps?.reason ?? "等待检测"} /></Col><Col xs={24} md={8}><StatCard label="发布能力" value={caps?.publish ? "可用" : "按权限"} hint="操作前自动校验" /></Col></Row><Card title="文章列表" extra={<Checkbox checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)}>包含归档</Checkbox>}><Space direction="vertical" size="middle" style={{ width: "100%" }}><Flex gap="small" wrap><Input style={{ flex: 1, minWidth: 220 }} placeholder="搜索标题或摘要" value={q} onChange={(event) => setQ(event.target.value)} /><Select style={{ width: 180 }} value={status || undefined} placeholder="全部状态" allowClear onChange={(value) => setStatus(value ?? "")} options={[{ value: "uploaded", label: "已上传" }, { value: "draft_ready", label: "草稿已创建" }, { value: "published", label: "已发布" }, { value: "sync_failed", label: "同步失败" }, { value: "archived", label: "已归档" }]} /></Flex>{notice && <Typography.Paragraph type="secondary">{notice}</Typography.Paragraph>}{loading ? <Flex justify="center"><Spin /></Flex> : articles.length === 0 ? <Empty description="暂无文章" /> : <Table rowKey="id" columns={columns} dataSource={articles} pagination={{ pageSize: 10, total, showTotal: (count) => `共 ${count} 篇` }} scroll={{ x: 760 }} />}</Space></Card><ArticleDrawer article={selected} caps={caps} canPublish={canPublish} onClose={() => setSelected(undefined)} onArchive={archive} onRestore={restore} onDraft={createDraft} onRetry={retry} onPublish={publish} onMediaSave={updateMedia} onNotice={setNotice} /></Space>;
}
