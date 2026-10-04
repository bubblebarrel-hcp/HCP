# Chapter 24 — Event-Driven Architecture and Domain Events

Document ID: HCP-PB-24

Parent Document: HCP Product Bible

Status: Draft

Version: 1.0

Date: 2026-08-10

Authority: Codex-inferred and consolidated from Chapter 8 annexes, Chapter 22, Chapter 23, and `CODEX/ARCHITECTURE-RULES.md`. Not previously a repository file. See `CODEX/DECISION-LOG.md`.

---

# Purpose

Chapter 8 repeatedly requires that actions "generate notifications," "create an audit record," or "trigger Hash Passport updates" without naming the underlying event or its consumers. `CODEX/ARCHITECTURE-RULES.md` already establishes the event envelope and naming convention; this chapter is the registry that fills that envelope in for every state transition defined in Chapter 22 and every entity defined in Chapter 23.

This chapter exists so that:

- Every state transition in Chapter 22 has exactly one owning event.
- Every event has a declared producer and a declared set of consumers, so notification, audit, search indexing, passport updates, and Run Capsule assembly are traceable rather than implicit.
- Implementation (Phase 3+) has a single source to generate an event bus contract from, instead of inferring events ad hoc per feature.

---

# Event Envelope

Per `CODEX/ARCHITECTURE-RULES.md`, every domain event carries:

| Field | Description |
|---|---|
| `eventId` | Unique identifier for this event instance. |
| `eventType` | Past-tense name from the registry below (e.g., `RunPublished`). |
| `occurredAt` | When the fact became true on the server (see Offline Rules below — distinct from when a client-side action was taken). |
| `version` | Schema version of this event type's payload. |
| `actorId` | Identity that caused the event (or `system` for automatic transitions). |
| `aggregateType` | The Chapter 23 entity this event belongs to (e.g., `Run`). |
| `aggregateId` | The specific entity instance. |
| `payload` | Event-specific data — kept minimal; consumers that need more should query the aggregate, not rely on payload completeness. |

**Naming convention:** past tense, `AggregateVerbed` (e.g., `MembershipApproved`, not `ApproveMembership`). Each event has exactly one owning publisher — the service/domain that owns the aggregate.

---

# Event Registry

Organized by Chapter 23 domain. "Consumers" lists which cross-cutting systems care, not literal service names — Phase 3 may implement these as one service or several.

## Identity & Membership Events

| Event | Trigger (Chapter 22 state) | Producer | Consumers |
|---|---|---|---|
| `IdentityCreated` | Identity created at registration | Identity Service | Notification, Search Index, Audit |
| `EmailVerified` | FR-AUTH-002 confirmation accepted; account becomes usable | Identity Service | Audit (trust level lifts to VERIFIED_EMAIL) |
| `PasswordReset` | A reset token was redeemed; every refresh token for the user is revoked | Identity Service | Audit |
| `ProfileUpdated` | FR-ID-005 profile view/edit; payload lists changed fields, never their values | Identity Service | Search Index, Audit |
| `ProfileVisibilityChanged` | D57: who sees what the hasher made changed (PUBLIC, FOLLOWERS, ONLY_ME); payload has `from`, `to` and how many waiting requests were admitted | Identity Service | Feed, Audit |
| `AccountDeactivated` / `AccountReactivated` | D57: the hasher stepped away, or signed back in | Identity Service | Feed, Search Index, Audit |
| `AccountDeleted` | D57: the hasher deleted their account; the person is removed and the record kept; payload lists the kennels they left | Identity Service | Feed, Search Index, Passport, Audit |
| `HashNameChanged` | New primary Hash name recorded | Identity Service | Search Index, Audit |
| `TrustLevelChanged` | A.9 transition | Identity Service | Authorization, Audit, AI (context signal only) |
| `MembershipRequested` | A.2 Applicant → Pending Review | Membership Service | Notification (officers), Audit |
| `MembershipApproved` | A.2 Pending Review → Active | Membership Service | Notification, Passport, Search Index, Audit |
| `MembershipRejected` | A.2 Pending Review → (terminal) | Membership Service | Notification, Audit |
| `MembershipRequestWithdrawn` | A.2 Applicant/Pending Review → Withdrawn (D52) | Membership Service | Audit |
| `MembershipSuspended` | A.2 Active → Suspended | Membership Service | Notification, Authorization, Audit |
| `MembershipReinstated` | A.2 Suspended/Inactive → Active | Membership Service | Notification, Authorization, Audit |
| `MembershipResigned` | A.2 Active → Resigned | Membership Service | Notification (officers), Audit |
| `MembershipRemoved` | A.2 Active → Removed | Membership Service | Notification, Authorization, Audit |
| `HomeKennelTransferred` | FR-MEMBER-007 | Membership Service | Search Index, Passport, Audit |
| `MembershipInvitationSent` | FR-MEMBER-005 | Membership Service | Audit |
| `MembershipInvitationRevoked` | FR-MEMBER-005, before acceptance | Membership Service | Audit |
| `MembershipInvitationAccepted` | FR-MEMBER-005; the accompanying `MembershipApproved` is what Notification/Passport/Search Index actually consume | Membership Service | Audit |
| `PassportStampAwarded` | FR-PASSPORT-002 milestone rule fires | Passport Service | Notification, Search Index |
| `PassportMilestoneReached` | FR-PASSPORT-004 threshold crossed | Passport Service | Notification, Search Index |
| `RoleAssigned` | A.10 Nominated/Appointed → Active | Governance Service | Notification, Authorization, Audit |
| `RoleDelegated` | A.10 Active → Delegated | Governance Service | Authorization, Audit |
| `RoleDelegationExpired` | A.10 Delegated auto-expiration | Governance Service (scheduled) | Authorization, Audit |
| `RoleEnded` | A.10 → Historical (term end, resignation, revocation) | Governance Service | Notification, Authorization, Audit |

