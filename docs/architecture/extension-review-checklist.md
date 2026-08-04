# Extension Review Checklist

## 2026-07-31 Initial Stack Scaffold

- Ownership: root workspace config, `apps/main-platform`, `packages/configs`, `packages/ui-components`.
- Boundary: frontend runtime uses Next.js App Router; backend aggregation enters through `app/api/**/route.ts`.
- Extensibility: window folders exist for login, main, database, macro, and shared utilities without prematurely copying final business logic.
- Styling: Tailwind CSS v4 entrypoint and project-owned CSS variables are established.
- Validation: run `pnpm install`, then `pnpm type-check` and `pnpm build`.

## 2026-07-31 Login Initial Screen

- Ownership: `app/page.tsx` delegates the first viewport to `app/windows/login/LoginIntroWindow.tsx`.
- Boundary: Window 1 frontend code is copied from `C:\Users\Admin\final-main\final-main`; login/register exchange remains behind `auth-adapter.ts`, with the source mock fallback when no auth URL is configured.
- Extensibility: this step copies only the login window and its direct frontend dependencies, without bringing over main/database/macro post-login windows.
- Styling: Window 1 styles live in `app/styles/window-1-login.css` and preserve the source DingTalk/Michroma typography, viewport-width SVG root, mouse-following band, inverted overlay, CTA animation, and Escape close behavior.
- Validation: run `pnpm type-check` and `pnpm build` after the visual entry change; keep a focused structure check that the login root uses `100vw` rather than inheriting a parent `100%` width.

## 2026-08-01 Login Mock Scroll Expansion

- Ownership: `app/windows/login/LoginIntroWindow.tsx`, `app/windows/login/LoginForm.tsx`, and `app/styles/window-1-login.css`.
- Boundary: MVP auth is intentionally local mock state only; real credential exchange remains outside this login surface until the BFF/auth contract is restored.
- Extensibility: successful mock login reuses the existing Escape close timeline, then unlocks a second viewport and ScrollTrigger-driven SVG band expansion without introducing another animation library; returning to the exact top restores mouse-follow behavior at the current scroll-entry baseline instead of forcing line width, and the next first scroll preserves the currently visible band width as its expansion baseline.
- Styling: error and pending prompt boxes are removed; the post-login scroll hint is icon-only, the first-screen CTA copy switches from account-login wording to an authenticated state label, the login panel close action fades with the form content, and the existing clipPath text inversion remains the core visual rule.
- Validation: run `pnpm type-check` and `pnpm build`; manually verify manual Escape does not unlock scroll while successful login does.

## 2026-08-01 Login Agent Entry Draft

- Ownership: `app/windows/login/LoginIntroWindow.tsx`, `app/windows/login/AgentConnectDraft.tsx`, and `app/styles/window-1-login.css`.
- Boundary: the second-page entry is a local interactive draft only; it previews API adapter fields and `AgentManifest` data without adding `/api/agents`, posting to the FastAPI backend, or modifying `shared/contracts`.
- Extensibility: the SVG prompt uses the same base-layer/band/inverted-layer clipPath reveal model as the first-page copy, with its coordinates placed in the second viewport and the clip rect spanning the two-viewport Window 1 scroll scene; the HTML draft overlay remains independently faded by scroll progress so the band locking and first-scroll baseline logic stay untouched.
- Styling: the prompt uses the exact login surface color on the blue band; the draft controls preserve the transparent white-line form language, the top-right actions reuse the login bracket-command button language, the form and profile preview stay separated by a fixed 1px white divider, and Manifest JSON remains collapsed behind details controls.
- Validation: run `pnpm type-check` and `pnpm build`; manually verify the prompt resolves at the second-page 3cm/3cm baseline over the full blue page and the local profile precheck updates without network traffic.

## 2026-08-01 Login Scroll Pointer Mode Guard

