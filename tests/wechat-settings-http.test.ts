import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "../src/server/app";
import { wechatSettings, WechatSettingsStore } from "../src/server/wechat-settings";
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
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("测试服务器未监听");
    const url = `http://127.0.0.1:${address.port}/api/v1`;
    for (const [path, method] of [["settings", "GET"], ["settings", "PUT"], ["test", "POST"]]) {
      const response = await fetch(`${url}/channels/wechat/${path}`, { method, headers: { authorization: "Bearer local-development-api-token" } });
      expect(response.status).toBe(401);
    }
    const initialized = await fetch(`${url}/setup/initialize`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "wechat-admin", password: "test-admin-password" }) });
    const cookie = initialized.headers.get("set-cookie")!.split(";")[0];
    const headers = { cookie, "content-type": "application/json" };
    const missing = await fetch(`${url}/channels/wechat/settings`, { method: "PUT", headers, body: JSON.stringify({ appId: "wx1234567890123456" }) });
    expect(missing.status).toBe(400);
    const saved = await fetch(`${url}/channels/wechat/settings`, { method: "PUT", headers, body: JSON.stringify({ appId: "wx1234567890123456", appSecret: "http-test-secret" }) });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ data: { appId: "wx1234567890123456", hasSecret: true, source: "saved" } });
    const info = await fetch(`${url}/channels/wechat/settings`, { headers });
    expect(info.headers.get("cache-control")).toBe("no-store");
    expect(await info.text()).not.toContain("http-test-secret");
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