## Kennel & Governance Events

| Event | Trigger | Producer | Consumers |
|---|---|---|---|
| `KennelCreated` | A.1 (Draft created) | Kennel Service | Notification (platform admin), Search Index, Audit |
| `KennelVerified` | A.1 Pending Verification → Active | Kennel Service | Notification, Search Index, Audit |
| `KennelVerificationLevelChanged` | A.8 | Kennel Service | Search Index, Audit |
| `KennelArchived` | A.1 → Archived | Kennel Service | Search Index, Audit |
| `AnnouncementPublished` | Kennel officer publishes | Communication Service | Notification, Search Index |
| `CommitteeCreated` / `CommitteeDissolved` | Governance action | Governance Service | Notification, Audit |
| `MotionSubmitted` / `VoteCast` / `MotionResolved` | 08L-02/03 governance workflow | Governance Service | Notification, Audit, Evidence |
| `PolicyPublished` / `PolicyRevised` | FR-ID-027 | Governance Service | Notification, Search Index, Audit |
| `DelegationGranted` / `DelegationRevoked` | FR-GOV-033 | Governance Service | Authorization, Audit |
| `OfficerPositionDefined` | A kennel defines an office and the keys it carries (08L-01 FR-GOV-004) | Governance Service | Authorization, Audit |
| `OfficerPositionUpdated` | A position’s title, keys or term changed | Governance Service | Authorization, Audit |
| `OfficerPositionArchived` | Position retired; sitting appointments end with it | Governance Service | Authorization, Audit |
| `ComplianceIssueFlagged` | FR-GOV-036 dashboard rule fires | Governance Service (scheduled) | Notification (officers) |

## Run & Event Management Events

