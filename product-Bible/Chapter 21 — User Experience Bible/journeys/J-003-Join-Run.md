# Journey Specification J-003

## Join a Run

---

Document ID

HCP-JS-003

Status

Draft

Version

1.0

---

# Purpose

Enable a community member to successfully join an upcoming Hash run with confidence while ensuring all eligibility requirements are satisfied.

---

# Scope

This journey covers:

- Discovering a run
- Viewing run details
- Confirming participation
- Meeting participation requirements
- Receiving confirmation
- Preparing for the event

It does not cover:

- Attending the run (J-004)
- Event creation
- Committee approval workflows

---

# Primary Persona

Community Member

---

# Supporting Personas

Visitor (public run discovery)

Committee Member

Hare

Volunteer

---

# Business Goals

- Increase event participation.
- Reduce manual attendance management.
- Improve attendance forecasting.
- Improve newcomer conversion.
- Provide organizers with reliable participant counts.

---

# User Goals

"I want to join this run and know everything I need before arriving."

---

# Preconditions

- User account exists.
- User is authenticated.
- Run has not ended.
- User has permission to view the run.
- Internet connectivity is available (cached viewing supported offline).

---

# Triggers

- User taps an upcoming run.
- User opens an invitation.
- User follows a shared run link.
- User receives a notification.

---

# Entry Points

- Home
- Upcoming Runs
- Community Page
- Calendar
- Notification
- Deep Link
- QR Code
- Shared URL

---

# Journey Overview

```
Discover Run
      │
      ▼
Open Run Details
      │
      ▼
Review Information
      │
      ▼
Eligibility Check
      │
      ▼
Join Run
      │
      ▼
Confirmation
      │
      ▼
Calendar Reminder
      │
      ▼
Ready for Run Day
```

---

# Detailed User Flow

1. User opens the run details page.
2. The system displays:
   - Title
   - Date and time
   - Meeting location
   - Trail difficulty (if available)
   - Distance (if available)
   - Organizer/Hare
   - Participation requirements
3. User reviews the information.
4. User selects **Join Run**.
5. The system checks:
   - Membership requirements
   - Capacity (if limited)
   - Registration deadline
   - Any required acknowledgements
6. If eligible, the user confirms participation.
7. The system records the attendance.
8. The interface updates to **You're Joining This Run**.
9. A confirmation notification is sent.
10. The event appears in the user's calendar within HCP.

---

# Decision Logic

```
Run Available?

├── No
│     └── Display Closed
│
└── Yes
      │
      ▼
Eligible?

├── No
│     └── Explain Requirement
│
└── Yes
      │
      ▼
Already Joined?

├── Yes
│     └── Show Joined State
│
└── No
      │
      ▼
Join
```

---

# Business Rules

- A user cannot join the same run twice.
- Joining automatically links the user to the event roster.
- Invitation-only runs require a valid invitation.
- Registration closes at the configured deadline.
- Organizers may override attendance where permitted.
- Capacity limits, if configured, must be enforced.

---

# UI States

- Loading
- Run Available
- Already Joined
- Join Available
- Registration Closed
- Invitation Required
- Waitlist (optional future enhancement)
- Offline (view only)
- Error

---

# Backend Operations

Primary Endpoint

POST /api/v1/runs/{runId}/join

Supporting Operations

- Validate permissions
- Check registration status
- Check capacity
- Create attendance record
- Update attendance count
- Publish analytics event
- Trigger notifications

---

# Notifications

Immediate

- In-app confirmation
- Push notification

Scheduled

- Reminder 24 hours before
- Reminder 2 hours before
- Organizer announcements

Optional

- Calendar export
- Calendar sync

---

# AI Assistance

AI may:

- Explain run terminology.
- Recommend suitable runs.
- Estimate preparation based on weather or terrain.
- Suggest what to bring.
- Answer newcomer questions.

AI shall not:

- Automatically register attendance.
- Override organizer rules.
- Modify event details.

---

# Offline Behaviour

Users may:

- View cached run information.
- Read previous announcements.

Users may not:

- Join a run while offline.

If a join request is initiated just before connectivity is lost, the app should clearly indicate whether the request was completed or requires a retry to avoid duplicate attempts.

---

# Security & Privacy

- Respect run visibility settings.
- Protect private event information.
- Log attendance changes.
- Prevent unauthorized registrations.
- Validate every request server-side.

---

# Accessibility

- Screen reader support
- Keyboard navigation (web)
- Dynamic text
- High contrast
- Reduced motion
- Large touch targets
- Accessible maps where practical

---

# Performance Targets

Run Details

≤ 2 seconds

Join Request

≤ 500 ms server target

Navigation

≤ 200 ms perceived

---

# Analytics Events

RUN_VIEWED

JOIN_RUN_CLICKED

JOIN_RUN_SUCCESS

JOIN_RUN_FAILED

RUN_REMINDER_OPENED

FIRST_RUN_JOINED

---

# Error Recovery

Scenario: Network failure

Action:

- Preserve current screen.
- Explain the issue.
- Offer retry.
- Do not lose context.

---

Scenario: Run becomes full

Action:

- Explain why registration is unavailable.
- Offer similar upcoming runs.
- If waitlists are supported in the future, offer to join the waitlist.

---

Scenario: Registration deadline passed

Action:

- Display the closing time.
- Suggest the next scheduled run.

---

# Experience Contract

Maximum taps to join:

≤ 4

Maximum perceived wait:

≤ 2 seconds

Primary CTA:

One

Confirmation:

Immediate

Recovery:

Always available

Accessibility:

WCAG 2.2 AA target

---

# Acceptance Criteria

- Eligible users can join successfully.
- Duplicate registrations are prevented.
- Registration status is always clear.
- Notifications are delivered as configured.
- Organizers see updated attendance.
- Users understand what happens next.

---

# Future Enhancements

- Waitlists
- Guest registrations (if enabled by a community)
- Group registrations
- Smart preparation checklists
- Live travel estimates
- Weather-based recommendations

---

# Related Specifications

J-001 User Onboarding

J-002 Join Kennel

J-004 Participate in a Run

TF-003 Join Run Task Flow