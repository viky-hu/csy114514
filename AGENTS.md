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

## Tooling Discipline

- Before creating or editing repository-level files, confirm the active project root from the user's wording and the local directory structure. For this project, prefer `C:\Users\Admin\csy` over the parent user profile directory.
- In this Windows Admin environment, sandboxed PowerShell may fail before the command runs. If a command fails with a sandbox or token/DACL error, do not repeat the same command shape in a loop.
- In Windows PowerShell/.NET, environment dictionaries can throw duplicate-key exceptions when both `Path` and `PATH` exist. If `Start-Process` fails with a duplicate dictionary key such as `Path`/`PATH`, treat it as this platform bug; do not keep tweaking `Start-Process` arguments. Use a different launch path or report the blocker after one alternate attempt.
- Use a bounded retry policy for tool failures: one normal attempt, then one meaningfully different attempt such as approved elevated execution, narrower command scope, or a different safe tool. After that, stop and report the blocker or provide the exact intended change.
- When elevated execution is required, batch nearby read-only inspections together and ask once with a narrow justification. Do not request approval repeatedly for equivalent commands.
- If `apply_patch` is blocked by the local sandbox wrapper, use the smallest safe project-scoped file operation needed, then verify by reading the target file with explicit UTF-8 encoding.
- Never clean up, delete, or overwrite files outside the confirmed project root unless the user explicitly asks for that exact path. If a mistaken file was created outside the project, explain it and ask before destructive cleanup.
- If the user interrupts or says to stop, abandon the previous implementation path immediately and answer the newest request only.
