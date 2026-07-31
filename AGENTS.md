# AGENTS.md

## Scope

This file applies to the repository root and all child directories unless a deeper `AGENTS.md` overrides it.

## Baseline

- Treat this repository as a pnpm workspace monorepo.
- Keep the main React frontend in `apps/main-platform`.
- Use Next.js App Router, React function components, TypeScript, project-owned CSS, Tailwind CSS v4, lucide-react icons, and GSAP only for coordinated motion.
- Keep backend aggregation behind same-origin BFF route handlers in `app/api/**/route.ts`.
- Do not expose secrets through `NEXT_PUBLIC_*`.

## Delivery

For behavior or module-boundary changes, update:

- `docs/architecture/modules-index.md`
- `docs/architecture/extension-review-checklist.md`
