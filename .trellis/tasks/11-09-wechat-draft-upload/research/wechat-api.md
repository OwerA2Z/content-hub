# 微信官方接口核对（2026-11-09）

web 工具抓取失败，curl 成功获取官方页面并解压读取正文。

- https://developers.weixin.qq.com/doc/service/api/draftbox/draftmanage/api_draft_add
  - POST /cgi-bin/draft/add，普通图文 article_type=news，封面 thumb_media_id 为永久素材标识。
  - 正文支持 HTML，外部图片会被过滤，图片 URL 必须来自上传正文图片接口。
- https://developers.weixin.qq.com/doc/service/api/material/permanent/api_uploadimage
  - POST /cgi-bin/media/uploadimg，multipart 字段 media，返回 url。
  - JPG/PNG，文件小于 1MB。

实现仅转换发送给微信的 HTML 副本，重复图片单次任务内去重，图片转存失败则不创建草稿。
