import { useEffect, useRef, useState } from "react";
import { articleApi } from "../../lib/api/articles";
import { candidateApi } from "../../lib/api/candidates";
import type { ContentCandidate } from "../../lib/api/types";
import { resolveCandidateDraft } from "./candidateDraftDecision";

/** 页面只持有一个上传流程；run 与候选 ID 共同隔离过期提交和轮询响应。 */
export function useCandidateDraft({
  onNotice, onAccepted, onComplete,
}: {
  onNotice: (notice: string) => void;
  onAccepted: (candidateId: string, articleId: string) => void;
  onComplete: () => void;
}) {
  const [uploadingId, setUploadingId] = useState<string>();
  const [draftNotice, setDraftNotice] = useState<{ candidateId: string; message: string }>();
  const current = useRef<{ run: number; candidateId?: string }>({ run: 0 });
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    mounted.current = true;
    return () => {
      // 仅页面卸载时作废当前流程并清理轮询，预览开关不应中断任务反馈。
      mounted.current = false;
      current.current = { run: current.current.run + 1 };
      if (timer.current !== undefined) clearTimeout(timer.current);
    };
  }, []);

  const uploadDraft = async (candidate: ContentCandidate) => {
    // ref 同步加锁，覆盖 React 尚未重新渲染时的重复点击。
    if (current.current.candidateId) return;
    const run = current.current.run + 1;
    current.current = { run, candidateId: candidate.id };
    const active = () => mounted.current && current.current.run === run && current.current.candidateId === candidate.id;
    const notice = (text: string) => {
      setDraftNotice({ candidateId: candidate.id, message: text });
      onNotice(`《${candidate.title}》：${text}`);
    };
    const finish = () => {
      if (!active()) return;
      current.current = { run };
      timer.current = undefined;
      setUploadingId(undefined);
      onComplete();
    };
    setUploadingId(candidate.id);
    setDraftNotice(undefined);
    try {
      const operationId = await resolveCandidateDraft(candidate, {
        accept: candidateApi.accept, createDraft: articleApi.createDraft,
      }, active, (articleId) => {
        if (mounted.current) onAccepted(candidate.id, articleId);
      });
      if (!active() || !operationId) return;
      notice("草稿任务已提交，正在处理中…");
      let attempts = 0;
      // 每次查询结束再计时，慢请求不会与下一次轮询重叠。
      const poll = async () => {
        if (!active()) return;
        attempts += 1;
        try {
          const { data } = await articleApi.getOperation(operationId);
          if (!active()) return;
          if (data.status === "succeeded" || data.status === "failed") {
            notice(data.status === "succeeded"
              ? `已上传微信草稿箱${data.externalId ? `，草稿 ID：${data.externalId}` : ""}`
              : `上传失败：${data.errorMessage ?? "未知错误"}`);
            finish();
            return;
          }
        } catch (error: unknown) {
          if (!active()) return;
          if (attempts >= 60) {
            notice(`查询任务失败：${error instanceof Error ? error.message : "未知错误"}。后台可能仍在处理，请刷新确认，避免重复上传。`);
            finish();
            return;
          }
        }
        if (attempts >= 60) {
          notice("后台可能仍在处理，请稍后刷新确认，避免重复上传。");
          finish();
          return;
        }
        timer.current = setTimeout(() => void poll(), 1500);
      };
      void poll();
    } catch (error: unknown) {
      if (!active()) return;
      notice(error instanceof Error ? error.message : "上传草稿失败");
      finish();
    }
  };
  return { uploadingId, uploadDraft, draftNotice };
}
