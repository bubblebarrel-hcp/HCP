# Annex 08M — Identity & Authentication

## Part 4 — Authorization, Roles, Permissions & Trust Framework

---

Document ID:
HCP-PB-08M-03

Parent:
Annex 08M — Identity & Authentication

Domain:
Authorization & Trust Framework

Status:
Draft

Version:
1.0

---

# Purpose

This document defines how HCP determines what an authenticated identity may do across organizations, events, governance, platform services, and community features.

Authorization is context-aware and combines role-based, relationship-based, and policy-based access control.

---

# Vision

The same person may hold different responsibilities in different contexts.

Permissions should follow responsibility—not identity.

---

# Philosophy

Authenticate once.

Authorize continuously.

Trust is contextual.

Authority is delegated.

Everything is auditable.

---

# Guiding Principles

- Least privilege.
- Context-aware authorization.
- Delegated authority.
- Time-limited elevation.
- Evidence-backed decisions.
- Full auditability.

---

# Authorization Model

HCP combines multiple authorization strategies:

- RBAC (Role-Based Access Control)
- ABAC (Attribute-Based Access Control)
- ReBAC (Relationship-Based Access Control)
- PBAC (Policy-Based Access Control)

Each request may evaluate one or more strategies before granting access.

---

# Why Hybrid Authorization?

RBAC answers:

"What role do you have?"

ABAC answers:

"What attributes apply right now?"

ReBAC answers:

"How are you related to this resource?"

PBAC answers:

"What organizational policy governs this action?"

Together they provide flexible, future-proof authorization.

---

# Authorization Context

Every authorization request evaluates context such as:

- Identity
- Organization
- Membership
- Officer role
- Committee assignment
- Event participation
- Passport status (where relevant)
- Trust level
- Device trust
- Session risk
- Time
- Location (where appropriate)
- Organizational policy

---

# FR-ID-022 — Role Assignment

Roles are granted through organizational affiliations.

Examples include:

- Grand Master
- Trail Master
- Beer Master
- Event Director
- Volunteer
- Committee Chair
- Moderator

Roles are scoped to a specific organization, event, or platform service.

---

# FR-ID-023 — Permission Sets

Permissions are grouped into reusable permission sets.

Examples:

Event Organizer

- Create event
- Edit schedule
- Manage volunteers
- Publish announcements

Trail Master

- Publish trails
- Approve trail updates
- Archive trail reports

Governance Officer

- Manage motions
- Publish minutes
- Initiate elections

Permission sets reduce duplication and simplify administration.

---

# FR-ID-024 — Delegated Authority

Officers may delegate specific responsibilities.

Delegations include:

- Delegate
- Scope
- Duration
- Reason
- Evidence Record
- Automatic expiration

Delegation never exceeds the delegator's authority.

---

# FR-ID-025 — Temporary Privileges

Temporary elevation supports scenarios such as:

- Event weekend administration
- Emergency response
- Committee investigations
- Acting officer appointments

Temporary privileges expire automatically.

---

# FR-ID-026 — Relationship-Based Authorization

Relationships influence permissions.

Examples:

- Trail author
- Event organizer
- Committee member
- Assigned volunteer
- Photographer
- Run Capsule contributor

Relationship-based permissions reduce unnecessary administrative roles.

---

# FR-ID-027 — Policy Engine

Organizations may define policies governing:

- Membership approvals
- Voting eligibility
- Officer appointments
- Financial approvals
- Event publishing
- Committee visibility

Policies are version-controlled and auditable.

---

# FR-ID-028 — Trust Framework

Authorization considers trust signals including:

- Identity verification
- Membership verification
- Officer verification
- Device trust
- Security history
- Community standing (without public scoring)

Trust supports—not replaces—organizational governance.

---

# FR-ID-029 — Permission Evaluation

Before granting access, HCP evaluates:

Identity

↓

Authentication Status

↓

Session Trust

↓

Organization Context

↓

Role

↓

Relationship

↓

Policy

↓

Evidence Requirements

↓

Decision

Every decision may be recorded for audit purposes.

---

# FR-ID-030 — Authorization Audit

Every privileged action records:

- Identity
- Permission evaluated
- Resource
- Decision
- Timestamp
- Context
- Supporting policy
- Evidence reference

Audit records remain immutable.

---

# Business Principles

Authority follows responsibility.

Responsibility requires accountability.

Accountability requires evidence.

---

# Completion Criteria

Complete when:

- Hybrid authorization is defined.
- Delegation is supported.
- Trust framework is documented.
- Policy engine is specified.
- Authorization auditing is complete.

---

# Next Document

08M-04 — Federation, External Identity & Business Rules