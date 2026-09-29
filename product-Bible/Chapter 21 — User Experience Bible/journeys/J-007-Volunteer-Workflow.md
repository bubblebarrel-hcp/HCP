# Journey Specification J-007

## Volunteer Workflow

---

Document ID

HCP-JS-007

Status

Draft

Version

1.0

---

# Purpose

Enable volunteers to efficiently perform assigned operational duties before, during, and after a Hash run while providing organizers with visibility into event readiness and execution.

---

# Scope

This journey covers:

- Volunteer assignment
- Task acceptance
- Event preparation
- Operational task execution
- Incident reporting
- Task completion
- Post-event wrap-up

This journey does not cover:

- Committee administration (J-009)
- Hare planning (J-008)

---

# Primary Persona

Volunteer

---

# Supporting Personas

Committee Member

Community Administrator

Community Member

---

# Business Goals

- Reduce organizer workload.
- Improve operational consistency.
- Increase volunteer participation.
- Improve event safety.
- Record operational history.

---

# User Goal

"I want to know exactly what I'm responsible for and complete my duties efficiently."

---

# Preconditions

- Volunteer has an active HCP account.
- Volunteer has accepted an assignment.
- Event exists.
- Volunteer permissions are active.

---

# Triggers

- Assignment notification.
- Manual acceptance.
- Committee assignment.
- Volunteer self-registration (where enabled).

---

# Entry Points

- Volunteer Dashboard
- Notification
- Event Details
- Community Dashboard

---

# Journey Overview

Assignment
      │
      ▼
Accept Role
      │
      ▼
Review Responsibilities
      │
      ▼
Prepare
      │
      ▼
Perform Tasks
      │
      ▼
Report Progress
      │
      ▼
Resolve Issues
      │
      ▼
Complete Assignment
      │
      ▼
Event Wrap-up

---

# Detailed User Flow

## Assignment

The volunteer receives:

- Assigned role
- Event name
- Date and time
- Reporting location
- Assigned coordinator
- Required equipment
- Checklist

---

## Acceptance

Volunteer may:

- Accept assignment
- Decline assignment
- Request reassignment

---

## Preparation

Volunteer reviews:

- Event briefing
- Safety information
- Operational checklist
- Emergency contacts
- Venue information

---

## During Event

Volunteer may:

- Check in participants
- Answer questions
- Mark completed tasks
- Report incidents
- Request assistance
- Communicate with coordinators

---

## Wrap-up

Volunteer:

- Confirms completed duties
- Submits notes
- Reports outstanding issues
- Marks assignment complete

---

# Decision Logic

Assignment Received?

├── Declined
│      ▼
Notify Coordinator
│
└── Accepted
       │
       ▼
Task Complete?

├── No
│      ▼
Continue Assignment
│
└── Yes
       │
       ▼
Submit Completion

---

# Operational Role Types

Supported examples:

- Check-in Volunteer
- Registration Volunteer
- Beer Stop Coordinator
- Photographer
- Safety Marshal
- First Aid Officer
- Sweeper
- Equipment Coordinator

Communities may define additional volunteer roles.

---

# Business Rules

- Volunteers may hold multiple assignments.
- Assignments have defined start and end times.
- Volunteers may only access tools required for their assigned role.
- Incident reports cannot be deleted after submission.
- Coordinators may reassign incomplete tasks.

---

# UI States

- Assignment Pending
- Accepted
- Preparing
- Active
- Awaiting Confirmation
- Completed
- Cancelled
- Error

---

# Backend Operations

- Retrieve assignments.
- Record acceptance.
- Update task progress.
- Store incident reports.
- Record completion.
- Notify coordinators.
- Generate operational statistics.

---

# Notifications

Immediate

- Assignment received.
- Assignment updated.
- Incident response.
- Coordinator message.

Scheduled

- Event reminder.
- Shift reminder.

Optional

- Thank-you message.
- Volunteer recognition.

---

# AI Assistance

AI may:

- Summarize responsibilities.
- Recommend task order.
- Answer operational questions.
- Generate post-event summaries.
- Highlight incomplete checklist items.

AI shall not:

- Reassign volunteers.
- Close incidents.
- Override coordinator decisions.

---

# Offline Behaviour

Available offline:

- Assigned checklist.
- Event briefing.
- Emergency contacts.
- Task completion queue.

Pending updates synchronize automatically when connectivity returns.

---

# Security & Privacy

- Volunteers only access information relevant to their duties.
- Incident reports are securely stored.
- Sensitive participant information is protected.
- All operational changes are audited.

---

# Accessibility

- Screen reader support.
- Large touch targets.
- High contrast.
- Offline-first design.
- Reduced motion.

---

# Performance Targets

Assignment load:

≤ 2 seconds

Checklist updates:

≤ 500 ms

Notifications:

Near real-time

---

# Analytics Events

VOLUNTEER_ASSIGNED

ASSIGNMENT_ACCEPTED

CHECKLIST_COMPLETED

INCIDENT_REPORTED

ASSIGNMENT_COMPLETED

VOLUNTEER_RETURNED

---

# Error Recovery

### Connectivity lost

Continue using cached checklists.

Queue updates until connectivity returns.

---

### Assignment changed during event

Notify volunteer immediately.

Highlight the updated task.

---

### Incident submission fails

Store locally.

Retry automatically.

Allow manual retry.

---

# Experience Contract

Assignment acceptance:

≤ 2 taps

Checklist always available.

Primary CTA:

Complete Next Task

Recovery:

Automatic where feasible

Accessibility:

WCAG 2.2 AA target

---

# Acceptance Criteria

- Volunteers can manage assignments independently.
- Coordinators have visibility into task progress.
- Incidents are captured reliably.
- Offline operation is supported.
- Operational history is preserved.

---

# Future Enhancements

- Volunteer shift swapping.
- Skill and certification tracking.
- Digital equipment checkout.
- Volunteer achievement system.
- Team messaging channels.
- AI-powered staffing recommendations.

---

# Related Specifications

J-004 Participate in a Run

J-008 Hare Workflow

J-009 Committee Workflow

TF-007 Volunteer Workflow