| Event | Trigger (Chapter 22 state) | Producer | Consumers |
|---|---|---|---|
| `RunCreated` | A.3 (Draft) | Run Service | Audit, RunCapsule (bootstraps FR-CAPSULE-001) |
| `RunScheduled` | A.3 Draft → Scheduled | Run Service | Notification, Search Index, Calendar |
| `HareAssigned` | FR-RUN-003 | Run Service | Notification, Audit |
| `RunPlanningLocked` | A.3 (planning lock, FR-RUN-005) | Run Service | Audit |
| `TrailHidden` | A.3 → Trail Hidden (mirrors A.4) | Run Service / Trail Service | Audit |
| `TrailReleased` | A.3 → Trail Released / A.4 Hidden → Released | Trail Service | Notification, RunCapsule, Audit |
| `CheckInOpened` | A.3 → Check-In Open | Run Service | Notification |
| `ParticipantCheckedIn` | Participation created/updated | Run Service | Passport, RunCapsule, Notification (officer view) |
| `RunStarted` | A.3 → Live Run | Run Service | Notification, RunCapsule |
| `RunPaused` / `RunResumed` | A.3 Live Run sub-state | Run Service | Notification (safety-critical, may bypass Quiet Hours per FR-NOT-006) |
| `RunEnded` | A.3 Live Run → Circle | Run Service | RunCapsule, Notification |
| `CircleSkipped` | BR-RUN-005 exception path | Run Service | Audit (requires reason) |
| `RunArchived` | A.3 → Archived | Run Service | RunCapsule (finalization), Search Index, Audit |
| `RunCapsuleCreated` | Automatic, mirrors `RunCreated` | RunCapsule Service | Search Index |
| `RunUpdated` | Run details edited (FR-RUNPLAN-015); payload lists changed fields | Run Service | Notification (venue/time changes), Search Index, Audit |
| `HareRemoved` | FR-RUN-003 hare assignment ended | Run Service | Notification, Audit |
| `RunPlanningStarted` | A.3 Scheduled → Planning | Run Service | Audit |
| `RunCancelled` | A.3 → Cancelled (D22), reason required | Run Service | Notification, Search Index, RunCapsule, Audit |
| `RunRsvpChanged` | FR-RUNPLAN-007 RSVP set or withdrawn (hasher or guest) | Run Service | Notification (organizer attendance forecast), RunCapsule |
| `HareOffered` | D44: a member volunteers to hare an un-hared run | Run Service | Notification (officers), Audit |
| `HareOfferAccepted` | D44: officer accepts; lands through the same path as `HareAssigned` | Run Service | Notification (offerer), Audit |
| `HareOfferDeclined` | D44: officer declines, reason optional | Run Service | Notification (offerer), Audit |
| `HareOfferWithdrawn` | D44: the offerer withdraws before a decision | Run Service | Audit |
| `RunHareReminderIssued` | D45 scheduled sweep; payload `stage` is `no-hare-soon`, `no-hare-urgent` or `no-trail-planned`, and the event log itself is the idempotency check | Run Service (scheduled, actor SYSTEM) | Notification |
| `GuestRegistered` | D2 guest profile created with consent | Run Service | Notification, Audit |
| `GuestProfileClaimed` | D2 follow-up: a guest's run history links to the account that just proved it owns that email | Identity Service | Audit |
| `ParticipantCheckInReverted` | Attendance correction before archive (BR-RUN-008) | Run Service | Passport, RunCapsule, Audit |
| `CircleRecordUpdated` | FR-CIRCLE-003/007/010 songs, announcements or notes recorded | Run Service | RunCapsule |
| `AwardRecorded` / `AwardRemoved` | FR-CIRCLE-006/008 award or down-down recorded, or corrected before archive | Run Service | Passport, RunCapsule, Audit (removal) |
| `CircleClosed` | A.3 Circle → Reporting (FR-CIRCLE-012) | Run Service | Notification (scribe), RunCapsule |
| `EventCreated` / `EventPublished` | A.7 Draft → Planning/Registration Open | Event Service | Notification, Search Index |
| `RegistrationOpened` / `RegistrationClosed` | A.7 | Event Service | Notification |
| `VolunteerAssigned` / `VolunteerConfirmed` | Event/Run volunteer workflow | Event Service | Notification (grouped per FR-NOT-005) |
| `EventCompleted` / `EventArchived` | A.7 | Event Service | RunCapsule (child runs), Search Index |

## Trail Events

| Event | Trigger (Chapter 22 A.4) | Producer | Consumers |
|---|---|---|---|
| `TrailCreated` | Idea/Draft | Trail Service | Audit |
| `TrailLocked` | Locked | Trail Service | Audit |
| `TrailReviewCompleted` | Review → Locked | Trail Service | Audit |
| `DigitalChalkPlaced` / `DigitalChalkRemoved` | FR-TRAIL edits | Trail Service | Audit (deleted symbols retained per BR-TRAIL-007) |
| `TrailRevised` | Any planning edit | Trail Service | Audit (TrailRevision created) |
| `TrailWentLive` | A.4 Released → Live when the run starts | Trail Service | RunCapsule |
| `TrailCompleted` | Live → Completed | Trail Service | RunCapsule, Search Index |
| `TrailArchived` | → Historic Trail | Trail Service | Search Index, Audit |

## Story & Capsule Events

