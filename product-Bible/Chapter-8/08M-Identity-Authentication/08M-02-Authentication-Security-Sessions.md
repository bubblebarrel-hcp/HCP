# Annex 08M — Identity & Authentication

## Part 3 — Authentication, Security, Sessions & Device Management

---

Document ID:
HCP-PB-08M-02

Parent:
Annex 08M — Identity & Authentication

Domain:
Authentication & Session Security

Status:
Draft

Version:
1.0

---

# Purpose

This document defines how users authenticate, establish trusted sessions, register devices, recover access, and secure their HCP identities.

The authentication architecture balances strong security with a seamless user experience, ensuring members can safely access HCP throughout a lifetime of participation.

---

# Vision

Security should protect the community without becoming a barrier to participation.

Members should trust that their identities, contributions, and governance responsibilities are safeguarded by modern authentication practices.

---

# Philosophy

Authentication proves who you are.

Authorization determines what you may do.

Trust evolves over time.

Security adapts to context.

---

# Guiding Principles

- Passwordless-first architecture where practical.
- Multi-factor authentication (MFA) support.
- Device awareness.
- Risk-based authentication.
- Recovery without losing history.
- Privacy by design.

---

# Authentication Methods

Supported authentication methods include:

- Email and password
- Magic link
- Passkeys (WebAuthn)
- Authenticator applications (TOTP)
- SMS (optional and configurable)
- Social sign-in (optional)
- Enterprise identity providers (future federation)

Organizations may restrict or recommend specific methods for privileged roles.

---

# FR-ID-013 — Account Registration

Registration supports:

- Email verification
- Optional invitation codes
- CAPTCHA or equivalent abuse protection
- Acceptance of platform terms
- Initial privacy configuration

Successful registration creates a permanent Identity record.

---

# FR-ID-014 — Multi-Factor Authentication

Members may enable one or more MFA methods.

Privileged roles (such as Grand Masters or Platform Administrators) may require MFA before performing sensitive actions.

Supported factors include:

- Authenticator app
- Passkey
- Hardware security key (future)
- Backup recovery codes

---

# FR-ID-015 — Device Management

Members can view and manage trusted devices.

Each device records:

- Device name
- Platform
- Browser or app version
- First sign-in
- Last activity
- Trust status
- Approximate location (where available and lawful)

Members may revoke any device at any time.

---

# FR-ID-016 — Session Management

The platform maintains secure sessions with support for:

- Session expiration
- Refresh tokens
- Concurrent sessions
- Device-specific sessions
- Session revocation
- "Log out from all devices"

Sensitive actions may require re-authentication.

---

# FR-ID-017 — Risk-Based Authentication

HCP evaluates contextual signals such as:

- New device
- Unusual location
- Impossible travel patterns
- Repeated failed sign-ins
- Elevated governance actions

Based on assessed risk, additional verification may be requested.

---

# FR-ID-018 — Account Recovery

Recovery options include:

- Verified email
- Backup recovery codes
- Trusted device confirmation
- Officer-assisted verification (where constitutionally appropriate)
- Platform support review

Recovery procedures preserve the original Identity and historical records.

---

# FR-ID-019 — Credential Management

Members may:

- Change passwords
- Add or remove passkeys
- Rotate MFA methods
- Review security history
- Revoke compromised credentials

Credential changes are recorded in the security audit log.

---

# FR-ID-020 — Security Activity Log

Members have access to a personal security log showing:

- Successful sign-ins
- Failed sign-in attempts
- Password changes
- MFA updates
- Device additions
- Device removals
- Recovery events
- Session revocations

Suspicious activity is highlighted for review.

---

# FR-ID-021 — Service & API Authentication

HCP supports authentication for:

- Internal platform services
- Mobile applications
- Web clients
- Public APIs
- Partner integrations

Service identities are managed separately from human identities and follow least-privilege principles.

---

# Business Principles

Security should build confidence.

Recovery should preserve continuity.

Authentication should adapt without becoming intrusive.

---

# Completion Criteria

Complete when:

- Authentication methods are defined.
- MFA is supported.
- Session management is documented.
- Device trust is established.
- Recovery workflows preserve identity.

---

# Next Document

08M-03 — Authorization, Roles, Permissions & Trust Framework