import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  API_TOKEN: z.string().min(16).default("local-development-api-token"),
  SESSION_SECRET: z.string().min(16).default("local-development-session-secret"),
  DATABASE_URL: z.string().url().optional(),
  WECHAT_APP_ID: z.string().optional(),
  WECHAT_APP_SECRET: z.string().optional(),
  WECHAT_API_BASE_URL: z.string().url().default("https://api.weixin.qq.com"),
  WECHAT_ENABLE_PUBLISH: z.enum(["true", "false"]).default("false"),
});

export const config = configSchema.parse(process.env);

if (config.NODE_ENV === "production") {
  const unsafeDefaults = ["local-development-api-token", "local-development-session-secret"];
  if (unsafeDefaults.includes(config.API_TOKEN) || unsafeDefaults.includes(config.SESSION_SECRET)) {
    throw new Error("生产环境必须配置独立的 API_TOKEN 和 SESSION_SECRET");
  }
}
