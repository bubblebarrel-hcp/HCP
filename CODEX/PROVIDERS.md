# External providers

Four external services back HCP: **Cloudflare R2** for photos and media,
**Resend** for email, **Expo** for push notifications, and **Anthropic (Claude)**
for AI-assisted trail report drafting. All are optional at
runtime — the API starts, and every
feature that depends on them degrades honestly rather than crashing — so a fresh
clone works before anyone has credentials.

| Concern | Provider | Absent behaviour |
| --- | --- | --- |
| Photos, video, documents | Cloudflare R2 (S3-compatible) | Falls back to `apps/api/uploads/` on local disk, served from `/uploads/*` |
| Email (notifications, guest trail alerts) | Resend | Notifications stay in-app; no EMAIL delivery rows are written |
| Push notifications (D12/D36) | Expo push | Nothing is queued for push; every notification says why on `evaluationReason` |
| AI-assisted trail report drafting (D7/D14, FR-STORY-007) | Anthropic (Claude) | `POST /reports/:id/ai-draft` answers `AI_NOT_CONFIGURED`; the Scribe writes the report unaided |

Push is still absent and has no fallback (D12 wants it at launch).

## Environment variables

Add to `apps/api/.env`. Everything here is optional; the defaults are the
development fallbacks.

```ini
# Where links in emails point
APP_BASE_URL=http://localhost:3010
# Where the browser PUTs bytes when R2 is unconfigured
API_BASE_URL=http://localhost:5010

# Cloudflare R2 — all four are required together
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=hcp-media
# Public domain in front of the bucket. Without it, stored media has no URL.
R2_PUBLIC_BASE_URL=https://media.example.com

# Resend
RESEND_API_KEY=
EMAIL_FROM=HCP <on-on@yourdomain.com>
EMAIL_REPLY_TO=

# Expo push (D36). No key to obtain: Expo accepts a send addressed to a valid
# push token. Set PUSH_ENABLED=false to switch the channel off platform-wide.
PUSH_ENABLED=true
# Only needed once the Expo project turns on "enhanced security".
EXPO_ACCESS_TOKEN=

# Optional: maximum accepted upload, bytes (default 25MB)
MEDIA_MAX_BYTES=26214400
# Video is re-encoded to H.264 MP4 after upload (D67). On by default, using the ffmpeg that
# ffmpeg-static installs; FFMPEG_PATH points at a system ffmpeg instead, and
# TRANSCODE_ENABLED=false turns it off (clips are then served as uploaded).
# TRANSCODE_TIMEOUT_MS is how long one clip may take (default 300000).
TRANSCODE_ENABLED=true
FFMPEG_PATH=
TRANSCODE_TIMEOUT_MS=300000

# Anthropic (D14). Without it, AI drafting answers AI_NOT_CONFIGURED.
ANTHROPIC_API_KEY=
# Only for a user-scoped key (sk-ant-usr-...): the workspace it should bill to.
# A workspace-scoped key (made in Console > API keys) needs neither this nor a header.
ANTHROPIC_WORKSPACE_ID=
```

## Cloudflare R2 setup

1. Cloudflare dashboard → R2 → **Create bucket** (`hcp-media`). The account ID
   is in the R2 sidebar.
2. **Manage R2 API Tokens** → create a token with *Object Read & Write* scoped
   to that bucket. Copy the access key id and secret; the secret is shown once.
3. Give the bucket a public domain (Settings → *Public access* → connect a
   custom domain, or enable the r2.dev subdomain for development) and put it in
   `R2_PUBLIC_BASE_URL`. Without it the API stores media but cannot hand out a
   URL to display it.
4. **CORS** — the browser uploads straight to R2 with a presigned PUT, so the
   bucket must allow it. Bucket → Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3010", "http://localhost:3011", "https://your-web-domain"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Missing CORS is the usual cause of an upload that fails with a network error and
no status code. Verified against the live bucket on 2026-09-18: the presigned PUT
is refused with *No 'Access-Control-Allow-Origin' header*, so this step is still
owed on `hcp-uploads` and every browser upload — run photos as well as kennel
branding (D37) — fails until it is done. The API is not involved in that request
and logs nothing; the evidence is in the browser console.

