import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { app } from "../src/server/app";
import { repository } from "../src/server/db/repository";
import { contentPlanningStore } from "../src/server/content-planning";
import { createChannelsRouter } from "../src/server/routes/channels";

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
  it("微信公众号重试路由优先于通用 action 路由", () => {
    const stack = (createChannelsRouter() as unknown as { stack: Array<{ route?: { path: string } }> }).stack;
    const paths = stack.flatMap((layer) => layer.route?.path ? [layer.route.path] : []);
    expect(paths.indexOf("/articles/:id/wechat/retry")).toBeLessThan(paths.indexOf("/articles/:id/wechat/:action"));
  });

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

  it("上传关联 brief 时自动补齐战略和系列", async () => {
    const url = await baseUrl();
    const strategy = await contentPlanningStore.createStrategy({ name: `战略-${Date.now()}`, goal: "目标", contentPillars: [], avoidTopics: [] });
    const series = await contentPlanningStore.createSeries(strategy.id, { name: "系列", targetCount: 1, orderMode: "sequential" });
    const brief = await contentPlanningStore.createBrief(series.id, { sequence: 1, titleDirection: "任务" });
    const response = await fetch(`${url}/api/v1/articles/upload`, { method: "POST", headers: { authorization: "Bearer local-development-api-token", "content-type": "application/json" }, body: JSON.stringify({ title: "关联文章", content: "<p>正文</p>", contentFormat: "html", briefId: brief.id }) });
    const body = await response.json() as { data: { article: { id: string; strategyId?: string; seriesId?: string; briefId?: string } } };
    expect(response.status).toBe(201);
    expect(body.data.article.strategyId).toBe(strategy.id);
    expect(body.data.article.seriesId).toBe(series.id);
    expect(body.data.article.briefId).toBe(brief.id);
    expect((await repository.get(body.data.article.id))?.strategyId).toBe(strategy.id);
  });
});
