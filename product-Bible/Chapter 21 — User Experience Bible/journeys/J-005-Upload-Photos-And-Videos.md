# Journey Specification J-005

## Upload Photos & Videos

---

Document ID

HCP-JS-005

Status

Draft

Version

1.0

---

# Purpose

Enable participants to capture, upload, organize, and share photos and videos from a Hash event while preserving the authenticity and historical value of the community's memories.

---

# Scope

This journey covers:

- Capturing media
- Selecting existing media
- Uploading
- Organizing
- Tagging
- Publishing
- Viewing uploaded content

It does not cover:

- Writing trail reports (J-006)
- Community moderation (J-009)
- Long-term archive export

---

# Primary Persona

Community Member

---

# Supporting Personas

Volunteer

Scribe

Committee Member

Community Administrator

---

# Business Goals

- Preserve community history.
- Increase member engagement.
- Build searchable event archives.
- Encourage post-event participation.
- Support trail report creation.

---

# User Goal

"I want to share my memories from today's run with everyone who participated."

---

# Preconditions

- User is authenticated.
- User has permission to contribute media.
- The run exists.
- The event accepts community uploads.

---

# Triggers

- Run completed.
- "Share your memories" prompt.
- Manual upload from gallery.
- Camera shortcut.
- Event gallery.

---

# Entry Points

- Event page
- Event gallery
- Home feed
- Camera shortcut
- Trail report
- User profile
- Notifications

---

# Journey Overview

```
Open Gallery
      │
      ▼
Choose Photos or Videos
      │
      ▼
Review Selection
      │
      ▼
Add Details
      │
      ▼
Upload
      │
      ▼
Processing
      │
      ▼
Published
      │
      ▼
Visible in Gallery
```

---

# Detailed User Flow

1. User opens the event gallery.
2. User selects **Add Photos & Videos**.
3. The app offers:
   - Camera
   - Photo Library
   - Video Library
4. User selects one or more items.
5. Preview screen displays:
   - Selected media
   - File count
   - Estimated upload size
6. User may optionally:
   - Add a caption
   - Tag people (with consent)
   - Tag a location (e.g., Beer Stop 1)
   - Mark as favorite
7. User taps **Upload**.
8. Upload progress is displayed.
9. After processing:
   - Media appears in the event gallery.
   - Contributors receive confirmation.
   - Scribes can reference the media while preparing the trail report.

---

# Decision Logic

```
Media Selected?

├── No
│     └── Return to Gallery
│
└── Yes
      │
      ▼
Upload Successful?

├── No
│     └── Retry / Save Draft
│
└── Yes
      │
      ▼
Publish to Gallery
```

---

# Business Rules

- Multiple uploads are supported.
- Original files remain on the user's device unless deletion is requested separately.
- Communities may define moderation policies before publication.
- Captions are optional.
- Contributors may edit captions after upload.
- Media ownership remains associated with the uploader.

---

# UI States

- Empty Gallery
- Selecting Media
- Preview
- Uploading
- Processing
- Published
- Pending Moderation
- Upload Failed
- Offline Queue

---

# Backend Operations

- Generate upload session.
- Validate permissions.
- Virus/security scanning.
- Image optimization.
- Video transcoding.
- Thumbnail generation.
- Metadata extraction.
- Store media.
- Index for search.
- Publish gallery update.

---

# Notifications

Immediate

- Upload completed.
- Upload failed.

Community

- New gallery items available (subject to notification preferences).

Optional

- Media featured in trail report.
- Photo tagged.
- Comment received.

---

# AI Assistance

AI may:

- Suggest captions.
- Detect blurry or duplicate uploads.
- Recommend the best cover photo.
- Group similar photos.
- Identify landmarks or checkpoints where appropriate.
- Generate alt text for accessibility.

AI shall not:

- Publish captions without approval.
- Identify people automatically without explicit consent and enabled facial recognition features (if ever supported).
- Modify original media without user confirmation.

---

# Offline Behaviour

Users may:

- Queue uploads.
- Add captions.
- Organize media.

When connectivity returns:

- Resume uploads automatically.
- Preserve upload order.
- Notify users of completed uploads.

---

# Security & Privacy

- Respect community visibility settings.
- Strip sensitive metadata where configured (e.g., precise GPS coordinates).
- Validate file types and sizes.
- Encrypt uploads in transit.
- Scan uploaded files for malicious content.

---

# Accessibility

- VoiceOver/TalkBack support.
- AI-generated alt text (editable).
- Keyboard support (web).
- Progress announcements.
- Large upload controls.
- High-contrast progress indicators.

---

# Performance Targets

Gallery load:

≤ 2 seconds

Upload initialization:

≤ 1 second

Thumbnail generation:

≤ 3 seconds

Progress updates:

Near real-time

---

# Analytics Events

MEDIA_UPLOAD_STARTED

MEDIA_UPLOAD_COMPLETED

MEDIA_UPLOAD_FAILED

CAPTION_ADDED

PHOTO_VIEWED

VIDEO_PLAYED

GALLERY_OPENED

---

# Error Recovery

### Upload Interrupted

- Pause upload.
- Resume automatically when possible.
- Allow manual retry.

---

### Storage Limit Reached

- Explain the limitation.
- Suggest reducing file size or contacting administrators if community quotas apply.

---

### Unsupported File

- Explain why the file cannot be uploaded.
- Display supported formats.

---

### Processing Failure

- Preserve the upload request.
- Notify the user.
- Offer retry without requiring re-selection of media.

---

# Experience Contract

Maximum taps to upload:

≤ 5

Maximum perceived wait before progress begins:

≤ 2 seconds

Primary CTA:

One

Recovery:

Automatic where feasible

Accessibility:

WCAG 2.2 AA target

---

# Acceptance Criteria

- Multiple media files upload successfully.
- Offline uploads synchronize correctly.
- Captions remain editable.
- Galleries update automatically.
- Media permissions are respected.
- Contributors receive clear feedback.

---

# Future Enhancements

- Live collaborative albums.
- 360° photos.
- Drone footage support.
- Automatic event highlight reels.
- Shared album invitations.
- AI-generated event slideshow.

---

# Related Specifications

J-004 Participate in a Run

J-006 Write Trail Report

J-023 Report Content

TF-005 Upload Photos & Videos