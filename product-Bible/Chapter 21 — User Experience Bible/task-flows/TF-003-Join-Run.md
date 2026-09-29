# Task Flow TF-003

## Join Run

---

Task ID: TF-003

Journey: J-003 Join a Run

Status: Draft

Version: 1.0

---

# Purpose

Describe the implementation flow for joining an upcoming run and preparing the user for the event.

---

# Primary Actor

Authenticated Member

---

# Trigger

User taps Join Run from run details, a notification, a deep link, a QR code, or a community calendar.

---

# Preconditions

- User is authenticated.
- Run exists.
- User can view the run.
- Registration is open.
- User is eligible to join.

---

# UI Flow

Run Details

↓

Join Run

↓

Eligibility Check

↓

Confirmation Dialog

↓

Loading State

↓

Attendance Created

↓

Joined State

↓

Reminder Scheduled

---

# Validation Rules

Run available?

↓

User eligible?

↓

Already joined?

↓

Registration open?

↓

Capacity available?

↓

Required acknowledgements complete?

↓

Continue

---

# API

POST /api/v1/runs/{runId}/join

GET /api/v1/runs/{runId}/eligibility

POST /api/v1/runs/{runId}/reminders

---

# Backend Operations

- Validate permissions.
- Check registration deadline.
- Check capacity.
- Create attendance record.
- Increment participant count.
- Insert audit log.
- Publish analytics event.
- Schedule reminders.

---

# Success State

- Button changes to Joined.
- Attendance count updates.
- Confirmation appears.
- Calendar actions become available.
- Preparation details remain visible.

---

# Failure States

Run full

↓

Explain and offer similar runs

Registration closed

↓

Show closing time and next run

Already joined

↓

Restore joined state

Network error

↓

Retry safely without duplicate attendance

Permission denied

↓

Explain requirement

---

# Accessibility

- Confirmation dialog is fully keyboard accessible.
- Loading, success, and failure states are announced.
- Focus returns to the Joined status after success.
- Maps and location details include accessible alternatives.

---

# Analytics

RUN_VIEWED

JOIN_RUN_CLICKED

JOIN_RUN_SUCCESS

JOIN_RUN_FAILED

FIRST_RUN_JOINED

RUN_REMINDER_SCHEDULED

---

# Performance

Eligibility check: <= 500 ms target

Join request: <= 500 ms server target

UI response: <= 100 ms perceived

Maximum perceived wait: <= 2 seconds

---

# Acceptance Criteria

- Eligible users can join a run.
- Duplicate joins are prevented.
- Closed, full, cancelled, and restricted runs show clear recovery.
- Reminders are scheduled according to preferences.
- Organizers see updated attendance.

