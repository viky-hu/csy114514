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
