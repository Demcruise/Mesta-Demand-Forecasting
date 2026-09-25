# Implementation status

Status of the [Enterprise Backlog v1](Mesta_Demand_Forecasting_Enterprise_Backlog_v1.md) as implemented in this repository.

**Legend.** **Done**: implemented against the mock backend. **Partial**: implemented with the gaps listed. **Not started**: not built. Every item still depends on the validations in backlog §93; nothing here is connected to a real backend.

## P0 · Foundation

| ID | Epic | Status | Notes |
|---|---|---|---|
| FND-001 | Repository foundation | Done | Next.js 15, TypeScript strict, Tailwind v4, Vitest. |
| FND-002 | Design tokens | Done | `src/app/globals.css`: primitive → semantic → component tokens, light and dark themes, typography roles. Palette and fonts come from the Mesta design system; card radius reduced to 10px (backlog §86). |
| FND-003 | Core components | Done | Button, Input, Textarea, Field, Select, MultiSelect (combobox), Checkbox, RadioCards, Switch, Tabs, Segmented, Tooltip, Popover, DropdownMenu, Dialog, Drawer, Toast, Skeleton, Kbd, date range. |
| FND-004 | App shell | Done | Sidebar (248/56px, collapsible), top bar, breadcrumbs, mobile drawer navigation, skip link. |
| FND-005 | Authentication | Partial | Full enterprise flow in the UI with a demo IdP. The session cookie is unsigned. A real OIDC/SAML integration is still needed. |
| FND-006 | Workspace context | Done | Switcher shows environment, status and role. Switching clears cached data, resets scoped filters and writes an audit event. Banner for non-production or degraded workspaces. |
| FND-007 | DataTable | Done | Shared grid tracks, sorting, pagination, selection, sticky header, column visibility, column resizing, density, CSV export, keyboard rows, responsive column priority. Virtualisation not needed at current page sizes. |
| FND-008 | Filtering | Done | Search, primary facets, a Filters popover for the rest, active chips, Clear all, URL persistence. |
| FND-009 | Status system | Done | 35 statuses, each with label, icon, tone, tooltip and accessible text. |
| FND-010 | Freshness system | Done | Fresh, recent, delayed, stale and unavailable. Never invents a time when the timestamp is unknown. |
| FND-011 | Loading states | Done | Skeletons for page, table, card, chart, drawer/detail and timeline, matching final geometry. |
| FND-012 | Empty and error states | Done | Context-specific copy with recovery actions, permission notices and route error boundaries. |
| FND-013 | Accessibility foundation | Partial | Semantic roles, focus-visible, keyboard rows, focus traps, labelled charts with table alternatives, reduced motion. An automated axe audit (WCAG 2.0/2.1 A + AA) covers 15 surfaces in `e2e/accessibility.spec.ts` and passes. A manual screen-reader pass is still outstanding. |
| FND-014 | QA foundation | Partial | 34 unit tests (formatting, RBAC, session, telemetry, analytics, API behaviour) plus a Playwright suite — auth journey, route smoke, accessibility and visual regression (`npm run test:e2e`). Not yet wired into CI. |
| FND-015 | React Bits integration | Partial | Registries configured in `components.json`; licence key via env. No Pro blocks installed without a licence. Components follow the wrapper principle (RB-002). |

## P0 · Core product

| ID | Epic | Status | Notes |
|---|---|---|---|
| CORE-001 | Overview | Done | Scope and date context, needs attention, forecast health, outlook chart, category breakdown, largest changes, recent runs, model in use, activity. |
| CORE-002 | Forecast runs | Done | Table with required columns, permission-aware actions (open, results, duplicate, retry, cancel, publish, archive), live polling. |
| CORE-003 | Create forecast | Done | 6-step wizard: scope, data period, horizon, model, validation (pass/warning/blocking), review, then run with a consequence confirmation for large runs. Store group, product group and SKU filters wait on the hierarchy (§93 items 3–4). |
| CORE-004 | Forecast processing | Done | Step status from the (mock) job state; no fake progress. Cancel, retry and failure recovery. |
| CORE-005 | Forecast explorer | Done | Run selector, filters, sparkline trend, interval, status, exceptions, investigation drawer, bulk override, export. |
| CORE-006 | Forecast detail | Done | Summary, chart, uncertainty, drivers, model information, exceptions, overrides, audit history, lineage link. |
| CORE-007 | Forecast chart | Done | Actuals, forecast, 80% interval, previous run, forecast-start marker, tooltip with delta, textual summary, data table. |
| CORE-008 | Forecast uncertainty | Done | Effective-bound visualisation with labelled lower, upper, forecast, previous and override. Aggregate intervals combine SKU errors with cross-SKU correlation. |
| CORE-009 | Demand data | Done | Products (master) and historical demand, paged server-side, with date range, location and quality filters. |
| CORE-010 | Data quality | Done | Summary, source freshness, issue table and drawer (what happened, scope, impact, recommended action, owner, activity), plus assign, investigate, resolve, dismiss and retry check. |

## P1 · Intelligence

