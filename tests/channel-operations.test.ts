import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { repository } from "../src/server/db/repository";
import { WechatApiError, wechatProvider } from "../src/server/channels/wechat";
import { processChannelOperation, resumePendingOperations } from "../src/server/services/channel-operations";

afterEach(() => vi.restoreAllMocks());

describe("渠道操作异常收口", () => {
  beforeEach(() => {
    // 仓库与渠道全部使用本地桩，不连接数据库或真实公众号。
    vi.spyOn(repository, "get").mockResolvedValue(undefined);
    vi.spyOn(repository, "updateStatus").mockResolvedValue(undefined);
    vi.spyOn(repository, "completeOperation").mockResolvedValue(undefined);
    vi.spyOn(repository, "recordAudit").mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("文章状态回写失败仍尝试操作回写和审计", async () => {
    const { article } = await repository.createOrGet({ title: "状态回写测试", content: "<p>正文</p>", contentFormat: "html" });
    vi.mocked(repository.get).mockResolvedValue(article);
    vi.spyOn(repository, "getOperation").mockResolvedValue(undefined);
    vi.spyOn(wechatProvider, "createDraft").mockResolvedValue({ externalId: "mock-draft" });
    vi.mocked(repository.updateStatus).mockRejectedValue(new Error("database unavailable"));
    await expect(processChannelOperation("op-1", "article-1", "draft")).resolves.toBeUndefined();
    expect(repository.updateStatus).toHaveBeenNthCalledWith(1, "article-1", "draft_ready");
    expect(repository.updateStatus).toHaveBeenNthCalledWith(2, "article-1", "sync_failed");
    expect(repository.completeOperation).toHaveBeenCalledWith("op-1", "failed", { errorMessage: "database unavailable" });
    expect(repository.recordAudit).toHaveBeenCalledWith({ action: "wechat.draft.failed", actorType: "system", articleId: "article-1", operationId: "op-1", success: false });
  });

  it("全部回写失败仍 resolve，日志结构完整且凭证脱敏", async () => {
    const secret = "access_token=private-token raw-response";
    vi.mocked(repository.get).mockRejectedValue(new Error(secret));
    vi.mocked(repository.updateStatus).mockRejectedValue(new Error(secret));
    vi.mocked(repository.completeOperation).mockRejectedValue(new Error(secret));
    vi.mocked(repository.recordAudit).mockRejectedValue(new Error(secret));
    await expect(processChannelOperation("op-1", "article-1", "publish")).resolves.toBeUndefined();
    expect(repository.recordAudit).toHaveBeenCalledTimes(1);
    const logs = vi.mocked(console.error).mock.calls;
    expect(logs).toHaveLength(4);
    for (const [line] of logs) {
      expect(JSON.parse(line)).toEqual({ level: "error", message: expect.any(String), operationId: "op-1", articleId: "article-1", action: "publish", error: { name: "Error", message: "access_token=*** raw-response" } });
      expect(line).not.toContain(secret);
      expect(line).not.toContain("private-token");
    }
  });

  it("待恢复查询失败仍 resolve 并记录日志", async () => {
    vi.spyOn(repository, "listPendingOperations").mockRejectedValue(new Error("private database error"));
    await expect(resumePendingOperations()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(JSON.stringify({ level: "error", message: "查询待恢复渠道操作失败", error: { name: "Error", message: "private database error" } }));
    expect(repository.get).not.toHaveBeenCalled();
  });

  it("数据库业务与各回写错误分别记录，且不输出附带对象或 stack", async () => {
    const messages = ["业务失败", "文章回写失败", "操作回写失败", "审计回写失败"];
    const errors = messages.map((message, index) => Object.assign(new Error(message), {
      code: ["42P08", "08006", "23505", "42501"][index],
      detail: "https://example.test/?access_token=xxx&secret=yyy&APPSECRET=zzz",
      table: "channel_operations", column: "status", response: { body: "原始响应" }, request: { body: "请求体" },
    }));
    vi.mocked(repository.get).mockRejectedValue(errors[0]);
    vi.mocked(repository.updateStatus).mockRejectedValue(errors[1]);
    vi.mocked(repository.completeOperation).mockRejectedValue(errors[2]);
    vi.mocked(repository.recordAudit).mockRejectedValue(errors[3]);
    await expect(processChannelOperation("op-pg", "article-pg", "draft")).resolves.toBeUndefined();
    const logs = vi.mocked(console.error).mock.calls.map(([line]) => JSON.parse(line));
    for (const [index, message] of ["渠道操作失败", "渠道操作失败：文章状态回写失败", "渠道操作失败：操作状态回写失败", "渠道操作失败：审计写入失败"].entries()) {
      expect(logs.find((log) => log.message === message)).toEqual({
        level: "error", message, operationId: "op-pg", articleId: "article-pg", action: "draft",
        error: { name: "Error", code: errors[index].code, message: messages[index],
          detail: "https://example.test/?access_token=***&secret=***&APPSECRET=***", table: "channel_operations", column: "status" },
      });
    }
    expect(logs).toHaveLength(4);
    const output = JSON.stringify(logs);
    for (const forbidden of ["stack", "response", "request", "xxx", "yyy", "zzz"]) expect(output).not.toContain(forbidden);
  });

  it("消息和数据库 detail 先脱敏再截断到 300 字符，持久化仍保留原消息", async () => {
    const message = "https://example.test/?ACCESS_TOKEN=xxx&secret=yyy&AppSecret=zzz " + "长".repeat(400);
    vi.mocked(repository.get).mockRejectedValue(Object.assign(new Error(message), { code: "42P08", detail: message }));
    await processChannelOperation("op-long", "article-long", "draft");
    const log = JSON.parse(vi.mocked(console.error).mock.calls[0][0]);
    const expected = ("https://example.test/?ACCESS_TOKEN=***&secret=***&AppSecret=*** " + "长".repeat(400)).slice(0, 300);
    expect(log.error.message).toBe(expected);
    expect(log.error.detail).toBe(expected);
    expect(log.error.message).toHaveLength(300);
    expect(repository.completeOperation).toHaveBeenCalledWith("op-long", "failed", { errorMessage: message });
  });

  it("WechatApiError 记录数字微信错误码", async () => {
    const error = new WechatApiError(40001, "invalid credential access_token=xxx&secret=yyy");
    vi.mocked(repository.get).mockRejectedValue(error);
    await processChannelOperation("op-wechat", "article-wechat", "draft");
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0]).error).toEqual({
      name: "WechatApiError", code: 40001, message: "invalid credential access_token=***&secret=***",
    });
    expect(repository.completeOperation).toHaveBeenCalledWith("op-wechat", "failed", { errorMessage: error.message });
  });

  it("一个恢复任务及其回写失败不影响其他任务成功", async () => {
    const { article } = await repository.createOrGet({ title: "恢复测试", content: "<p>正文</p>", contentFormat: "html" });
    vi.spyOn(repository, "listPendingOperations").mockResolvedValue(["bad", "good"].map((id) => ({
      id, articleId: id, provider: "wechat" as const, action: "draft" as const, status: "pending" as const, createdAt: new Date().toISOString(),
    })));
    vi.mocked(repository.get).mockImplementation(async (id) => {
      if (id === "bad") throw new Error("读取失败");
      return article;
    });
    vi.spyOn(repository, "getOperation").mockResolvedValue(undefined);
    vi.mocked(repository.updateStatus).mockImplementation(async (id) => {
      if (id === "bad") throw new Error("回写失败");
      return undefined;
    });
    vi.mocked(repository.completeOperation).mockImplementation(async (id) => {
      if (id === "bad") throw new Error("回写失败");
      return undefined;
    });
    vi.mocked(repository.recordAudit).mockRejectedValue(new Error("审计失败"));
    vi.spyOn(wechatProvider, "createDraft").mockResolvedValue({ externalId: "mock-draft" });
    await expect(resumePendingOperations()).resolves.toBeUndefined();
    expect(repository.get).toHaveBeenCalledWith("bad");
    expect(repository.get).toHaveBeenCalledWith("good");
    expect(repository.completeOperation).toHaveBeenCalledWith("good", "succeeded", { externalId: "mock-draft" });
  });
});
