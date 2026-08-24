import { describe, expect, it } from "vitest";
import { MemoryContentPlanningStore } from "../src/server/content-planning";

describe("内容规划", () => {
  it("按战略、系列、brief 顺序提供下一个任务", async () => {
    const store = new MemoryContentPlanningStore();
    const strategy = await store.createStrategy({ name: "AI 内容系列", goal: "持续输出实用内容", contentPillars: ["方法"], avoidTopics: [] });
    const series = await store.createSeries(strategy.id, { name: "文章管理", targetCount: 3, orderMode: "sequential" });
    await store.createBrief(series.id, { sequence: 2, titleDirection: "第二篇" });
    const first = await store.createBrief(series.id, { sequence: 1, titleDirection: "第一篇", mustCover: ["基础"] });
    const next = await store.getNextContext();
    expect(next?.brief.id).toBe(first.id);
    expect(next?.strategy.id).toBe(strategy.id);
  });

  it("按系列 sequence 决定 AI 任务顺序", async () => {
    const store = new MemoryContentPlanningStore();
    const strategy = await store.createStrategy({ name: "排序战略", goal: "按系列推进", contentPillars: [], avoidTopics: [] });
    const later = await store.createSeries(strategy.id, { sequence: 2, name: "后续系列", targetCount: 1, orderMode: "sequential" });
    const first = await store.createSeries(strategy.id, { sequence: 1, name: "首个系列", targetCount: 1, orderMode: "sequential" });
    await store.createBrief(later.id, { sequence: 1, titleDirection: "后续任务" });
    const firstBrief = await store.createBrief(first.id, { sequence: 1, titleDirection: "首个任务" });
    expect((await store.getNextContext())?.brief.id).toBe(firstBrief.id);
  });

  it("归档系列不会出现在 AI 下一个任务", async () => {
    const store = new MemoryContentPlanningStore();
    const strategy = await store.createStrategy({ name: "归档计划", goal: "旧计划", contentPillars: [], avoidTopics: [] });
    const series = await store.createSeries(strategy.id, { name: "旧系列", targetCount: 1, orderMode: "sequential" });
    await store.createBrief(series.id, { sequence: 1, titleDirection: "旧任务" });
    await store.updateSeries(series.id, { status: "archived" });
    expect(await store.getNextContext()).toBeUndefined();
  });
});
