import { Alert, Button, Drawer, Flex, Space, Tag, Typography } from "antd";
import type { ContentCandidate } from "../../lib/api/types";
import { copyArticleContent } from "../../lib/clipboard";

const riskLabel = { low: "低风险", medium: "中风险", high: "高风险", exact: "完全重复" } as const;
const riskColor = { low: "green", medium: "orange", high: "red", exact: "red" } as const;
const candidateStatusLabel: Record<string, string> = {
  recommended: "强烈推荐",
  candidate: "候选",
  accepted: "已接受",
  stale: "已过时",
  rejected: "已拒绝",
};

export function CandidatePreview({
  candidate,
  onOpenChange,
  onAccept,
  onNotice,
}: {
  candidate?: ContentCandidate;
  onOpenChange: (open: boolean) => void;
  onAccept: (candidate: ContentCandidate) => void;
  onNotice: (message: string) => void;
}) {
  const copy = () => candidate && copyArticleContent(candidate.title, candidate.content);

  return (
    <Drawer
      title={candidate ? `候选文章：${candidate.title}` : "候选文章预览"}
      open={Boolean(candidate)}
      onClose={() => onOpenChange(false)}
      width="min(100vw, 700px)"
      extra={
        candidate &&
        candidate.status !== "accepted" &&
        candidate.status !== "stale" && (
          <Button type="primary" onClick={() => onAccept(candidate)}>
            接受并保存文章
          </Button>
        )
      }
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {candidate && (
          <>
            <div>
              <Typography.Title level={3} style={{ margin: "0 0 8px 0" }}>
                {candidate.title}
              </Typography.Title>
              <Space wrap size="small">
                <Tag color={riskColor[candidate.risk]}>{riskLabel[candidate.risk]}</Tag>
                <Tag color="blue">推荐得分 {Math.round(candidate.score * 100)}</Tag>
                <Tag color="cyan">去重相似度 {Math.round(candidate.similarity * 100)}%</Tag>
                <Tag>{candidateStatusLabel[candidate.status] ?? candidate.status}</Tag>
              </Space>
            </div>

            {candidate.summary && (
              <Alert
                type="info"
                message="文章核心梗概"
                description={candidate.summary}
                style={{ borderRadius: 6 }}
              />
            )}

            {candidate.warnings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="生成警告提示"
                description={
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {candidate.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                }
              />
            )}

            <div>
              <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
                <Typography.Text strong>文章正文预览</Typography.Text>
                <Button
                  size="small"
                  onClick={() =>
                    copy()
                      ?.then((mode) => {
                        onNotice(mode === "rich" ? "文章富文本已复制，可粘贴至微信公众号" : "文章纯文本已复制");
                      })
                      .catch((error: unknown) => onNotice(error instanceof Error ? error.message : "复制文章失败"))
                  }
                >
                  复制全文（富文本）
                </Button>
              </Flex>
              <iframe
                title="候选文章正文预览"
                sandbox=""
                style={{
                  width: "100%",
                  minHeight: 480,
                  border: "1px solid #e8e8e8",
                  borderRadius: 8,
                  background: "#fff",
                }}
                srcDoc={`<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.8;padding:24px;max-width:680px;margin:auto;color:#262626">${candidate.content}</body></html>`}
              />
            </div>
          </>
        )}
      </Space>
    </Drawer>
  );
}
