import { describe, expect, it } from "vitest";
import { MemoryUserStore } from "../src/server/users";

describe("首次管理员初始化", () => {
  it("只允许创建一次，并验证密码哈希登录", async () => {
    const store = new MemoryUserStore();
    expect(await store.hasUsers()).toBe(false);
    await store.createFirstUser("owner", "a-very-strong-password");
    expect(await store.hasUsers()).toBe(true);
    expect(await store.authenticate("owner", "wrong-password")).toBeUndefined();
    expect((await store.authenticate("owner", "a-very-strong-password"))?.username).toBe("owner");
    await expect(store.createFirstUser("second", "another-strong-password")).rejects.toThrow("已初始化");
  });

  it("恢复码只能使用一次并会重置密码", async () => {
    const store = new MemoryUserStore();
    await store.createFirstUser("owner", "a-very-strong-password");
    const recovery = await store.generateRecoveryCode("owner");
    expect(await store.resetPassword("owner", "invalid-code", "a-new-strong-password")).toBe(false);
    expect(await store.resetPassword("owner", recovery.code, "a-new-strong-password")).toBe(true);
    expect(await store.authenticate("owner", "a-very-strong-password")).toBeUndefined();
    expect((await store.authenticate("owner", "a-new-strong-password"))?.username).toBe("owner");
    expect((await store.authenticate("owner", "a-new-strong-password"))?.sessionVersion).toBe(1);
    expect(await store.resetPassword("owner", recovery.code, "another-strong-password")).toBe(false);
  });
});
