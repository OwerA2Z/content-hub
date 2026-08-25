export const TOKEN_SCOPES = [
  "articles:read",
  "articles:write",
  "articles:archive",
  "planning:read",
  "planning:write",
  "dedup:check",
  "operations:read",
  "wechat:draft",
  "wechat:publish",
] as const;

export type TokenScope = typeof TOKEN_SCOPES[number];

export const TOKEN_SCOPE_LABELS: Record<TokenScope, string> = {
  "articles:read": "读取文章",
  "articles:write": "上传文章",
  "articles:archive": "归档/恢复文章",
  "planning:read": "读取内容规划",
  "planning:write": "创建/更新内容规划",
  "dedup:check": "防重复检测",
  "operations:read": "读取操作任务",
  "wechat:draft": "创建微信草稿",
  "wechat:publish": "提交微信发布",
};
