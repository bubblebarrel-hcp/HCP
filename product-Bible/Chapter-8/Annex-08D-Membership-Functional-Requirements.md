# Annex 08D — Membership Functional Requirements

**Document ID:** HCP-PB-08D  
**Parent Document:** Chapter 8 — Functional Requirements Specification  
**Domain:** Membership (`FR-MEMBER-*`)  
**Status:** Draft

---

# 1. Purpose

This annex defines how users become members of kennels, participate in the global Hash community, hold officer positions, maintain membership history, and build their lifelong **Hash Passport**.

Membership is intentionally independent from authentication and user profiles because a hasher may belong to multiple kennels throughout their lifetime.

---

# 2. Scope

This annex includes:

- Membership requests
- Membership approval
- Membership types
- Membership statuses
- Invitations
- Officer eligibility
- Visitor participation
- Guest participation
- Membership history
- Suspensions
- Reinstatement
- Leaving a kennel
- Member removal
- Hash Passport
- Achievements
- Milestones

---

# 3. Functional Requirements

## FR-MEMBER-001 — Request Membership

### Description

The system shall allow authenticated users to request membership in any discoverable kennel.

### Business Rules

- Users may belong to multiple kennels.
- Duplicate pending requests are prohibited.
- Hidden kennels require invitations.

### Acceptance Criteria

- Membership request submitted successfully.
- Officers receive notification.
- User can monitor request status.

---

## FR-MEMBER-002 — Membership Approval

### Description

Authorized officers shall approve or reject membership requests.

### Business Rules

- Approval records the approving officer.
- Timestamp is stored.
- Optional approval notes are supported.
- Reapplication cooldown is configurable.

### Acceptance Criteria

- Approved users become Active Members.
- Rejected users receive notification.
- Audit log captures every decision.

---

## FR-MEMBER-003 — Membership Types

Supported membership classifications include:

- Full Member
- Associate Member
- Visiting Hasher
- Honorary Member
- Life Member
- Guest
- Virgin
- Committee Member

### Future Enhancements

- Custom membership types per kennel.

---

## FR-MEMBER-004 — Membership Status

Supported statuses:

- Pending
- Active
- Suspended
- Inactive
- Resigned
- Removed
- Archived

### Business Rules

- Historical status changes shall never be deleted.
- Status transitions shall be recorded in the audit log.

---

## FR-MEMBER-005 — Invitations

### Description

Officers may invite users using:

- Email
- QR Code
- Invitation Link

### Business Rules

- Invitation expiry is configurable.
- Invitations may be revoked before acceptance.

---

## FR-MEMBER-006 — Visitor Participation

### Description

Hashers visiting another kennel shall participate without changing permanent membership.

### Visitor Participation Contributes To

- Personal statistics
- Run attendance
- Passport history
- Country statistics
- Kennel visitor analytics

---

## FR-MEMBER-007 — Home Kennel Transfer

### Description

Users may change their Home Kennel.

### Business Rules

- Historical memberships remain intact.
- Previous Home Kennel remains in history.

---

## FR-MEMBER-008 — Suspension

### Description

Authorized officers may suspend members.

### Required Information

- Reason
- Start Date
- End Date (optional)

### Business Rules

Suspension never removes historical participation.

---

## FR-MEMBER-009 — Reinstatement

### Description

Suspended or inactive members may be reinstated.

### Business Rules

The platform preserves:

- Original join date
- Membership history
- Milestones
- Attendance records

---

## FR-MEMBER-010 — Membership Timeline

Each membership shall maintain a permanent timeline.

Supported events include:

- Joined
- Approved
- Officer Appointment
- Suspension
- Reinstatement
- Promotion
- Resignation
- Removal

Timeline entries shall be immutable.

---

## FR-MEMBER-011 — Officer Eligibility

Only eligible Active Members may receive officer appointments.

Eligibility rules remain configurable by each kennel.

---

## FR-MEMBER-012 — Membership Badges

Examples include:

- Founding Member
- Veteran Hasher
- Visiting Hasher
- Life Member
- Committee Member
- Officer
- Trail Legend
- Beer Stop Hero

### Business Principle

Badges recognize participation rather than competition.

---

## FR-MEMBER-013 — Membership History

The platform shall permanently preserve:

- Join dates
- Officer appointments
- Membership types
- Awards
- Milestones
- Historical participation

Historical data survives account deactivation where appropriate.

---

## FR-MEMBER-014 — Leave Kennel

### Description

Members may voluntarily leave a kennel.

### Business Rules

- Officer roles must be relinquished first.
- Historical attendance remains preserved.
- Passport history remains unaffected.

---

## FR-MEMBER-015 — Remove Member

### Description

Authorized officers may remove members.

### Required Information

- Removal reason
- Audit record
- Notification

Historical contributions remain attributed.

---

# 4. Hash Passport

## Vision

Every hasher owns a **Hash Passport**—a lifelong digital record of adventures, friendships, trails, and achievements across the global Hash community.

Unlike a profile, the Passport represents a living history that grows with every run.

---

## FR-PASSPORT-001 — Automatic Passport Creation

Every user shall receive a Hash Passport immediately after registration.

The Passport is permanent and linked to the user's account.

---

## FR-PASSPORT-002 — Passport Stamps

The platform shall automatically award stamps for significant milestones.

Examples:

- First Hash
- First Hare
- First Beer Check
- First Trail Report
- First Visiting Kennel
- First International Run
- First Interhash
- Nash Hash
- Red Dress Run
- Charity Run

---

## FR-PASSPORT-003 — Countries Hashed

The Passport shall automatically record:

- Countries
- States / Provinces
- Cities
- Kennels Visited

Interactive maps may be supported in future releases.

---

## FR-PASSPORT-004 — Milestones

Examples include:

- 10 Runs
- 50 Runs
- 100 Runs
- 500 Runs
- 1,000 Runs

The milestone engine shall remain configurable.

---

## FR-PASSPORT-005 — Lifetime Statistics

The Passport maintains:

- Runs Attended
- Trails Laid
- Beer Checks
- Reports Written
- Photos Uploaded
- Videos Uploaded
- Countries Hashed
- Kennels Joined
- Years Active
- Distance Covered

Statistics update automatically.

---

## FR-PASSPORT-006 — Memories

Users may pin memorable moments to their Passport.

Examples include:

- Favorite Trail
- Favorite Beer Stop
- Favorite Photo
- Memorable Interhash
- Personal Notes

---

## FR-PASSPORT-007 — Passport Sharing

Users may share a public version of their Passport using:

- Read-only Link
- QR Code

Sharing shall respect user privacy settings.

---

# 5. Business Principles

- Membership is lifelong history.
- Historical participation must never be lost.
- Visitors are first-class participants.
- Recognition celebrates experiences rather than competition.
- Every hasher's journey deserves to be preserved.

---

# 6. Domain Completion Criteria

This domain is complete when:

- Users can request and manage memberships.
- Officers can govern memberships.
- Visitor participation is fully supported.
- Membership history is permanently preserved.
- Every hasher owns a living Hash Passport documenting their journey.

---

# Progress Tracker

- ✅ Annex 08A — Authentication
- ✅ Annex 08B — User Management
- ✅ Annex 08C — Kennels
- ✅ Annex 08D — Membership
- ⏳ Next: Annex 08E — Runs