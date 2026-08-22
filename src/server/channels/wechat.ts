import { randomUUID } from "node:crypto";
import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import type { Article, ChannelCapabilities, Operation } from "../../shared/contracts";
import { config } from "../config";

export interface ChannelResult { externalId: string; }

export interface ChannelProvider {
  getCapabilities(): Promise<ChannelCapabilities>;
  createDraft(article: Article): Promise<ChannelResult>;
  publish(article: Article, draftId?: string): Promise<ChannelResult>;
}

class WechatApiError extends Error {
  constructor(public readonly code: number, message: string) {
    super(message);
    this.name = "WechatApiError";
  }
}

/** 未配置真实凭证时使用 mock，保证本地开发和测试不依赖公众号环境。 */
export class WechatProvider implements ChannelProvider {
  private accessToken?: { value: string; expiresAt: number };

  async getCapabilities(): Promise<ChannelCapabilities> {
    if (!config.WECHAT_APP_ID || !config.WECHAT_APP_SECRET) {
      return { provider: "wechat", draft: false, publish: false, reason: "未配置微信公众号服务端凭证" };
    }
    return {
      provider: "wechat",
      draft: true,
      publish: config.WECHAT_ENABLE_PUBLISH === "true",
      reason: config.WECHAT_ENABLE_PUBLISH === "true" ? undefined : "发布能力默认关闭，请确认公众号权限后设置 WECHAT_ENABLE_PUBLISH=true",
    };
  }

  async createDraft(article: Article): Promise<ChannelResult> {
    if (!config.WECHAT_APP_ID || !config.WECHAT_APP_SECRET) return { externalId: `mock-draft-${article.id}-${randomUUID().slice(0, 8)}` };
    const thumbMediaId = await this.uploadCover(article.coverUrl ?? article.images[0]);
    const response = await this.call<{ media_id?: string }>("/cgi-bin/draft/add", {
      method: "POST",
      body: JSON.stringify({ articles: [{ title: article.title, author: article.author ?? "", digest: article.digest ?? "", content: article.content, thumb_media_id: thumbMediaId }] }),
    });
    if (!response.media_id) throw new Error("微信公众号未返回草稿 media_id");
    return { externalId: response.media_id };
  }

  async publish(article: Article, draftId?: string): Promise<ChannelResult> {
    if (!draftId) throw new Error("发布前必须先创建草稿");
    if (!config.WECHAT_APP_ID || !config.WECHAT_APP_SECRET) return { externalId: `mock-publish-${article.id}-${randomUUID().slice(0, 8)}` };
    const response = await this.call<{ publish_id?: string }>("/cgi-bin/freepublish/submit", { method: "POST", body: JSON.stringify({ media_id: draftId }) });
    if (!response.publish_id) throw new Error("微信公众号未返回发布任务 ID");
    return { externalId: response.publish_id };
  }

  private async getAccessToken() {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) return this.accessToken.value;
    const url = new URL("/cgi-bin/token", config.WECHAT_API_BASE_URL);
    url.searchParams.set("grant_type", "client_credential");
    url.searchParams.set("appid", config.WECHAT_APP_ID ?? "");
    url.searchParams.set("secret", config.WECHAT_APP_SECRET ?? "");
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const body = await response.json() as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };
    if (!response.ok || !body.access_token) throw new WechatApiError(body.errcode ?? response.status, body.errmsg ?? "获取微信公众号 access_token 失败");
    this.accessToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 7_200) * 1_000 };
    return body.access_token;
  }

  private async call<T>(path: string, init: RequestInit): Promise<T> {
    const url = new URL(path, config.WECHAT_API_BASE_URL);
    url.searchParams.set("access_token", await this.getAccessToken());
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15_000) });
    const body = await response.json() as T & { errcode?: number; errmsg?: string };
    if (!response.ok || body.errcode) throw new WechatApiError(body.errcode ?? response.status, body.errmsg ?? "微信公众号接口调用失败");
    return body;
  }

  private async uploadCover(urlValue?: string) {
    if (!urlValue) throw new Error("微信公众号草稿需要 coverUrl 或 images[0] 作为封面");
    const source = new URL(urlValue);
    if (!['http:', 'https:'].includes(source.protocol)) throw new Error("封面图片只允许使用 HTTP(S) URL");
    await assertPublicHost(source.hostname);
    const image = await fetch(source, { signal: AbortSignal.timeout(10_000) });
    if (!image.ok) throw new Error(`封面图片下载失败：HTTP ${image.status}`);
    const contentType = image.headers.get("content-type") ?? "image/jpeg";
    const bytes = await image.arrayBuffer();
    if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("封面图片不能超过 10MB");
    const form = new FormData();
    form.append("media", new Blob([bytes], { type: contentType }), "cover-image");
    const apiUrl = new URL("/cgi-bin/material/add_material", config.WECHAT_API_BASE_URL);
    apiUrl.searchParams.set("access_token", await this.getAccessToken());
    apiUrl.searchParams.set("type", "thumb");
    const response = await fetch(apiUrl, { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
    const body = await response.json() as { media_id?: string; errcode?: number; errmsg?: string };
    if (!response.ok || !body.media_id) throw new WechatApiError(body.errcode ?? response.status, body.errmsg ?? "上传微信封面失败");
    return body.media_id;
  }
}

async function assertPublicHost(hostname: string) {
  if (hostname === "localhost" || (isIP(hostname) === 4 && (hostname.startsWith("10.") || hostname.startsWith("127.") || hostname.startsWith("192.168.") || hostname.startsWith("169.254.")))) throw new Error("封面图片地址不允许访问本机或内网");
  const addresses = await dns.lookup(hostname, { all: true });
  if (addresses.some(({ address }) => address.startsWith("10.") || address.startsWith("127.") || address.startsWith("192.168.") || address.startsWith("169.254.") || address === "::1" || address.startsWith("fc") || address.startsWith("fd"))) throw new Error("封面图片地址解析到内网 IP，已拒绝访问");
}

export type OperationAction = Operation["action"];
export const wechatProvider = new WechatProvider();
