import type { AutoDraftResult } from "../../../shared/contracts";
import type { ContentCandidate } from "../../lib/api/types";

type DraftCandidate = Pick<ContentCandidate, "id" | "status" | "acceptedArticleId">;
interface DraftDependencies {
  accept: (id: string) => Promise<{ data: { article: { id: string }; autoDraft?: AutoDraftResult } }>;
  createDraft: (id: string) => Promise<{ data: { id: string } }>;
}

/** 只使用现有接口；采纳已自动提交时必须复用任务，避免成功后再次上传。 */
export async function resolveCandidateDraft(
  candidate: DraftCandidate,
  api: DraftDependencies,
  active: () => boolean = () => true,
  onAccepted: (articleId: string) => void = () => {},
): Promise<string | undefined> {
  if (candidate.status === "stale" || candidate.status === "rejected") {
    throw new Error("候选文章已失效，不能上传草稿箱");
  }
  let articleId = candidate.acceptedArticleId;
  if (candidate.status !== "accepted") {
    const { data } = await api.accept(candidate.id);
    // 即使上传失败，也先保留采纳结果；调用方负责隔离页面卸载与当前预览。
    onAccepted(data.article.id);
    if (!active()) return;
    if (data.autoDraft?.status === "submitted") return data.autoDraft.operationId;
    articleId = data.article.id;
  }
  if (!active()) return;
  if (!articleId) throw new Error("已采纳候选缺少文章 ID，请刷新后重试");
  return (await api.createDraft(articleId)).data.id;
}
