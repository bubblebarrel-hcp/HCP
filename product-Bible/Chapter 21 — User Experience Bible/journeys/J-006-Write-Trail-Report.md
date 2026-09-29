# Journey Specification J-006

## Write Trail Report

---

Document ID

HCP-JS-006

Status

Draft

Version

1.0

---

# Purpose

Enable the designated Scribe to efficiently create, review, publish, and maintain the official Trail Report for a Hash run while preserving the authentic voice, humour, and traditions of the community.

---

# Scope

This journey covers:

- Draft creation
- AI-assisted draft generation
- Manual editing
- Media embedding
- Collaborative review
- Publishing
- Post-publication corrections

It does not cover:

- Media uploads (J-005)
- Hare planning (J-008)
- Community moderation (J-009)

---

# Primary Persona

Scribe

---

# Supporting Personas

Community Member

Committee Member

Community Administrator

AI Assistant

---

# Business Goals

- Preserve the history of every run.
- Reduce the effort required to produce reports.
- Improve publication consistency.
- Increase post-event engagement.
- Build a searchable historical archive.

---

# User Goal

"I want to publish an engaging Trail Report that accurately captures the spirit and events of today's run."

---

# Preconditions

- The run has concluded.
- The Scribe has permission to create or edit the report.
- Event details and participant data are available.
- Media uploads may already exist but are optional.

---

# Triggers

- Run marked as completed.
- Reminder to the Scribe.
- Manual selection from the event page.
- Committee request.

---

# Entry Points

- Event page
- Scribe dashboard
- Notification
- Community administration
- Trail Report section

---

# Journey Overview

```
Open Report
      │
      ▼
Generate Draft (Optional)
      │
      ▼
Edit Content
      │
      ▼
Embed Media
      │
      ▼
Preview
      │
      ▼
Publish
      │
      ▼
Community Reads
```

---

# Detailed User Flow

1. The Scribe opens the Trail Report workspace.
2. The system loads:
   - Event details
   - Attendance
   - Hare information
   - Uploaded media
   - Community notes (where enabled)
3. The Scribe chooses to:
   - Start from a blank report, or
   - Generate an AI-assisted draft.
4. The AI drafts a report using available event context.
5. The Scribe reviews, edits, and personalizes the content.
6. Photos and videos are embedded where appropriate.
7. The report is previewed in its final format.
8. The Scribe publishes the report.
9. Members receive notifications that the report is available.

---

# Decision Logic

```
AI Draft?

├── No
│     └── Blank Editor
│
└── Yes
      │
      ▼
Generate Draft
      │
      ▼
Review
      │
      ▼
Accept?
      │
 ├────┴────┐
 │         │
No        Yes
 │         │
 ▼         ▼
Edit    Preview
           │
           ▼
        Publish
```

---

# Business Rules

- Every run may have one official Trail Report.
- Drafts are autosaved.
- Publication requires Scribe or authorized editor permission.
- Published reports remain editable with version history.
- Significant edits create a new revision.
- AI-generated content must always be reviewed before publication.

---

# UI States

- No Report
- Blank Draft
- AI Draft Generated
- Editing
- Autosaving
- Preview
- Publishing
- Published
- Revision Available
- Error

---

# Backend Operations

- Load event metadata.
- Retrieve media.
- Generate AI draft (optional).
- Save draft revisions.
- Create report versions.
- Publish report.
- Notify subscribers.
- Update search index.

---

# Notifications

Immediate

- Draft ready.
- Report published.
- Revision published.

Optional

- Mention notifications.
- Featured report.
- Weekly digest inclusion.

---

# AI Assistance

AI may:

- Generate an initial draft.
- Summarize event highlights.
- Suggest headings.
- Improve grammar while preserving tone.
- Recommend photo placement.
- Generate accessibility descriptions for embedded images.
- Identify missing sections (e.g., no mention of hares or visitors).

AI shall not:

- Publish automatically.
- Rewrite community traditions.
- Fabricate events.
- Invent participant actions.
- Remove the Scribe's authorship.

---

# Offline Behaviour

The editor should support:

- Draft writing.
- Autosave to local storage.
- Offline editing.

Publishing requires connectivity.

Unsynchronized changes should merge safely when the connection returns.

---

# Security & Privacy

- Respect community visibility settings.
- Preserve revision history.
- Restrict editing to authorized roles.
- Log publication and revisions for auditing.

---

# Accessibility

- Keyboard-first editing (web).
- Screen reader compatible editor.
- Dynamic text support.
- High contrast.
- Accessible media descriptions.
- Focus restoration after autosave and publishing.

---

# Performance Targets

Editor load:

≤ 2 seconds

Autosave:

≤ 500 ms after inactivity

Preview generation:

≤ 2 seconds

Publish:

≤ 2 seconds

---

# Analytics Events

REPORT_STARTED

AI_DRAFT_REQUESTED

AI_DRAFT_ACCEPTED

REPORT_AUTOSAVED

REPORT_PREVIEWED

REPORT_PUBLISHED

REPORT_VIEWED

REPORT_REVISED

---

# Error Recovery

### AI generation fails

- Explain the issue.
- Offer retry.
- Allow manual writing without interruption.

---

### Connectivity lost

- Continue offline editing.
- Preserve all local changes.
- Resume synchronization when online.

---

### Publish fails

- Keep the draft intact.
- Explain the reason.
- Retry without data loss.

---

### Revision conflict

- Present both versions.
- Allow the editor to merge changes.

---

# Experience Contract

Maximum taps to start writing:

≤ 3

Autosave:

Always enabled

Primary CTA:

Publish

Maximum perceived wait:

≤ 2 seconds

Accessibility:

WCAG 2.2 AA target

---

# Acceptance Criteria

- Reports can be created from scratch or AI-assisted.
- Drafts are never lost.
- Revision history is maintained.
- Community members receive publication notifications.
- Reports are searchable.
- The Scribe retains final editorial control.

---

# Future Enhancements

- Collaborative editing.
- Voice-to-text drafting.
- AI-assisted translation.
- Timeline view with synchronized media.
- Interactive maps embedded in reports.
- "On This Day" resurfacing of historical reports.

---

# Related Specifications

J-004 Participate in a Run

J-005 Upload Photos & Videos

J-007 Volunteer Workflow

TF-006 Write Trail Report