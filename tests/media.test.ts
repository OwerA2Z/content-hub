import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { app } from "../src/server/app";
import { tokenStore } from "../src/server/tokens";
import { safeMediaPath } from "../src/server/media-storage";

let server: Server | undefined;
afterEach(() => { server?.close(); server = undefined; });

async function baseUrl() {
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server!.address();
  if (!address || typeof address === "string") throw new Error("测试服务器未监听");
  return `http://127.0.0.1:${address.port}`;
}

describe("媒体素材 API", () => {
  it("拒绝素材路径穿越", () => {
    expect(() => safeMediaPath("../outside.png")).toThrow("素材路径无效");
    expect(() => safeMediaPath("2026/08/../../outside.png")).toThrow("素材路径无效");
  });

  it("支持上传、读取、编辑和归档图片素材，并按 scope 控制操作", async () => {
    const url = await baseUrl();
    const token = await tokenStore.create(`素材测试-${Date.now()}`, ["media:read", "media:write", "media:delete"]);
    const headers = { authorization: `Bearer ${token.secret}` };
    const form = new FormData();
    // 最小合法 PNG（1x1），用于验证 multipart 和文件持久化链路。
    form.append("file", new Blob([Buffer.from("89504e470d0a1a0a", "hex")], { type: "image/png" }), "pixel.png");
    form.append("tags", JSON.stringify(["通用", "封面"]));
    const createdResponse = await fetch(`${url}/api/v1/media/assets`, { method: "POST", headers, body: form });
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json() as { data: { id: string; contentUrl: string; tags: string[] } };
    expect(created.data.tags).toEqual(["通用", "封面"]);

    const contentResponse = await fetch(created.data.contentUrl, { headers });
    expect(contentResponse.status).toBe(200);
    expect(contentResponse.headers.get("content-type")).toContain("image/png");
    expect(Buffer.from(await contentResponse.arrayBuffer()).toString("hex")).toBe("89504e470d0a1a0a");

    const updateResponse = await fetch(`${url}/api/v1/media/assets/${created.data.id}`, { method: "PATCH", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ tags: ["更新"] }) });
    expect(updateResponse.status).toBe(200);
    expect((await updateResponse.json()).data.tags).toEqual(["更新"]);
    expect((await fetch(`${url}/api/v1/media/assets/${created.data.id}`, { method: "DELETE", headers })).status).toBe(200);
    expect((await fetch(`${url}/media/assets/${created.data.id}/content`, { headers })).status).toBe(404);
  });

  it("没有素材读取权限时拒绝访问", async () => {
    const url = await baseUrl();
    const token = await tokenStore.create(`无权限素材-${Date.now()}`, ["articles:read"]);
    const response = await fetch(`${url}/api/v1/media/assets`, { headers: { authorization: `Bearer ${token.secret}` } });
    expect(response.status).toBe(401);
  });
});
