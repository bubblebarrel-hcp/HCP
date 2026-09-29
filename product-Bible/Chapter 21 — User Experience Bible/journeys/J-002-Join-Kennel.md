# Journey Specification J-002

## Join a Kennel

---

Document ID

HCP-JS-002

---

Status

Draft

Version

1.0

---

Purpose

Enable a member to discover, evaluate, and join one or more kennels with minimal friction while respecting each kennel's membership policies.

---

Primary Persona

Community Member

---

Supporting Personas

Visitor

Committee Member

Community Administrator

---

Business Goal

Increase successful community participation while reducing administrative effort.

---

User Goal

"I want to join a kennel so I can participate in its activities."

---

Success Definition

The journey is successful when the user:

✓ Finds a suitable kennel.

✓ Understands what the kennel is about.

✓ Completes the join process.

✓ Receives confirmation.

✓ Knows what to do next.

---

Entry Points

• Search

• Nearby Kennels

• Invitation Link

• QR Code

• Shared Event

• Community Directory

• Friend Profile

---

Preconditions

User account exists.

User is signed in.

Internet connection available.

Offline browsing of previously viewed kennels is permitted where feasible.

---

Journey Flow

Launch Discover

↓

Browse Kennels

↓

Search or Filter

↓

Select Kennel

↓

View Kennel Profile

↓

Review Details

↓

Tap Join

↓

Decision:

Open Membership

↓

Join Immediately

OR

Approval Required

↓

Submit Join Request

↓

Pending Review

↓

Approved

↓

Welcome Screen

↓

Upcoming Events

↓

Community Feed

```

---

## Decision Logic

```
Membership Type?

├── Open
│      ↓
│   Join Immediately
│
├── Approval Required
│      ↓
│   Submit Request
│
└── Invitation Only
       ↓
Invitation Required
```

---

## User Questions

The interface should answer:

- What is this kennel?
- Where is it located?
- How active is it?
- Who can join?
- When is the next run?
- Who are the organizers?
- What happens after I join?

---

## Emotional Journey

| Stage | Emotion | UX Goal |
|--------|----------|----------|
| Discover | Curious | Encourage exploration |
| Evaluate | Interested | Build confidence |
| Join | Slightly uncertain | Remove friction |
| Approved | Excited | Celebrate belonging |
| First Visit | Welcome | Encourage participation |

---

## AI Assistance

AI may:

- Recommend kennels based on location and interests.
- Explain unfamiliar hashing terminology.
- Answer newcomer questions.
- Translate descriptions where appropriate.
- Suggest upcoming runs after joining.

AI shall not automatically join a kennel or make membership decisions.

---

## Offline Behaviour

Users may:

- Browse cached kennel profiles.
- View cached event information.

Users may not:

- Submit new join requests while offline.

Pending actions should synchronize automatically when connectivity returns.

---

## Notifications

Trigger:

Join approved

↓

Push Notification

↓

Email (optional)

↓

In-app Notification

---

Trigger:

Upcoming first run

↓

Reminder

↓

Directions (if enabled)

---

## Analytics Events

KENNEL_DISCOVERY_STARTED

KENNEL_PROFILE_VIEWED

JOIN_REQUEST_SUBMITTED

JOIN_REQUEST_APPROVED

JOIN_COMPLETED

TIME_TO_JOIN

FIRST_RUN_AFTER_JOIN

---

## Accessibility

Support:

- Screen readers
- Keyboard navigation (web)
- Dynamic text
- High contrast
- Reduced motion
- Large touch targets

---

## Failure Scenarios

### Request Declined

Explain the outcome respectfully.

If permitted, explain why.

Offer to discover similar kennels.

---

### Network Failure

Save progress where possible.

Allow retry.

---

### Invitation Expired

Explain clearly.

Provide alternative discovery options.

---

## Security Considerations

Do not expose private kennel information before membership where restricted.

Respect visibility rules for invitation-only communities.

Log membership changes for auditing.

---

## Performance Targets

Kennel search results:

≤ 1 second (cached)

≤ 2 seconds (network)

Kennel profile load:

≤ 2 seconds

Join confirmation:

≤ 1 second after server response

---

## Experience Contract

Maximum taps:

5

Maximum waiting time:

2 seconds

Primary CTA:

One

Recovery:

Always available

Accessibility:

WCAG 2.2 AA target

---

## Acceptance Criteria

✓ Users can find a kennel easily.

✓ Join requirements are clear.

✓ Membership status is always visible.

✓ Notifications are delivered appropriately.

✓ First-time members know what to do next.

---

## Related Journeys

J-001 User Onboarding

J-003 Join a Run

J-009 Committee Workflow

J-010 Create a Kennel