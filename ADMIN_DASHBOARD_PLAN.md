# Admin Dashboard Plan: HCP

> Phase 3 of Admin Dashboard OS. **No source files have been changed.** Approve (or amend) before Phase 4.

Target: `apps/admin` (Next.js 16, port 3011) + `apps/api` (Express, `/api/v1/admin/*`).
Decisions already made: build the admin endpoints too; first pass = core + 5 modules.

## 1. Stack

| | |
|---|---|
| Framework | Next.js 16 App Router, React 19 |
| Language | TypeScript |
| Styling | Tailwind 4 (`@theme inline` in `globals.css`, no config file) |
| Components | Hand-written shadcn-style `components/ui/*` (cva, `cn()`, Radix) |
| Data fetching | axios `services/api.ts` → `/api/proxy`; plain `useEffect` + state, no query lib |
| Package manager | npm, per-app |
| API | Express 4 + Prisma 7 + Postgres 17; Railway (`api.shiggytrails.com`) |

## 2. Existing admin: **extend, do not replace**

Working: login, sidebar (Dashboard / Kennels / Hashers / Reports), `DataTable`, `KennelForm`, `PendingKennelQueue`, `ConfirmDialog`, theme toggle, light+dark tokens (D24). All of it is reused. New code composes on top; nothing is forked.

## 3. Auth / Authorization

- Auth: BFF proxy, `hcp_admin_access` / `hcp_admin_refresh` httpOnly cookies, `AuthContext`. Untouched.
- Roles: `User.platformRole` is only `USER | ADMIN`. Router-level `requireAuth + requireRole(ADMIN)` (`admin.routes.ts:16`). **There is exactly one platform tier**, so a granular `resource.action` permission map would be fiction: every admin can do everything. Plan: keep a single ADMIN gate; add the `permissions` field to module configs only as a seam, not as UI hiding. Kennel authority (officers, hares, scribes) stays in `RoleAssignment` / `OfficerAppointment` and is **read-only here**.
- Gap to report: no super-admin / read-only-admin split. Not added (would need a Chapter 22/23 change).

## 4. Entities used (of 104 models)

| Module | Models | Display field | Enums → badges |
|---|---|---|---|
| Audit & events | `AuditLog`, `DomainEvent` | action / eventType | `AuditDecision`, `ActorType`, published vs pending |
| Settings | `PlatformSetting`, `GlossaryTerm` | key | n/a |
| Memberships & officers | `Membership`, `OfficerAppointment`, `RoleAssignment`, `Kennel` | hasher handle (D11) | `MembershipStatus`, `RoleAssignmentStatus` |
| Runs & trail reports | `Run`, `TrailReport`, `RunCapsule` | title / run number | `RunStatus`, `TrailReportStatus`, `CapsuleStatus` |
| Content | `Post`, `Reel`, `MediaAsset` (+ existing `ContentReport` queue) | body / caption | `PostStatus`, `ReelStatus`, `Audience` |

Excluded: join/ledger tables, tokens (`RefreshToken` etc.), `Message`/`Channel` (D8 forbids a 1:1 view; channel contents are not admin-browsable), `PersonProfile` biodata (private, never serialized), `Trail.routeGeoJson`/waypoints/beer checks/chalk (secrecy, server-enforced).

## 5. Modules

**Core upgrade (existing app):** grouped sidebar nav from one config, `PageHeader` + breadcrumbs, `StatusBadge`, `FilterBar` (search + enum filters + date range), `Drawer` for row detail, `StatCard` + a dependency-free sparkline/bar (no chart lib). Dashboard gains: open reports, pending memberships, kennels one officer short of D10, unpublished outbox events, upcoming runs this week.

