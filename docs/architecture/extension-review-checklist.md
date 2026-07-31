# Extension Review Checklist

## 2026-07-31 Initial Stack Scaffold

- Ownership: root workspace config, `apps/main-platform`, `packages/configs`, `packages/ui-components`.
- Boundary: frontend runtime uses Next.js App Router; backend aggregation enters through `app/api/**/route.ts`.
- Extensibility: window folders exist for login, main, database, macro, and shared utilities without prematurely copying final business logic.
- Styling: Tailwind CSS v4 entrypoint and project-owned CSS variables are established.
- Validation: run `pnpm install`, then `pnpm type-check` and `pnpm build`.
