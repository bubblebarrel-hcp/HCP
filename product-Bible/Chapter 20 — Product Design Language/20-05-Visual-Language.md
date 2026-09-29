# Chapter 20 — Product Design Language

## Part 5 — Visual Language

---

Document ID:
HCP-PB-20-05

Parent:
Chapter 20 — Product Design Language

Domain:
Visual Language

Status:
Draft

Version:
1.0

---

# Purpose

This document defines the visual language of the Hash Community Platform (HCP).

It establishes the visual grammar that guides every interface, ensuring consistency across mobile, web, admin, and future Bubble Barrel products.

The goal is not merely aesthetic consistency, but visual clarity that supports user understanding and community participation.

---

# Vision

Every interface should communicate through clarity before decoration.

---

# Philosophy

Visual design exists to support comprehension.

Every color, shape, icon, illustration, spacing decision, and animation should communicate purpose.

Decoration without meaning should be avoided.

---

# Visual Personality

HCP should feel:

- Mischievous
- Rugged
- International
- Human
- Energetic
- Warm
- Trustworthy
- Inclusive

The Hash is irreverent, muddy, boozy, social and slightly chaotic, with a surprisingly strong sense of tradition. The interface should hold that tension: enough attitude that a 25-year-old hasher recognises their community, enough maturity that a Grand Master of thirty years trusts it with the kennel's history.

The interface should avoid appearing corporate, sterile, overly playful, or overly technical.

---

# Shape Language

Preferred characteristics:

- Soft rounded corners.
- Gentle curves.
- Consistent corner radii.
- Comfortable spacing.
- Clean edges.

Avoid aggressive angles or excessive ornamentation.

Rounded forms communicate approachability and reduce visual tension.

---

# Color Philosophy

Color should communicate meaning before branding.

Primary uses include:

- Actions.
- Status.
- Hierarchy.
- Attention.
- Feedback.

Avoid using color as the only means of conveying information.

Accessibility remains mandatory.

---

# The HCP Color System

Approved 2026-09-16 (stakeholder decision, `CODEX/DECISION-LOG.md` D24). This supersedes any earlier forest-green palette.

The identity is three colors: **Orange × Black × Flour**. Someone should look at HCP and see those, not six competing brand colors.

| Name | Hex | Role |
| --- | --- | --- |
| HCP Orange | `#F4511E` | Primary brand: actions, active navigation, trail, brand accents |
| Hash Black | `#171717` | Primary dark: headers, navigation, typography, map UI, dark mode |
| Flour | `#F4F1E8` | Primary light background: an off-white with warmth, not sterile white |
| Beer Gold | `#D9A441` | Secondary accent, used sparingly: milestones, achievements, anniversaries |
| Trail Green | `#3F6B4F` | Outdoor and trail indicators, route markers, map nature UI |
| Hash Red | `#C62828` | Exception only: emergency, hazard, failure, safety warning |
| Ash | `#6B6B63` | Secondary text |
| Chalk | `#FFFFFF` | Surfaces |

Gold, green and red are **semantic**, never brand colors. Kennels keep their own color for their cover and avatar; HCP Orange is the fallback.

## Contrast rules

HCP Orange is a **fill**, not a text color: it is 3.1:1 on Flour and 3.5:1 under white, below the 4.5:1 required for body text. Therefore:

- Orange surfaces (buttons, active tabs) carry Hash Black text: 5.2:1.
- Orange **text**, links and small icons use a darker ember `#B83A0E` on light (5.1:1) and a lighter `#FF7043` on dark (6.9:1).
- Beer Gold follows the same rule: a fill with Hash Black on it, with `#7A5C14` for gold text on light.
- Hash Red lightens to `#F05545` on dark, where `#C62828` falls to 3.4:1.

## Dark mode

Dark mode is a first-class HCP experience, not an inversion: background `#111111`, surface `#1C1C1C`, Flour typography, orange trails, gold beer stops. A night run dashboard should look like it belongs to the Hash.

## Trail visualisation

The map and trail system gets its own visual language, with HCP Orange as the active trail, so a screenshot of HCP is recognisable at a glance: active trail, completed trail, beer stop, checkpoint, false trail, landmark, finish. Specified with Trail Studio.

---

# Typography Philosophy

Typography should prioritize readability.

Characteristics:

- Clear hierarchy.
- Comfortable line height.
- Limited font families.
- Consistent sizing scale.
- High contrast.

Text should never compete with content.

---

# Spacing Philosophy

Whitespace is an active design element.

Spacing should:

- Separate ideas.
- Create rhythm.
- Improve readability.
- Reduce cognitive load.

Crowded interfaces reduce confidence.

---

# Iconography

Icons should:

- Be recognizable.
- Be consistent in stroke and style.
- Support labels where clarity benefits users.
- Represent familiar concepts.

Icons should clarify rather than decorate.

---

# Imagery

Images should emphasize:

- Real communities.
- Authentic moments.
- Diversity.
- Outdoor activities.
- Shared experiences.
- Positive participation.

Avoid generic stock imagery whenever possible.

---

# Illustration

Illustrations should:

- Simplify concepts.
- Welcome new users.
- Explain empty states.
- Humanize technical processes.

Illustrations should complement—not replace—clear language.

---

# Motion

Motion should:

- Explain transitions.
- Reinforce hierarchy.
- Provide feedback.
- Maintain context.

Animation should never distract from the task.

---

# Elevation

Elevation communicates hierarchy.

Use shadows and layers sparingly.

Higher elevation should indicate greater importance or temporary focus, such as dialogs or bottom sheets.

---

# Density

The platform should maintain a medium visual density.

Users should feel:

- Comfortable.
- Unhurried.
- In control.

Avoid extremely dense enterprise layouts and excessively sparse consumer layouts.

---

# Visual Consistency

Consistency applies to:

- Colors.
- Shapes.
- Shadows.
- Icons.
- Spacing.
- Typography.
- Motion.
- Layout patterns.

Visual familiarity reduces learning time.

---

# Business Rules

## BR-UX-021

Visual elements shall communicate purpose before decoration.

---

## BR-UX-022

Color shall not be the sole indicator of meaning.

---

## BR-UX-023

Spacing shall improve readability and interaction clarity.

---

## BR-UX-024

Icons shall support comprehension rather than replace clear language.

---

## BR-UX-025

Motion shall reinforce understanding rather than attract attention.

---

# Acceptance Criteria

The visual language succeeds when:

- Interfaces feel immediately recognizable.
- Users understand hierarchy quickly.
- Reading effort decreases.
- Accessibility standards remain satisfied.
- Products maintain visual consistency across platforms.

---

# Completion Criteria

Complete when:

- Visual grammar is documented.
- Shape, color, typography, spacing, iconography, imagery, and motion philosophies are established.

---

# Next Document

20-06 — Brand Expression