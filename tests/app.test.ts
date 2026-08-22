import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { app } from "../src/server/app";

let server: Server | undefined;

afterEach(() => { server?.close(); server = undefined; });

async function baseUrl() {
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("测试服务器未监听");
  return `http://127.0.0.1:${address.port}`;
}

describe("HTTP API", () => {
  it("健康检查公开，上传接口需要 Bearer Token", async () => {
    const url = await baseUrl();
    expect((await fetch(`${url}/health`)).status).toBe(200);
    expect((await fetch(`${url}/api/v1/articles/upload`, { method: "POST" })).status).toBe(401);
  });

  it("上传 API 具备幂等返回", async () => {
    const url = await baseUrl();
    const body = { title: "接口测试", content: "<p>正文</p>", contentFormat: "html", source: "vitest", externalId: `case-${Date.now()}` };
    const init = { method: "POST", headers: { authorization: "Bearer local-development-api-token", "content-type": "application/json" }, body: JSON.stringify(body) };
    const first = await (await fetch(`${url}/api/v1/articles/upload`, init)).json() as { data: { article: { id: string }; created: boolean } };
    const second = await (await fetch(`${url}/api/v1/articles/upload`, init)).json() as { data: { article: { id: string }; created: boolean } };
    expect(first.data.created).toBe(true);
    expect(second.data.created).toBe(false);
    expect(second.data.article.id).toBe(first.data.article.id);
  });
});
