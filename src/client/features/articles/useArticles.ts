import { useCallback, useEffect, useState } from "react";
import { articleApi } from "../../lib/api/articles";
import type { Article, Capabilities } from "../../lib/api/types";

/** 文章列表、筛选和微信公众号操作的状态边界，页面组件只负责渲染。 */
export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [caps, setCaps] = useState<Capabilities>();
  const [selected, setSelected] = useState<Article>();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [draftId, setDraftId] = useState<string>();

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (includeArchived) params.set("includeArchived", "true");
    Promise.all([articleApi.list(`?${params}`), articleApi.capabilities()])
      .then(([list, channel]) => { setArticles(list.data); setTotal(list.meta.total); setCaps(channel.data); })
      .catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [includeArchived, q, status]);

  useEffect(() => { load(); }, [load]);

  const selectArticle = useCallback((article: Article) => {
    articleApi.get(article.id).then((result) => setSelected(result.data)).catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "加载文章详情失败"));
  }, []);

  const archive = useCallback(() => {
    if (!selected) return;
    articleApi.archive(selected.id).then(() => { setNotice("文章已归档"); setSelected(undefined); load(); }).catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "归档失败"));
  }, [load, selected]);

  const restore = useCallback(() => {
    if (!selected) return;
    articleApi.restore(selected.id).then(() => { setNotice("文章已恢复"); setSelected(undefined); load(); }).catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "恢复失败"));
  }, [load, selected]);

  const createDraft = useCallback(() => {
    if (!selected) return;
    if (!selected.coverUrl && !(selected.images?.[0])) { setNotice("请先补充封面图片 URL，再创建微信草稿"); return; }
    articleApi.createDraft(selected.id).then((result) => {
      setNotice("草稿任务已提交");
      window.setTimeout(() => {
        articleApi.getOperation(result.data.id).then((operation) => {
          if (operation.data.status === "succeeded") { setDraftId(operation.data.externalId); setNotice("微信草稿已创建"); load(); }
          else if (operation.data.status === "failed") setNotice(operation.data.errorMessage ?? "创建草稿失败");
        }).catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "查询草稿任务失败"));
      }, 1200);
    }).catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "创建草稿失败"));
  }, [load, selected]);

  const retry = useCallback(() => {
    if (!selected) return;
    articleApi.retry(selected.id).then(() => { setNotice("重试任务已提交"); load(); }).catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "重试失败"));
  }, [load, selected]);

  const publish = useCallback(() => {
    if (!selected || !draftId) return;
    articleApi.publish(selected.id, draftId).then(() => setNotice("发布任务已提交")).catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "发布失败"));
  }, [draftId, selected]);

  const updateMedia = useCallback((coverUrl: string) => {
    if (!selected) return;
    articleApi.updateMedia(selected.id, { coverUrl }).then((result) => { setSelected(result.data); setNotice("封面图片已保存"); load(); }).catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "保存封面图片失败"));
  }, [load, selected]);

  return { articles, total, caps, selected, q, status, includeArchived, loading, notice, draftId, setQ, setStatus, setIncludeArchived, setNotice, setSelected, load, selectArticle, archive, restore, createDraft, retry, publish, updateMedia, canPublish: Boolean(draftId && caps?.publish) };
}
