import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/server/db/repository";

describe("MemoryRepository", () => {
  it("按 source + externalId 实现上传幂等", async () => {
    const repository = new MemoryRepository();
    const input = { title: "测试文章", content: "<p>正文</p>", contentFormat: "html" as const, source: "feed", externalId: "a-1" };
    const first = await repository.createOrGet(input);
    const second = await repository.createOrGet(input);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.article.id).toBe(first.article.id);
  });

  it("同一文章同一动作复用进行中的操作", async () => {
    const repository = new MemoryRepository();
    const { article } = await repository.createOrGet({ title: "文章", content: "<p>正文</p>", contentFormat: "html" });
    const first = await repository.createOperation(article.id, "draft");
    const second = await repository.createOperation(article.id, "draft");
    expect(second.id).toBe(first.id);
  });

  it("AI 只读取已确认发布文章并支持游标", async () => {
    const repository = new MemoryRepository();
    const first = await repository.createOrGet({ title: "已发布", content: "<p>正文</p>", contentFormat: "html" });
    const second = await repository.createOrGet({ title: "第二篇已发布", content: "<p>正文 2</p>", contentFormat: "html" });
    const draft = await repository.createOrGet({ title: "草稿", content: "<p>草稿</p>", contentFormat: "html" });
    await repository.confirmPublish(first.article.id, "wechat-publish-1", "2026-08-22T00:00:00.000Z");
    await repository.confirmPublish(second.article.id, "wechat-publish-2", "2026-08-23T00:00:00.000Z");
    const page = await repository.listAiArticles({ limit: 1 });
    expect(page.items.map((item) => item.id)).toEqual([second.article.id]);
    expect(page.hasMore).toBe(true);
    const nextPage = await repository.listAiArticles({ limit: 1, cursor: page.nextCursor });
    expect(nextPage.items.map((item) => item.id)).toEqual([first.article.id]);
    expect(nextPage.hasMore).toBe(false);
    expect(await repository.getAiArticle(draft.article.id)).toBeUndefined();
  });

  it("保存内容画像并生成稳定正文指纹", async () => {
    const repository = new MemoryRepository();
    const first = await repository.createOrGet({ title: "画像文章", content: "<p>正文</p>", contentFormat: "html", summary: "核心梗概", outline: ["背景", "结论"], topics: ["内容"], keywords: ["AI"] });
    const second = await repository.createOrGet({ title: "同正文", content: "<div>正文</div>", contentFormat: "html" });
    expect(first.article.summary).toBe("核心梗概");
    expect(first.article.outline).toEqual(["背景", "结论"]);
    expect(first.article.contentHash).toBe(second.article.contentHash);
  });
  it("可以为已有文章补充封面图片", async () => {
    const repository = new MemoryRepository();
    const { article } = await repository.createOrGet({ title: "待发布文章", content: "<p>正文</p>", contentFormat: "html" });
    const updated = await repository.updateMedia(article.id, "https://example.com/cover.jpg", ["https://example.com/cover.jpg"]);
    expect(updated?.coverUrl).toBe("https://example.com/cover.jpg");
    expect(updated?.images).toEqual(["https://example.com/cover.jpg"]);
  });
});
