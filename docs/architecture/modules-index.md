# Modules Index

## apps/main-platform

Main Next.js App Router frontend. It owns routing, app layout, first-party CSS, and same-origin BFF route handlers.

- `app/layout.tsx`: root HTML shell and global style imports.
- `app/page.tsx`: initial login entry screen.
- `app/api/**/route.ts`: BFF layer for frontend-to-server boundaries.
- `app/windows/login/LoginIntroWindow.tsx`: Window 1 login surface copied from `C:\Users\Admin\final-main\final-main`, including the mouse-following band, inverted text overlay, CTA animation, Escape close behavior, mock sign-in close flow, and login-gated scroll band expansion with top-position pointer unlock and first-scroll preservation of the current band width.
- `app/windows/login/LoginForm.tsx`: Window 1 mock login/register form. During MVP it preserves the SVG-styled input surface while treating login and apply-register actions as unconstrained successful sign-in events.
- `app/windows/**`: feature-owned window modules aligned with the final repository shape.
- `app/styles/**`: app-level and feature-level CSS.

## packages/ui-components

Shared React UI primitives consumed by application packages. Keep components small, typed, and style-compatible with the app token system.

## packages/configs

Shared TypeScript configuration package for Next.js apps and React libraries.