| Event | Trigger (Chapter 22 A.5/A.6) | Producer | Consumers |
|---|---|---|---|
| `StoryAssetCollected` | Automatic collection (FR-STORY-001) | Scribe Service | RunCapsule |
| `StoryAssetCreated` | Manual Scribe entry (FR-STORY-002) | Scribe Service | RunCapsule |
| `TrailReportDraftCreated` | A.5 Draft | Scribe Service | Audit |
| `TrailReportAIDraftGenerated` | FR-STORY-007 | Scribe Service (AI) | Audit (must carry AI-assisted flag, never auto-published) |
| `AiDraftRequested` | FR-STORY-007: an editor asks for a draft; a `PENDING` `AiSuggestion` is created and `report.body` is untouched. This is what the code emits in place of `TrailReportAIDraftGenerated` above | Scribe Service | Audit (carries the AI-assisted flag) |
| `AiDraftAccepted` | BR-SCRIBE-005: a human accepts or partially accepts the suggestion; only now does `report.body` change. `actorId` is the human | Scribe Service | Audit |
| `AiDraftRejected` | BR-SCRIBE-005: a human discards the suggestion | Scribe Service | Audit |
| `TrailReportSubmittedForReview` | A.5 Scribe Editing → Review | Scribe Service | Notification (reviewers) |
| `TrailReportPublished` | A.5 → Published | Scribe Service | Notification, Passport, RunCapsule, Search Index, Audit |
| `TrailReportRevised` | Post-publication correction | Scribe Service | Audit (ReportRevision created, original preserved) |
| `TrailReportEditingStarted` | A.5 Draft → Scribe Editing | Scribe Service | Audit |
| `TrailReportReturnedToEditing` | A.5 Review → Scribe Editing (the Scribe takes it back) | Scribe Service | Audit |
| `TrailReportArchived` | A.5 Published → Archived | Scribe Service | Audit, Search Index |
| `RunCapsulePublished` | A.6 Pending Publication → Published | RunCapsule Service | Notification, Search Index, Audit |
| `RunCapsuleReadyForPublication` | A.6 Draft → Pending Publication (automatic, on run archive or Trail Report publication) | RunCapsule Service | Notification (scribe and officers) |
| `RunCapsuleSupplementAdded` | BR-CAPSULE-005 | RunCapsule Service | Search Index |
| `RunCapsuleArchived` / `RunCapsuleLegacyImported` | A.6 | RunCapsule Service | Search Index, Audit |

## Media Events

| Event | Trigger (Chapter 22 B.2) | Producer | Consumers |
|---|---|---|---|
| `MediaCaptured` | Captured (local only — not synced yet, see Offline Rules) | Client (local) | none until synced |
| `MediaUploaded` | Queued → Uploading → Processing complete | Media Service | RunCapsule, Scribe, Search Index |
| `MediaModerationRequired` | BR-RUN-012 gate | Media Service | Notification (moderators) |
| `MediaApproved` / `MediaRejected` | Moderation decision | Media Service | Notification (uploader), Audit |
| `MediaModerated` | What the code emits for a moderation decision; payload carries the outcome, so `MediaApproved`/`MediaRejected` above are the same fact split by outcome | Media Service | Notification (uploader), Audit |
| `MediaLinked` | Association to Run/Trail/Circle/StoryAsset (BR-RUN-007) | Media Service | RunCapsule |

## Social & Content Events

D41 reels, D50 follows and engagement, D51 posts. A reel and a post belong to the hasher, not the kennel. Every engagement act resolves its subject through `subject.service.ts#resolveSubject` first, so none of these events can exist for content the actor cannot see.

