# Chapter 20 — Product Design Language

## Part 2 — Design Principles

---

Document ID:
HCP-PB-20-02

Parent:
Chapter 20 — Product Design Language

Domain:
Design Principles

Status:
Draft

Version:
1.0

---

# Purpose

This document defines the design principles that guide product decisions across the Hash Community Platform (HCP).

These principles establish a shared decision-making framework for designers, engineers, product managers, and contributors, ensuring every feature delivers a consistent, intuitive, and community-centered experience.

---

# Vision

Consistent principles create consistent experiences.

---

# Principle 1 — Design for People, Not Screens

Every interface exists to help people accomplish meaningful goals.

Avoid designing around pages or layouts. Instead, design around user intentions, tasks, and relationships.

Success is measured by what users accomplish—not by how attractive a screen appears.

---

# Principle 2 — Clarity Before Cleverness

Interfaces should be immediately understandable.

Avoid ambiguous icons, hidden interactions, unnecessary animations, or terminology that requires explanation.

If users need to think about the interface, simplify it.

---

# Principle 3 — One Primary Action

Every screen should have one obvious primary action.

Secondary actions should support—not compete with—the user's main objective.

Users should never wonder:

"What am I supposed to do next?"

---

# Principle 4 — Progressive Disclosure

Reveal complexity only when needed.

Beginners should feel confident.

Experienced users should still have access to powerful capabilities.

---

# Principle 5 — Immediate Feedback

Every interaction should acknowledge the user's action.

Examples include:

- Loading indicators.
- Success confirmations.
- Error explanations.
- Progress indicators.
- State changes.

Silence creates uncertainty.

---

# Principle 6 — Consistency Over Novelty

Users benefit more from familiar patterns than unique interactions.

Reuse established navigation, layouts, terminology, and interaction models whenever possible.

---

# Principle 7 — Forgive Mistakes

People make mistakes.

The platform should make recovery easy through:

- Undo actions.
- Confirmation for destructive operations.
- Autosave.
- Drafts.
- Clear validation messages.

Prevent irreversible errors whenever practical.

---

# Principle 8 — Minimize Cognitive Load

Reduce unnecessary decisions.

Use sensible defaults.

Pre-fill known information.

Group related content.

Hide irrelevant complexity.

Every unnecessary decision slows users down.

---

# Principle 9 — Accessibility by Default

Accessibility is a design requirement, not an enhancement.

Every interaction should support users with different abilities, devices, and environments.

---

# Principle 10 — Respect Time

Fast experiences demonstrate respect.

Reduce:

- Waiting.
- Repetition.
- Unnecessary navigation.
- Excessive forms.
- Duplicate data entry.

Time saved compounds across every interaction.

---

# Principle 11 — Earn Trust Continuously

Trust is built through predictable behavior.

Users should always understand:

- What the platform is doing.
- Why it is happening.
- What information is being used.
- What happens next.

Transparency builds confidence.

---

# Principle 12 — Community-Centered Design

Whenever possible, guide users toward participation rather than passive consumption.

Design should encourage:

- Joining.
- Sharing.
- Collaborating.
- Supporting others.
- Celebrating achievements.

The platform succeeds when communities become stronger.

---

# Decision Framework

When evaluating competing solutions, prioritize:

1. User understanding.
2. Task completion.
3. Community value.
4. Accessibility.
5. Performance.
6. Maintainability.
7. Visual refinement.

---

# Questions for Every Design Review

Before approving a feature, ask:

- Is the primary action obvious?
- Can a first-time user succeed?
- Have unnecessary steps been removed?
- Does this reduce or increase cognitive load?
- Can users recover from mistakes?
- Is the language clear?
- Does this strengthen trust?
- Does it encourage community participation?

---

# Business Rules

## BR-UX-006

Every screen shall expose one clearly identifiable primary action.

---

## BR-UX-007

All destructive actions shall provide an appropriate recovery mechanism or confirmation.

---

## BR-UX-008

Every interactive state shall provide visible user feedback.

---

## BR-UX-009

Accessibility requirements shall be considered during initial design, not after implementation.

---

## BR-UX-010

Product decisions shall prioritize user outcomes over visual novelty.

---

# Acceptance Criteria

The design principles succeed when:

- Product decisions become more consistent.
- New contributors make aligned design choices.
- Users navigate confidently.
- Errors become easier to recover from.
- Community participation increases.

---

# Completion Criteria

Complete when:

- Design principles are documented.
- Review framework is established.
- Decision priorities are defined.

---

# Next Document

20-03 — Emotional Experience