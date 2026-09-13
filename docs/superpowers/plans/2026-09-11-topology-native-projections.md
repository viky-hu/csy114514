# Topology Native Projections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic, partly fabricated topology flow with truthful topology projections that fit the existing overview, security-profile, and attack-graph workspaces.

**Architecture:** Keep `MainWindow` as the topology owner and keep `TopologyModeNav` plus its confirmation/restart motion unchanged. Introduce a topology projection adapter that treats `AgentTopology` as authoritative, enriches only from the same Agent's returned attack graph/report, and produces page-specific view models: summary for Overview, boundary placement for Security Profile, and risk-path stages for Anatomy. No topology node or edge may be invented for the visual layer.

**Tech Stack:** Next.js App Router, React function components, TypeScript, project-owned CSS/SVG primitives, lucide-react, existing GSAP/DrawSVG.

## Global Constraints

- Do not alter `TopologyModeNav`, its persistence behavior, confirmation dialog, or restart animation.
- Do not add a graph library, new state library, API route, public contract field, or client-visible backend URL.
- `AgentTopology.nodes` and `.edges` are the authoritative structural graph; contextual assets must exist in the same Agent's `AttackGraph` before being shown.
- Missing topology, graph, or report data yields an explicit data-insufficient state; it never silently renders the local fallback as confirmed backend truth.
- `single` retains the existing Stage 3/R4 visual behavior.
- Keep node controls keyboard reachable, use text/icon/color together for semantic states, retain `prefers-reduced-motion`, and support current sidebar-expanded, sidebar-collapsed, and narrow layouts.
- Update `docs/architecture/modules-index.md` and `docs/architecture/extension-review-checklist.md` with the changed ownership, truth boundary, page responsibilities, and validation obligations.

---

### Task 1: Define a truthful topology projection boundary

**Files:**
- Create: `apps/main-platform/app/windows/main/topology/topology-projection.ts`
- Create: `apps/main-platform/app/windows/main/topology/topology-projection.test.ts`
- Modify: `apps/main-platform/app/windows/main/topology/topology-types.ts`
- Modify: `apps/main-platform/app/windows/main/topology/topology-repository.ts`

**Interfaces:**
- Consumes: validated `AgentTopology`; existing AttackGraph node/edge shape as used by Anatomy/Profile; optional evaluation findings.
- Produces: `TopologyProjection`, containing only real `TopologyNode`/`TopologyEdge` records, resolved graph-context nodes, `dataState: "ready" | "insufficient"`, and role-indexed accessors.
- Produces: `createTopologyProjection({ topology, attackGraph, findings })`, `getTopologySummary(projection)`, and `getTopologyRiskPath(projection, riskPatternId)`.

- [ ] **Step 1: Write failing projection tests.** Cover planner/executor and RAG fixtures where logical nodes/edges remain unmodified; require context assets only when matching AttackGraph node ID, role, tool name, or graph edge exists; require absent assets to remain absent; assert a Finding is the sole source of `verified` status.
- [ ] **Step 2: Run the focused test and verify it fails because the projection module does not exist.**

  Run: `pnpm -C apps/main-platform exec tsx --test app/windows/main/topology/topology-projection.test.ts`

- [ ] **Step 3: Implement the projection module.** Normalize role casing in one private resolver, preserve snake_case wire fields in the source records, resolve topology role-to-graph context without synthesizing browser/document/tool nodes, and return a reason string for every insufficient projection.
- [ ] **Step 4: Make repository results expose provenance rather than only topology.** Preserve existing API/mock behavior for the mode switcher, but add an explicit provenance/error field that downstream workspace projections can use to reject non-authoritative fallback data.
- [ ] **Step 5: Re-run focused tests and type-check.**

  Run: `pnpm -C apps/main-platform exec tsx --test app/windows/main/topology/topology-projection.test.ts`

  Run: `pnpm -C apps/main-platform run type-check:app`

- [ ] **Step 6: Commit.**

  ```bash
  git add apps/main-platform/app/windows/main/topology/topology-types.ts apps/main-platform/app/windows/main/topology/topology-repository.ts apps/main-platform/app/windows/main/topology/topology-projection.ts apps/main-platform/app/windows/main/topology/topology-projection.test.ts
  git commit -m "feat: add truthful topology projections"
  ```

