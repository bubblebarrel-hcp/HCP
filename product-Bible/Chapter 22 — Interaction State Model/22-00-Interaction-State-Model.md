# Chapter 22 — Interaction State Model

Document ID: HCP-PB-22

Parent Document: HCP Product Bible

Status: Draft

Version: 1.0

Date: 2026-08-10

Authority: Codex-inferred and consolidated from Chapter 8 annexes (08C, 08D, 08E, 08F, 08G, 08H, 08K, 08L, 08M, 08P) and `CODEX/ARCHITECTURE-RULES.md`. Not previously a repository file. See `CODEX/DECISION-LOG.md` for the decision to add this chapter.

---

# Purpose

Chapter 8 defines the lifecycle of individual domains (Kennels, Membership, Runs, Trails, Scribe Studio, Run Capsule, Events, Governance) separately, each in its own annex. No single document previously collected these into one canonical state model, and none of them addressed client-side interaction state (loading, offline, syncing, conflict) at all.

Chapter 22 is that canonical state model. It exists so that:

- Every entity with a lifecycle has exactly one authoritative state diagram.
- Every state has defined entry/exit actors and guard conditions.
- Client interaction state (a concern the Chapter 8 annexes do not cover) is specified before mobile/web implementation begins, per the offline requirement in the HCP vision and `CODEX/ARCHITECTURE-RULES.md`.

Where this chapter's state names differ from the source annex, the source annex is authoritative per the Authority Order in `CODEX/HCP-CODEX-HANDOFF.md`, and the difference is recorded under **Contradictions & Gaps** below rather than silently resolved.

---

# Modeling Conventions

Each state machine in this chapter is written as:

```text
State A → State B → State C
```

for the primary/expected path, with a **Guards & Alternate Transitions** list for branches, rejections, and reversals. Each machine also lists:

- **Owning Domain** — the Chapter 8 annex that is authoritative for this entity.
- **Actors** — who may trigger a transition.
- **Invalid transitions** — rejected by the platform (all annexes agree these must be enforced server-side, not just hidden in UI).

State names are copied verbatim from the source annex wherever possible so this chapter can be diffed against Chapter 8 later without translation loss.

---

# Part A — Core Entity State Machines

## A.1 Kennel Lifecycle

Owning Domain: Annex 08C — Kennels.

```text
Draft → Pending Verification → Active → Inactive → Archived
```

Actors: Creator (Draft only), Platform/Community Verifiers (Pending Verification → Active), Kennel Officers (Active ↔ Inactive), Platform Admin (→ Archived).

Guards & Alternate Transitions:
- Verification level is itself a sub-state of Active (Pending, Community Verified, Officer Verified, Platform Verified per FR-KENNEL-002) and does not gate core functionality — it gates trust signals shown elsewhere (see Chapter 22 A.8).
- Archived kennels are read-only; reactivation requires Platform Admin action and is logged.

Invalid transitions: Draft → Active (must pass through Pending Verification); Archived → any state other than Active via explicit Platform Admin reactivation.

## A.2 Membership Lifecycle

Owning Domain: Annex 08L (08L-01, organization-level) and Annex 08D (08D, member-facing detail). **These two annexes define overlapping but non-identical status vocabularies — see Contradictions & Gaps, item 1.** This chapter adopts the reconciled model below as the implementation-ready canonical state set; Chapter 8 remains the requirements source.

```text
Applicant → Pending Review → Active → Inactive / Suspended → Resigned / Removed → Archived
```

Actors: Applicant (Applicant), Kennel Officers (Pending Review → Active/Rejected, → Suspended, → Removed), Member (→ Resigned, or Applicant/Pending Review → **Withdrawn**), System (Active → Inactive after configurable dormancy, if a kennel enables it).