| Event | Trigger | Producer | Consumers |
|---|---|---|---|
| `ReelPosted` | D41: a reel is published (draft, upload, publish, as with D28) | Social Service | Feed, Search Index, Audit |
| `ReelArchived` | D41: the author archives their own reel | Social Service | Feed, Search Index |
| `ReelRemoved` | D41: a moderator removes a reel; reason required | Social Service | Feed, Search Index, Audit |
| `ReelDeleted` | D58: the author deletes their own reel; it is gone for everyone and the row stays | Social Service | Feed, Search Index, Audit |
| `ReelPinned` | D58: the author pins a reel to their profile; it stops expiring and leaves the feeds | Social Service | Feed, Search Index, Audit |
| `ReelUnpinned` | D58: the author unpins a reel; it goes back to the 24 hours it started with | Social Service | Feed, Search Index, Audit |
| `PostPublished` | D51: a post is published; its audience (D57) is its own `visibility` narrowed by its author's profile, and is not carried on the event | Social Service | Feed, Search Index, Audit |
| `PostArchived` | D51: the author archives their own post | Social Service | Feed, Search Index |
| `PostRemoved` | D51: a moderator removes a post; reason required | Social Service | Feed, Search Index, Audit |
| `HasherFollowed` / `HasherUnfollowed` | D50: a follow is toggled. Despite the name this also records kennel follows: `aggregateType` is `Kennel` and the payload `targetType` says which. A follow grants no membership, no vote and no authority | Social Service | Feed (Following scope), Audit |
| `FollowRequested` / `FollowRequestCancelled` | D57: somebody asked to follow a locked profile, or withdrew the ask | Social Service | Notification (the person asked) |
| `FollowRequestApproved` | D57: the hasher said yes, or opened their profile to everybody and let the waiting in (`actorId` null, `reason` `profile-opened`) | Social Service | Notification (the person who asked), Feed |
| `FollowRequestDeclined` / `FollowerRemoved` | D57: a request was declined, or a follower removed. Nobody is told | Social Service | Audit |
| `ContentLiked` / `ContentUnliked` | D50: a like is toggled on any `SubjectType` | Social Service | Feed (counts) |
| `ContentCommented` | D50: a comment or reply is posted | Social Service | Notification (subject owner), Feed (counts) |
| `ContentCommentWithdrawn` | D50: the author takes their own comment down | Social Service | Feed (counts) |
| `ContentCommentRemoved` | D50: a moderator removes a comment; reason required | Social Service | Feed (counts), Audit |
| `ContentReshared` / `ContentReshareWithdrawn` | D50: a reshare, with an optional quote, is made or withdrawn | Social Service | Feed |
| `ContentMentioned` | D59: words newly name one or more hashers with @username; one event per publish or edit, naming only the newly mentioned | Social Service | Notification |
| `HasherBlocked` / `HasherUnblocked` / `HasherMuted` / `HasherUnmuted` | D60: a hasher blocks, mutes, or undoes either | Social Service | Notification (suppression), Feed |
| `PhotoTagRequested` / `PhotoTagApproved` | D60: a hasher asks to tag another in a photo; the tagged hasher says yes | Social Service | Notification |
| `PollVoted` | D60: a hasher answers, or changes their answer to, a poll on a post | Social Service | None yet |

## Notification Events

| Event | Trigger (Chapter 22 A.11) | Producer | Consumers |
|---|---|---|---|
| `NotificationEvaluated` | Created → Evaluated | Notification Service | (internal — feeds FR-NOT-010 explainability) |
| `NotificationDelivered` | → Delivered | Notification Service | Analytics |
| `NotificationRead` | → Read/Acknowledged | Client | Analytics |

Note: `NotificationEvaluated`/`Delivered`/`Read` are themselves consumers-of-events for nearly every other event in this registry — Notification is the single largest consumer across the whole table and is omitted from repeated mention in every row above only for brevity; treat "Notification" in any Consumers column as "subject to `CODEX/ARCHITECTURE-RULES.md` Event Architecture Rules and the kennel's own notification configuration (BR-RUN-013: notifications only for events the kennel has enabled)."

## Evidence & Audit Events

| Event | Trigger | Producer | Consumers |
|---|---|---|---|
| `EvidenceRecordCreated` | Any FR-*-Evidence reference across annexes | Evidence Service | Audit, AI (source citation) |
| `AuditEntryRecorded` | Meta-event: created alongside nearly every event above that touches a governed or historical entity | Audit Service (subscribes to the bus) | (terminal — Audit is a consumer of consumers) |

---

# Consumer Responsibility Matrix

| Consumer | Subscribes to | Notes |
|---|---|---|
| Notification Center | Any event with a configured notification rule (BR-RUN-013) | Applies Chapter 22 A.11 attention intelligence before delivery; grouping per FR-NOT-005. |
| Audit Log | Any event touching a governed entity (Membership, RoleAssignment, Governance, Trail, TrailReport, RunCapsule, Kennel) | Immutable, append-only; never the sole record — AuditLog references the DomainEvent, it does not replace it. |
| Search Index | Any event that changes discoverable content (Kennel, Run, TrailReport, RunCapsule, Media, Person public profile) | Permission-aware indexing per Annex 08Q; must respect privacy settings at index time, not only query time. |
| Hash Passport | `MembershipApproved`, `ParticipantCheckedIn`, `HareAssigned`, `TrailReportPublished`, and other milestone-relevant events | Derives PassportStamp/Milestone; never the event's producer. |
| Run Capsule Assembly | Nearly every Run/Trail/Story/Media event scoped to a given Run | Continuous assembly per FR-CAPSULE-002; this is the most event-dense consumer in the platform. |
| AI Platform | Story/Report events (for drafting assistance), Evidence events (for citation), Search events (for discovery) | Per AI Rules in `CODEX/ARCHITECTURE-RULES.md`: AI must not itself produce events that register attendance, override permissions, publish reports, or modify governance. AI-authored suggestions are always represented as a flagged sub-state (Chapter 22 A.5) consumed by a human before the human's action produces the real event. |

