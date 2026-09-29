# HCP Codex Implementation Handoff

Document ID: HCP-CODEX-HANDOFF

Status: Active

Date: 2026-08-10

Scope: Hash Community Platform only

---

# Purpose

This folder is the implementation handoff package for Codex agents working on HCP.

HCP means Hash Community Platform: a mobile-first digital platform for the worldwide Hash House Harriers community. It supports kennel discovery and membership, run planning, hidden or timed trail release, live participation, media capture, trail reports, historical archives, governance, notifications, AI assistance, search, analytics, and long-term extensibility.

This package is not a Bubble Barrel Engineering Standard handoff. Do not broaden this work into Bubble Barrel OS, shared product frameworks, or generic platform standards unless a future task explicitly asks for that.

---

# Authority Order

When requirements conflict, use this order:

1. Existing HCP Product Bible files in `product-Bible/`.
2. This `CODEX/` handoff package.
3. Existing implementation files, if an implementation repo is later connected.
4. New Codex inference.

Codex may infer only where the Product Bible is silent. Inferred decisions must be logged in `CODEX/DECISION-LOG.md` or flagged as gaps in `CODEX/TODO.md`.

---

# Current Repository Finding

The inspected project folder is:

`C:\Users\Okonk\Pictures\HCP`

The folder currently contains HCP documentation, not a runnable application implementation.

Observed top-level folders:

- `product-Bible/`
- `api/`
- `architecture/`
- `database/`
- `ui-ux/`

The `api/`, `architecture/`, `database/`, and `ui-ux/` folders were empty at inspection time. No `package.json`, Prisma schema, Expo app, Next.js app, Express backend, or test suite was found inside this HCP folder.

Git status could not be used safely because this folder is not a standalone Git repository; Git walked up to `C:\Users\Okonk\.git` and was blocked by Windows safe-directory ownership.

---

# Product Bible Status

The Product Bible is substantial and should be treated as the current source of truth.

Confirmed present:

- Chapters 1-8, with many Chapter 8 annexes covering functional domains.
- Chapter 9 community experience.
- Chapter 10 AI-native community intelligence.
- Chapter 11 platform ecosystem and integrations.
- Chapters 12-20 covering success, trust, evolution, operations, intelligence, integrations, reliability, and design language.
- Chapter 21 User Experience Bible.
- Chapter 21 journeys `J-001` through `J-010`.
- Chapter 21 task flows `TF-001` through `TF-010`.
- A legacy nested task flow at `TF-003-Join-Run/TF-003.2-Join-Run.md`.

Not confirmed as files in the repository:

- Chapter 22 Interaction State Model.
- Chapter 23 Domain Model and Entity Relationships.
- Chapter 24 Event-Driven Architecture and Domain Events.
- Chapter 25 API Design and Resource Model.
- Chapter 26 Database Design with Prisma and PostgreSQL.
- Chapter 27 Authorization and Permission Model.
- Later technical specification chapters discussed in chat.

Important: Chapters 22-24 exist in the referenced conversation as draft content or direction, but were not found as repository files during inspection. They must be imported or recreated as HCP-specific documents before implementation treats them as canonical.

---

# HCP Vision To Preserve

Preserve these product decisions unless the Product Bible is explicitly updated:

- HCP is the Hash Community Platform.
- HCP supports the worldwide Hash House Harriers community.
- HCP is mobile-first.
- Target implementation direction: React Native/Expo mobile app, Next.js web app, Express backend, PostgreSQL with Prisma.
- Mapping should use OpenStreetMap-compatible tooling by default.
- Trail release can be hidden, timed, or permission-gated.
- A hasher has an individual identity that can hold memberships in one or more kennels.
- Kennels maintain local identity, roles, governance, policies, run customs, and settings.
- No one-to-one direct messaging in the initial scope.
- Communication should begin with announcements, notifications, channels, run updates, and governance/workflow communication.
- Trail planning, live participation, media upload, scribe/trail report, run capsule, and historical archive workflows are core product workflows.
- Governance should be configurable by kennel instead of hard-coded to a single committee model.
- AI assists but humans decide.
- Offline behavior is required where practical, especially for run participation, maps, media capture, and later sync.
- Long-term extensibility matters, but HCP implementation should come before generic Bubble Barrel abstractions.

---

# Reconciliation Notes

The Product Bible already documents many areas that an implementation would need:

- Identity, profiles, memberships, and permissions: Chapter 8M.
- Runs: Chapter 8E.
- Trail Studio: Chapter 8F.
- Scribe Studio and trail reports: Chapter 8G.
- Run Capsule and memory/history: Chapter 8H.
- Global Hash Atlas: Chapter 8I.
- Governance and kennel administration: Chapter 8L.
- Notifications: Chapter 8P.
- Search and discovery: Chapter 8Q.
- Integration and API platform: Chapter 8R and Chapter 17.
- Security, privacy, trust: Chapter 8T and Chapter 13.
- UX, journeys, task flows, and navigation: Chapter 21.

However, implementation-specific contracts are not yet complete:

- No canonical Prisma schema found.
- No OpenAPI specification found.
- No entity relationship diagram found.
- No state machine specification found as a repository file.
- No domain event registry found as a repository file.
- No role/permission matrix found in one canonical implementation-ready location.
- No runnable app code found to reconcile against the docs.

---

# Required Codex Behavior

When implementing:

- Read the Product Bible first.
- Prefer documented requirements over assumptions.
- Do not add direct messaging unless the Product Bible is explicitly updated.
- Do not replace kennel traditions with platform defaults.
- Do not make trail release public by default when hidden/timed release is configured.
- Do not make a person equal to a role; roles are contextual assignments.
- Do not hard-code governance to one global model.
- Distinguish HCP-specific requirements from broader Bubble Barrel ideas.
- Write down contradictions before resolving them.
- Update documentation when implementation choices affect the specification.

When documenting:

- Keep HCP-specific language.
- Use existing Product Bible terminology: hasher, kennel, hare, scribe, run, trail, beer check, trail report, run capsule, Hash DNA.
- Mark status clearly: Draft, Approved, Proposed, Gap, or Superseded.
- Keep implementation decisions traceable to source documents.

---

# Immediate Next Step

Before coding, complete the missing technical bridge:

1. Add repository files for Chapter 22 Interaction State Model, Chapter 23 Domain Model, and Chapter 24 Domain Events using the referenced conversation as draft source.
2. Normalize Chapter 21 task flows and remove or mark the legacy nested `TF-003.2` duplicate.
3. Create canonical implementation specs for API, database, authorization, events, and offline sync.
4. Only then scaffold or reconcile mobile, web, and backend implementation.

