# HCP — Stakeholder Approval Brief

**Hash Community Platform: Product Bible Sign-Off & Flag-Off Readiness**

Document ID: HCP-APPROVAL-BRIEF

Prepared: 2026-08-10

Audience: Non-technical stakeholders / final approvers

Purpose of this document: To give you everything you need to say **yes, build it**, **yes, with changes**, or **not yet** — without needing to read the underlying technical documentation.

This document does not change anything in the Product Bible. It summarizes it.

---

## 1. What You're Being Asked To Approve

You are not approving code, a database, or a working app — none exists yet. You are approving:

1. **The product vision and scope** — what HCP is and isn't.
2. **The plan** — that the team should now move from writing documentation to writing the technical blueprints (data models, security rules, API contracts) that precede actual building.
3. **A handful of specific open business decisions** (Section 5) that only a product owner, not an engineer, can settle.

Approving this brief is the "flag off" — the green light to start Phase 2 (technical specification) and, after that, Phase 3 (writing the first lines of app code).

---

## 2. What HCP Is, In Plain Language

**Hash Community Platform (HCP)** is a mobile-first app for the worldwide Hash House Harriers (HHH) community — the "drinking club with a running problem."

**The problem it solves:** Hash information today is scattered across WhatsApp groups, Facebook pages, personal photo albums, and someone's memory. When that person stops being active, decades of history can disappear.

**The vision:** *"To become the world's most trusted digital home for the global Hash House Harriers community, preserving every run, every trail, every story, and every memory for generations of Hashers."*

**The mission:** Make it easier to organize Hash runs while making the community closer — using technology that respects Hash traditions instead of replacing them.

**What HCP is not:** It is not a generic fitness tracker, a generic event-management tool, or a generic social network. It borrows pieces of all three but is purpose-built around one thing — the complete life of a Hash run, from the hare planning a hidden trail to the permanent historical record of what happened.

---

## 3. Who Uses It

