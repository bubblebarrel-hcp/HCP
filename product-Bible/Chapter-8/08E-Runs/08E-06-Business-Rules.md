# Annex 08E — Runs

# Part 7 — Cross-Cutting Business Rules & Acceptance Criteria

---

Document ID:
HCP-PB-08E-06

Parent:
Annex 08E — Runs

Domain:
Run Session Business Rules

Status:
Draft

Version:
1.0

---

# Purpose

This document defines the cross-cutting business rules, validations, permissions, lifecycle constraints, and acceptance criteria that apply to all aspects of the Run Session domain.

These rules ensure consistency across the platform regardless of implementation.

---

# Business Rule Categories

- Identity
- Scheduling
- Participation
- Trail Management
- Media
- Reporting
- Historical Preservation
- Permissions
- Notifications
- Data Integrity

---

# BR-RUN-001 — Run Number Uniqueness

Every Run Session shall have a unique Run Number within its owning Kennel.

Different kennels may reuse the same Run Number.

---

# BR-RUN-002 — Single Ownership

A Run Session belongs to exactly one Kennel.

A Run Session cannot exist independently.

---

# BR-RUN-003 — Hare Requirement

Every Run Session shall have at least one Hare before publication.

Co-Hares are optional.

---

# BR-RUN-004 — Trail Ownership

Every Trail belongs to exactly one Run Session.

A Trail cannot exist without an associated Run Session.

---

# BR-RUN-005 — Circle Requirement

Every completed Run Session should transition into the Circle phase unless explicitly skipped by an authorized officer.

Skipping the Circle shall require a recorded reason.

---

# BR-RUN-006 — Official Trail Report

Each Run Session may have only one official published Trail Report.

Drafts and revisions are permitted.

The final published report shall remain associated with the Hash Scribe.

---

# BR-RUN-007 — Media Ownership

Every media item shall be associated with at least one of the following:

- Run Session
- Trail Segment
- Beer Stop
- Circle
- General Gallery

Unlinked media shall not be permitted.

---

# BR-RUN-008 — Attendance Integrity

Attendance records become immutable once the Run Session is archived.

Administrative corrections require audit records.

---

# BR-RUN-009 — Visitor Recognition

Visitors retain attribution to their Home Kennel regardless of where they participate.

Visitor history contributes to Passport records.

---

# BR-RUN-010 — Time Consistency

Lifecycle events shall occur in chronological order.

The platform shall reject invalid timestamps.

---

# BR-RUN-011 — Trail Secrecy

Trail visibility shall follow the Hare's configured release policy.

No unauthorized participant may access hidden trail information.

---

# BR-RUN-012 — Media Moderation

Kennels may configure moderation rules for participant uploads.

Moderation options include:

- Immediate publication
- Officer approval
- AI-assisted moderation
- Community reporting

---

# BR-RUN-013 — Notification Rules

Notifications shall only be sent for events enabled by the Kennel.

Examples include:

- Run published
- Trail released
- Venue changed
- Circle started
- Report published

---

# BR-RUN-014 — AI Transparency

Where AI-generated content is used, the platform shall identify it as AI-assisted.

Official publication remains the responsibility of the Hash Scribe or an authorized officer.

---

# BR-RUN-015 — Historical Integrity

Archived Run Sessions and Run Capsules shall not be destructively edited.

All corrections shall be implemented through audited revisions.

---

# Permission Matrix

| Action | Member | Hare | Officer | Admin |
|---------|:------:|:----:|:-------:|:-----:|
| View Run | ✓ | ✓ | ✓ | ✓ |
| RSVP | ✓ | ✓ | ✓ | ✓ |
| Upload Media | ✓ | ✓ | ✓ | ✓ |
| Create Run | | ✓ | ✓ | ✓ |
| Edit Planning | | ✓ | ✓ | ✓ |
| Publish Run | | | ✓ | ✓ |
| Release Trail | | ✓ | ✓ | ✓ |
| Start Run | | ✓ | ✓ | ✓ |
| End Run | | ✓ | ✓ | ✓ |
| Archive Run | | | ✓ | ✓ |
| Publish Report | | | ✓ | ✓ |
| Delete Draft Run | | | ✓ | ✓ |

---

# Global Acceptance Criteria

A Run Session implementation shall be considered complete when:

- Runs progress through the defined lifecycle.
- Trail secrecy is preserved until release.
- Attendance is accurately recorded.
- Media remains contextually linked.
- Circle transitions correctly.
- Official reports are published.
- Run Capsules are generated automatically.
- Hash Passports are updated.
- Historical records are immutable.
- Audit trails exist for administrative changes.

---

# Non-Functional Expectations

The platform should support:

- Thousands of concurrent Run Sessions globally.
- Offline operation where practical.
- Eventual synchronization after connectivity is restored.
- Real-time updates for live activities.
- Scalable media storage.
- Efficient map rendering.

---

# Future Enhancements

Potential future capabilities include:

- AI-generated route summaries.
- Automatic highlight reels.
- Wearable device integration.
- Satellite imagery overlays.
- Trail heat maps.
- Voice-guided navigation.
- Live translation for international events.
- Environmental impact metrics.

---

# Business Principles

- Preserve the traditions of the Hash.
- Build technology that remains invisible during the experience.
- Prioritize historical preservation.
- Respect local kennel autonomy.
- Design for global scale from day one.

---

# Completion Criteria

The Run Session domain is complete when:

- Functional requirements are satisfied.
- Business rules are enforceable.
- Permission boundaries are defined.
- Validation rules are documented.
- Acceptance criteria are measurable.
- Future extensibility has been considered.

---

# Annex 08E Completion

The following Run Session specification documents now comprise the complete Annex 08E:

- 08E-00 — Overview & Lifecycle
- 08E-01 — Run Lifecycle
- 08E-02 — Run Planning
- 08E-03 — Run Day
- 08E-04 — Circle
- 08E-05 — Run Capsule
- 08E-06 — Business Rules & Acceptance Criteria

These documents collectively define the complete lifecycle of a Run Session within the Hash Community Platform.