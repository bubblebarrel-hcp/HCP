# HCP Decision Log

Document ID: HCP-DECISION-LOG

Status: Active

Date: 2026-08-10

---

# Format

Each decision should include:

- Date
- Status
- Decision
- Rationale
- Source
- Consequences

---

# Decisions

## 2026-08-10 - HCP remains the scope

Status: Active

Decision: This handoff applies only to HCP, the Hash Community Platform.

Rationale: The referenced conversation explicitly narrowed the work back to HCP and deferred broader Bubble Barrel Engineering Standard or Bubble Barrel OS work to a later session.

Source: Referenced conversation and current user request.

Consequences: Codex must not generalize this repository into a cross-product operating system unless explicitly instructed later.

---

## 2026-08-10 - Product Bible is authoritative

Status: Active

Decision: Existing Product Bible documentation is the primary source of truth.

Rationale: The user asked Codex not to invent requirements where documented requirements exist.

Source: Current user request.

Consequences: Implementation must trace behavior to Product Bible docs or log an explicit gap.

---

## 2026-08-10 - Repository is currently documentation-first

Status: Active

Decision: Treat `C:\Users\Okonk\Pictures\HCP` as a documentation project until a standalone implementation repository or app code is provided.

Rationale: Inspection found no app manifests, Prisma schema, Express backend, Expo app, Next.js app, or tests in the HCP folder.

Source: Local repository inspection.

Consequences: Roadmap starts with technical specification before code scaffolding.

---

## 2026-08-10 - Target stack preserved

Status: Active

Decision: Preserve React Native/Expo, Next.js, Express, PostgreSQL, Prisma, and OpenStreetMap as the target implementation direction.

Rationale: These choices were explicitly included in the user handoff request.

Source: Current user request.

Consequences: Future implementation should not switch stacks casually.

---

## 2026-08-10 - No direct messaging initially

Status: Active

Decision: One-to-one DMs are out of initial scope.

Rationale: The user explicitly preserved "no DMs initially" as part of the HCP vision.

Source: Current user request.

Consequences: Communication features must start with announcements, notifications, workflow communication, and possibly scoped channels, not private chat.

---

## 2026-08-10 - Chapters 22-24 are not canonical files yet

Status: Superseded by "Chapters 22-24 added to repository" below.

Decision: Chapters 22-24 must be added to the repository before they are treated as implementation authority.

Rationale: Conversation previews include drafts for Chapters 22-24, but no matching files were found in the inspected HCP folder.

Source: Local repository inspection and referenced conversation preview.

Consequences: Phase 1 prioritizes adding the Interaction State Model, Domain Model, and Event-Driven Architecture documents.

---

## 2026-08-10 - Chapters 22-24 added to repository, drafted fresh rather than from the referenced conversation

Status: Active

Decision: Chapters 22 (Interaction State Model), 23 (Domain Model and Entity Relationships), and 24 (Event-Driven Architecture and Domain Events) were added to `product-Bible/` by reading and consolidating the existing Chapter 8 annexes (08C, 08D, 08E, 08F, 08G, 08H, 08K, 08L, 08M, 08P) and `CODEX/ARCHITECTURE-RULES.md`, rather than transcribing the referenced prior conversation's drafts (which were not available in this session).

Rationale: User explicitly chose "draft fresh from existing Bible" over "paste the prior conversation" when asked how to source these chapters.

Source: Current user request.

Consequences: If the original referenced-conversation drafts for Chapters 22-24 surface later, they should be diffed against these files rather than assumed identical. Every non-obvious inference made while drafting is flagged inline in each chapter's own "Contradictions & Gaps" / "Gaps Carried Forward" section rather than only here.

---

## 2026-08-10 - Membership status vocabulary reconciled

Status: Active

Decision: Annex 08L-01's org-level membership states (Applicant, Pending Review, Active, Visiting Member, Honorary Member, Inactive, Suspended, Archived) and Annex 08D's member-facing statuses (Pending, Active, Suspended, Inactive, Resigned, Removed, Archived) were reconciled in Chapter 22 (A.2) by treating Visiting Member/Honorary Member as membership **types** (already separately modeled in 08D FR-MEMBER-003), not states, and adopting 08D's Resigned/Removed as the terminal states.

Rationale: The two annexes never explicitly cross-referenced each other and use overlapping but non-identical vocabularies. A single canonical status enum is required before any Prisma schema can be written.

Source: Codex inference during Chapter 22 drafting, per Chapter-8 source annexes.

Consequences: Phase 2 Prisma schema should use Chapter 22 A.2's reconciled enum. If this reconciliation is wrong, Chapter 22 A.2 and this entry should be revised together.

---

## 2026-08-10 - Communication Hub direct messaging marked out-of-MVP, not removed from the Bible

Status: Active

Decision: Annex 08O (Communication Hub) lists Direct Messaging / Private Chat among its supported scope. Chapters 22-24 and the domain model treat this as Future/out-of-MVP, consistent with the existing "No direct messaging initially" decision above, rather than deleting or editing Annex 08O itself.

Rationale: The handoff and `CODEX/ARCHITECTURE-RULES.md` already establish no-DM-in-MVP as settled; Annex 08O appears to describe long-term platform scope rather than MVP scope, consistent with how other annexes (e.g., 08P-02) separately mark items "future."

Source: Codex inference during Chapter 23 (Part G) drafting.

Consequences: No Direct/Private Conversation entity exists in Chapter 23's MVP schema or Chapter 24's MVP event registry. Annex 08O is left as-is since it already describes the platform's eventual, not immediate, scope.

---

## 2026-08-10 - Chapter 21 journey status normalized from Approved to Draft

Status: Active

Decision: Journeys J-002 through J-010 were marked `Status: Approved` while their parent chapter (README, 21-01 through 21-04) and every implementing task flow (TF-001 through TF-010) are marked `Status: Draft`. No approval record exists anywhere in the repository substantiating the "Approved" status. All nine journeys were changed to `Status: Draft` to match the parent chapter and their task flows; J-001 (which had no Document ID / Status / Version block at all) was given one, also `Draft`, and J-002's `Journey ID` field was renamed to `Document ID: HCP-JS-002` to match the naming convention used by J-003 through J-010.

Rationale: A Product Bible section should not read as more finalized than the chapter that contains it or the task flows that implement it, absent an explicit sign-off record. This is a documentation-consistency normalization, not a judgment that the journey content itself is wrong.

Source: Codex inference during Chapter 21 Phase 1 normalization pass, per the roadmap's "Normalize Chapter 21 journey and task-flow status metadata" goal.

Consequences: If the user has an actual approval record for these journeys (e.g., from the referenced prior conversation) that this session did not have access to, the status should be reverted to Approved and this entry corrected.

---

## 2026-08-10 - TF-003.2 marked Superseded rather than deleted

Status: Active

Decision: The legacy nested task flow `task-flows/TF-003-Join-Run/TF-003.2-Join-Run.md` is marked `Status: Superseded by TF-003-Join-Run.md` rather than deleted. A journey-to-task-flow traceability matrix (`21-05-Journey-Task-Flow-Traceability.md`) was added recording that TF-003.2 contains Database Changes, Security, and QA Test Cases detail not yet present in the canonical TF-003, to be merged in Phase 2.

Rationale: TF-003.2 predates and duplicates TF-003 but contains implementation detail the canonical file lacks; deleting it would lose that detail rather than preserve it for later merge, contradicting the Bible-wide principle (repeated across nearly every Chapter 8 annex) that historical/superseded content should be marked, not destroyed.

Source: Codex inference during Chapter 21 Phase 1 normalization pass, per the roadmap's "review and mark the legacy nested task flow" goal.

Consequences: `CODEX/TODO.md` carries a follow-up to merge TF-003.2's extra sections into TF-003 during Phase 2.

---

# Stakeholder Decisions (Approval Brief Section 5)

Source for all entries below: product owner answers to `Stakeholder-Approval/HCP-Stakeholder-Approval-Brief.md` Section 5, given 2026-09-14. Where the answer needed interpretation, the interpretation is stated and marked for confirmation.

## 2026-09-14 - D1: No waitlisting; build to production, single ready release

Status: Active

Decision: Waitlisting is not built. HCP is built to production quality and published as a complete, ready app when done, rather than shipped as an early MVP followed by increments.

Rationale: Product owner answer to Brief Q1.

Consequences: Join-run logic has no waitlist queue: when capacity is set and reached, joining is rejected. The roadmap's "MVP" phases are treated as internal build milestones, not public releases; nothing ships publicly until the release scope is complete. The exact release scope (which Phase 5 items are in) still needs confirming — see TODO.

---

## 2026-09-14 - D2: Guest registrations allowed

Status: Active

Decision: A person without an HCP account may register for a run as a guest.

Rationale: Product owner answer to Brief Q2.

Consequences: Participation must support a guest record not linked to an Identity (minimum contact fields, consent capture). Guests must be convertible/claimable into a full Identity later so their attendance history carries over to their Hash Passport. Guests never receive hidden trail data through member-only channels (see D6).

---

## 2026-09-14 - D3: Run privacy is set by the hosting kennel's admin

Status: Active

Decision: Run visibility (public / members-only / invite-only) is controlled by the administrator of the kennel hosting the run, not chosen freely by the hare and not a global platform default.

Rationale: Product owner answer to Brief Q3. Consistent with "local kennel identity comes first."

Consequences: Kennel settings carry a default run visibility set by the kennel admin; runs inherit it. Changing a run's visibility is a kennel-admin permission. Interpretation to confirm: hares cannot override visibility unless the kennel admin delegates that permission.

---

## 2026-09-14 - D4: Kennel verification requires a mismanagement of at least 4-5 members

Status: Active — exact threshold to confirm

Decision: A kennel is verified only when it has a mismanagement (committee/officer body) of at least 4-5 members registered on HCP.

Rationale: Product owner answer to Brief Q4.

Consequences: Verification checks the count of active OfficerAppointments (distinct Identities) in the kennel. Implemented as a platform setting, defaulting to 4, until the owner confirms 4 or 5. Unverified kennels remain usable but are not shown as verified in search.

---

## 2026-09-14 - D5: Full bio data collected; profile shows hash handle

Status: Active

Decision: Registration collects full biodata of the individual. The public-facing profile shows the hash handle, not legal identity details.

Rationale: Product owner answer to Brief Q5. Aligns with the PublicProfile/PrivateProfile split in Chapter 23 Part A.

Consequences: Biodata lives in Person/PrivateProfile (sensitive fields encrypted, privacy-law consent captured); PublicProfile displays the hash handle. Open point: Hash tradition often names a hasher only after several runs — the display fallback for a hasher with no hash handle yet needs confirming (see TODO).

---

## 2026-09-14 - D6: Trail release is signalled to the hosting kennel's members

Status: Active — offline behavior interpretation to confirm

Decision: When a trail is released, the platform sends a release signal to the members of the kennel hosting the run.

Rationale: Product owner answer to Brief Q6.

Interpretation: Release stays server-authoritative. Devices do not self-unlock offline for manual or location-based release; they unlock when they receive the release signal (the default proposed in Chapter 22 B.3). Delivery is push notification plus in-app sync. To confirm: whether an SMS fallback should reach members with no data connection, and whether registered participants who are not members of the hosting kennel (visitors, guests) also receive the signal.

Consequences: TrailReleased event consumer fans out to hosting kennel members. Chapter 22 B.3 default is adopted pending the two confirmations above.

---

## 2026-09-14 - D7: AI features at launch

Status: Active

Decision: AI features ship in the launch release.

Rationale: Product owner answer to Brief Q7.

Consequences: AI assistance (report drafting, summaries, Hash term explanations, search help) moves from Phase 5 into launch scope. All AI rules in `CODEX/ARCHITECTURE-RULES.md` apply: AI never publishes, registers attendance, changes governance, or leaks hidden trail data. AI provider and data policy must be specified in Phase 2.

---

## 2026-09-14 - D8: No direct messaging at launch — confirmed

Status: Active

Decision: Confirmed: no one-to-one private messaging at launch. Communication is announcements, run updates, notifications, and group/committee channels.

Rationale: Product owner answer to Brief Q8; converts the earlier assumed decision into an explicit sign-off.

Consequences: No change to Chapter 23 Part G or the Chapter 24 registry.

---

# Follow-up Decisions (2026-09-14, second round)

Source: product owner answers to the follow-up questions raised by D1-D8.

## 2026-09-14 - D9: Launch scope is the full platform

Status: Active

Decision: The single production release includes all domains: Run Capsule, Hash Passport and Hash DNA, search, Global Hash Atlas, Events/Interhash, and elections/voting, in addition to the Phase 4 core.

Consequences: Roadmap Phase 5 items are launch scope. Build order stays core-first, but nothing is deferred past launch.

## 2026-09-14 - D10: Verification threshold is 4 (resolves D4)

Status: Active

Decision: A kennel needs at least 4 registered mismanagement members to be verified. Stored as a platform setting, default 4.

## 2026-09-14 - D11: Un-named hashers display as "Just [first name]" (resolves D5)

Status: Active

Decision: A hasher without a hash handle is shown publicly as "Just [first name]", following Hash custom.

## 2026-09-14 - D12: Trail release alert channels and audience (resolves D6)

Status: Active

Decision: No SMS for now. Trail release alerts go by push notification and email. Recipients are members of the hosting kennel plus visitors and guests registered for the run (guests by email, since they have no app account).

Consequences: Devices still do not self-unlock offline for manual/location release (Chapter 22 B.3 default). Push and email providers are required at launch.

## 2026-09-14 - D13: Run visibility changes by hares only via delegation (resolves D3 follow-up)

Status: Active

Decision: Only the hosting kennel admin changes run visibility, unless the admin delegates that permission to a hare.

## 2026-09-14 - D14: Claude is the AI provider (resolves D7 follow-up)

Status: Active

Decision: AI features use Claude via the Anthropic API.

## 2026-09-14 - D15: MapLibre + OpenStreetMap tiles on mobile and web

Status: Active

Decision: Mapping uses MapLibre (MapLibre GL JS on web, MapLibre React Native on mobile) with OpenStreetMap-based tiles.

## 2026-09-14 - D16: Standalone repository and local database

Status: Active

Decision: `hcp` is its own Git repository (the user makes commits). Local development uses PostgreSQL database `hcp_db` on localhost:5432.

## 2026-09-14 - D17: Project layout

Status: Active

Decision: Separate apps with no npm workspaces: `apps/api` (Express + Prisma), `apps/web` (Next.js public site), `apps/admin` (Next.js kennel/committee/platform admin), `apps/mobile` (Expo). Each installs independently with npm. Shared types are copied/generated per app rather than a workspace package.

