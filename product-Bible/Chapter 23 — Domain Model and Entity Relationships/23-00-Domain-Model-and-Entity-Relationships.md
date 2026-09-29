# Chapter 23 — Domain Model and Entity Relationships

Document ID: HCP-PB-23

Parent Document: HCP Product Bible

Status: Draft

Version: 1.0

Date: 2026-08-10

Authority: Codex-inferred and consolidated from Chapter 8 annexes and `CODEX/ARCHITECTURE-RULES.md`. Not previously a repository file. See `CODEX/DECISION-LOG.md`.

---

# Purpose

Chapter 8 describes entities implicitly, scattered across functional requirements ("the system shall..."). No annex previously listed HCP's entities, their attributes, and their relationships in one place. This chapter is that canonical domain model — the required input before any Prisma schema, OpenAPI resource model, or database migration is written (per `CODEX/ARCHITECTURE-RULES.md`: "Before coding data models, create a canonical domain model and map it to Prisma").

This chapter intentionally stops at conceptual/logical modeling: entities, key attributes, and relationships. It does not define column types, indexes, or Prisma syntax — that belongs to the Phase 2 technical specification work (`CODEX/IMPLEMENTATION-ROADMAP.md`), which should treat this chapter as its starting point.

---

# Modeling Conventions

- **Entity** — a noun with identity and a lifecycle (see Chapter 22 where applicable).
- **Value/Type field** — an attribute whose values are enumerated elsewhere (e.g., Membership Type) rather than a related entity.
- Cardinality is written `A (1) — (0..*) B`, read "one A relates to zero or more B."
- `status` on any entity below refers to the corresponding state machine in Chapter 22, not a free-text field.
- Every entity has an immutable, globally unique identifier (UUID), per the repeated Chapter 8 principle that identifiers never change (e.g., BR-CAPSULE-001, FR-ID-002, BR-TRAIL-001).

---

# Part A — Identity & Membership Domain

Source: Annex 08M, Annex 08D, Annex 08L-01.

## Person
Represents the human being. Attributes: legal name (optional), preferred name, date of birth (optional), country, languages, emergency contacts, privacy preferences. Never publicly exposed directly — see Identity.

## Identity
The permanent HCP identity tied to a Person. Attributes: UUID, public Hash name, join date, status, trust level, verification status. Immutable identifier (FR-ID-002).
- Person (1) — (1) Identity
- Identity (1) — (0..*) HashName (current + historical, FR-ID-003)
- Identity (1) — (1) PublicProfile
- Identity (1) — (1) PrivateProfile
- Identity (1) — (0..*) Membership
- Identity (1) — (0..*) OrganizationAffiliation (non-membership relationships: volunteer, advisor, former officer — FR-ID-007)
- Identity (1) — (1) HashPassport
- Identity (1) — (1) TrustLevel (current value; history retained as IdentityTimeline entries)

## PublicProfile / PrivateProfile
Split per FR-ID-004/005 for privacy-by-default. PublicProfile: photo, Hash name, bio, home kennel, current roles, awards, passport summary. PrivateProfile: contact details, recovery methods, verification data, medical info, security preferences (encrypted).

## Membership
The entity for one Identity's relationship to one Kennel/Organization. Attributes: organization, membership type (Full/Associate/Visiting/Honorary/Life/Guest/Virgin/Committee — FR-MEMBER-003), status (Chapter 22 A.2), start date, end date, sponsor.
- Identity (1) — (0..*) Membership
- Kennel (1) — (0..*) Membership
- Membership (1) — (0..*) MembershipTimelineEntry (immutable, FR-MEMBER-010)
- Membership (1) — (0..*) RoleAssignment (roles attach to the affiliation, not the identity directly — FR-ID-008)

## OrganizationAffiliation
Non-membership relationship (Volunteer, Advisor, Event Organizer, Former Officer, Honorary Guest, Partner Organization — FR-ID-007). Structurally parallel to Membership but does not carry membership-type semantics.

