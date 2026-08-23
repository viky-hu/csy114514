# Comparison Page Reverse Fade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure comparison run/report navigation fades out, swaps the page, and fades in consistently in both directions.

**Architecture:** Keep page navigation owned by `MainWindow`. Make the existing GSAP page-swap lifecycle explicit so both forward and reverse navigation use the same completion path, while preserving the current reduced-motion and interruption behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, GSAP, Node test runner.

## Global Constraints

- Keep the change scoped to the main-window navigation animation and its regression test.
- Preserve `prefers-reduced-motion: reduce` behavior.
- Do not alter evaluation state, report data, or backend routes.

---

### Task 1: Add the reverse-navigation regression guard

**Files:**
- Modify: `apps/main-platform/app/windows/main/main-window-layout-structure.test.mjs`

- [ ] **Step 1: Add assertions that the navigation swap has one shared fade-out/fade-in lifecycle**

Assert that the source contains the page-swap timeline, updates `renderedNavKey` only from the timeline completion path, restores the page shell after interruption, and does not split behavior by navigation direction.

- [ ] **Step 2: Run the focused structure test**

Run: `node --test apps/main-platform/app/windows/main/main-window-layout-structure.test.mjs`

Expected: The new assertion fails against the current navigation implementation.

### Task 2: Fix the shared navigation lifecycle

**Files:**
- Modify: `apps/main-platform/app/windows/main/MainWindow.tsx`

- [ ] **Step 1: Store the requested navigation target in the active swap lifecycle**

Make the transition callback use the target associated with the current timeline so a reverse navigation cannot reuse stale render state.

- [ ] **Step 2: Keep the fade-out, render replacement, and fade-in phases on the same completion path**

Ensure both `run -> report` and `report -> run` call the same `setRenderedNavKey` completion path and reset the shell before the next page reveal.

- [ ] **Step 3: Run the focused structure test**

Run: `node --test apps/main-platform/app/windows/main/main-window-layout-structure.test.mjs`

Expected: PASS.

### Task 3: Verify the application

**Files:**
- No additional files.

- [ ] **Step 1: Run the evaluation layout tests**

Run: `node --test apps/main-platform/app/windows/main/evaluation/EvaluationRunWorkspace.layout.test.ts`

- [ ] **Step 2: Run the application type check**

Run: `pnpm -C apps/main-platform run type-check:app`

- [ ] **Step 3: Inspect the final diff**

Run: `git diff -- apps/main-platform/app/windows/main/MainWindow.tsx apps/main-platform/app/windows/main/main-window-layout-structure.test.mjs`

Expected: Only the intended navigation animation and regression-test changes are present.