Rationale: Matches the user's standard project scaffold; supersedes the `packages/shared` workspace idea raised in conversation.

## 2026-09-14 - D18: Scaffold implementation choices

Status: Active

Decision:
- Local ports are API 5010, web 3010, admin 3011, so HCP runs alongside other local projects on 5000/3000/3001.
- Web and admin use different auth cookie names (`hcp_*` vs `hcp_admin_*`). Browsers do not isolate cookies by port, so identical names on localhost would overwrite each other's sessions.
- `User` is the Chapter 23 Identity and also carries authentication. `PersonProfile` holds the private biodata (D5). The platform role enum is only USER/ADMIN; all kennel authority is contextual (`RoleAssignment`, `OfficerAppointment`).
- Chapter 23's `GovernanceAuditEntry` is folded into `AuditLog` (with `kennelId`) rather than a separate table.
- Election ballots are secret: who voted (`ElectionVoterRecord`) is stored separately from how they voted (`ElectionBallot`).
- Domain events are written to a `DomainEvent` table in the same transaction as the change (transactional outbox). No consumer runs yet.
- `MembershipStatus` adds `REJECTED` so Chapter 24's `MembershipRejected` has a terminal state.
- Email verification (FR-AUTH-002) is not enforced until an email provider exists; tracked in TODO.

Rationale: Codex inference while scaffolding, where the Bible and D1–D17 were silent.

Consequences: Revisit the email verification and outbox items before launch.

## 2026-09-15 - D19: Kennel permission resolution

Status: Active

Decision:
- Kennel authority is resolved on every request from the database, in this order: platform admin override; an ACTIVE membership is required for everything else; a `KENNEL_ADMIN` role assignment grants every kennel permission; an officer position grants the keys in its `permissions`; a live delegation grants its keys only while the delegator still holds them. Full rules: `CODEX/PERMISSION-MATRIX.md`, implemented in `apps/api/src/services/permission.service.ts`.
- Permission keys are dotted strings (`membership.review`, `membership.suspend`, ...) stored on `OfficerPosition.permissions` and `Delegation.permissions`. There is no platform-wide default profile for officer positions (BR-GOV-001).
- Suspended or inactive members hold no kennel authority, even when they hold an officer appointment.
- Platform admins may act in any kennel; those actions are audited with `AuditLog.policyRef = platform-admin`. Every audited kennel action records how it was authorized in `policyRef`.
- Nobody decides on their own membership, whatever authority they hold (separation of duties, 08L-05).
- Seeing a trail before release is not a kennel permission: only the run's hares, plus an explicit, audited override.

Rationale: Annex 08L-04 lists governance roles and a coarse matrix but no resolution algorithm. Codex inference.

Consequences: Kennels need a UI to edit position permissions, appoint officers and grant delegations (TODO).

## 2026-09-15 - D20: Membership request and decision rules

Status: Active

Decision:
- A request enters `PENDING_REVIEW` directly. `APPLICANT` is kept for future multi-step applications (sponsors, interviews, FR-GOV-003).
- A hasher holds at most one open membership (Applicant, Pending Review, Active, Inactive, Suspended) per kennel, enforced inside a serializable transaction. Closed rows remain as history.
- Hashers choose Full, Associate, Visiting or Virgin when asking to join. Honorary, Life, Guest and Committee are set by officers on approval.
- After a rejection or removal the hasher waits `membership.reapplyCooldownDays` (default 30) before asking the same kennel again. Resigned members may rejoin immediately.
- Kennels in Pending Verification accept requests, since they need members to reach D10. Hidden kennels require an invitation (not built yet).
- Suspended members cannot resign. Removal, like resignation, requires officer and kennel roles to be handed over first (FR-MEMBER-014).
- A membership that ends (resigned, removed, rejected) clears the user's home kennel if it was that kennel; the membership row keeps the history.
- Officers see only public identity (hash handle or "Just <firstName>") in member lists (D5/D11).

Rationale: Annex 08D and Chapter 22 A.2 where they are silent. Codex inference.

Consequences: Withdrawing a pending request needs a Chapter 24 event first. Suspension end dates are stored but not lifted automatically until background jobs exist. Officers and hashers are not notified until the outbox has consumers and email/push providers exist.

## 2026-09-15 - D21: Run authority

Status: Active

Decision:
- `run.manage` (kennel admin, officer position or delegation) creates runs, chooses and changes hares, renumbers, publishes (Draft → Scheduled), skips the Circle, archives and cancels. It also operates every run of the kennel.
- A run's hares (`RunHare`, with history in `RoleAssignment` HARE / CO_HARE scoped to the run) operate their own run: edit details while Draft, Scheduled or Planning; advance the run day (start planning, hide and release the trail, open check-in, start, pause, resume, end, close the Circle); check people in and correct attendance; add walk-in guests; record the Circle.
- Changing a run's visibility away from the kennel default needs `run.visibility.change` (D3, D13). Kennel admins hold it; hares only through a delegation.
- Hares must be active members of the hosting kennel, with exactly one lead. Visiting hares are a follow-up.
- `optionalAuth` now rejects a present-but-expired token with 401 so clients refresh it, instead of serving the anonymous view to a signed-in hasher.

Rationale: Annex 08E-06's permission matrix plus D3/D13 and the PERMISSION-MATRIX resolution rule. Codex inference where 08E-06 lets hares "create runs" before any hare exists.

## 2026-09-15 - D22: Run lifecycle, cancellation and the capsule

Status: Active

Decision:
- Runs move through Chapter 22 A.3 one step at a time via named actions; skipping steps is rejected. Pause and resume are a sub-state of Live, each pause recorded in `RunPause` with a reason.
- Stakeholder decision: runs can be **Cancelled** before they go live, with a required reason. Cancelled is terminal, keeps RSVPs, and stays visible. Chapter 22 A.3 updated.
- Publishing requires at least one hare (BR-RUN-003) and a future start time (BR-RUN-010).
- Ending the run opens the Circle record; closing or skipping the Circle moves the run to Reporting; archiving locks attendance (BR-RUN-008) and snapshots the lifecycle timeline into the Run Capsule (FR-CAPSULE-003).
- The Run Capsule is created with the run (Planned) and follows it: Preparing when published, Live when started, Draft when ended. Pending Publication and Published wait for trail reports.
- The trail steps (hide, release) are run-level state changes for now. They carry no route data until Trail Studio exists, so they cannot leak a trail.

Rationale: Chapter 22 A.3/A.6, Annex 08E-01/04/05 and stakeholder answer on cancellation.

## 2026-09-15 - D23: RSVP, guests and check-in

Status: Active

Decision:
- RSVP (Going, Maybe, Not going, withdraw) is open from Scheduled until the run starts. No waitlist (D1): capacity counts Going hashers and guests, and Going is refused when full.
- Members of the hosting kennel may RSVP to any run they can see. Non-members may RSVP only to PUBLIC runs that allow visitors. A suspended member cannot RSVP or check in at their own kennel. Visitor status and home kennel are snapshotted on the first RSVP (BR-RUN-009).
- Stakeholder decision: a guest registers with first name, last name, email and consent; phone is optional. Guests register themselves only for PUBLIC runs that allow guests, while RSVPs are open. Hares and officers may add walk-in guests and check them in at the venue, bypassing capacity. Guest profiles are reused when name and email match an unclaimed profile. Claiming guest history on sign-up is a follow-up.
- Check-in: hashers check themselves in while Check-In Open or Live (method MANUAL); hares and officers check others in (OFFICER) and may undo a check-in until archive, audited. Walk-ins are never refused for capacity. The first check-in anywhere marks a virgin run.
- Stakeholder decision: anyone who can see a run sees the counts; the names of who is going, the Circle record and the run timeline are shown to members of the hosting kennel, the run's hares and officers.
- Kennel-configurable Circle privacy (FR-CIRCLE-014), Circle attendance (FR-CIRCLE-002) and disabling down-downs (FR-CIRCLE-006) are not built yet.

Rationale: Annex 08E-02/03/04, TF-003, D1, D2 and stakeholder answers on guests and name visibility.

Consequences: Guest emails are stored but not shown to anyone yet; exposing them to hares for safety needs a decision.

## 2026-09-16 - D24: HCP brand system is Orange × Black × Flour

Status: Active (supersedes the Chapter 20 forest-green-on-warm-paper palette)

Decision (stakeholder): the visual identity is built on the Hash's own character — irreverent, muddy, international, traditional — not on an outdoor-adventure green or a corporate community platform.

| Role | Colour |
| --- | --- |
| Primary brand | HCP Orange `#F4511E` |
| Primary dark | Hash Black `#171717` |
| Primary light background | Flour `#F4F1E8` |
| Secondary accent | Beer Gold `#D9A441` |
| Outdoor / trail | Trail Green `#3F6B4F` |
| Critical / error | Hash Red `#C62828` |
| Secondary text | Ash `#6B6B63` |
| Surfaces | Chalk `#FFFFFF` |

- Orange, Black and Flour are the identity. Gold, green and red are **semantic only** and never compete as brand colours; gold stays sparing (milestones, achievements, anniversaries).
- Dark mode is first-class, not an inversion: background `#111111`, surface `#1C1C1C`, Flour text, orange trails, gold beer stops.
- No literal Hash clichés in the UI (beer imagery, skulls, muddy footprints). The personality lives in microcopy, motion, icons, trail visualisation and the occasional easter egg.
- Trail visualisation gets its own language later: HCP Orange for the active trail, with distinct marks for beer stop, checkpoint, false trail, landmark and finish.

Accessibility (Codex, implementing the decision): `#F4511E` is 3.1:1 on Flour and 3.5:1 under white, so it is a **fill** colour carrying Hash Black text (5.2:1), never small text itself. Two extra tokens keep AA: `--primary-strong` (Ember `#B83A0E` light, `#FF7043` dark) for links and small orange text, and `--accent-strong` (`#7A5C14` light, Beer Gold dark) for gold text. Hash Red is lightened to `#F05545` on dark, where `#C62828` falls to 3.4:1.

Consequences: Chapter 20's palette section is rewritten. Kennels keep their own `primaryColor` for covers and avatars; HCP Orange is the fallback. The trail mark language and any brand illustration work are still to do.

## 2026-09-16 - D25: Trail Studio scope, authority and release

Status: Active

Decision:
- **Secrecy is a serialization rule, not a UI rule (BR-TRAIL-005).** `trail.service` returns two shapes: a public one (name, style, status, estimated distance and duration, terrain, release mode and time) and a secret one (route geometry, start and finish, waypoints, beer checks, chalk, notes). The secret shape reaches planners always, and everyone who can see the run only once the trail is released. Nothing else in the API selects `routeGeoJson`.
- **Authority (08F-06):** plan and edit — the trail's hares, the run's hares, or kennel officers holding `trail.manage` or `run.manage`; lock, hide and release — the lead hare or those officers; archive — officers only. A trail's hares must be hares of its run.
- **Lifecycle:** Draft → Planning → Review → Locked → Hidden → Released → Live → Completed → Archived. `Idea` and `Historic` are not used yet. Restore Draft is allowed from Locked and never from Hidden or later. Locking validates BR-TRAIL-006: a route of at least two points, a start, a finish, a hare, and a release time when the mode is Scheduled.
- **Release is server-authoritative (D6/D12, Ch.22 B.3).** Modes: Manual, Scheduled, At run start, At check-in. The condition is evaluated on the server and materialised as `releasedAt` plus a `TrailReleased` event. Opening check-in or starting a run releases the matching trails inside the run's own transaction; a Scheduled release lands lazily on the next read. A background job should take over that evaluation when the outbox exists, so alerts fire without someone loading a page.
- **Geofenced release is not built.** It needs a server-verified location check; the enum value stays, the API rejects it.
- **Deletions are soft.** Waypoints, beer checks and chalk keep `deletedAt`, and every planning edit writes an immutable `TrailRevision` with previous values (BR-TRAIL-007, BR-TRAIL-008).
- **Not built yet:** per-waypoint progressive reveal (BR-TRAIL-011), GPX import, offline pre-cached encrypted payloads (`Trail.payloadKeyEncrypted` stays unused), participant positions, trail replay and Trail DNA.

Rationale: Annex 08F, Chapter 22 A.4 and B.3, and the D6/D12 release audience.

Consequences: Release alerts stay silent until notification consumers and providers exist. Offline participation still needs the encrypted-payload work in Ch.22 B.3.

## 2026-09-16 - D26: Event outbox and the Notification Centre

Status: Active

Decision:
- **The outbox consumer runs in the API process on a 5-second timer** (`services/outbox.service.ts`), draining unpublished `DomainEvent` rows oldest-first in batches of 50. No Redis or broker yet; Chapter 24 leaves the transport open, and this is the piece to replace when HCP runs more than one API instance.
- **Delivery is at-least-once and consumers are idempotent** (Ch.24): fan-out is skipped when a notification already exists for that event id, so a replayed event never notifies twice. An event that fails five times is parked, not retried forever, and every failure is logged.
- **Only in-app notifications are delivered.** There is no push or email provider (D12 needs both), so nothing is queued on channels that cannot send; the reason is written to `Notification.evaluationReason` (FR-NOT-010). Guests registered for a run are email-only and therefore still hear nothing about a trail release: that is the visible cost of the missing provider.
- **What gets sent (v1):** membership requests to officers holding `membership.review`; membership decisions to the hasher; a new run, its cancellation and material changes (time, meeting point, visibility) to members and participants; check-in opening to participants; run paused and resumed to checked-in participants as SAFETY; and trail release to the hosting kennel's members plus everyone registered for the run (D6/D12).
- **Nobody is notified about their own action**, and a kennel that disables a category stops it for that kennel (BR-RUN-013).
- **Members control their own categories** (BR-NOT-003), except SAFETY, which cannot be switched off (BR-NOT-007).
- **Not built:** quiet hours, batching, digests, grouping, reminders, escalation, actionable notifications and analytics (FR-NOT-005 to 008, 011 to 020, 022). In-app notifications are pulled rather than pushed, so quiet hours have nothing to suppress yet.

Rationale: Annex 08P, Chapter 22 A.11, Chapter 24's consumer matrix and idempotency rules, and D12's channel decision.

Consequences: Every event already written since the platform began will be drained on first start, so the backlog lands as notifications. Email and push remain the two launch blockers for D12.

## 2026-09-16 - D27: Hash Passport is derived, not authored

Status: Active

