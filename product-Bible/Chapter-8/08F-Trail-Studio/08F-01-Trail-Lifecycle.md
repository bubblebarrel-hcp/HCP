# Annex 08F — Trail Studio

## Part 2 — Trail Lifecycle & Planning

---

Document ID:
HCP-PB-08F-01

Parent:
Annex 08F — Trail Studio

Domain:
Trail Lifecycle

Status:
Draft

Version:
1.0

---

# Purpose

This document defines the complete lifecycle of a Trail, from its initial concept through planning, publication, execution, archival, and historical preservation.

Every Trail exists to support exactly one Run Session while remaining an independently managed domain.

---

# Philosophy

A great trail is not measured only by distance.

It is measured by the memories it creates.

Trail Studio should empower Hares to design memorable experiences while preserving secrecy and respecting traditional Hash practices.

---

# Trail Lifecycle

```text
Idea
 │
Draft
 │
Planning
 │
Review
 │
Locked
 │
Hidden
 │
Released
 │
Live
 │
Completed
 │
Archived
 │
Historic Trail
```

Each state has defined permissions and transition rules.

---

# FR-TRAIL-001 — Create Trail

## Priority

Critical

### Actors

- Hare
- Co-Hare
- Trail Master

### Description

Authorized users shall be able to create a Trail for a Run Session.

A Trail cannot exist without an associated Run Session.

### Required Information

- Trail Name (optional)
- Trail Type
- Associated Run Session
- Lead Hare
- Estimated Distance
- Estimated Duration
- Terrain Type

### Acceptance Criteria

- Trail is created in Draft state.
- Ownership is assigned.
- Audit record created.

---

# FR-TRAIL-002 — Draft Planning

During Draft, Hares may:

- Sketch routes
- Add notes
- Import GPX files
- Estimate timing
- Invite Co-Hares
- Save incomplete work

Draft Trails remain private.

---

# FR-TRAIL-003 — Collaborative Planning

Multiple Hares may work on the same Trail.

The system shall:

- Record changes.
- Prevent edit conflicts.
- Track contributor history.
- Maintain version history.

---

# FR-TRAIL-004 — Trail Review

Before publication, Hares may review:

- Route continuity
- Distance
- Elevation
- Hazards
- Beer Stops
- Regroups
- Water Stops
- Split Trails

Trail Review shall identify incomplete planning.

---

# FR-TRAIL-005 — Lock Trail

Locked Trails cannot be edited except by authorized officers.

Locking protects against accidental changes before the run.

---

# FR-TRAIL-006 — Hidden State

While Hidden:

- Route is invisible.
- Waypoints are invisible.
- Beer Stops are invisible.
- False Trails are invisible.
- GPS data is protected.

Only authorized planners may access Hidden Trails.

---

# FR-TRAIL-007 — Release Trail

The Hare controls how the Trail is released.

Supported release modes:

- Manual
- Scheduled
- Run Start
- Check-In Complete
- Geofenced Release

Release automatically enables participant navigation.

---

# FR-TRAIL-008 — Live Trail

Once Live:

- Navigation activates.
- Waypoints appear according to configuration.
- Beer Stops may reveal progressively.
- Media tagging becomes available.
- Participant interactions begin.

---

# FR-TRAIL-009 — Complete Trail

When the Run concludes:

- Trail editing stops.
- Statistics finalize.
- Replay data is generated.
- Historical preservation begins.

---

# FR-TRAIL-010 — Archive Trail

Archived Trails become part of the Run Capsule.

Trail geometry, metadata, and associated content remain available according to the kennel's privacy settings.

---

# State Transition Rules

Allowed transitions:

```text
Idea
 ↓
Draft
 ↓
Planning
 ↓
Review
 ↓
Locked
 ↓
Hidden
 ↓
Released
 ↓
Live
 ↓
Completed
 ↓
Archived
 ↓
Historic Trail
```

Invalid transitions shall be rejected by the platform.

---

# Business Principles

- Trails belong to Run Sessions.
- Every Trail tells part of the Run's story.
- Secrecy is fundamental until release.
- Planning should encourage creativity.
- Every completed Trail contributes to the historical archive.

---

# Completion Criteria

This document is complete when:

- Trail states are fully defined.
- State transitions are validated.
- Collaborative planning is supported.
- Secrecy is preserved.
- Historical preservation is guaranteed.

---

# Next Document

08F-02 — Digital Chalk & Trail Components