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
- Styling: Window 1 styles live in `app/styles/window-1-login.css` and preserve the source DingTalk/Michroma typography, mouse-following band, inverted overlay, CTA animation, and Escape close behavior.
- Validation: run `pnpm type-check` and `pnpm build` after the visual entry change.

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
