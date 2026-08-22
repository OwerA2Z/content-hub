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
});
