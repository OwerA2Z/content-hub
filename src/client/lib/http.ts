/** 前端请求入口：统一携带会话 Cookie，并将后端错误转换成可展示的 Error。 */
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // 针对非 JSON 响应（例如网关 502/504 错误页）做兼容处理
  }
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body &&
      typeof body.error === "object" && body.error !== null && "message" in body.error &&
      typeof body.error.message === "string"
        ? body.error.message
        : `请求失败 (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}