- Ownership: `app/windows/login/LoginIntroWindow.tsx`, with CSS section boundaries in `app/styles/window-1-login.css`.
- Boundary: pointer-follow, idle-collapse, leave-collapse, and blur-collapse are only valid in the top pointer mode; any scroll progress beyond the top threshold belongs to the scroll/second-page mode.
- Extensibility: the top threshold remains viewport-relative (`1 / window.innerHeight`) so reverse scrolling to the exact top restores the mature first-page pointer behavior, while non-top scroll states clear pending pointer tweens and timers before the band expands.
- Styling: no visual redesign; the window stylesheet is segmented so second-page Agent entry styles and login panel overlay styles stay easy to discuss independently.
- Validation: run `pnpm type-check`, `pnpm lint`, and `pnpm build`; manually verify leaving the page at full blue second-page state no longer collapses the band to a vertical line.

## 2026-08-01 Login Agent Loading Lock

- Ownership: `app/windows/login/LoginIntroWindow.tsx` owns the local Agent entry stage machine; `app/styles/window-1-login.css` owns the loading overlay, white tower loader, hollow loading text, and locked-page styling.
- Boundary: both Agent entry actions are local mock transitions only; the 5-second loading state does not call `/api/agents`, enter the main application, restore the draft, or expose a new public component API.
- Extensibility: loading is isolated behind `agentEntryStage` so future real Agent connection work can replace the mock timer without changing the second-page scroll-band or pointer-mode contracts.
- Styling: the loader keeps the provided 3D tower keyframe structure but uses project-prefixed classes, white-toned faces, responsive sizing, and a GSAP staggered text wave with reduced-motion fallback.
- Validation: run `pnpm type-check`, `pnpm lint`, and `pnpm build`; manually verify both Agent buttons lock the second page, fade out prompt/draft content, show the centered loader, and leave the page on a blue empty state after completion.

## 2026-08-02 Main SVG Partition Intro

- Ownership: `app/page.tsx` switches from the login entry flow to `app/windows/main/MainWindow.tsx` after the local Agent loading overlay fades out; `app/styles/window-3-main.css` owns the main SVG shell styling.
- Boundary: this is still a local frontend transition only. It does not add BFF routes, call `/agents`, create workspace data state, or introduce main-page business content.
- Extensibility: the main shell uses real SVG top/main white surface rectangles plus a blue separator rectangle, so later top-bar and workspace content can attach to stable regions instead of inheriting the temporary loading cover.
- Styling: the entry timeline keeps the existing brand blue `#3152f4`, the login surface white `#F2F1EB`, `LINE_DRAW_EASE`, `useGSAP` cleanup, and reduced-motion direct-set behavior.
- Validation: run `pnpm type-check`; manually verify the first main-frame is full blue, the cover collapses into a centered horizontal line, then moves to the 2/19 top separator with 2/34 left/right insets while revealing the white SVG surfaces.

## 2026-08-03 Main Left Line Sidebar

- Ownership: `app/windows/main/MainWindow.tsx` computes the SVG-aware sidebar coordinates and intro timing; `app/windows/main/MainLineSidebar.tsx` owns the local navigation interaction; `app/styles/window-3-main.css` owns the visual treatment.
- Boundary: the sidebar is a React/TypeScript port of the Vue Bits line-sidebar pattern, not a Vue or shadcn-vue runtime embed. It changes only local active navigation state and does not add routes, URL hash behavior, BFF calls, or main-content swapping.
- Extensibility: the sidebar position follows the same logical 34-by-19 screen mapping as the SVG separator, with the whole menu placed in the main region below the blue line and a tightened right boundary so later workspace content can align against the same CSS variables without inheriting excess left-column whitespace.
- Styling: hover uses pointer-proximity RAF smoothing for text/marker blue-gradient emphasis, while the page-level entrance remains a scoped GSAP timeline that overlaps the separator's final movement and respects reduced-motion direct-set behavior; the sidebar width is constrained to the menu body instead of a broad left-column slab.
- Validation: run `pnpm type-check`, `pnpm lint`, and `pnpm build`; manually verify below-line placement, active-state clicks, pointer hover smoothing, resize alignment, the tightened sidebar-to-content gap, and reduced-motion final state.

