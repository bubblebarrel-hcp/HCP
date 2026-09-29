# Annex 08M — Identity & Authentication

## Part 2 — Identity Model, Profiles & Membership Architecture

---

Document ID:
HCP-PB-08M-01

Parent:
Annex 08M — Identity & Authentication

Domain:
Identity Model & Membership Architecture

Status:
Draft

Version:
1.0

---

# Purpose

This document defines the canonical identity model for the Hash Community Platform (HCP), including person records, digital identities, public profiles, memberships, affiliations, and the relationship between an individual and the organizations they participate in.

The identity model is designed to support a lifetime of participation while preserving privacy, historical continuity, and institutional relationships.

---

# Vision

Every person has one identity.

That identity grows throughout their Hash journey.

Organizations come and go.

Roles change.

Experiences accumulate.

Identity remains continuous.

---

# Philosophy

Identity is not created for an application.

The application exists to serve the identity.

A Hasher's digital identity should represent decades of participation rather than a temporary user account.

---

# Guiding Principles

- Identity permanence.
- Privacy by default.
- Public profile by choice.
- Historical continuity.
- Multiple organizational affiliations.
- Federation-ready architecture.

---

# Core Identity Model

The identity domain consists of the following primary entities:

- Person
- Identity
- Public Profile
- Private Profile
- Membership
- Organization Affiliation
- Role Assignment
- Identity Preferences
- Identity Verification
- Trust Level

---

# FR-ID-001 — Person Record

The Person entity represents the human being behind the account.

Person records include:

- Legal name (optional)
- Preferred name
- Date of birth (optional)
- Country
- Languages
- Emergency contacts
- Privacy preferences

Personally identifiable information is never exposed publicly unless explicitly permitted.

---

# FR-ID-002 — Identity Record

The Identity entity represents the permanent HCP identity.

Identity includes:

- Unique identifier (UUID)
- Public Hash name
- Join date
- Status
- Trust level
- Verification status
- Identity history
- Public profile reference

Identity identifiers are immutable.

---

# FR-ID-003 — Hash Names

A person may have:

- One current primary Hash name.
- Historical Hash names.
- Nicknames.
- Local aliases where recognized.

Historical names remain searchable for historical accuracy.

---

# FR-ID-004 — Public Profile

The public profile may include:

- Profile photograph
- Hash name
- Biography
- Home kennel
- Current roles
- Awards
- Passport summary
- Trail statistics
- Community highlights
- Public Run Capsules

Visibility respects privacy settings.

---

# FR-ID-005 — Private Profile

Private information includes:

- Contact details
- Recovery methods
- Identity verification
- Medical information (where provided)
- Emergency contacts
- Security preferences

Private data is encrypted and accessible only to authorized workflows.

---

# FR-ID-006 — Membership Architecture

A single identity may hold multiple memberships simultaneously.

Examples:

- Home Kennel
- Honorary Member
- Visiting Member
- Event Committee
- National Association
- Heritage Committee

Each membership records:

- Organization
- Membership type
- Start date
- End date
- Status
- Sponsor (if applicable)

---

# FR-ID-007 — Organization Affiliations

Affiliations extend beyond formal membership.

Examples include:

- Volunteer
- Advisor
- Event Organizer
- Former Officer
- Honorary Guest
- Partner Organization

Affiliations contribute to the individual's historical record.

---

# FR-ID-008 — Role Assignments

Roles are attached to affiliations rather than directly to identities.

Example:

Identity
↓

Abuja H3 Membership
↓

Grand Master

Later:

Identity
↓

Interhash Committee
↓

Volunteer Coordinator

This allows independent role histories across organizations.

---

# FR-ID-009 — Identity Timeline

Every identity maintains a chronological timeline including:

- Memberships
- Leadership roles
- Awards
- Passport milestones
- Events attended
- Trails created
- Community achievements

The timeline becomes the foundation for historical storytelling.

---

# FR-ID-010 — Trust Levels

The platform supports configurable trust levels.

Example:

- Unverified
- Verified Email
- Verified Member
- Trusted Volunteer
- Officer Verified
- Organization Verified
- Platform Verified

Trust influences access to sensitive workflows.

---

# FR-ID-011 — Identity Verification

Organizations may verify:

- Membership
- Officer appointments
- Event participation
- Awards
- Historical contributions

Verification records include:

- Verifier
- Date
- Supporting Evidence Record
- Expiration (if applicable)

---

# FR-ID-012 — Identity Preferences

Members may configure:

- Language
- Time zone
- Notification preferences
- Public visibility
- Community discovery
- AI personalization
- Accessibility preferences

Preferences apply consistently across all HCP services.

---

# Business Principles

Identity belongs to the individual.

Membership belongs to the organization.

History belongs to the community.

Privacy belongs to the member.

---

# Completion Criteria

Complete when:

- Identity model is defined.
- Membership architecture is complete.
- Public and private profiles are separated.
- Identity timeline exists.
- Trust model is established.

---

# Next Document

08M-02 — Authentication, Security, Sessions & Device Management