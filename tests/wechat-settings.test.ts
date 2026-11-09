import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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
    expect(info).toEqual({ appId: "wx1234567890123456", hasSecret: true, source: "saved", autoDraft: false });
    expect(await readFile(filename, "utf8")).not.toContain("test-only-secret");
    expect((await stat(filename)).mode & 0o777).toBe(0o600);
    const reopened = new WechatSettingsStore(filename, "test-encryption-key", () => ({ appId: "env", appSecret: "fallback" }));
    expect(await reopened.credentials()).toEqual({ appId: info.appId, appSecret: "test-only-secret" });
    await reopened.save({ appId: info.appId, appSecret: "" });
    expect((await reopened.credentials()).appSecret).toBe("test-only-secret");
    await expect(reopened.save({ appId: "wx6543210987654321" })).rejects.toThrow("更换 AppID");
    const wrongKey = new WechatSettingsStore(filename, "another-key", () => ({ appId: "env", appSecret: "fallback" }));
    await expect(wrongKey.credentials()).rejects.toThrow("无法解密");
    expect(await wrongKey.info()).toEqual({ appId: "", hasSecret: false, source: "unreadable", autoDraft: false });
    await expect(wrongKey.save({ appId: info.appId, appSecret: "" })).rejects.toThrow("同时填写");
    await expect(wrongKey.save({ appId: "", appSecret: "replacement" })).rejects.toThrow("同时填写");
    await wrongKey.save({ appId: info.appId, appSecret: "replacement" });
    expect(await wrongKey.credentials()).toEqual({ appId: info.appId, appSecret: "replacement" });
    expect((await wrongKey.info()).source).toBe("saved");
    const recovered = new WechatSettingsStore(filename, "another-key", () => ({ appId: "", appSecret: "" }));
    expect((await recovered.credentials()).appSecret).toBe("replacement");
  });

  it("开关独立持久化，默认关闭且无需凭证，错密钥仍可读写", async () => {
    const { filename, store } = await fixture();
    expect(await store.options()).toEqual({ autoDraft: false });
    await store.saveOptions({ autoDraft: true });
    expect((await stat(join(filename, "../wechat-options.json"))).mode & 0o777).toBe(0o600);
    await store.save({ appId: "wx1234567890123456", appSecret: "test-secret" });
    const reopened = new WechatSettingsStore(filename, "wrong-key", () => ({ appId: "", appSecret: "" }));
    expect(await reopened.info()).toMatchObject({ source: "unreadable", autoDraft: true });
    await reopened.saveOptions({ autoDraft: false });
    expect((await store.info()).autoDraft).toBe(false);
  });

  it.each(["{broken", '{"autoDraft":"true"}', '{"autoDraft":1}', "null", "{}"])("损坏开关 %s 读取时关闭，保存后恢复", async (raw) => {
    const { filename, store } = await fixture();
    await store.saveOptions({ autoDraft: true });
    await writeFile(join(filename, "../wechat-options.json"), raw);
    expect(await store.options()).toEqual({ autoDraft: false });
    expect(await store.info()).toMatchObject({ autoDraft: false });
    await store.saveOptions({ autoDraft: true });
    expect(await store.options()).toEqual({ autoDraft: true });
    expect(await store.info()).toMatchObject({ autoDraft: true });
  });

  it("非 ENOENT 的文件读取错误仍抛出", async () => {
    const { filename, store } = await fixture();
    // 用目录占据文件路径，稳定模拟读取失败，不依赖测试进程的权限身份。
    await mkdir(join(filename, "../wechat-options.json"), { recursive: true });
    await expect(store.options()).rejects.toMatchObject({ code: "EISDIR" });
    await expect(store.info()).rejects.toMatchObject({ code: "EISDIR" });
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