Guards & Alternate Transitions:
- Visiting Member and Honorary Member are membership **types**, not states — a Visiting Member still carries one of the states above (see Chapter 23, Membership entity).
- Suspended → Active (Reinstatement, FR-MEMBER-009) preserves original join date and history.
- Resigned and Removed are terminal for the membership record but never delete historical participation (BR pattern repeated across every annex: history is immutable).
- Officer roles must be relinquished before a member may transition to Resigned (FR-MEMBER-014).
- Stakeholder decision (D52): an applicant may **Withdraw** their own request while it is Applicant or Pending Review. Withdrawn is terminal, distinct from Rejected (an officer decision) and from Resigned (leaving an active membership), and does not start the reapply cooldown (D20) since no officer ever declined it.

Invalid transitions: Any state → Active without passing through an approval step, except Reinstatement from Suspended/Inactive.

## A.3 Run Session Lifecycle

Owning Domain: Annex 08E — Runs (08E-01, 08E-06).

```text
Draft → Scheduled → Planning → Trail Hidden → Trail Released → Check-In Open → Live Run → Circle → Reporting → Archived → Run Capsule
```

Actors: Hare/Trail Master/Officer (Draft → Planning stages), Hare (Trail Hidden → Trail Released, per configured release mode), Officers (Check-In Open, Live Run start/pause/resume/end), System (Circle → Reporting → Archived → Run Capsule, largely automatic per FR-RUN-013 through FR-RUN-016).

Guards & Alternate Transitions:
- Live Run supports a **Paused** sub-state (FR-RUN-010/011); pause duration is recorded on the timeline and the run returns to Live Run on resume. Paused is not a sibling of Live Run in the top-level chain — it is a transient interruption of it.
- Archived → Run Capsule is automatic and immediate (FR-RUN-016); a Run Session and its Run Capsule are effectively the same object post-archival, viewed through two lenses (operational vs. historical). See Chapter 23 A.3 for the entity relationship.
- Circle may be explicitly skipped by an authorized officer, but a reason must be recorded (BR-RUN-005).
- **Cancelled** (added 2026-09-15, stakeholder decision D22): an officer holding run authority may cancel a run from Draft, Scheduled, Planning, Trail Hidden, Trail Released or Check-In Open, with a required reason (rain-outs, venue loss, safety). Cancelled is terminal. The run stays visible as cancelled, RSVPs are kept for the record, and nothing is deleted. A run that has gone Live is ended, not cancelled.

Invalid transitions: Skipping Trail Hidden → Live Run directly is rejected; Trail Released must occur even under "release at run start" mode, it simply co-occurs with Check-In Open/Live Run in that configuration rather than being skipped. Live Run or any later state → Cancelled is rejected; Cancelled → any state is rejected (a replacement run is planned instead).

## A.4 Trail Lifecycle

Owning Domain: Annex 08F — Trail Studio (08F-01, 08F-06).

```text
Idea → Draft → Planning → Review → Locked → Hidden → Released → Live → Completed → Archived → Historic Trail
```

Actors: Hare/Co-Hare (Idea → Review), Hare (Lock, per FR-TRAIL-005), Officer (may unlock), Hare (Hidden → Released, per configured release mode from FR-TRAIL-007).

Guards & Alternate Transitions:
- A Trail cannot exist without an associated Run Session (BR-TRAIL-002); its lifecycle advances in lockstep with, but is not identical to, the parent Run Session lifecycle (A.3). Hidden/Released trail states are the mechanism behind the Run Session's own Trail Hidden/Trail Released states.
- Restore Draft is a permitted reverse transition from Locked (per the 08F-06 permission matrix), but never from Hidden or later — secrecy, once active, is not silently reversible.

Invalid transitions: Released → Hidden (secrecy cannot be re-imposed once participants have navigation access); Archived/Historic Trail → any editable state (corrections become revisions, not edits, per BR-TRAIL-014).

## A.5 Trail Report Lifecycle (Scribe Studio)

Owning Domain: Annex 08G — Scribe Studio (08G-01, 08G-06).

