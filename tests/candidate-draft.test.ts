import { describe, expect, it, vi } from "vitest";
import { resolveCandidateDraft } from "../src/client/features/candidates/candidateDraftDecision";
import type { AutoDraftResult } from "../src/shared/contracts";

const candidate = { id: "candidate-1", status: "recommended" as const };
function dependencies(autoDraft?: AutoDraftResult) {
  return {
    accept: vi.fn().mockResolvedValue({ data: { article: { id: "article-1" }, autoDraft } }),
    createDraft: vi.fn().mockResolvedValue({ data: { id: "manual-operation" } }),
  };
}

describe("内容池草稿提交决策", () => {
  it("采纳已自动提交时沿用 operationId，不再提交草稿", async () => {
    const api = dependencies({ status: "submitted", operationId: "auto-operation" });
    expect(await resolveCandidateDraft(candidate, api)).toBe("auto-operation");
    expect(api.accept).toHaveBeenCalledWith(candidate.id);
    expect(api.createDraft).not.toHaveBeenCalled();
  });

  it.each<AutoDraftResult | undefined>([
    { status: "disabled" }, { status: "skipped", code: "COVER_REQUIRED", reason: "缺少封面" },
    { status: "not_new" }, undefined,
  ])("未自动提交时对采纳文章手动提交：%j", async (autoDraft) => {
    const api = dependencies(autoDraft);
    expect(await resolveCandidateDraft(candidate, api)).toBe("manual-operation");
    expect(api.createDraft).toHaveBeenCalledWith("article-1");
  });

  it("已采纳直接对 acceptedArticleId 提交", async () => {
    const api = dependencies();
    await resolveCandidateDraft({ ...candidate, status: "accepted", acceptedArticleId: "existing-article" }, api);
    expect(api.accept).not.toHaveBeenCalled();
    expect(api.createDraft).toHaveBeenCalledWith("existing-article");
  });

  it.each(["stale", "rejected"] as const)("%s 不可上传", async (status) => {
    const api = dependencies();
    await expect(resolveCandidateDraft({ ...candidate, status }, api)).rejects.toThrow("已失效");
    expect(api.accept).not.toHaveBeenCalled();
    expect(api.createDraft).not.toHaveBeenCalled();
  });

  it("采纳后请求失效，不继续提交草稿，但保留采纳结果", async () => {
    const api = dependencies();
    const accepted = vi.fn();
    expect(await resolveCandidateDraft(candidate, api, () => false, accepted)).toBeUndefined();
    expect(accepted).toHaveBeenCalledWith("article-1");
    expect(api.createDraft).not.toHaveBeenCalled();
  });

  it("草稿前置条件失败时仍已通知采纳成功，并透传实际原因", async () => {
    const api = dependencies();
    api.createDraft.mockRejectedValue(new Error("请先补充封面"));
    const accepted = vi.fn();
    await expect(resolveCandidateDraft(candidate, api, () => true, accepted)).rejects.toThrow("请先补充封面");
    expect(accepted).toHaveBeenCalledWith("article-1");
  });
});
