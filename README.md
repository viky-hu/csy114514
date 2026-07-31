# csy

CSY is a pnpm-driven React monorepo aligned with the `final` main-platform structure.

## Stack

- pnpm workspaces + Turborepo
- `apps/main-platform`: Next.js App Router, React, TypeScript
- `packages/ui-components`: shared React UI primitives
- `packages/configs`: shared TypeScript configs
- Tailwind CSS v4 entrypoint with project-owned CSS tokens
- BFF boundary under `apps/main-platform/app/api/**/route.ts`

## Commands

```bash
pnpm install
pnpm dev
pnpm type-check
pnpm build
```
