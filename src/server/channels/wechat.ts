import { promises as dns } from "node:dns";
import { BlockList, isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { parseFragment, serialize, type DefaultTreeAdapterTypes } from "parse5";
import type { Article, ChannelCapabilities, Operation } from "../../shared/contracts";
import { config } from "../config";
import { mediaAssetRepository } from "../media-library";
import { readMediaFile } from "../media-storage";
import { wechatSettings, type WechatCredentials } from "../wechat-settings";

export interface ChannelResult { externalId: string; }

export interface ChannelProvider {
  getCapabilities(): Promise<ChannelCapabilities>;
  createDraft(article: Article): Promise<ChannelResult>;
  publish(article: Article, draftId?: string): Promise<ChannelResult>;
  getPublishStatus(publishId: string): Promise<"pending" | "succeeded" | "failed">;
}

class WechatApiError extends Error {
  constructor(public readonly code: number, message: string) {
    super(message);
    this.name = "WechatApiError";
    this.message = `${message}（微信错误码：${code}）`;
  }
}

/** 从有效配置读取凭证；凭证变化后不复用旧公众号的 token。 */
export class WechatProvider implements ChannelProvider {
  constructor(private readonly downloadImage = downloadPublicImage, private readonly credentialsSnapshot?: WechatCredentials) {}

  private accessToken?: { value: string; expiresAt: number; appId: string; appSecret: string };

  async getCapabilities(): Promise<ChannelCapabilities> {
    const credentials = this.credentialsSnapshot ?? await wechatSettings.credentials();
    if (!credentials.appId || !credentials.appSecret) {
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
    const credentials = this.credentialsSnapshot ?? await wechatSettings.credentials();
    if (!credentials.appId || !credentials.appSecret) throw new Error("未配置微信公众号凭证，无法上传草稿");
    // 一次草稿任务固定账号，避免管理员处理中更换配置时把正文图和封面传到不同公众号。
    if (!this.credentialsSnapshot) return new WechatProvider(this.downloadImage, credentials).createDraft(article);
    const content = await this.uploadContentImages(article.content);
    const thumbMediaId = await this.uploadCover(article);
    const response = await this.call<{ media_id?: string }>("/cgi-bin/draft/add", {
      method: "POST",
      body: JSON.stringify({ articles: [{ title: article.title, author: article.author ?? "", digest: article.digest ?? "", article_type: "news", content, thumb_media_id: thumbMediaId }] }),
    });
    if (!response.media_id) throw new Error("微信公众号未返回草稿 media_id");
    return { externalId: response.media_id };
  }

  async publish(_article: Article, draftId?: string): Promise<ChannelResult> {
    if (!draftId) throw new Error("发布前必须先创建草稿");
    const credentials = this.credentialsSnapshot ?? await wechatSettings.credentials();
    if (!credentials.appId || !credentials.appSecret) throw new Error("未配置微信公众号凭证，无法发布");
    const response = await this.call<{ publish_id?: string }>("/cgi-bin/freepublish/submit", { method: "POST", body: JSON.stringify({ media_id: draftId }) });
    if (!response.publish_id) throw new Error("微信公众号未返回发布任务 ID");
    return { externalId: response.publish_id };
  }

  async getPublishStatus(publishId: string): Promise<"pending" | "succeeded" | "failed"> {
    const credentials = this.credentialsSnapshot ?? await wechatSettings.credentials();
    if (!credentials.appId || !credentials.appSecret) throw new Error("未配置微信公众号凭证，无法查询发布状态");
    const response = await this.call<{ publish_status?: number }>("/cgi-bin/freepublish/get", { method: "POST", body: JSON.stringify({ publish_id: publishId }) });
    if (response.publish_status === 1) return "succeeded";
    if (response.publish_status === 2) return "failed";
    return "pending";
  }

  async testConnection() {
    const credentials = this.credentialsSnapshot ?? await wechatSettings.credentials();
    if (!credentials.appId || !credentials.appSecret) throw new Error("请先保存 AppID 和 AppSecret");
    // 显式测试绕过缓存，确保验证的是当前凭证而非上次成功的结果。
    await this.getAccessToken(true);
  }

  private async getAccessToken(force = false) {
    const credentials = this.credentialsSnapshot ?? await wechatSettings.credentials();
    if (!force && this.accessToken?.appId === credentials.appId && this.accessToken.appSecret === credentials.appSecret && this.accessToken.expiresAt > Date.now() + 60_000) return this.accessToken.value;
    const url = new URL("/cgi-bin/token", config.WECHAT_API_BASE_URL);
    url.searchParams.set("grant_type", "client_credential");
    url.searchParams.set("appid", credentials.appId);
    url.searchParams.set("secret", credentials.appSecret);
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const body = await response.json() as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };
    if (!response.ok || !body.access_token) throw new WechatApiError(body.errcode ?? response.status, "获取微信公众号 access_token 失败");
    this.accessToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 7_200) * 1_000, ...credentials };
    return body.access_token;
  }

  private async call<T>(path: string, init: RequestInit): Promise<T> {
    const url = new URL(path, config.WECHAT_API_BASE_URL);
    url.searchParams.set("access_token", await this.getAccessToken());
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15_000) });
    const body = await response.json() as T & { errcode?: number; errmsg?: string };
    if (!response.ok || body.errcode) throw new WechatApiError(body.errcode ?? response.status, "微信公众号接口调用失败");
    return body;
  }

  private async uploadCover(article: Article) {
    if (article.coverAssetId) {
      const asset = await mediaAssetRepository.get(article.coverAssetId);
      if (!asset || asset.status !== "active") throw new Error("微信公众号草稿需要有效的封面素材");
      const bytes = await readMediaFile(asset.storageKey);
      return this.uploadCoverBytes(bytes, asset.mimeType, asset.originalName);
    }
    const urlValue = article.coverUrl ?? article.images[0];
    if (!urlValue) throw new Error("微信公众号草稿需要封面素材、coverUrl 或 images[0]");
    const image = await this.downloadImage(urlValue, 10 * 1024 * 1024);
    return this.uploadCoverBytes(image.bytes, image.contentType, "cover-image");
  }

  private async uploadContentImages(html: string) {
    const fragment = parseFragment(html);
    const uploaded = new Map<string, string>();
    const visit = async (node: DefaultTreeAdapterTypes.Node): Promise<void> => {
      if ("tagName" in node && node.tagName === "img") {
        const source = node.attrs.find((attr) => attr.name === "src");
        const lazySource = node.attrs.find((attr) => attr.name === "data-src");
        const value = source?.value || lazySource?.value;
        if (!value) throw new Error("正文图片缺少地址，请补充后再上传");
        if (!uploaded.has(value)) {
          // 正文图片与封面接口不同，必须先转存为微信 URL；同一张图在本次任务内只传一次。
          const image = await this.downloadImage(value, 1024 * 1024 - 1);
          if (!["image/jpeg", "image/png"].includes(image.contentType)) throw new Error("微信正文图片仅支持 JPG/PNG 且必须小于 1MB");
          const form = new FormData();
          form.append("media", new Blob([image.bytes.buffer as ArrayBuffer], { type: image.contentType }), image.contentType === "image/png" ? "image.png" : "image.jpg");
          const url = new URL("/cgi-bin/media/uploadimg", config.WECHAT_API_BASE_URL);
          url.searchParams.set("access_token", await this.getAccessToken());
          const response = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
          const data = await response.json() as { url?: string; errcode?: number };
          if (!response.ok || data.errcode || !data.url) throw new WechatApiError(data.errcode ?? response.status, "正文图片上传失败");
          uploaded.set(value, data.url);
        }
        // 不保留懒加载和响应式外链，避免微信过滤或浏览器继续使用原图。
        node.attrs = node.attrs.filter((attr) => !["src", "data-src", "srcset"].includes(attr.name));
        node.attrs.push({ name: "src", value: uploaded.get(value)! });
      }
      if ("childNodes" in node) for (const child of node.childNodes) await visit(child);
    };
    await visit(fragment);
    return serialize(fragment);
  }

  private async uploadCoverBytes(bytes: Uint8Array, contentType: string, filename: string) {
    const form = new FormData();
    form.append("media", new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: contentType }), filename);
    const apiUrl = new URL("/cgi-bin/material/add_material", config.WECHAT_API_BASE_URL);
    apiUrl.searchParams.set("access_token", await this.getAccessToken());
    apiUrl.searchParams.set("type", "thumb");
    const response = await fetch(apiUrl, { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
    const body = await response.json() as { media_id?: string; errcode?: number; errmsg?: string };
    if (!response.ok || !body.media_id) throw new WechatApiError(body.errcode ?? response.status, "上传微信封面失败");
    return body.media_id;
  }
}