| ID | Epic | Status | Notes |
|---|---|---|---|
| INT-001 | Model registry | Done | |
| INT-002 | Model detail | Done | Metadata, features, metric table with definitions and baselines, backtest chart, limitations, usage, audit. Default-model promotion goes through approval. |
| INT-003 | Model performance | Done | Weekly WAPE and bias trend, latest evaluation, category performance. |
| INT-004 | Backtesting | Done | Run, list, results, error distribution, segments, version comparison with a warning when windows differ. |
| INT-005 | Scenario list | Done | |
| INT-006 | Scenario builder | Done | Every assumption shows baseline, changed value, delta, demand effect and rationale. Simulation preview before saving. Drivers are placeholders (§93 item 15). |
| INT-007 | Scenario comparison | Done | Up to 4 scenarios, shared timeframe, uncertainty, assumptions, CSV export. |
| INT-008 | Advanced analytics | Done | Forecast insights at `/forecasting/insights`: change decomposition by category and lifecycle, uncertainty ranking, largest movers (virtualised) and model accuracy by segment. Scope defined here because the backlog left it open. |

## P1 · Operations

| ID | Epic | Status | Notes |
|---|---|---|---|
| OPS-001 | Planning workspace | Done | Line decisions (accept, adjust, flag, reject), bulk actions, submission for approval. Plan lines are seeded; plan creation is not built. |
| OPS-002 | Forecast override | Done | Original, new, delta, reason, evidence, comment, owner; policy-based approval routing; consequence confirmation. |
| OPS-003 | Exceptions | Done | Summary, filters, bulk assign/investigate/resolve. |
| OPS-004 | Exception detail | Done | Why triggered, affected scope, forecast and history, data quality, recommended actions, activity, resolve/dismiss/escalate. |
| OPS-005 | Approval queue | Done | Change set, impact, evidence, assumptions, policy, history; high-impact confirmation; self-approval blocked. |
| OPS-006 | Notifications | Done | Categories, unread filter, mark read, deep links, per-user preferences. |
| OPS-007 | Monitoring | Done | Overall health, alerts, services by kind, 14-day job history, recent jobs. |

## P1 · Governance

| ID | Epic | Status | Notes |
|---|---|---|---|
| GOV-001 | Audit log | Done | Filterable, date range, event drawer with full anatomy, CSV export that respects filters. |
| GOV-002 | Decision lineage | Done | Data → quality → model → run → forecast → scenario → plan → approval → published plan → audit, each linked. |
| GOV-003 | Users | Done | Invite (domain-restricted, SSO only), change role, suspend, restore, remove, with consequences and reason. Keeps at least one administrator. |
| GOV-004 | Roles | Done | Proposed permission matrix (§93 items 2 and 18). |
| GOV-005 | Integrations | Done | Test connection, sync now, schedule, connect or disconnect, mapping, health, activity. |
| GOV-006 | Settings | Done | Personal settings separated from workspace administration. Admin changes show a diff, require a reason and are audited. |

## P2 · Platform expansion

| ID | Epic | Status |
|---|---|---|
| PLAT-001 | API access | Done | Scoped, expiring API keys with one-time secret reveal, rotation and revocation (administrator-only). |
| PLAT-002 | Webhooks | Done | HTTPS-only endpoints, event selection, test delivery and a delivery log. |
| PLAT-003 | Advanced exports | Done | CSV and Excel (XLSX) through a shared export menu; formula injection neutralised in both formats. |
| PLAT-004 | Saved views | Done | Personal or shared named views for the explorer, exceptions and runs. |
| PLAT-005 | Advanced search | Partial (command menu searches products, runs, scenarios, models, exceptions and approvals) |
| PLAT-006 | Advanced notification rules | Done | Per-user channel per event, severity floor, quiet hours and digest, driving the in-app feed. |
| PLAT-007 | Advanced scheduling | Done | Forecast schedules with cadence, scope, model, pause/resume, run now and approval-gated automatic publication. |

## Other backlog items

| ID | Status | Notes |
|---|---|---|
| NAV-001 Command menu | Done | Ctrl/Cmd + K, scoped to the workspace and permissions. |
| ONBOARDING-001 | Done | Workspace setup guide whose steps derive from workspace state, a "New Market Launch" sandbox to exercise it, and a sidebar entry until setup ends. |
| EXPORT-001 | Done | Exports state the row count and respect filters. |
| BULK-001 | Done | Selection count, allowed actions, confirmation, result toast. |
| RESPONSIVE-001 | Partial | Column priority, mobile navigation drawer, full-screen drawers, no horizontal page overflow at 390px on key pages. Visual baselines cover 1440px only; tablet and mobile device QA outstanding. |
| A11Y-001 | Partial | See FND-013. |
| PERF-001 | Done | Server-side paging, row virtualisation for long lists (`DataTable`, automatic above 60 rows when the body scrolls), and page sizes up to 250 on the explorer and historical demand. No profiling yet. |
| Telemetry (§72) | Done | Events instrumented across the product, batched through a pluggable transport to `/api/telemetry` (collector stub), free-text redacted, page views tracked. No production collector yet. |

## Deliberate deviations

