# 技术方案

## 边界与数据流
沿用 ArticleDrawer → useArticles → 现有 draft API → operation → WechatProvider，不新增并行上传机制或改数据库结构。

配置新增独立服务端模块，使用 AES-256-GCM 加密后原子写入 MEDIA_ROOT/.private/wechat.json，沿用现有 Docker 素材持久化卷；密钥通过 scrypt 从 SESSION_SECRET 派生，部署须稳定保留该值，修改前需重新配置凭证。文件不注册静态路由。管理员 GET/PUT 配置仅返回 AppID、是否有 Secret 和配置来源；POST 测试连接使用已保存凭证，不返回 access_token。Provider 每次获取有效配置，凭证变化后 token 缓存不再复用。环境变量作为未保存时的回退。

- ArticleDrawer：常驻上传按钮及局部说明，保留现有封面管理，明确未保存封面；不改变发布入口行为。
- useArticles：整理草稿提交及轮询生命周期，用请求身份隔离过期响应，结束后获取最新文章及刷新列表；保留操作 ID、错误和微信草稿标识的展示所需状态。
- WechatProvider：核对微信正文图片要求，复用现有素材读取及下载边界，对必要图片转存并仅转换发送副本，不改平台存储正文。外部图片下载须限制协议、内网、重定向和体积；具体微信限制以可核实官方资料为准。
- channels/channel-operations：仅在草稿链路需要时补齐校验和完成状态一致性；不重构发布状态机。
- tests/provider.test.ts、tests/app.test.ts 及必要前端测试：覆盖成功、微信错误、封面与图片和异步状态隔离。
- docs/user-guide.md、docs/api.md：同步入口、封面和操作反馈说明。

## 兼容与恢复
保留现有 API、权限和服务端环境变量，不硬编码凭证。既有文件增量修改，不覆盖当前未提交工作。无凭证时能力关闭，直接调用 Provider 也明确失败，防止重试或重启恢复任务误报模拟成功。

## 风险
已通过 curl 解压响应核对官方草稿及正文图片接口，详见 research/wechat-api.md。真实上传验证依赖部署环境，不读取或打印密钥，不擅自向真实公众号提交测试文章。