The **Story Collection** process (continuous, automatic, running throughout the Run Session — see 08G-01) is not itself a state machine; it is a background aggregation feed into the Story Graph. The **Trail Report** (the editorial artifact the Scribe publishes) has its own state machine:

```text
Draft → Scribe Editing → Review → Published → Archived
```

Actors: Scribe/Assistant Scribe (Draft, Scribe Editing), Reviewers if enabled (Review — comment/suggest only), Scribe or Officer (Published — BR-SCRIBE-002 restricts this to exactly one Official Trail Report per Run Session).

Guards & Alternate Transitions:
- Multiple Draft revisions may exist simultaneously (FR-STORY-006); only one becomes the Official Trail Report at Published.
- AI-assisted drafts are clearly a sub-state/flag on Draft (`aiAssisted: true` until a human accepts each suggestion), never a separate lifecycle state — AI drafts cannot reach Published without passing through human Scribe Editing (BR-SCRIBE-005).

Invalid transitions: Draft → Published directly (must pass Scribe Editing at minimum); Published → Draft (corrections create a new revision, the original publication is preserved per BR-SCRIBE-011).

## A.6 Run Capsule Lifecycle

Owning Domain: Annex 08H — Run Capsule (08H-01, 08H-05).

```text
Planned → Preparing → Live → Draft → Pending Publication → Published → Archived → Legacy
```

Actors: System (Planned through Draft — fully automatic per FR-CAPSULE-001/002), Scribe/Officer (Pending Publication → Published, gated by Trail Report publication), Officer/Admin (→ Archived).

Guards & Alternate Transitions:
- Legacy is a distinct entry point, not a downstream state — historic runs imported from legacy systems enter directly at Legacy (FR-CAPSULE-010) and may be incrementally enriched without ever having passed through Planned/Preparing/Live.
- Supplemental contributions (BR-CAPSULE-005) may be attached to a Published or Archived Capsule without changing its state — enrichment after publication does not revert the state machine.

Invalid transitions: Published/Archived/Legacy → Draft (the historical record does not reopen; corrections are revisions per BR-CAPSULE-004).

## A.7 Event Lifecycle (Multi-Participant / Interhash Events)

Owning Domain: Annex 08K — Event & Interhash Management (08K-00).

```text
Draft → Planning → Registration Open → Registration Closed → Preparation → Live Event → Completed → Archived
```

Actors: Organizer/Committee (Draft → Preparation), System or Organizer (Registration Open/Closed, per configured cutoff), Organizer (Live Event, Completed).

Guards & Alternate Transitions:
- A single Event may contain multiple child Run Sessions (weekly-run-style) or Sessions/Activities (conference-style), each with its own state machine (A.3). The Event state gates which child-object operations are available, but does not directly drive them.

Invalid transitions: Registration Open before Planning is complete; Completed → Live Event (an event does not un-conclude — post-event corrections are handled as Run Capsule/Trail Report revisions on the child objects, not Event state reversal).

## A.8 Kennel Verification Level (Sub-state of Kennel Active)

Owning Domain: Annex 08C (FR-KENNEL-002).

```text
Pending → Community Verified → Officer Verified → Platform Verified
```

This is a monotonically increasing trust indicator layered on top of A.1, not a separate lifecycle. It never regresses automatically; only a Platform Admin action can demote it, and that action is audited (see Chapter 24, `KennelVerificationLevelChanged`).

## A.8b Follow (D50, D57)

A follow is interest, not belonging: it grants no membership, no vote and no authority. Whether it is live depends on the profile followed.

| State | Meaning | Enters from |
|---|---|---|
| Pending | A request waiting for the hasher's yes. Opens nothing and is not counted | Asking to follow a FOLLOWERS (locked) profile |
| Active | A live follow: counted, listed, and what puts the hasher's things in a feed and opens a locked profile | Following a PUBLIC profile; Pending approved; a PUBLIC profile opened to everyone |
| Ended | `unfollowedAt` set: unfollowed, a request withdrawn or declined, or a follower removed. The row is reused if they ask again | Active or Pending |

