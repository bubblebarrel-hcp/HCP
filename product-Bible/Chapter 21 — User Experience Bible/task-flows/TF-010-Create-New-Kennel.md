# Task Flow TF-010

## Create New Kennel

---

Task ID: TF-010

Journey: J-010 Create a New Kennel

Status: Draft

Version: 1.0

---

# Purpose

Define the flow for registering, verifying, and publishing a new kennel while preventing duplicates and establishing minimum governance.

---

# Primary Actor

Founding Organizer

---

# Trigger

User selects Create Community, opens a regional coordinator invitation, or starts kennel creation from onboarding.

---

# Preconditions

- User has an HCP account.
- User meets minimum eligibility requirements.
- Required community information is available.
- Platform allows new kennel submissions in the region.

---

# UI Flow

Create Community

↓

Eligibility and Orientation

↓

Community Details

↓

Duplicate Detection

↓

Branding

↓

Governance Setup

↓

Founding Committee Invitations

↓

Verification Submission

↓

Review Status

↓

Approved and Published

---

# Validation Rules

Founder eligible?

↓

Required details complete?

↓

Potential duplicate found?

↓

Governance configured?

↓

Verification information complete?

↓

Submit for review

---

# API

POST /api/v1/kennels/drafts

PATCH /api/v1/kennels/{kennelId}

GET /api/v1/kennels/duplicates

POST /api/v1/kennels/{kennelId}/founding-committee

POST /api/v1/kennels/{kennelId}/verification

POST /api/v1/kennels/{kennelId}/publish

---

# Success State

- Draft is saved.
- Verification request is submitted.
- Founding committee invitations are sent.
- Approved kennel is published.
- Founder sees setup checklist and next actions.

---

# Failure States

Duplicate detected

↓

Show possible matches and next options

Verification rejected

↓

Preserve draft and show correction path

Upload failure

↓

Retry branding upload without losing form state

Eligibility blocked

↓

Explain requirement and support contact path

---

# Accessibility

- Multi-step progress is announced.
- Forms have clear labels and inline errors.
- File uploads have accessible alternatives.
- Duplicate warnings are not color-only.
- Draft status is visible and announced.

---

# Analytics

KENNEL_CREATION_STARTED

KENNEL_DRAFT_SAVED

DUPLICATE_WARNING_SHOWN

FOUNDING_MEMBER_INVITED

VERIFICATION_SUBMITTED

KENNEL_APPROVED

KENNEL_PUBLISHED

---

# Performance

Draft save: <= 1 second

Duplicate search: <= 2 seconds

Verification submission: <= 2 seconds

Publication after approval: <= 5 seconds

---

# Acceptance Criteria

- A founder can submit a complete kennel registration.
- Duplicate detection runs before verification.
- Governance exists before publication.
- Verification status is clear.
- Published kennels are immediately discoverable according to visibility rules.

