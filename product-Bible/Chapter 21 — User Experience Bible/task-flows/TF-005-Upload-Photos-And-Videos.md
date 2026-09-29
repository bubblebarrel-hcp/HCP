# Task Flow TF-005

## Upload Photos and Videos

---

Task ID: TF-005

Journey: J-005 Upload Photos and Videos

Status: Draft

Version: 1.0

---

# Purpose

Define the media contribution flow for selecting, describing, uploading, processing, and publishing event photos and videos.

---

# Primary Actor

Community Member

---

# Trigger

User taps Add Photos and Videos from an event gallery, post-run prompt, trail report, or camera shortcut.

---

# Preconditions

- User is authenticated.
- User can contribute media to the run.
- Run exists.
- Community media uploads are enabled.

---

# UI Flow

Event Gallery

↓

Add Photos and Videos

↓

Choose Source

↓

Select Media

↓

Preview Selection

↓

Add Caption, Tags, or Location

↓

Upload

↓

Processing

↓

Published or Pending Moderation

---

# Validation Rules

Media selected?

↓

File type supported?

↓

File size within limits?

↓

User has upload permission?

↓

Community quota available?

↓

Start upload

---

# API

POST /api/v1/media/upload-sessions

PUT /api/v1/media/{uploadId}/chunks

POST /api/v1/runs/{runId}/media

PATCH /api/v1/media/{mediaId}/metadata

---

# Success State

- Upload progress reaches complete.
- Media appears in gallery or pending moderation.
- Caption and metadata are saved.
- Contributor receives confirmation.
- Scribes can reference published media.

---

# Failure States

Unsupported file

↓

Explain supported formats

Upload interrupted

↓

Pause and resume automatically where possible

Processing failed

↓

Preserve upload and offer retry

Quota exceeded

↓

Explain limit and suggest alternatives

Offline

↓

Queue upload and sync later

---

# Accessibility

- Media controls have accessible names.
- Upload progress is announced.
- Captions and alt text can be edited.
- Keyboard upload works on web.
- Color is not the only indicator of upload status.

---

# Analytics

GALLERY_OPENED

MEDIA_UPLOAD_STARTED

MEDIA_UPLOAD_COMPLETED

MEDIA_UPLOAD_FAILED

CAPTION_ADDED

MEDIA_PENDING_MODERATION

---

# Performance

Upload session creation: <= 1 second

Preview generation: <= 2 seconds

Progress updates: near real-time

Thumbnail availability: <= 3 seconds after processing

---

# Acceptance Criteria

- Multiple files can be uploaded.
- Interrupted uploads recover without reselecting media.
- Offline uploads queue safely.
- Media respects event and community visibility rules.
- Published media appears in the correct event gallery.

