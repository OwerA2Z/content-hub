import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadPublicImage, WechatProvider } from "../src/server/channels/wechat";
import { wechatSettings } from "../src/server/wechat-settings";
import { MemoryRepository } from "../src/server/db/repository";
import { htmlToText, sanitizeHtml } from "../src/server/ai";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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
    const download = vi.fn().mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" });
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

});

describe("AI 内容转换", () => {
  it("默认转换为纯文本并移除脚本", () => {
    expect(htmlToText("<p>标题</p><script>alert(1)</script><p>正文<img src=\"x\" /></p>")).toBe("标题\n正文 [图片]");
    expect(sanitizeHtml("<p onclick=\"alert(1)\">正文</p>")).not.toContain("onclick");
  });
});
