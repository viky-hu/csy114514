# Modules Index

## apps/main-platform

Main Next.js App Router frontend. It owns routing, app layout, first-party CSS, and same-origin BFF route handlers.

- `app/layout.tsx`: root HTML shell and global style imports.
- `app/page.tsx`: initial login entry screen.
- `app/api/**/route.ts`: BFF layer for frontend-to-server boundaries.
- `app/windows/login/LoginIntroWindow.tsx`: Window 1 login surface copied from `C:\Users\Admin\final-main\final-main`, including the mouse-following band, inverted text overlay, auth-state CTA copy, CTA animation, Escape close behavior, mock sign-in close flow, login-gated scroll band expansion with top-position pointer unlock and first-scroll preservation of the current band width, plus the fixed second-page Agent entry prompt and local draft overlay. Its pointer-follow and leave-collapse interactions are gated to the top pointer mode so non-top scroll/second-page states cannot collapse the full blue band.
- `app/windows/login/LoginForm.tsx`: Window 1 mock login/register form. During MVP it preserves the SVG-styled input surface while treating login and apply-register actions as unconstrained successful sign-in events.
- `app/windows/login/AgentConnectDraft.tsx`: Local-only second-page Agent connection draft. It collects API adapter fields and current `AgentManifest` fields, shows a security profile precheck, and keeps JSON details collapsed without adding a BFF route, posting to `/agents`, or changing the frozen backend contract.
- `app/windows/**`: feature-owned window modules aligned with the final repository shape.
- `app/styles/**`: app-level and feature-level CSS.

## packages/ui-components

Shared React UI primitives consumed by application packages. Keep components small, typed, and style-compatible with the app token system.

## packages/configs

Shared TypeScript configuration package for Next.js apps and React libraries.
