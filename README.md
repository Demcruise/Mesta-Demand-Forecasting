# Mesta Demand Forecasting

Enterprise demand-forecasting frontend: forecast runs, uncertainty, scenarios, planning, exceptions, approvals and audit.

This is an implementation of the [Enterprise Backlog v1](docs/Mesta_Demand_Forecasting_Enterprise_Backlog_v1.md). Status per backlog item is tracked in [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

> **Demo build.** No backend exists yet. Every screen runs against a deterministic mock backend in the browser (`src/lib/mock`, `src/lib/api`). Business rules, KPI definitions, model types, roles and data contracts are **proposals** that need validation (backlog §93). Changes you make are kept in the browser tab and reset when the page reloads.

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. You will be redirected to sign-in.

### Demo sign-in

1. Enter any address at `mesta.click`, for example `rina.wijaya@mesta.click`.
2. **Continue with SSO** opens the demo identity provider (clearly labelled; it stands in for your real IdP).
3. Pick an account, approve the MFA prompt, and choose a workspace if you have more than one.

| Account | Role | What to try |
|---|---|---|
| Rina Wijaya | Planner | Create runs, override forecasts, build scenarios, edit the plan |
| Dimas Santoso | Manager | Approve overrides, scenarios and plans; publish runs |
| Sari Halim | Analyst | Models, backtests, data quality |
| Budi Hartono | Administrator | Users & roles, integrations, workspace settings |
| Maya Lestari | Viewer | Read-only access and permission notices |
| Eko Saputra | Suspended | Disabled-account handling |

### Demo controls

The user menu has **Demo controls** to exercise states: *Slow network* (loading states), *Fail reads* (error states) and *Fail writes* (failed mutations).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (type-checks) |
| `npm run typecheck` | TypeScript only |
| `npm test` | Unit tests (Vitest) for formatting, permissions, session transport and the API layer |

## Stack

- Next.js 15 (App Router), React 19, TypeScript (strict, `noUncheckedIndexedAccess`)
- Tailwind CSS v4 with design tokens in `src/app/globals.css`
- Radix primitives (`radix-ui`), cmdk, TanStack Query and TanStack Table, Recharts
- Fonts: Manrope and IBM Plex Mono, carried over from the Mesta design system

## Project structure

```text
src/
├── app/                 routes only: thin pages that render a feature view
│   ├── (auth)/          sign-in, demo IdP, callback, workspace selection, unauthorized
│   └── (app)/           session-guarded application routes (see IA below)
├── features/            one folder per product area (views, drawers, dialogs)
├── components/
│   ├── ui/              primitives: button, field, select, overlay, controls, toast…
│   ├── shell/           app shell, sidebar, workspace switcher, command menu…
│   ├── tables/          DataTable, FilterBar, CSV export
│   ├── charts/          ChartFrame, ForecastChart, scenario and small charts
│   ├── feedback/        status, freshness, empty/error/loading, permission notice
│   ├── entities/        product, run, model, scenario and user identities
│   ├── forecasting/     metric cards, deltas, effective-bound interval
│   ├── governance/      audit events, activity, consequence summaries
│   └── workflows/       wizard steps and panels
├── hooks/               URL list state, API query/mutation hooks
├── lib/
│   ├── api/             typed API functions (mock transport today)
│   ├── mock/            deterministic mock backend
│   ├── auth/            session transport (demo)
│   ├── permissions.ts   proposed RBAC model
│   └── format.ts        product-wide formatting
└── types/domain.ts      conceptual data contracts (backlog §61)
```

Information architecture follows backlog §7: Overview · Forecasting · Demand data · Models · Scenarios · Planning · Operations · Administration.

## Architecture notes

- **Server state** goes through `useApiQuery` / `useApiMutation`. Every query key starts with the workspace ID, and switching workspace clears the cache and resets scoped filters (WORKSPACE-001).
- **URL state**: search, filters, sort, page and the selected entity live in the URL (`useListState`), so lists survive navigation and are deep-linkable.
- **Authorization** is checked twice: the UI decides what to render (`can()`), and the API layer rejects unauthorized writes (`PermissionError`). Administrators cannot approve business changes; requesters cannot approve their own requests.
- **Audit**: every consequential mutation appends an immutable audit event (backlog §71).
- **Replacing the mock backend**: keep the function signatures in `src/lib/api/*` and swap the bodies for HTTP calls. Delete `src/lib/mock` when nothing imports it.

## Design system

Tokens follow primitive → semantic → component → page (DS-001). Colours, type roles (`page-title`, `section-title`, `card-title`, `body`, `caption`, `metadata`, `numeric-lg`, `mono-id`, …), spacing, radius, control heights, row densities and drawer widths are defined once in `globals.css`. Light and dark themes share the same semantic tokens. Status is always icon + label + colour.

## React Bits Pro

`components.json` configures the React Bits Pro registries. Blocks are not installed yet because the registry needs a licence key:

```bash
cp .env.example .env.local   # then set REACTBITS_LICENSE_KEY
npx shadcn add @reactbits-pro/<block>
```

Per RB-002, wrap any installed block behind a Mesta component (for example `DataTable`, `FilterBar`, `Dialog`) instead of using it directly in pages, and map it to Mesta tokens (RB-004).

## Authentication (demo)

The sign-in flow (work email → organisation discovery → SSO → IdP/MFA → callback → workspace → role) is complete in the UI. The session is an **unsigned** cookie written by the browser and is **not secure**. Before production, replace it with an httpOnly session issued by the backend after a real OIDC or SAML callback.

## Licence

See [LICENSE](LICENSE).
