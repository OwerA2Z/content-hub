import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { uploadArticle } from "../src/server/services/article-upload";
import { maybeAutoDraft } from "../src/server/services/wechat-draft";
import { wechatSettings } from "../src/server/wechat-settings";
import { wechatProvider } from "../src/server/channels/wechat";
import { repository } from "../src/server/db/repository";
import { mediaAssetRepository } from "../src/server/media-library";

afterEach(() => vi.restoreAllMocks());
const input = () => ({ contentFormat: "html" as const, title: "自动草稿测试", content: "<p>正文</p>", source: "auto-test", externalId: randomUUID(), coverUrl: "https://example.com/cover.jpg" });

// 所有渠道调用均替换为本地桩，测试不得访问真实公众号。
function setup(autoDraft: boolean, configured = true) {
  vi.spyOn(wechatSettings, "options").mockResolvedValue({ autoDraft });
  vi.spyOn(wechatProvider, "getCapabilities").mockResolvedValue({ provider: "wechat", draft: configured, publish: false, reason: configured ? undefined : "公众号未配置" });
  vi.spyOn(wechatProvider, "createDraft").mockResolvedValue({ externalId: "mock-draft" });
  return { audit: vi.spyOn(repository, "recordAudit"), operations: vi.spyOn(repository, "createOperation") };
}

describe("新文章自动草稿", () => {
  it("默认关闭不创建操作", async () => {
    const { operations } = setup(false);
    expect((await uploadArticle(input())).autoDraft).toEqual({ status: "disabled" });
    expect(operations).not.toHaveBeenCalled();
  });
  it("开启后创建草稿并返回 operationId，重复 externalId 不重复提交", async () => {
    const { operations, audit } = setup(true);
    const body = input();
    const result = await uploadArticle(body);
    expect(result.autoDraft).toMatchObject({ status: "submitted", operationId: expect.any(String) });
    if (result.autoDraft.status !== "submitted") throw new Error("未提交草稿");
    await vi.waitFor(async () => expect((await repository.getOperation(result.autoDraft.status === "submitted" ? result.autoDraft.operationId : ""))?.status).toBe("succeeded"));
    expect((await repository.get(result.article.id))?.status).toBe("draft_ready");
    expect((await uploadArticle(body)).autoDraft).toEqual({ status: "not_new" });
    expect(operations).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "wechat.draft.auto", actorType: "system" }));
  });
  it.each(["cover", "config"])("%s 不满足时仍入库，跳过且审计错误码", async (missing) => {
    const { operations, audit } = setup(true, missing !== "config");
    const result = await uploadArticle({ ...input(), ...(missing === "cover" ? { coverUrl: undefined } : {}) });
    expect(result.created).toBe(true);
    const code = missing === "cover" ? "COVER_REQUIRED" : "CHANNEL_CAPABILITY_UNAVAILABLE";
    expect(result.autoDraft).toMatchObject({ status: "skipped", code, reason: expect.any(String) });
    expect(await repository.get(result.article.id)).toBeDefined();
    expect(operations).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: `wechat.draft.auto_skipped:${code}`, actorType: "system", actorId: undefined }));
  });
  it.each(["precondition", "error"])("%s 跳过审计保留真实操作者，完整原因只在响应返回", async (branch) => {
    const { audit } = setup(true);
    const { article } = await repository.createOrGet(input());
    if (branch === "error") vi.mocked(wechatSettings.options).mockRejectedValue(new Error("private details"));
    const result = await maybeAutoDraft({ ...article, coverUrl: undefined, images: [] }, true, { actorType: "api", actorId: "trigger-actor" });
    const code = branch === "error" ? "AUTO_DRAFT_ERROR" : "COVER_REQUIRED";
    expect(result).toMatchObject({ status: "skipped", code, reason: expect.any(String) });
    expect(audit).toHaveBeenCalledWith({
      action: `wechat.draft.auto_skipped:${code}`, actorType: "system", actorId: "trigger-actor", articleId: article.id, success: false,
    });
  });
  it("素材失效及配置读取异常均安全跳过，审计失败也不抛出", async () => {
    const { audit } = setup(true);
    const { article } = await repository.createOrGet(input());
    vi.spyOn(mediaAssetRepository, "get").mockResolvedValue(undefined);
    expect(await maybeAutoDraft({ ...article, coverAssetId: "missing" }, true, { actorType: "api" })).toMatchObject({ status: "skipped", code: "MEDIA_ASSET_UNAVAILABLE" });
    vi.mocked(wechatSettings.options).mockRejectedValue(new Error("private details"));
    audit.mockRejectedValue(new Error("audit unavailable"));
    expect(await maybeAutoDraft(article, true, { actorType: "api" })).toMatchObject({ status: "skipped", code: "AUTO_DRAFT_ERROR" });
  });
});