### Task 2: Return Overview to summary-and-entry responsibility

**Files:**
- Modify: `apps/main-platform/app/windows/main/overview/OverviewDashboard.tsx`
- Modify: `apps/main-platform/app/styles/window-3-main.css`
- Modify: `apps/main-platform/app/windows/main/overview/overview-dashboard-structure.test.mjs`

**Interfaces:**
- Consumes: `TopologyProjection` summary and existing overview report data.
- Produces: topology type badge, real node/channel counts, R5/R6 potential-or-verified risk copy, and existing navigation actions.

- [ ] **Step 1: Write failing structure assertions.** Assert that non-single Overview does not import or render `TopologyFlow`; assert topology metadata is rendered as summary data and that the attack-graph and run actions remain available.
- [ ] **Step 2: Run the focused structure test and verify the current generic flow violates it.**

  Run: `pnpm -C apps/main-platform exec tsx --test app/windows/main/overview/overview-dashboard-structure.test.mjs`

- [ ] **Step 3: Replace the non-single main-canvas branch.** Keep the mature Overview composition and summary metric style, remove the generic topology canvas, display the active topology label plus actual logical-node count, untrusted-channel count, and R5/R6 verification state. Keep `OverviewR4Graph` solely for `single`; use an explicit insufficient-data summary rather than a fallback topology graph.
- [ ] **Step 4: Add scoped CSS for compact summary chips/stats only.** Do not add a new card system, hero, or duplicated diagram.
- [ ] **Step 5: Re-run the structure test and type-check.**

  Run: `pnpm -C apps/main-platform exec tsx --test app/windows/main/overview/overview-dashboard-structure.test.mjs`

  Run: `pnpm -C apps/main-platform run type-check:app`

- [ ] **Step 6: Commit.**

  ```bash
  git add apps/main-platform/app/windows/main/overview/OverviewDashboard.tsx apps/main-platform/app/styles/window-3-main.css apps/main-platform/app/windows/main/overview/overview-dashboard-structure.test.mjs
  git commit -m "refactor: keep topology overview summary-focused"
  ```

### Task 3: Integrate topology into the Security Profile boundary canvas

**Files:**
- Modify: `apps/main-platform/app/windows/main/profile/security-profile-data.ts`
- Modify: `apps/main-platform/app/windows/main/profile/security-profile-graph-layout.ts`
- Modify: `apps/main-platform/app/windows/main/profile/SecurityProfileGraph.tsx`
- Modify: `apps/main-platform/app/windows/main/profile/security-profile-data.test.ts`
- Modify: `apps/main-platform/app/windows/main/profile/security-profile-graph-layout.test.ts`
- Modify: `apps/main-platform/app/windows/main/profile/security-profile-graph-structure.test.mjs`

**Interfaces:**
- Consumes: `TopologyProjection` plus the existing profile model.
- Produces: topology-aware profile nodes, routes, column placement, node inspector fields, and no separate `TopologyFlow` section.

- [ ] **Step 1: Write failing data/layout tests.** For Planner-Executor, require Planner and Executor in the execution-core column with the real `task_plan` edge labelled and marked untrusted when the contract says so. For RAG, require external Knowledge Base in input/data, Retriever and Agent in execution core, and real retrieval channels. Assert absent graph context is omitted and an insufficient banner is returned.
- [ ] **Step 2: Run focused tests and verify the fixed fixture-only layout fails the new cases.**

  Run: `pnpm -C apps/main-platform exec tsx --test app/windows/main/profile/security-profile-data.test.ts app/windows/main/profile/security-profile-graph-layout.test.ts`