## RoleAssignment
A role scoped to a Membership or OrganizationAffiliation (Grand Master, Trail Master, Hash Cash, Committee Chair, Volunteer, etc.). Attributes: role name, permission set reference, start date, end date, appointment method.
- Membership or OrganizationAffiliation (1) — (0..*) RoleAssignment
- RoleAssignment (0..1) — (0..*) Delegation (temporary sub-grant, FR-ID-024)

## TrustLevel
Value type attached to Identity (Unverified → Platform Verified, Chapter 22 A.9). History preserved via IdentityTimeline.

## HashPassport
One per Identity, created automatically (FR-PASSPORT-001).
- HashPassport (1) — (0..*) PassportStamp (First Hash, First Hare, etc. — FR-PASSPORT-002)
- HashPassport (1) — (0..*) PassportMilestone (10/50/100/... runs — FR-PASSPORT-004)
- HashPassport (1) — (1) LifetimeStatistics (runs attended, trails laid, beer checks, distance, etc. — FR-PASSPORT-005, derived/aggregated, not independently authored)
- HashPassport (1) — (0..*) PassportMemory (pinned favorites, notes — FR-PASSPORT-006)
- HashPassport (1) — (0..*) CountryVisited / KennelVisited (FR-PASSPORT-003)

---

# Part B — Kennel & Governance Domain

Source: Annex 08C, Annex 08L.

## Kennel (Organization)
Attributes: name, short name, country/state/city, time zone, description, branding, status (Chapter 22 A.1), verification level (Chapter 22 A.8), organization type (Local Kennel, Regional/National/Continental Association, International Committee, Working Group, Heritage Foundation, Temporary Event Committee — FR-GOV organization types).
- Kennel (0..1) — (0..*) Kennel (parent-child organizational hierarchy, FR-GOV org hierarchy)
- Kennel (1) — (0..*) Membership
- Kennel (1) — (0..*) OfficerAppointment (a specialization of RoleAssignment scoped to named officer positions — FR-GOV-004/005/006)
- Kennel (1) — (0..*) Run
- Kennel (1) — (0..*) Announcement
- Kennel (1) — (0..*) SisterKennelRelationship (FR-KENNEL-012, self-referential many-to-many)

## OfficerPosition / OfficerAppointment
OfficerPosition is the definition (Grand Master, Trail Master, ...) with description, responsibilities, permission set, term duration, appointment method. OfficerAppointment is the historical record of one Identity holding one OfficerPosition within one Kennel for a bounded period (Chapter 22 A.10).
- Kennel (1) — (0..*) OfficerPosition
- OfficerPosition (1) — (0..*) OfficerAppointment
- Identity (1) — (0..*) OfficerAppointment

## Committee
Attributes: name, chair (RoleAssignment), members, mandate.
- Kennel (1) — (0..*) Committee
- Committee (1) — (0..*) Motion
- Motion (1) — (0..*) Vote
- Committee (1) — (0..*) MeetingRecord (minutes, referenced as Evidence — see Part G)

## Constitution / Policy
Version-controlled governance documents (FR-ID-027, FR-GOV Policy Engine).
- Kennel (1) — (0..*) Policy
- Policy (1) — (0..*) PolicyRevision (immutable version history)

## Delegation
Time-boxed transfer of a subset of an officer's authority (FR-ID-024, FR-GOV-033). Attributes: delegator, delegate, scope, duration, reason, auto-expiration.
- RoleAssignment (1) — (0..*) Delegation

## ComplianceRecord / GovernanceAuditEntry
Immutable record of a governance action: actor, timestamp, organization, action, object, previous state, new state, supporting evidence (FR-GOV-034).
- Kennel (1) — (0..*) GovernanceAuditEntry

---

# Part C — Events & Runs Domain

Source: Annex 08E, Annex 08K.

## Event
A multi-participant gathering, potentially spanning multiple Run Sessions or Sessions/Activities (Weekly Run, Full Moon Run, Red Dress Run, Campout, Nash Hash, Interhash). Attributes: type, status (Chapter 22 A.7), venue(s), dates.
- Kennel or a coalition of Kennels (1..*) — (0..*) Event
- Event (1) — (0..*) SessionOrActivity
- Event (1) — (0..*) Registration
- Event (1) — (0..*) VolunteerAssignment
- Event (0..*) — (0..*) Sponsor