---

# Event Ordering, Consistency & Idempotency

- Events are ordered per-aggregate (`aggregateId`) — the platform guarantees a consumer sees `RunCreated` before `RunPublished` for the same Run, but makes no cross-aggregate ordering guarantee (e.g., no guarantee `MembershipApproved` arrives before `RunPublished` just because they happened in that order in one officer's session).
- Consumers must be idempotent against redelivery — an event may be delivered more than once (at-least-once delivery is the assumed default until Phase 2 selects a concrete message transport).
- State transitions that Chapter 22 marks as invalid (e.g., `Published → Draft`) must never have a corresponding event emitted; the producer rejects the action before any event is created.

---

# Offline & Delayed Sync Event Rules

Per Chapter 22 Part B and `CODEX/ARCHITECTURE-RULES.md` Offline And Sync Rules:

- An action taken while a device is offline does **not** emit a domain event at the moment the user performs it. The event is emitted only when the queued action reaches the Chapter 22 B.1 `Synced` state on the server.
- `occurredAt` reflects server confirmation time by default. Where a kennel's release policy explicitly allows offline provisional trail release (Chapter 22 B.3), the event payload must carry both the client-asserted local time and the server-confirmed `occurredAt`, and any discrepancy is separately recorded via `AuditEntryRecorded` for security review — this is a deliberate exception to "one event, one timestamp" and should not be generalized to other event types without similar justification.
- Media follows its own queue (Chapter 22 B.2): `MediaCaptured` is a local-only marker, not a bus event; `MediaUploaded` is the first point this domain becomes visible to any other consumer.
- Conflict resolution (Chapter 22 B.1) that changes a previously-queued value before sync completes does not emit an event for the discarded intermediate value — only the resolved, synced value produces an event.

---

# AI Event Boundaries

Restating and making explicit, for this chapter's purposes, the AI Rules already stated in `CODEX/ARCHITECTURE-RULES.md`:

- AI may **consume**: Story/Report events (to draft), Search/Evidence events (to explain and cite), Notification events (to summarize).
- AI may **produce**: only advisory artifacts (`TrailReportAIDraftGenerated` / `AiDraftRequested`, AI governance suggestions per FR-GOV-040) that require a human action to become a "real" event elsewhere in this registry (`TrailReportPublished`, `MotionResolved`, etc.).
- AI must never be the `actorId` on `MembershipApproved`, `ParticipantCheckedIn`, `RoleAssigned`, `TrailReportPublished`, `RunCapsulePublished`, or any governance/attendance/publication event. The `actorId` on those events is always a human Identity or `system` for a rule-based automatic transition (e.g., `RoleDelegationExpired`), never an AI agent.

---

# Gaps Carried Forward

- This registry is Codex-inferred by mapping Chapter 22 states and Chapter 23 entities onto the event conventions already established in `CODEX/ARCHITECTURE-RULES.md`. No Chapter 8 annex names these events explicitly (they describe triggers in prose: "shall generate notifications," "shall create an audit record"). If the referenced conversation's original Chapter 24 draft becomes available, it should be diffed against this registry.
- A concrete message transport (e.g., outbox pattern, message queue choice) is Phase 2/3 technical specification work, not addressed here.
- Payload schemas per event (beyond the shared envelope) are not defined at this stage — they belong with the OpenAPI/Prisma work in Phase 2.

---

# Completion Criteria

This chapter is complete when:

- Every state transition in Chapter 22 has a corresponding event in this registry.
- Every event names a single producer and its known consumers.
- Offline/sync timing rules are explicit for events whose trigger may occur while a client is disconnected.
- AI event-production boundaries are explicit and consistent with `CODEX/ARCHITECTURE-RULES.md`.