- [ ] **Step 3: Extend the profile view model and layout.** Use the existing four-column frame, path primitives, HTML hitboxes, inspector, and reveal choreography. Derive node location by real topology role; annotate exact channel names, trust boundary, tool list, incoming untrusted edges, outgoing nodes, and provenance. Do not add a second flow beneath the graph.
- [ ] **Step 4: Update the graph component and CSS.** Render the projection nodes/routes in the existing SVG and inspector; preserve existing Single/Defense behavior and use a restrained purple treatment only for untrusted transport.
- [ ] **Step 5: Add the structural regression.** Assert `SecurityProfileGraph` no longer imports/renders `TopologyFlow`, and retains accessible node controls and reduced-motion handling.
- [ ] **Step 6: Re-run focused tests and type-check.**

  Run: `pnpm -C apps/main-platform exec tsx --test app/windows/main/profile/security-profile-data.test.ts app/windows/main/profile/security-profile-graph-layout.test.ts app/windows/main/profile/security-profile-graph-structure.test.mjs`

  Run: `pnpm -C apps/main-platform run type-check:app`

- [ ] **Step 7: Commit.**

  ```bash
  git add apps/main-platform/app/windows/main/profile/security-profile-data.ts apps/main-platform/app/windows/main/profile/security-profile-graph-layout.ts apps/main-platform/app/windows/main/profile/SecurityProfileGraph.tsx apps/main-platform/app/windows/main/profile/security-profile-data.test.ts apps/main-platform/app/windows/main/profile/security-profile-graph-layout.test.ts apps/main-platform/app/windows/main/profile/security-profile-graph-structure.test.mjs apps/main-platform/app/styles/window-3-main.css
  git commit -m "feat: project topology into security boundaries"
  ```

### Task 4: Rebuild Anatomy from actual topology risk paths

**Files:**
- Modify: `apps/main-platform/app/windows/main/anatomy/anatomy-data.ts`
- Modify: `apps/main-platform/app/windows/main/anatomy/anatomy-graph-layout.ts`
- Modify: `apps/main-platform/app/windows/main/anatomy/AnatomyGraph.tsx`
- Modify: `apps/main-platform/app/windows/main/anatomy/anatomy-data.test.ts`
- Modify: `apps/main-platform/app/windows/main/anatomy/anatomy-graph-layout.test.ts`
- Modify: `apps/main-platform/app/windows/main/anatomy/anatomy-graph-structure.test.mjs`

**Interfaces:**
- Consumes: `TopologyProjection`, selected `risk_pattern_id`, existing AttackGraph and current evaluation report.
- Produces: a five-stage-or-shorter `TopologyRiskPath` with source/target node IDs, route metadata, potential/verified state, inspector details, and evaluation handoff.

- [ ] **Step 1: Write failing R5/R6 path tests.** Assert R5 is `entry → Planner → task_plan → Executor → real dangerous tool`, R6 is `external document → Knowledge Base → Retriever → Agent → real dangerous tool`, and both omit missing stages instead of adding aliases. Assert report Findings alone upgrade status.
- [ ] **Step 2: Run the focused test and verify hard-coded R4 layout selection cannot satisfy it.**

  Run: `pnpm -C apps/main-platform exec tsx --test app/windows/main/anatomy/anatomy-data.test.ts app/windows/main/anatomy/anatomy-graph-layout.test.ts`

- [ ] **Step 3: Replace fixed topology-mode branching in `AnatomyGraph`.** Keep the left canvas, path cards, right inspector, route draw-on-selection motion, and verification handoff. Replace the appended `TopologyFlow` branch with projection-driven phase positions and SVG node/hitbox data; retain R4 unchanged under `single`.
- [ ] **Step 4: Expand inspector truth fields.** Show topology role, trust boundary, actual incoming/outgoing edge channel, untrusted-content flag, graph labels, and report evidence without presenting potential structure as verified.
- [ ] **Step 5: Add structural regression.** Assert no `TopologyFlow` import remains in Anatomy; assert its dynamic layout uses projection/path inputs rather than `findGraphNode` fixed aliases.
- [ ] **Step 6: Re-run focused tests and type-check.**

  Run: `pnpm -C apps/main-platform exec tsx --test app/windows/main/anatomy/anatomy-data.test.ts app/windows/main/anatomy/anatomy-graph-layout.test.ts app/windows/main/anatomy/anatomy-graph-structure.test.mjs`

  Run: `pnpm -C apps/main-platform run type-check:app`

