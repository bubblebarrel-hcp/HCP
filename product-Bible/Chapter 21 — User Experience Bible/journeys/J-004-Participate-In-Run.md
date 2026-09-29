# Journey Specification J-004

## Participate in a Run

---

Document ID

HCP-JS-004

Status

Draft

Version

1.0

---

# Purpose

Support members throughout the complete lifecycle of participating in a Hash run—from arrival through the closing social activities—while enhancing, but never distracting from, the in-person experience.

---

# Scope

This journey covers:

- Preparing for arrival
- Check-in
- Participating in the run
- Live trail interaction
- Capturing memories
- Completing the event

This journey does not cover:

- Joining a run (J-003)
- Writing the trail report (J-006)
- Hare planning (J-008)

---

# Primary Persona

Community Member

---

# Supporting Personas

Visitor (where public participation is allowed)

Volunteer

Hare

Scribe

Committee Member

---

# Business Goals

- Increase successful event participation.
- Reduce organizer workload.
- Improve community engagement.
- Capture richer event history.
- Encourage repeat participation.

---

# User Goal

"I want to enjoy today's run and stay connected with the community."

---

# Preconditions

- User has joined the run or public participation is permitted.
- Event is active.
- User has the HCP mobile app.
- GPS permissions are optional but recommended for navigation features.

---

# Triggers

- Event reminder notification.
- Manual selection from Upcoming Runs.
- QR code at the event.
- Deep link shared by organizers.

---

# Entry Points

- Home
- My Runs
- Notifications
- Calendar
- Community Feed
- QR Code

---

# Journey Overview

```
Reminder
    │
    ▼
Travel to Venue
    │
    ▼
Arrive
    │
    ▼
Check-in
    │
    ▼
Opening Circle
    │
    ▼
Trail Begins
    │
    ▼
Beer Stop(s)
    │
    ▼
Trail Ends
    │
    ▼
Closing Circle
    │
    ▼
Social Gathering
    │
    ▼
Share Memories
```

---

# Detailed User Flow

### Before Arrival

The user can:

- View meeting location.
- Open navigation.
- Review event announcements.
- See recommended arrival time.
- Check weather (if integrated).
- View what to bring.

---

### Arrival

The user may:

- Scan an event QR code.
- Check in manually.
- Be checked in by a volunteer.
- Confirm attendance automatically if location services are enabled and the community chooses to use geofencing.

---

### During the Run

The app should remain quiet by default.

Optional features include:

- Live trail guidance (when enabled by the Hare).
- Safety announcements.
- Emergency contact information.
- Location sharing (opt-in only).
- Water or checkpoint notifications where relevant.

The app must never encourage users to look at their phones continuously while moving.

---

### Beer Stops

Where applicable, users may:

- View tagged photos.
- Leave comments.
- React to shared moments.
- See checkpoint information.

These interactions should be lightweight and optional.

---

### Trail Completion

Users receive:

- Confirmation of completed participation.
- Prompt to upload photos or videos.
- Invitation to view or contribute to the trail report when available.

---

### After the Event

The app highlights:

- Event gallery.
- Trail report (when published).
- Upcoming runs.
- Community discussions.
- Volunteer opportunities.

---

# Decision Logic

```
User Arrived?

├── No
│     └── Continue Navigation
│
└── Yes
      │
      ▼
Checked In?

├── No
│     └── Prompt Check-in
│
└── Yes
      │
      ▼
Run Active?

├── No
│     └── Await Start
│
└── Yes
      │
      ▼
Participate
```

---

# Business Rules

- Attendance should only be recorded once.
- Communities may choose manual, QR, or geofenced check-in.
- Live trail visibility follows the Hare's configured release rules.
- Location sharing is strictly opt-in.
- Users may leave the event at any time without affecting historical attendance records.

---

# UI States

- Upcoming
- Navigating
- Awaiting Check-in
- Checked In
- Run Active
- Beer Stop
- Run Complete
- Gallery Available
- Trail Report Available
- Offline
- Error

---

# Backend Operations

- Verify attendance.
- Record check-in.
- Update participation statistics.
- Retrieve live announcements.
- Synchronize media placeholders.
- Publish completion events.

---

# Notifications

Immediate

- Check-in confirmed.
- Important organizer announcements.

Scheduled

- Run starting soon.
- Trail report published.
- Photo memories available.

Optional

- Community thank-you message.
- Upcoming related runs.

---

# AI Assistance

AI may:

- Explain Hash traditions for newcomers.
- Answer event FAQs.
- Suggest what to bring before the event.
- Recommend future runs based on participation.
- Generate post-event summaries for personal activity history.

AI shall not:

- Replace organizer instructions.
- Publish event content without user approval.
- Infer attendance without confirmation.

---

# Offline Behaviour

The app should continue functioning with limited connectivity.

Available offline:

- Cached event details.
- Meeting location.
- Emergency contacts.
- Previously downloaded trail information (if released).

Pending actions, such as photo uploads or comments, should synchronize automatically when connectivity returns.

---

# Security & Privacy

- Respect visibility settings for private events.
- Keep live location sharing disabled unless explicitly enabled.
- Protect participant lists according to community privacy settings.
- Encrypt sensitive communications.

---

# Accessibility

- High-contrast maps where supported.
- VoiceOver/TalkBack compatibility.
- Dynamic text.
- Reduced motion.
- Large touch targets.
- Accessible QR check-in alternatives.

---

# Performance Targets

Event screen load:

≤ 2 seconds

Check-in confirmation:

≤ 1 second

Announcements:

≤ 2 seconds after publication

---

# Analytics Events

RUN_OPENED

CHECK_IN_COMPLETED

RUN_STARTED

BEER_STOP_VIEWED

RUN_COMPLETED

MEDIA_PROMPT_SHOWN

RETURNING_PARTICIPANT

---

# Error Recovery

### GPS unavailable

Explain that navigation features are limited and offer manual directions.

---

### QR scan fails

Allow manual check-in or volunteer-assisted check-in.

---

### Connectivity lost

Continue using cached information and synchronize pending actions when the connection returns.

---

### Event cancelled

Notify participants immediately, explain the reason if available, and suggest the next scheduled event.

---

# Experience Contract

Maximum taps to check in:

≤ 3

Maximum perceived wait:

≤ 2 seconds

Primary CTA:

One

Critical information always accessible.

The app should never distract users from the physical event.

---

# Acceptance Criteria

- Users can check in successfully.
- Attendance is recorded accurately.
- Live event information is reliable.
- Privacy controls are respected.
- Participants can transition naturally into post-event activities.

---

# Future Enhancements

- Apple Wallet / Google Wallet event passes.
- Bluetooth-based proximity check-in.
- Wearable device integration.
- Live safety alerts.
- Team challenges and participation badges.
- AI-generated personal event timeline.

---

# Related Specifications

J-003 Join a Run

J-005 Upload Photos & Videos

J-006 Write Trail Report

TF-004 Participate in a Run