Decision:
- **The passport is rebuilt from source tables, not incremented.** Chapter 24 makes the Passport a consumer that never produces the facts it reflects, so `rebuildPassport(userId)` recomputes stamps, milestones, places and lifetime statistics from check-ins, hare assignments and memberships. Replay is therefore harmless, and a passport that predates this code fills itself in on first read.
- **The outbox gained a second consumer.** Notifications and the passport are applied independently per event; both are idempotent.
- **Stamps (FR-PASSPORT-002):** First Hash, First Hare, First Visiting Kennel, First International Run, Red Dress Run, Charity Run, Interhash, Nash Hash, Full Moon Run. Each is awarded once, dated when it actually happened, and recorded on the hasher's identity timeline with a `PassportStampAwarded` event.
- **Milestones (FR-PASSPORT-004):** 10, 50, 100, 500 and 1000 runs, dated to the run that crossed the line.
- **Attendance means checked in**, not RSVP'd. Undoing a check-in rebuilds the passport, so a correction removes what it should.
- **Statistics with no source yet stay at zero** rather than being guessed: beer checks, photos, videos and reports written. Distance covered is derived from the estimated distance of each attended run's trail, which is honest but approximate; actual distance needs GPS tracks.
- **Sharing (FR-PASSPORT-007)** is a rotatable `shareToken` link. A shared passport shows stamps, milestones, places and statistics under the hasher's public name, and never their pinned memories or the token itself. QR codes are a follow-up.
- **Private by default:** there is no way to browse another hasher's passport without their link.

Rationale: Annex 08D section 4, Chapter 23 Part A, Chapter 24's consumer matrix.

Consequences: Rebuilds are whole-passport and run on read when stale (5 minutes); a hasher with thousands of runs will want incremental updates eventually. Beer-check, media and report statistics stay at zero until those domains exist.


## 2026-09-16 - D28: Cloudflare R2 for media, Resend for email

Status: Active

