# Annex 08E — Runs

# Part 4 — Run Day

---

Document ID:
HCP-PB-08E-03

Domain:
Run Execution

Status:
Draft

Version:
1.0

---

# Purpose

This document defines everything that occurs during the execution of a Run Session, from participant arrival through completion of the trail.

Run Day is where planning transitions into live experience.

The platform shall support real-time coordination while remaining unobtrusive to the traditions of the Hash.

---

# Guiding Principle

Technology should assist the Hash.

It should never become the center of attention.

Participants should always be able to enjoy the run without constantly interacting with their phones.

---

# Run Day Timeline

```
Venue Opens
        │
Check-In
        │
Pre-Run Gathering
        │
Trail Release
        │
Run Starts
        │
Beer Checks
        │
Trail Completion
        │
Circle
```

---

# FR-RUNDAY-001 — Open Check-In

## Priority

Critical

The system shall allow participants to check into a Run Session.

Supported methods:

- QR Code
- GPS Verification
- Manual Officer Check-In
- Invitation Code

Future:

- NFC
- Bluetooth Beacon

---

# FR-RUNDAY-002 — Attendance Register

Attendance shall record:

- Arrival Time
- Check-In Method
- Membership Type
- Visitor Status
- Home Kennel
- Country

Attendance updates in real time.

---

# FR-RUNDAY-003 — Live Participant Count

The platform shall display:

- Checked-In Participants
- Visitors
- Guests
- Virgins
- Officers Present

Counts update automatically.

---

# FR-RUNDAY-004 — Trail Release

Trail visibility follows the Hare's configured release policy.

Supported release modes:

- Immediate
- Scheduled
- Manual
- At Run Start

Once released:

- Navigation activates.
- Waypoints appear.
- Beer Stops become visible according to configuration.

---

# FR-RUNDAY-005 — Live Navigation

Participants may navigate using:

- Interactive Map
- Compass Mode
- Breadcrumb Trail
- Direction Arrows

Navigation shall support offline map tiles where available.

---

# FR-RUNDAY-006 — Waypoint Interaction

Participants may interact with:

- Beer Stops
- Water Stops
- Regroups
- Scenic Points
- Hazards

Each waypoint may include:

- Photos
- Videos
- Notes
- Reactions
- Comments

---

# FR-RUNDAY-007 — Beer Check Experience

Beer Stops become interactive community moments.

Features include:

- Live arrival feed
- Photo uploads
- Toast reactions
- Group photos
- Short comments
- GPS confirmation

The Hare may optionally reveal trivia or messages at each Beer Check.

---

# FR-RUNDAY-008 — Live Media Uploads

Participants may upload:

- Photos
- Videos
- Voice Notes (future)

Media may be tagged to:

- Run Session
- Trail Segment
- Beer Stop
- Circle
- General Run Gallery

---

# FR-RUNDAY-009 — Live Community Feed

Each Run Session shall include a live activity feed.

Examples:

- John checked in.
- Sarah reached Beer Check #2.
- 12 new photos uploaded.
- Trail released.
- Circle started.

The feed is chronological and updates in real time.

---

# FR-RUNDAY-010 — Participant Safety

Authorized officers may issue live safety notices.

Examples:

- Severe weather
- Trail closure
- Route diversion
- Emergency assistance
- Lost participant alert

Critical notices override normal notifications.

---

# FR-RUNDAY-011 — Visitor Recognition

Visiting Hashers shall be highlighted during the Run Session.

Information includes:

- Home Kennel
- Country
- First Visit
- Returning Visitor

Visitor data contributes to Passport history.

---

# FR-RUNDAY-012 — Live Reactions

Participants may react during the run using lightweight interactions such as:

- 🍺 Cheers
- 👣 On Trail
- 😂 Funny
- ❤️ Loved It

Reactions are designed to be quick and non-disruptive.

---

# FR-RUNDAY-013 — Run Completion

Authorized officers shall end the active Run Session.

The system automatically:

- Stops live tracking
- Locks attendance
- Preserves the route
- Prepares Circle activities

---

# FR-RUNDAY-014 — Transition to Circle

The platform transitions to the Circle phase.

Circle becomes the next managed stage of the Run Session.

Media uploads remain open.

---

# FR-RUNDAY-015 — Run Day Analytics

The platform records:

- Total Attendance
- Visitors
- Trail Distance
- Duration
- Beer Stops Visited
- Media Uploaded
- Comments
- Reactions
- Check-In Methods

These metrics contribute to the Run Capsule and Hash Passport.

---

# Business Principles

- The phone should support the experience, not dominate it.
- Interaction should be lightweight and optional.
- Community moments should be preserved naturally.
- Safety takes precedence over convenience.
- Every participant contributes to the collective story.

---

# Completion Criteria

This document is complete when:

- Participants can check in.
- Trail release is managed.
- Navigation is available.
- Beer Stops are interactive.
- Live media is supported.
- Safety notifications function.
- Run data is preserved for archival.

---

# Next Document

**08E-04 — Circle**

This document will define one of the most culturally significant phases of the Hash lifecycle, including Circle proceedings, songs, awards, announcements, and traditions.