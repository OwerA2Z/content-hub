import { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Drawer, Empty, Flex, Image, Input, Row, Space, Tag, Typography } from "antd";
import { Copy } from "lucide-react";
import type { Article, Capabilities } from "../../lib/api/types";
import { copyArticleContent, copyText } from "../../lib/clipboard";
import { mediaApi } from "../../lib/api/media";
import type { MediaAsset } from "../../lib/api/types";

const ARTICLE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  uploaded: { label: "已上传", color: "blue" },
  draft_ready: { label: "草稿已生成", color: "cyan" },
  published: { label: "已发布", color: "green" },
  sync_failed: { label: "同步失败", color: "red" },
  archived: { label: "已归档", color: "default" },
};

export function ArticleDrawer({
  article,
  caps,
  canPublish,
  actionLoading = false,
  notice,
  onClose,
  onArchive,
  onRestore,
  onDraft,
  onRetry,
  onPublish,
  onMediaSave,
  onNotice,
}: {
  article?: Article;
  caps?: Capabilities;
  canPublish: boolean;
  actionLoading?: boolean;
  notice?: string;
  onClose: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDraft: () => void;
  onRetry: () => void;
  onPublish: () => void;
  onMediaSave: (coverUrl: string, coverAssetId?: string) => void;
  onNotice: (message: string) => void;
}) {
  const [coverUrl, setCoverUrl] = useState("");
  const [coverError, setCoverError] = useState(false);
  const [assetLoadError, setAssetLoadError] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>();

  useEffect(() => {
    let active = true;
    const existingUrl = article?.coverUrl ?? article?.images?.[0] ?? "";
    setCoverUrl(existingUrl);
    setSelectedAssetId(article?.coverAssetId);
    setCoverError(false);
    setAssetLoadError(false);
    setAssetPickerOpen(false);
    if (article?.coverAssetId) {
      mediaApi
        .get(article.coverAssetId)
        .then((result) => {
          if (!active) return;
          if (result.data.status !== "active") {
            setSelectedAssetId(undefined);
            setAssetLoadError(!existingUrl);
            return;
          }
          if (!existingUrl) setCoverUrl(result.data.url);
        })
        .catch(() => {
          if (!active) return;
          setSelectedAssetId(undefined);
          setAssetLoadError(!existingUrl);
        });
    }
    return () => {
      active = false;
    };
  }, [article?.coverAssetId, article?.coverUrl, article?.id, article?.images]);

  if (!article) return null;
  const hasCover = Boolean((coverUrl || selectedAssetId) && !assetLoadError);
  const statusInfo = ARTICLE_STATUS_CONFIG[article.status] ?? { label: article.status, color: "default" };

  const openAssetPicker = () => {
    if (assetPickerOpen) {
      setAssetPickerOpen(false);
      return;
    }
    mediaApi
      .list()
      .then((result) => {
        setAssets(result.data);
        setAssetPickerOpen(true);
      })
      .catch(() => onNotice("加载素材库失败"));
  };

  return (
    <Drawer
      open
      title="文章详情与预览"
      closable
      onClose={onClose}
      width="min(100vw, 700px)"
      extra={
        <Space>
          <Button
            size="small"
            onClick={article.status === "archived" ? onRestore : onArchive}
            loading={actionLoading}
          >
            {article.status === "archived" ? "恢复文章" : "归档"}
          </Button>
          {article.status === "sync_failed" && (
            <Button size="small" type="primary" danger onClick={onRetry} loading={actionLoading}>
              重试同步
            </Button>
          )}
          {(
            <Button size="small" type="primary" onClick={onDraft} loading={actionLoading} disabled={!caps?.draft || article.status === "archived"}>
              上传微信草稿箱
            </Button>
          )}
          {canPublish && (
            <Button size="small" type="primary" style={{ background: "#52c41a" }} onClick={onPublish} loading={actionLoading}>
              提交发布
            </Button>
          )}
        </Space>
      }
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {notice && <Alert type="info" showIcon message={notice} />}
        {!caps?.draft && <Typography.Paragraph type="warning">{caps ? "请先到“微信公众号”页面配置 AppID 和 AppSecret，再上传草稿。" : "正在获取公众号配置，请稍候。"}</Typography.Paragraph>}

        <div>
          <Typography.Title level={3} style={{ margin: 0, marginBottom: 8 }}>
            {article.title}
          </Typography.Title>
          <Space split={<span style={{ color: "#d9d9d9" }}>·</span>} wrap>
            <Typography.Text type="secondary">{article.author || "未署名"}</Typography.Text>
            <Typography.Text type="secondary">{new Date(article.createdAt).toLocaleString("zh-CN")}</Typography.Text>
            <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
          </Space>
          {article.digest && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                background: "#f9fafb",
                borderLeft: "3px solid #1677ff",
                borderRadius: 4,
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {article.digest}
              </Typography.Text>
            </div>
          )}
        </div>

        <Card
          size="small"
          title={
            <Flex justify="space-between" align="center">
              <Space>
                <span>封面图片</span>
                {hasCover && <Tag color="green">已就绪</Tag>}
              </Space>
              <Button size="small" type="link" onClick={openAssetPicker}>
                {assetPickerOpen ? "收起素材选择器" : "从素材库选择"}
              </Button>
            </Flex>
          }
        >
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              支持素材库图片或公网 HTTP(S) 图片。选择或修改后请先保存封面，再上传微信草稿。
            </Typography.Text>
            <Flex gap="small" wrap>
              <Input
                style={{ flex: 1, minWidth: 200 }}
                placeholder="https://example.com/cover.jpg"
                value={coverUrl}
                onChange={(event) => {
                  setCoverUrl(event.target.value);
                  setSelectedAssetId(undefined);
                  setCoverError(false);
                  setAssetLoadError(false);
                }}
              />
              <Button
                type="primary"
                disabled={!coverUrl.trim() || assetLoadError}
                onClick={() => onMediaSave(coverUrl.trim(), selectedAssetId)}
                loading={actionLoading}
              >
                保存封面
              </Button>
            </Flex>

            {assetLoadError && (
              <Typography.Text type="warning" style={{ fontSize: 12 }}>
                关联素材无法读取，请重新从素材库选择。
              </Typography.Text>
            )}

            {assetPickerOpen && (
              <div style={{ padding: 12, background: "#fafafa", borderRadius: 8, border: "1px solid #f0f0f0" }}>
                <Typography.Text strong style={{ fontSize: 13, marginBottom: 8, display: "block" }}>
                  点击选择素材库中的图片：
                </Typography.Text>
                {assets.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可用素材，请先在素材库上传" />
                ) : (
                  <Row gutter={[10, 10]}>
                    {assets.map((asset) => {
                      const isSelected = selectedAssetId === asset.id || coverUrl === asset.url;
                      return (
                        <Col span={6} key={asset.id}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelectedAssetId(asset.id);
                              setCoverUrl(asset.url);
                              setCoverError(false);
                              setAssetLoadError(false);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedAssetId(asset.id);
                                setCoverUrl(asset.url);
                                setCoverError(false);
                                setAssetLoadError(false);
                              }
                            }}
                            aria-label={`选择素材 ${asset.originalName}`}
                            style={{
                              border: isSelected ? "2px solid #1677ff" : "1px solid #e8e8e8",
                              borderRadius: 6,
                              overflow: "hidden",
                              cursor: "pointer",
                              background: "#fff",
                              position: "relative",
                              transition: "all 0.2s",
                              boxShadow: isSelected ? "0 0 0 2px rgba(22, 119, 255, 0.2)" : "none",
                            }}
                          >
                            <Image
                              preview={false}
                              width="100%"
                              height={64}
                              style={{ objectFit: "cover", display: "block" }}
                              src={asset.url}
                              alt={asset.alt || asset.originalName}
                            />
                            <div
                              style={{
                                padding: "4px 6px",
                                fontSize: 11,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                textAlign: "center",
                                background: isSelected ? "#e6f4ff" : "#fff",
                                color: isSelected ? "#1677ff" : "#595959",
                              }}
                            >
                              {asset.originalName}
                            </div>
                          </div>
                        </Col>
                      );
                    })}
                  </Row>
                )}
              </div>
            )}

            {coverUrl && !assetPickerOpen && (
              <div>
                {coverError ? (
                  <Typography.Text type="warning" style={{ fontSize: 12 }}>
                    封面地址无法加载，请确认图片 URL 可公网访问。
                  </Typography.Text>
                ) : (
                  <Image
                    width="100%"
                    height={160}
                    style={{ objectFit: "cover", borderRadius: 6 }}
                    src={coverUrl}
                    alt="文章封面预览"
                    onError={() => setCoverError(true)}
                  />
                )}
              </div>
            )}
          </Space>
        </Card>

        <div>
          <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
            <Typography.Text strong>文章正文预览</Typography.Text>
            <Space>
              <Button
                size="small"
                icon={<Copy size={13} />}
                onClick={() =>
                  copyArticleContent(article.title, article.content)
                    .then((mode) =>
                      onNotice(mode === "rich" ? "文章富文本已复制，可直接粘贴至公众号编辑器" : "文章纯文本已复制"),
                    )
                    .catch((error: unknown) => onNotice(error instanceof Error ? error.message : "复制文章失败"))
                }
              >
                复制全文（富文本）
              </Button>
              <Button
                size="small"
                type="link"
                onClick={() =>
                  copyText(article.id)
                    .then(() => onNotice("文章 ID 已复制"))
                    .catch(() => onNotice("复制失败"))
                }
              >
                复制文章 ID
              </Button>
            </Space>
          </Flex>
          <iframe
            title="文章预览"
            sandbox=""
            style={{
              width: "100%",
              minHeight: 480,
              border: "1px solid #e8e8e8",
              borderRadius: 8,
              background: "#fff",
            }}
            srcDoc={`<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.8;padding:24px;max-width:680px;margin:auto;color:#262626">${article.content}</body></html>`}
          />
        </div>
      </Space>
    </Drawer>
  );
}
