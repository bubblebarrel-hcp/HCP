# Journey Specification J-008

## Hare Workflow

---

Document ID

HCP-JS-008

Status

Draft

Version

1.0

---

# Purpose

Enable one or more Hares to design, prepare, manage, and conclude a Hash run while preserving the traditions, mystery, safety, and enjoyment of the experience.

---

# Scope

This journey covers:

- Creating a run
- Planning the trail
- Configuring visibility
- Coordinating logistics
- Publishing participant information
- Managing live event updates
- Closing the event

This journey does not cover:

- Committee governance (J-009)
- Trail report authoring (J-006)

---

# Primary Persona

Hare

---

# Supporting Personas

Joint Hare

Committee Member

Volunteer

Community Member

---

# Business Goals

- Simplify event planning.
- Preserve Hash traditions.
- Improve participant preparedness.
- Increase organizer confidence.
- Maintain accurate historical records.

---

# User Goal

"I want to create a memorable run while keeping the trail secret until the right moment."

---

# Preconditions

- User has Hare permissions for the event.
- Community allows event creation or assignment.
- Required event information can be saved.

---

# Triggers

- Hare assignment.
- Committee creates a new run.
- Hare creates a new run (where permitted).

---

# Entry Points

- Hare Dashboard
- Community Dashboard
- Event Management
- Notification
- Calendar

---

# Journey Overview

```
Create Run
      │
      ▼
Configure Event
      │
      ▼
Plan Trail
      │
      ▼
Configure Visibility
      │
      ▼
Publish Event
      │
      ▼
Monitor Registrations
      │
      ▼
Run Day
      │
      ▼
Release Trail (Optional)
      │
      ▼
Complete Event
```

---

# Detailed User Flow

## Create Event

The Hare provides:

- Run title
- Date
- Start time
- Meeting location
- Description
- Hash cash (if applicable)
- Difficulty (optional)
- Estimated duration
- Special instructions

---

## Plan Trail

The Hare may:

- Draw or upload the route.
- Define checkpoints.
- Mark beer stops.
- Add optional landmarks.
- Save draft versions.
- Invite a Joint Hare to collaborate.

Trail data remains private until released.

---

## Configure Visibility

The Hare selects one of the following modes:

- **Hidden** — No trail information is visible before the event.
- **Timed Release** — Trail becomes visible automatically at a configured time.
- **Manual Release** — Hare releases the trail during the event.
- **Public Preview** — Limited information is visible before the event without revealing the full route.

Communities may define a default mode.

---

## Prepare Participants

The Hare may publish:

- What to bring
- Safety notices
- Meeting instructions
- Parking information
- Contact details
- Weather recommendations

---

## Event Monitoring

The Hare can view:

- Registration numbers
- Check-in status
- Volunteer assignments
- Participant announcements
- Operational alerts

---

## During the Event

The Hare may:

- Publish announcements.
- Release the trail (if manual).
- Update meeting information.
- Respond to incidents.
- Coordinate with volunteers.

---

## Event Completion

The Hare:

- Marks the event complete.
- Reviews participation.
- Transfers responsibility to the Scribe for the Trail Report.
- Reviews operational notes.

---

# Decision Logic

```
Trail Ready?

├── No
│     └── Continue Planning
│
└── Yes
      │
      ▼
Visibility Mode?

├── Hidden
├── Timed
├── Manual
└── Preview
      │
      ▼
Publish Event
```

---

# Business Rules

- Every run must have at least one Hare.
- Multiple Hares may collaborate.
- Trail visibility must follow the configured release mode.
- Event history cannot be deleted after completion; it may only be archived according to community policy.
- Trail revisions are versioned.
- Visibility changes are audited.

---

# UI States

- Draft
- Planning
- Ready for Review
- Published
- Registration Open
- Registration Closed
- Event Active
- Trail Released
- Event Completed
- Archived
- Error

---

# Backend Operations

- Create event.
- Save draft.
- Store trail geometry.
- Manage trail versions.
- Apply visibility rules.
- Publish announcements.
- Record operational updates.
- Mark completion.
- Archive event.

---

# Notifications

Immediate

- Event published.
- Trail released.
- Schedule updated.
- Important announcements.

Scheduled

- Registration reminders.
- Volunteer reminders.
- Weather alerts (if integrated).

---

# AI Assistance

AI may:

- Review event details for completeness.
- Suggest preparation checklists.
- Detect conflicting schedules.
- Recommend participant guidance.
- Generate draft event descriptions.
- Flag unusually long or hazardous routes for review.

AI shall not:

- Reveal hidden trail information.
- Publish events automatically.
- Modify visibility settings.
- Override Hare decisions.

---

# Offline Behaviour

Available offline:

- Event details.
- Planning notes.
- Trail drafts.
- Checklists.

Changes synchronize when connectivity returns.

Conflicts require Hare review before merging.

---

# Security & Privacy

- Hidden trails are encrypted and inaccessible to unauthorized users.
- Only authorized planners may edit event details.
- All trail releases and visibility changes are logged.
- Sensitive location information is protected until the configured release point.

---

# Accessibility

- Keyboard-accessible planning tools (web).
- Screen reader support.
- High contrast.
- Dynamic text.
- Reduced motion.
- Accessible map controls where feasible.

---

# Performance Targets

Event editor load:

≤ 2 seconds

Trail save:

≤ 1 second

Announcement publication:

≤ 2 seconds

Visibility update:

≤ 2 seconds

---

# Analytics Events

RUN_CREATED

RUN_UPDATED

TRAIL_SAVED

TRAIL_RELEASED

ANNOUNCEMENT_PUBLISHED

EVENT_COMPLETED

---

# Error Recovery

### Connectivity lost

Save locally.

Resume synchronization automatically.

---

### Trail save conflict

Display both versions.

Allow manual merge.

---

### Release failed

Keep trail private.

Notify the Hare.

Allow retry.

---

### Event cancellation

Notify registered participants.

Explain the reason when appropriate.

Offer rescheduling options.

---

# Experience Contract

Maximum taps to publish an announcement:

≤ 3

Trail draft autosave:

Always enabled

Primary CTA:

Publish Event / Save Draft (depending on state)

Accessibility:

WCAG 2.2 AA target

Critical operations require confirmation where irreversible.

---

# Acceptance Criteria

- Hares can create and manage runs.
- Hidden trails remain protected until release.
- Participants receive accurate event information.
- Collaborative planning is supported.
- Event history is preserved.

---

# Future Enhancements

- Collaborative real-time trail editing.
- Offline map editing.
- Route simulation.
- Terrain and elevation analysis.
- Weather-aware planning.
- Hazard reporting.
- Template trails for recurring events.

---

# Related Specifications

J-003 Join a Run

J-004 Participate in a Run

J-006 Write Trail Report

J-007 Volunteer Workflow

J-009 Committee Workflow

TF-008 Hare Workflow