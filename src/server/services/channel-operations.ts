import { repository } from "../db/repository";
import { wechatProvider } from "../channels/wechat";
import { candidatePoolStore } from "../candidate-pools";

/** 只提取允许记录的标量字段，避免序列化 stack、请求体或渠道原始响应。 */
function describeError(error: unknown) {
  const source: Record<string, unknown> = error !== null && typeof error === "object" ? error as Record<string, unknown> : {};
  // 先脱敏再截断，防止截断把查询参数切成无法识别的凭证片段。
  const sanitize = (value: string) => value.replace(/(\b(?:access_token|secret|appsecret)=)[^&#\s"'<>]*/gi, "$1***").slice(0, 300);
  const description: Record<string, string | number> = {
    name: typeof source.name === "string" ? source.name : "Error",
    message: sanitize(typeof source.message === "string" ? source.message : typeof error === "string" ? error : "渠道操作失败"),
  };
  // 微信错误码为数字，数据库 SQLSTATE 和其他系统错误码通常为字符串；不透传对象。
  if (typeof source.code === "string" || (typeof source.code === "number" && Number.isFinite(source.code))) description.code = source.code;
  if (typeof source.code === "string" && /^[0-9A-Z]{5}$/.test(source.code)) {
    if (typeof source.detail === "string") description.detail = sanitize(source.detail);
    for (const field of ["table", "column"] as const) {
      if (typeof source[field] === "string") description[field] = source[field];
    }
  }
  return description;
}

/** 执行微信公众号草稿/发布任务，并在失败时统一回写文章和操作状态。 */
export async function processChannelOperation(operationId: string, articleId: string, action: "draft" | "publish", draftId?: string) {
  try {
    const article = await repository.get(articleId);
    if (!article) throw new Error("文章不存在");
    const existingOperation = await repository.getOperation(operationId);
    const existingPublishId = action === "publish" ? existingOperation?.externalId : undefined;
    const result = action === "draft" ? await wechatProvider.createDraft(article) : { externalId: existingPublishId ?? (await wechatProvider.publish(article, draftId)).externalId };
    if (action === "draft") {
      // 先更新文章，再标记任务完成，确保前端看到完成状态时详情已可读取。
      await repository.updateStatus(articleId, "draft_ready");
      await repository.completeOperation(operationId, "succeeded", { externalId: result.externalId });
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
    // 发布成功后异步重评估当天候选，避免候选池阻塞微信公众号发布响应。
    void candidatePoolStore.recheck().catch(() => undefined);
  } catch (error) {
    // 三步回写独立兜底：数据库局部故障不能阻断后续操作状态与审计的落库尝试。
    const logFailure = (message: string, cause: unknown) => console.error(JSON.stringify({ level: "error", message, operationId, articleId, action, error: describeError(cause) }));
    try {
      await repository.updateStatus(articleId, "sync_failed");
    } catch (writeError) {
      logFailure("渠道操作失败：文章状态回写失败", writeError);
    }
    try {
      await repository.completeOperation(operationId, "failed", { errorMessage: error instanceof Error ? error.message : "渠道操作失败" });
    } catch (writeError) {
      logFailure("渠道操作失败：操作状态回写失败", writeError);
    }
    try {
      await repository.recordAudit({ action: `wechat.${action}.failed`, actorType: "system", articleId, operationId, success: false });
    } catch (writeError) {
      logFailure("渠道操作失败：审计写入失败", writeError);
    }
    // 业务异常与每个回写异常分别记录，保留各自原因且不改变持久化错误内容。
    logFailure("渠道操作失败", error);
  }
}

export async function resumePendingOperations() {
  try {
    const pending = await repository.listPendingOperations();
    // 保留并发恢复；每个任务自行收口异常，等待全部完成后入口也安全 resolve。
    await Promise.all(pending.map((operation) => processChannelOperation(operation.id, operation.articleId, operation.action, operation.externalId)));
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "查询待恢复渠道操作失败", error: describeError(error) }));
  }
}
