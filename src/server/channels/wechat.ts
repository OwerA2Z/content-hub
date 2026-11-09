import { promises as dns } from "node:dns";
import { BlockList, isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { parseFragment, serialize, type DefaultTreeAdapterTypes } from "parse5";
import type { Article, ChannelCapabilities, Operation } from "../../shared/contracts";
import { config } from "../config";
import { mediaAssetRepository } from "../media-library";
import { readMediaFile } from "../media-storage";
import { isWechatConfigUnreadable, wechatSettings, type WechatCredentials } from "../wechat-settings";

export interface ChannelResult { externalId: string; }

export interface ChannelProvider {
  getCapabilities(): Promise<ChannelCapabilities>;
  createDraft(article: Article): Promise<ChannelResult>;
  publish(article: Article, draftId?: string): Promise<ChannelResult>;
  getPublishStatus(publishId: string): Promise<"pending" | "succeeded" | "failed">;
}

export class WechatApiError extends Error {
  constructor(public readonly code: number, message: string) {
    super(message);
    this.name = "WechatApiError";
    this.message = `${message}（微信错误码：${code}）`;
  }
}

// 快照实例与单例共享缓存和进行中的请求，凭证不同绝不复用 token。
const tokenCache = new Map<string, { value: string; expiresAt: number }>();
const tokenRequests = new Map<string, Promise<string>>();

/** 从有效配置读取凭证；凭证变化后不复用旧公众号的 token。 */
export class WechatProvider implements ChannelProvider {
  constructor(private readonly downloadImage = downloadPublicImage, private readonly credentialsSnapshot?: WechatCredentials) {}

  async getCapabilities(): Promise<ChannelCapabilities> {
    let credentials: WechatCredentials;
    try { credentials = this.credentialsSnapshot ?? await wechatSettings.credentials(); }
    catch (error) {
      if (!isWechatConfigUnreadable(error)) throw error;
      return { provider: "wechat", draft: false, publish: false, reason: "公众号配置无法解密，请重新填写凭证（AppID 和新的 AppSecret）" };
    }
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
    const key = JSON.stringify([credentials.appId, credentials.appSecret]);
    const cached = tokenCache.get(key);
    // 强制测试忽略已完成缓存，但与同凭证正在进行的刷新合并，避免并发刷新互相失效。
    const pending = tokenRequests.get(key);
    if (pending) return pending;
    if (!force && cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
    tokenCache.delete(key);
    const request = (async () => {
      const url = new URL("/cgi-bin/token", config.WECHAT_API_BASE_URL);
      url.searchParams.set("grant_type", "client_credential");
      url.searchParams.set("appid", credentials.appId);
      url.searchParams.set("secret", credentials.appSecret);
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const body = await response.json() as { access_token?: string; expires_in?: number; errcode?: number };
      if (!response.ok || !body.access_token) throw new WechatApiError(body.errcode ?? response.status, "获取微信公众号 access_token 失败");
      tokenCache.set(key, { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 7_200) * 1_000 });
      return body.access_token;
    })();
    tokenRequests.set(key, request);
    try { return await request; }
    finally { tokenRequests.delete(key); }
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
      return this.uploadCoverBytes(bytes, asset.originalName);
    }
    const urlValue = article.coverUrl ?? article.images[0];
    if (!urlValue) throw new Error("微信公众号草稿需要封面素材、coverUrl 或 images[0]");
    const image = await this.readImage(urlValue, 10 * 1024 * 1024);
    return this.uploadCoverBytes(image.bytes, "cover-image");
  }

  private async readImage(value: string, maxBytes: number) {
    // 只有素材库的根相对路径、或 PUBLIC_BASE_URL 同源素材 URL 才能读取本地文件。
    let path: string | undefined;
    if (value.startsWith("/media/assets/")) path = value;
    else {
      const url = parseImageUrl(value);
      if (config.PUBLIC_BASE_URL && url.origin === new URL(config.PUBLIC_BASE_URL).origin && !url.username && !url.password) path = url.pathname;
    }
    const match = path?.match(/^\/media\/assets\/([^/?#]+)\/content$/);
    let image: { bytes: Uint8Array; contentType: string };
    if (match) {
      let id: string;
      try { id = decodeURIComponent(match[1]); }
      catch { throw new Error("本站素材图片地址无效"); }
      const asset = await mediaAssetRepository.get(id);
      if (!asset || asset.status !== "active") throw new Error("图片素材不存在或已归档，请选择有效素材");
      image = { bytes: await readMediaFile(asset.storageKey), contentType: asset.mimeType };
    } else {
      parseImageUrl(value);
      image = await this.downloadImage(value, maxBytes);
    }
    if (image.bytes.byteLength > maxBytes) throw new Error(`图片超过大小限制（${maxBytes} 字节）`);
    // 响应头可能缺失或为 octet-stream，以文件头为准，不信任 MIME 声明。
    return { bytes: image.bytes, contentType: detectImageType(image.bytes) ?? "" };
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
          const image = await this.readImage(value, 1024 * 1024 - 1);
          if (!["image/jpeg", "image/png"].includes(image.contentType)) throw new Error("微信正文图片仅支持 JPG/PNG 且必须小于 1MB");
          const form = new FormData();
          form.append("media", new Blob([new Uint8Array(image.bytes).buffer as ArrayBuffer], { type: image.contentType }), image.contentType === "image/png" ? "image.png" : "image.jpg");
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

  private async uploadCoverBytes(bytes: Uint8Array, filename: string) {
    const contentType = detectImageType(bytes);
    if (!contentType) throw new Error("微信封面图片仅支持有效的 JPG/PNG/GIF/WebP 图片");
    if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("封面图片不能超过 10MB");
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

function parseImageUrl(value: string): URL {
  try { return new URL(value); }
  catch { throw new Error("图片地址无效：仅支持本站素材路径 /media/assets/{id}/content 或完整的公网 HTTP(S) 地址"); }
}

function detectImageType(bytes: Uint8Array): string | undefined {
  const head = Buffer.from(bytes.subarray(0, 12));
  if (head.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "image/png";
  if (head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(head.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return undefined;
}

const blockedAddresses = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16], ["192.0.0.0", 24], ["198.18.0.0", 15], ["224.0.0.0", 3]] as const) blockedAddresses.addSubnet(address, prefix, "ipv4");

/** 解析后固定目标 IP，禁止重定向，流式限额，避免正文图片下载成为内网访问入口。 */
export async function downloadPublicImage(value: string, maxBytes: number) {
  const url = parseImageUrl(value);
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