- [ ] **Step 7: Commit.**

  ```bash
  git add apps/main-platform/app/windows/main/anatomy/anatomy-data.ts apps/main-platform/app/windows/main/anatomy/anatomy-graph-layout.ts apps/main-platform/app/windows/main/anatomy/AnatomyGraph.tsx apps/main-platform/app/windows/main/anatomy/anatomy-data.test.ts apps/main-platform/app/windows/main/anatomy/anatomy-graph-layout.test.ts apps/main-platform/app/windows/main/anatomy/anatomy-graph-structure.test.mjs apps/main-platform/app/styles/window-3-main.css
  git commit -m "feat: render topology risks in attack graph"
  ```

### Task 5: Remove the generic flow and document/verify the new boundary

**Files:**
- Delete: `apps/main-platform/app/windows/main/topology/TopologyFlow.tsx`
- Delete: `apps/main-platform/app/windows/main/topology/topology-flow-layout.ts`
- Delete: `apps/main-platform/app/windows/main/topology/TopologyFlow-structure.test.mjs`
- Modify: `apps/main-platform/app/windows/main/MainWindow.tsx`
- Modify: `apps/main-platform/app/styles/window-3-main.css`
- Modify: `apps/main-platform/e2e/stage4-topology.spec.ts`
- Modify: `docs/architecture/modules-index.md`
- Modify: `docs/architecture/extension-review-checklist.md`

- [ ] **Step 1: Write E2E assertions before removal.** Exercise a mode switch from the existing topbar; verify Overview reports the topology summary rather than a canvas; verify Security Profile renders roles/channels in its native boundary graph; verify Anatomy renders an R5/R6 path with only API-provided/graph-backed nodes and labels it potential until a report Finding is supplied.
- [ ] **Step 2: Run E2E/structure coverage and verify the generic flow expectations fail after the intended assertions are added.**

  Run: `pnpm -C apps/main-platform exec playwright test e2e/stage4-topology.spec.ts`

- [ ] **Step 3: Remove generic-flow imports, layout, test, and isolated CSS.** Do not modify `TopologyModeNav` or its CSS/motion. Update `MainWindow` only to propagate topology provenance/projection inputs required by the three native workspaces.
- [ ] **Step 4: Update architecture docs.** Record projection ownership in `topology/**`, Overview's summary-only role, Profile's boundary projection role, Anatomy’s risk-path role, fallback/data-insufficient semantics, and the retained topbar mode-navigation boundary.
- [ ] **Step 5: Run complete validation.**

  Run: `pnpm -C apps/main-platform run verify:default`

  Run: `pnpm -C apps/main-platform exec playwright test e2e/stage4-topology.spec.ts`

- [ ] **Step 6: Perform visual QA.** At 1920×1080 with sidebar open and collapsed, verify R5/R6 node/channel placement, inspector content, no duplicate topology canvas, motion direction, keyboard focus, and reduced-motion end states. At 1366px/narrow layout, verify RAG labels do not overlap and the graph scrolls or stacks without node compression.
- [ ] **Step 7: Commit.**

  ```bash
  git add apps/main-platform/app/windows/main/MainWindow.tsx apps/main-platform/app/styles/window-3-main.css apps/main-platform/e2e/stage4-topology.spec.ts docs/architecture/modules-index.md docs/architecture/extension-review-checklist.md
  git rm apps/main-platform/app/windows/main/topology/TopologyFlow.tsx apps/main-platform/app/windows/main/topology/topology-flow-layout.ts apps/main-platform/app/windows/main/topology/TopologyFlow-structure.test.mjs
  git commit -m "refactor: replace shared topology flow with native projections"
  ```

## Plan Self-Review

- Coverage: the plan retains the already-mature topbar/motion; removes the shared fabricated diagram; specifies the distinct Overview, Profile, and Anatomy responsibilities; enforces the real-data rule; preserves Single; updates required architecture docs; and covers focused, E2E, responsive, and reduced-motion validation.
- No-placeholders check: all tasks name the target files, behavior, concrete commands, and expected assertions.
- Boundary consistency: `TopologyProjection` is the sole new view-model boundary. It consumes existing backend shapes and does not create a new public wire contract.
