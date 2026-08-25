/** 兼容旧调用方的领域 API 门面；新页面优先直接依赖对应领域模块。 */
import { authApi } from "./api/auth";
import { articleApi } from "./api/articles";
import { integrationApi } from "./api/integrations";
import { adminTokenApi } from "./api/admin-tokens";
import { planningApi } from "./api/planning";

export * from "./api/types";

export const api = {
  ...authApi,
  listArticles: articleApi.list,
  getArticle: articleApi.get,
  archiveArticle: articleApi.archive,
  restoreArticle: articleApi.restore,
  getCapabilities: articleApi.capabilities,
  createDraft: articleApi.createDraft,
  publish: articleApi.publish,
  getOperation: articleApi.getOperation,
  retry: articleApi.retry,
  getAiIntegration: integrationApi.getAi,
  createToken: adminTokenApi.create,
  revokeToken: adminTokenApi.revoke,
  ...planningApi,
};

export { authApi, articleApi, integrationApi, planningApi };
