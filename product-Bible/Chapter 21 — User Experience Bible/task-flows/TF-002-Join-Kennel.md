# Task Flow TF-002

## Join Kennel

---

Task ID: TF-002

Journey: J-002 Join a Kennel

Status: Draft

Version: 1.0

---

# Purpose

Describe the exact interaction flow required for joining a kennel while respecting each kennel's membership policy.

---

# Primary Actor

Community Member

---

# Trigger

User taps Join on a kennel profile, invitation page, shared community link, or onboarding recommendation.

---

# Preconditions

- User account exists.
- User is authenticated or can be returned to the same kennel after authentication.
- Kennel is visible to the user.
- Membership status is available.

---

# UI Flow

Kennel Profile

↓

Review Description, Officers, Location, Activity, and Policy

↓

Join

↓

Authentication Check

↓

Membership Policy Check

↓

Confirmation or Request Form

↓

Submit

↓

Success, Pending Review, or Recovery State

---

# Validation Rules

User logged in?

↓

Already member?

↓

Kennel accepts requests?

↓

Invitation required?

↓

Invitation valid?

↓

Continue

---

# Membership Policy Logic

Open membership

↓

Join immediately

Approval required

↓

Submit request and show pending state

Invitation only

↓

Require valid invitation code or link

Closed membership

↓

Explain that joining is unavailable

---

# API

POST /api/v1/kennels/{kennelId}/join

POST /api/v1/kennels/{kennelId}/join-requests

GET /api/v1/kennels/{kennelId}/membership-status

---

# Loading State

- Disable Join button.
- Show progress indicator.
- Prevent duplicate requests.
- Preserve the user's current context.

---

# Success State

- Membership status updates.
- Member count updates.
- User roles refresh.
- Community feed refreshes.
- Success confirmation appears.
- User is offered next actions: view upcoming runs, introduce themselves, or configure notifications.

---

# Failure States

Network error

↓

Retry without losing context

Permission denied

↓

Explain why joining is unavailable

Already member

↓

Show Go to Community

Invitation expired

↓

Explain and offer discovery alternatives

Request declined

↓

Explain respectfully and preserve privacy

---

# Accessibility

- Join controls are keyboard accessible.
- Loading, success, pending, and failure states are announced.
- Focus moves to the confirmation or pending-status heading.
- Dialogs have clear labels and escape paths.
- Dynamic text and high contrast are supported.

---

# Analytics

KENNEL_PROFILE_VIEWED

JOIN_BUTTON_CLICKED

JOIN_REQUEST_SUBMITTED

JOIN_API_SUCCESS

JOIN_API_FAILED

JOIN_COMPLETED

---

# Performance

Membership status check: <= 500 ms target

Join request: <= 500 ms server target

Maximum perceived wait: <= 2 seconds

---

# Acceptance Criteria

- One request is sent per user action.
- Duplicate memberships are prevented.
- Open, approval-required, invitation-only, and closed memberships are handled.
- Authentication returns the user to the original kennel context.
- All states are accessible.