A profile has an audience (`Audience`: PUBLIC, FOLLOWERS, ONLY_ME). FOLLOWERS makes a follow Pending; ONLY_ME takes no new follows. A kennel follow is always Active.

## A.9 Identity Trust Level (Sub-state of Identity, Cross-Cutting)

Owning Domain: Annex 08M (FR-ID-010).

```text
Unverified → Verified Email → Verified Member → Trusted Volunteer → Officer Verified → Organization Verified → Platform Verified
```

Trust Level is per-Identity (not per-Membership) and is consumed by the Authorization model (08M-03) as one input among several (role, relationship, policy) — it is advisory context, not itself a permission grant. See Chapter 23 for the Identity/TrustLevel relationship and Chapter 24 for `TrustLevelChanged`.

## A.10 Officer / Role Assignment State (Cross-Cutting, Inferred)

Owning Domain: Synthesized from Annex 08L (08L-01 FR-GOV-006, 08L-04 FR-GOV-033) and Annex 08M (FR-ID-024). No single source annex states this as an explicit machine; Chapter 8 describes appointment and delegation as events with start/end dates. This chapter makes the implicit state machine explicit:

```text
Nominated → Appointed → Active → Term Ended / Delegated / Revoked → Historical
```

Actors: Nominating body/electorate (Nominated), Organization per its governance policy (Appointed), Delegator (Delegated — time-boxed, auto-expires per FR-GOV-033), Officer/Organization (Term Ended, Resignation), Organization/Admin (Revoked — for cause).

Guards & Alternate Transitions:
- Delegated is a parallel, time-limited grant of a subset of an Active officer's authority to a third party; it does not change the delegating officer's own Active state, and it auto-expires without requiring a manual transition.
- All terminal transitions (Term Ended, Revoked, Resignation) land on Historical, preserved permanently on the org's Leadership Timeline (FR-GOV-006) — never deleted.

This is flagged as **Codex-inferred** in `CODEX/DECISION-LOG.md` since no annex states it as a formal machine.

## A.11 Notification Delivery State (Cross-Cutting)

Owning Domain: Annex 08P — Notification Center (08P-01).

```text
Created → Evaluated → Queued/Batched/Digested → Delivered → Read/Acknowledged → Expired
```

Actors: System only (fully automatic per FR-NOT-004 Attention Intelligence evaluation).

Guards & Alternate Transitions:
- Evaluated may branch to any of Immediate, Batch, Digest, Scheduled, Escalated, Manual Approval, or Silent Update delivery policies (FR-NOT-008) before reaching Delivered.
- Critical-priority notifications may bypass Quiet Hours suppression (FR-NOT-006) but still pass through Evaluated for the explainability record (FR-NOT-010).

Invalid transitions: Delivered → Queued (a delivered notification is immutable per FR-NOT-001; a correction is a new notification, not a re-delivery).

---

# Part B — Client Interaction States (Offline & Sync)

The HCP vision requires offline behavior "where practical, especially for run participation, maps, media capture, and later sync" (`CODEX/HCP-CODEX-HANDOFF.md`). No Chapter 8 annex specifies client-side interaction state. This section is **Codex-inferred** and should be treated as Proposed pending implementation review, not Approved requirements.

## B.1 Sync Status (applies to any locally-editable object: Trail plans, Trail Report drafts, membership actions taken offline, etc.)

```text
Local Draft → Queued for Sync → Syncing → Synced
                                     ↘ Conflict → Resolved → Synced
                                     ↘ Sync Failed → Retry → Syncing
```

