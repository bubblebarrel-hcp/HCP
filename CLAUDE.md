# HCP — Hash Community Platform

A mobile-first platform for Hash House Harriers kennels: find kennels, join runs, hidden/timed trail release, trail reports, Run Capsules and a lifelong Hash Passport.

## Authority

1. `product-Bible/` — requirements. Chapters 22 (states), 23 (domain model), 24 (domain events) are the technical bridge.
2. `CODEX/` — `DECISION-LOG.md` (stakeholder decisions D1–D17), `ARCHITECTURE-RULES.md`, `TODO.md`, roadmap.
3. Code.

Where the Bible is silent, infer, then log the decision in `CODEX/DECISION-LOG.md` or flag it in `CODEX/TODO.md`. Use Hash vocabulary: hasher, kennel, hare, scribe, run, trail, beer check, Circle, mismanagement, trail report, Run Capsule, Hash Passport.

## Shape

| App | Path | Port | Stack |
| --- | --- | --- | --- |
| API | `apps/api` | 5010 | Express 4 + TypeScript + Prisma 7 + Postgres |
| Web | `apps/web` | 3010 | Next.js 16 App Router, React 19, Tailwind 4 + Radix |
| Admin | `apps/admin` | 3011 | same as web |
| Mobile | `apps/mobile` | Expo | Expo SDK 57, expo-router (`src/app`) |

Ports are 5010/3010/3011, not 5000/3000/3001, so HCP runs alongside other local projects.

Each app installs its own dependencies with **npm**. No workspaces, no Turborepo.

## Running locally

```bash
cd apps/api    && npm run dev     # needs local Postgres
cd apps/web    && npm run dev
cd apps/admin  && npm run dev
cd apps/mobile && npx expo start
```

Postgres is a local install managed through pgAdmin4 (PostgreSQL 17 on 5432), not Docker. Database `hcp_db`. Reset with `npx prisma migrate reset` in `apps/api`, then `npm run prisma:seed` (Prisma 7 does not auto-seed).

Seeded admin: `admin@hcp.test` / `OnOn2026!`. Seeded hasher: `hasher@hcp.test`. Officers: `officer1..10@hcp.test`. Same password.

For a database worth testing against, run `npm run prisma:seed:heavy` in `apps/api` after the base seed (`prisma/seed-heavy/`): ~100 hashers (`member01..96@hcp.test`) across ten kennels, every membership and run status, hidden trails in each release mode, reports and capsules at every stage, photos, reels, posts and a social graph. It refuses a non-local `DATABASE_URL`, runs in one transaction and is a no-op the second time; start over with `npx prisma migrate reset` and both seeds. Its placeholder media lives in `apps/api/uploads/seed/` (git-ignored); with R2 configured the API serves that folder in development only.

## Non-negotiable product rules

