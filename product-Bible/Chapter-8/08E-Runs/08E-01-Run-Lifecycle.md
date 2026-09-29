# Annex 08E — Runs

# Part 2 — Run Lifecycle

---

Document ID: HCP-PB-08E-01

Parent Document:
Annex 08E — Runs

Domain:
Run Session Lifecycle

Status:
Draft

---

# Purpose

This document defines the lifecycle of every Run Session from creation to permanent archival as a Run Capsule.

A Run Session progresses through predefined lifecycle states to ensure consistency, auditability, and preservation of Hash history.

---

# Lifecycle Overview

Every Run Session shall progress through the following lifecycle:

```text
Draft
   │
Scheduled
   │
Planning
   │
Trail Hidden
   │
Trail Released
   │
Check-In Open
   │
Live Run
   │
Circle
   │
Reporting
   │
Archived
   │
Run Capsule
```

The system shall prevent invalid state transitions.

---

# FR-RUN-001 — Create Run Session

## Priority

Critical

## Actors

- Grand Master
- Trail Master
- Hare
- Authorized Officer

## Description

Authorized users shall be able to create a new Run Session.

---

## Preconditions

- User is authenticated.
- User belongs to the kennel.
- User has permission to create runs.

---

## Required Information

- Run Number
- Title (optional)
- Kennel
- Date
- Start Time
- Meeting Location
- Theme (optional)
- Hare(s)
- Run Type
- Visibility

---

## Postconditions

A Draft Run Session is created.

---

## Business Rules

- Run Numbers must be unique within a kennel.
- Multiple hares are supported.
- Future recurring runs are supported.

---

## Acceptance Criteria

- Run saved successfully.
- Draft state assigned.
- Audit record created.

---

# FR-RUN-002 — Schedule Run Session

## Priority

Critical

## Actors

- Hare
- Grand Master
- Trail Master

## Description

Draft runs may be scheduled for public viewing.

---

## Preconditions

Run exists.

---

## Postconditions

State changes to Scheduled.

---

## Business Rules

Scheduling automatically:

- Publishes event
- Enables RSVP
- Notifies followers
- Adds event to kennel calendar

---

## Acceptance Criteria

Participants can view the upcoming run.

---

# FR-RUN-003 — Assign Hares

## Priority

Critical

Multiple Hares and Co-Hares may be assigned.

The system shall preserve assignment history.

Changes shall generate notifications.

---

# FR-RUN-004 — Planning Phase

Planning includes:

- Venue confirmation
- Theme
- Safety notes
- Trail planning
- Beer check planning
- Water stop planning
- Emergency contacts
- Optional GPX preparation

Planning remains editable.

---

# FR-RUN-005 — Lock Planning

Planning may be locked.

Only officers may unlock.

Locking prevents accidental edits.

---

# FR-RUN-006 — Hide Trail

Trail remains invisible.

Even attendees cannot view:

- Route
- Waypoints
- Beer Checks
- False Trails
- Checkpoints

Release timing is configurable.

---

# FR-RUN-007 — Release Trail

## Supported Modes

- Immediately
- Scheduled Time
- Manual Release
- At Check-In
- At Run Start

Trail release activates:

- Navigation
- Live Map
- Waypoints

---

# FR-RUN-008 — Open Check-In

Participants may check in using:

- GPS
- QR Code
- Officer Approval
- Manual Check-In

Future:

- NFC
- Bluetooth Beacon

---

# FR-RUN-009 — Start Run

The Run Session enters Live mode.

Automatically activates:

- Live navigation
- Media uploads
- Live comments
- Attendance tracking
- Visitor logging

---

# FR-RUN-010 — Pause Run

Authorized officers may temporarily pause a run.

Reasons include:

- Weather
- Emergency
- Safety issue
- Lost participant

Participants receive immediate notification.

---

# FR-RUN-011 — Resume Run

Paused runs may resume.

Timeline records pause duration.

---

# FR-RUN-012 — End Run

Ending the run:

- Stops live tracking
- Locks attendance
- Preserves route
- Activates Circle

---

# FR-RUN-013 — Transition to Circle

Circle begins after the run.

Circle becomes its own managed activity.

Future annex defines Circle domain.

---

# FR-RUN-014 — Transition to Reporting

Once Circle concludes:

- Hash Scribe notified
- AI report generation becomes available
- Media uploads remain open

---

# FR-RUN-015 — Archive Run

Archiving finalizes:

- Attendance
- Statistics
- Trail
- Comments
- Media associations

Archived runs become read-only.

---

# FR-RUN-016 — Create Run Capsule

Archiving automatically generates a Run Capsule.

The Run Capsule permanently preserves:

- Trail
- Report
- Photos
- Videos
- Beer Stops
- Awards
- Songs
- Attendance
- Visitors
- Weather
- AI Story
- Passport Events

Run Capsules cannot be deleted.

Administrative corrections require an audited revision process.

---

# State Transition Rules

Allowed transitions:

```text
Draft
 ↓
Scheduled
 ↓
Planning
 ↓
Trail Hidden
 ↓
Trail Released
 ↓
Check-In Open
 ↓
Live Run
 ↓
Circle
 ↓
Reporting
 ↓
Archived
 ↓
Run Capsule
```

Invalid transitions shall be rejected.

---

# Business Principles

- Every Run tells a story.
- Nothing meaningful should be lost.
- Historical accuracy outweighs convenience.
- Transparency is preferred over silent edits.
- Every completed Run becomes part of Hash history.

---

# Completion Criteria

This document is complete when:

- The lifecycle is fully defined.
- State transitions are enforced.
- Every Run can progress from creation to Run Capsule.
- Auditability is guaranteed.
- Passport integration points are identified.

---

# Next Document

**08E-02 — Run Planning**

This document will specify every planning activity before the day of the run, including hare collaboration, trail preparation, venue logistics, risk assessments, participant limits, and scheduling.