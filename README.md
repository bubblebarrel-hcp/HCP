# HCP — Hash Community Platform

A mobile-first digital home for the worldwide Hash House Harriers community.

- **Product Bible** (`product-Bible/`) is the source of truth for requirements.
- **CODEX** (`CODEX/`) holds the decision log (D1–D17), roadmap, TODO and architecture rules.

## Apps

| App | Path | Port | Stack |
| --- | --- | --- | --- |
| API | `apps/api` | 5010 | Express 4 + TypeScript + Prisma 7 + PostgreSQL |
| Web | `apps/web` | 3010 | Next.js 16 (public site) |
| Admin | `apps/admin` | 3011 | Next.js 16 (platform admin) |
| Mobile | `apps/mobile` | Expo | Expo SDK 57 + expo-router |

Each app installs its own dependencies with **npm** (no workspaces).

## Run locally

Needs the local PostgreSQL install (pgAdmin4-managed) with a database named `hcp_db`.

```bash
cd apps/api
npm install
npx prisma migrate dev        # applies migrations
npm run prisma:seed           # idempotent demo data
npm run dev                   # http://localhost:5010/api/v1/health

cd apps/web   && npm install && npm run dev   # http://localhost:3010
cd apps/admin && npm install && npm run dev   # http://localhost:3011
cd apps/mobile && npm install && npx expo start
```

Seeded logins (password `OnOn2026!`):

- `admin@hcp.test` — platform admin
- `hasher@hcp.test` — un-named hasher, pending member of Abuja H3
- `officer1..10@hcp.test` — mismanagement of Abuja H3 and Lagos H3
