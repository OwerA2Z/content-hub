import { useCallback, useEffect, useRef, useState } from "react";
import { articleApi } from "../../lib/api/articles";
import type { Article, Capabilities } from "../../lib/api/types";

/** 文章列表、筛选和微信公众号操作的状态边界，页面组件只负责渲染。 */
export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [caps, setCaps] = useState<Capabilities>();
  const [selected, updateSelected] = useState<Article>();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [draftId, setDraftId] = useState<string>();
  const pollTimerRef = useRef<number | undefined>(undefined);
  const draftRunRef = useRef(0);
  const selectedIdRef = useRef(selected?.id);
  selectedIdRef.current = selected?.id;
  const selectionRequestRef = useRef(0);
  const setSelected = useCallback((article?: Article) => {
    // 在关闭/切换事件当下作废请求，不等 useEffect，覆盖请求恰好完成的窗口。
    draftRunRef.current += 1;
    selectionRequestRef.current += 1;
    selectedIdRef.current = article?.id;
    updateSelected(article);
  }, []);

  // 组件卸载或重新发起草稿任务时清理轮询，避免后台请求继续更新已失效页面。
  useEffect(() => () => {
    draftRunRef.current += 1;
    if (pollTimerRef.current !== undefined) window.clearTimeout(pollTimerRef.current);
  }, []);

  useEffect(() => {
    // 关闭或切换文章详情时终止旧文章的草稿轮询，避免结果串到当前文章。
    if (pollTimerRef.current !== undefined) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = undefined;
      setActionLoading(false);
    }
    draftRunRef.current += 1;
    setActionLoading(false);
  }, [selected?.id]);

  const load = useCallback((requestedPage = 1, pageSize = 10) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (includeArchived) params.set("includeArchived", "true");
    params.set("page", String(requestedPage));
    params.set("pageSize", String(pageSize));
    Promise.all([articleApi.list(`?${params}`), articleApi.capabilities()])
      .then(([list, channel]) => {
        setArticles(list.data);
        setTotal(list.meta.total);
        setCaps(channel.data);
      })
      .catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [includeArchived, q, status]);

  useEffect(() => {
    setPage(1);
    load();
  }, [load]);

  const selectArticle = useCallback((article: Article) => {
    setDraftId(undefined);
    setSelected(article);
    const request = selectionRequestRef.current;
    articleApi.get(article.id).then((result) => {
      if (selectionRequestRef.current === request) updateSelected(result.data);
    }).catch((reason: unknown) => {
      if (selectionRequestRef.current === request) setNotice(reason instanceof Error ? reason.message : "加载文章详情失败");
    });
  }, [setSelected]);

  const archive = useCallback(
    (articleId?: string) => {
      if (actionLoading) return;
      const targetId = articleId ?? selected?.id;
      if (!targetId) return;
      setActionLoading(true);
      articleApi
        .archive(targetId)
        .then(() => {
          setNotice("文章已归档");
          if (selected?.id === targetId) setSelected(undefined);
          setPage(1);
          load();
        })
        .catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "归档失败"))
        .finally(() => setActionLoading(false));
    },
    [actionLoading, load, selected],
  );

  const restore = useCallback(
    (articleId?: string) => {
      if (actionLoading) return;
      const targetId = articleId ?? selected?.id;
      if (!targetId) return;
      setActionLoading(true);
      articleApi
        .restore(targetId)
        .then(() => {
          setNotice("文章已恢复");
          if (selected?.id === targetId) setSelected(undefined);
          setPage(1);
          load();
        })
        .catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "恢复失败"))
        .finally(() => setActionLoading(false));
    },
    [actionLoading, load, selected],
  );

  const submitOperation = useCallback((retryMode: boolean) => {
    if (actionLoading || !selected) return;
    if (!retryMode && !caps?.draft) { setNotice("请先在微信公众号页面配置凭证"); return; }
    if (!retryMode && !selected.coverUrl && !selected.coverAssetId && !selected.images?.[0]) {
      setNotice("请先补充并保存封面，再上传微信草稿箱"); return;
    }
    const articleId = selected.id;
    const run = ++draftRunRef.current;
    const active = () => draftRunRef.current === run && selectedIdRef.current === articleId;
    setActionLoading(true);
    setDraftId(undefined);
    if (pollTimerRef.current !== undefined) window.clearTimeout(pollTimerRef.current);
    // 串行轮询避免慢请求重叠；请求身份检查覆盖提交、查询和详情刷新三个异步边界。
    const refresh = async () => {
      const result = await articleApi.get(articleId);
      if (!active()) return;
      updateSelected(result.data);
      setPage(1);
      load();
    };
    (retryMode ? articleApi.retry(articleId) : articleApi.createDraft(articleId)).then((result) => {
      if (!active()) return;
      setNotice(retryMode ? "重试任务已提交，正在处理中…" : "草稿上传任务已提交，正在处理中…");
      let attempts = 0;
      const poll = async () => {
        if (!active()) return;
        attempts += 1;
        try {
          const { data } = await articleApi.getOperation(result.data.id);
          if (!active()) return;
          if (data.status === "succeeded" || data.status === "failed") {
            setActionLoading(false);
            pollTimerRef.current = undefined;
            if (data.status === "succeeded") {
              if (data.action === "draft") {
                setDraftId(data.externalId);
                setNotice(`已上传微信草稿箱${data.externalId ? `，草稿 ID：${data.externalId}` : ""}`);
              } else { setNotice("微信发布任务已完成"); }
            } else { setNotice(`上传失败：${data.errorMessage ?? "请稍后重试"}`); }
            await refresh().catch(() => {
              if (active()) setNotice(data.status === "succeeded" ? `微信任务已成功，详情刷新失败，请手动刷新${data.externalId ? `。结果 ID：${data.externalId}` : ""}` : `微信任务失败：${data.errorMessage ?? "未知错误"}。详情刷新失败，请手动刷新。`);
            });
            return;
          }
        } catch (reason) {
          if (!active()) return;
          if (attempts >= 60) {
            setNotice(reason instanceof Error ? `查询任务失败：${reason.message}。请刷新确认结果后再重试。` : "查询任务失败，请刷新确认结果");
            setActionLoading(false);
            pollTimerRef.current = undefined;
            return;
          }
        }
        if (!active()) return;
        if (attempts >= 60) {
          setNotice("后台仍在处理，请稍后刷新查看，避免重复上传。");
          setActionLoading(false);
          pollTimerRef.current = undefined;
          return;
        }
        pollTimerRef.current = window.setTimeout(poll, 1500);
      };
      void poll();
    }).catch((reason: unknown) => {
      if (!active()) return;
      setNotice(reason instanceof Error ? reason.message : "上传草稿失败");
      setActionLoading(false);
    });
  }, [actionLoading, caps, load, selected]);

  const createDraft = useCallback(() => submitOperation(false), [submitOperation]);
  const retry = useCallback(() => submitOperation(true), [submitOperation]);

  const publish = useCallback(() => {
    if (actionLoading) return;
    if (!selected || !draftId) return;
    setActionLoading(true);
    articleApi
      .publish(selected.id, draftId)
      .then(() => setNotice("发布任务已提交，请留意公众号后台"))
      .catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "发布失败"))
      .finally(() => setActionLoading(false));
  }, [actionLoading, draftId, selected]);

  const updateMedia = useCallback(
    (coverUrl: string, coverAssetId?: string) => {
      if (actionLoading) return;
      if (!selected) return;
      setActionLoading(true);
      articleApi
        .updateMedia(selected.id, { coverUrl, coverAssetId })
        .then((result) => {
          setSelected(result.data);
          setNotice("封面图片已保存");
          setPage(1);
          load();
        })
        .catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "保存封面图片失败"))
        .finally(() => setActionLoading(false));
    },
    [actionLoading, load, selected],
  );

  return {
    articles,
    total,
    page,
    caps,
    selected,
    q,
    status,
    includeArchived,
    loading,
    actionLoading,
    notice,
    draftId,
    setQ,
    setStatus,
    setIncludeArchived,
    setPage,
    setNotice,
    setSelected,
    load,
    selectArticle,
    archive,
    restore,
    createDraft,
    retry,
    publish,
    updateMedia,
    canPublish: Boolean(draftId && caps?.publish),
  };
}
