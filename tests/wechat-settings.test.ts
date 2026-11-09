import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WechatSettingsStore } from "../src/server/wechat-settings";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "wechat-settings-")); roots.push(root);
  const filename = join(root, ".private/wechat.json");
  return { filename, store: new WechatSettingsStore(filename, "test-encryption-key", () => ({ appId: "", appSecret: "" })) };
}

describe("公众号配置存储", () => {
  it("加密持久化且响应不包含 Secret，重建实例仍可读取", async () => {
    const { filename, store } = await fixture();
    await expect(store.save({ appId: "wx1234567890123456" })).rejects.toThrow("首次配置");
    const info = await store.save({ appId: "wx1234567890123456", appSecret: "test-only-secret" });
    expect(info).toEqual({ appId: "wx1234567890123456", hasSecret: true, source: "saved" });
    expect(await readFile(filename, "utf8")).not.toContain("test-only-secret");
    expect((await stat(filename)).mode & 0o777).toBe(0o600);
    const reopened = new WechatSettingsStore(filename, "test-encryption-key", () => ({ appId: "env", appSecret: "fallback" }));
    expect(await reopened.credentials()).toEqual({ appId: info.appId, appSecret: "test-only-secret" });
    await reopened.save({ appId: info.appId, appSecret: "" });
    expect((await reopened.credentials()).appSecret).toBe("test-only-secret");
    await expect(reopened.save({ appId: "wx6543210987654321" })).rejects.toThrow("更换 AppID");
    const wrongKey = new WechatSettingsStore(filename, "another-key", () => ({ appId: "env", appSecret: "fallback" }));
    await expect(wrongKey.credentials()).rejects.toThrow("无法解密");
  });

  it("未保存时回退环境变量，保存后优先页面配置", async () => {
    const { filename } = await fixture();
    const store = new WechatSettingsStore(filename, "test-key", () => ({ appId: "wx1234567890123456", appSecret: "env-secret" }));
    expect((await store.info()).source).toBe("environment");
    await store.save({ appId: "wx1234567890123456" });
    expect(await store.credentials()).toEqual({ appId: "wx1234567890123456", appSecret: "env-secret" });
    expect((await store.info()).source).toBe("saved");
  });
});
