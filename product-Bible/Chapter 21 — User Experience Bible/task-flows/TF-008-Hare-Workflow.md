# Task Flow TF-008

## Hare Workflow

---

Task ID: TF-008

Journey: J-008 Hare Workflow

Status: Draft

Version: 1.0

---

# Purpose

Define the Hare workflow for creating a run, planning a trail, configuring visibility, publishing event details, and completing run-day responsibilities.

---

# Primary Actor

Hare

---

# Trigger

Hare creates a run, receives an assignment, or opens the Hare dashboard for an upcoming event.

---

# Preconditions

- User has Hare or event-management permission.
- Community exists.
- Event creation is enabled.
- Required run information can be saved.

---

# UI Flow

Hare Dashboard

↓

Create or Open Run

↓

Enter Event Details

↓

Plan Trail

↓

Configure Visibility

↓

Review Completeness

↓

Publish Event

↓

Monitor Registration

↓

Run-Day Tools

↓

Complete Event

---

# Validation Rules

Required event details complete?

↓

Meeting location valid?

↓

At least one Hare assigned?

↓

Visibility configured?

↓

Community policy satisfied?

↓

Publish

---

# API

POST /api/v1/runs

PATCH /api/v1/runs/{runId}

POST /api/v1/runs/{runId}/trail-versions

PATCH /api/v1/runs/{runId}/visibility

POST /api/v1/runs/{runId}/publish

POST /api/v1/runs/{runId}/complete

---

# Success State

- Run is saved or published.
- Trail draft is versioned.
- Visibility policy is enforced.
- Participants can view allowed details.
- Hare retains run-day tools.

---

# Failure States

Missing required fields

↓

Highlight fields and preserve draft

Trail save conflict

↓

Show versions and allow merge

Visibility release fails

↓

Keep trail private and allow retry

Publish blocked by policy

↓

Explain required approval

---

# Accessibility

- Forms support keyboard navigation.
- Map tools provide non-map alternatives where practical.
- Visibility controls include text descriptions.
- Critical actions require accessible confirmation.

---

# Analytics

RUN_CREATED

RUN_DRAFT_SAVED

TRAIL_VERSION_SAVED

TRAIL_VISIBILITY_UPDATED

RUN_PUBLISHED

EVENT_COMPLETED

---

# Performance

Event editor load: <= 2 seconds

Draft save: <= 1 second

Trail save: <= 1 second target

Visibility update: <= 2 seconds

---

# Acceptance Criteria

- Hares can create and publish runs.
- Trail drafts autosave and version correctly.
- Hidden trails remain private until release.
- Policy blocks are clear and recoverable.
- Event completion transfers context to post-event workflows.

