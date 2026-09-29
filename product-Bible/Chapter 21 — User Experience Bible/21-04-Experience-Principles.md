# Chapter 21 — User Experience Bible

## Part 4 — Experience Principles

---

Document ID:
HCP-PB-21-04

Parent:
Chapter 21 — User Experience Bible

Domain:
Experience Principles

Status:
Draft

Version:
1.0

---

# Purpose

This document defines the practical experience principles that guide the design, implementation, and evaluation of every user interaction within the Hash Community Platform (HCP).

These principles provide a common standard for product managers, designers, engineers, QA, and contributors when making product decisions.

---

# Vision

Every interaction should move the user closer to their goal with confidence.

---

# Principle 1 — Guide, Don't Instruct

The interface should naturally lead users toward successful outcomes.

Use layout, hierarchy, defaults, and context to guide behavior before relying on instructions.

---

# Principle 2 — Minimize Decisions

Every additional decision increases cognitive effort.

Where practical:

- Pre-fill known information.
- Select sensible defaults.
- Recommend common options.
- Hide advanced settings until needed.

---

# Principle 3 — Preserve Progress

Users should rarely lose work.

The platform should:

- Autosave drafts.
- Preserve form data.
- Queue supported offline actions.
- Restore interrupted sessions where appropriate.

---

# Principle 4 — Keep Context

Users should always understand:

- Where they are.
- What they're working on.
- What changed.
- What happens next.

Avoid forcing users to reconstruct context after navigation or interruptions.

---

# Principle 5 — Make Success Obvious

When an action succeeds, users should know immediately.

Examples:

- Clear confirmation messages.
- Updated interface state.
- Visual acknowledgement.
- Optional undo actions.

---

# Principle 6 — Make Failure Recoverable

Errors should never become dead ends.

Every recoverable failure should provide:

- A clear explanation.
- A suggested next step.
- Preservation of user input where possible.

---

# Principle 7 — Prioritize Common Tasks

Optimize for the activities users perform most frequently.

Rare administrative tasks should not complicate everyday workflows.

---

# Principle 8 — Respect Momentum

Avoid interrupting users during focused tasks.

Reduce unnecessary dialogs, confirmations, and navigation changes.

Let people stay "in the flow."

---

# Principle 9 — Build Confidence Incrementally

Trust is earned through many small interactions.

Examples include:

- Predictable navigation.
- Accurate search results.
- Honest messaging.
- Reliable autosave.
- Transparent AI suggestions.

---

# Principle 10 — Design for Return Visits

Returning users should immediately recognize:

- New activity.
- Pending actions.
- Relevant updates.
- Recently viewed content.

The product should help users continue rather than start over.

---

# Experience Review Checklist

Every significant feature should be evaluated against these questions:

- Is the user's primary goal obvious?
- Can the task be completed with minimal unnecessary decisions?
- Is progress preserved?
- Is feedback immediate and understandable?
- Are mistakes recoverable?
- Does the interface preserve context?
- Does this encourage meaningful participation?
- Is the experience accessible?
- Does it perform well on typical devices and networks?
- Would a first-time user understand what to do?

---

# Business Rules

## BR-UX-066

User progress shall be preserved whenever technically feasible.

---

## BR-UX-067

Every primary workflow shall provide immediate feedback for significant actions.

---

## BR-UX-068

Product decisions shall prioritize high-frequency tasks over infrequent administrative workflows.

---

## BR-UX-069

Recoverable failures shall provide actionable guidance.

---

## BR-UX-070

Experience reviews shall be completed before production release of major features.

---

# Acceptance Criteria

The experience principles succeed when:

- Users complete common tasks efficiently.
- Progress is rarely lost.
- Errors are easier to recover from.
- Returning users quickly regain context.
- Product reviews consistently reference these principles.

---

# Completion Criteria

Complete when:

- Experience principles are documented.
- Review checklist is established.
- Operational UX standards are defined.

---

# Next Document

21-05 — User Journey Maps