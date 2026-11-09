import type { Article, AutoDraftResult } from "../../shared/contracts";
import { repository, type AuditEntry } from "../db/repository";
import { wechatProvider } from "../channels/wechat";
import { mediaAssetRepository } from "../media-library";
import { wechatSettings } from "../wechat-settings";
import { processChannelOperation } from "./channel-operations";

type Actor = Pick<AuditEntry, "actorType" | "actorId">;
type Preconditions = { ok: true } | { ok: false; status: number; code: string; reason: string };

/** 手动和自动提交共享校验顺序，保留手动接口的状态码与提示。 */
export async function checkDraftPreconditions(article: Article): Promise<Preconditions> {
  if (!article.coverAssetId && !article.coverUrl && !article.images[0]) return { ok: false, status: 400, code: "COVER_REQUIRED", reason: "创建微信公众号草稿前必须提供封面素材、coverUrl 或 images[0]" };
  if (article.coverAssetId) {
    const asset = await mediaAssetRepository.get(article.coverAssetId);
    if (!asset || asset.status !== "active") return { ok: false, status: 400, code: "MEDIA_ASSET_UNAVAILABLE", reason: "创建微信公众号草稿前必须提供有效的封面素材" };
  }
  const capabilities = await wechatProvider.getCapabilities();
  if (!capabilities.draft) return { ok: false, status: 403, code: "CHANNEL_CAPABILITY_UNAVAILABLE", reason: capabilities.reason ?? "当前公众号不支持此操作" };
  return { ok: true };
}

export async function submitDraftOperation(article: Article, actor: Actor, automatic = false) {
  const operation = await repository.createOperation(article.id, "draft");
  await repository.recordAudit({ ...actor, action: automatic ? "wechat.draft.auto" : "wechat.draft", articleId: article.id, operationId: operation.id });
  void processChannelOperation(operation.id, article.id, "draft");
  return operation;
}

/** 仅新建文章触发；自动草稿失败不能推翻已完成的文章入库。 */
export async function maybeAutoDraft(article: Article, created: boolean, actor: Actor): Promise<AutoDraftResult> {
  const skipped = async (code: string, reason: string): Promise<AutoDraftResult> => {
    // 错误码写入 action，保留触发入库的操作者；完整原因仅通过响应返回。
    await repository.recordAudit({ action: `wechat.draft.auto_skipped:${code}`, actorType: "system", actorId: actor.actorId, articleId: article.id, success: false });
    return { status: "skipped", code, reason };
  };
  try {
    if (!(await wechatSettings.options()).autoDraft) return { status: "disabled" };
    if (!created) return { status: "not_new" };
    const check = await checkDraftPreconditions(article);
    if (!check.ok) return await skipped(check.code, check.reason);
    const operation = await submitDraftOperation(article, { actorType: "system", actorId: actor.actorId }, true);
    return { status: "submitted", operationId: operation.id };
  } catch {
    // 不回显底层异常（可能包含凭证或文件路径）；审计不可用也不能阻断入库响应。
    const reason = "自动草稿提交失败，请检查公众号配置与服务状态后手动上传";
    try { return await skipped("AUTO_DRAFT_ERROR", reason); }
    catch { return { status: "skipped", code: "AUTO_DRAFT_ERROR", reason }; }
  }
}
