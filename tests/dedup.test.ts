import { describe, expect, it } from "vitest";
import { checkDuplicate, contentHash } from "../src/server/dedup";

describe("文章防重复", () => {
  it("规范化正文后生成稳定 hash", () => {
    expect(contentHash("<p>你好</p>")).toBe(contentHash("<div> 你好 </div>"));
  });

  it("返回详尽的高风险警告", () => {
    const result = checkDuplicate(
      { title: "AI 文章管理", summary: "介绍 AI 文章管理和内容运营", topics: ["内容运营"], keywords: ["AI", "文章管理"], content: "<p>介绍 AI 文章管理和内容运营</p>" },
      [{ id: "old", title: "AI 文章管理方法", digest: "介绍 AI 文章管理", summary: "介绍 AI 文章管理和内容运营", outline: [], topics: ["内容运营"], keywords: ["AI", "文章管理"], content: "<p>介绍 AI 文章管理和内容运营</p>", contentFormat: "html", images: [], metadata: {}, status: "published", createdAt: "2026-08-01", updatedAt: "2026-08-01", contentHash: contentHash("<p>旧正文</p>"), publishConfirmed: true }],
    );
    expect(result.risk).toBe("high");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.candidates[0]?.matchedDimensions.length).toBeGreaterThan(0);
  });
});
