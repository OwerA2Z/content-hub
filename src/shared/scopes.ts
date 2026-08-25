export const TOKEN_SCOPES = [
  "articles:read",
  "articles:write",
  "articles:archive",
  "planning:read",
  "planning:write",
  "recommendations:read",
  "recommendations:write",
  "recommendations:accept",
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
  "recommendations:read": "读取每日候选池",
  "recommendations:write": "提交/重评估候选文章",
  "recommendations:accept": "接受候选并保存文章",
  "dedup:check": "防重复检测",
  "operations:read": "读取操作任务",
  "wechat:draft": "创建微信草稿",
  "wechat:publish": "提交微信发布",
};
