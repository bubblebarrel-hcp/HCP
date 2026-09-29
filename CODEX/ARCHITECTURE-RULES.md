# HCP Architecture Rules

Document ID: HCP-ARCHITECTURE-RULES

Status: Active

Date: 2026-08-10

---

# Architectural Direction

The intended implementation architecture is:

- Mobile: React Native with Expo.
- Web: Next.js.
- Backend: Express.
- Database: PostgreSQL.
- ORM: Prisma.
- Maps: OpenStreetMap-compatible mapping and geodata tooling.
- API style: REST-first unless a later Product Bible chapter approves additional interfaces.
- Eventing: domain events for notifications, audit, analytics, search indexing, AI workflows, and future integrations.

This architecture is target direction only. No runnable implementation was found in the inspected HCP folder.

---

# Core Domain Rules

## Identity

- A person is an individual hasher identity.
- A person may belong to multiple kennels.
- A membership is its own entity with status, dates, approval history, role context, and kennel-specific settings.
- A role is not the same thing as a person.
- Historical roles must remain historically accurate after membership or role changes.

## Kennels

- A kennel is a local Hash community.
- Kennels own local customs, governance, settings, visibility, event policies, and membership rules.
- Verified or historically meaningful kennels should be archived, not hard-deleted.
- Platform defaults must not erase local kennel identity.

## Runs

- A run belongs to a kennel or event context.
- Run lifecycle must be explicit: draft, planning, published, registration open/closed, in progress, completed, archived.
- Joining a run must be validated server-side.
- Duplicate registration must be prevented.
- Attendance changes require audit trails.

## Trails

- Trails may include GPX imports, waypoints, beer checks, chalk marks, hazards, and release settings.
- Hidden/timed trail release must be enforced by backend authorization, not only UI hiding.
- Offline map and trail behavior must be defined before implementation.
- Emergency or committee overrides must be explicit and audited.

## Media And Reports

- Media upload must support queued/offline states where practical.
- Trail reports are human-owned editorial artifacts, even when AI assists.
- AI-generated drafts must be transparent and editable.
- Published reports and run capsules are historical records and should not be casually overwritten.

## Governance

- Governance must be configurable by kennel.
- Roles and permissions must be policy-driven where practical.
- Committee, hare, scribe, volunteer, admin, and platform roles must be scoped.
- Permission checks must run server-side.

---

# Initial Scope Boundaries

No direct messaging in MVP.

Allowed initial communication:

- Announcements.
- Run updates.
- Notifications.
- Channels or group/workflow communication if explicitly scoped.
- Governance and committee workflow communication.

Not allowed without Product Bible update:

- One-to-one private DMs.
- Social-network-style messaging expansion.
- Public trail leakage before configured release.
- AI autonomous changes to event, attendance, membership, or governance records.

---

# Event Architecture Rules

Domain events describe facts that already happened and use past-tense names.

Examples:

- UserRegistered
- KennelCreated
- MembershipRequested
- MembershipApproved
- RunCreated
- RunPublished
- TrailReleased
- RunJoined
- ParticipantCheckedIn
- MediaUploaded
- TrailReportPublished
- CommitteeRoleAssigned

Every event should include:

- `eventId`
- `eventType`
- `occurredAt`
- `version`
- `actorId`
- `aggregateType`
- `aggregateId`
- `payload`

Each event should have one owning publisher. Consumers may include notifications, analytics, search, audit logging, AI, calendar, and future integrations.

---

# Data And API Rules

Before coding data models, create a canonical domain model and map it to Prisma.

Required entities likely include:

- Person
- Kennel
- Membership
- RoleAssignment
- Run
- Trail
- Waypoint
- BeerCheck
- Participation or Attendance
- VolunteerAssignment
- MediaAsset
- TrailReport
- RunCapsule
- Announcement
- Notification
- AuditLog
- DomainEvent

Do not create database tables directly from UI screens. Model the domain first.

Before coding API endpoints, create a resource model that covers:

- Auth and profile.
- Kennels and memberships.
- Runs and registration.
- Trails and release.
- Participation/check-in.
- Media.
- Trail reports.
- Notifications.
- Search.
- Admin/governance.

---

# Offline And Sync Rules

Offline behavior is required where practical.

Must be specified before implementation:

- Which actions are read-only while offline.
- Which actions can queue locally.
- Conflict resolution rules.
- Sync status states.
- How hidden/timed trail release behaves when a device is offline.
- How media upload resumes.
- How audit integrity is preserved after delayed sync.

---

# AI Rules

AI assists; humans decide.

AI may:

- Explain Hash terms.
- Draft trail reports.
- Summarize historical runs.
- Suggest preparation items.
- Help search and discovery.
- Assist committee workflows.

AI must not:

- Register attendance.
- Override permissions.
- Publish reports without human approval.
- Modify governance.
- Invent historical facts.
- Leak hidden trail details.

---

# Documentation Rules For Codex

- Keep documentation and implementation in sync.
- Add a decision log entry for material architecture changes.
- Flag contradictions in TODO rather than silently choosing.
- Keep HCP separate from Bubble Barrel OS.
- Prefer minimal implementation that satisfies documented HCP requirements.