- **No direct / one-to-one messaging** (D8). Channels are kennel/event/committee/run scoped only.
- **A person is never a role.** `User.platformRole` is only USER/ADMIN for the platform. Kennel authority (kennel admin, hare, scribe, officer) lives in `RoleAssignment` / `OfficerAppointment` and is checked against the database in services, never read from a token claim.
- **Public identity is the hash handle**, or `"Just <firstName>"` when un-named (D11, `serializers/user.ts#displayName`). Biodata in `PersonProfile` is private and never serialized publicly.
- **Kennel verification needs ≥ 4 active mismanagement members** (D10, `PlatformSetting kennel.verification.minMismanagement`).
- **Run privacy is set by the hosting kennel's admin** (D3); hares change it only via `Delegation` (D13).
- **Trail secrecy is server-enforced.** Never serialize `Trail.routeGeoJson`, waypoints, beer checks or chalk before release. Offline devices do not self-unlock manual/geofence releases (D6/D12).
- **History is append-only.** Timelines, revisions, appointments, audit and domain events are never destructively edited. Kennels with history are archived, not deleted.
- **Following is not joining** (D50). A follow is interest: it grants no membership, no vote and no authority, never counts towards the four active mismanagement members a kennel needs (D10), and creates no channel — D8 still holds. Likes, comments, reshares, bookmarks and views are polymorphic over `SubjectType` and every act resolves through `services/subject.service.ts#resolveSubject` first, which throws **404**, never 403, so a members-only run cannot be found by liking it.
- **A post is words, a reel is media** (D51). Both belong to the hasher, not the kennel (D41). A post carries its own `visibility` (D57), which can narrow its author's profile and never widen it; a kennel on a post is context, not an audience. Posting is create-draft, upload photos, publish — the same three steps a reel takes (D28), so nothing half-uploaded reaches the feed.
- **A reel lasts 24 hours** (D58). After that it is on no list and 404 everywhere, its author included, unless it is pinned. A pinned reel never expires and shows only on its author's profile, never in the rail, a feed or a kennel page. Expiry is asked at read time through `reelIsLive` / `liveReelWhere` / `feedReelWhere` in `reel.service.ts`; nothing writes it, so a new surface that lists reels must use them. The author deletes their own reel with `DELETE /reels/:id` (`DELETED`, the row stays). "Reel" is the name: "story" already means the scribe's run story timeline.
- **Who sees what a hasher made is one scale** (D57): `Audience` is PUBLIC, FOLLOWERS or ONLY_ME, on `User.profileVisibility` (posts, photos, reels) and on each reel and each post, which can narrow the profile but never widen it. Every place that shows a hasher's things asks `services/audience.service.ts`; do not re-derive it. A locked (FOLLOWERS) profile turns a follow into a request (`Follow.status` PENDING); only ACTIVE follows count. The reel rail, signed in, is the people you follow and yourself; signed out, public reels. A deleted hasher is anonymised, not erased: runs, reports and capsules keep their history as "Deleted hasher".
- **AI assists, humans decide.** AI output is an `AiSuggestion`; an AI is never the actor on a `DomainEvent`. Provider: Claude (D14).
- **State changes write a `DomainEvent` (and usually an `AuditLog`) in the same transaction** via `services/record.service.ts`. Event names are past tense from Chapter 24.
- `status` enums are Chapter 22 state machines. Don't add states without updating Chapter 22.

## Auth — read this before touching anything auth-shaped

- The API issues 15-minute access tokens and 30-day refresh tokens. Refresh tokens rotate on every use and are stored hashed in `RefreshToken`. Reusing a rotated token revokes every session for that user.
- **Browsers never hold a token.** Web and admin call `/api/proxy/*`, a same-origin route handler that keeps both tokens in httpOnly cookies and adds the Authorization header server-side.
- **Cookie names differ per app:** web uses `hcp_access` / `hcp_refresh`, admin uses `hcp_admin_access` / `hcp_admin_refresh`. Browsers do not isolate cookies by port, so identical names on localhost:3010 and :3011 would clobber each other.
- Client code never reads a token, never sets an Authorization header, never uses `localStorage` for auth.
- `/api/auth/me` falls back to the refresh cookie when the access cookie has expired, so a hard refresh after 15 minutes keeps the session.
- Mobile is the exception: it holds tokens in secure storage and sends `Authorization: Bearer`.
- **FR-AUTH-002 email verification is enforced** (D31): registering issues a hashed, single-use, 24-hour token and sends the link; `login` and `refresh` refuse with `EMAIL_NOT_VERIFIED` until `emailVerifiedAt` is set, and registering returns **no tokens**. Outside production the link is also logged, so a developer with undeliverable mail is never locked out. Seeded users are pre-verified.

## API conventions

- Everything under `/api/v1`.
- One envelope: `{ success: true, data }` or `{ success: false, error: { message, code } }`. The proxy reads `data`.
- Lists: `data: { items, total, page, limit }`.
- Platform admin routes live under `/api/v1/admin/*` with `requireAuth` + `requireRole('ADMIN')` applied once at the router top.
- Controllers stay thin; logic in `services/`.
- Validation is Joi in `validators/`. Web register and admin kennel forms mirror these as Zod (`apps/web/app/auth/register/page.tsx`, `apps/admin/lib/schemas.ts`). **Changing one means changing the other.**
- Joi `.email({ tlds: { allow: false } })` is deliberate: the default TLD list rejects `.test` dev addresses.
- `AUTH_RATE_LIMIT` is loose outside production so QA passes don't 429.
- `id` columns are `uuid`: guard any "slug or id" lookup with `isUuid()` or Postgres rejects the cast.

## Prisma 7 notes

- The connection URL lives in `apps/api/prisma.config.ts`, not `schema.prisma`. The runtime client uses the `@prisma/adapter-pg` driver adapter (`src/config/prisma.ts`).
- `prisma migrate dev` does not run the seed. Run `npm run prisma:seed`.

