import { describe, expect, it } from "vitest";
import { MemoryTokenStore } from "../src/server/tokens";

describe("Token 权限管理", () => {
  it("生成的 token 按 scope 校验权限，撤销后立即失效", async () => {
    const store = new MemoryTokenStore();
    const created = await store.create("AI读取", ["articles:read", "dedup:check"]);
    expect(created.secret).toBeTruthy();
    expect(await store.verify(created.secret, ["articles:read"])).toBe(true);
    expect(await store.verify(created.secret, ["articles:read", "dedup:check"])).toBe(true);
    expect(await store.verify(created.secret, ["articles:write"])).toBe(false);
    expect((await store.list())[0]?.prefix).toBe(created.info.prefix);
    expect(await store.revoke(created.info.id)).toBe(true);
    expect(await store.verify(created.secret, ["articles:read"])).toBe(false);
    expect(await store.updateScopes(created.info.id, ["articles:write"])).toBeUndefined();
    await expect(store.create("非法权限", ["unknown:scope" as never])).rejects.toThrow("未知权限");
  });

  it("编辑 Token 权限后立即按新 scope 校验", async () => {
    const store = new MemoryTokenStore();
    const created = await store.create("可编辑", ["articles:read"]);
    const updated = await store.updateScopes(created.info.id, ["articles:write", "dedup:check"]);
    expect(updated?.scopes).toEqual(["articles:write", "dedup:check"]);
    expect(updated?.prefix).toBe(created.info.prefix);
    expect(await store.verify(created.secret, ["articles:read"])).toBe(false);
    expect(await store.verify(created.secret, ["articles:write"])).toBe(true);
    await expect(store.updateScopes(created.info.id, [])).rejects.toThrow("至少需要一个有效权限");
    await expect(store.updateScopes("missing", ["articles:read"])).resolves.toBeUndefined();
  });
});
