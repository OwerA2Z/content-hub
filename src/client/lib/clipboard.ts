function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
}

function htmlToPlainText(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  return (container.innerText || container.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

/** 复制普通文本，并在非安全上下文或浏览器禁用 Clipboard API 时降级。 */
export async function copyText(value: string) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // 继续使用传统 textarea 方案。
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("当前浏览器不支持复制，请手动复制");
}

/** 复制微信公众号可直接粘贴的富文本；不支持 HTML 剪贴板时降级为纯文本。 */
export async function copyArticleContent(title: string, content: string) {
  const plainText = `${title}\n\n${htmlToPlainText(content)}`;
  const richHtml = `<h1>${escapeHtml(title)}</h1>${content}`;
  if (navigator.clipboard && "ClipboardItem" in window) {
    const item = new ClipboardItem({
      "text/html": new Blob([richHtml], { type: "text/html" }),
      "text/plain": new Blob([plainText], { type: "text/plain" }),
    });
    try {
      await navigator.clipboard.write([item]);
      return "rich" as const;
    } catch {
      // 某些浏览器支持 ClipboardItem，但当前页面仍可能没有富文本写入权限，继续降级。
    }
  }
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(plainText);
      return "text" as const;
    } catch {
      // 权限被拒绝时继续尝试传统 textarea 复制。
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = plainText;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("当前浏览器不支持复制，请手动选择正文复制");
  return "text" as const;
}