Decision:
- **Photos and media live in Cloudflare R2**, reached with the S3 API. **Bytes never pass through the API**: the client asks for an upload target, the API creates the `MediaAsset` and returns a presigned `PUT`, the client uploads directly, then confirms. Setup and environment variables are in `CODEX/PROVIDERS.md`.
- **Without R2 credentials the API falls back to local disk** (`apps/api/uploads/`, served from `/uploads/*`) through the same request/PUT/confirm path, so development and the check scripts work before a bucket exists. The fallback is development-only; production without `R2_PUBLIC_BASE_URL` stores media it cannot render.
- **Media is never orphaned** (BR-RUN-007): a `MediaLink` to a run, trail, circle or gallery is written in the same transaction as the asset. Other target types are refused until their domain exists.
- **Upload state follows Ch.22 B.2** — Queued → Uploading → Processing → Available. Whether Processing clears immediately is the kennel's `mediaModerationMode`: `IMMEDIATE` publishes at once, every other mode holds the asset as Pending until someone holding the new **`media.moderate`** permission approves it. Rejected media is hidden, never deleted, and attribution is fixed at capture (BR-CAPSULE-007).
- **Who may add media:** anyone who can see the run and either took part in it or belongs to the hosting kennel. Viewing media follows the target: if the run is invisible to you, so are its photos. Moderators additionally see what is pending.
- **Email is sent through Resend**, as a second delivery channel on the existing notification fan-out rather than a separate system. When Resend is unconfigured, nothing is queued on the channel and the notification says so (FR-NOT-010).
- **Email is on by default only for MEMBERSHIP, TRAIL_RELEASE and SAFETY.** Everything else is in-app unless the hasher turns email on. Email costs more attention than a badge does, so the default is reserved for things whose absence has a real consequence.
- **Guests are now notified** (closing D12's gap): registered guests hold no account and no in-app inbox, so for trail release and run cancellation they receive email alone, addressed to the address they consented with at registration (D23).
- **Sending happens after the transaction commits.** A slow provider never holds a database transaction open; a failed send is recorded on the `NotificationDelivery` row and the notification survives.
- **Push remains unbuilt.** D12 wants push and email at launch; email now exists, push is still the outstanding launch blocker.

Rationale: Chapter 22 B.2 (media capture states), Chapter 23 Part F, BR-RUN-007/012, BR-CAPSULE-007, D12 and D26.

Consequences: R2 needs a CORS policy allowing `PUT` from the web origins or direct uploads fail with no status code. Until a Resend domain is verified, `onboarding@resend.dev` only delivers to the account owner. Server-side transcoding, thumbnails, EXIF stripping and AI moderation are not built: `AI_ASSISTED` and `COMMUNITY_REPORTING` behave like `OFFICER_APPROVAL` today.

## 2026-09-17 - D29: Scribe Studio — who writes, who publishes, who may read

Status: Active

Decision:
- **One report per run, and the run is how you find it** (BR-SCRIBE-002). `TrailReport.runId` is unique; the API refuses a second with a readable error rather than relying on the constraint alone.
- **Who may start it:** the kennel's Hash Scribe (`ScopedRole.SCRIBE` or `ASSISTANT_SCRIBE`), an officer holding `report.publish`, or the run's own hares. Hares are included deliberately: most kennels have no appointed scribe, and the alternative is that the story never gets written. Whoever starts it becomes the Official Scribe unless an officer nominates someone else, who must be an active member.
- **Nothing to report until there is something to report on.** A draft can be started once the run is LIVE or later; publication needs the run at REPORTING or ARCHIVED (BR-SCRIBE-007 validation).
- **Lifecycle is Chapter 22 A.5 exactly:** Draft → Scribe Editing → Review → Published → Archived. Draft → Published is refused (a report must pass through human editing), and Published → Draft does not exist — corrections are revisions.
- **Drafts are private** (BR-SCRIBE-004) and invisible rather than forbidden: someone outside the editorial circle gets 404, not 403, so a draft's existence does not leak. The circle is the Scribe, assistant scribes, reviewers, and officers with `report.publish` or `run.manage`.
- **Published reports follow the run's visibility.** A public run's report is readable by anyone, including anonymously; a members-only run's report stays with the members. One rule, no new settings surface, and a report never reveals more than the run already did. BR-SCRIBE-012's per-kennel configuration is deferred, not refused.
- **Publishing is the Scribe's act or an officer's**, never an assistant's (08G-06 permission matrix). It writes a `ReportRevision` marked `isPublication`, stamps `publishedAt`, and links the report to the Run Capsule, creating the capsule if it does not exist yet (FR-PUBLISH-001).
- **Corrections create revisions with a mandatory reason** (FR-PUBLISH-003); the published text is preserved. Restoring an earlier version is an officer's act and is itself a new revision, so nothing is ever removed from the history.
- **Auto-save does not spam the revision history.** Saves update the draft in place; revisions are named checkpoints, plus one at every publication and correction. FR-EDITOR-008's continuous auto-save is honoured without turning history into keystrokes.
- **Story collection is a fourth outbox consumer** (FR-STORY-001). Trail release, run start/end, pause and resume, Circle close, awards, guest registrations and media uploads become `StoryAsset` rows automatically, keyed by the event id so replay is harmless. Check-ins are deliberately excluded: one per hasher would drown the timeline it exists to serve. The Scribe adds by hand what the system could never notice (FR-STORY-002), and only manual entries are editable — collected events are the record of what happened.
- **AI is built but not switched on** (D14's provider is not installed). The editorial rules exist and are enforced now: `aiAssisted` stays true until a human accepts every suggestion, and publication is refused while it is (BR-SCRIBE-005). `POST /reports/:id/ai-draft` answers `AI_NOT_CONFIGURED`, exactly as push does. Turning Claude on later is a change in one place and can never become a way to publish text no human accepted.
- **The Passport counts reports written** and credits the Official Scribe, not whichever officer pressed publish.
- **New Chapter 24 events:** `TrailReportEditingStarted`, `TrailReportReturnedToEditing`, `TrailReportArchived`, added to the registry alongside the existing Scribe Service rows.

Rationale: Annex 08G (00 to 06), Chapter 22 A.5, Chapter 23 Part F, Chapter 24's Scribe Service rows, and the 08G-06 permission matrix.

Consequences: The editor is plain long-form text, not the documentary suite 08G-02 describes — no drag-and-drop story cards, embedded media blocks, live maps or style profiles yet. Export (FR-PUBLISH-006), reading modes (FR-PUBLISH-004), translation, collections and offline editing are not built. Reviewer comments are anchored by a free-text string rather than a stable range, so heavy editing can strand an anchor.

## 2026-09-17 - D30: Run Capsules assemble themselves, humans publish them

Status: Active

Decision:
- **The capsule exists from the moment the run does.** Annex 08H-01 and 08E-05 both define FR-CAPSULE-001 with opposite triggers (at run creation vs when the run is archived). Chapter 22 A.6 names 08H as the owning domain and Chapter 23 says "auto-created at Draft, finalized at Archived", so 08H-01 wins and 08E-05's "generate" is read as *finalise*. Logged as Chapter 22 Contradictions & Gaps item 7 rather than silently resolved; 08E-05 needs re-wording in the next Bible pass.
- **Assembly is derived, not accumulated.** The capsule's timeline and summary are rebuilt from the source tables (run lifecycle, story assets, circle, awards, attendance, media, trail, report), exactly as the Hash Passport is (D27). Replay is harmless and a capsule that predates this code fills itself in. Rebuilding stops the moment the capsule is Published, Archived or Legacy: from then on the record is frozen (FR-CAPSULE-006, BR-CAPSULE-004).
- **Four states are automatic, two are human.** Planned → Preparing → Live → Draft already follow the run. New: the capsule moves to **Pending Publication** when the run is archived *or* its Trail Report is published, whichever comes first, emitting `RunCapsuleReadyForPublication`. It never publishes itself.
- **Publishing is gated on the Trail Report** (Ch.22 A.6): the Scribe or an officer holding `report.publish` may publish a capsule only once its report is published. Archiving is an officer's act and takes a reason.
- **Published and Archived capsules never reopen** (Ch.22 A.6 invalid transitions). The run-lifecycle sync that moves a capsule along now refuses to touch one that has passed publication, so a late run-archive cannot drag a published capsule backwards.
- **Enrichment never changes state** (BR-CAPSULE-005). Any active member of the hosting kennel may attach a supplemental artifact — newly found photos, a scanned newsletter, an interview, an anniversary reflection — to a Published or Archived capsule. Supplements are stored separately from the record, always attributed, and clearly marked as later additions (08H-05 permission matrix: Member may add a reflection and upload media).
- **Visibility follows the run**, as trail reports do (D29). BR-CAPSULE-006's five configurable levels (public / registered / members / invited guests / officers) are deferred, not refused.
- **Health indicators are advisory** (FR-CAPSULE-008): missing Trail Report, missing Circle record, no photos, uncaptioned media. They help an officer see what is thin; they never block publication.
- **The Passport needs no new wiring.** FR-CAPSULE-011 wants publication to update passports; attendance, hare duty and reports already derive from their own events (D27, D29), so publishing a capsule adds nothing a passport does not already know.
- **Legacy import is deferred.** `RunCapsule.isLegacyImport` and the Legacy state exist in the schema and the state machine; the import path (BR-CAPSULE-012 provenance metadata) is not built.

Rationale: Annex 08H-01 and 08H-05, Annex 08E-05, Chapter 22 A.6, Chapter 23, and Chapter 24's RunCapsule rows.

Consequences: This is the record, not yet the experience. The Capsule Explorer (08H-02), Hash Time Machine (08H-03), AI memory layer (08H-04), interactive map replay, reading modes, export (BR-CAPSULE-011), curated collections (FR-CAPSULE-014) and offline viewing are all unbuilt. The timeline is data a client can render, not the synchronised multi-panel experience 08H-02 describes.

## 2026-09-17 - D31: Email verification is a hard gate at login

Status: Active

Decision:
- **No confirmed address, no session.** FR-AUTH-002 is now enforced: `login` refuses with `EMAIL_NOT_VERIFIED` until `User.emailVerifiedAt` is set, and `refresh` does the same, revoking every outstanding session for that user. A session issued before this existed cannot outlive it.
- **Registering no longer signs you in.** `POST /auth/register` returns the user and `verificationRequired: true` but **no tokens**, so an unconfirmed address can never hold a session in the first place. The web register flow shows "check your inbox" rather than dropping the person into the app.
- **The check sits after the password check**, so it cannot be used to discover which addresses are registered.
- **Tokens are random, hashed and single-use.** 32 random bytes go in the email; only the SHA-256 hash is stored, the same treatment refresh tokens get. They last 24 hours, and issuing a new one deletes the previous unused one so an old link cannot be resurrected.
- **`AccountStatus.ACTIVE` still means standing, not verification.** The two are deliberately separate: suspension and confirmation are different questions, and conflating them would make a suspended-but-verified account indistinguishable from a fresh one.
- **Verifying only lifts the floor.** Trust goes `UNVERIFIED → VERIFIED_EMAIL`, and anyone already at a higher level (kennel or platform vouched) keeps it.
- **Resend never reveals anything.** `POST /auth/verification/resend` answers 200 for any address, registered or not, and is throttled to one mail a minute.
- **Outside production the link is also written to the log.** Verification is a hard gate, so a developer whose mail is undeliverable would otherwise lock themselves out of their own machine. Production never logs it.
- **Existing unverified accounts are locked out immediately.** That is the cost of the hard gate and it is intended. Seeded users set `emailVerifiedAt` directly, so development logins keep working.

Rationale: FR-AUTH-002, Chapter 22 A.9 (trust levels), and the stakeholder choice of the strictest of the three gating options.

Consequences: Sign-in now depends on working email in production, so `EMAIL_FROM` must be a verified sending domain before real users exist — `onboarding@resend.dev` only delivers to the Resend account owner. Password reset (`PasswordResetToken`) is still unbuilt and will want the same token machinery. Mobile surfaces the new error but has no verify screen yet.

## 2026-09-17 - D32: Defining an office and filling it are different powers

Status: Active

Decision:
- **`kennel.manage` defines positions; `officer.appoint` fills them.** Annex 08L treats officer management as one capability, but collapsing the two here would make `officer.appoint` a route to anything: write `kennel.manage` onto a position, appoint yourself, done. Defining or editing what an office may do is therefore kennel-admin work, and appointing is a separate, lesser power.
- **Nobody can hand out authority they do not hold.** Writing keys onto a position, and appointing someone to a position, both require the actor to currently hold every key involved. Kennel admins hold everything, so they are unaffected; an On Sec with `officer.appoint` can fill the Hash Cash seat but cannot appoint a new Grand Master carrying keys they lack. This is the delegation rule (FR-GOV-033) applied to appointment, and it is what stops appointment being self-promotion.
- **Delegations are capped at 90 days**, need a reason, cannot be granted to yourself, and only ever carry keys the delegator holds **at the moment of granting** — then re-checked at every permission resolution (D19), because the delegator may lose a key afterwards. A delegate outliving their delegator's authority would be authority conjured from nothing.
- **Positions are archived, never deleted** (FR-GOV-006). Archiving ends any sitting appointment with a recorded reason rather than leaving a holder attached to a retired office.
- **Appointments end into history, never deletion** (Ch.22 A.10): Term Ended, Resigned or Revoked, each keeping start date, end date, method and reason. Standing down from your own seat needs no permission and is always recorded as a resignation, never as a revocation, because the record should say what actually happened.
- **Visibility:** members see who holds which office and the leadership timeline; the permission keys a position carries are shown only to those who can appoint or manage. The public kennel page continues to list current officers by name (FR-KENNEL-003).
- **Nominated and Appointed are skipped.** Ch.22 A.10 models them for elected offices, but elections (08L-03, the `Election` models) are unbuilt, so appointments are created ACTIVE with a recorded method.

Rationale: Annex 08L-01 (FR-GOV-004, FR-GOV-006), 08L-04 (FR-GOV-033, FR-GOV-034), Chapter 22 A.10, and `CODEX/PERMISSION-MATRIX.md` sections 3 and 4.

Consequences: `officer.appoint` and `kennel.manage` move from Planned to Live in the permission matrix. Elections, committees, motions and meeting records remain unbuilt, so an elected office is recorded as a plain appointment with `method: ELECTED`. `RoleDelegationExpired` is still never emitted: expiry is evaluated at resolution time rather than by a scheduler, so a delegation stops working the moment it lapses but no event marks it. Changing `isMismanagement` on a position changes the D10 verification count for that kennel.

## 2026-09-17 - D33: Any hasher can start a kennel, and a pending kennel is reachable

Status: Active

Decision:
- **`POST /api/v1/kennels` is the front door** (FR-KENNEL-001). Any signed-in hasher may found a kennel. The platform-admin route (`POST /api/v1/admin/kennels`) stays as it was, for staff creating kennels on someone's behalf.
- **The founder becomes provisional administrator**, which is three writes in one transaction: an ACTIVE `FULL` membership, a `KENNEL_ADMIN` role assignment, and the kennel itself. They are not applying to a kennel, they are starting one, so the membership is approved from the first moment with `policyRef: founder`. Events: `KennelCreated`, `MembershipApproved`, `RoleAssigned`, all of which already exist in Chapter 24.
- **Status and verification are fixed server-side.** The founding validator deliberately does not accept `status`, `verificationLevel` or `visibility`; a kennel opens PENDING_VERIFICATION and PENDING whatever the request body says. Verification is still earned by getting four active mismanagement members (D10), never claimed at signup.
- **A pending kennel is reachable by link and joinable, but not listed in the directory.** This fixed a contradiction the codebase already contained: `membership.service#isOpenForRequests` deliberately allowed joining a PENDING_VERIFICATION kennel ("they cannot reach D10's threshold otherwise") while `getPublicBySlug` demanded ACTIVE, so the page where you would join one returned 404. A newly founded kennel was invisible to everyone including its founder, and could never grow into verification. The reader now accepts ACTIVE or PENDING_VERIFICATION; the directory listing still requires ACTIVE, which mirrors how UNLISTED kennels already behave.
- **One pending kennel per founder.** You cannot start a second while your first is still awaiting verification, which keeps the directory from filling with abandonded drafts without needing moderation.
- **Duplicate local names are refused** (FR-KENNEL-001): same name in the same city and country is a 409. The same name in a different city is fine, because that is a different kennel.
- **Email verification is not re-checked** in this path. A session cannot exist without it (D31), so any actor reaching this code has already confirmed their address. That is the anti-spam gate.
- **Logo and banner stay optional**, though FR-KENNEL-001 lists them as required fields. Blocking the creation of a kennel on an image upload would stop real kennels registering; they can be added later from the kennel settings.

Rationale: Annex 08C FR-KENNEL-001 and FR-KENNEL-002, D10's verification threshold, D31's verified-email gate, and the existing intent recorded in `kennel.service#discoverableWhere` that unlisted kennels remain reachable by link.

Consequences: A founder cannot abandon or archive their own pending kennel; only a platform admin can, so a mistaken kennel needs staff help until that is built. Nothing enforces that a founded kennel is real, so the directory's defence is that pending kennels are unlisted plus one-at-a-time per founder. The admin app still has its own create form with the full field set, and the two validators must be changed together.

## 2026-09-18 - D34: A kennel runs itself, but it cannot promote itself

Status: Active

Supersedes the first consequence of D33 ("a founder cannot abandon or archive their own pending kennel").

Decision:
- **`GET`/`PATCH /api/v1/kennels/:slug/settings` is where a kennel's own admins run it**, gated on `kennel.manage` resolved against the database (D19/D32), not on being the founder. Founding a kennel and running it are different things: the founder is simply the first person who happens to hold the key, and an On Sec given `kennel.manage` later has exactly the same reach.
- **Standing and verification are readable but not writable.** `status` and `verificationLevel` are absent from `kennelSettingsSchema` *and* stripped again in `updateSettings` before the shared `update()` runs. One guard is the contract, the other survives a future change to the contract — a kennel that could set its own status could grant itself D10 verification, which is the one thing the threshold exists to prevent. The settings screen shows the mismanagement count against the required number instead, so the path to verification is visible without being reachable.
- **The founder may abandon a kennel they started, while it is still pending and still theirs alone.** Three conditions, all server-checked: status is PENDING_VERIFICATION, the actor is `createdById`, and the active membership count is at most one. A mistaken kennel no longer needs staff, and the founder is freed from D33's one-pending-kennel rule to start again.
- **Abandoning is archiving.** History is append-only, so the kennel moves to ARCHIVED with `archivedAt`, the founder's membership becomes RESIGNED with a timeline entry, and their `KENNEL_ADMIN` assignment ends as TERM_ENDED. Leaving those active would keep an archived kennel in the founder's sidebar and, worse, in permission resolution. Events: `KennelArchived`, `MembershipResigned`, `RoleEnded`; the audit row records `policyRef: 'founder'` and the required reason.
- **Once anyone else has joined, it is not the founder's to close.** `KENNEL_HAS_MEMBERS` refuses it, and `viewer.canAbandon` goes false so the screen stops offering the button rather than letting it fail. Other people's membership history is not a founder's to end.
- **A reason is required** (3–500 characters). An archived kennel with no explanation is indistinguishable from a bug a year later.
- **The slug does not change when the name does.** Renaming a kennel is ordinary editing; breaking every link to it is not.

Rationale: Annex 08C FR-KENNEL-002 (kennel administration), D10's verification threshold, D19/D32's permission resolution, and the "History is append-only" rule in `CODEX/ARCHITECTURE-RULES.md`.

Consequences: `kennel.manage` now has a member-facing surface, not just an admin-app one, so the Joi settings schema and the Zod mirror in `apps/web/app/kennels/[slug]/settings/page.tsx` must change together. Logo and banner remain unexposed here pending the media picker, so D33's "they can be added later from the kennel settings" is still owed. `latitude`/`longitude` are accepted by the API but not yet offered in the UI: a kennel's pin is still derived from its city. An established kennel still needs platform staff to archive it, which is intended.

## 2026-09-18 - D35: A page that disappears has to be told to disappear

Status: Active

Decision:
- **Public pages keep their 60-second ISR window, and the API evicts them on demand when that window is not enough.** Measured on 2026-09-18: `/kennels/[slug]` refreshes correctly when a kennel's data *changes* (a motto edit appeared after 73 seconds), but when the API starts answering 404 the regeneration calls `notFound()`, Next discards that render and keeps serving the last successful one. An archived kennel kept serving its description, motto and officer names 156 seconds after archiving, with no sign of ever expiring. Time-based revalidation cannot express a deletion, so something has to say it out loud.
- **The outbox is what says it.** `applyRevalidation` is a fifth consumer in `outbox.service`, keyed on `aggregateType === 'Kennel'`. Every Kennel event already exists (`KennelCreated`, `KennelVerified`, `KennelVerificationLevelChanged`, `KennelArchived`), so no new event was invented and the mechanism inherits the outbox's at-least-once delivery. Measured end to end: an abandoned kennel's public page went from 200 to 404 in **1 second**.
- **Plain edits revalidate directly from `update()`**, because editing branding emits no DomainEvent at all and would otherwise sit out the full 60 seconds. A rename moves the slug, so the previous address is evicted too or it keeps serving the kennel under its old name.
- **Revalidation is best-effort and can never park a domain event.** It is cache invalidation, not domain state. `applyRevalidation` catches its own errors and `revalidatePaths` never throws; a 3-second timeout bounds a hanging web app. Verified by pointing `WEB_REVALIDATE_URL` at a dead port and abandoning a kennel: the API answered 200, the log carried one warning, and `KennelArchived`, `MembershipResigned` and `RoleEnded` were all published with `attempts: 0`. The degraded behaviour is exactly the old behaviour, which is a stale page, not a lost event.
- **The web route is the one place the app acts on an unauthenticated request from outside**, so it is deliberately narrow: a shared secret compared with `timingSafeEqual`, a refusal when no secret is configured rather than an open door, at most 20 paths per call, and only app-relative paths — anything with a scheme or a protocol-relative `//` is dropped before it reaches `revalidatePath`.
- **Without `REVALIDATE_SECRET` the feature is simply off** and the 60-second window applies, which keeps a fresh clone working before anyone sets it up. Both apps need the same value: `apps/api/.env` and `apps/web/.env.local`.
- **The admin app does not get a copy.** `apps/web` and `apps/admin` duplicate the proxy, api client and ui primitives on purpose, but this is not one of those: admin has no `revalidate` and no `publicGet` anywhere, because every admin page is authenticated and uncached. There is nothing there to evict.

Rationale: Chapter 24's transactional outbox, the "public pages must render without JS" rule in the front-end conventions, and the measurements above.

Consequences: Runs, trail reports and Run Capsules are not covered — none of them has a cached public page today, but the first one that does will need its aggregate added to `applyRevalidation`. A kennel turning UNLISTED or HIDDEN goes through `update()` and is covered; a kennel deleted outright by `remove()` is not, though that path only accepts a kennel with no history at all. When HCP runs more than one API instance the outbox moves to a broker, and this consumer moves with it. The 60-second window is now a fallback rather than the mechanism, so it could be lengthened for SEO without making disappearance slower.

## 2026-09-18 - D36: Push interrupts, so it is the channel that has to ask permission

Status: Active

Closes D12's remaining launch blocker ("Push and email providers are required at launch"). Email landed in D28; this is push.

Decision:
- **Expo is the provider.** Mobile is already Expo SDK 57, and Expo sits in front of APNs and FCM, so one HTTP POST reaches both stores without two sets of credentials. It needs no SDK and no new dependency on the API side — `push.service.ts` is plain `fetch`. `EXPO_ACCESS_TOKEN` is optional and only matters once the Expo project turns on enhanced security.
- **There is no "configured" flag to earn.** Resend has an API key, so `isEmailConfigured()` is a real question; Expo accepts a send addressed to any valid push token, so the only switch is `PUSH_ENABLED`. The meaningful per-hasher question is different — *do they have a live device* — and that is what `channels.push` answers on the preferences endpoint. A screen never offers a switch that cannot do anything.
- **A device is registered by the app, never by a person typing.** `POST /me/devices` takes the Expo token the OS issued and checks its shape before storing it, so a failed send means a delivery problem rather than a typo. Re-registering the same token moves it to whoever is signed in now, which is the right answer for a shared handset. The token goes in and is **never read back out**: it is a sending credential, and a screen listing someone's devices has no use for it.
- **Signing out hands the device back.** `unregisterForPush` runs while the session is still valid, because the API has to know whose device it is. Otherwise the next person holding that phone would get the last one's mail.
- **A token Expo calls dead is retired, not deleted.** `DeviceNotRegistered` sets `revokedAt`; the row stays as the record of what was tried, which is the append-only rule applied to devices. A device that comes back simply registers again.
- **Quiet hours are enforced, and they only quieten push (FR-NOT-006).** `quietHoursStart`/`quietHoursEnd` have been in the schema since the first migration with nothing reading them. That was harmless while in-app was the only channel — a badge waiting in the morning wakes nobody — and stopped being harmless the moment push shipped. In-app still lands and email still sends during a window, so **nothing is lost, only quietened**. Windows wrap midnight (22:00 → 07:00) because that is the common case, and start equal to end means no window rather than all day, so a mistyped pair cannot mute someone completely.
- **CRITICAL rings through a quiet window**, which is FR-NOT-006's own carve-out: a run paused because someone is hurt is exactly what a sleeping hasher needs. The override is written into `evaluationReason` rather than being silent.
- **Push defaults are the things worth a buzz**: membership, runs, trail release, safety. Announcements, reports, reminders, governance and media wait to be looked at. This mirrors `EMAIL_BY_DEFAULT` in being deliberately narrower than "everything", and FR-NOT-009 lets anyone change it.
- **Sending happens after the transaction commits**, the same rule email already followed. A slow provider must not hold a database transaction open, and a failed send is recorded on the delivery row rather than losing the notification. One device reached counts as delivered; the rest is detail in the `error` column.
- **`evaluationReason` says which channels carried it and what did not (FR-NOT-010)**, naming the actual reason: no device registered, push switched off platform-wide, or held back by a named quiet window.

Rationale: D12 (push and email, no SMS), Annex 08P FR-NOT-002/003/006/009/010, Chapter 22 A.11, and the existing `PushDevice` / `NotificationDelivery` / `NotificationPreference` models, which have been carrying these columns unused since the first migration.

Consequences: **Browser Web Push is not built.** It needs VAPID keys, a service worker and a different token flow, so `DevicePlatform.WEB` stays unused and the web settings page tells a hasher to use the phone app. **The mobile app cannot get a real token until `eas init` is run** in `apps/mobile`: `getExpoPushTokenAsync` requires an EAS project id, which belongs to the repo owner's Expo account, so the app reports that as a setup gap rather than an error the hasher caused. Guests are still email-only, having no app to register from. Digests, batching and escalation (FR-NOT-007/008/011-016) remain unbuilt — everything is still `deliveryPolicy: 'immediate'`. Quiet hours are read from a hasher's account-wide PUSH preference rows because the schema has nowhere else to hang them; a genuine account-level settings table would be tidier. `User.timeZone` is nullable and a hasher without one is evaluated in UTC, which will put someone's quiet hours in the wrong place until the app starts capturing it.

## 2026-09-18 - D37: A kennel's face is edited where it is seen

Status: Active

Closes what D34 left owed ("Logo and banner remain unexposed here pending the media picker"), and with it D33's "they can be added later from the kennel settings".

Decision:
- **The banner and the logo are edited from the kennel page itself, not from a settings form.** They are the one part of a kennel that is judged by looking at it, so the controls sit on the picture being changed: `Add a banner` / `Change banner` in the corner of the cover, a camera on the logo circle, and a `Remove` beside each once there is something to remove. `apps/web/components/kennels/KennelBranding.tsx` renders the header for everyone and the controls only for a viewer the API says holds `kennel.manage` — the same permission the settings screen asks for, read from `/kennels/:slug/membership`, never inferred from a token.
- **Branding is a media asset like any other**, so BR-RUN-007 still holds: `MediaTargetType.KENNEL` links the file to the kennel that owns it, and nothing is orphaned. The upload path is unchanged (D28) — the API hands out a presigned target, the browser PUTs to storage, then confirms — and the confirmed URL is written to `Kennel.bannerUrl` / `logoUrl` through the existing `PATCH /kennels/:slug/settings`, which already accepted both fields and already writes an audit entry and evicts the public page (D35).
- **Only an admin of that kennel may upload to it.** `resolveTarget` asserts `kennel.manage` for a KENNEL target rather than the `isMember` check a gallery gets: a member adding a photo to an album is a contribution, a member changing the front of the kennel is not. Verified: a plain hasher is refused `KENNEL_PERMISSION_REQUIRED` on both the upload request and the settings patch.
- **Branding skips moderation (BR-RUN-012).** A kennel whose `mediaModerationMode` is `OFFICER_APPROVAL` would otherwise queue its own logo for its own approval and show a blank circle until someone remembered. Only an admin can have uploaded it, so the review has already happened. Measured under `OFFICER_APPROVAL`: `AVAILABLE` / `APPROVED`.
- **The crop is the kennel's choice, not the browser's.** A banner is shown as a wide strip, so anything not already that shape has more of itself than fits and `cover` would centre it — which puts a head half out of frame as often as not. `Kennel.bannerPosition` stores a CSS background-position pair ("50% 15%"), dragged into place on the page itself with Cancel and Save, and nudged 2% at a time with the arrow keys for anyone not using a mouse. Null means centred, which is what every banner uploaded before this existed gets and what a newly uploaded one resets to — a position chosen for the old picture means nothing for the new one. The value is validated as **two percentages and nothing else** (`kennel.validator.ts`), because it ends up in a `style` attribute: a free-text CSS field there would be an injection point.
- **Removing a picture is not deleting it.** `bannerUrl` goes back to null and the kennel falls back to its brand colour; the asset and its `MediaUploaded` event stay, because history is append-only. Removal uses `ActionDialog`, never `window.confirm`.
- **The pictures are server-rendered.** `KennelBranding` is a client component for the sake of the controls, but Next renders it on the server like the rest of the page, so a visitor with no JavaScript still gets the banner and the logo in the HTML. Only the editing affordances need the browser.

Rationale: D34 (a kennel admin runs their own kennel), D28 (uploads go browser → storage), BR-RUN-007, BR-RUN-012, and the front-end rule that public pages render without JS.

Consequences: `MediaTargetType` gained a value (`20260918120000_kennel_media_target`) and `Kennel` gained `bannerPosition` (`20260918140000_kennel_banner_position`). Repositioning moves the crop, it does not scale or rotate: a banner narrower than the strip still stretches, so the upload hint should eventually say what shape to bring. The admin app's kennel form is unchanged and has no position control, which is fine because a PATCH is partial and cannot clear what it does not send. **Browser uploads to R2 were blocked twice and both blocks are worth knowing about**: the web app's CSP `connect-src` did not name the storage origin (fixed, with `MEDIA_UPLOAD_ORIGIN` to override), and the live bucket has no CORS policy, which is a Cloudflare setting no code change can reach — until it is set, every browser upload fails, run photos included (CODEX/PROVIDERS.md). The end-to-end pass was therefore run against the local disk driver. `/media?targetType=KENNEL` will list every banner a kennel has ever had, to anyone who can manage it; that is the history, not a bug, but nothing surfaces it yet. Neither the admin app nor mobile grew a picker — admin still edits both fields as URLs, and the mobile kennel screen shows neither picture yet.

## 2026-09-19 - D38: A kennel nobody can find is a kennel nobody joins

Status: Active

Raised by the repo owner founding a kennel and finding it nowhere: not on the home page, not in the directory, not on the map. Both reasons turned out to be real, and neither was a bug in the page.

Decision:
- **Pending Verification stays invisible, and that is the rule, not an accident.** `GET /kennels` filters to `status: ACTIVE` **and** `visibility: PUBLIC` (`discoverableWhere`), which feeds the home page, the directory and the map alike; only the detail route lets a pending kennel through so it can be shared and joined (D33). A kennel is let into the directory by a platform admin, never by itself (D10). What was missing was not the rule but any sign of it: **nothing told staff a kennel was waiting**, so activation depended on someone thinking to filter the kennel list.
- **`KennelCreated` now notifies platform admins**, through the same outbox and fan-out every other event uses. Its `kennelId` is deliberately **null**: a kennel-scoped notification can be switched off by that kennel's own rules (`kennelAllows`), and a kennel must not be able to mute the notice asking for it to be reviewed. Category SYSTEM, because this is the platform's business rather than the kennel's governance.
- **`GET /admin/kennels/pending` is the queue**, rendered on the admin dashboard: oldest wait first, with the founder, how long it has waited, mismanagement filled against the D10 threshold, and a one-click Activate. `readyForReview` reports the threshold; it does not enforce it, because activating early is sometimes right and the decision stays a person's. Route order matters — it sits above `/kennels/:id` or "pending" is read as an id.
- **Activation tells the kennel.** `KennelVerified` (already emitted on PENDING → ACTIVE) now notifies its admins that it is live, and says whether it reached the map or only the directory.
- **Coordinates are captured when the kennel is founded.** The second reason it was invisible: the map plots only kennels with both coordinates, the found form never asked, and the settings form did not offer them — so a self-founded kennel could never be pinned, whatever its status. Both forms now carry a `LocationPicker`: tap the map, drag the pin, or "Use my location" (the browser's own geolocation — no geocoding service, no third-party origin to allow). The two numeric fields beside it are the real input and the map is the island on top, so the form still works without JavaScript.
- **Both coordinates or neither.** `toCoordinates` refuses to send one: a lone latitude cannot place a pin, and storing it would make `hasCoordinates` lie. Coordinates stay optional — a kennel that does not want to publish where it meets is listed without a pin.
- **The admin queue says when a kennel will land in the directory but not on the map**, before activation rather than after, because that is the moment somebody can still fix it.

Rationale: D33 (self-service founding), D10 (standing is granted, not taken), D34, Ch.24's outbox, and the front-end rule that public pages work without JS.

Consequences: Nothing auto-promotes a kennel even at 4/4 mismanagement, by design, but that means the queue must actually be looked at — the notification is what makes that likely. A kennel founded before this shipped still has no coordinates until someone edits it. The queue is capped at 50 and unpaginated; if the backlog ever exceeds that it needs paging. Seeded demo kennels keep their seeded coordinates. `PendingKennelQueue` repeats the `useEffect(() => { load(); })` pattern the other four admin pages use, which the React compiler lint flags in all five; changing it is a separate sweep, not this one.

## 2026-09-19 - D39: What a member does for the kennel belongs on the members list

Status: Active

Decision:
- **Offices and roles are shown on the roll, not only on the offices screen.** Every member in `GET /kennels/:slug/members` now carries `offices` (active `OfficerAppointment` rows, with their title) and `roles` (active kennel-scoped `RoleAssignment` rows), read for the whole page in two queries rather than two per row. Without this the members list answered "who is in the kennel" but never "who does what", and the answer already existed one screen away.
- **They are handed out from the same list.** A viewer with `officer.appoint` can put a member into an office, and a viewer with `kennel.manage` can grant a role, from the member's own card — the officers screen (D32) keeps its fuller view, defines positions and shows the leadership timeline, but appointing no longer requires knowing that screen exists. Each badge carries an × that ends the appointment or revokes the role, both with a required reason.
- **An office is not a role.** An office is a seat with a title, a term and a permission set (`OfficerPosition`). A role is a standing job — Hash Scribe, photographer, moderator, another kennel admin (`RoleAssignment`). They were always separate in the schema; the UI now says so in words rather than blending them, and the API keeps its two different permission bars: filling a seat is `officer.appoint`, handing out a role is `kennel.manage`, because `KENNEL_ADMIN` carries every kennel permission there is.
- **`POST /kennels/:slug/roles` and `POST /roles/:id/revoke` are new**, and they close a real hole: `RoleAssignment` was only ever written by founding a kennel and by setting a run's hares, so there was **no way to make anyone else a kennel admin or a scribe**. A kennel whose founder went quiet could not be handed on.
- **HARE and CO_HARE are not grantable here.** They belong to a run and `run.service` grants them when the hares are set; kennel-wide they would make somebody permanently the hare of nothing. The Joi schema refuses them at the edge **and the service refuses them again** — found by a check that called the service directly and got a kennel-wide HARE grant, which the edge validator would have caught but the service happily wrote.
- **A kennel keeps at least one admin.** Revoking the last active `KENNEL_ADMIN` is refused with `LAST_KENNEL_ADMIN`: a kennel with nobody who can run it cannot appoint its way out again.
- **Every grant and every ending is an event and an audit row** (`RoleAssigned` / `RoleEnded`, `role.assign` / `role.revoke`), and a revoked role is marked REVOKED with an end date rather than deleted, which is the append-only rule applied to authority.
- **Members show their picture.** The roll and the public officer list both carry `avatarUrl` now. A hasher's picture is public identity like their hash handle (D11); no biodata joined either payload.

Rationale: D32 (defining a position and filling it are different powers), D11, FR-MEMBER-011 (officers are members first), Ch.22 A.10, and the rule that a person is never a role — authority is a database row, never a token claim.

Consequences: `GRANTABLE_ROLES` is mirrored in three places — the Joi validator, the service and the web types — and must move together, like the other Joi/Zod mirrors. Granting a role does not notify the person yet; `RoleAssigned` has no notification spec, which is worth adding when the notification matrix is drafted. The admin app has no equivalent screen: platform staff still act through the kennel's own admins. Delegations (FR-GOV-033) remain separate and still live only on the offices screen.

## 2026-09-19 - D40: A kennel names its own jobs

Status: Active

Raised by the repo owner: "the role/office list is hardcoded, we need to be able to add custom roles/offices as naming conventions vary across kennels." Correct on both counts, for two different reasons.

Decision:
- **Offices were already free text; the problem was where they could be created.** `OfficerPosition.title` has always been per-kennel and unconstrained — Grand Master, Hash Cash, Beer Meister, Hash Haberdasher, whatever a kennel calls it — but a new one could only be defined on the offices screen, so the members list could only offer seats that already existed. The assign dialog now carries **New office…**, which creates the position and fills it in one go. It is still two API calls, because defining a seat (`kennel.manage`) and filling one (`officer.appoint`) are two different powers (D32); the dialog just does them in order, and a new office starts with **no permissions** — a title is not authority.
- **Roles are a fixed set of powers with a per-kennel name.** `ScopedRole` stays an enum because each value *means* something the code acts on: `KENNEL_ADMIN` resolves to every kennel permission, `SCRIBE` is what Scribe Studio checks (D29). Letting a kennel invent `HASH_FLASH` would create a role nothing honours. So the **authority** stays fixed and the **wording** becomes the kennel's: `RoleAssignment.title` holds what this kennel calls the job, null means the platform's default, and the badge shows the kennel's word with the standard one on hover.
- **The kennel's vocabulary is remembered, not re-typed.** `roleTitles(kennelId)` reads the most recent title the kennel used per role and `GET /kennels/:slug/positions` returns it, so a kennel that once called its photographer the Hash Flash sees "Hash Flash" as the name next time rather than "Photographer". No second table: the grants already carry the answer.
- **`PATCH /roles/:id` renames a grant already made**, because kennels rename things and revoke-and-regrant would throw away the record of who has held the job. The authority is untouched, so this writes an **audit row and no domain event** — presentation, not domain state, the same reasoning D35 applied to branding. Clearing the name falls back to the default wording.
- **What the dialog says matters as much as what it does.** It names the two things plainly: an office is "a seat this kennel defines and can name however it likes", a role "carries authority across HCP — you can still call it whatever your kennel calls it". The earlier single list blurred them, which is what made the fixed role names look like the whole vocabulary.

Rationale: D32, D39, D29 (SCRIBE is read by name), D11, and the rule that a person is never a role — a title is a word, authority is a row.

Consequences: `GRANTABLE_ROLES` is now mirrored in four places (Joi validator, officer service, web types, web labels) and they must move together. A kennel that renames a role renames only that grant; the next grant inherits it through `roleTitles`, but two people holding the same role can carry different words for it, which is a bit loose and would want a per-kennel naming table if it ever bites. Custom offices created from the members list carry no permissions and no term, so a kennel wanting either still goes to the offices screen. The public kennel page shows office titles, and now shows them for offices a kennel invented, which is the point.

## 2026-09-19 - D41: A reel belongs to the hasher, not to a kennel

Status: Active

Decision:
- **Reels are a new aggregate, because nothing existing fits.** Every other piece of media on HCP hangs off a run, a trail, a circle or a gallery — all of which belong to a kennel. A hasher holding a beer at home belongs to none of them, and that case is the point of the feature rather than an edge of it. `Reel` carries an author and **optional** context: a kennel, a run, an event, or nothing at all.
- **Three steps, in this order: draft, upload, publish.** The reel is created empty, the browser PUTs the video straight to storage against a `REEL` media target (D28, unchanged), and publishing is its own call that refuses unless the video has landed (`REEL_HAS_NO_VIDEO`, `REEL_VIDEO_NOT_READY`). An upload that fails or is abandoned leaves a draft nobody sees, rather than an empty player in everyone's rail.
- **Only the author touches their own reel.** Uploading to a reel is refused for anyone else (`NOT_THE_AUTHOR`), as is publishing, editing and archiving. Reels skip kennel media moderation for the same reason branding does (D37): the person who shot it is the person posting it, and a reel held for review is a reel nobody ever sees.
- **A reel cannot open a door the thing it was shot at keeps shut.** Visibility is its own short enum — `PUBLIC` or `KENNEL_ONLY` — but a reel attached to a run is additionally filtered by that run's own access, so a reel of a members-only run stays with that run's members whatever the reel says. `KENNEL_ONLY` without a kennel is refused rather than silently treated as public.
- **Taking one down is two different acts.** The author **archives**; a moderator **removes**, with a reason, and that is the kennel's `media.moderate` holders for a reel posted to a kennel or platform staff for one posted to none. Both keep the row: Ch.22's rule that an ending is recorded, never deleted.
- **A view is a tally, not a decision.** `viewCount` increments on open and writes no domain event, because nobody can act on it and the outbox is for things people act on.

Rationale: the Bible's J-005 (photos and videos) and Chapter 9 Part 4, D28's upload path, D37's moderation precedent, Ch.22 A.10.

Consequences: **Three event names are new** — `ReelPosted`, `ReelArchived`, `ReelRemoved` — and Chapter 24's registry does not have them yet; that is the first case of this codebase naming an event the Bible has not, and the chapter needs them added. No transcoding and no thumbnail generation: `posterUrl` is whatever the upload carried, so a reel with no poster shows its kennel colour and a play icon until a frame-grab step exists. The 25MB `MEDIA_MAX_BYTES` cap applies, which is a short reel and is deliberate. Reels do not appear in the vertical feed (D42) or in a Run Capsule yet, and mobile has no reel screen. Comments and reactions on a reel are not built.

## 2026-09-19 - D42: The home page is a feed, not a directory

Status: Active

Raised by the repo owner: the home page was listing kennels twice — once as a horizontal strip, once as vertical cards — while `/kennels` already does the directory properly.

Decision:
- **The horizontal strip is now the reels rail**, and the vertical cards are now the community feed: published trail reports and the photos hashers put on their runs, from every kennel, newest first. Kennels keep their own page, which is better at being a directory than a feed ever was.
- **`GET /feed` merges sources rather than inventing a posts table.** Trail reports and photos already exist, already carry attribution and already know who may see them; a `Post` row duplicating them would be a second copy to keep true. `report.service.listPublished` is reused wholesale so run visibility lives in exactly one place, and photos are filtered through the same `getAccess`/`canView` the rest of the platform uses.
- **One run's photo dump is not the whole feed.** At most two photos per run share a page (`MAX_PHOTOS_PER_RUN`), the rest stay on the run. This is the cheap, honest version of BR-CXP-012 — meaningful participation over volume — and was found by looking: the seeded data put nine near-identical photos in a row.
- **Recency is the ranking, and that is stated rather than hidden.** BR-CXP-012 asks for relevance over popularity; relevance needs signals this platform does not collect yet. Nothing here forecloses them.
- **`hasMore` instead of a total.** A merged stream cannot count what it has not read without reading everything, so the API says whether there is more rather than inventing a number.
- **The home page stays server-rendered and anonymous.** It is ISR-cached (D35), so what it renders is the public view; the reels rail asks again from the browser once there is a session, because a member sees reels a visitor does not. The feed does not yet do that second pass, so a member's kennel-only material is missing from the home page until it does.
- **The composer posts a reel.** It was a disabled stub promising "posting arrives with runs, trail reports and photos". A reel is the one thing a hasher can post from anywhere, so that is the button; trail reports and runs are signposts, because both belong to a kennel and a composer cannot guess which.

Rationale: Chapter 9 Part 4 (Community Feed), D35 (ISR and eviction), D41.

Consequences: `KennelStrip` and `KennelPost` are deleted — the directory covers them. Reels are not in the vertical feed, deliberately: they are the rail. The feed pages by slicing a merged list, so deep pagination re-reads earlier pages and will want a cursor when there is real volume. A signed-in home page shows the public feed until the client-side second pass lands, which is the honest gap to close next. Announcements, capsules and events are all feed material the Bible lists and this does not carry yet.

## 2026-09-19 - D43: A run announcement is data, not a picture of data

Status: Active

Raised by the repo owner with a real Amakohia H3 flyer from WhatsApp: run number, theme, date, venue, hares, time, hash cash, what to bring, and the list of runs after it.

Decision:
- **The feed announces runs, and the announcement is the run.** A `RUN` item joins trail reports and photos in `GET /feed`, built from the run's own columns — `runNumber`, `title`, `theme`, `startsAt`/`timeZone`, `meetingPointName`/`meetingAddress`, `hashCash`, `description` and its hares. Everything on that flyer already existed in the schema except the picture. Nothing is re-typed into a caption, so the date is a date, the venue is an address, the kennel is a link, and **"On On — I'm coming" writes an RSVP** instead of asking someone to reply in a chat thread.
- **The flyer itself is welcome but optional.** `Run.posterUrl` holds it, uploaded as an ordinary run photo (D28) and written to the run the same way kennel branding is (D37), from a control on the run page for whoever may operate the run. With no poster the card still reads — that is the test a picture-only announcement fails, because a screenshot cannot be searched, translated, or read aloud.
- **"Future runs" is part of the card**, because it is part of every flyer: the kennel's next four announced runs, each a link. A kennel that plans six months ahead says so once, in the card, rather than as six items in the feed.
- **One announcement per kennel per page** (`MAX_RUNS_PER_KENNEL`). Found by looking: with every upcoming run eligible, eight of the first ten feed items were runs, several of them QA leftovers. A kennel with six runs booked is not six pieces of news.
- **A run stays on the feed while it is happening.** A run is open until it starts — and a hasher reading at four o'clock is exactly the person who still wants to see it — so the window runs to six hours past the start time for a run that is Live or in the Circle, and the card says 'On trail now' with 'On On — catch them up' instead of the usual call. **A run is news when it was announced, not when it happens.** The card's position in the feed uses `scheduledAt` (falling back to `createdAt`), so a run announced today appears today and does not climb back up the feed as its date approaches. Runs that have already started or were cancelled never appear.
- **Announced means out of Draft.** `SCHEDULED`, `PLANNING`, `TRAIL_HIDDEN`, `TRAIL_RELEASED` and `CHECK_IN_OPEN` all count; a draft is a kennel thinking out loud. Visibility is still the run's own — the same `getAccess`/`canView` every other read uses — so a members-only run never lands in a stranger's feed.

Rationale: Chapter 9 Part 4 (upcoming events are feed content), D42, D28, D37, Ch.22 A.3 statuses.

Consequences: `posterUrl` is accepted by the Joi run schemas but is **not** in the web run form's Zod mirror, because the poster is uploaded from the run page rather than typed into the form — the first deliberate gap between those two schemas, and worth remembering when either changes. No image processing: a tall WhatsApp flyer is shown with `object-contain` rather than cropped, so it letterboxes rather than losing its own text. The announcement cannot yet be *pushed* — a kennel announcing a run notifies nobody, which is the obvious next step now that push and email both work (D36, D28). Announcements, events and Run Capsules are still not feed material. Amakohia H3 runs 45 through 52 were created as demo data from a real flyer, with run 45 carrying that flyer as its poster and Just Uduakommiri, Just Jovita and SBM as its hares — the first two named by the D11 'Just <firstName>' rule rather than a hash handle, which is what the flyer itself does.

## 2026-09-19 - D44: "Pick a date convenient for you to hare" is a question the platform can answer

Status: Active

Every kennel flyer ends the same way, and Amakohia's is no exception: a list of dated runs with no hare, and a plea to take one. Those dates already exist here as runs; what was missing was the answer.

Decision:
- **Offering to hare is its own record, because offering is not haring.** `HareOffer` (OFFERED → ACCEPTED / DECLINED / WITHDRAWN) holds a hasher putting their hand up, what they said, and what the kennel answered. A trail is the kennel's name on the line, so **nobody hares by pressing a button alone** — an officer with `run.manage` still says yes. The offer is kept whatever the answer, so a kennel can see who keeps volunteering and a hasher can see they were answered.
- **It is not `VolunteerAssignment`.** That model exists for the beer stop, the check-in desk and the sweep — a free-text `role` on a shift. A hare is not a shift: accepting one grants the HARE scoped role and with it the trail tools, which is authority rather than a task.
- **Accepting goes through `addHare`, the same path a manager's edit uses.** One place writes `RunHare` + the `HARE`/`CO_HARE` role assignment + `HareAssigned`, so a hare that arrived by offer is indistinguishable from one the officers picked — which is the point. The first hare on a run leads it; after that, wanting to lead is a conversation, not a flag an offer can set.
- **Offers close when the trail does.** `SCHEDULED`, `PLANNING` and `TRAIL_HIDDEN` take offers; once the trail is released the job is done. A run that has started, or was called off, takes none.
- **Everyone hears about it.** An offer notifies the officers who can answer (`run.manage`, the same audience `MembershipRequested` uses), and the answer notifies the hasher — "You are haring run #46. The trail is yours to set" or the kennel's reason for going another way.
- **Who sees what:** officers see every offer on a run, a member sees only their own. Who else volunteered is the kennel's business until it is decided.
- **The un-hared dates are a list, and it is public.** `GET /runs/needing-hares` (optionally per kennel) feeds a "Dates needing a hare" card on the kennel's runs page and "Runs looking for a hare" on the runs index. Readable signed out on purpose: a hasher weighing up a kennel should be able to see that it needs hares, because that is an invitation.
- **The feed card lost its "Future runs" list.** It was a faithful copy of the flyer, but the flyer lists future dates because WhatsApp cannot link to them. Here they are runs with their own pages, now surfaced where someone can act on them, so the copy was costing a query per card to duplicate navigation.

Rationale: FR-RUN-003 (hare history lives in RoleAssignment), D3/D13 (the kennel owns its runs), D21 (hares are active members), Ch.22 A.3, and the Amakohia H3 flyer that prompted it.

Consequences: **Four more event names Chapter 24 does not have** — `HareOffered`, `HareOfferAccepted`, `HareOfferDeclined`, `HareOfferWithdrawn` — joining the reel events in that gap. `cancelledAt` was added to `runAccessSelect`, which every run read now carries; it is one column and every access check wants it. An offer cannot be made *for* someone — an officer wanting to draft a hare still edits the run directly, which is the existing path. Co-hare leadership is not negotiable through offers. Nothing reminds a kennel that a date is still un-hared as it approaches; the list is there, but it does not nag yet.

## 2026-09-19 - D45: The calendar speaks up about a date nobody is haring

Status: Active

D44 gave a kennel a list of its un-hared dates and a way for hashers to answer. A list waits to be looked at; the run comes anyway. This is the part that speaks up.

Decision:
- **Three things are worth saying, and each is said once.** A sweep twice a day looks at every upcoming run with no hare and decides which, if any, applies:
  - **offers are waiting** — somebody put their hand up more than three days ago and nobody answered. The kennel does not need more volunteers, it needs to answer the one it has, so this goes to the officers and says how long they have been waiting.
  - **no hare, a few weeks out** (21 days by default) — the officers, quietly. It is theirs to solve, and there is time.
  - **no hare, close in** (7 days by default) — **the whole kennel**, at HIGH priority. At that range it is everybody's problem, and the flyer's own ask — "pick a date convenient for you to hare" — is aimed at everybody.
- **Idempotency is the event log, not a flag column.** A nudge is a `RunHareReminderIssued` domain event carrying its stage; the sweep refuses to record a stage it has already recorded for that run. A restart, an overlapping tick or a second process therefore cannot say the same thing twice, and the fan-out's own `domainEventId` guard is the second belt. No new table, and the record of what was said is where every other record already lives.
- **Nobody is the actor.** These events carry `actorId: null` — the calendar did this, not a person. The audit trail is untouched: a nudge changes nothing, so it writes no `AuditLog` row.
- **Thresholds are settings, not constants in a branch.** `hare.nudge.soonDays` and `hare.nudge.urgentDays` sit in `SETTING_DEFAULTS`, so a platform that finds three weeks too eager can move it without a deploy. A kennel-level override is the obvious next step and is not built.
- **The sweep never runs at boot** and skips a tick that is still running. A restart loop would otherwise sweep on every restart, and a slow sweep must not overlap itself. It also never throws: a failed sweep is logged and retried on the next tick, because a reminder worker must not be able to take the API down.
- **`POST /admin/reminders/hares` runs it now**, for platform staff who need the answer before the next tick. It is the same function the timer calls.
- **Quiet hours still hold.** A HIGH-priority nudge to a whole kennel is exactly the kind of thing that would otherwise land at 3am; D36's quiet-hours evaluation sits between this and anybody's phone, and in-app and email are unaffected.

Rationale: D44, Ch.9 Part 4 (encourage participation; reduce information overload), D36 (quiet hours), Ch.24's outbox, and the last line of every hash flyer.

Consequences: **`RunHareReminderIssued` is another event name Chapter 24 does not list**, joining the reel and hare-offer events. The sweep is an in-process timer like the outbox, so it moves to the same broker when HCP runs more than one API instance — until then a second instance would double the sweep, though the event-log guard means it would not double the notifications. A run whose hare drops out inside seven days never gets the urgent nudge if the earlier ones were already recorded: the stages are per run, not per hare, and re-nudging a re-opened date is worth doing properly rather than by accident. Nothing nudges about a run that has a hare but no trail planned yet, which is the next thing a kennel forgets.

## 2026-09-19 - D46: Two mugs, and the refresh is the clink

Status: Active

The repo owner supplied `beer-mug.svg` — an animated mug, handle left, foam and splash thrown to the upper right — and asked for a mirrored twin, so that pulling the feed down brings the pair together and they touch when the refresh fires.

Decision:
- **Mirroring is a transform on the geometry, never on the element.** `beer-mug-mirror.svg` wraps the artist's paths in `translate(80.127991, 0) scale(-1, 1)` and changes nothing else, so the animation mirrors with the drawing: a tilt left becomes a tilt right, a splash thrown right is thrown left. Doing it as a CSS `scaleX(-1)` on the element would have been shorter and wrong — the element's own transform is needed for the clink, and an inline transform beats the class that drives it.
- **The components are generated from the asset, not transcribed.** `apps/web/components/feed/BeerMug.tsx` and `apps/mobile/src/components/feed/beer-mug.tsx` are both written by a script that reads `beer-mug.svg`. Path data is the artist's; hand-copying twenty-one paths into two platforms is a guarantee of drift.
- **The asset's animation is infinite; the spinner's is not.** The keyframes moved out of the SVG and into `globals.css`, gated on the wrapper's state. Nothing wobbles while a hasher is deciding whether to pull — the sloshing belongs to the clink, and a spinner that is always moving says nothing when it moves.
- **Four states, one pair of mugs**: apart and still; closing as the drag goes (`--pull`, 0 to 1); leaning in and trembling when the threshold is reached; then striking, coming apart and striking again while the feed loads. The captions say it in words — "Pull to refresh", "Let go for a clink", "On On…" — because the mugs are decoration and the text is the meaning.
- **The clink is re-timed, not reused.** The asset peaks at 30% of a 2.4s loop; the spinner runs 1.15s with the mug, foam, splash and droplet all peaking at the moment of contact, so the beer moves because the glass was struck.
- **The feed is revealed, not pushed.** The mugs sit in an absolutely positioned strip above the feed and the feed translates down over them, so nothing reflows and the drag stays at 60fps on a compositor transform.
- **`prefers-reduced-motion` gets the mugs, the pull and the states — just not the sloshing.** The information is in the position and the caption, both of which survive.
- **Native is the same asset and the same tempo, with less inside the glass.** `react-native-svg` does not take styles on a `<G>`, so the mobile mugs animate as whole views: the strike, the lean and the kick, at the same 1.15s. The beer does not slosh independently at 44px, and animated props for it would cost more than it is worth.
- **`RefreshControl` is gone from the mobile home screen.** It cannot host anything but the platform spinner, so the pull is a `Gesture.Pan` that only takes over while the list is at the top.

Rationale: the supplied asset, D42 (the home feed it refreshes), D35 (home is ISR, so refreshing is `router.refresh()`), and the hash's own vocabulary — a clink is what the end of a trail sounds like.

Consequences: `react-native-svg` is a new mobile dependency, the first the app has needed for drawing. `pull-to-refresh.tsx` carries a file-level `react-hooks/immutability` disable: Reanimated's whole API is assigning to `.value`, which the React Compiler lint reads as mutating a hook argument. The web refresh runs the clink for a fixed 900ms because `router.refresh()` reports no completion — honest for a server round trip on a local network, and worth revisiting if the feed ever gets slow. The gesture is bound to `window`, so it works with a mouse as well as a finger, which is how it was tested; on a phone it is the finger that matters and that has not been on a real device yet. **The mobile side is typechecked and lint-clean but has not been run** — no simulator here, and the Expo web target was left alone deliberately.

## 2026-09-19 - D47: A reel is something that is happening, so the camera is a first-class way in

Status: Active

Decision:
- **The composer offers two doors, side by side: the camera and the file picker.** A reel is a thing that happens — at the Circle, at a beer check, holding a mug at home — and making someone record in another app and come back to find the file is the wrong shape for that. Neither door is the fallback; a reel already shot is as normal as one shot now.
- **Recording is the browser's own MediaRecorder**, not a `capture` attribute on the file input. `capture` hands the job to the platform camera app and is ignored on the desktop entirely, so the same button would do three different things on three devices. This way the take happens in the dialog, on every browser that can reach a camera, and the hasher sees exactly what will be posted.
- **Nothing leaves the device until the reel is posted.** The take lives in memory as a Blob; discarding it costs nothing and uploads nothing. What the composer receives is an ordinary `File`, indistinguishable from a picked one, so it travels the existing presign → PUT → confirm road (D28) without a second code path.
- **The container is normalised, and this matters.** MediaRecorder reports `video/webm;codecs=vp9,opus`; the API's allow-list holds `video/webm`. Keeping the codec string would have been refused with `UNSUPPORTED_MEDIA_TYPE` on every recorded reel. The recorder asks for mp4 first and webm after, so Safari gets the container it mixes natively and everyone else gets theirs.
- **Thirty seconds, enforced by the clock rather than by hope.** The recorder counts down and stops itself, which keeps a take inside the 25MB cap; an over-size take is refused with its own size in the message rather than failing later at the API.
- **The front camera is mirrored in the preview, the back camera is not.** A person filming themselves expects a mirror; a person filming the trail expects the trail the way round it actually is.
- **The camera is closed on every exit.** One `stopStream` runs on unmount, on a flip, and on cancel, because a recording light left on is a promise broken.
- **A refusal is an instruction.** No permission, no camera, or no MediaRecorder each say what happened and point at the file picker, which is still right there.

Rationale: D41 (reels), D28 (uploads), J-005 in the Bible (photos and videos), and the fact that a beer face is not a file anybody has lying around.

Consequences: The **mobile app still has no reel composer at all** (D41), so this is the web only — and when mobile gets one it should use `expo-camera` rather than a port of this. Recording needs a secure context: it works on `localhost` and on https, and silently cannot on a plain-http origin, which is worth remembering the first time it is tested from a phone on the local network. There is no in-app trim, filter or retake-before-stop: a take is kept or discarded whole. Duration is read from the recorded file the same way it is for a picked one, and webm often reports `Infinity` until seeked, so some reels will carry a null duration until that is worth fixing.

## 2026-09-19 - D48: A reel is a post, not a clip

Status: Active

The repo owner asked for the rail to be filled, and for each reel to hold several videos and photos the way a post does on any other feed.

Decision:
- **A reel carries items, not a single video.** `Reel.mediaId` stays as the cover, and everything linked to the reel through `MediaLink` is the post: videos and photos together, in the order they were added. Nothing new in the schema — the links were already there, because BR-RUN-007 required every asset to be attached to something when it was created.
- **Order is `MediaLink.createdAt`**, which is the order the hasher picked them and the order they were uploaded. An explicit position column is what to add the day reordering after the fact becomes a feature; inventing it now would be a column nothing writes.
- **Publishing takes the first one added as the cover**, not the newest. It used to read `orderBy: desc` and take one link, which meant a two-item reel published the *last* upload as its cover.
- **A reel with nothing in it is not listed.** Items are fetched for the whole page in one query and a reel whose media has gone is dropped from the list rather than rendered as a broken player — which is exactly what my own test reels did before I archived them, and why the rail looked as though it had been removed.
- **The viewer is a carousel**: arrows, dots, arrow keys, a counter, one item at a time, videos keyed so moving on loads the new source rather than leaving the old one playing. The composer matches it — pick or record several, see them as thumbnails, drop any of them, the first is the cover, ten to a post.
- **The tile borrows a photo when it has to.** There is still no frame grab for video (D41), so a post that opens on a video shows the first photo in it rather than a grey box, and falls back to the kennel colour and a play icon only when there is nothing else.

Rationale: D41 (reels), D28 (uploads), BR-RUN-007, and how every feed a hasher already uses behaves.

Consequences: `Reel.video` is gone from the API shape, replaced by `items` and `itemCount`; anything reading the old field breaks loudly rather than quietly. Twenty seeded hashers now hold one post each, spread across four kennels with a third of them posted to no kennel at all — real bytes in R2, photos drawn by the seed and videos recorded from a canvas in a headless browser, because there is no ffmpeg here and a reel with no bytes is a broken player. The `/reels` grid asked for 48 and the API caps a page at 30, so it 400'd and the page read that as "no reels" — fixed by asking for 30, and a reminder that `publicGet(...).catch(() => null)` turns a contract mistake into an empty state. Paging that grid is still to do.

## 2026-09-19 - D49: The footprints are the mark

Status: Active

The repo owner added `hash-logo.svg` at the repo root and asked for it to be the brand logo everywhere a logo is implemented.

Decision:
- **The mark is the two footprints in `hash-logo.svg`**, and that file at the repo root is the source. Everything else is generated from it, so a redraw means re-running the generation rather than hand-editing twelve files.
- **The art is re-framed, not redrawn.** The drawing's own viewBox (`18.63 15.18 45.71 52.01`) is wrapped in `translate(-15.86 -15.51) scale(1.1536)` inside a `0 0 64 64` box, which fills the square with only 2px of padding. Every copy — web, admin, mobile, icons — uses that same transform, so they cannot drift apart.
- **The mark is a bolder weight than the drawing.** Each shape is stroked in its own ink as well as filled (`stroke-width 0.9`, round joins), which thickens every toe and sole without redrawing a path. In React that is `strokeWidth={0.9}`, camelCase — the kebab-case SVG spelling is an invalid DOM property and breaks hydration.
- **In the apps the mark is inline SVG, not an `<img>`.** `components/brand/HashLogo.tsx` (web and admin, duplicated on purpose like the rest of `components/ui`) and `src/components/brand/hash-logo.tsx` (mobile, `react-native-svg`) take their ink from `currentColor` or a prop, so the mark works in both themes without a second file.
- **There is no plate behind the mark.** The repo owner asked for the orange chip to go: `BrandMark` is the bare footprints in `text-foreground`, Hash Black on Flour in light and Flour on black in dark. It replaced the letter "H" in the web header, and appears in the admin sidebar, both login cards, the web register card, the signed-out welcome card, and the mobile app bar beside the `hcp` wordmark.
- **Favicons are `app/icon.svg` + `app/apple-icon.png`** in web and admin; the Next.js starter `favicon.ico` is gone from both. The SVG carries its own `prefers-color-scheme` rule, so the mark inks itself black on a light tab strip and Flour on a dark one. The admin copy adds a rounded ring so the two tabs are told apart at a glance; the Apple touch icons, which cannot be transparent, sit on Flour (web) and Hash Black (admin).
- **The Expo icons are raster, generated with `sharp`**: `icon.png` (1024), `favicon.png`, `splash-icon.png` (plus a Flour `splash-icon-dark.png`), and the Android adaptive foreground/monochrome with a 19% safe margin because the launcher masks them. The splash and adaptive background are Flour, dark splash is Hash Black, and the `ios.icon` override pointing at the leftover `assets/expo.icon` was removed so the phone uses the real icon. Watch the pixel size: `sharp` multiplies an SVG`s width by `density`, so these are resized explicitly rather than trusted to come out at the size the SVG asked for.

Rationale: D24 (the brand system), the repo owner asking for the mark bigger, bolder and off the orange chip, and the fact that a logo living in one file and one transform is the only way three apps keep the same mark.

Consequences: `/favicon.ico` now 404s on web and admin; the `<link rel="icon">` points at `icon.svg`, which every current browser honours, but anything that hard-codes the `.ico` path gets nothing. `apps/mobile/assets/expo.icon/` is now unreferenced Expo template art and can be deleted. There is still no `opengraph-image`, so a shared link carries no mark yet. The mobile app has no EAS project id, so the new icons are visible in Expo Go and a dev client but have not been through a real build.

## 2026-09-20 - D50: Following is interest, and engagement belongs to the thing, not to the page

Status: Active

The repo owner asked for followerships, follow and unfollow, likes, comments, reshare, bookmark and views. The Bible is silent on all of it — Chapter 9 asks for a community feed and BR-CXP-012 asks for meaningful participation over volume, but no chapter defines a social graph — so this is inferred and logged here.

Decision:
- **A follow is interest, not belonging.** A hasher follows other hashers and kennels. Following a kennel is **not joining it**: it grants no membership, no vote, no authority, and it is never counted towards the four active mismanagement members a kennel needs to be verified (D10). It also creates no channel of any kind — there is still no direct messaging (D8), and following somebody is a way to read them, not a way to reach them. Runs and events are not followable; a run is a kennel's announcement, and RSVP already says "I am coming".
- **Engagement is polymorphic, and one file decides who may do it.** Likes, comments, reshares, bookmarks and views all address a subject by `(SubjectType, id)` — a reel, a trail report, a photo, a run, a Run Capsule, or a comment. Every act resolves through `services/subject.service.ts#resolveSubject` first, which either returns the subject's context or throws the same **404** its own endpoint would. 404 and never 403, because a members-only run must not become findable by liking it. Bolting six verbs onto five routers instead would have been five chances to get trail secrecy wrong.
- **Only published things are engageable.** A draft reel, a draft trail report and a capsule still assembling are not; a photo is engageable exactly when the run it belongs to is visible, and a media asset attached to neither a run nor a reel is kennel branding or trail evidence and is not something to like.
- **The toggles are idempotent, and the history is the event.** Follow, like, bookmark and reshare are one row per (person, subject) with a nullable end date, re-activated rather than duplicated — liking twice is one like, and liking from two devices at once is still one like because the unique index says so. The append-only record is the `DomainEvent` (`HasherFollowed`, `ContentLiked`, `ContentReshared`, …), which is where append-only history belongs. The polymorphic `targetId` carries no foreign key, the shape `MediaLink` already uses: a nullable per-type column would let Postgres treat NULLs as distinct and admit duplicate follows straight through the unique index.
- **Comments are two levels and nothing is ever deleted.** A reply to a reply attaches to the same root, so a thread reads top to bottom without recursion. An author withdraws their own comment and a moderator takes one down; either way the row keeps its place — the replies under it would be orphaned otherwise — and says so instead of saying nothing. These are **not** `ReportReviewComment`, which is editorial and happens before publication (D29); this is the conversation after it. Moderation is the kennel's `media.moderate` holders, or platform staff for content belonging to no kennel, and every removal writes an `AuditLog` with a reason.
- **A reshare is a quote, and it opens no doors.** It is the sharer's own feed entry pointing at somebody else's, with optional commentary. It carries no visibility of its own: whoever may see the original may see the reshare and nobody else, which is the reel rule (D41) applied to a wrapper. The engagement bar on a reshare card acts on **the original**, because a like belongs to whoever made the thing. You cannot reshare your own post, so the button is not rendered on it — a UI that offers an action the API will always refuse is a lie.
- **A bookmark is private and a like is public.** Saving something never notifies the author and is never shown to anybody else; that is the whole difference between saving something and applauding it.
- **Views are deduped per signed-in viewer, and anonymous opens are a tally.** One `ContentView` row per viewer per subject with the repeats recorded on it; an anonymous open bumps `ContentStats.anonViewCount` instead, because the only way to dedupe it is to fingerprint somebody who has not said who they are, which Ch.13 is against and this platform does not need. A view is still deliberately **not** a domain event: it is a tally, not a decision anybody can act on.
- **The counters are denormalised into `ContentStats`,** one row per subject with a composite primary key. The feed asks for the numbers of twenty mixed things at once; six aggregate queries per card is the version of this that does not survive contact with a phone. `stats.service.ts` imports no other service, which is what keeps the cycle out of `services/`.
- **Only acts about a person reach that person.** A follow, a like, a comment, a reply and a reshare notify exactly one person, in a new `SOCIAL` notification category so a hasher can mute applause without muting the trail release that tells them where to run. A bookmark notifies nobody and a view is not news. Nobody is ever notified about their own act.
- **The feed gained a second scope and a new card.** `GET /feed?scope=FOLLOWING` narrows the same stream to the hashers and kennels this reader follows; signed out it is empty rather than secretly the wide one. `RESHARE` is a fourth `FeedItem` kind, and every card now carries its `engagement` block.
- **Share is not Reshare, and it is not counted.** Reshare passes a post along inside the hash and makes a feed entry; **Share** puts a URL on a clipboard or into WhatsApp and HCP never hears about it again. They sit next to each other on the bar because they read as the same gesture, and the dialog says which is which. There is deliberately **no share count**: the only thing HCP could count is presses of a button, and showing that as a number of times something was read would be a lie. The channels — WhatsApp first, because that is where a hash flyer actually lives (D43) — are plain documented share URLs, so no third-party SDK or tracking script enters the page, and every outbound link carries `rel="noopener noreferrer"` so the receiving site is not told which HCP page it came from. The phone's own share sheet covers everything else, so there is no list here to keep growing.
- **The dialog says so when a link will not work.** `subject.isPublic` is the same resolution run as nobody — not a second rule that could drift out of step with the first — and a members-only run's link is announced as private before it is sent, because finding that out from a confused reply is worse than being told first.
- **A share needs somewhere to land, so reels got their own page.** `/reels?reel=<id>` was the link notifications carried, and the reels grid ignored the query, so it opened the grid instead of the reel. `/reels/[id]` is a real server-rendered page with a title and Open Graph tags, and `resolveSubject` now points at it. The carousel moved to `components/feed/ReelCarousel.tsx` so the dialog and the page show the same one rather than two that drift apart.
- **A link preview is generated by a crawler, not by a member, so every one is built from an unauthenticated fetch.** That is both the honest question and the safe one: a members-only run yields nothing and gets a generic card rather than leaking its theme and meeting point into a group chat. Crucially the fallback card says 'Run' and not 'Run not found' — the member who can in fact open it would otherwise read that lie in their tab. `/runs/[id]` and `/reports/[id]` became thin Server Components around the interactive pages (`RunDetailPage`, `ReportDetailPage`), because only a Server Component can produce metadata and both pages have to stay client-side — one RSVPs and runs the Circle, the other writes and publishes. `lib/share-metadata.ts` gives all of them one shape, Open Graph and Twitter together, and drops a relative image rather than half-setting one.
- **A run's flyer is its preview picture.** `posterUrl` becomes `og:image` and the card becomes `summary_large_image`, so the flyer that already lands in WhatsApp today is the thing WhatsApp shows. A reel borrows its cover photo the same way, since a video still has no frame grab (D41).
- **The run page gained the bar it never had,** because a run is the flyer a kennel would otherwise paste into WhatsApp (D43) and is the thing most likely to be shared.
- **Copy has a fallback, twice.** The clipboard API needs a secure context and a permission the browser can refuse — over plain http on a phone on the kennel's wifi it will — so Copy falls back to selecting the field and the old `execCommand`, and if even that is refused it says so and leaves the link selected. A Copy button that silently does nothing is the one outcome worth ruling out.
- **Following somebody needs somewhere to press follow,** so `/hashers/:id` is now a public page: public identity only (D11) — the handle or "Just <firstName>", the picture, their own words, the kennels they run with. Biodata stays in `PersonProfile` and is not selected by that query at all. A hasher whose profile is `PRIVATE` is not followable, because following is a public relationship and the follower list would announce them.

Rationale: D41/D48 (reels are the hasher's own posts), D42 (the home page is a feed), D11 (public identity is the handle), D10 (what a kennel's member count means), D8 (no direct messaging), Ch.13 (privacy by design), Ch.22 (append-only state), Ch.24 (a state change writes an event in the same transaction).

Consequences: `Reel.viewCount` is no longer the number the API reports — `engagement.views` is, and it is the deduped one; the column is still mirrored so nothing reading it breaks, and the counts that already existed were carried into `ContentStats.anonViewCount` by a data migration rather than dropped to zero. `KennelDetail` gained `followerCount`, and `Reel` gained `engagement`. `scripts/social-check.ts` is 62 checks and is re-runnable against a database it has already run on — it derives the view expectation from the starting state rather than assuming a fresh one, which is the gripe `CODEX/TODO.md` records about the older check scripts. Not built yet: comment moderation has no admin screen (a moderator takes one down from the thread itself), the mobile app has none of this, `ContentStats.bookmarkCount` is written but nothing reads it, and the `Following` feed excludes run announcements because a run has no author to follow — a kennel you follow still brings its runs.

## 2026-09-20 - D51: A post is words, a reel is media, and both belong to the hasher

Status: Active

The repo owner asked for the "What's on trail?" box at the top of the feed to be typeable and postable, so what a hasher writes lands in other hashers' home feeds. The Bible is silent: Chapter 9's feed content list (09-03) is entirely derived material — Run Capsules, events, announcements, recognition, milestones — and describes nothing a hasher writes directly. Inferred and logged here.

Decision:
- **A post is its own thing, not a kind of reel.** D48 refuses a reel with nothing in it, and rightly: a reel with no media is a broken player. A post with no photo is just a post. So `Post` is the sibling of `Reel`, not a special case of it — a reel is media with a caption, a post is words with optional photos — and both belong to the hasher rather than to a kennel (D41). "Reels" would also be the wrong word in front of a hasher writing a sentence.
- **A post is always public.** The repo owner chose this over an audience picker. There is therefore **no `visibility` column**: a column with one possible value is a promise the schema cannot keep, and adding audiences later means adding the column then, in the migration that admits it. The composer says "Anyone can see this" out loud rather than leaving the hasher to infer it.
- **A kennel is context, not an audience.** `kennelId` and `runId` say where the hasher was, the way a reel's do. Claiming a kennel still requires being a member of it; claiming a run still requires being able to see it.
- **Posting is create, upload, publish** — the same three steps a reel takes (D28, D48). The draft exists so photos have somewhere to land. A post with no photos runs the same road with the middle step empty: one flow rather than two, and nothing half-uploaded ever reaches the feed. Photos upload **sequentially**, because a phone on a kennel's wifi sending four at once is four slow uploads, and a failure halfway leaves an unpublished draft rather than a post with holes in it.
- **Words or a photo, but not neither.** Publishing an empty post is `POST_EMPTY`. A draft is invisible to everybody but its author, and a removed post is invisible to everybody including them.
- **Engagement needed no special case.** `SubjectType.POST` slots into the D50 machinery and a post is likeable, commentable, reshareable, bookmarkable and countable on the day it exists. That is the return on having made engagement polymorphic rather than bolting it onto each type.
- **History is append-only, as everywhere else.** The author archives; a moderator removes with a reason and an `AuditLog`, policed by the kennel's `media.moderate` holders or by platform staff for a post made outside a kennel — the division reels already use.
- **Posting evicts the feed's cache immediately.** The home page is cached for 60 seconds (D42), so without this a hasher posts, the page comes back, and their post is not on it — the moment where that window reads as a bug rather than a delay. Two things fix it: `PostPublished` rides the D35 revalidation outbox, so everyone else sees it within the five-second tick; and the composer raises `FEED_REFRESH_EVENT`, which the feed now listens to and answers by reloading from the API, which is never cached. That event already existed for pull-to-refresh and **only the reel rail was listening** — so pull-to-refresh did not actually refresh the feed either. It does now.

Rationale: D41 and D48 (what a reel is and is not), D42 (the home page is a feed), D28 (uploads), D35 (a cached page has to be told), D50 (polymorphic engagement), Ch.22 (append-only state), Ch.24 (a state change writes an event in the same transaction).

Consequences: `SubjectType` and `MediaTargetType` both gained `POST`, and `/posts/[id]` is a server-rendered page with Open Graph tags so a shared post previews with its first photo and its opening words. `media.validator.ts` kept its **own copy** of the list of upload targets, so adding `POST` to the service left the validator refusing it with "must be one of [RUN, TRAIL, …]" — a 400 that blamed the caller for something the service would have accepted. The list is now exported from `media.service.ts` and the validator reads it, so the two cannot drift again. `scripts/social-check.ts` is 95 checks. Not built: no notification when somebody you follow posts (reels do not notify either, and a follow feed is the place to see them); no editing of photos after posting, only of words; the composer posts to no kennel, so `Post.kennelId` is written by nothing in the UI yet; and mobile has none of this.

## 2026-09-24 - D52: Withdrawing a pending membership request is its own terminal state

Status: Active

D20 named this gap directly: "Withdrawing a pending request needs a Chapter 24 event first." Building it.

Decision:
- `MembershipStatus` gains **`WITHDRAWN`**, reachable only from `APPLICANT` or `PENDING_REVIEW`, self-authority only (`POST /memberships/:id/withdraw`). Chapter 22 A.2 updated.
- Withdrawn is not Rejected. Rejected is an officer's decision and starts the reapply cooldown (D20); Withdrawn is the applicant's own and does not — `checkEligibility`'s switch has no `WITHDRAWN` case, so it falls to the default `{ ok: true }` and a fresh request is allowed immediately.
- Reuses the existing generic `transition()`/`SPECS` machinery in `membership.service.ts` rather than a bespoke code path — the same guarded-update, timeline-entry, event-and-audit sequence every other membership transition uses.
- `MembershipRequestWithdrawn` added to Chapter 24's Identity & Membership Events table (Membership Service, Audit only — no officer was ever waiting on a decision to be notified of).

Rationale: D20's own consequence, Chapter 22 A.2, Chapter 24's event table, Ch.22's rule that history is append-only (a withdrawn row stays as history rather than being deleted).

Consequences: `MembershipTimelineType` gained `WITHDRAWAL`. Existing rows are unaffected (a new enum value, no backfill). Web/mobile UI for a "Withdraw" button on a pending request is not built yet.

## 2026-09-24 - D53: Membership invitations are the one door into a hidden kennel

Status: Active

FR-MEMBER-005's model (`MembershipInvitation`) and `InvitationMethod` enum had been in the schema since the Chapter 23 draft, unused. D20 already named the gap: "Hidden kennels require an invitation (not built yet)." Building it.

Decision:
- Three methods, matching FR-MEMBER-005 exactly: `EMAIL` (sent immediately, HCP's usual layout), `QR_CODE` and `LINK` (both just hand back a redeemable URL — this repo has no QR-image rendering yet, so a QR-code invite is today a link an officer can turn into a QR code themselves; the frontend does not fake one).
- Same token shape as email verification and password reset: 32 random bytes, SHA-256 hash stored, single-use. The plaintext token/link is returned **only** in the creation response — an officer who navigates away before copying it has to revoke and issue a new one, the same trade every one-time-secret flow on this platform makes.
- Redeeming an invitation **skips `checkEligibility` entirely** rather than special-casing it to allow `HIDDEN`. An invitation is not a request that happens to get pre-approved; the officer who sent it already made the decision, so `acceptInvitation` creates the `Membership` row `ACTIVE` from nothing, the same authority `approve()` exercises on a pending one.
- The accompanying event is `MembershipApproved` — the existing one — not a bespoke `MembershipInvitationApproved`. `notification.service.ts` already fans that out with "Welcome to `<kennel>`"; an invited hasher is functionally an approved one, and inventing a parallel event would mean either two "welcome" notifications or a second case in `specFor` that says the same thing.
- Expiry is configurable (`membership.invitationExpiryDays`, default 14, `PlatformSetting`), matching the `membership.reapplyCooldownDays` pattern (D20). Revocation is blocked once accepted, allowed (idempotently) once already revoked.
- The membership timeline still gets both a `REQUESTED` and an `APPROVED` entry, one hasher-authored and one officer-authored, even though no review ever happened — an officer reading a member's history later sees the same two-beat shape every other approval leaves, with the note ("Joined by invitation" / "Invitation accepted") as the only tell.

Rationale: FR-MEMBER-005, D20 (the hidden-kennel gap this closes), Ch.22 A.2 (Membership Lifecycle — an invitation is a way to *reach* Active, not a new state), Ch.24 (event-per-transaction), the token pattern already established by D31 (email verification) and the password-reset work earlier this session.

Consequences: Chapter 24 gained `MembershipInvitationSent`, `MembershipInvitationRevoked`, `MembershipInvitationAccepted`. QR rendering was deferred at the time of this decision; the same session's Passport QR work (FR-PASSPORT-007) added `components/QrCode.tsx`, and `InvitationsPanel.tsx` now uses it for the `QR_CODE` method too — the note above is stale as of that change. Nothing notifies an officer when their invitation is accepted beyond the audit trail; if that turns out to matter, `MembershipInvitationAccepted` is already the hook to fan out from.

## 2026-09-24 - D54: A guest's contact details are for whoever is running the trail, not the whole roster

Status: Active

D23 left this open: "Decide whether hares and officers may see a guest's email or phone for on-trail safety." Codex inference, the Bible is silent on the specific answer.

Decision:
- A guest's email and phone show up on a run's participant list only for whoever actually **operates** that run — a hare (`canOperate`, same test `run.service.ts` already uses for the run-day actions) or an officer holding `run.manage`. Not every kennel member who can merely see the roster (`canSeeNames`, D23's own broader gate) — a guest's phone number is a step up in sensitivity from their name being on a list, and "on-trail safety" names the person who'd actually need to place the call.
- The field is `contact: { email, phone } | null` on each participant row, `null` whenever the viewer does not qualify — the frontend never has to re-derive the permission, it only has something to render or it doesn't.

Rationale: D23 (who sees the roster at all, and why), D2/attendance.service.ts (a guest holds no account and no other channel to reach them), the general pattern that safety-relevant contact detail is scoped to who could act on it, not to everyone present.

Consequences: `guest.email`/`guest.phone` are now selected in `getRunDetail`; nothing else changed about `GuestProfile`'s own privacy. Web shows it as a small line under a guest's name on the attendance card, present only when the API sent it. Mobile has no run-detail contact display; not addressed here.

## 2026-09-24 - D55: Down-downs default on; a kennel opts out, not in

Status: Active

FR-CIRCLE-006 says only "Kennels may disable this feature." Building the smallest version of that — the toggle, not the other two Circle FRs bundled with it in the TODO line (attendance and privacy levels; see that line for why they're bigger and stayed open).

Decision:
- `Kennel.downDownsEnabled` defaults `true`. Down-downs are the default Hash tradition; a kennel that wants none records that choice explicitly rather than every kennel needing to opt in on day one.
- The toggle governs `isDownDown: true` specifically, not awards in general — a kennel that has switched off down-downs can still record "Best Trail" or "Hare Recognition." `FR-CIRCLE-006`'s own text only ever names down-downs.
- Enforced server-side (`addAward` throws `DOWN_DOWNS_DISABLED`), with the web checkbox hidden rather than disabled-and-explained for a kennel that has it off — nothing to explain when the option is simply absent.

Rationale: FR-CIRCLE-006's exact wording, the established pattern for a self-service kennel setting (D24's brand colours, same session).

Consequences: `apps/admin` was not touched — this is a kennel-self-service setting (D34), the same category as brand colours, not part of admin's kennel CRUD.
