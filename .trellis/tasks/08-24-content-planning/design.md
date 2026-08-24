# 技术设计：内容规划与文章任务

## 数据模型

- `content_strategies`: name, goal, audience, tone, content_pillars, avoid_topics, status
- `content_series`: strategy_id, name, pillar, target_count, order_mode, status
- `content_briefs`: series_id, sequence, title_direction, core_question, angle, summary, must_cover, must_avoid, novelty_requirement, status
- `articles`: 增加 strategy_id、series_id、brief_id 外键，可为空保持旧文章兼容

## 数据流

```text
Strategy → Series → Brief(planned)
       → AI 读取 brief + 相关已发布文章
       → AI 调用防重复检测
       → 上传文章关联 brief
       → Brief generating/completed
```

## 约束

- 同一系列的 `sequence` 唯一。
- AI 下一个任务按 series sequence、brief sequence 升序返回。
- strategy/series archived 时，AI 不返回其 brief。
- 文章上传关联不存在的 brief 时返回 404/409，不创建隐式任务。
