import { useEffect, useState } from "react";
import { Alert, Button, Card, Empty, Flex, Image, Input, Modal, Popconfirm, Space, Spin, Table, Tag, Typography, Upload } from "antd";
import type { TableProps } from "antd";
import { Copy, ImagePlus, RefreshCw } from "lucide-react";
import { mediaApi } from "../../lib/api/media";
import type { MediaAsset } from "../../lib/api/types";
import { copyText } from "../../lib/clipboard";

export function MediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]); const [query, setQuery] = useState(""); const [loading, setLoading] = useState(true); const [notice, setNotice] = useState("");
  const load = () => { setLoading(true); const params = query ? `?q=${encodeURIComponent(query)}` : ""; mediaApi.list(params).then((result) => setAssets(result.data)).catch(() => setNotice("加载素材失败")).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [query]);
  const upload = (file?: File) => { if (!file) return; mediaApi.upload(file).then(() => { setNotice("素材已上传"); load(); }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : "上传素材失败")); };
  const copyUrl = (asset: MediaAsset) => copyText(asset.url).then(() => setNotice("素材 URL 已复制")).catch(() => setNotice("复制失败，请手动复制"));
  const archive = (asset: MediaAsset) => mediaApi.remove(asset.id).then(() => { setNotice("素材已归档"); load(); }).catch(() => setNotice("归档素材失败"));
  const [detailAsset, setDetailAsset] = useState<MediaAsset>();
  const columns: TableProps<MediaAsset>["columns"] = [
    { title: "预览", key: "preview", width: 88, render: (_, asset) => <Image width={56} height={40} style={{ objectFit: "cover" }} src={asset.url} alt={asset.alt || asset.originalName} /> },
    { title: "文件名", dataIndex: "originalName", key: "originalName", render: (name: string, asset) => <Typography.Link strong onClick={() => setDetailAsset(asset)}>{name}</Typography.Link> },
    { title: "尺寸", key: "size", render: (_, asset) => `${Math.ceil(asset.sizeBytes / 1024)} KB${asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}` },
    { title: "标签", dataIndex: "tags", key: "tags", render: (tags: string[]) => <Space wrap size={[4, 4]}>{tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space> },
    { title: "状态", dataIndex: "status", key: "status", render: (status: string) => <Tag color={status === "active" ? "success" : "default"}>{status === "active" ? "可用" : "已归档"}</Tag> },
    { title: "操作", key: "actions", width: 220, render: (_, asset) => <Space size="small"><Button size="small" onClick={() => setDetailAsset(asset)}>详情</Button><Button size="small" icon={<Copy size={14} />} onClick={() => copyUrl(asset)}>复制 URL</Button>{asset.status === "active" && <Popconfirm title="确认归档此素材？" onConfirm={() => archive(asset)}><Button size="small" danger>归档</Button></Popconfirm>}</Space> },
  ];
  return (
    <Flex vertical gap="large">
      <Flex justify="space-between" align="flex-end" wrap gap="middle">
        <Flex vertical gap="small">
          <Typography.Text type="secondary">MEDIA LIBRARY</Typography.Text>
          <Typography.Title level={2}>素材库</Typography.Title>
          <Typography.Paragraph type="secondary">集中保存和复用公众号封面、配图等图片素材。</Typography.Paragraph>
        </Flex>
        <Space>
          <Button icon={<RefreshCw size={15} />} onClick={load}>刷新</Button>
          <Upload beforeUpload={(file) => { upload(file); return false; }} showUploadList={false} accept="image/jpeg,image/png,image/webp,image/gif">
            <Button type="primary" icon={<ImagePlus size={15} />}>上传图片</Button>
          </Upload>
        </Space>
      </Flex>
      <Card title="图片素材">
        <Flex vertical gap="middle">
          <Input placeholder="搜索文件名或标签" value={query} onChange={(event) => setQuery(event.target.value)} />
          {loading ? <Flex justify="center" align="center"><Spin /></Flex> : assets.length === 0 ? <Empty description="暂无图片素材，先上传一张通用封面吧。" /> : <Table rowKey="id" columns={columns} dataSource={assets} pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 个素材` }} scroll={{ x: 900 }} />}
          {notice && <Alert type="info" showIcon message={notice} />}
        </Flex>
      </Card>
      <Modal title="素材详情" open={Boolean(detailAsset)} onCancel={() => setDetailAsset(undefined)} footer={null}>
        {detailAsset && <Space direction="vertical" size="middle" style={{ width: "100%" }}><Image width="100%" src={detailAsset.url} alt={detailAsset.alt || detailAsset.originalName} /><Typography.Text strong>{detailAsset.originalName}</Typography.Text><Typography.Text type="secondary">{detailAsset.url}</Typography.Text><Space wrap>{detailAsset.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space><Button icon={<Copy size={14} />} onClick={() => copyUrl(detailAsset)}>复制 URL</Button></Space>}
      </Modal>
    </Flex>
  );
}
