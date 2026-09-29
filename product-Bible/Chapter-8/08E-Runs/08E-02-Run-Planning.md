# Annex 08E — Runs

# Part 3 — Run Planning

---

Document ID: HCP-PB-08E-02

Parent Document:
Annex 08E — Runs

Domain:
Run Planning

Status:
Draft

Version:
1.0

---

# Purpose

This document defines all planning activities required before a Run Session transitions to the live execution phase.

Run Planning encompasses scheduling, hare coordination, venue preparation, trail planning, logistics, participant communication, safety, and operational readiness.

The objective is to ensure that every Run Session is well-organized while preserving the spontaneity and traditions of the Hash.

---

# Planning Principles

The planning process shall:

- Preserve the surprise of the trail.
- Minimize administrative overhead.
- Encourage collaboration among hares.
- Support both simple and complex runs.
- Record planning decisions for future reference where appropriate.

---

# FR-RUNPLAN-001 — Define Run Details

## Priority

Critical

## Actors

- Hare
- Co-Hare
- Trail Master
- Grand Master

### Description

The system shall allow authorized users to define the core details of a Run Session.

### Required Information

- Run Number
- Run Name (optional)
- Theme
- Date
- Start Time
- Check-in Time
- Kennel
- Venue
- Expected Duration
- Run Type

### Acceptance Criteria

- Required fields validated.
- Draft saved.
- Changes tracked in the audit log.

---

# FR-RUNPLAN-002 — Hare Collaboration

The platform shall support multiple Hares working on the same Run Session.

### Capabilities

- Assign Lead Hare.
- Assign Co-Hares.
- View collaborator list.
- Record planning notes.
- Track changes made by each Hare.

---

# FR-RUNPLAN-003 — Venue Management

Each Run Session shall define:

- Start location
- Finish location
- Circle location
- Parking information
- Public transport guidance
- Accessibility notes

Future support:

- Multiple venue checkpoints
- Venue templates

---

# FR-RUNPLAN-004 — Trail Planning

The planning interface shall allow Hares to prepare:

- Preliminary route
- Estimated distance
- Terrain type
- Elevation profile
- Estimated duration
- False trails
- Checkpoints
- Regroups
- Beer Stops
- Water Stops
- Hazard locations

Trail data remains hidden until release.

---

# FR-RUNPLAN-005 — Trail Visibility

Supported visibility modes:

- Hidden Until Start
- Hidden Until Scheduled Time
- Manual Release
- Visible to Hares Only
- Visible to Officers Only

Visibility changes are audited.

---

# FR-RUNPLAN-006 — Participant Limits

The system may enforce configurable participant limits.

### Options

- Unlimited
- Maximum Capacity
- Invitation Only
- Waiting List

---

# FR-RUNPLAN-007 — Registration & RSVP

Participants may:

- RSVP Going
- RSVP Maybe
- RSVP Not Going
- Withdraw RSVP

The platform shall maintain attendance forecasts.

---

# FR-RUNPLAN-008 — Safety Planning

Run planners may record:

- Emergency contacts
- Medical notes
- Hazard warnings
- Weather considerations
- Water availability
- Escape routes
- Emergency meeting points

Safety information may be marked as officer-only.

---

# FR-RUNPLAN-009 — Equipment Checklist

The system shall provide a configurable checklist.

Example items:

- Chalk
- Flour
- Whistle
- First Aid Kit
- Water
- Beer
- Ice
- Cups
- Snacks
- Lighting
- GPS Device
- Phone Charger

Kennels may customize checklist templates.

---

# FR-RUNPLAN-010 — Communications

Authorized users may schedule communications including:

- Run announcement
- Reminder notifications
- Venue changes
- Safety updates
- Last-minute notices

Notifications shall support scheduled delivery.

---

# FR-RUNPLAN-011 — Weather Monitoring

The platform may display weather forecasts for the planned route.

Future releases may include:

- Rain alerts
- Heat warnings
- Lightning notifications

Weather does not automatically cancel a Run Session.

---

# FR-RUNPLAN-012 — Planning Checklist

The platform shall maintain a planning progress indicator.

Example checklist:

- Hares Assigned
- Venue Confirmed
- Trail Planned
- Beer Stop Confirmed
- Safety Reviewed
- Communications Sent
- Trail Hidden
- Ready for Release

Progress assists organizers but does not prevent scheduling unless required by kennel policy.

---

# FR-RUNPLAN-013 — Draft Review

Before publishing, authorized officers may review the Run Session.

Review may include:

- Completeness
- Safety
- Scheduling conflicts
- Venue accuracy
- Hare assignments

Review outcomes are recorded.

---

# FR-RUNPLAN-014 — Publish Run Session

Publishing makes the Run Session visible according to its visibility settings.

Publishing automatically:

- Adds the Run Session to the kennel calendar.
- Enables participant RSVP.
- Sends notifications (if configured).

Trail information remains hidden unless explicitly released.

---

# FR-RUNPLAN-015 — Planning Audit

All planning activities shall be recorded.

Audit entries include:

- Field modified
- Previous value
- New value
- User
- Timestamp

Audit history is read-only.

---

# Business Principles

- Planning should enhance—not replace—the traditional role of the Hare.
- The element of surprise is central to the Hash experience.
- Safety and preparedness should be encouraged without making the process bureaucratic.
- Collaboration should be simple and transparent.
- Planning data should become part of the historical Run Capsule where appropriate.

---

# Completion Criteria

This document is complete when:

- Runs can be fully planned.
- Multiple Hares can collaborate.
- Trail secrecy is preserved.
- Logistics are documented.
- Safety planning is supported.
- Audit history is maintained.
- Run Sessions are ready for execution.

---

# Next Document

**08E-03 — Run Day**

This document will define everything that happens from check-in through the live run, including attendance, live maps, beer checks, participant tracking, media capture, and real-time interactions.