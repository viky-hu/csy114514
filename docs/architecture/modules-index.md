# Modules Index

## apps/main-platform

Main Next.js App Router frontend. It owns routing, app layout, first-party CSS, and same-origin BFF route handlers.

- `app/layout.tsx`: root HTML shell and global style imports.
- `app/page.tsx`: current workbench entry screen.
- `app/api/**/route.ts`: BFF layer for frontend-to-server boundaries.
- `app/windows/**`: feature-owned window modules aligned with the final repository shape.
- `app/styles/**`: app-level and feature-level CSS.

## packages/ui-components

Shared React UI primitives consumed by application packages. Keep components small, typed, and style-compatible with the app token system.

## packages/configs

Shared TypeScript configuration package for Next.js apps and React libraries.