- **Card radius** is 10px, not the 24px WMS card radius, to avoid oversized rounded cards (§86).
- **Body text** is 14px, not the WMS 15px, for planning density.
- **Status colours** use darker success and warning tones than the WMS lime and orange so text meets contrast on light backgrounds. The brand accents remain in chart series.
- **Tertiary text** uses a dedicated palette step (`--p-gray-550`, #616a75) instead of the Mesta gray-500. Gray-500 is 4.41:1 on the canvas — below the 4.5:1 WCAG AA minimum for small text — which the axe audit caught on four surfaces. Gray-500 is still used for chart axes, where it clears 4.5:1 on white.

## Validation required before production (§93)

Industry and operating model, roles, product hierarchy, forecast grain, frequency and horizon, data sources, demand definitions, model types, accuracy metrics, interval definition, exception rules, override policy, approval rules, scenario drivers, planning workflow, integrations, RBAC, audit retention, privacy, export rules, identity provider, deployment environment, backend and API contracts, and SLAs.

---

# Frontend backlog v3 — Indonesian UX + white UI

Status of the [Frontend-Only Backlog v3](Mesta_Demand_Forecasting_Frontend_Only_Backlog_v3.md). The v3 pass is being delivered foundation-first (v3 §92: "do not polish isolated pages before the global system").

## Done

| Item | Notes |
|---|---|
| V2-FE-001 White canvas | `--bg-canvas` is white; page background is no longer gray. |
| V2-FE-002 Neutral-first surfaces | surface `#FFFFFF`, subtle `#FAFAFA`, muted `#F5F5F5`, hover `#F5F7FA`. |
| V2-FE-003 Border system | `#E5E7EB` / `#D0D5DD` / `#F0F2F4`; separation comes from borders, not fills. |
| V2-FE-004 Radius system | 4 / 6 / 8 / 10 only; `xl` collapses onto `lg` so no oversized card radius can return. |
| V2-FE-005 Shadow reduction | Cards, tables and inputs carry no shadow. New `shadow-popover` / `shadow-drawer` / `shadow-dialog` are used only by floating layers. |
| Indonesian number, date and time formatting | `id-ID`: `12.440`, `+4,5%`, `−1.204`, Indonesian months (`Mei`, `Agu`, `Okt`), `25 Sep 2026, 14:05`, `14 menit yang lalu`, `2 mnt 5 dtk`. Unit tests updated. |
| FE-P0-010 Sidebar IA (NAV-001) | Six limited sections — Ringkasan · Perkiraan · Data · Model · Perencanaan · Sistem — with Indonesian labels. No page became unreachable. |
| FE-P0-011 Global search (NAV-002) | Placeholder "Cari produk, perkiraan, atau skenario"; result groups Produk · Perkiraan · Skenario · Model · Perlu Ditinjau · Persetujuan; "Tidak ditemukan / Coba kata lain". |
| FE-P0-012 App shell polish | Breadcrumbs, skip link, demo badge, mobile drawer and sidebar chrome in Indonesian. |
| §73 Status language | All 35 statuses plus severities localised with Indonesian tooltips. |
| §8 / §47 / §48 Error, empty and loading copy | Shared `ErrorState` / `EmptyState` / skeletons localised; retry is "Coba Lagi". |
| §45 Permission UX copy | "Anda tidak memiliki akses untuk melakukan perubahan ini." plus role names and permission labels. |
| §11 Workspace UI | Switcher, environment labels (Produksi/Staging/Sandbox), role line and the degraded-workspace banner in Indonesian. |

## Remaining

| Area | Status |
|---|---|
| Page-level copy — **done** | **All P0 pages.** Auth flow (sign-in, IdP, callback, workspace picker, unauthorized, signed-out), Ringkasan (FE-P0-013), Proses Perkiraan (FE-P0-014), Buat Perkiraan wizard + validation results (FE-P0-015), Processing / run detail + run actions (FE-P0-016), Perkiraan Permintaan / explorer (FE-P0-017), Detail Perkiraan + Ubah Perkiraan dialog (FE-P0-018), Produk + Permintaan Historis + Kualitas Data + Sumber Data (FE-P0-019/020). Shared copy: forecast step labels, scope/entity labels, role and permission labels, lifecycle labels. |
| Page-level copy — **remaining (P1)** | Models (FE-P1-001…004), Scenarios (FE-P1-005…007), Planning / Approval / Monitoring / Notifications (FE-P1-008…013), Governance (FE-P1-014…019), Insights, Onboarding, Schedules. Route `metadata.title` values are also still English, as are the seeded exception reasons and model limitation strings in the mock data. This is why the UI remains partly mixed-language. |
| §58 Visual regression viewports | Only 1440 × 900 is covered; 1280 / 1024 / 768 / 390 baselines are outstanding. |
| §44 Manual accessibility | The axe pass is automated only; a manual keyboard and screen-reader review is still required. |
| FE-P1-027…031 React Bits | Registry configured; blocks cannot be installed without a licence key. |
| §50 Performance profiling | Virtualisation is in place; no profiling at 1.000 / 10.000 / 50.000 rows yet. |