Rules:
- An object in Local Draft or Queued for Sync is visible only to its author; it does not affect any other user's view or count toward server-side state (e.g., attendance) until Synced.
- Conflict resolution never silently discards data — per the repeated Chapter 8 principle that history/edits must be attributable, a Conflict must present both versions to the user (or, for structured fields, apply a documented merge policy) rather than last-write-wins.
- Domain events (Chapter 24) are only emitted once an action reaches Synced. A Queued or Syncing action has not "happened" from the platform's point of view yet.

## B.2 Media Upload Queue State

```text
Captured → Queued → Uploading → Processing → Available
                        ↘ Upload Failed → Retry → Uploading
```

Rules:
- Captured media is stored locally immediately (per the offline-first media capture requirement) and is queryable by its own device before Available.
- Processing covers server-side transcoding/moderation (BR-RUN-012 moderation options: immediate, officer approval, AI-assisted, community reporting) — Available is only reached after any configured moderation gate clears.
- MediaAsset ownership/attribution (BR-CAPSULE-007, BR-RUN-007) is fixed at Captured and does not change through the rest of the state machine.

## B.3 Trail Release — Offline Device Behavior

This state exists specifically to satisfy the requirement that "hidden/timed trail release must be enforced by backend authorization, not only UI hiding" (`CODEX/ARCHITECTURE-RULES.md`).

```text
Locked (No Local Data) → Pre-Cached Encrypted → Release Condition Met (Online) → Decrypted Locally
Locked (No Local Data) → Pre-Cached Encrypted → Release Condition Met (Offline, Cached Rule) → Decrypted Locally (Provisional) → Server-Confirmed
```

