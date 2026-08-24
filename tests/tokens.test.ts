import { describe, expect, it } from "vitest";
import { MemoryTokenStore } from "../src/server/tokens";

describe("Token 管理", () => {
  it("生成的 token 只能验证对应类型，撤销后立即失效", async () => {
    const store = new MemoryTokenStore();
    const created = await store.create("AI读取", "ai_read");
    expect(created.secret).toBeTruthy();
    expect(await store.verify("ai_read", created.secret)).toBe(true);
    expect(await store.verify("ai_write", created.secret)).toBe(false);
    expect((await store.list())[0]?.prefix).toBe(created.info.prefix);
    expect(await store.revoke(created.info.id)).toBe(true);
    expect(await store.verify("ai_read", created.secret)).toBe(false);
  });
});