## Run (Run Session)
The core weekly/one-off run object. Attributes: run number (unique within Kennel — BR-RUN-001), title, date, start time, meeting location, theme, run type, visibility, status (Chapter 22 A.3).
- Kennel (1) — (0..*) Run (BR-RUN-002, single ownership)
- Event (0..1) — (0..*) Run (a Run may optionally belong to a larger Event)
- Run (1) — (1..*) Hare (via RoleAssignment scoped to this Run — FR-RUN-003, multiple hares/co-hares supported)
- Run (1) — (0..1) Trail — in practice one primary Trail plus optional split trails; see Trail entity (BR-TRAIL-004, a Trail cannot exist without a Run)
- Run (1) — (0..*) Participation (attendance/RSVP/check-in records)
- Run (1) — (0..1) Circle
- Run (1) — (0..1) TrailReport (BR-RUN-006, at most one official report)
- Run (1) — (1) RunCapsule (auto-created at Draft, finalized at Archived — FR-RUN-016, FR-CAPSULE-001)
- Run (1) — (0..*) MediaAsset

## Participation
One Identity's attendance record for one Run. Attributes: RSVP status, check-in method (GPS/QR/Officer/Manual — FR-RUN-008), visitor flag, home kennel attribution (BR-RUN-009). Immutable once the Run is archived (BR-RUN-008).
- Run (1) — (0..*) Participation
- Identity (1) — (0..*) Participation

## Circle
The post-run ceremony. Attributes: awards, down-downs, songs, announcements. May be explicitly skipped with a recorded reason (BR-RUN-005).
- Run (1) — (0..1) Circle
- Circle (1) — (0..*) Award

## VolunteerAssignment
Attributes: role, assignee, event/run reference, confirmation status.
- Event or Run (1) — (0..*) VolunteerAssignment
- Identity (1) — (0..*) VolunteerAssignment

---

# Part D — Trail Domain

Source: Annex 08F.

## Trail
Attributes: name (unique within Run — BR-TRAIL-001), trail type, lead Hare, co-Hares, estimated distance/duration, terrain type, status (Chapter 22 A.4), release mode and condition.
- Run (1) — (1) Trail (a Run may have multiple named Trails — Main/A/B/Walkers — modeled as multiple Trail rows sharing the same Run)
- Trail (1) — (0..*) Waypoint
- Trail (1) — (0..*) BeerCheck
- Trail (1) — (0..*) DigitalChalkSymbol
- Trail (1) — (0..*) TrailRevision (immutable version history — BR-TRAIL-008)
- Trail (1) — (0..*) MediaAsset (linked, never orphaned — BR-TRAIL-012)

## Waypoint / BeerCheck / DigitalChalkSymbol
Geo-located trail components. Attributes: coordinates, symbol type, visibility rule (subject to the same secrecy state as the parent Trail — BR-TRAIL-005).

## TrailRevision
Attributes: editor, timestamp, changed elements, previous values, reason (optional). Deleted symbols remain in this history (BR-TRAIL-007).

---

# Part E — Story & Capsule Domain

Source: Annex 08G, Annex 08H.

## StoryAsset (Story Card)
An individual collected or manually authored moment (photo caption, quote, incident, Beer Check note). Attributes: category (Trail/Beer Check/Circle/Visitor/Award/Song/Incident/Humor/Safety/Historical/General — FR-STORY-004), timestamp, contributor, source.
- Run (1) — (0..*) StoryAsset
- StoryAsset (0..*) — (0..1) TrailReport (may or may not be pulled into the narrative)

## TrailReport
The official editorial artifact (Chapter 22 A.5). Attributes: status, official Scribe, assistant scribes, reviewers, narrative sections, AI-assisted flag.
- Run (1) — (0..1) TrailReport (BR-SCRIBE-002, exactly one official report)
- TrailReport (1) — (0..*) ReportRevision (immutable — BR-SCRIBE-008)
- TrailReport (1) — (0..*) StoryAsset (referenced as supporting evidence — FR-STORY-008)