| # | Module | Mode | Features | Needs new API |
|---|---|---|---|---|
| 1 | **Audit & events** `/audit` | full | Audit log (filter actor/action/resource/decision/date, before/after JSON diff in drawer) and domain-event stream with outbox health (unpublished count, max `attempts`) | `GET /admin/audit`, `GET /admin/events`, `GET /admin/events/health` |
| 2 | **Settings** `/settings` | full | Edit `kennel.verification.minMismanagement` (D10), `membership.reapplyCooldownDays` (D20) with confirm; each change writes audit + event | `GET/PATCH /admin/settings` |
| 3 | **Memberships & officers** `/memberships` | reduced | Cross-kennel membership list (status filter), pending applications, per-kennel D10 readiness (active mismanagement count vs threshold). **Read-only**: kennel admins decide membership, not platform admins | `GET /admin/memberships`, `GET /admin/kennels/verification-readiness` |
| 4 | **Runs & trail reports** `/runs` | reduced | Run list (status/kennel/date), report + capsule state, stuck-draft view. Never returns trail route, waypoints, beer checks or chalk. Read-only | `GET /admin/runs`, `GET /admin/runs/:id` |
| 5 | **Content** `/content` | full | Posts and reels tabs; take down with required reason (reuses `post.service#remove`, `reel.service#remove`); links into the existing report queue. Hasher shown by handle / "Just <first name>" | `GET /admin/posts`, `GET /admin/reels`, `POST …/:id/remove` |

Skipped (project wins over profile): payments, orders, products, vendors, payouts, transactions, CRM family, mailbox, agents (no such entities); `roles-permissions` (only USER/ADMIN); `security`/`server-logs`/`error-logs` (no persisted entity; nothing to show without inventing it); direct messages (D8). Existing Kennels / Hashers / Reports pages kept as-is, regrouped in nav.

## 6. Navigation

```
Overview        /
Community       Kennels /kennels · Hashers /users · Memberships /memberships · Runs /runs
Moderation      Reports /reports · Content /content
Platform        Audit & events /audit · Settings /settings
```

## 7. API conventions (new endpoints)

`apps/api`: add to `admin.routes.ts` (router-top ADMIN gate already applies), thin controllers, logic in new `services/admin-*.service.ts`, Joi validators, `{ success, data: { items, total, page, limit } }`, `isUuid()` guards. Reads need no `DomainEvent`. Mutations (settings, content takedown) write `DomainEvent` + `AuditLog` in one transaction via `record.service.ts`; event names past-tense per Ch. 24 (new names such as `PlatformSettingChanged` get added to Ch. 24, flagged in `CODEX/TODO.md`). Server-side filtering/pagination everywhere.

## 8. Design

Reuse D24 tokens; no new hex. Orange is a fill only; links use `text-primary-strong`. Badges: trail green / gold / destructive are semantic only. Tables get a card-list layout under `md`. Both themes verified. `data-testid` on every new table, filter and action.

## 9. Conflicts / modified files

Modified: `components/Sidebar.tsx` (nav from config), `app/(dashboard)/page.tsx` (dashboard tiles), `components/DataTable.tsx` (optional row-click, sortable header, mobile cards; backwards compatible), `lib/types.ts`, `api/src/routes/admin.routes.ts`, `api/src/controllers/admin.controller.ts`, `CODEX/DECISION-LOG.md`/`TODO.md`, Ch. 24. Everything else is added. No route collisions.

## 10. Dependencies

None. No chart library, no table library, no form library beyond what exists.

## 11. Implementation order

1. Core: nav config, `PageHeader`, `StatusBadge`, `FilterBar`, `Drawer`, `StatCard`, `DataTable` upgrade.
2. API + UI per module, in the order 1→5 (audit first: it also lets us verify every later mutation).
3. Dashboard rewire.
4. Verify against the **heavy seed** locally (all statuses present), `/browse` pass in light + dark and at phone width, `npm run typecheck` + lint in both apps.
5. `ADMIN_DASHBOARD_REPORT.md`, including the **server-side checks that still need to exist**.

## 12. Assumptions and open questions

- Frontend hiding is UX only; the ADMIN gate on the router is the real control.
- Mutations limited to: settings edit, content takedown, and the existing kennel/user/report actions. Membership and runs stay read-only (D3/D13: kennel authority is not platform authority).
- Admin sees reel/post content regardless of `Audience` (moderation need). Confirm that's wanted: it is a deliberate exception to the D57 scale, and I'd log it as a decision.
- Verified end to end against local Postgres only. I will not touch production data.
