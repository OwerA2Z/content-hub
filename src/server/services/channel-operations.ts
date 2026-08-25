import { repository } from "../db/repository";
import { wechatProvider } from "../channels/wechat";

/** 执行微信公众号草稿/发布任务，并在失败时统一回写文章和操作状态。 */
export async function processChannelOperation(operationId: string, articleId: string, action: "draft" | "publish", draftId?: string) {
  try {
    const article = await repository.get(articleId);
    if (!article) throw new Error("文章不存在");
    const existingOperation = await repository.getOperation(operationId);
    const existingPublishId = action === "publish" ? existingOperation?.externalId : undefined;
    const result = action === "draft" ? await wechatProvider.createDraft(article) : { externalId: existingPublishId ?? (await wechatProvider.publish(article, draftId)).externalId };
    if (action === "draft") {
      await repository.completeOperation(operationId, "succeeded", { externalId: result.externalId });
      await repository.updateStatus(articleId, "draft_ready");
      return;
    }
    await repository.setOperationExternalId(operationId, result.externalId);
    await repository.updateStatus(articleId, "publish_pending");
    let publishStatus: "pending" | "succeeded" | "failed" = "pending";
    for (let attempt = 0; attempt < 5 && publishStatus === "pending"; attempt += 1) {
      publishStatus = await wechatProvider.getPublishStatus(result.externalId);
      if (publishStatus === "pending") await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (publishStatus !== "succeeded") throw new Error(publishStatus === "failed" ? "微信公众号发布失败" : "微信公众号发布状态确认超时");
    await repository.confirmPublish(articleId, result.externalId, new Date().toISOString());
    await repository.completeOperation(operationId, "succeeded", { externalId: result.externalId });
  } catch (error) {
    await repository.completeOperation(operationId, "failed", { errorMessage: error instanceof Error ? error.message : "渠道操作失败" });
    await repository.updateStatus(articleId, "sync_failed");
    await repository.recordAudit({ action: `wechat.${action}.failed`, actorType: "system", articleId, operationId, success: false });
  }
}

export async function resumePendingOperations() {
  const pending = await repository.listPendingOperations();
  for (const operation of pending) void processChannelOperation(operation.id, operation.articleId, operation.action, operation.externalId);
}
