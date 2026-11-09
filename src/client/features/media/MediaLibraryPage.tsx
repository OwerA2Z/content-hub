import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Image,
  Input,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { TableProps } from "antd";
import { Copy, Grid as GridIcon, ImagePlus, List as ListIcon, RefreshCw } from "lucide-react";
import { mediaApi } from "../../lib/api/media";
import type { MediaAsset } from "../../lib/api/types";
import { copyText } from "../../lib/clipboard";

export function MediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [archivingId, setArchivingId] = useState<string>();
  const [notice, setNotice] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [detailAsset, setDetailAsset] = useState<MediaAsset>();

  const load = () => {
    setLoading(true);
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    mediaApi
      .list(params)
      .then((result) => setAssets(result.data))
      .catch(() => setNotice("加载素材失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [query]);

  const upload = (file?: File) => {
    if (!file || uploading) return;
    setUploading(true);
    mediaApi
      .upload(file)
      .then(() => {
        setNotice("图片素材已成功上传！");
        load();
      })
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "上传素材失败"))
      .finally(() => setUploading(false));
  };

  const copyUrl = (asset: MediaAsset) =>
    copyText(asset.url)
      .then(() => setNotice("素材 URL 已复制到剪贴板"))
      .catch(() => setNotice("复制失败，请手动复制"));

  const archive = (asset: MediaAsset) => {
    if (archivingId) return;
    setArchivingId(asset.id);
    return mediaApi
      .remove(asset.id)
      .then(() => {
        setNotice("素材已归档");
        load();
      })
      .catch(() => setNotice("归档素材失败"))
      .finally(() => setArchivingId(undefined));
  };

  const columns: TableProps<MediaAsset>["columns"] = [
    {
      title: "预览",
      key: "preview",
      width: 88,
      render: (_, asset) => (
        <Image
          width={56}
          height={40}
          style={{ objectFit: "cover", borderRadius: 4 }}
          src={asset.url}
          alt={asset.alt || asset.originalName}
        />
      ),
    },
    {
      title: "文件名",
      dataIndex: "originalName",
      key: "originalName",
      render: (name: string, asset) => (
        <Typography.Link strong onClick={() => setDetailAsset(asset)}>
          {name}
        </Typography.Link>
      ),
    },
    {
      title: "文件尺寸",
      key: "size",
      render: (_, asset) =>
        `${Math.ceil(asset.sizeBytes / 1024)} KB${asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}`,
    },
    {
      title: "标签",
      dataIndex: "tags",
      key: "tags",
      render: (tags: string[]) => (
        <Space wrap size={[4, 4]}>
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={status === "active" ? "success" : "default"}>{status === "active" ? "可用" : "已归档"}</Tag>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 220,
      render: (_, asset) => (
        <Space size="small">
          <Button size="small" onClick={() => setDetailAsset(asset)}>
            详情
          </Button>
          <Button size="small" icon={<Copy size={13} />} onClick={() => copyUrl(asset)}>
            复制 URL
          </Button>
          {asset.status === "active" && (
            <Popconfirm title="确认归档此素材？" onConfirm={() => archive(asset)}>
              <Button size="small" danger loading={archivingId === asset.id}>
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
      <Flex justify="space-between" align="flex-end" wrap gap="middle">
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>
            MEDIA LIBRARY
          </Typography.Text>
          <Typography.Title level={2} style={{ margin: "4px 0 8px 0" }}>
            素材库
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            集中保存和复用公众号封面、正文配图等图片素材。
          </Typography.Paragraph>
        </div>
        <Space>
          <Button icon={<RefreshCw size={15} />} onClick={load} loading={loading}>
            刷新
          </Button>
          <Upload
            beforeUpload={(file) => {
              upload(file);
              return false;
            }}
            showUploadList={false}
            accept="image/jpeg,image/png,image/webp,image/gif"
          >
            <Button type="primary" icon={<ImagePlus size={15} />} loading={uploading}>
              上传图片
            </Button>
          </Upload>
        </Space>
      </Flex>

      <Card
        title={
          <Flex justify="space-between" align="center" wrap gap="small">
            <Space>
              <span>图片素材</span>
              <Tag>{assets.length}</Tag>
            </Space>
            <Segmented
              value={viewMode}
              onChange={(val) => setViewMode(val as "grid" | "table")}
              options={[
                { value: "grid", label: "网格视图", icon: <GridIcon size={14} /> },
                { value: "table", label: "表格视图", icon: <ListIcon size={14} /> },
              ]}
            />
          </Flex>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Input
            placeholder="搜索文件名或标签…"
            allowClear
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {notice && <Alert type="info" showIcon message={notice} closable onClose={() => setNotice("")} />}

          {loading ? (
            <Flex justify="center" align="center" style={{ padding: 40 }}>
              <Spin />
            </Flex>
          ) : assets.length === 0 ? (
            <Empty description="暂无图片素材，点击右上角上传一张吧。" />
          ) : viewMode === "table" ? (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={assets}
              pagination={{ pageSize: 12, showTotal: (total) => `共 ${total} 个素材` }}
              scroll={{ x: 800 }}
            />
          ) : (
            <Row gutter={[16, 16]}>
              {assets.map((asset) => (
                <Col xs={24} sm={12} md={8} lg={6} key={asset.id}>
                  <Card
                    hoverable
                    size="small"
                    cover={
                      <div style={{ height: 140, overflow: "hidden", background: "#f5f5f5", position: "relative" }}>
                        <Image
                          width="100%"
                          height="100%"
                          style={{ objectFit: "cover" }}
                          src={asset.url}
                          alt={asset.alt || asset.originalName}
                        />
                        <Tag
                          color={asset.status === "active" ? "green" : "default"}
                          style={{ position: "absolute", top: 8, right: 8, margin: 0 }}
                        >
                          {asset.status === "active" ? "可用" : "已归档"}
                        </Tag>
                      </div>
                    }
                    actions={[
                      <Button key="copy" size="small" type="text" icon={<Copy size={13} />} onClick={() => copyUrl(asset)}>
                        复制
                      </Button>,
                      <Button key="detail" size="small" type="text" onClick={() => setDetailAsset(asset)}>
                        详情
                      </Button>,
                      asset.status === "active" ? (
                        <Popconfirm key="arch" title="确认归档此素材？" onConfirm={() => archive(asset)}>
                          <Button size="small" type="text" danger loading={archivingId === asset.id}>
                            归档
                          </Button>
                        </Popconfirm>
                      ) : null,
                    ].filter(Boolean)}
                  >
                    <Card.Meta
                      title={
                        <Typography.Text strong ellipsis style={{ fontSize: 13, display: "block" }}>
                          {asset.originalName}
                        </Typography.Text>
                      }
                      description={
                        <Space direction="vertical" size={2} style={{ width: "100%", marginTop: 4 }}>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {Math.ceil(asset.sizeBytes / 1024)} KB
                            {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
                          </Typography.Text>
                          {asset.tags.length > 0 && (
                            <Space wrap size={[2, 2]} style={{ marginTop: 4 }}>
                              {asset.tags.map((t) => (
                                <Tag key={t} style={{ fontSize: 11, padding: "0 4px" }}>
                                  {t}
                                </Tag>
                              ))}
                            </Space>
                          )}
                        </Space>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Space>
      </Card>

      <Modal title="素材详情" open={Boolean(detailAsset)} onCancel={() => setDetailAsset(undefined)} footer={null}>
        {detailAsset && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Image
              width="100%"
              height={220}
              style={{ objectFit: "contain", background: "#f8f8f8", borderRadius: 6 }}
              src={detailAsset.url}
              alt={detailAsset.alt || detailAsset.originalName}
            />
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="文件名">{detailAsset.originalName}</Descriptions.Item>
              <Descriptions.Item label="文件类型">{detailAsset.mimeType}</Descriptions.Item>
              <Descriptions.Item label="文件大小">{Math.ceil(detailAsset.sizeBytes / 1024)} KB</Descriptions.Item>
              {detailAsset.width && detailAsset.height && (
                <Descriptions.Item label="分辨率">{detailAsset.width} × {detailAsset.height}</Descriptions.Item>
              )}
              <Descriptions.Item label="公网 URL">
                <Typography.Text code copyable style={{ wordBreak: "break-all" }}>
                  {detailAsset.url}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="标签">
                <Space wrap>
                  {detailAsset.tags.length > 0
                    ? detailAsset.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)
                    : "暂无标签"}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="上传时间">
                {new Date(detailAsset.createdAt).toLocaleString("zh-CN")}
              </Descriptions.Item>
            </Descriptions>
            <Button block type="primary" icon={<Copy size={14} />} onClick={() => copyUrl(detailAsset)}>
              复制图片 URL
            </Button>
          </Space>
        )}
      </Modal>
    </Space>
  );
}