## RunCapsule
The permanent historical artifact (Chapter 22 A.6). Attributes: status, creation timestamp, publication timestamp.
- Run (1) — (1) RunCapsule (BR-CAPSULE-002, exactly one)
- RunCapsule (1) — (0..1) TrailReport
- RunCapsule (1) — (0..*) MediaAsset (consolidated galleries — FR-CAPSULE-004)
- RunCapsule (1) — (0..*) SupplementalArtifact (post-publication additions — BR-CAPSULE-005)
- RunCapsule (1) — (1) Timeline (constructed automatically — FR-CAPSULE-005)

## SupplementalArtifact
Attributes: type (photo, scanned newsletter, interview, reflection), timestamp, contributor. Clearly distinguished from the original record (BR-CAPSULE-005).

---

# Part F — Media Domain

Source: cross-cutting (08E-06 BR-RUN-007, 08F-06 BR-TRAIL-012, 08H-05 BR-CAPSULE-007).

## MediaAsset
Attributes: uploader, upload timestamp, type (photo/video/audio), licensing info (optional), sync/upload state (Chapter 22 B.2), moderation state.

Every MediaAsset must link to at least one of: Run, Trail (or Trail Segment/Waypoint/Beer Check), Circle, StoryAsset, or General Gallery — unlinked media is not permitted (BR-RUN-007, BR-TRAIL-012).
- MediaAsset (1) — (1..*) [Run | Trail | Circle | StoryAsset | Gallery]
- Kennel (1) — (0..*) Gallery/Album

---

# Part G — Communication & Notification Domain

Source: Annex 08O, Annex 08P. **Direct/one-to-one conversation types from 08O are modeled here as Future/out-of-MVP per Chapter 22, Contradictions & Gaps item 2 — not implemented in the initial schema.**

## Announcement
Attributes: kennel, author, pinned flag, schedule, category.
- Kennel (1) — (0..*) Announcement

## Channel (MVP scope: Kennel/Event/Committee-scoped group channels only — no private 1:1 Conversation entity in MVP)
Attributes: type (Organization Channel, Event Channel, Committee Workspace, Governance Discussion), participants.
- Kennel or Event or Committee (1) — (0..*) Channel
- Channel (1) — (0..*) Message

