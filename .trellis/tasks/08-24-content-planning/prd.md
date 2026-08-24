# 内容规划与文章任务

## Goal

让 AI 围绕长期内容战略和连续主题生成文章，而不是随机生成孤立文章；每篇文章先有可执行的 Content Brief，再关联到最终文章和防重复检测。

## Scope

- 内容战略 `ContentStrategy`：目标、受众、语气、内容支柱、避免主题。
- 内容系列 `ContentSeries`：归属战略、系列目标、顺序、目标篇数和状态。
- 文章任务 `ContentBrief`：顺序、标题方向、核心问题、角度、必须覆盖、必须避免、创新要求和状态。
- 文章可关联 `strategyId`、`seriesId`、`briefId`。
- AI 可以读取下一个待生成任务和相关历史文章；生成前继续调用防重复接口。

## Statuses

- Strategy/Series：`active | paused | archived`
- Brief：`planned | generating | completed | skipped`

## API

- `GET/POST /api/v1/strategies`
- `GET/PATCH /api/v1/strategies/:id`
- `GET/POST /api/v1/strategies/:id/series`
- `GET/PATCH /api/v1/series/:id`
- `GET/POST /api/v1/series/:id/briefs`
- `GET/PATCH /api/v1/briefs/:id`
- `GET /api/v1/ai/content-plan/next`
- `GET /api/v1/ai/content-plan/briefs/:id`

AI 接口只读，后台接口需要管理员会话或管理 API Token。

## Acceptance Criteria

- [ ] 管理员可以创建、查看、暂停和归档内容战略。
- [ ] 管理员可以在战略下创建有序内容系列。
- [ ] 管理员可以创建和更新文章任务 brief，并设置必须覆盖/避免内容。
- [ ] 文章上传可以关联 brief，查询文章时可以看到关联关系。
- [ ] AI 可以读取下一个 planned brief 和相关历史文章摘要。
- [ ] brief 完成状态与文章关联可以被更新，重复检测仍是独立前置步骤。
- [ ] 归档战略/系列下的任务不会出现在 AI 的下一个任务接口。

## Out of scope

- 平台内置 AI 生成模型。
- 自动排期、日历、多人审批。
- 自动创建整套内容战略。
