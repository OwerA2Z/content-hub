# 实施计划与结果

## 已实施
- [x] 读取规范与现有 diff，核对微信官方草稿及正文图片接口。
- [x] 实现加密持久化配置、管理员配置及连接测试接口、现有页面表单；兼容环境变量。
- [x] 补齐常驻上传入口、配置及封面提示、详情内操作结果；重试复用任务轮询。
- [x] 串行轮询并隔离过期响应，同步文章状态；单次草稿任务固定凭证，转存正文图片。
- [x] 更新使用、接口、部署文档及后端契约规范。
- [x] npm run typecheck、npm test（11 文件、33 用例）、npm run build、git diff --check 通过。构建存在大 chunk 提示，不影响产物生成。

## 待验收
- 页面视觉及交互：已尝试独立本地预览，浏览器连接 host 不可用；原生 Chrome 操作超时，未获得页面渲染证据。恢复可用浏览器控制后由主代理继续验收，当前不将任务归档。
- 真实微信草稿：需用户在部署环境填写真实凭证及 IP 白名单，再测试连接与上传；自动测试使用模拟微信响应，没有向真实公众号提交内容。

## 执行边界
用户已明确批准含页面配置的方案；主代理直接实现，未使用子代理。保留原有未提交工作，未提交 Git、未自动发布。用于验证的隔离服务已停止，未更改用户现有服务配置。

## 验收修复批次

### 完成事项（按实施计划）
1. 本站素材相对路径及与 `PUBLIC_BASE_URL` 同源的绝对地址，正文、`coverUrl`、`images[0]` 均通过素材仓库校验存在且 active 后读取本地文件，不走 HTTP 下载；其他相对或非法地址返回中文错误。
2. 配置无法解密时 `info()` 返回 `source: "unreadable"`，能力查询关闭 draft/publish 并给出重填原因；管理员必须同时提交有效 AppID 和新的非空 AppSecret 才能覆盖恢复。前端提示重填，前后端复用 shared 类型。
3. token 按 AppID + AppSecret 在模块内共享缓存，合并并发获取，失败清理占位；保留草稿凭证快照与连接测试强制刷新。
4. 正文按魔数识别 JPEG/PNG，封面还支持 GIF/WebP；允许缺失或 octet-stream 响应头，拒绝非法魔数，保留体积限制。
5. 补充本地实际文件读取、同源/外站区分、失效素材、错误地址、凭证恢复、连续/并发缓存、强制刷新、失败重试及格式回归测试，更新接口与使用文档。

### 修改文件清单
- `src/server/channels/wechat.ts`
- `src/server/wechat-settings.ts`
- `src/shared/contracts.ts`
- `src/client/features/channels/ChannelSettingsPage.tsx`
- `src/client/lib/api/articles.ts`
- `tests/provider.test.ts`
- `tests/wechat-settings.test.ts`
- `tests/wechat-settings-http.test.ts`
- `docs/api.md`
- `docs/user-guide.md`
- `.trellis/tasks/11-09-wechat-draft-upload/implement.md`

路由已有处理方式可直接承接新的服务层结果，无需修改 `src/server/routes/channels.ts`。未修改范围外的既有未提交内容，未执行 Git 写操作、部署或数据库变更，未请求真实公众号。

### 检查结果原文（尾部）

`npm run typecheck`：退出码 0。
```text
> content-hub@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
```

`npx vitest run tests/provider.test.ts tests/wechat-settings.test.ts`：退出码 0。
```text

 Test Files  2 passed (2)
      Tests  24 passed (24)
   Start at  10:23:37
   Duration  346ms (transform 80ms, setup 0ms, import 252ms, tests 210ms, environment 0ms)
```

`npm test`：退出码 1，未达到“全部通过”的验收条件。
```text

 Test Files  3 failed | 8 passed (11)
      Tests  9 failed | 42 passed (51)
     Errors  8 errors
   Start at  10:23:45
   Duration  30.48s (transform 718ms, setup 0ms, import 2.02s, tests 40.54s, environment 1ms)
```
HTTP 测试在监听阶段被沙箱拒绝；原有 app/media 测试因此超时，新配置 HTTP 测试已补充监听错误处理，直接报告：
```text
Error: listen EPERM: operation not permitted 127.0.0.1
```

`npm run build`：退出码 0，保留大 chunk 警告。
```text
dist/index.html                     0.40 kB │ gzip:   0.28 kB
dist/assets/index-B5BXDqMa.css      2.98 kB │ gzip:   1.13 kB
dist/assets/index-C0sxgl3I.js   1,260.53 kB │ gzip: 397.53 kB

✓ built in 219ms
[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

`git diff --check`：无输出，退出码 0（本节追加后再次检查）。

### 未完成项与风险
- 必须检查尚有 `npm test` 未通过：当前运行环境禁止本地端口监听，HTTP 恢复链路用例尚未实际执行到断言。由具备本地监听权限的执行环境重跑 `npm test`，全部通过后才能完成本批验收；不跳过或弱化测试。
- 页面新增警告与恢复表单未取得实际浏览器渲染/交互证据，原任务的页面验收仍保留；需在可用预览环境检查重填、保存、测试连接流程。
- 未进行真实公众号验证（按本批禁止要求）；构建的大 chunk 警告仍存在。

### 与设计的偏离及原因
- 按本批授权修订旧的“无法解密返回 503”行为：配置读取返回可识别状态、能力查询安全关闭，并允许完整新凭证覆盖，以恢复管理员自助配置能力。凭证实际读取仍拒绝解密失败，不静默回退环境变量。
- token 生命周期从 Provider 实例提升到模块，避免草稿凭证快照导致缓存失效；仍使用现有 `/cgi-bin/token`，未改用 `stable_token`，不扩展功能。
- 其余无功能范围偏离；未修改 `.trellis/spec`。四项修复已实现，完整测试验收因上述环境权限阻塞而未完成。