## 2026-08-03 Main Overview R4 Dashboard

- Ownership: `app/windows/main/MainWindow.tsx` now exposes the blue-line-below content replacement region, while `app/windows/main/overview/**` owns the default 总览 dashboard data adapter, fixture repository, and R4 diagnostic UI.
- Boundary: the overview reads the backend team's fixture-shaped `AgentProfile`, `AttackGraph`, and `EvaluationReport` data from `shared/fixtures`; it does not add public API routes, call the FastAPI backend, alter `shared/contracts`, or expose Mock wording in the user-facing page.
- Extensibility: `createOverviewViewModel` is the internal repository boundary for score, severity counts, R4 evidence, Agent surface facts, and the Web → Agent → Memory → Agent → Email attack chain, so later BFF/API data can reuse the same visual component shape.
- Styling: the page stays inside the main content region to the right of the line sidebar with a tighter sidebar-to-content gap, larger right/bottom safety insets at 100% browser zoom, DingTalk JinBuTi Chinese-first typography, CSS Grid/container-query responsive balance, the existing `#3152f4`/`#F2F1EB` visual system, lucide icons, and scoped `useGSAP` timelines with MorphSVG route formation, a separate final SVG stroke-dash highlight route, and reduced-motion direct-set behavior. The R4 graph keeps only large primary node labels in the SVG, moves secondary node details into hover/focus popovers, keeps `进入攻击图谱` in the graph footer's lower-right corner, removes the duplicate bottom attack-graph CTA, and places the complete-chain sentence below the SVG.
- Validation: run the overview fixture test, the R4 graph structure test, `pnpm -C apps/main-platform type-check`, and `pnpm -C apps/main-platform lint`; visually verify the desktop and narrow content regions do not overlap the left sidebar, the forensic-lane SVG renders five readable large-label nodes, the final route remains visible after MorphSVG completes, the lower-right graph button remains reachable, the hover/focus popovers expose hidden node details, and the graph no longer relies on pulse-loop node animation.

## 2026-08-05 Main Overview R4 Graph Layered Upgrade

- Ownership: `app/windows/main/overview/OverviewDashboard.tsx` is now the overview composition surface only; `app/windows/main/overview/OverviewR4Graph.tsx` owns graph rendering and scoped GSAP interaction, while `app/windows/main/overview/overview-r4-layout.ts` owns the private SVG coordinates, lane bands, hover bands, node bounds, hover outline paths, and orthogonal route generation.
- Boundary: the upgrade stays inside the Dashboard/总览 module. It does not implement the full Anatomy page, add BFF routes, call the FastAPI backend, modify backend contracts, or introduce another animation/style dependency.
- Extensibility: `createOverviewViewModel` now exposes `stepIndex`, `layer`, `layerLabel`, and Chinese `displayLabel` for the five R4 steps, preserving the backend R4 semantic order `SOURCE -> AGENT -> MEMORY -> AGENT -> TOOL` and using fixture `edges` where available to prefer the dangerous tool connected from the Agent.
- Styling: the large graph frame is retained, but the internal MorphSVG curve and solid node-box treatment are replaced by three transparent glass semantic lanes separated by gray dashed rules, five x-axis hover hot zones, lucide SVG icons above the glass layer, and precise horizontal/vertical route segments. Hover is determined only by x position within the graph frame; the active step uses a frosted vertical strip, a small transform highlight, and a bright white clockwise DrawSVG hover outline without pulse loops or per-pointer timeline rebuilds.
- Validation: run the overview data test, the overview graph structure test, `corepack pnpm -C apps/main-platform type-check`, and `corepack pnpm -C apps/main-platform lint`; visually verify desktop, narrow content, and Edge 125% zoom for text fit, endpoint alignment, x-only hover activation, and reduced-motion static highlighting.
