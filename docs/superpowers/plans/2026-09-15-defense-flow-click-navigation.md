# 防御机制点线图点击切页实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让防御机制可视化页顶部点线图的节点、标签和编号直接切换对应内容页。

**Architecture:** `DefenseVisualizationStage` 继续持有唯一的展示索引和边界处理，并把 `onSelectDisplayIndex` 回调传给 `DefenseFlow`。`DefenseFlow` 将每个 SVG 节点单元包在可聚焦的 SVG `<g>` 控件语义中，点击或键盘激活时调用父组件回调；现有 GSAP 选择器继续命中节点图形，保持动画不变。

**Tech Stack:** Next.js App Router, React/TypeScript, SVG, GSAP, Vitest/Node structure tests, pnpm.

## Global Constraints

- 保留左右切页按钮、键盘左右方向键和现有展示状态行为。
- 不新增展示状态，不暴露客户端秘密，不改变防御展示数据模型。
- 节点必须提供可访问名称和当前步骤状态。

---

### Task 1: Add a failing structure test for clickable flow nodes

**Files:**
- Create: `apps/main-platform/app/windows/main/profile/defense-flow-navigation.structure.test.mjs`
- Read: `apps/main-platform/app/windows/main/profile/DefenseFlow.tsx`

**Interfaces:**
- The test reads the component source and asserts the public interaction contract before implementation.

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./DefenseFlow.tsx", import.meta.url), "utf8");

test("defense flow exposes clickable display-index navigation", () => {
  assert.match(source, /onSelectDisplayIndex/);
  assert.match(source, /role=\"button\"/);
  assert.match(source, /aria-current/);
  assert.match(source, /onClick/);
  assert.match(source, /onKeyDown/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/main-platform/app/windows/main/profile/defense-flow-navigation.structure.test.mjs`

Expected: FAIL because `DefenseFlow` currently has no selection callback or interactive SVG node semantics.

### Task 2: Implement node click and keyboard navigation

**Files:**
- Modify: `apps/main-platform/app/windows/main/profile/DefenseFlow.tsx`
- Modify: `apps/main-platform/app/windows/main/profile/DefenseVisualizationStage.tsx`

**Interfaces:**
- `DefenseFlowProps` gains `onSelectDisplayIndex: (displayIndex: number) => void`.
- `DefenseVisualizationStage` passes its existing `moveToDisplayIndex` function to `DefenseFlow`.

- [ ] **Step 1: Add the callback prop and pass it from the stage**

Use the existing `moveToDisplayIndex` function so bounds, direction tracking, and no-op current selection remain centralized.

- [ ] **Step 2: Wrap each flow node unit in interactive SVG semantics**

Add `role="button"`, `tabIndex={0}`, an `aria-label` based on the same D/BRIDGE label format used by the stage, and `aria-current={isActive ? "step" : undefined}`. Add `onClick={() => onSelectDisplayIndex(index)}` and an Enter/Space `onKeyDown` handler. Keep the existing node class on the circle/path so GSAP selectors and active CSS continue to work.

- [ ] **Step 3: Run the structure test**

Run: `node --test apps/main-platform/app/windows/main/profile/defense-flow-navigation.structure.test.mjs`

Expected: PASS.

- [ ] **Step 4: Run application type checking**

Run: `pnpm -C apps/main-platform run type-check:app`

Expected: PASS with no new TypeScript errors.

- [ ] **Step 5: Run the default frontend verification**

Run: `pnpm -C apps/main-platform run verify:default`

Expected: PASS. If the environment blocks reading the Next binary, retry once with approved elevated execution and report any real compile/lint/test failure.

- [ ] **Step 6: Commit the implementation**

```bash
git add apps/main-platform/app/windows/main/profile/DefenseFlow.tsx apps/main-platform/app/windows/main/profile/DefenseVisualizationStage.tsx apps/main-platform/app/windows/main/profile/defense-flow-navigation.structure.test.mjs
git commit -m "feat: enable direct defense flow navigation"
```

