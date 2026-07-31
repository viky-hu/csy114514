import { Activity, Boxes, Database, GitBranch, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ModuleStatus } from "ui-components";

const modules = [
  {
    name: "App Router",
    meta: "Server Components, layouts, route handlers",
    status: "ready",
    tone: "ready"
  },
  {
    name: "Window Modules",
    meta: "login, main, database, macro boundaries",
    status: "scaffolded",
    tone: "building"
  },
  {
    name: "BFF Routes",
    meta: "same-origin API layer under app/api",
    status: "guarded",
    tone: "ready"
  },
  {
    name: "Shared Packages",
    meta: "configs and ui-components workspaces",
    status: "linked",
    tone: "ready"
  }
] as const;

const navItems = [
  { label: "Workbench", icon: Boxes },
  { label: "BFF", icon: ShieldCheck },
  { label: "Data", icon: Database },
  { label: "Delivery", icon: GitBranch }
];

export default function HomePage() {
  return (
    <main className="app-shell">
      <aside className="app-shell__rail">
        <div>
          <div className="app-shell__brand">
            <strong>CSY</strong>
            <span>Main Platform</span>
          </div>
          <nav className="app-shell__nav" aria-label="Primary">
            {navItems.map((item, index) => {
              const Icon = item.icon;

              return (
                <Link
                  aria-current={index === 0 ? "page" : undefined}
                  className="app-shell__nav-item"
                  href="/"
                  key={item.label}
                >
                  <Icon aria-hidden="true" strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <p className="app-shell__rail-note">pnpm workspace · Turborepo</p>
      </aside>

      <section className="app-shell__main">
        <header className="app-shell__topbar">
          <div className="app-shell__title">
            <h1>CSY 工作台</h1>
            <p>
              技术栈骨架已对齐 final：Next.js App Router、TypeScript、
              共享 UI 包、BFF route handlers 与本地样式系统。
            </p>
          </div>
          <button className="app-shell__action" type="button">
            <Activity aria-hidden="true" strokeWidth={1.8} />
            <span>Open Health</span>
          </button>
        </header>

        <div className="app-shell__content">
          <section className="module-list" aria-label="Module readiness">
            {modules.map((module) => (
              <article className="module-list__item" key={module.name}>
                <div className="module-list__copy">
                  <strong>{module.name}</strong>
                  <span className="module-list__meta">{module.meta}</span>
                </div>
                <ModuleStatus
                  label="Status"
                  tone={module.tone}
                  value={module.status}
                />
              </article>
            ))}
          </section>

          <aside className="health-panel" aria-label="Runtime health">
            <div className="health-line">
              <span>Route</span>
              <strong>/api/health</strong>
            </div>
            <div className="health-line">
              <span>Runtime</span>
              <strong>server</strong>
            </div>
            <div className="health-line">
              <span>Boundary</span>
              <strong>BFF</strong>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
