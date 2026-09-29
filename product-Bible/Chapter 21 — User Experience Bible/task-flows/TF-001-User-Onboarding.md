# Task Flow TF-001

## User Onboarding

---

Task ID: TF-001

Journey: J-001 User Onboarding

Status: Draft

Version: 1.0

---

# Purpose

Describe the exact interaction flow for helping a new user create an account, complete a minimum useful profile, join or discover a first kennel, and understand the next action.

---

# Primary Actor

Visitor

---

# Trigger

User launches HCP for the first time, opens an invitation link, scans a QR code, or selects Create Account.

---

# Preconditions

- Application is installed or web session is available.
- User is not authenticated.
- Network connectivity is available for account creation.
- Invitation context may be present but is not required.

---

# UI Flow

Welcome

↓

Create Account or Sign In

↓

Account Details

↓

Verification

↓

Profile Setup

↓

Location or Invitation Context

↓

Suggested Kennels

↓

Join First Kennel or Explore

↓

Welcome Home

---

# Screen Elements

Welcome screen:

- Product identity
- Short orientation
- Create Account
- Sign In

Account screen:

- Email or phone
- Passwordless or password flow, depending on platform policy
- Terms and privacy links

Profile setup:

- Display name
- Optional profile photo
- Optional city or region
- Notification preferences

Next step:

- Suggested kennel
- Invitation target
- Upcoming nearby run
- Explore communities

---

# Validation Rules

Email or phone valid?

↓

Account already exists?

↓

Verification completed?

↓

Minimum profile complete?

↓

Invitation valid?

↓

Continue to suggested next action

---

# API

POST /api/v1/auth/register

POST /api/v1/auth/verify

PATCH /api/v1/users/me/profile

GET /api/v1/kennels/suggestions

---

# Success State

- User account exists.
- Authentication session is active.
- Minimum profile is complete.
- First recommended action is visible.
- Onboarding completion event is emitted.

---

# Failure States

Email already exists

↓

Offer Sign In

Verification failed

↓

Allow retry and resend

Invitation expired

↓

Explain and route to discovery

Network error

↓

Preserve entered details and retry

---

# Accessibility

- Form fields have explicit labels.
- Errors are announced to assistive technology.
- Verification inputs support paste and keyboard entry.
- Focus moves to the next required field or success heading.
- Dynamic text and reduced motion are supported.

---

# Analytics

ONBOARDING_STARTED

ACCOUNT_CREATED

VERIFICATION_COMPLETED

PROFILE_COMPLETED

SUGGESTED_KENNELS_VIEWED

ONBOARDING_COMPLETED

---

# Performance

Initial screen ready: <= 1 second

Account creation response target: <= 1 second

Profile save response target: <= 500 ms

Suggested kennel load: <= 2 seconds

---

# Acceptance Criteria

- A new user can create an account without guidance.
- Existing users are routed to sign in without duplicate accounts.
- Profile setup collects only minimum useful information.
- Invitation context is preserved through authentication.
- User lands on a clear next action after onboarding.

