# HCP Permission Matrix

Document ID: HCP-PERMISSION-MATRIX

Status: Active (membership rows implemented; other rows are the agreed plan)

Date: 2026-09-15

Sources: Annex 08L-04 (FR-GOV-031 to FR-GOV-033, Permission Matrix), 08L-05 (Permission Principles), Annex 08D (FR-MEMBER-001 to 015), Chapter 22 A.2 and A.10, D3, D10, D13, D19, D20.

Implementation: `apps/api/src/services/permission.service.ts` resolves every rule below against the database. Keep this document and that file in step.

---

# 1. Principles

- **A person is never a role.** `User.platformRole` is only USER or ADMIN. Everything kennel-scoped comes from database rows, checked in services on every request, never from a token claim.
- **Least privilege.** A permission exists only where a row grants it. There is no implicit "officers can do everything".
- **Separation of duties.** Nobody approves, rejects, suspends, reinstates or removes their own membership, whatever authority they hold.
- **Every decision is explainable.** Each audited action records `AuditLog.policyRef`: how the actor was authorized.
- **History is append-only.** Transitions add timeline entries, domain events and audit rows. Nothing is edited or deleted.

---

# 2. Principals

| Principal | Defined by | Notes |
| --- | --- | --- |
| Visitor | No session | Public pages only. |
| Hasher | Signed-in user with `User.status = ACTIVE` | Can ask to join kennels. |
| Applicant | `Membership` in `PENDING_REVIEW` (or `APPLICANT`) | Sees their own request and timeline. |
| Member | `Membership` in `ACTIVE` | The base for all kennel authority below. |
| Officer | `OfficerAppointment` ACTIVE, not past `endDate`, position not archived | Holds exactly the keys in `OfficerPosition.permissions`. |
| Kennel admin | `RoleAssignment` role `KENNEL_ADMIN`, ACTIVE, not past `endDate` | Holds every kennel permission for that kennel (D3). |
| Delegate | `Delegation` to the user, started, not expired, not revoked | Holds the delegated keys the delegator currently holds (FR-GOV-033). |
| Run hare | `RunHare` for the run (history in `RoleAssignment` HARE / CO_HARE with `runId`) | Operates that one run (D21). Not a kennel permission. |
| Platform admin | `User.platformRole = ADMIN` | Override in any kennel, always audited as `platform-admin`. |

---

# 3. Resolution rule

For actor **A**, kennel **K** and permission **P**:

1. If A is a platform admin, grant (`policyRef = platform-admin`).
2. If A has no ACTIVE membership in K, deny. Suspended, inactive, resigned and removed members hold no kennel authority.
3. If A holds an active `KENNEL_ADMIN` role assignment in K, grant (`kennel-admin`).
4. If A holds an active officer appointment in K whose position lists P, grant (`officer:<position title>`).
5. If A holds a live delegation in K listing P, **and the delegator currently holds P under rules 2 to 4**, grant (`delegation:<id>`). Delegations do not chain, and a delegate loses P the moment the delegator does.
6. Otherwise deny with `403 KENNEL_PERMISSION_REQUIRED`.

Self-service actions (asking to join, leaving, reading your own timeline) use `policyRef = self` and need no kennel permission.

---

# 4. Permission keys

Stored as strings in `OfficerPosition.permissions` and `Delegation.permissions`. Unknown strings are ignored.

| Key | Grants | Status |
| --- | --- | --- |
| `membership.review` | See the member lists and timelines; approve or reject requests | Live |
| `membership.suspend` | Suspend and reinstate members | Live |
| `membership.remove` | Remove members | Live |
| `membership.invite` | Invite by email, QR code or link (FR-MEMBER-005) | Planned |
| `officer.appoint` | Appoint officers to existing positions and end appointments. Never beyond the keys the appointer holds (D32) | Live |
| `kennel.manage` | Edit the kennel profile, branding and settings; define officer positions and the keys they carry (D32) | Live |
| `run.manage` | Create runs and choose hares; publish, cancel, skip the Circle and archive; operate every run of the kennel | Live |
| `run.visibility.change` | Change run privacy away from the kennel default. Delegated to hares only (D13) | Live |
| `trail.manage` | Plan, lock, hide, release and archive any trail of the kennel's runs | Live |
| `report.publish` | Publish trail reports on behalf of the kennel | Planned |

