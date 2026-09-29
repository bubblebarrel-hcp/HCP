# Task Flow TF-004

## Participate in Run

---

Task ID: TF-004

Journey: J-004 Participate in a Run

Status: Draft

Version: 1.0

---

# Purpose

Define the run-day flow from reminder and arrival through check-in, live participation, completion, and post-event prompts.

---

# Primary Actor

Community Member

---

# Trigger

User opens a run-day reminder, scans an event QR code, or opens an active run from My Runs.

---

# Preconditions

- Run is upcoming or active.
- User has joined the run or public participation is permitted.
- Event details are visible to the user.
- Cached event data is available where possible.

---

# UI Flow

Reminder or Active Run

↓

Run-Day Screen

↓

Directions and Arrival Details

↓

Check In

↓

Opening Circle State

↓

Run Active State

↓

Optional Announcements or Trail Features

↓

Mark Complete or Event Ends

↓

Share Memories and View Next Actions

---

# Check-In Methods

- Manual check-in
- QR code scan
- Volunteer-assisted check-in
- Optional geofenced confirmation where enabled by the community

---

# Validation Rules

Event active or upcoming?

↓

User eligible to check in?

↓

Already checked in?

↓

Check-in method valid?

↓

Record attendance

---

# API

POST /api/v1/runs/{runId}/check-in

GET /api/v1/runs/{runId}/live

POST /api/v1/runs/{runId}/complete

GET /api/v1/runs/{runId}/announcements

---

# Success State

- Check-in status changes to Checked In.
- Event status and critical details remain visible.
- Emergency and organizer contact information remains available.
- Completion prompt appears after the event.

---

# Failure States

QR scan fails

↓

Offer manual or volunteer-assisted check-in

GPS unavailable

↓

Keep manual directions visible

Connectivity lost

↓

Use cached details and queue non-critical updates

Event cancelled

↓

Show cancellation reason and next event options

---

# Accessibility

- QR check-in has a non-camera alternative.
- Critical information is available without map interaction.
- Announcements are readable and screen-reader friendly.
- Large touch targets support use outdoors.
- Reduced-motion settings are respected.

---

# Analytics

RUN_DAY_OPENED

CHECK_IN_STARTED

CHECK_IN_COMPLETED

ANNOUNCEMENT_VIEWED

RUN_COMPLETED

MEDIA_PROMPT_SHOWN

---

# Performance

Run-day screen load: <= 2 seconds

Check-in confirmation: <= 1 second

Announcement delivery: near real-time

---

# Acceptance Criteria

- Users can access arrival and event details quickly.
- Check-in succeeds through at least one accessible method.
- Attendance is recorded once.
- Offline mode preserves critical information.
- The app remains quiet and does not distract from the physical event.

