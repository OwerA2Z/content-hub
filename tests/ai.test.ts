import { beforeAll, describe, expect, it } from "vitest";

let requireAiReadToken: typeof import("../src/server/ai").requireAiReadToken;

beforeAll(async () => {
  process.env.AI_READ_TOKEN = "test-ai-read-token-123456";
  ({ requireAiReadToken } = await import("../src/server/ai"));
});

describe("AI 只读 Token", () => {
  it("只接受独立 AI_READ_TOKEN", () => {
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    const validResponse = { status: () => validResponse, json: () => validResponse };
    requireAiReadToken({ header: (name: string) => name === "authorization" ? "Bearer test-ai-read-token-123456" : undefined, ip: "127.0.0.1" } as never, validResponse as never, next);
    expect(nextCalled).toBe(true);
    nextCalled = false;
    const invalidResponse = { statusCode: 0, status(code: number) { this.statusCode = code; return this; }, json() { return this; } };
    requireAiReadToken({ header: () => "Bearer wrong-token", ip: "127.0.0.1" } as never, invalidResponse as never, next);
    expect(nextCalled).toBe(false);
    expect(invalidResponse.statusCode).toBe(401);
  });
});
