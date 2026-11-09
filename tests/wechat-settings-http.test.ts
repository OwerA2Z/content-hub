import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "../src/server/app";
import { wechatSettings, WechatSettingsStore } from "../src/server/wechat-settings";
import { repository } from "../src/server/db/repository";
import { candidatePoolStore, currentPoolDate } from "../src/server/candidate-pools";
import { wechatProvider } from "../src/server/channels/wechat";

let server: Server | undefined;
let root: string | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => server ? server.close(() => resolve()) : resolve());
  if (root) await rm(root, { recursive: true, force: true });
});

describe("公众号配置管理员接口", () => {
  it("拒绝未登录和普通 Token；保存不回显密钥，连接成功与失败均返回明确结果", async () => {
    root = await mkdtemp(join(tmpdir(), "wechat-http-"));
    const store = new WechatSettingsStore(join(root, "settings.json"), "test-key", () => ({ appId: "", appSecret: "" }));
    vi.spyOn(wechatSettings, "info").mockImplementation(() => store.info());
    vi.spyOn(wechatSettings, "save").mockImplementation((input) => store.save(input));
    vi.spyOn(wechatSettings, "saveOptions").mockImplementation((input) => store.saveOptions(input));
    vi.spyOn(wechatSettings, "options").mockImplementation(() => store.options());
    server = createServer(app);
    await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(0, "127.0.0.1", resolve); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("测试服务器未监听");
    const url = `http://127.0.0.1:${address.port}/api/v1`;
    for (const [path, method] of [["settings", "GET"], ["settings", "PUT"], ["options", "PUT"], ["test", "POST"]]) {
      const response = await fetch(`${url}/channels/wechat/${path}`, { method, headers: { authorization: "Bearer local-development-api-token" } });
      expect(response.status).toBe(401);
    }
    const initialized = await fetch(`${url}/setup/initialize`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "wechat-admin", password: "test-admin-password" }) });
    const cookie = initialized.headers.get("set-cookie")!.split(";")[0];
    const headers = { cookie, "content-type": "application/json" };
    // 开关无需凭证，且与 settings PUT 的凭证契约独立。
    for (const authorization of [undefined, "Bearer local-development-api-token"]) {
      expect((await fetch(`${url}/channels/wechat/settings`, { headers: authorization ? { authorization } : {} })).status).toBe(401);
      expect((await fetch(`${url}/channels/wechat/options`, { method: "PUT", headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) }, body: JSON.stringify({ autoDraft: true }) })).status).toBe(401);
    }
    const toggled = await fetch(`${url}/channels/wechat/options`, { method: "PUT", headers, body: JSON.stringify({ autoDraft: true }) });
    expect(toggled.status).toBe(200);
    expect(toggled.headers.get("cache-control")).toBe("no-store");
    expect(await toggled.json()).toEqual({ data: { autoDraft: true } });
    expect((await store.info()).autoDraft).toBe(true);
    expect((await fetch(`${url}/channels/wechat/options`, { method: "PUT", headers, body: JSON.stringify({ autoDraft: "true" }) })).status).toBe(400);
    await store.saveOptions({ autoDraft: false });
    const missing = await fetch(`${url}/channels/wechat/settings`, { method: "PUT", headers, body: JSON.stringify({ appId: "wx1234567890123456" }) });
    expect(missing.status).toBe(400);
    const saved = await fetch(`${url}/channels/wechat/settings`, { method: "PUT", headers, body: JSON.stringify({ appId: "wx1234567890123456", appSecret: "http-test-secret" }) });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ data: { appId: "wx1234567890123456", hasSecret: true, source: "saved", autoDraft: false } });
    const info = await fetch(`${url}/channels/wechat/settings`, { headers });
    expect(info.headers.get("cache-control")).toBe("no-store");
    expect(await info.text()).not.toContain("http-test-secret");
    // 使用新密钥重开旧文件，覆盖实际的解密失败与管理员恢复链路。
    const wrongKey = new WechatSettingsStore(join(root, "settings.json"), "changed-session-secret", () => ({ appId: "env", appSecret: "fallback" }));
    vi.mocked(wechatSettings.info).mockImplementation(() => wrongKey.info());
    vi.mocked(wechatSettings.save).mockImplementation((input) => wrongKey.save(input));
    vi.spyOn(wechatSettings, "credentials").mockImplementation(() => wrongKey.credentials());
    const unreadable = await fetch(`${url}/channels/wechat/settings`, { headers });
    expect(unreadable.status).toBe(200);
    expect(await unreadable.json()).toEqual({ data: { appId: "", hasSecret: false, source: "unreadable", autoDraft: false } });
    const unreadableToggle = await fetch(`${url}/channels/wechat/options`, { method: "PUT", headers, body: JSON.stringify({ autoDraft: true }) });
    expect(unreadableToggle.status).toBe(200);
    expect((await (await fetch(`${url}/channels/wechat/settings`, { headers })).json()).data).toMatchObject({ source: "unreadable", autoDraft: true });
    await store.saveOptions({ autoDraft: false });
    const capabilities = await fetch(`${url}/channels/wechat/capabilities`, { headers });
    expect(capabilities.status).toBe(200);
    expect((await capabilities.json()).data).toMatchObject({ draft: false, publish: false, reason: expect.stringContaining("请重新填写凭证") });
    for (const input of [{ appId: "wx1234567890123456" }, { appId: "wx1234567890123456", appSecret: "" }, { appSecret: "replacement" }]) {
      expect((await fetch(`${url}/channels/wechat/settings`, { method: "PUT", headers, body: JSON.stringify(input) })).status).toBe(400);
    }
    const recovered = await fetch(`${url}/channels/wechat/settings`, { method: "PUT", headers, body: JSON.stringify({ appId: "wx1234567890123456", appSecret: "replacement" }) });
    expect(recovered.status).toBe(200);
    expect((await recovered.json()).data.source).toBe("saved");
    expect((await wrongKey.credentials()).appSecret).toBe("replacement");
    expect((await (await fetch(`${url}/channels/wechat/capabilities`, { headers })).json()).data.draft).toBe(true);
    const draft = vi.spyOn(wechatProvider, "createDraft").mockResolvedValue({ externalId: "mock-http-draft" });
    await store.saveOptions({ autoDraft: true });
    const candidates = await candidatePoolStore.submit(currentPoolDate(), [{ contentFormat: "html", externalId: "auto-candidate", title: "采纳自动草稿", content: "<p>内容</p>", coverUrl: "https://example.com/cover.jpg" }]);
    const accepted = await fetch(`${url}/candidate-pools/daily/candidates/${candidates[0].id}/accept`, { method: "POST", headers });
    expect(accepted.status).toBe(201);
    const acceptedData = (await accepted.json()).data;
    expect(acceptedData.autoDraft).toMatchObject({ status: "submitted", operationId: expect.any(String) });
    await vi.waitFor(() => expect(draft).toHaveBeenCalled());
    const repeated = await fetch(`${url}/candidate-pools/daily/candidates/${candidates[0].id}/accept`, { method: "POST", headers });
    expect((await repeated.json()).data.autoDraft.status).toBe("not_new");
    const noCover = await repository.createOrGet({ contentFormat: "html", title: "无封面", content: "正文" });
    const manual = async (id: string) => fetch(`${url}/articles/${id}/wechat/draft`, { method: "POST", headers });
    const required = await manual(noCover.article.id);
    expect(required.status).toBe(400);
    expect((await required.json()).error.code).toBe("COVER_REQUIRED");
    const invalidAsset = await repository.createOrGet({ contentFormat: "html", title: "失效素材", content: "正文", coverAssetId: "missing-asset" });
    const unavailable = await manual(invalidAsset.article.id);
    expect(unavailable.status).toBe(400);
    expect((await unavailable.json()).error.code).toBe("MEDIA_ASSET_UNAVAILABLE");
    const caps = vi.spyOn(wechatProvider, "getCapabilities").mockResolvedValue({ provider: "wechat", draft: false, publish: false });
    const denied = await manual(acceptedData.article.id);
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe("CHANNEL_CAPABILITY_UNAVAILABLE");
    caps.mockRestore();
    const connection = vi.spyOn(wechatProvider, "testConnection").mockResolvedValue();
    expect((await fetch(`${url}/channels/wechat/test`, { method: "POST", headers })).status).toBe(200);
    connection.mockRejectedValue(Object.assign(new Error("sensitive-value"), { code: 40125 }));
    const failed = await fetch(`${url}/channels/wechat/test`, { method: "POST", headers });
    expect(failed.status).toBe(400);
    const error = await failed.text();
    expect(error).toContain("40125");
    expect(error).not.toContain("sensitive-value");
  });
});