## Next.js 16 notes

- Edge middleware is `proxy.ts` with a **default** export (admin root). Unrelated to `app/api/proxy/`, the BFF that holds tokens.
- Route params are `Promise`-typed: `await params` (or `use(params)` in client pages).
- Tailwind is **v4**: tokens in `globals.css` via `@theme inline`; there is no `tailwind.config.ts`.
- `LayoutProps` / `PageProps` globals come from `next typegen`; `npm run typecheck` runs it before `tsc`.
- `next dev` writes `AGENTS.md` and `CLAUDE.md` into each Next app (and Expo writes its own in `apps/mobile`). Those are generated; this root file is the one to edit.

## Front-end conventions

- Public pages (home, kennel list/detail) are Server Components fetching the backend directly (`lib/server-api.ts`). They must render without JS. `revalidate = 60` is the fallback, not the mechanism: kennel changes are pushed through `POST /api/revalidate` and land in about a second (D35). Everything else can still take a minute. Check the API before debugging a "missing" write.
- **Time-based revalidation cannot express a deletion.** When the API starts answering 404, the page's regeneration calls `notFound()`, Next throws that render away and keeps serving the last good one — forever, not for 60 seconds. Anything that can stop being public needs an explicit `revalidatePath`, which for kennels rides the outbox (`revalidate.service.ts`). Needs `REVALIDATE_SECRET` set identically in `apps/api/.env` and `apps/web/.env.local`; unset means the feature is off and archived pages linger.
- Authenticated/interactive calls use `services/api.ts` (`baseURL: '/api/proxy'`).
- `components/ui/*` is hand-written shadcn-style (cva, `cn()`, `forwardRef`, Radix `Slot`).
- Theme tokens (D24 brand system: HCP Orange `#F4511E` × Hash Black `#171717` × Flour `#F4F1E8`) are defined in full in `:root`, the dark media query, and `.dark`. Gold, trail green and red are semantic only.
- **Light and dark are both first-class.** Web and admin use `next-themes` with `attribute="class"` (so `.light` / `.dark` drive the tokens); mobile keeps the choice in `context/theme-preference.tsx`. Every app defaults to the device setting and ships a visible control: web top bar and account menu, admin sidebar, mobile Menu → Display.
- **Orange is a fill, never small text.** `bg-primary` carries `text-primary-foreground` (Hash Black); links and small orange text use `text-primary-strong` (Ember on light, lighter orange on dark). Beer Gold works the same way: `bg-accent` with `text-accent-foreground`, `text-accent-strong` for text.
- Destructive admin actions use `ConfirmDialog` (Radix AlertDialog), never `window.confirm`.
- `apps/web` and `apps/admin` duplicate the proxy, api client and ui primitives on purpose. A fix that matters in both must be applied in both.
- Add `data-testid` to anything a verification pass asserts.

## Not installed yet

Redis and a broker for the event outbox — the outbox runs in-process on a timer, which is what to replace when HCP runs more than one API instance.

The Anthropic SDK (D14) is installed and wired for AI-assisted trail report drafting (`apps/api/src/services/ai.service.ts`, FR-STORY-007) — set `ANTHROPIC_API_KEY` in `apps/api/.env` (see `CODEX/PROVIDERS.md`) or `POST /reports/:id/ai-draft` answers `AI_NOT_CONFIGURED`. No other AI feature uses it yet.

Push is wired through **Expo** (D36) and needs no key, but `apps/mobile` has no EAS project id yet, so no real device can register until someone runs `eas init` there. Browser Web Push is not built: `DevicePlatform.WEB` is unused and push is a phone-app feature for now.

Media and email are wired: **Cloudflare R2** for photos and media, **Resend** for email (D28). Both are optional at runtime — R2 falls back to local disk in `apps/api/uploads/`, and without a Resend key notifications stay in-app. Credentials and setup are in `CODEX/PROVIDERS.md`. Uploads go browser → storage directly; the API only issues presigned targets and records the asset. That request never touches the API, so a failing upload is a browser-side problem: the bucket needs a CORS policy (still owed on `hcp-uploads`) and the web CSP's `connect-src` has to name the storage origin (`MEDIA_UPLOAD_ORIGIN` in `apps/web/next.config.ts`).

## Working agreements

- Don't commit. The repo owner runs commits.
- Verify changes by running the app, not just type-checking.
- Use the `/browse` skill for browser checks.
