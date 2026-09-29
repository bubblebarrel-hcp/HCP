# 21-05 — Journey-to-Task-Flow Traceability Matrix

Document ID: HCP-PB-21-05

Parent Document: Chapter 21 — User Experience Bible

Status: Draft

Version: 1.0

Date: 2026-08-10

Added during Product Bible Phase 1 normalization (`CODEX/IMPLEMENTATION-ROADMAP.md`), per Chapter 21's own stated principle: "Every journey should map to at least one task flow."

---

# Purpose

Chapter 21's README asserts the traceability principle but never provides the matrix itself. This document is that matrix: it confirms every journey has an implementing task flow, flags the one journey with a duplicate/legacy task flow, and records where a task flow's detail is thinner than its journey implies.

---

# Matrix

| Journey | Task Flow | Journey Status | Task Flow Status | Coverage Notes |
|---|---|---|---|---|
| J-001 User Onboarding | TF-001 User Onboarding | Draft | Draft | 1:1, consistent. |
| J-002 Join Kennel | TF-002 Join Kennel | Draft | Draft | 1:1, consistent. |
| J-003 Join Run | TF-003 Join Run (canonical) + TF-003.2 Join Run (superseded, nested under `task-flows/TF-003-Join-Run/`) | Draft | Draft (canonical) / Superseded | Two task flows exist for one journey — see Gap 1 below. |
| J-004 Participate in Run | TF-004 Participate in Run | Draft | Draft | 1:1, consistent. |
| J-005 Upload Photos and Videos | TF-005 Upload Photos and Videos | Draft | Draft | 1:1, consistent. |
| J-006 Write Trail Report | TF-006 Write Trail Report | Draft | Draft | 1:1, consistent. |
| J-007 Volunteer Workflow | TF-007 Volunteer Workflow | Draft | Draft | 1:1, consistent. |
| J-008 Hare Workflow | TF-008 Hare Workflow | Draft | Draft | 1:1, consistent. |
| J-009 Committee Workflow | TF-009 Committee Workflow | Draft | Draft | 1:1, consistent. |
| J-010 Create New Kennel | TF-010 Create New Kennel | Draft | Draft | 1:1, consistent. |

Navigation reference: NF-001 Application Navigation is a cross-cutting document, not tied to a single journey; it is not included as a matrix row but should be consulted alongside every task flow above for entry points and transitions between flows.

---

# Coverage Gaps

## Gap 1 — Duplicate task flow for J-003 (resolved this pass)

`task-flows/TF-003-Join-Run/TF-003.2-Join-Run.md` was a legacy, more implementation-detailed task flow nested one level below the canonical `task-flows/TF-003-Join-Run.md`. It has been marked **Superseded** (this pass — see `CODEX/DECISION-LOG.md`) rather than deleted, because it contains a Database Changes section, a Security section, concrete notification timing, and a QA Test Cases checklist that the canonical TF-003 does not yet have.

**Follow-up (tracked in `CODEX/TODO.md`):** merge TF-003.2's Database Changes, Security, and QA Test Cases sections into the canonical TF-003-Join-Run.md, then this row can be simplified to a single task flow.

## Gap 2 — Task flows lack a uniform "Database Changes" / "Security" section

Only TF-003.2 (superseded) has explicit Database Changes and Security sections. TF-001 through TF-010 (canonical) follow a lighter template (Purpose, Actor, Trigger, Preconditions, UI Flow, Validation Rules, API, Backend Operations, Success/Failure States, Accessibility, Analytics, Performance, Acceptance Criteria) that folds database/security concerns into "Backend Operations" prose rather than a dedicated section. This is an internal consistency choice, not an error, but it means TF-003.2's extra structure should not be assumed present when reading any other TF-0xx file. No action required unless Phase 2 technical specification wants to standardize a richer template across all ten task flows.

## Gap 3 — No task flow for kennel administration beyond creation

J-010 covers *creating* a kennel; ongoing kennel administration (officer management, branding, announcements — FR-KENNEL-006 through 011 in Annex 08C) has no dedicated journey or task flow. This is likely intentionally out of Chapter 21's initial ten flows but is worth flagging before Phase 3 scaffolds an admin surface with no UX spec behind it. Logged in `CODEX/TODO.md`.

---

# Completion Criteria

This matrix is complete when:

- Every journey in `journeys/` has at least one row.
- Every task flow in `task-flows/` (including nested/legacy ones) appears in some row.
- Coverage gaps are listed with an owning follow-up location rather than left implicit.
