import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { app } from "../src/server/app";
import { repository } from "../src/server/db/repository";
import { contentPlanningStore } from "../src/server/content-planning";
import { createChannelsRouter } from "../src/server/routes/channels";
import { tokenStore } from "../src/server/tokens";
import { candidatePoolStore } from "../src/server/candidate-pools";

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

  it("AI 规划写入使用独立 Token，并按 Idempotency-Key 幂等创建", async () => {
    const url = await baseUrl();
    const strategy = await contentPlanningStore.createStrategy({ name: `AI战略-${Date.now()}`, goal: "AI 规划测试", contentPillars: [], avoidTopics: [] });
    const token = await tokenStore.create(`测试规划-${Date.now()}`, ["planning:write"]);
    const headers = { authorization: `Bearer ${token.secret}`, "content-type": "application/json", "idempotency-key": `series-${Date.now()}` };
    const input = { sequence: 1, name: "AI 系列", targetCount: 2, orderMode: "sequential" };
    const first = await fetch(`${url}/api/v1/ai/content-plan/strategies/${strategy.id}/series`, { method: "POST", headers, body: JSON.stringify(input) });
    const firstBody = await first.json() as { data: { id: string } };
    const second = await fetch(`${url}/api/v1/ai/content-plan/strategies/${strategy.id}/series`, { method: "POST", headers, body: JSON.stringify({ ...input, name: "重试不应覆盖" }) });
    const secondBody = await second.json() as { data: { id: string } };
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(secondBody.data.id).toBe(firstBody.data.id);
  });

  it("每日候选池支持提交、推荐和接受候选文章", async () => {
    const url = await baseUrl();
    const token = await tokenStore.create(`候选池-${Date.now()}`, ["recommendations:write", "recommendations:read", "recommendations:accept"]);
    const headers = { authorization: `Bearer ${token.secret}`, "content-type": "application/json" };
    const response = await fetch(`${url}/api/v1/ai/candidate-pools/daily/candidates`, { method: "POST", headers, body: JSON.stringify({ candidates: [{ externalId: `candidate-${Date.now()}`, title: "候选文章", content: "<p>候选正文</p>", contentFormat: "html", summary: "候选梗概", outline: ["背景", "结论"], topics: ["AI"], keywords: ["内容"] }] }) });
    const body = await response.json() as { data: { candidates: Array<{ id: string; status: string }> } };
    expect(response.status).toBe(201);
    expect(body.data.candidates[0]?.status).toMatch(/candidate|recommended/);
    const pool = await candidatePoolStore.getDaily();
    const candidate = pool.candidates.find((item) => item.id === body.data.candidates[0]?.id);
    expect(candidate).toBeTruthy();
    const accepted = await fetch(`${url}/api/v1/candidate-pools/daily/candidates/${candidate!.id}/accept`, { method: "POST", headers });
    expect(accepted.status).toBe(201);
  });
});