const blockedAddresses = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16], ["192.0.0.0", 24], ["198.18.0.0", 15], ["224.0.0.0", 3]] as const) blockedAddresses.addSubnet(address, prefix, "ipv4");

/** 解析后固定目标 IP，禁止重定向，流式限额，避免正文图片下载成为内网访问入口。 */
export async function downloadPublicImage(value: string, maxBytes: number) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("图片只允许使用不含凭证的公网 HTTP(S) 地址");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await dns.lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address, family }) => family === 4 ? blockedAddresses.check(address, "ipv4") : !/^[23][0-9a-f]{3}:/i.test(address))) throw new Error("图片地址不允许访问本机或内网");
  const target = addresses[0];
  return new Promise<{ bytes: Uint8Array; contentType: string }>((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      // TLS 校验及 Host 仍使用原域名，仅将连接地址固定为刚校验的公网 IP。
      family: target.family,
      lookup: (_host, _options, callback) => callback(null, target.address, target.family),
      signal: AbortSignal.timeout(10_000),
    }, (response) => {
      if (response.statusCode !== 200) { response.destroy(); reject(new Error(`图片下载失败：HTTP ${response.statusCode}`)); return; }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) { response.destroy(new Error(`图片超过大小限制（${maxBytes} 字节）`)); return; }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolve({ bytes: new Uint8Array(Buffer.concat(chunks)), contentType: (response.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase() }));
    });
    request.on("error", () => reject(new Error("图片下载失败，请检查公网图片地址")));
    request.end();
  });
}

export type OperationAction = Operation["action"];
export const wechatProvider = new WechatProvider();
