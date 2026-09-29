# Annex 08E — Runs

## Part 1 — Overview & Lifecycle

---

Document ID: HCP-PB-08E

Parent Document:
Chapter 8 — Functional Requirements Specification

Domain:
Runs

Status:
Draft

Version:
1.0

---

# Purpose

This annex defines the lifecycle, governance, execution, participation, archival, and historical preservation of every Hash Run within the Hash Community Platform.

Unlike traditional event-management systems, HCP models every Run as a **Run Session**.

A Run Session is a living object that evolves before, during and after the physical run.

Every Run Session ultimately becomes a permanent **Run Capsule**, preserving the complete story of that day.

---

# Product Philosophy

A Run is not simply an event.

It is the central experience of the Hash.

Everything else revolves around it.

- Trails exist because of Runs.
- Beer Checks exist because of Runs.
- Photos belong to Runs.
- Videos belong to Runs.
- Trail Reports describe Runs.
- Passport stamps are awarded because of Runs.

The Run Session therefore becomes the primary aggregate within HCP.

---

# Guiding Principle

> Every Run.
>
> Every Trail.
>
> Every Story.

---

# Core Concepts

## Run Session

A Run Session represents the complete lifecycle of one scheduled Hash Run.

It includes planning, execution, participation, reporting, media, statistics and archival.

---

## Run Capsule

After completion, every Run Session becomes immutable.

Instead of disappearing into history, it becomes a permanent digital record known as a **Run Capsule**.

Run Capsules preserve the collective memory of the Hash community.

---

## Run Timeline

Every Run Session progresses through a series of well-defined stages.

```
Announcement
      │
Planning
      │
Hares Assigned
      │
Trail Design
      │
Trail Hidden
      │
Trail Released
      │
Check-in Opens
      │
Run Begins
      │
Beer Checks
      │
Circle
      │
Trail Report
      │
Media Collection
      │
AI Story Generation
      │
Run Capsule
      │
Passport Updates
```

---

# Lifecycle States

A Run Session shall always exist in one of the following states.

## Draft

Being planned.

Only organizers may view.

---

## Scheduled

Visible to participants.

Trail remains hidden.

Attendance opens.

---

## Trail Hidden

Trail exists.

Navigation unavailable.

Participants cannot access the route.

---

## Trail Released

Trail becomes available according to Hare configuration.

Navigation activates.

---

## Live

Run is in progress.

Attendance locked.

Live map enabled.

Beer Stops become interactive.

Media uploads begin.

Comments enabled.

---

## Circle

Run completed.

Circle activities recorded.

Awards recorded.

Songs recorded.

Announcements captured.

---

## Reporting

Hash Scribe publishes official report.

Community uploads continue.

AI may generate first draft.

---

## Archived

Run closes.

Statistics finalized.

Passport updates completed.

Run becomes read-only.

---

## Run Capsule

Permanent historical record.

Never deleted.

Searchable forever.

---

# Primary Actors

The following personas participate in a Run Session.

• Hare

• Co-Hare

• Grand Master

• RA

• Hash Scribe

• Committee

• Registered Hasher

• Visiting Hasher

• Guest

• Spectator (future)

---

# Run Session Ownership

Every Run Session belongs to exactly one Kennel.

A Kennel may own many Run Sessions.

A Run Session cannot exist without a Kennel.

---

# Relationships

A Run Session owns:

• Trail

• Waypoints

• Beer Checks

• Attendance

• Visitors

• Media

• Circle

• Awards

• Songs

• Trail Report

• AI Story

• Comments

• Likes

• Passport Updates

• Statistics

---

# Business Principles

The platform shall preserve every Run permanently.

No Run Session may be physically deleted once participants have attended.

Corrections shall occur through audited revisions rather than destructive edits.

---

# Success Criteria

A successful Run Session should answer every question a Hasher might ask years later.

Who laid it?

Who attended?

Where did it go?

Where was the Beer Check?

What happened in Circle?

Who wrote the report?

What photos exist?

What memories remain?

---

# Next Part

Part 2 introduces the complete Functional Requirements for planning, scheduling and managing Run Sessions.

Requirement IDs begin with:

FR-RUN-001