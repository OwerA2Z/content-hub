import { describe, expect, it } from "vitest";
import { WechatProvider } from "../src/server/channels/wechat";

describe("WechatProvider", () => {
  it("未配置凭证时安全降级为无渠道能力", async () => {
    const provider = new WechatProvider();
    const capabilities = await provider.getCapabilities();
    expect(capabilities.provider).toBe("wechat");
    expect(capabilities.draft).toBe(false);
    expect(capabilities.publish).toBe(false);
  });
});
