import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Empty, Flex, List, Space, Spin, Tag, Typography } from "antd";
import { RefreshCw, Sparkles } from "lucide-react";
import { candidateApi } from "../../lib/api/candidates";
import type { CandidatePool, ContentCandidate } from "../../lib/api/types";
import { useCandidateDraft } from "./useCandidateDraft";
import { CandidatePreview } from "./CandidatePreview";

const riskLabel = { low: "低风险", medium: "中风险", high: "高风险", exact: "完全重复" } as const;
const riskColor = { low: "green", medium: "orange", high: "red", exact: "red" } as const;

export function CandidatePoolPage() {
  const [pool, setPool] = useState<CandidatePool>();
  const [candidates, setCandidates] = useState<ContentCandidate[]>([]);
  const [selected, setSelected] = useState<ContentCandidate>();
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string>();

  const mounted = useRef(true);
  const loadRun = useRef(0);
  const load = () => {
    // 采纳与任务完成都可能刷新，只接受最后一次请求，避免旧列表覆盖已采纳状态。
    const run = ++loadRun.current;
    const active = () => mounted.current && loadRun.current === run;
    setLoading(true);
    candidateApi
      .daily()
      .then((result) => {
        if (!active()) return;
        setPool(result.data.pool);
        setSelected((previous) => previous && result.data.candidates.find((item) => item.id === previous.id));
        setCandidates(result.data.candidates);
      })
      .catch(() => { if (active()) setNotice("加载每日候选池失败"); })
      .finally(() => { if (active()) setLoading(false); });
  };

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  }, []);

  const { uploadingId, uploadDraft, draftNotice } = useCandidateDraft({
    onNotice: setNotice,
    onComplete: load,
    onAccepted: (candidateId, articleId) => {
      // 只更新同一候选，关闭/切换后的预览不接收旧候选结果。
      const markAccepted = (item: ContentCandidate): ContentCandidate =>
        item.id === candidateId ? { ...item, status: "accepted", acceptedArticleId: articleId } : item;
      setCandidates((items) => items.map(markAccepted));
      setSelected((item) => item && markAccepted(item));
      load();
    },
  });
  const select = (candidate?: ContentCandidate) => {
    // 预览选择不影响上传生命周期；结果在预览入口按 candidateId 过滤，避免串写。
    setSelected(candidate);
  };

  const recheck = () => {
    if (rechecking) return;
    setRechecking(true);
    candidateApi
      .recheck()
      .then(() => {
        setNotice("候选池已重新评估");
        load();
      })
      .catch(() => setNotice("重新评估失败"))
      .finally(() => setRechecking(false));
  };

  const accept = (candidate: ContentCandidate) => {
    if (acceptingId || uploadingId) return;
    setAcceptingId(candidate.id);
    candidateApi
      .accept(candidate.id)
      .then(() => {
        setSelected(undefined);
        setNotice(`已接受《${candidate.title}》，文章已保存至文章库`);
        load();
      })
      .catch(() => setNotice("接受候选文章失败"))
      .finally(() => setAcceptingId(undefined));
  };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Flex align="flex-end" justify="space-between" wrap="wrap" gap="middle">
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>
            DAILY CANDIDATE POOL
          </Typography.Text>
          <Typography.Title level={2} style={{ margin: "4px 0 8px 0" }}>
            AI 推荐文章
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            每天维护一组候选文章，发布后自动重新比较和去重排序。
          </Typography.Paragraph>
        </div>
        <Space>
          <Button icon={<RefreshCw size={15} />} onClick={load} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<Sparkles size={15} />} onClick={recheck} loading={rechecking}>
            重新评估
          </Button>
        </Space>
      </Flex>

      <Card
        title={`${pool?.poolDate ?? "今日"} 候选池`}
        extra={
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            系统推荐前 3 篇高质量文章
          </Typography.Text>
        }
      >
        {notice && <Alert type="info" showIcon message={notice} closable onClose={() => setNotice("")} style={{ marginBottom: 16 }} />}

        {loading ? (
          <Flex justify="center" style={{ padding: 40 }}>
            <Spin />
          </Flex>
        ) : candidates.length === 0 ? (
          <Empty description="今日还没有候选文章，请让 AI 管道提交候选内容。" />
        ) : (
          <List
            dataSource={candidates}
            renderItem={(candidate, index) => (
              <List.Item
                style={{ padding: "16px 0", borderBottom: "1px solid #f0f0f0" }}
                actions={[
                  ...(candidate.status !== "stale" && candidate.status !== "rejected" ? [
                    <Button key="draft" loading={uploadingId === candidate.id}
                      disabled={Boolean(uploadingId || acceptingId)}
                      onClick={() => void uploadDraft(candidate)}>上传草稿箱</Button>,
                  ] : []),
                  <Button key="preview" onClick={() => select(candidate)}>
                    预览全文
                  </Button>,
                  ...(candidate.status !== "accepted" && candidate.status !== "stale" && candidate.status !== "rejected"
                    ? [
                        <Button
                          key="accept"
                          type="primary"
                          loading={acceptingId === candidate.id}
                          disabled={Boolean(uploadingId || acceptingId)}
                          onClick={() => accept(candidate)}
                        >
                          接受并保存文章
                        </Button>,
                      ]
                    : []),
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space wrap align="center">
                      <Typography.Text strong style={{ fontSize: 15 }}>
                        {index + 1}. {candidate.title}
                      </Typography.Text>
                      <Tag color={riskColor[candidate.risk]}>{riskLabel[candidate.risk]}</Tag>
                      <Tag color="blue">评分 {Math.round(candidate.score * 100)}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={6} style={{ width: "100%", marginTop: 4 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                        {candidate.summary || candidate.digest || "暂无梗概"}
                      </Typography.Text>
                      <Space split={<span style={{ color: "#d9d9d9" }}>·</span>} style={{ fontSize: 12 }}>
                        <span>相似度 {Math.round(candidate.similarity * 100)}%</span>
                        <Tag
                          color={
                            candidate.status === "recommended"
                              ? "green"
                              : candidate.status === "accepted"
                                ? "blue"
                                : candidate.status === "stale"
                                  ? "default"
                                  : "cyan"
                          }
                        >
                          {candidate.status === "recommended"
                            ? "强烈推荐"
                            : candidate.status === "accepted"
                              ? "已接受"
                              : candidate.status === "stale"
                                ? "已过时"
                                : "候选"}
                        </Tag>
                      </Space>
                      {candidate.warnings.length > 0 && (
                        <Alert
                          type="warning"
                          showIcon
                          message="生成警告"
                          description={
                            <ul style={{ margin: 0, paddingLeft: 16 }}>
                              {candidate.warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          }
                          style={{ marginTop: 8 }}
                        />
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <CandidatePreview
        candidate={selected}
        onOpenChange={(open) => {
          if (!open) select();
        }}
        onAccept={accept}
        onUploadDraft={uploadDraft}
        draftNotice={draftNotice?.candidateId === selected?.id ? draftNotice?.message : undefined}
        uploadingId={uploadingId}
        acceptingId={acceptingId}
        onNotice={setNotice}
      />
    </Space>
  );
}
