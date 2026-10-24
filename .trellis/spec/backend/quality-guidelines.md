# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)

## Token 权限数量校验

- **适用范围**：新增权限或修改管理员 Token 的创建、编辑校验时。
- **接口**：`POST /api/v1/admin/tokens`、`PATCH /api/v1/admin/tokens/:id`。
- **契约**：`scopes` 使用 `src/shared/scopes.ts` 的 `TOKEN_SCOPES` 白名单，数量为 1 至 `TOKEN_SCOPES.length`；创建返回 201，编辑返回 200。
- **校验边界**：空列表、未知权限及超过列表长度的请求均不得写入；不要将当前通用错误处理中校验失败返回的 500 误写为既有 400 契约。
- **用例**：单项权限、全部权限应成功；空列表或未知权限应拒绝。
- **回归测试**：`tests/app.test.ts` 通过管理员会话提交全部权限，断言创建和编辑成功且返回完整权限列表。
- **错误与正确写法**：不要使用固定 `.max(8)`；使用 `.max(TOKEN_SCOPES.length)`，创建和编辑必须同步。
