# HCP Implementation Roadmap

Document ID: HCP-IMPLEMENTATION-ROADMAP

Status: Active

Date: 2026-08-10

---

# Roadmap Principle

HCP should move from documentation to implementation in controlled phases.

Do not begin broad app scaffolding until the missing technical bridge documents are in place. The Product Bible is strong, but the exact state model, domain model, event catalog, API contract, database schema, and authorization model are not yet canonical repository files.

---

# Phase 0 - Handoff And Audit

Status: In progress

Goals:

- Establish Codex handoff package.
- Confirm repository shape.
- Record current documentation and implementation status.
- Preserve HCP scope.
- Identify gaps, contradictions, and missing implementation artifacts.

Exit criteria:

- `CODEX/` package exists.
- Product Bible inventory is recorded.
- Missing chapters and implementation files are documented.
- Next work is unblocked and prioritized.

---

# Phase 1 - Documentation Completion

Status: Complete (2026-08-10)

Goals:

- [x] Add Chapter 22 Interaction State Model as a repository file.
- [x] Add Chapter 23 Domain Model and Entity Relationships as a repository file.
- [x] Add Chapter 24 Event-Driven Architecture and Domain Events as a repository file.
- [x] Normalize Chapter 21 journey and task-flow status metadata.
- [x] Create a journey-to-task-flow traceability matrix.
- [x] Review communication docs for the no-DM MVP boundary. (Confirmed Annex 08O's Direct Messaging/Private Chat scope is Future/out-of-MVP; logged in DECISION-LOG rather than editing 08O.)
- [x] Fix visible Markdown encoding artifacts where they affect readability. (None found in Chapter 21.)

Exit criteria:

- [x] Chapters 22-24 exist in `product-Bible/`.
- [x] Each core workflow (Kennel, Membership, Run, Trail, Trail Report, Run Capsule, Event, Officer/Role, Notification) maps to states (Chapter 22), entities (Chapter 23), and events (Chapter 24). Acceptance criteria remain at the Chapter 8 annex level — Chapter 22-24 reference but do not restate them.
- [x] Known contradictions are listed and either resolved or deferred — see each new chapter's "Contradictions & Gaps" / "Gaps Carried Forward" section and the corresponding `CODEX/DECISION-LOG.md` entries.

Notes for Phase 2: Chapters 22-24 were drafted by Codex from the existing Chapter 8 annexes and `CODEX/ARCHITECTURE-RULES.md`, not transcribed from the referenced prior conversation (which was unavailable in this session). Several items are explicitly flagged Codex-inferred/Proposed rather than Approved — notably the membership status reconciliation (Chapter 22 A.2), the Officer/Role Assignment state machine (Chapter 22 A.10), and all of the client interaction/offline states (Chapter 22 Part B). These should get explicit product sign-off before Phase 2 treats them as settled.

---

# Stakeholder Decisions Received (2026-09-14)

The Approval Brief Section 5 decisions are answered (see `CODEX/DECISION-LOG.md` D1-D8). Material roadmap effects:

- HCP ships as one production-ready release (D1). Phases 3-4 are internal milestones, not public launches.
- AI assistance moves from Phase 5 into launch scope (D7).
- Guest registration is launch scope (D2); waitlisting is not built (D1).

---

# Phase 2 - Technical Specification

Status: Unblocked (stakeholder decisions received 2026-09-14)

Goals:

- Create canonical domain model.
- Create Prisma/PostgreSQL schema draft.
- Create API resource model and OpenAPI draft.
- Create authorization and permission matrix.
- Create event registry.
- Create offline sync contract.
- Create notification matrix.
- Create search indexing plan.
- Create AI assistance boundary and prompt/data policy.

Exit criteria:

- API, database, auth, event, offline, notification, search, and AI specs are implementation-ready.
- MVP boundaries are explicit.
- Non-MVP extensions are marked as future.

---

# Phase 3 - MVP Implementation Scaffold

Status: Scaffold in place (2026-09-14). Runnable vertical slice verified: API auth + kennels, web public kennel pages + register/login, admin kennel CRUD + hashers, Expo shell with login + kennel list. Full Prisma schema for all Chapter 23 domains migrated. Remaining Phase 2 specs (OpenAPI, permission matrix, offline sync, notification matrix) still open and should be written as features land.

Target stack:

- React Native/Expo mobile app.
- Next.js web/admin surface.
- Express API.
- PostgreSQL with Prisma.
- OpenStreetMap-compatible map layer.

Goals:

- Create monorepo or agreed project structure.
- Add backend health, auth foundation, Prisma setup, and environment configuration.
- Add mobile shell with auth, home, kennel, run, and map navigation foundations.
- Add web/admin shell for kennel and committee management.
- Add shared TypeScript types generated or aligned from specs.

Exit criteria:

- Apps build locally.
- Database migrations run locally.
- API has health/auth/profile/kennel/run foundations.
- No undocumented product behavior is introduced.

---

# Phase 4 - Core HCP MVP

Status: Not started

Goals:

- Identity and profile.
- Kennel discovery.
- Membership requests and approvals.
- Run listing and detail.
- Join/cancel run.
- Hare trail planning basics.
- Hidden/timed trail release.
- Offline map viewing and participation basics.
- Media upload with queued states.
- Trail report draft/edit/publish.
- Notifications for membership, runs, reminders, trail release, and reports.
- Audit log for sensitive changes.

Exit criteria:

- A hasher can join a kennel, join a run, participate, upload media, and read a published report.
- A hare can create a trail with release settings.
- A scribe can publish a report.
- A committee/admin can manage core kennel operations.

---

# Phase 5 - Community Memory And Intelligence

Status: Future

Goals:

- Run Capsule.
- Hash DNA generation.
- Historical archive.
- Search and discovery.
- Global Hash Atlas.
- AI-assisted report drafting and summaries.
- Community analytics.

Exit criteria:

- Completed runs become durable historical records.
- Search, memory, and AI features respect privacy and source attribution.

---

# Phase 6 - Extensibility And Ecosystem

Status: Future

Goals:

- Webhooks.
- Public API hardening.
- Import/export.
- Partner integrations.
- Regional/community extensions.
- Plugin or extension model if still justified by HCP needs.

Exit criteria:

- Extensibility supports HCP-specific partner and community needs without turning into a premature generic Bubble Barrel OS.