## Notification
Attributes: category, priority, context object reference, recipient(s), delivery channels, delivery policy, status (Chapter 22 A.11). Immutable once delivered (FR-NOT-001).
- Identity (1) — (0..*) Notification
- Notification (0..*) — (1) [any domain event's aggregate, as its context object]

## NotificationPreference
Attributes: category, organization, event, channel, priority, language, device. Preference inheritance is configurable (FR-NOT-009).
- Identity (1) — (0..*) NotificationPreference

---

# Part H — Evidence & Audit Domain

Source: Annex 08N, cross-cutting audit requirements repeated in nearly every other annex.

## EvidenceRecord
Attributes: category (Attendance, Identity, Membership, Governance, Financial, Historical, Geographical, Media, Awards, Volunteer Service, Trail Verification, Administrative, Imported Records), source, confidence score, verification status, chain of custody.
- Any governed fact (Membership approval, Officer appointment, Award, Passport stamp, Trail verification, ...) (0..*) — (0..*) EvidenceRecord

## AuditLog
Immutable, append-only record of privileged/administrative actions. Attributes: actor, action, resource, decision, timestamp, context, supporting policy, evidence reference (FR-ID-030, FR-GOV-034).
- Every entity in this chapter with a `status` transition or administrative action produces AuditLog entries; see Chapter 24 for the event-to-audit mapping.

## DomainEvent
The append-only event record underlying the event bus described in Chapter 24. Distinct from AuditLog: DomainEvent is the mechanism (facts that happened, used for eventing/integration); AuditLog is the governance record (who was allowed to do what, and why). The two overlap in content but serve different consumers.

---

# Entity Relationship Overview (Text Diagram)

```text
Person ──1:1── Identity ──1:N── Membership ──N:1── Kennel
                  │                 │                 │
                  │                 └─N:1── RoleAssignment       │
                  │                                              │
                  ├─1:1── HashPassport                           ├─1:N── Run ──1:N── Trail ──1:N── Waypoint/BeerCheck/DigitalChalk
                  │           │                                  │        │            │
                  │           ├─N── PassportStamp                │        │            └─1:N── TrailRevision
                  │           └─N── PassportMilestone             │        │
                  │                                               │        ├─1:1── RunCapsule ──N── SupplementalArtifact
                  │                                               │        ├─0:1── TrailReport ──N── ReportRevision
                  │                                               │        ├─0:1── Circle ──N── Award
                  │                                               │        ├─N── Participation ──N:1── Identity
                  │                                               │        └─N── MediaAsset
                  │                                               │
                  │                                               ├─1:N── OfficerAppointment ──N:1── OfficerPosition
                  │                                               ├─1:N── Committee ──N── Motion ──N── Vote
                  │                                               ├─1:N── Policy ──N── PolicyRevision
                  │                                               ├─1:N── Announcement
                  │                                               └─1:N── Channel ──N── Message
                  │
                  └─1:N── OrganizationAffiliation ──N:1── (Kennel | Committee | Event)

Event ──1:N── Run
Event ──1:N── VolunteerAssignment ──N:1── Identity
Event ──1:N── Registration ──N:1── Identity

EvidenceRecord ──N:N── (Membership | OfficerAppointment | Award | PassportStamp | TrailRevision | ...)
AuditLog ──N:1── (any governed entity above)
DomainEvent ──N:1── (any entity above, as its aggregate)
```

---

# Naming & Identifier Conventions

- All entity identifiers are UUIDs and are immutable once assigned (repeated across BR-CAPSULE-001, BR-TRAIL-001, FR-ID-002).
- Human-facing numbers (e.g., Run Number) are unique only within their owning Kennel, not globally (BR-RUN-001).
- `status` fields use the enumerations defined in Chapter 22, not free text.
- Every entity that Chapter 8 describes as historically preserved (Membership, OfficerAppointment, TrailRevision, ReportRevision, RunCapsule) is append-only in practice: corrections are new rows/revisions referencing the original, never destructive updates.

---

# Data Ownership Summary

Per `CODEX/ARCHITECTURE-RULES.md` and repeated Chapter 8 business principles:

- A Kennel owns its Runs, Trails (via Runs), Committees, Policies, and Announcements.
- An Identity owns its Person data, HashPassport, and PublicProfile/PrivateProfile.
- A Membership is jointly referenced by Identity and Kennel but is its own entity, not a foreign key on either.
- Contributor attribution on MediaAsset, StoryAsset, and TrailRevision belongs to the contributing Identity permanently, even if the Kennel later removes or archives the parent object.
- RunCapsule and TrailReport, once published, are historical records; no entity in this chapter permits destructive edits to a published historical record.

---

# Gaps Carried Forward

- No canonical Prisma schema exists yet; this chapter is the required input for Phase 2 (`CODEX/IMPLEMENTATION-ROADMAP.md`).
- Field-level attribute types (string length, enum exhaustiveness, required/optional at the database level) are intentionally out of scope here and belong to the Phase 2 Prisma draft.
- The Registration entity (Part C) is named by analogy with Event Management (08K) but 08K-00 is an overview document only; a full Registration/Ticket data model was not found in the inspected annexes and should be verified against 08K-01 through 08K-06 if/when those detail documents are added.

---

# Completion Criteria

This chapter is complete when:

- Every entity referenced across Chapter 8 annexes has an entry here with attributes and relationships.
- Every relationship has a stated cardinality.
- Ownership rules are explicit for entities that could otherwise appear ambiguously owned (Membership, contributor attribution).
- Gaps requiring Phase 2 follow-up are listed rather than guessed at the schema level.
