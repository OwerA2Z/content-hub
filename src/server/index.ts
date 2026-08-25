import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { app } from "./app";
import { config } from "./config";
import { resumePendingOperations } from "./services/channel-operations";

const distPath = resolve(process.cwd(), "dist");
if (existsSync(distPath)) {
  app.use((await import("express")).static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/health" || req.path === "/ready") return next();
    return res.sendFile(resolve(distPath, "index.html"));
  });
}

app.listen(config.PORT, () => {
  console.log(`wechat article platform listening on ${config.PORT}`);
  void resumePendingOperations();
});
