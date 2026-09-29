# Chapter 21 — User Experience Bible

## Part 3 — User Mental Models

---

Document ID:
HCP-PB-21-03

Parent:
Chapter 21 — User Experience Bible

Domain:
User Mental Models

Status:
Draft

Version:
1.0

---

# Purpose

This document defines the mental models users are expected to have when interacting with the Hash Community Platform (HCP).

Its purpose is to ensure the platform behaves in ways that match user expectations, reducing learning time, confusion, and support needs.

---

# Vision

The platform should behave the way users expect, not the way the system is implemented.

---

# Philosophy

People understand software by relating it to experiences they already know.

The platform should use familiar concepts, language, and workflows instead of exposing technical implementation details.

---

# Mental Model 1 — Communities

Users think:

"I belong to one or more communities."

The interface should reinforce belonging rather than membership management.

Avoid exposing database concepts such as community IDs or relationship tables.

---

# Mental Model 2 — Events

Users think:

"I'm joining today's event."

The interface should emphasize participation rather than registration workflows.

Joining should feel immediate and welcoming.

---

# Mental Model 3 — Trails

Users think:

"We're following today's trail."

Trail information should be organized around the experience, not around files, maps, or records.

---

# Mental Model 4 — Memories

Users think:

"I'm sharing memories from the event."

Media uploads should feel like contributing to a shared story rather than managing assets.

---

# Mental Model 5 — Roles

Users think:

"Today I'm helping organize."

Roles should feel like responsibilities rather than permissions.

The interface should expose additional capabilities naturally when responsibilities change.

---

# Mental Model 6 — Notifications

Users think:

"The community has something important to tell me."

Notifications should emphasize relevance instead of system activity.

---

# Mental Model 7 — Search

Users think:

"Help me find what I'm looking for."

Search should prioritize meaningful results over exact matches.

It should tolerate spelling mistakes, synonyms, and partial queries.

---

# Mental Model 8 — AI Assistance

Users think:

"Help me finish my task."

AI should feel like an assistant—not an obstacle or replacement.

Suggestions should remain editable.

Users retain final control.

---

# Mental Model 9 — Privacy

Users think:

"I choose what others can see."

Privacy settings should be organized around visibility rather than technical permissions.

---

# Mental Model 10 — History

Users think:

"I can always find things again."

Important information should remain discoverable.

History should feel permanent unless users intentionally remove it.

---

# Cross-Cutting Principles

The interface should:

- Use familiar language.
- Group related actions.
- Preserve context.
- Minimize surprises.
- Explain unexpected behavior.

---

# Avoid

Avoid exposing:

- Database terminology.
- Internal IDs.
- Technical errors.
- Infrastructure concepts.
- Permission matrices.

These belong in engineering—not in the user experience.

---

# Business Rules

## BR-UX-061

User-facing concepts shall reflect real-world community activities.

---

## BR-UX-062

Technical implementation details shall remain hidden from end users unless required for troubleshooting.

---

## BR-UX-063

Role changes shall be communicated in terms of responsibilities rather than permissions.

---

## BR-UX-064

AI assistance shall remain user-controlled.

---

## BR-UX-065

Information architecture shall align with user mental models.

---

# Acceptance Criteria

The mental model framework succeeds when:

- New users understand the platform quickly.
- Support requests related to navigation decrease.
- Common workflows feel intuitive.
- Users rarely encounter unfamiliar terminology.
- Product decisions consistently reflect user expectations.

---

# Completion Criteria

Complete when:

- Core mental models are documented.
- Cross-cutting principles are established.
- Technical abstractions are hidden from the primary user experience.

---

# Next Document

21-04 — Experience Principles