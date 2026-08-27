import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Article, Capabilities } from "../../lib/api/types";
import { eyebrowClass } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { copyArticleContent, copyText } from "../../lib/clipboard";
import { mediaApi } from "../../lib/api/media";
import type { MediaAsset } from "../../lib/api/types";

export function ArticleDrawer({ article, caps, canPublish, onClose, onArchive, onRestore, onDraft, onRetry, onPublish, onMediaSave, onNotice }: { article?: Article; caps?: Capabilities; canPublish: boolean; onClose: () => void; onArchive: () => void; onRestore: () => void; onDraft: () => void; onRetry: () => void; onPublish: () => void; onMediaSave: (coverUrl: string, coverAssetId?: string) => void; onNotice: (message: string) => void }) {
  const [coverUrl, setCoverUrl] = useState("");
  const [coverError, setCoverError] = useState(false);
  const [assetLoadError, setAssetLoadError] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>();
  useEffect(() => {
    let active = true;
    const existingUrl = article?.coverUrl ?? article?.images?.[0] ?? "";
    setCoverUrl(existingUrl);
    setSelectedAssetId(article?.coverAssetId);
    setCoverError(false);
    setAssetLoadError(false);
    setAssetPickerOpen(false);
    // 文章可能只保存素材 ID（例如由 AI 或候选池创建），此时补查素材 URL 以便预览和再次保存。
    if (article?.coverAssetId) {
      mediaApi.get(article.coverAssetId).then((result) => {
        if (!active) return;
        if (result.data.status !== "active") {
          // 素材被归档时保留旧 coverUrl（若有），但不再提交失效的素材 ID。
          setSelectedAssetId(undefined);
          setAssetLoadError(!existingUrl);
          return;
        }
        if (!existingUrl) setCoverUrl(result.data.url);
      }).catch(() => {
        if (!active) return;
        setSelectedAssetId(undefined);
        setAssetLoadError(!existingUrl);
      });
    }
    return () => { active = false; };
  }, [article?.coverAssetId, article?.coverUrl, article?.id, article?.images]);
  if (!article) return null;
  const hasCover = Boolean((coverUrl || selectedAssetId) && !assetLoadError);
  const openAssetPicker = () => mediaApi.list().then((result) => { setAssets(result.data); setAssetPickerOpen(true); }).catch(() => onNotice("加载素材库失败"));
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25"><button aria-label="关闭文章详情" className="absolute inset-0 cursor-pointer border-0 bg-transparent" onClick={onClose} /><aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-background p-6 shadow-2xl"><div className="mb-4 flex items-start justify-between gap-4"><div><p className={eyebrowClass}>ARTICLE PREVIEW</p><h3 className="mt-1.5 text-[22px]">{article.title}</h3></div><Button aria-label="关闭文章详情" variant="ghost" size="icon" onClick={onClose}><X size={18} /></Button></div><div className="mb-5 flex flex-wrap gap-2">{article.status === "archived" ? <Button variant="secondary" size="sm" onClick={onRestore}>恢复</Button> : <Button variant="secondary" size="sm" onClick={onArchive}>归档</Button>}{article.status === "sync_failed" && <Button variant="secondary" size="sm" onClick={onRetry}>重试</Button>}{caps?.draft && <Button size="sm" onClick={onDraft}>创建微信草稿</Button>}{canPublish && <Button size="sm" onClick={onPublish}>提交发布</Button>}</div><section className="mb-5 rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between gap-3"><div><h4 className="text-sm font-semibold">封面图片</h4><p className="mt-1 text-xs text-muted-foreground">微信公众号草稿必须提供一张可公网访问的 HTTPS 图片。</p></div>{hasCover && <span className="text-xs text-emerald-600">已配置</span>}</div><div className="mt-3 flex flex-wrap gap-2"><Input className="min-w-0 flex-1" placeholder="https://example.com/cover.jpg" value={coverUrl} onChange={(event) => { setCoverUrl(event.target.value); setSelectedAssetId(undefined); setCoverError(false); setAssetLoadError(false); }} /><Button size="sm" disabled={!coverUrl.trim() || assetLoadError} onClick={() => onMediaSave(coverUrl.trim(), selectedAssetId)}>保存</Button><Button variant="outline" size="sm" onClick={openAssetPicker}>从素材库选择</Button></div>{assetLoadError && <p className="mt-3 text-xs text-amber-700">关联素材无法读取，请重新从素材库选择。</p>}{assetPickerOpen && <div className="mt-3 grid grid-cols-3 gap-2 rounded-md border border-border bg-muted p-2 sm:grid-cols-4">{assets.length === 0 ? <p className="col-span-full py-4 text-center text-xs text-muted-foreground">暂无可用素材</p> : assets.map((asset) => <button type="button" key={asset.id} className={`overflow-hidden rounded-md border-2 bg-background ${selectedAssetId === asset.id ? "border-primary" : "border-transparent"}`} onClick={() => { setSelectedAssetId(asset.id); setCoverUrl(asset.url); setCoverError(false); setAssetLoadError(false); }}><img src={asset.url} alt={asset.alt || asset.originalName} className="aspect-square w-full object-cover" /></button>)}</div>}{coverUrl && (coverError ? <p className="mt-3 text-xs text-amber-700">封面地址无法加载，请确认图片 URL 可公网访问。</p> : <img className="mt-3 h-32 w-full rounded-md border border-border object-cover" src={coverUrl} alt="文章封面预览" onError={() => setCoverError(true)} />)}</section><div className="overflow-hidden rounded-xl border"><iframe title="文章预览" sandbox="" className="block min-h-[520px] w-full border-0" srcDoc={`<!doctype html><html><body style="font-family:system-ui;line-height:1.8;padding:24px;max-width:680px;margin:auto;color:#25352e">${article.content}</body></html>`} /></div><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => copyArticleContent(article.title, article.content).then((mode) => onNotice(mode === "rich" ? "文章内容已复制，可粘贴到微信公众号" : "文章纯文本已复制")).catch((error: unknown) => onNotice(error instanceof Error ? error.message : "复制文章失败"))}>复制文章内容</Button><Button variant="link" size="sm" className="px-0" onClick={() => copyText(article.id).then(() => onNotice("文章 ID 已复制")).catch(() => onNotice("复制失败，请手动复制"))}>复制文章 ID</Button></div></aside></div>;
}