---

# 5. Matrix

Legend: ✓ allowed · — not allowed · **key** means allowed when the principal holds that key through rules 3 to 5.

## Membership (live)

| Action | Visitor | Hasher | Applicant | Member | Officer / kennel admin / delegate | Platform admin |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| View a public kennel page | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ask to join (not hidden, no open membership, outside cooldown) | — | ✓ | — | — | ✓ ¹ | ✓ ¹ |
| See own memberships and timelines | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Leave the kennel (no officer or kennel roles held) | — | — | — | ✓ | ✓ ² | ✓ ¹ |
| See pending requests, the member list and any member's timeline | — | — | — | — | `membership.review` | ✓ |
| Approve or reject a request | — | — | — | — | `membership.review` ³ | ✓ ³ |
| Suspend or reinstate a member | — | — | — | — | `membership.suspend` ³ | ✓ ³ |
| Remove a member (no officer or kennel roles held) | — | — | — | — | `membership.remove` ³ | ✓ ³ |
| Withdraw own pending request | — | — | Planned ⁴ | — | — | — |
| Invite to a hidden kennel | — | — | — | — | Planned `membership.invite` | Planned |

1. For their own membership, the same as any hasher or member.
2. Only after handing over officer and kennel roles (FR-MEMBER-014).
3. Never on their own membership (separation of duties).
4. Needs a Chapter 24 event (e.g. `MembershipRequestWithdrawn`) before it is built.

## Runs (live, D21–D23)

| Action | Visitor | Signed-in hasher | Member of hosting kennel | Run hare | `run.manage` | Platform admin |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| See a published PUBLIC run and its counts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| See a MEMBERS_ONLY run | — | If already a participant | ✓ | ✓ | ✓ | ✓ |
| See an INVITE_ONLY run | — | If already a participant | If already a participant | ✓ | ✓ | ✓ |
| See a draft run | — | — | — | ✓ | ✓ | ✓ |
| See who is going, the Circle record and the run timeline | — | — | ✓ | ✓ | ✓ | ✓ |
| RSVP or withdraw (RSVP window, not full for Going) | — | PUBLIC runs allowing visitors | ✓ ² | ✓ | ✓ | ✓ |
| Register as a guest (PUBLIC run allowing guests) | ✓ | — ¹ | — ¹ | — | — | — |
| Check yourself in (Check-In Open or Live) | — | PUBLIC runs allowing visitors | ✓ ² | ✓ | ✓ | ✓ |
| Create a run, choose hares, renumber | — | — | — | — | ✓ | ✓ |
| Edit run details | — | — | — | Draft, Scheduled, Planning | Until the run starts | ✓ |
| Change run visibility (D3, D13) | — | — | — | Only with `run.visibility.change` | With `run.visibility.change` | ✓ |
| Publish, cancel (with reason), skip the Circle (with reason), archive | — | — | — | — | ✓ | ✓ |
| Advance the run day: start planning, hide and release the trail, open check-in, start, pause (with reason), resume, end, close the Circle | — | — | — | ✓ | ✓ | ✓ |
| Check others in, undo check-ins before archive, add walk-in guests | — | — | — | ✓ | ✓ | ✓ |
| Record Circle songs, announcements, notes and awards | — | — | — | ✓ | ✓ | ✓ |

1. Signed-in hashers RSVP as themselves.
2. Not while their membership is suspended.

## Trails (live, D25)

Legend: **planner** = the trail's hares, the run's hares, or an officer holding `trail.manage` / `run.manage`.

