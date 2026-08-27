import { repository } from "../db/repository";
import { wechatProvider } from "../channels/wechat";
import { contentPlanningStore } from "../content-planning";
import { uploadArticleSchema } from "../../shared/contracts";
import { mediaAssetRepository } from "../media-library";

/** 统一处理后台/API/AI 的文章上传，保证幂等、内容规划关联和审计行为一致。 */
export async function uploadArticle(input: unknown) {
  const parsed = uploadArticleSchema.safeParse(input);
  if (!parsed.success) {
    const error = new Error("文章字段校验失败");
    Object.assign(error, { status: 400, code: "VALIDATION_ERROR", details: parsed.error.flatten() });
    throw error;
  }
  let uploadInput = parsed.data;
  if (uploadInput.coverAssetId) {
    const asset = await mediaAssetRepository.get(uploadInput.coverAssetId);
    if (!asset || asset.status !== "active") {
      const error = new Error("封面素材不存在或已归档");
      Object.assign(error, { status: 400, code: "MEDIA_ASSET_UNAVAILABLE" });
      throw error;
    }
  }
  if (uploadInput.briefId) {
    const context = await contentPlanningStore.getBriefContext(uploadInput.briefId);
    if (!context) { const error = new Error("文章任务不存在"); Object.assign(error, { status: 404, code: "BRIEF_NOT_FOUND" }); throw error; }
    if ((uploadInput.seriesId && uploadInput.seriesId !== context.series.id) || (uploadInput.strategyId && uploadInput.strategyId !== context.strategy.id)) { const error = new Error("文章任务与内容战略/系列不匹配"); Object.assign(error, { status: 409, code: "BRIEF_RELATION_CONFLICT" }); throw error; }
    uploadInput = { ...uploadInput, seriesId: context.series.id, strategyId: context.strategy.id };
  }
  const result = await repository.createOrGet(uploadInput);
  await repository.recordAudit({ action: result.created ? "article.upload" : "article.upload.idempotent", actorType: "api", articleId: result.article.id });
  return { article: result.article, created: result.created, capabilities: await wechatProvider.getCapabilities() };
}
