import { describe, expect, it } from "vitest";
import { requireAiScopes } from "../src/server/http/middleware";
import { tokenStore } from "../src/server/tokens";

describe("AI scope 权限", () => {
  it("只允许具备所需 scope 的 Token 通过", async () => {
    const created = await tokenStore.create(`AI读取-${Date.now()}`, ["articles:read", "planning:read"]);
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    const response = { locals: {}, status: () => response, json: () => response };
    await requireAiScopes(["articles:read"])({ header: (name: string) => name === "authorization" ? `Bearer ${created.secret}` : undefined, ip: "127.0.0.1" } as never, response as never, next);
    expect(nextCalled).toBe(true);
    nextCalled = false;
    await requireAiScopes(["articles:write"])({ header: (name: string) => name === "authorization" ? `Bearer ${created.secret}` : undefined, ip: "127.0.0.2" } as never, response as never, next);
    expect(nextCalled).toBe(false);
  });
});
