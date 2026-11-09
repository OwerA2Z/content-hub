import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadPublicImage, WechatProvider } from "../src/server/channels/wechat";
import { wechatSettings } from "../src/server/wechat-settings";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "../src/server/config";
import { mediaAssetRepository } from "../src/server/media-library";
import * as storage from "../src/server/media-storage";
import { MemoryRepository } from "../src/server/db/repository";
import { htmlToText, sanitizeHtml } from "../src/server/ai";

const roots: string[] = [];
const originalMediaRoot = config.MEDIA_ROOT;
const originalPublicBaseUrl = config.PUBLIC_BASE_URL;
afterEach(async () => {
  config.PUBLIC_BASE_URL = originalPublicBaseUrl; config.MEDIA_ROOT = originalMediaRoot;
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("WechatProvider", () => {
  it("未配置凭证时安全降级为无渠道能力", async () => {
    const provider = new WechatProvider();
    const capabilities = await provider.getCapabilities();
    expect(capabilities.provider).toBe("wechat");
    expect(capabilities.draft).toBe(false);
    expect(capabilities.publish).toBe(false);
    const { article } = await new MemoryRepository().createOrGet({ title: "未配置", content: "<p>正文</p>", contentFormat: "html" });
    await expect(provider.createDraft(article)).rejects.toThrow("未配置");
  });
  it("页面凭证生效、正文图片先转存且去重，封面与草稿使用不同接口", async () => {
    vi.spyOn(wechatSettings, "credentials").mockResolvedValue({ appId: "wx1234567890123456", appSecret: "test-only-secret" });
    const download = vi.fn().mockResolvedValue({ bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), contentType: "image/png" });
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/token")) return Response.json({ access_token: "test-token", expires_in: 7200 });
      if (url.pathname.endsWith("/uploadimg")) return Response.json({ url: "https://mmbiz.qpic.cn/test.png" });
      if (url.pathname.endsWith("/add_material")) return Response.json({ media_id: "cover-id" });
      return Response.json({ media_id: "draft-id" });
    });
    vi.stubGlobal("fetch", fetcher);
    const { article } = await new MemoryRepository().createOrGet({ title: "测试文章", content: '<p>正文</p><img src="https://example.com/body.png"><img data-src="https://example.com/body.png">', contentFormat: "html", coverUrl: "https://example.com/cover.png" });
    const provider = new WechatProvider(download);
    expect((await provider.getCapabilities()).draft).toBe(true);
    expect(await provider.createDraft(article)).toEqual({ externalId: "draft-id" });
    expect(download).toHaveBeenCalledTimes(2);
    const call = fetcher.mock.calls.find(([url]) => String(url).includes("/draft/add"))!;
    const payload = JSON.parse(String(call[1]?.body)).articles[0];
    expect(payload.content).toContain('src="https://mmbiz.qpic.cn/test.png"');
    expect(payload.content).not.toContain("example.com");
    expect(payload.thumb_media_id).toBe("cover-id");
    expect(article.content).toContain("example.com");
    // 更新密钥后显式连接测试不得复用旧 token，响应错误也不能泄露微信原始内容。
    vi.mocked(wechatSettings.credentials).mockResolvedValue({ appId: "wx1234567890123456", appSecret: "new-secret" });
    fetcher.mockResolvedValue(Response.json({ errcode: 40125, errmsg: "unsafe-secret-content" }));
    await expect(provider.testConnection()).rejects.toThrow("40125");
    await expect(provider.testConnection()).rejects.not.toThrow("unsafe-secret-content");
  });

  it("正文图片失败时终止草稿创建，并拒绝内网和不安全协议", async () => {
    vi.spyOn(wechatSettings, "credentials").mockResolvedValue({ appId: "wx1234567890123456", appSecret: "test-secret" });
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const { article } = await new MemoryRepository().createOrGet({ title: "图片", content: '<img src="https://example.com/a.webp">', contentFormat: "html" });
    const provider = new WechatProvider(async () => ({ bytes: new Uint8Array([1]), contentType: "image/webp" }));
    await expect(provider.createDraft(article)).rejects.toThrow("JPG/PNG");
    expect(fetcher).not.toHaveBeenCalled();
    for (const url of ["http://127.0.0.1/a.png", "http://172.16.1.1/a.png", "http://[::1]/a.png", "http://[::ffff:127.0.0.1]/a.png", "file:///a.png"]) {
      await expect(downloadPublicImage(url, 1024)).rejects.toThrow();
    }
  });

  it.each(["/media/assets/local/content", "https://hub.example/media/assets/local/content"])("本站素材 %s 正文与封面直接读取文件，不走 HTTP 下载", async (url) => {
    config.PUBLIC_BASE_URL = "https://hub.example";
    const asset = { id: "local", storageKey: "local.png", status: "active", mimeType: "image/png", originalName: "local.png" };
    vi.spyOn(mediaAssetRepository, "get").mockResolvedValue(asset as Awaited<ReturnType<typeof mediaAssetRepository.get>>);
    const root = await mkdtemp(join(tmpdir(), "wechat-image-")); roots.push(root);
    config.MEDIA_ROOT = root;
    await writeFile(join(root, "local.png"), Buffer.from("89504e470d0a1a0a", "hex"));
    const read = vi.spyOn(storage, "readMediaFile");
    const download = vi.fn();
    const fetcher = mockWechat();
    const { article } = await new MemoryRepository().createOrGet({ title: "素材", content: `<img src="${url}">`, contentFormat: "html" });
    article.images = [url];
    const provider = new WechatProvider(download, { appId: "local", appSecret: url });
    await provider.createDraft(article);
    article.coverUrl = url;
    await provider.createDraft(article);
    expect(read).toHaveBeenCalledTimes(4);
    expect(read).toHaveBeenCalledWith("local.png");
    expect(download).not.toHaveBeenCalled();
    expect(fetcher.mock.calls.every(([input]) => new URL(String(input)).hostname === new URL(config.WECHAT_API_BASE_URL).hostname)).toBe(true);
  });

  it.each([undefined, "archived"])("素材不存在或状态为 %s 时拒绝，不走下载", async (status) => {
    vi.spyOn(mediaAssetRepository, "get").mockResolvedValue(status ? { status } as Awaited<ReturnType<typeof mediaAssetRepository.get>> : undefined);
    const download = vi.fn();
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const { article } = await new MemoryRepository().createOrGet({ title: "素材", content: '<img src="/media/assets/missing/content">', contentFormat: "html" });
    await expect(new WechatProvider(download, { appId: "missing", appSecret: "missing" }).createDraft(article)).rejects.toThrow("不存在或已归档");
    expect(download).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("外站同路径仍通过公网下载，不能误读本站素材", async () => {
    config.PUBLIC_BASE_URL = "https://hub.example";
    const get = vi.spyOn(mediaAssetRepository, "get");
    const download = vi.fn().mockResolvedValue({ bytes: Buffer.from("89504e470d0a1a0a", "hex"), contentType: "" });
    mockWechat();
    const url = "https://external.example/media/assets/local/content";
    const { article } = await new MemoryRepository().createOrGet({ title: "外站", content: `<img src="${url}">`, contentFormat: "html", coverUrl: url });
    await new WechatProvider(download, { appId: "external", appSecret: "external" }).createDraft(article);
    expect(download).toHaveBeenCalledTimes(2);
    expect(get).not.toHaveBeenCalled();
  });

  it.each(["/other/image.png", "images/a.png", "not a url"])("非本站相对或非法地址 %s 返回中文错误", async (url) => {
    const download = vi.fn();
    const { article } = await new MemoryRepository().createOrGet({ title: "错误地址", content: `<img src="${url}">`, contentFormat: "html" });
    const provider = new WechatProvider(download, { appId: "invalid", appSecret: "invalid" });
    await expect(provider.createDraft(article)).rejects.toThrow("图片地址无效");
    article.content = "<p>正文</p>"; article.coverUrl = url;
    await expect(provider.createDraft(article)).rejects.toThrow("图片地址无效");
    await expect(downloadPublicImage(url, 1024)).rejects.toThrow("图片地址无效");
    expect(download).not.toHaveBeenCalled();
  });

  it("连续和并发草稿跨实例共享 token，换凭证隔离且强制测试刷新", async () => {
    const fetcher = mockWechat();
    vi.spyOn(wechatSettings, "credentials").mockResolvedValue({ appId: "cache", appSecret: "shared" });
    const download = vi.fn().mockResolvedValue({ bytes: Buffer.from("89504e470d0a1a0a", "hex"), contentType: "application/octet-stream" });
    const { article } = await new MemoryRepository().createOrGet({ title: "缓存", content: '<img src="https://example.com/body">', contentFormat: "html", coverUrl: "https://example.com/cover" });
    const provider = new WechatProvider(download);
    const tokenCalls = () => fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname.endsWith("/token")).length;
    await Promise.all([provider.createDraft(article), new WechatProvider(download).createDraft(article)]);
    expect(tokenCalls()).toBe(1);
    await provider.createDraft(article); await provider.createDraft(article);
    expect(tokenCalls()).toBe(1);
    await provider.testConnection(); expect(tokenCalls()).toBe(2);
    vi.mocked(wechatSettings.credentials).mockResolvedValue({ appId: "cache", appSecret: "changed" });
    await provider.createDraft(article); expect(tokenCalls()).toBe(3);
    const uploads = fetcher.mock.calls.filter(([url]) => String(url).includes("uploadimg"));
    const file = (uploads[0][1]?.body as FormData).get("media") as File;
    expect(file.type).toBe("image/png");
    expect(Buffer.from(await file.arrayBuffer())).toEqual(Buffer.from("89504e470d0a1a0a", "hex"));
  });

  it("配置无法解密时关闭能力且不回退环境变量", async () => {
    vi.spyOn(wechatSettings, "credentials").mockRejectedValue(Object.assign(new Error("无法解密"), { code: "WECHAT_CONFIG_UNREADABLE" }));
    expect(await new WechatProvider().getCapabilities()).toMatchObject({ draft: false, publish: false, reason: expect.stringContaining("请重新填写凭证") });
  });

  it.each([
    ["image/jpeg", "ffd8ff"], ["image/png", "89504e470d0a1a0a"],
    ["image/gif", "474946383961"], ["image/webp", "524946460000000057454250"],
  ])("封面按魔数识别 %s，即使缺少 content-type", async (mime, hex) => {
    const fetcher = mockWechat();
    const provider = new WechatProvider(async () => ({ bytes: Buffer.from(hex, "hex"), contentType: "" }), { appId: "cover-magic", appSecret: mime });
    const { article } = await new MemoryRepository().createOrGet({ title: "封面格式", content: "<p>正文</p>", contentFormat: "html", coverUrl: "https://example.com/cover" });
    await provider.createDraft(article);
    const call = fetcher.mock.calls.find(([url]) => String(url).includes("add_material"))!;
    expect(((call[1]?.body as FormData).get("media") as File).type).toBe(mime);
  });

  it("token 获取失败清理并发占位，后续重试可恢复", async () => {
    const fetcher = mockWechat();
    fetcher.mockImplementationOnce(async () => Response.json({ errcode: 40013 }));
    const provider = new WechatProvider(async () => ({ bytes: Buffer.from("89504e470d0a1a0a", "hex"), contentType: "" }), { appId: "retry-token", appSecret: "retry-token" });
    const { article } = await new MemoryRepository().createOrGet({ title: "重试", content: "<p>正文</p>", contentFormat: "html", coverUrl: "https://example.com/cover" });
    await expect(provider.createDraft(article)).rejects.toThrow("40013");
    await expect(provider.createDraft(article)).resolves.toEqual({ externalId: "draft" });
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/token"))).toHaveLength(2);
  });

  it.each(["application/octet-stream", "image/png", ""])("非法魔数即使声明 %s 也拒绝正文和封面", async (contentType) => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const provider = new WechatProvider(async () => ({ bytes: new Uint8Array([1, 2]), contentType }), { appId: "magic", appSecret: "invalid" });
    const { article } = await new MemoryRepository().createOrGet({ title: "魔数", content: '<img src="https://example.com/body">', contentFormat: "html", coverUrl: "https://example.com/cover" });
    await expect(provider.createDraft(article)).rejects.toThrow("JPG/PNG");
    article.content = "<p>正文</p>";
    await expect(provider.createDraft(article)).rejects.toThrow("有效的 JPG/PNG/GIF/WebP");
    expect(fetcher).not.toHaveBeenCalled();
  });

});

describe("AI 内容转换", () => {
  it("默认转换为纯文本并移除脚本", () => {
    expect(htmlToText("<p>标题</p><script>alert(1)</script><p>正文<img src=\"x\" /></p>")).toBe("标题\n正文 [图片]");
    expect(sanitizeHtml("<p onclick=\"alert(1)\">正文</p>")).not.toContain("onclick");
  });
});

function mockWechat() {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/token")) return Response.json({ access_token: "mock-token", expires_in: 7200 });
    if (path.endsWith("/uploadimg")) return Response.json({ url: "https://mmbiz.qpic.cn/body.png" });
    return Response.json({ media_id: path.endsWith("/add_material") ? "cover" : "draft" });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
