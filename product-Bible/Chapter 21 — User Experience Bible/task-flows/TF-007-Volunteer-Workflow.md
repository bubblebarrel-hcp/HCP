# Task Flow TF-007

## Volunteer Workflow

---

Task ID: TF-007

Journey: J-007 Volunteer Workflow

Status: Draft

Version: 1.0

---

# Purpose

Define the volunteer assignment flow from notification and acceptance through checklist execution, incident reporting, and completion.

---

# Primary Actor

Volunteer

---

# Trigger

Volunteer receives an assignment notification, self-selects a role, or opens a volunteer task from the event page.

---

# Preconditions

- Volunteer has an HCP account.
- Event exists.
- Assignment exists or self-signup is enabled.
- User has permission to view volunteer tools.

---

# UI Flow

Assignment Notification

↓

Volunteer Task Detail

↓

Accept, Decline, or Request Reassignment

↓

Review Briefing and Checklist

↓

Check In for Shift

↓

Complete Tasks

↓

Report Issues if Needed

↓

Submit Completion

---

# Validation Rules

Assignment active?

↓

User assigned or eligible?

↓

Role still available?

↓

Required briefing acknowledged?

↓

Continue

---

# API

GET /api/v1/events/{eventId}/volunteer-assignments

POST /api/v1/volunteer-assignments/{assignmentId}/accept

PATCH /api/v1/volunteer-assignments/{assignmentId}/tasks/{taskId}

POST /api/v1/events/{eventId}/incidents

POST /api/v1/volunteer-assignments/{assignmentId}/complete

---

# Success State

- Assignment status updates.
- Checklist progress is visible to coordinators.
- Incident reports are recorded.
- Completion is confirmed.
- Volunteer recognition can be queued.

---

# Failure States

Assignment no longer available

↓

Explain and show alternatives

Connectivity lost

↓

Keep checklist available and queue updates

Incident submission fails

↓

Store locally and retry

Permission changed

↓

Explain and return to event overview

---

# Accessibility

- Checklist controls are large and labeled.
- Status changes are announced.
- Incident forms support keyboard and screen readers.
- Offline state is clear without relying on color alone.

---

# Analytics

VOLUNTEER_ASSIGNMENT_VIEWED

ASSIGNMENT_ACCEPTED

ASSIGNMENT_DECLINED

CHECKLIST_ITEM_COMPLETED

INCIDENT_REPORTED

ASSIGNMENT_COMPLETED

---

# Performance

Assignment load: <= 2 seconds

Checklist update: <= 500 ms target

Incident save: <= 1 second target

---

# Acceptance Criteria

- Volunteers can accept or decline assignments.
- Assigned tasks remain visible offline.
- Coordinators can see progress.
- Incidents are captured reliably.
- Completion is auditable.