Rules:
- A device may pre-cache the encrypted trail payload before release (to support offline participation) but must not hold the decryption capability until the release condition is met.
- For time-based or check-in-based release conditions, the device may evaluate the condition locally while offline (Provisional decrypt) **only if** the kennel's release policy explicitly allows offline provisional release; this must reconcile with the server on reconnect, and any discrepancy (e.g., clock skew, revoked release) is logged as an audit/security event (Chapter 24) even though the trail was already shown to the participant.
- Manual-release and geofenced-release modes should default to requiring connectivity, since they depend on a live authorization decision (an officer's manual action, or a server-verified geofence), unless a kennel explicitly opts into offline-tolerant behavior. This default-secure choice is a Codex inference and should be confirmed with the Product Bible owner — flagged in `CODEX/TODO.md`.

## B.4 Offline Map & Trail Data Availability

```text
Not Downloaded → Downloading → Available Offline → Stale (Newer Version Exists) → Updating → Available Offline
```

Rules:
- Stale data remains usable (participation should never hard-block on connectivity) but is visually indicated as potentially outdated.
- Beer Checks, waypoints, and hazards downloaded for offline use follow the same secrecy rules as B.3 — offline caching of Hidden-state trail data is not permitted; only Released trail data may be cached for offline map use.

## B.5 Generic Screen/Request States (Cross-Cutting UI)

Every screen or data-fetching interaction in the mobile and web clients should resolve to one of:

```text
Loading → Success
Loading → Empty
Loading → Error (Retryable) → Loading
Loading → Error (Unauthorized) → [Auth flow]
Loading → Offline (Cached Data Shown) → Success (Refreshed)
```

This is standard client UX and is listed here only so Chapter 21 task flows and Chapter 24 events can reference it consistently rather than each task flow inventing its own vocabulary.

---

# Contradictions & Gaps

Per the Required Codex Behavior in the handoff ("write down contradictions before resolving them"), the following are logged rather than silently resolved:

1. **Membership status vocabulary mismatch.** Annex 08L-01 (FR-GOV-002) lists organization-level membership states as *Applicant, Pending Review, Active, Visiting Member, Honorary Member, Inactive, Suspended, Archived*. Annex 08D (FR-MEMBER-004) lists member-facing statuses as *Pending, Active, Suspended, Inactive, Resigned, Removed, Archived*. Section A.2 above reconciles these by treating Visiting Member/Honorary Member as membership **types** (already modeled separately in 08D FR-MEMBER-003) rather than states, and by adopting 08D's Resigned/Removed as the terminal states 08L does not explicitly enumerate. This reconciliation is Codex-inferred; it should be confirmed against the referenced conversation's original Chapter 22 draft if that source becomes available, and is logged in `CODEX/DECISION-LOG.md`.

2. **Communication Hub scope vs. no-DM MVP rule.** Annex 08O (Communication Hub overview) lists "Direct messaging" and "Private Chat" among its supported scope and conversation types. `CODEX/HCP-CODEX-HANDOFF.md` and `CODEX/ARCHITECTURE-RULES.md` both explicitly exclude one-to-one DMs from MVP. This chapter treats Direct/Private Chat as **out of MVP scope, Future** per the handoff's authority (handoff package outranks a Chapter 8 annex only where the annex is describing long-term platform scope rather than MVP scope — annexes elsewhere in Chapter 8 do distinguish current vs. future capability, e.g. 08P-02 "future"). No state machine for Direct Message is included in this chapter. Flagged in `CODEX/TODO.md`.

3. **Officer/Role Assignment (A.10) has no source state machine.** Synthesized from appointment/delegation business rules scattered across 08L and 08M. Marked Codex-inferred above.

4. **Client interaction states (Part B) have no Chapter 8 source at all.** The offline requirement is stated as a principle in the handoff and in `CODEX/ARCHITECTURE-RULES.md` but never specified as concrete states anywhere in the existing Product Bible. All of Part B is Codex-inferred and Proposed, not Approved.

5. **Trail offline provisional release (B.3)** introduces a security-relevant default (deny offline provisional release for manual/geofenced modes) that is not stated anywhere in Chapter 8. This needs explicit product sign-off before implementation and is carried into `CODEX/TODO.md`.

7. **FR-CAPSULE-001 is defined twice, with opposite triggers (logged 2026-09-17).** Annex 08H-01 ("Automatic Capsule Creation") states a Run Capsule "shall be created automatically when a Run Session is created", beginning life as a living draft. Annex 08E-05, using the same requirement ID, states the platform "shall automatically generate a Run Capsule when a Run Session enters the Archived state". Chapter 22 A.6 names 08H as the owning domain for this lifecycle and Chapter 23 describes the capsule as "auto-created at Draft, finalized at Archived", so 08H-01 is authoritative: the capsule row exists from run creation and 08E-05's "generate" is read as *finalise*. Implemented that way per D30. 08E-05 should be re-worded, or its requirement re-numbered, in the next Bible pass.

6. **Run cancellation (resolved 2026-09-15).** Annex 08E had no way to call off a run, while Chapter 21 journeys (J-004, J-008, TF-003) expect cancelled runs to show clearly. A.3 now includes a terminal Cancelled state per stakeholder decision D22. The Run Capsule lifecycle (A.6) is unchanged: a cancelled run's capsule simply never advances past Preparing. Postponement is not modelled; the run is edited or cancelled.

---

# Relationship To Other Chapters

- Chapter 23 (Domain Model) defines the entities these states belong to and their `status` fields.
- Chapter 24 (Domain Events) defines the event emitted on each transition in this chapter — every arrow in every diagram above should have a corresponding past-tense event in the Chapter 24 registry.
- Chapter 21 task flows should reference the state names in this chapter directly rather than inventing per-flow state vocabulary; TF-003 through TF-010 are not yet updated to do so (see Chapter 21 traceability matrix, added as part of this same documentation pass).

---

# Completion Criteria

This chapter is complete when:

- Every entity lifecycle already defined in Chapter 8 has a corresponding, terminology-consistent state machine here.
- Every state machine names its owning domain, actors, and invalid transitions.
- Client interaction states required by the offline principle are specified at least at Proposed status.
- All contradictions between source annexes, or between an annex and the CODEX handoff, are logged rather than silently resolved.
