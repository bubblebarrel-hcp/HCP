# Task Flow TF-006

## Write Trail Report

---

Task ID: TF-006

Journey: J-006 Write Trail Report

Status: Draft

Version: 1.0

---

# Purpose

Define the Scribe workflow for creating, editing, previewing, publishing, and revising the official trail report for a run.

---

# Primary Actor

Scribe

---

# Trigger

User opens Create Trail Report after a run concludes or responds to a Scribe reminder.

---

# Preconditions

- Run has concluded or report creation is otherwise enabled.
- User has Scribe or editor permission.
- Event metadata is available.
- Existing media may be available but is optional.

---

# UI Flow

Trail Report Workspace

↓

Choose Blank Draft or AI Draft

↓

Load Event Context

↓

Write or Review Draft

↓

Embed Media

↓

Preview

↓

Publish

↓

Published Report

---

# Validation Rules

User has edit permission?

↓

Official report already exists?

↓

Draft loaded or created?

↓

Required fields complete?

↓

Preview generated?

↓

Publish

---

# API

POST /api/v1/runs/{runId}/reports

POST /api/v1/runs/{runId}/reports/generate-draft

PATCH /api/v1/reports/{reportId}

POST /api/v1/reports/{reportId}/publish

---

# Success State

- Report is published.
- Report has a permanent URL.
- Members receive configured notifications.
- Search index is updated.
- Revision history records publication.

---

# Failure States

AI draft fails

↓

Allow manual writing

Autosave fails

↓

Preserve local draft and retry

Publish fails

↓

Keep draft intact and explain recovery

Revision conflict

↓

Show both versions and allow merge

---

# Accessibility

- Editor supports keyboard navigation.
- Formatting controls have labels.
- Autosave status is announced politely.
- Preview is screen-reader accessible.
- Embedded media includes editable alt text.

---

# Analytics

REPORT_STARTED

AI_DRAFT_REQUESTED

REPORT_AUTOSAVED

REPORT_PREVIEWED

REPORT_PUBLISHED

REPORT_REVISED

---

# Performance

Editor load: <= 2 seconds

Autosave after inactivity: <= 500 ms target

Preview generation: <= 2 seconds

Publish: <= 2 seconds

---

# Acceptance Criteria

- A Scribe can start from blank or AI-assisted draft.
- Drafts are not lost during connectivity changes.
- Published reports are versioned.
- AI content requires human approval.
- Members can access the final report from the event and archive.