The browser also has to be *allowed* to reach the bucket at all: the presigned
PUT goes to a different origin from the API, so `connect-src` in
`apps/web/next.config.ts` names it. The default covers R2's S3 endpoint for any
bucket; set `MEDIA_UPLOAD_ORIGIN` to pin it to one host or to name a different
storage provider.

## Resend setup

1. resend.com → **API Keys** → create a key with *Sending access*.
2. **Domains** → add and verify your sending domain (DKIM + SPF records). Until
   a domain is verified, `EMAIL_FROM` must stay `onboarding@resend.dev`, which
   only delivers to the address that owns the Resend account — fine for
   development, not for real hashers.
3. Set `EMAIL_FROM` to a verified address once the domain is green.

## Claude (Anthropic) setup

1. console.anthropic.com → **API Keys** → create a key.
2. Set `ANTHROPIC_API_KEY` in `apps/api/.env`.
3. From Scribe Studio, a report's Scribe (or an officer with `report.publish`)
   can ask for a draft while the report is still editable. Claude sees only
   the run's own recorded facts — the story timeline, Circle songs/awards,
   hares and attendance — and is instructed never to invent a detail the data
   doesn't support. The result lands as a `PENDING` `AiSuggestion`, never as
   `report.body` directly: the Scribe accepts (verbatim or edited) or rejects
   it, and only that human decision writes the report (BR-SCRIBE-005, "AI
   drafts cannot reach Published without passing through human Scribe
   Editing"). `report.aiAssisted` is true only while a suggestion is still
   pending a decision, not as a permanent "AI helped" marker — Chapter 22 A.5's
   own wording.

No sending domain, no CORS policy, nothing bucket-shaped to configure — a
single key is the whole setup.

## How the pieces are used

**Uploads never pass through the API.** The client calls
`POST /api/v1/media/uploads` with the file's kind, mime type, size and target;
the API creates the `MediaAsset` (Queued) plus its `MediaLink`, and returns a
presigned `PUT` target. The client PUTs the bytes to that URL, then calls
`POST /api/v1/media/:id/confirm`. Ch.22 B.2 states follow: Queued → Uploading →
Processing → Available. Whether Processing clears at once is the kennel's
`mediaModerationMode`; anything but `IMMEDIATE` waits for someone holding
`media.moderate`.

**Email is a delivery channel, not a separate system.** The outbox worker hands
each `DomainEvent` to the notification fan-out, which writes the in-app
notification and, when Resend is configured and the member has email enabled for
that category, a second `NotificationDelivery` row on the EMAIL channel that is
actually sent. Guests hold no account and no in-app inbox, so for trail release
and run cancellation they are notified by email alone (D12).


## Expo push setup

Unlike R2 and Resend there is no account to create and no key to paste: Expo's
push service accepts a send addressed to any valid Expo push token, and the
mobile app is what obtains one. What it does need is an **EAS project id**, so
Expo knows which project a token belongs to.

1. `cd apps/mobile && npx eas init`. This writes `extra.eas.projectId` into
   `app.json` and requires an Expo account.
2. Build or run the app on a **real device**. A simulator has no push service
   behind it, so there is no token to get, and the app says so rather than
   failing quietly.
3. Sign in. The app asks for notification permission, gets a token and posts it
   to `POST /me/devices`. Settings → Notifications on the web shows the
   registered device once it lands.

Until step 1 is done the app reports push as unconfigured and `channels.push`
stays false for everyone, which is the honest answer: no device can register.

### What it does not cover

**Browser push is not built.** Web Push needs VAPID keys, a service worker and a
different token flow, so `DevicePlatform.WEB` exists in the schema and is
unused. The web settings page points a hasher at the phone app instead of
offering a switch that cannot work.

### Enhanced security

If you turn on enhanced security for the Expo project, unsigned sends start
failing. Create an access token in the Expo dashboard and set
`EXPO_ACCESS_TOKEN`; the API sends it as a bearer token when it is present.

### When a device goes quiet

Expo answers a send to a dead token with `DeviceNotRegistered`. The API sets
`revokedAt` on that `PushDevice` rather than deleting it — the row is the
record of what was tried — and the handset simply registers again next time
someone signs in on it.
