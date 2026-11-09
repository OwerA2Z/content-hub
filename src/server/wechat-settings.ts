import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { config } from "./config";
import { mediaError } from "./media-storage";

export interface WechatCredentials { appId: string; appSecret: string; }
export interface WechatSettingsInfo { appId: string; hasSecret: boolean; source: "saved" | "environment" | "none"; }

/** 配置独立于公开素材，复用持久化卷；SESSION_SECRET 必须随数据一起稳定保留。 */
export class WechatSettingsStore {
  private readonly key: Buffer;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(private readonly filename: string, secret: string, private readonly fallback: () => WechatCredentials) {
    this.key = scryptSync(secret, "content-hub-wechat-settings-v1", 32);
  }

  private async saved(): Promise<WechatCredentials | undefined> {
    let raw: string;
    try { raw = await readFile(this.filename, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
    try {
      const payload = JSON.parse(raw) as { iv: string; tag: string; data: string };
      const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(payload.iv, "base64"));
      decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8")) as WechatCredentials;
    } catch {
      // 不把密文、密钥或底层异常带入日志与 HTTP 响应，且不静默切换到另一个公众号。
      throw mediaError(503, "WECHAT_CONFIG_UNREADABLE", "公众号配置无法解密，请恢复保存配置时的 SESSION_SECRET");
    }
  }

  async credentials() { return await this.saved() ?? this.fallback(); }

  async info(): Promise<WechatSettingsInfo> {
    const saved = await this.saved();
    const value = saved ?? this.fallback();
    return { appId: value.appId, hasSecret: Boolean(value.appSecret), source: saved ? "saved" : value.appId || value.appSecret ? "environment" : "none" };
  }

  save(input: { appId: string; appSecret?: string }) {
    // 串行执行读改写，避免并发保存时“留空保留密钥”读取到过期配置。
    const operation = this.pending.then(async () => {
      const current = await this.credentials();
      const appSecret = input.appSecret || current.appSecret;
      if (!appSecret) throw mediaError(400, "WECHAT_SECRET_REQUIRED", "首次配置请填写 AppSecret");
      if (current.appId && input.appId !== current.appId && !input.appSecret) throw mediaError(400, "WECHAT_SECRET_REQUIRED", "更换 AppID 时请同时填写对应的 AppSecret");
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", this.key, iv);
      const data = Buffer.concat([cipher.update(JSON.stringify({ appId: input.appId, appSecret }), "utf8"), cipher.final()]);
      const payload = JSON.stringify({ iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") });
      await mkdir(dirname(this.filename), { recursive: true, mode: 0o700 });
      const temporary = `${this.filename}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, payload, { flag: "wx", mode: 0o600 });
        await rename(temporary, this.filename);
      } finally { await rm(temporary, { force: true }); }
      return this.info();
    });
    this.pending = operation.catch(() => undefined);
    return operation;
  }
}

export const wechatSettings = new WechatSettingsStore(resolve(config.MEDIA_ROOT, ".private/wechat.json"), config.SESSION_SECRET,
  () => ({ appId: config.WECHAT_APP_ID ?? "", appSecret: config.WECHAT_APP_SECRET ?? "" }));