| Action | Anyone who can see the run | Trail hare (co-hare) | Lead hare | `trail.manage` / `run.manage` |
| --- | :-: | :-: | :-: | :-: |
| See that a trail exists: name, style, length, terrain, when it releases | ✓ | ✓ | ✓ | ✓ |
| See the route, waypoints, beer checks, chalk and notes **before** release | — | ✓ | ✓ | ✓ |
| See them **after** release | ✓ | ✓ | ✓ | ✓ |
| Create a trail, edit it, draw the route, place chalk and waypoints | — | ✓ | ✓ | ✓ |
| Lock, hide and release the trail | — | — | ✓ | ✓ |
| Unlock for editing (Locked → Planning only) | — | ✓ | ✓ | ✓ |
| Archive the trail | — | — | — | ✓ |
| Read the revision history | — | ✓ | ✓ | ✓ |

Secrecy is enforced by the serializer, not the UI: before release the API never sends route geometry to anyone but a planner. Platform admins hold the kennel permissions and so can plan and release, but nothing in HCP hands a trail to a participant early.

## Governance and reports (planned; the rules features must follow)

| Action | Member | Officer (per key) | Kennel admin | Run hare | Run scribe | Platform admin |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Appoint or end officers | — | `officer.appoint` | ✓ | — | — | ✓ |
| Edit kennel profile and settings | — | `kennel.manage` | ✓ | — | — | ✓ |
| Draft a trail report | — | — | — | — | ✓ (own run) | — |
| Publish a trail report | — | `report.publish` | ✓ | — | ✓ (own run) | ✓ |
| Vote or submit a motion | Per constitution (08L-04 note) | ✓ | ✓ | — | — | ✓ |

**Trail secrecy is stricter than everything else.** Route data, waypoints, beer checks and chalk are never serialized before release. Being a kennel admin or holding `trail.manage` does not reveal them; only the run's hares do. A committee or platform override must be an explicit, reasoned, audited action (ARCHITECTURE-RULES "Trails").

## Social graph and engagement (live, D50)

Legend: **viewer** = anybody who can already see the subject. Everything here resolves through `subject.service.ts#resolveSubject` first, which throws **404** — never 403 — for a subject the actor may not see, so nothing on this table can be used to discover something private.

| Action | Signed out | Signed-in viewer | Author / owner | `media.moderate` (subject's kennel) | Platform admin |
| --- | :-: | :-: | :-: | :-: | :-: |
| See counts (likes, comments, reshares, views) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Read a comment thread and a like list | ✓ | ✓ | ✓ | ✓ | ✓ |
| Follow or unfollow a hasher or a kennel | — | ✓ | n/a (never yourself) | ✓ | ✓ |
| Like, comment, reply, bookmark | — | ✓ | ✓ | ✓ | ✓ |
| Reshare | — | ✓ | — (never your own) | ✓ | ✓ |
| Edit or withdraw a comment | — | — | ✓ (own comment) | — | — |
| Take a comment down (audited, reason required) | — | — | — | ✓ | ✓ (anywhere; and the only one for content in no kennel) |
| See who bookmarked something | — | — | — | — | — |

**A bookmark is private to the hasher who made it** and is the one thing on this table nobody else can ever read — not the author, not a moderator, not platform staff. **A follow grants nothing**: it is not a membership, carries no key, and never counts towards the four active mismanagement members D10 requires.

---

# 6. Default permission profiles

HCP ships **no** platform-wide default for officer positions (BR-GOV-001: each kennel owns its governance). A kennel without officer permissions is managed by its kennel admin.

The seed gives the demo kennels these profiles:

| Position | Keys |
| --- | --- |
| Grand Master | `membership.review`, `membership.suspend`, `membership.remove`, `membership.invite`, `officer.appoint`, `kennel.manage` |
| Joint Master | `membership.review`, `membership.suspend` |
| On Sec | `membership.review`, `membership.invite` |
| Religious Advisor, Hash Cash | none |

Positions, appointments and delegations are managed through `/api/v1/kennels/:slug/positions`, `/positions/:id/appointments` and `/kennels/:slug/delegations` (D32).

**Defining a position is stricter than filling one.** Writing keys onto a position needs `kennel.manage`; appointing someone to it needs `officer.appoint`. Both refuse any key the actor does not currently hold, so authority can be passed on but never invented. Delegations follow the same rule, expire within 90 days, and are re-checked against the delegator’s live authority at every permission resolution.