| Persona | What they do in HCP |
|---|---|
| **Hasher** | Joins runs, follows trails, uploads photos/video, comments, reacts. |
| **Hare** | Designs and publishes the trail, controls when it's revealed. |
| **Hash Scribe** | Writes and publishes the official trail report (the community's "newspaper of record" for that run), with optional AI drafting help. |
| **Grand Master** | Runs kennel (local club) operations, officers, and settings. |
| **Committee Member** | Supports operations in an assigned role. |
| **Visitor** | A hasher from one kennel joining a run hosted by another — very common in this community, and explicitly supported rather than treated as an edge case. |
| **Virgin** | A first-timer, given extra onboarding guidance. |
| **Photographer** | Captures and tags photos/video during runs. |
| **Platform Administrator** | Maintains the platform itself, moderation, and verification. |

One person can hold several of these roles, and the same person can carry different roles at different kennels — nothing in HCP assumes "one person, one hat."

---

## 4. What The App Actually Does (Feature Summary)

Grouped the way a user would experience them, not the way engineers would build them:

- **Find and join a kennel.** Kennels (local clubs) have their own public profile, branding, officers, and traditions — HCP doesn't flatten every kennel into the same look.
- **See and join upcoming runs.** RSVP, get reminders, see who else is going.
- **Hidden or timed trail reveal.** A hare can keep the route secret until a specific moment — release "at run start," on a timer, or manually — which is a core Hash tradition, not an app afterthought.
- **Live participation.** Check in, navigate the trail, capture photos/video as you go — designed to work even with patchy or no phone signal.
- **The Circle.** The post-run ceremony (awards, songs, down-downs) gets its own place in the app.
- **Trail Reports.** The Scribe turns the run into a written story, optionally with AI helping draft it — but a human always approves what gets published.
- **Run Capsule.** Every completed run is automatically preserved forever — photos, the report, attendance, weather, everything — building itself in the background rather than requiring someone to "do the archiving" afterward.
- **Hash Passport.** Every hasher gets a lifelong personal record — runs attended, countries hashed, milestones — that follows them even if they change kennels.
- **Kennel governance.** Officer roles, committees, elections, and policies are configurable per kennel — HCP does not force every club to run the same way.
- **Notifications** that try not to be annoying — grouped, prioritized, and respectful of quiet hours, rather than a firehose.
- **Search** across people, kennels, runs, and history.
- **AI assistance** — drafting help, summarizing, explaining Hash terminology — always advisory. AI never has the final word on anything official (see Section 6).

---

## 5. Decisions We Need From You, Not From Engineering

These are genuine business/product calls. Engineering can build either answer — they need to know which one before they start. Please mark a decision for each.

| # | Question | Why it matters | Your decision |
|---|---|---|---|
| 1 | Should **waitlisting** (join a full run and get bumped up if someone cancels) be in the first release, or added later? | Affects how "join a run" is built from day one. | ☐ In first release &nbsp; ☐ Later |
| 2 | Should **guest registrations** (someone without an account joining a run) be in the first release, or later? | Affects sign-up friction for casual/one-time participants. | ☐ In first release &nbsp; ☐ Later |
| 3 | What's the **default privacy** for a run — public to anyone, members-only, or invite-only — when a hare doesn't explicitly choose? | Wrong default could either leak trail info or make runs invisible to visitors. | ☐ Public &nbsp; ☐ Members-only &nbsp; ☐ Invite-only |
| 4 | What's the **minimum bar** for a new kennel to be "verified" and show up as legitimate in search? | Too strict slows growth; too loose invites fake/duplicate kennels. | ☐ Self-declared &nbsp; ☐ Community-vouched &nbsp; ☐ Officer-verified only |
| 5 | Which fields on a person's profile are **required** vs **optional**? | Every required field is friction at sign-up; every optional field risks incomplete data. | ☐ Minimal (name only) &nbsp; ☐ Standard &nbsp; ☐ Detailed |
| 6 | If a phone has **no signal** and a hare's release rule is "manual" or "location-based," should the trail still unlock automatically, or should it wait for connectivity? | Security/tradition trade-off — see box below. | ☐ Wait for connectivity (safer default) &nbsp; ☐ Allow offline unlock |
| 7 | Should **AI features** be available at launch, or added in a later release once the core app is proven? | Affects launch scope and review burden. | ☐ At launch &nbsp; ☐ Later release |
| 8 | Confirm: **no private one-to-one messaging** in the first release (announcements, run updates, and group/committee channels only). | This has been assumed throughout planning — flagging for explicit sign-off before it's locked in. | ☐ Confirmed, no DMs at launch &nbsp; ☐ We need DMs at launch |

> **On Question 6:** the planning team's working default is "wait for connectivity" — i.e., if a hare set the trail to reveal manually or by location, and a participant's phone has no signal, the trail stays hidden for that person until they reconnect, rather than guessing and revealing it anyway. This favors keeping the trail a genuine surprise (and avoiding a security shortcut) over convenience in dead zones. We recommend confirming this explicitly rather than letting it default silently.

---

## 6. Guardrails Already Agreed (For Your Awareness, Not Your Vote)

These are already locked in as ground rules unless you tell us otherwise:

- **AI assists, humans decide.** AI can draft a trail report or suggest text, but a human always approves anything official — attendance, publication, governance decisions. AI can never register someone's attendance or publish a report on its own.
- **History is never secretly rewritten.** Once a trail report or run record is published, corrections are visible additions, not silent edits — the original always remains findable.
- **No one-size-fits-all governance.** Every kennel can run its own leadership structure and rules; HCP doesn't impose a single committee model globally.
- **Local kennel identity comes first.** Platform defaults never override a kennel's own branding, traditions, or customs.
- **Built to work offline** for the parts that matter most in the field: run participation, maps, and photo/video capture — with everything syncing once a signal returns.

---

## 7. What Has Already Been Done

- A complete, detailed **Product Bible** — the full requirements and design specification — covering vision, personas, every major feature area (kennels, runs, trails, scribe/reports, run capsules, governance, notifications, search, AI), user experience journeys, and now (as of this pass) the technical bridge documents that translate all of that into implementation-ready state models, data models, and system-event definitions.
- No app code, database, or running product exists yet. This is by design — the team deliberately finished the blueprint before laying any foundation.

## 8. What Happens After You Approve

1. **Phase 2 — Technical Specification.** Engineering turns the blueprint into precise technical contracts: the database design, the API (how the mobile app and website talk to the server), security/permission rules, and how offline devices sync back up.
2. **Phase 3 — First Build.** The mobile app, website, and server are scaffolded and connected, with no visible features yet — just the plumbing.
3. **Phase 4 — Core Experience.** The features in Section 4 get built and become usable end-to-end.
4. **Later Phases.** Historical archive/search intelligence, and eventually broader integrations/partnerships — deliberately sequenced after the core product works.

Nothing user-facing ships between your approval and Phase 4. If you want a checkpoint before real building starts (e.g., a design review of what the app will look like), say so below — it can be added as a gate before Phase 3.

---

## 9. Approval

**Reviewer name:** _______________________________

**Role:** _______________________________

**Date:** _______________________________

**Decision:**

☐ **Approved** — proceed to Phase 2 as described.

☐ **Approved with conditions** — see comments below.

☐ **Not approved yet** — see comments below.

**Comments / conditions:**

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

---

*This brief was generated from the HCP Product Bible. It summarizes but does not replace or modify the underlying documentation in `product-Bible/`.*
