# Journey Specification J-010

## Create a New Kennel

---

Document ID

HCP-JS-010

Status

Draft

Version

1.0

---

# Purpose

Enable qualified members to establish a new Hash kennel within HCP through a structured registration, verification, and onboarding process that protects community integrity while supporting global growth.

---

# Scope

This journey covers:

- Registering a new kennel
- Defining governance
- Creating branding
- Assigning founding committee members
- Verification
- Publishing
- Community onboarding

It does not cover:

- Day-to-day committee administration (J-009)
- Event management (J-008)

---

# Primary Persona

Founding Organizer

---

# Supporting Personas

Committee Member

Regional Coordinator (optional)

Platform Administrator

---

# Business Goals

- Encourage sustainable community growth.
- Prevent duplicate communities.
- Preserve community history.
- Standardize community creation.
- Improve discoverability.

---

# User Goal

"I want to establish a new Hash kennel that members can confidently discover and join."

---

# Preconditions

- User has an HCP account.
- User meets minimum eligibility requirements.
- Required community information is available.

---

# Triggers

- User selects **Create Community**.
- Invitation from a regional coordinator.
- Platform onboarding for a new region.

---

# Entry Points

- Dashboard
- Communities
- Administration
- Welcome Flow
- Direct Link

---

# Journey Overview

```
Start Registration
        │
        ▼
Check Existing Kennels
        │
        ▼
Enter Community Details
        │
        ▼
Configure Governance
        │
        ▼
Invite Founding Committee
        │
        ▼
Submit Verification
        │
        ▼
Platform Review
        │
        ▼
Approved
        │
        ▼
Community Published
        │
        ▼
Member Onboarding
```

---

# Detailed User Flow

## Step 1 — Community Information

Founder provides:

- Kennel name
- Common abbreviation
- Country
- State / Province
- City
- Meeting area
- Description
- Founding date (optional if newly formed)

---

## Step 2 — Duplicate Detection

The system searches for:

- Similar kennel names
- Matching locations
- Similar abbreviations

Potential duplicates are displayed before registration continues.

---

## Step 3 — Branding

Founder may upload:

- Logo
- Banner
- Community colors
- Social links
- Website
- Contact email

Branding may be updated later.

---

## Step 4 — Governance

Founder defines:

- Committee structure
- Initial committee members
- Membership policy
- Event visibility defaults
- Notification preferences

---

## Step 5 — Verification

Verification may include:

- Existing Hash references
- Supporting documentation (optional)
- Regional coordinator review (where applicable)
- Platform review

Verification requirements may vary by region.

---

## Step 6 — Publication

Once approved:

- Community profile becomes searchable.
- Members can request to join.
- Events can be created.
- Committee dashboards become available.

---

# Decision Logic

```
Duplicate Found?

├── Yes
│      ▼
Review Existing Community
│
└── No
       │
       ▼
Submit Verification
       │
       ▼
Approved?

├── No
│      ▼
Return with Feedback
│
└── Yes
       │
       ▼
Publish Community
```

---

# Business Rules

- One active kennel per verified identity and location unless an exception is approved.
- Duplicate detection runs before submission.
- Communities retain permanent identifiers.
- Community names remain unique within defined geographic constraints.
- Verification status is visible.
- Historical communities may be archived but not permanently deleted.

---

# UI States

- Draft
- Duplicate Warning
- Awaiting Verification
- Under Review
- Approved
- Published
- Archived
- Rejected
- Error

---

# Backend Operations

- Validate submitted information.
- Run duplicate detection.
- Create draft community.
- Store branding assets.
- Create governance records.
- Start verification workflow.
- Publish approved community.
- Generate community identifier.

---

# Notifications

Immediate

- Registration received.
- Verification requested.
- Additional information requested.

Status Updates

- Under review.
- Approved.
- Rejected.
- Published.

Community

- Founding committee invitations.
- Welcome messages.
- First member joined.

---

# AI Assistance

AI may:

- Suggest clearer descriptions.
- Check for incomplete information.
- Recommend governance templates.
- Detect potential duplicate communities.
- Generate welcome content.
- Recommend onboarding steps.

AI shall not:

- Approve communities.
- Override verification.
- Assign committee roles.
- Publish communities automatically.

---

# Offline Behaviour

Users may:

- Prepare draft information.
- Edit descriptions.
- Upload branding assets (queued).

Submission and verification require connectivity.

---

# Security & Privacy

- Founding records are auditable.
- Verification documents are protected.
- Community ownership changes are logged.
- Sensitive contact information is restricted according to permissions.

---

# Accessibility

- Keyboard support.
- Screen reader compatibility.
- High contrast.
- Dynamic text.
- Accessible file uploads.
- Reduced motion.

---

# Performance Targets

Draft save:

≤ 1 second

Duplicate search:

≤ 2 seconds

Verification submission:

≤ 2 seconds

Community publication:

≤ 5 seconds after approval

---

# Analytics Events

KENNEL_CREATION_STARTED

DUPLICATE_WARNING_SHOWN

VERIFICATION_SUBMITTED

KENNEL_APPROVED

KENNEL_PUBLISHED

FOUNDING_MEMBER_INVITED

---

# Error Recovery

### Duplicate detected

Present the potential match.

Allow the user to cancel, request ownership of an existing community (where applicable), or continue with additional justification.

---

### Verification rejected

Explain the reason.

Preserve all entered information.

Allow resubmission after corrections.

---

### Upload failure

Retry without losing previously entered information.

---

# Experience Contract

Maximum steps:

6

Progress indicator:

Always visible

Draft autosave:

Always enabled

Accessibility:

WCAG 2.2 AA target

Primary CTA:

Submit for Verification

---

# Acceptance Criteria

- Legitimate communities can be created successfully.
- Duplicate communities are minimized.
- Verification workflow is clear.
- Governance is configured before publication.
- Founding committee members can begin operating immediately after approval.

---

# Future Enhancements

- Regional federation support.
- Community mergers.
- Community transfer of ownership.
- Anniversary timeline.
- Public verification badges.
- International community directory.

---

# Related Specifications

J-001 User Onboarding

J-002 Join Kennel

J-009 Committee Workflow

TF-010 Create New Kennel