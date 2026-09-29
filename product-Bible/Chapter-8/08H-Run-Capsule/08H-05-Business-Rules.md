# Annex 08H — Run Capsule

## Part 6 — Business Rules, Permissions & Acceptance Criteria

---

Document ID:
HCP-PB-08H-05

Parent:
Annex 08H — Run Capsule

Domain:
Governance & Historical Integrity

Status:
Draft

Version:
1.0

---

# Purpose

This document defines the governance model, permissions, business rules, preservation policies, audit requirements, and acceptance criteria for Run Capsules.

These rules ensure that every Run Capsule remains authentic, trustworthy, and historically reliable throughout its lifetime.

---

# Vision

A Run Capsule should remain as trustworthy in fifty years as it was on the day it was published.

Every change must be transparent.

Every contribution must be attributable.

Every historical record must remain preserved.

---

# Guiding Principles

- Preserve authenticity.
- Never rewrite history.
- Support community stewardship.
- Protect contributor rights.
- Ensure long-term accessibility.

---

# Business Rule Categories

- Identity
- Ownership
- Lifecycle
- Visibility
- Contributions
- Media
- Historical Preservation
- Audit
- AI
- Security

---

# BR-CAPSULE-001 — Capsule Identity

Every Run Capsule shall have:

- Global unique identifier
- Associated Run Session
- Kennel
- Creation timestamp
- Publication timestamp
- Current state

The identifier is immutable.

---

# BR-CAPSULE-002 — One Capsule Per Run

Each Run Session shall produce exactly one official Run Capsule.

Supplementary collections may exist but always reference the same official Capsule.

---

# BR-CAPSULE-003 — Ownership

The Run Capsule belongs to the kennel that organized the run.

Individual contributors retain attribution for their own content.

Administrative stewardship may change without altering historical ownership.

---

# BR-CAPSULE-004 — Historical Integrity

Core historical elements become immutable after publication, including:

- Run identity
- Trail Report
- Timeline
- Official participant roles
- Publication metadata

Corrections require formal revisions.

---

# BR-CAPSULE-005 — Supplemental Contributions

Additional content may be attached after publication, including:

- Newly discovered media
- Anniversary reflections
- Oral histories
- Interviews
- Historical annotations

Supplemental content is clearly distinguished from the original record.

---

# BR-CAPSULE-006 — Visibility

Kennels may configure visibility levels:

- Public
- Registered Hashers
- Kennel Members
- Invited Guests
- Officers Only

Visibility may differ for media, reports, and participant lists.

---

# BR-CAPSULE-007 — Media Governance

Every media asset shall retain:

- Original uploader
- Upload timestamp
- Licensing information (if provided)
- Associated Story Cards
- Related locations

Media removal shall not invalidate the historical record.

Placeholder references remain when appropriate.

---

# BR-CAPSULE-008 — AI Transparency

Every AI-generated artifact shall include:

- Generation timestamp
- AI model version (where applicable)
- Source references
- Human approval status

AI-generated summaries never replace official records.

---

# BR-CAPSULE-009 — Audit Trail

The platform shall record:

- Capsule creation
- Lifecycle transitions
- Story publication
- Media additions
- Supplemental contributions
- Permission changes
- Administrative actions

Audit logs are immutable.

---

# BR-CAPSULE-010 — Preservation

Run Capsules shall be designed for long-term preservation.

Future migrations must preserve:

- Structure
- Relationships
- Metadata
- References
- Media integrity

Technology may evolve.

History must not.

---

# BR-CAPSULE-011 — Portability

Authorized users may export Run Capsules in preservation-friendly formats including:

- Markdown
- PDF
- JSON Archive
- HTML Package

Future archival standards may be added without affecting existing Capsules.

---

# BR-CAPSULE-012 — Legacy Import

Historic runs imported from newsletters, spreadsheets, or paper archives shall be marked as:

Legacy Capsule

Imported Capsules include provenance metadata describing their source.

---

# BR-CAPSULE-013 — Privacy

Participant privacy settings override Capsule defaults where applicable.

Sensitive information is excluded from public exports.

Privacy changes never silently modify the historical record.

---

# BR-CAPSULE-014 — Community Stewardship

The platform supports community stewardship by allowing authorized officers to:

- Curate collections
- Add historical context
- Approve supplemental contributions
- Preserve legacy material

Editorial stewardship is distinct from historical authorship.

---

# Permission Matrix

| Action | Member | Contributor | Hare | Scribe | Officer | Admin |
|---------|:------:|:-----------:|:----:|:------:|:-------:|:-----:|
| View Capsule | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Upload Media | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Add Reflection | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit Official Story | | | | ✓ | ✓ | ✓ |
| Publish Capsule | | | | ✓ | ✓ | ✓ |
| Add Historical Annotation | | | | | ✓ | ✓ |
| Manage Visibility | | | | | ✓ | ✓ |
| Archive Capsule | | | | | ✓ | ✓ |

---

# Acceptance Criteria

Run Capsule is considered complete when:

- Automatic assembly is implemented.
- Interactive exploration exists.
- Hash Time Machine functions.
- AI summaries are transparent.
- Historical preservation is guaranteed.
- Governance rules are enforceable.
- Long-term archival requirements are met.

---

# Non-Functional Expectations

The Run Capsule domain should support:

- Millions of Capsules.
- Decades of historical growth.
- Global search.
- Offline viewing.
- Incremental enrichment.
- Efficient archival storage.

---

# Future Enhancements

Potential future capabilities include:

- Immersive AR trail replays.
- VR Interhash experiences.
- Community-contributed oral history collections.
- Museum exhibition mode.
- Automated documentary generation.
- Digital heritage preservation partnerships.

---

# Business Principles

Every Run.

Every Trail.

Every Story.

One Capsule.

Forever.

---

# Completion Criteria

Annex 08H is complete when:

- Lifecycle is defined.
- Explorer is implemented.
- Hash Time Machine is specified.
- AI Memory layer is documented.
- Governance rules exist.
- Preservation strategy is complete.

---

# Annex 08H Completion

The Run Capsule domain consists of:

- 08H-00 — Vision & Domain Overview
- 08H-01 — Run Capsule Assembly & Lifecycle
- 08H-02 — Run Capsule Explorer
- 08H-03 — Hash Time Machine
- 08H-04 — AI Memory & Storytelling
- 08H-05 — Business Rules, Permissions & Acceptance Criteria

The Run Capsule is the canonical historical artifact of the Hash Community Platform.