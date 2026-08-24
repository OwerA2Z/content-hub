import { describe, expect, it } from "vitest";
import { WechatProvider } from "../src/server/channels/wechat";
import { htmlToText, sanitizeHtml } from "../src/server/ai";

describe("WechatProvider", () => {
  it("未配置凭证时安全降级为无渠道能力", async () => {
    const provider = new WechatProvider();
    const capabilities = await provider.getCapabilities();
    expect(capabilities.provider).toBe("wechat");
    expect(capabilities.draft).toBe(false);
    expect(capabilities.publish).toBe(false);
  });
});

describe("AI 内容转换", () => {
  it("默认转换为纯文本并移除脚本", () => {
    expect(htmlToText("<p>标题</p><script>alert(1)</script><p>正文<img src=\"x\" /></p>")).toBe("标题\n正文 [图片]");
    expect(sanitizeHtml("<p onclick=\"alert(1)\">正文</p>")).not.toContain("onclick");
  });
});
