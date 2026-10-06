# Admin Dashboard Report: HCP

Built from `ADMIN_DASHBOARD_PLAN.md` (approved). Extends `apps/admin`; nothing was replaced.

## Verification

| Check | Result |
|---|---|
| `apps/api` `tsc --noEmit` | pass |
| `apps/admin` `npm run typecheck` | pass |
| `apps/admin` eslint | 0 errors; 2 warnings that were already in `app/api/proxy/[...path]/route.ts` |
| API against local Postgres (heavy seed) | every new endpoint returns real data; 401, 403, 400, 404 and 409 paths exercised; a settings change and a post takedown wrote `AuditLog` (and `DomainEvent` for the takedown) |
| Browser, headless | Every page and tab: dashboard, audit log (drawer opens, Escape closes it), domain events, settings, memberships, runs (detail drawer shows no trail data), content posts and reels. Settings: edit, reason dialog, save, revert, all through the UI. Takedown: confirm stays disabled until a 3+ character reason; a fresh post was taken down through the UI, shown as Removed with its reason, 404 publicly. Dark theme on all six main pages. At 375px settings, content, audit, runs and memberships have no sideways scroll and tables become cards |
| Console | One browser-level "blocked by response (NotSameOrigin)" on the reels tab: a QA reel poster at `localhost:5010/uploads/...` is not served in dev (R2 is configured, and `/uploads` is only served for the local driver). The page falls back to a text placeholder (`Thumb`), so no broken image shows |
| **Not exercised** | Takedown of a kennel's own post or reel as platform admin |

## Files

**API (`apps/api/src`), added:** `services/admin-audit.service.ts`, `services/admin-oversight.service.ts`.
**API, modified:** `controllers/admin.controller.ts`, `routes/admin.routes.ts`, `validators/admin.validator.ts`, `services/admin.service.ts` (`stats()` adds pending memberships, unpublished events, runs this week, kennels below D10).
**Admin (`apps/admin`), added:** `lib/nav.ts`, `hooks/useAdminList.ts`, `components/{PageHeader,StatCard,FilterBar}.tsx`, `components/ui/{status-badge,drawer,reason-dialog}.tsx`, pages `audit`, `settings`, `memberships`, `runs`, `content` under `app/(dashboard)/`.
**Admin, modified:** `components/Sidebar.tsx` (grouped nav from config), `components/DataTable.tsx` (row open, card layout under `md`, one layout rendered at a time), `app/(dashboard)/page.tsx`, `lib/types.ts`.
**Docs:** `CODEX/DECISION-LOG.md` D68, `CODEX/TODO.md`.
**Dependencies added:** none. Nothing committed.

## Routes (all under `/api/v1/admin`, behind the router-top `requireAuth + requireRole(ADMIN)`)

`GET /audit`, `/events`, `/events/health`, `/settings`, `/memberships`, `/verification-readiness`, `/runs`, `/runs/awaiting-report`, `/posts`, `/reels`; `PATCH /settings/:key`; `POST /posts/:id/remove`, `/reels/:id/remove`.

## Modules

Generated: audit & events, settings, memberships (read-only, with D10 readiness), runs (read-only), content (takedown).
Skipped: payments, orders, products, vendors, payouts, transactions, CRM family, mailbox, agents (no such entities); roles-permissions (only USER/ADMIN); server/error logs and security (nothing persisted to show); direct messages (D8).

## Backend checks still required

- The ADMIN gate is on the router, so a route added to another router would not have it.
- Hiding a nav entry is UX only. There is one admin tier, so no per-permission UI exists.
- Takedown of kennel content as platform admin goes through `post.service#remove` / `reel.service#remove`, which resolve kennel permissions. Only a kennel-less post was exercised; a kennel's post or reel was not.
- `GET /admin/runs` must keep selecting no `Trail`, `Waypoint`, `BeerCheck` or chalk.

## Known gaps and assumptions

- Settings changes write an `AuditLog` entry and no `DomainEvent`, because a setting's key is not a uuid (D68, TODO).
- `GET /admin/runs/awaiting-report` has no page yet.
- The audit "Resource" and events "Aggregate" dropdowns are fixed lists and will miss new types.
- The staff-sees-any-audience exception to D57 is recorded in D68 and needs the owner's confirmation.
- Local test residue: one removed post ("admin-os takedown test post") and `hare.nudge.soonDays` stored as 21 (its default) and shown as overridden.

## Adding the next module

1. Service, Joi schema, controller and route in `apps/api` (reads first; a mutation writes its event and audit together via `record.service.ts`).
2. Row type in `apps/admin/lib/types.ts`.
3. A page built from `useAdminList`, `FilterBar`, `DataTable` and `StatusBadge`.
4. One entry in `apps/admin/lib/nav.ts`.
