# HCP Project Context

Document ID: HCP-PROJECT-CONTEXT

Status: Active

Date: 2026-08-10

---

# Product Summary

HCP is a dedicated platform for Hash House Harriers communities. It is designed to help hashers discover kennels, join runs, plan and release trails, participate in live runs, capture media, publish trail reports, and preserve each run as long-term community memory.

The platform should feel like a digital home for the Hash community, not a generic event app, social network, running tracker, or map tool.

---

# Primary Audiences

- Visitor: discovers public kennels and runs, may attend as a guest.
- New Hasher: joins a kennel, learns terminology, prepares for first run.
- Community Member: joins runs, participates, uploads media, views history.
- Hare: plans trails, manages hidden/timed release, coordinates run-day trail details.
- Scribe: drafts, edits, and publishes trail reports, with optional AI assistance.
- Volunteer: supports logistics, check-in, beer stops, safety, cleanup, media, and operations.
- Committee Member: manages kennel operations, membership, events, announcements, policies, and governance.
- Community Administrator: configures kennel settings, roles, permissions, and local customs.
- Platform Administrator: manages platform-level trust, operations, support, integrations, and oversight.

---

# Current Documentation Inventory

## Foundational Product Bible

- `Chapter-1-Vision-Mission-Product-Philosophy.md`
- `Chapter-2-Understanding-Hash-House-Harriers.md`
- `Chapter-3-Market-Research-and-Competitive-Analysis.md`
- `Chapter-4-Product-Principles.md`
- `Chapter-5-User-Personas.md`
- `Chapter-6-User-Journeys.md`
- `Chapter-7-Feature-Inventory.md`
- `Chapter-8/`

## Functional Domains

Chapter 8 annexes cover major HCP modules including:

- User management.
- Kennels.
- Membership.
- Runs.
- Trail Studio.
- Scribe Studio.
- Run Capsule.
- Global Hash Atlas.
- Community Graph.
- Event Management.
- Governance and kennel administration.
- Identity and authentication.
- Evidence records.
- Communication hub.
- Notification center.
- Search and discovery.
- Integration and API platform.
- Platform operations and observability.
- Security, privacy, and trust.

## Experience Documentation

Chapter 21 exists under `product-Bible/` in the folder named `Chapter 21 ... User Experience Bible` with a Unicode dash in the actual filename.

It includes:

- UX vision.
- User personas.
- User mental models.
- Experience principles.
- Journeys `J-001` through `J-010`.
- Task flows `TF-001` through `TF-010`.
- Navigation flow `NF-001`.

The task flow files are mostly Draft. The journey files vary in formatting and status representation, with several using `Status` on one line and the value on a later line.

---

# Implementation Inventory

No runnable implementation was found in the inspected HCP folder.

Not found:

- React Native/Expo app.
- Next.js web app.
- Express backend.
- PostgreSQL/Prisma schema.
- OpenAPI file.
- Tests.
- Package manifests.
- CI configuration.

Current `api/`, `architecture/`, `database/`, and `ui-ux/` folders were empty at inspection time.

---

# Current Documentation Status

## Strong

- Product vision is clear.
- HCP domain vocabulary is rich and consistent.
- Functional domain coverage is broad.
- Core UX journeys are present.
- Task flows now exist for the main journey set.
- HCP-specific concepts such as Hash DNA, Run Capsule, Scribe Studio, Trail Studio, Global Hash Atlas, and kennel governance are well represented.

## Draft / Needs Normalization

- Chapter 21 task flows are present but still Draft.
- Journey/task-flow traceability needs a single matrix.
- Some Markdown files contain encoding artifacts from prior exports.
- File naming uses mixed conventions: `product-Bible`, `chapter-10`, `Chapter 21`, hyphenated names, spaces, and long Unicode names.
- Duplicate or overlapping platform chapters exist: Chapter 11, Chapter 14, Chapter 17, Chapter 18, and Chapter 19 all include extensibility/platform/operations themes.

## Missing / Not Yet Canonical

- Chapter 22 Interaction State Model.
- Chapter 23 Domain Model and Entity Relationships.
- Chapter 24 Event-Driven Architecture and Domain Events.
- API resource model.
- Database schema.
- Authorization/permission matrix.
- Offline sync contract.
- Notification event matrix.
- Search index model.
- AI architecture contract for actual implementation.
- Deployment and operational runbooks for a first build.

---

# Important Gaps And Contradictions

## Gap: Chapters 22-24 not in repository

The referenced conversation contains draft direction for state, domain model, and event architecture, but files were not found in the HCP folder. Do not treat those chapters as canonical until they are added to the repository.

## Gap: Product Bible vs implementation

There is no implementation code to compare against the Product Bible. Current reconciliation is therefore documentation-to-documentation only.

## Gap: Direct messaging scope

The current handoff states no DMs initially. Existing communication documents should be reviewed to ensure any "conversations" or "channels" language does not accidentally imply one-to-one private messaging for MVP.

## Gap: Technical stack is direction, not implemented reality

React Native/Expo, Next.js, Express, PostgreSQL, Prisma, and OpenStreetMap are preserved as target architecture. They are not currently represented by code in the inspected folder.

## Gap: Governance configurability needs implementation rules

The Product Bible supports configurable kennel governance. A concrete role, permission, and policy model still needs to be made implementation-ready.

## Gap: Hidden/timed trail release needs precise security rules

Trail release is core to HCP. The implementation must specify server-side release enforcement, offline cache behavior, access control, audit logging, and emergency override behavior before coding.

---

# Product Boundaries

In scope:

- HCP documentation completion.
- HCP technical specification.
- HCP app/backend implementation once specs are ready.

Out of scope for this handoff:

- Bubble Barrel OS.
- Shared engineering standards for other Bubble Barrel products.
- Plugin marketplace implementation beyond HCP-specific extensibility needs.
- One-to-one direct messaging in the initial product.
- Generic social network features that do not support HCP goals.
