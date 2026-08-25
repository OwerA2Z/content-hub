import express from "express";
import { config } from "./config";
import { repository, repositoryKind, repositoryReady } from "./db/repository";
import { userStoreReady } from "./users";
import { tokenStoreReady } from "./tokens";
import { createAiRouter } from "./routes/ai";
import { createArticlesRouter } from "./routes/articles";
import { createAuthRouter } from "./routes/auth";
import { createChannelsRouter } from "./routes/channels";
import { createIntegrationsRouter } from "./routes/integrations";
import { createAdminTokensRouter } from "./routes/admin-tokens";
import { createPlanningRouter } from "./routes/planning";
import { createCandidatesRouter } from "./routes/candidates";
import { errorHandler } from "./http/errors";

const app = express();
// 生产环境位于 Nginx/Caddy 后面时，使用代理转发的 HTTPS 协议生成正确的 API URL。
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ data: { status: "ok" } }));
app.get("/ready", async (_req, res) => {
  try {
    await repositoryReady;
    await userStoreReady;
    await tokenStoreReady;
    return res.json({ data: { status: "ready", database: repositoryKind } });
  } catch {
    return res.status(503).json({ error: { code: "NOT_READY", message: "数据库尚未就绪" } });
  }
});

// 路由只负责 HTTP 边界；各领域的业务编排位于 routes/services 下。
app.use("/api/v1", createAuthRouter());
app.use("/api/v1", createArticlesRouter());
app.use("/api/v1", createAiRouter());
app.use("/api/v1", createPlanningRouter());
app.use("/api/v1", createCandidatesRouter());
app.use("/api/v1", createIntegrationsRouter());
app.use("/api/v1", createAdminTokensRouter());
app.use("/api/v1", createChannelsRouter());

app.use(errorHandler);

export { app };
