// Response shapes from the Shiggy Trails API. The backend is the source of truth; keep
// these in step with apps/api/src/serializers and services.

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SessionUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  trustLevel: string;
  hashHandle: string | null;
  // What they are @mentioned as (D59); null only after the account is deleted.
  username: string | null;
  // hashHandle, or "Just <firstName>" (D11)
  displayName: string;
  avatarUrl: string | null;
  // CSS object-position pair for the round crop; null is centred.
  avatarPosition: string | null;
  // The wide picture across the top of their public page (D56).
  bannerUrl: string | null;
  // CSS background-position pair for the banner's crop; null is centred.
  bannerPosition: string | null;
  // Who sees what they make: posts, photos and reels (D57).
  profileVisibility: Audience;
  emailVerified: boolean;
  homeKennelId: string | null;
  createdAt: string;
}

export type VerificationLevel = 'PENDING' | 'COMMUNITY_VERIFIED' | 'OFFICER_VERIFIED' | 'PLATFORM_VERIFIED';

export interface PublicKennel {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  orgType: string;
  country: string;
  stateProvince: string;
  city: string;
  timeZone: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: string | null;
  primaryColor: string | null;
  motto: string | null;
  meetingDay: string | null;
  foundedOn: string | null;
  verificationLevel: VerificationLevel;
  activeMemberCount: number;
  createdAt: string;
}

export interface KennelDetail extends PublicKennel {
  landingMessage: string | null;
  // Followers are not members (D50): following a kennel grants nothing.
  followerCount: number;
  officers: { title: string; name: string; avatarUrl: string | null }[];
}

// ─── Membership (apps/api/src/services/membership.service.ts) ───

export type MembershipStatus =
  | 'APPLICANT'
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'RESIGNED'
  | 'REMOVED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'ARCHIVED';

export type MembershipType = 'FULL' | 'ASSOCIATE' | 'VISITING' | 'HONORARY' | 'LIFE' | 'GUEST' | 'VIRGIN' | 'COMMITTEE';

export interface KennelSummary {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  city: string;
  country: string;
  primaryColor: string | null;
}

export interface MyMembership {
  id: string;
  status: MembershipStatus;
  type: MembershipType;
  isHomeKennel: boolean;
  startDate: string | null;
  endDate: string | null;
  approvedAt: string | null;
  suspensionReason: string | null;
  suspendedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  kennel: KennelSummary;
  canManage?: boolean;
}

// The viewer's relationship with one kennel.
export interface ViewerMembership {
  kennel: { id: string; name: string; shortName: string; slug: string };
  signedIn: boolean;
  membership: MyMembership | null;
  canRequest: boolean;
  reason: string | null;
  permissions: string[];
  pendingCount: number;
}

export interface KennelMember {
  id: string;
  status: MembershipStatus;
  type: MembershipType;
  startDate: string | null;
  endDate: string | null;
  approvedAt: string | null;
  suspensionReason: string | null;
  suspendedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  requestNote: string | null;
  member: { id: string; hashHandle: string | null; displayName: string; avatarUrl: string | null };
  // What they do in this kennel. An office is a seat with a title; a role is a
  // standing job. Both are real grants, never a claim on a token.
  offices: { appointmentId: string; positionId: string; title: string }[];
  // title is what this kennel calls the job; null means the default wording.
  roles: { assignmentId: string; role: ScopedRole; title: string | null }[];
}

// Roles a kennel may hand out directly. HARE and CO_HARE are absent on purpose:
// they belong to a run. Mirrors GRANTABLE_ROLES in
// apps/api/src/validators/officer.validator.ts.
export const GRANTABLE_ROLES = [
  'KENNEL_ADMIN',
  'SCRIBE',
  'ASSISTANT_SCRIBE',
  'REVIEWER',
  'PHOTOGRAPHER',
  'VOLUNTEER',
  'MODERATOR',
  'EVENT_ORGANIZER',
] as const;

export type GrantableRole = (typeof GRANTABLE_ROLES)[number];
export type ScopedRole = GrantableRole | 'HARE' | 'CO_HARE';

export interface MembershipTimelineItem {
  id: string;
  type: string;
  fromStatus: MembershipStatus | null;
  toStatus: MembershipStatus | null;
  note: string | null;
  occurredAt: string;
  actor: { displayName: string } | null;
}

// ─── Runs (apps/api/src/services/run.service.ts) ───

export type RunStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PLANNING'
  | 'TRAIL_HIDDEN'
  | 'TRAIL_RELEASED'
  | 'CHECK_IN_OPEN'
  | 'LIVE'
  | 'CIRCLE'
  | 'REPORTING'
  | 'ARCHIVED'
  | 'CANCELLED';

export type RunType =
  | 'REGULAR'
  | 'FULL_MOON'
  | 'RED_DRESS'
  | 'CAMPOUT'
  | 'CHARITY'
  | 'INTERHASH'
  | 'NASH_HASH'
  | 'THEMED'
  | 'SPECIAL';

export type RunVisibility = 'PUBLIC' | 'MEMBERS_ONLY' | 'INVITE_ONLY';
export type RsvpStatus = 'GOING' | 'MAYBE' | 'NOT_GOING' | 'CANCELLED';

export interface RunHare {
  userId: string;
  isLead: boolean;
  displayName: string;
}

export interface RunKennel {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  primaryColor: string | null;
}

export interface RunSummary {
  id: string;
  runNumber: number;
  title: string;
  runType: RunType;
  status: RunStatus;
  visibility: RunVisibility;
  startsAt: string;
  timeZone: string;
  meetingPointName: string | null;
  city: string;
  country: string;
  capacity: number | null;
  allowGuests: boolean;
  isPaused: boolean;
  cancelledAt: string | null;
  kennel: RunKennel;
  hares: RunHare[];
  goingCount: number;
}

export interface KennelRunsPage extends Page<RunSummary> {
  kennel: RunKennel;
  canPlan: boolean;
}

export interface RunParticipant {
  id: string;
  kind: 'hasher' | 'guest';
  // The hasher's own id, so a list built from another source (the Circle's) can be matched to this one.
  userId: string | null;
  displayName: string;
  rsvpStatus: RsvpStatus;
  isVisitor: boolean;
  isVirginRun: boolean;
  homeKennel: string | null;
  checkedInAt: string | null;
  checkInMethod: string | null;
  // D23: null unless the viewer operates this run (a hare or run.manage) — a
  // guest holds no account, so this is the only way to reach one on trail.
  contact: { email: string; phone: string | null } | null;
}

export interface RunAward {
  id: string;
  title: string;
  reason: string | null;
  isDownDown: boolean;
  recipient: string | null;
}

export interface RunViewer {
  signedIn: boolean;
  isMember: boolean;
  isHare: boolean;
  canSeeNames: boolean;
  // FR-CIRCLE-014: the Circle has its own audience, narrower than or equal to the run's.
  canSeeCircle: boolean;
  participation: { id: string; rsvpStatus: RsvpStatus; checkedInAt: string | null; isVisitor: boolean } | null;
  canRespond: boolean;
  rsvpBlockedReason: string | null;
  goingBlockedReason: string | null;
  canCheckIn: boolean;
  checkInBlockedReason: string | null;
  canRegisterAsGuest: boolean;
  canManage: boolean;
  canOperate: boolean;
  canChangeVisibility: boolean;
  canEdit: boolean;
  nextStep: { action: string; label: string } | null;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  canSkipCircle: boolean;
  canRecordCircle: boolean;
  canCorrectAttendance: boolean;
  canAddGuest: boolean;
}

export interface RunDetail extends Omit<RunSummary, 'goingCount' | 'kennel'> {
  // FR-CIRCLE-006: whether this kennel allows recording a down-down at all.
  kennel: RunKennel & { timeZone: string; downDownsEnabled: boolean };
  startsAtLocal: string;
  description: string | null;
  theme: string | null;
  meetingAddress: string | null;
  meetingLatitude: number | null;
  meetingLongitude: number | null;
  hashCash: string | null;
  // The kennel flyer for this run (D43).
  posterUrl: string | null;
  allowVisitors: boolean;
  scheduledAt: string | null;
  trailReleasedAt: string | null;
  checkInOpenedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  archivedAt: string | null;
  cancelReason: string | null;
  circleSkipReason: string | null;
  createdAt: string;
  counts: { going: number; maybe: number; checkedIn: number; visitors: number; guests: number };
  pauses: { pausedAt: string; resumedAt: string | null; reason: string | null }[];
  circle: {
    startedAt: string | null;
    endedAt: string | null;
    songs: string[];
    announcements: string | null;
    notes: string | null;
    awards: RunAward[];
    // FR-CIRCLE-002: who was at the Circle, kept apart from who ran the trail.
    attendees: { id: string; userId: string | null; name: string; isGuest: boolean }[];
  } | null;
  participants: RunParticipant[] | null;
  timeline: { id: string; type: string; occurredAt: string; actor: string | null; reason: string | null }[] | null;
  viewer: RunViewer;
}

export interface RunPlanningContext {
  kennel: {
    id: string;
    name: string;
    shortName: string;
    slug: string;
    timeZone: string;
    defaultRunVisibility: RunVisibility;
  };
  nextRunNumber: number;
  canChangeVisibility: boolean;
  members: { userId: string; hashHandle: string | null; displayName: string }[];
}

// ─── Trails (apps/api/src/services/trail.service.ts) ───

export type TrailStatus =
  | 'IDEA'
  | 'DRAFT'
  | 'PLANNING'
  | 'REVIEW'
  | 'LOCKED'
  | 'HIDDEN'
  | 'RELEASED'
  | 'LIVE'
  | 'COMPLETED'
  | 'ARCHIVED'
  | 'HISTORIC';

export type TrailStyle = 'LIVE_HARE' | 'DEAD_HARE' | 'A_TO_A' | 'A_TO_B' | 'OTHER';
export type ReleaseMode = 'AT_RUN_START' | 'SCHEDULED' | 'MANUAL' | 'CHECK_IN' | 'GEOFENCE';
export type WaypointKind = 'START' | 'FINISH' | 'CHECKPOINT' | 'REGROUP' | 'HAZARD' | 'SCENIC' | 'ON_IN' | 'OTHER';
export type ChalkSymbol =
  | 'ON_ON'
  | 'CHECK'
  | 'FALSE_TRAIL'
  | 'BACK_CHECK'
  | 'REGROUP'
  | 'BEER_NEAR'
  | 'TRUE_TRAIL'
  | 'ON_IN'
  | 'HAZARD'
  | 'CUSTOM';

export interface RouteGeoJson {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface TrailWaypoint {
  id: string;
  kind: WaypointKind;
  label: string | null;
  latitude: number;
  longitude: number;
  sequence: number;
  notes: string | null;
}

export interface TrailBeerCheck {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  sequence: number;
  notes: string | null;
}

export interface TrailChalk {
  id: string;
  symbol: ChalkSymbol;
  customLabel: string | null;
  latitude: number;
  longitude: number;
  bearingDeg: number | null;
  sequence: number | null;
  placedAt: string;
  placedBy: string;
}

// Only ever present for planners, or for everyone once the trail is released.
export interface TrailSecret {
  notes: string | null;
  routeGeoJson: RouteGeoJson | null;
  startLatitude: number | null;
  startLongitude: number | null;
  finishLatitude: number | null;
  finishLongitude: number | null;
  waypoints: TrailWaypoint[];
  beerChecks: TrailBeerCheck[];
  chalk: TrailChalk[];
}

export interface Trail {
  id: string;
  runId: string;
  name: string;
  style: TrailStyle;
  status: TrailStatus;
  estimatedDistanceM: number | null;
  estimatedDurationMin: number | null;
  terrain: string | null;
  releaseMode: ReleaseMode;
  releaseAt: string | null;
  releasedAt: string | null;
  lockedAt: string | null;
  safetyReviewedAt: string | null;
  createdAt: string;
  hares: RunHare[];
  isReleased: boolean;
  viewer: {
    canPlan: boolean;
    canRelease: boolean;
    canArchive: boolean;
    canSeeSecret: boolean;
    isLead: boolean;
  };
  secret: TrailSecret | null;
}

export interface TrailRevision {
  id: string;
  changes: Record<string, unknown>;
  reason: string | null;
  createdAt: string;
  editor: string;
}

// ─── Notifications (apps/api/src/services/notification.service.ts) ───

export type NotificationCategory =
  | 'MEMBERSHIP'
  | 'RUN'
  | 'TRAIL_RELEASE'
  | 'REMINDER'
  | 'REPORT'
  | 'ANNOUNCEMENT'
  | 'GOVERNANCE'
  | 'EVENT'
  | 'MEDIA'
  | 'SAFETY'
  // Follows, likes, comments and reshares (D50).
  | 'SOCIAL'
  | 'SYSTEM';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: string;
  title: string;
  body: string;
  contextType: string | null;
  contextId: string | null;
  evaluationReason: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage extends Page<NotificationItem> {
  unread: number;
}

// D12 closed the set: no SMS.
export type DeliveryChannel = 'IN_APP' | 'PUSH' | 'EMAIL';

export type DigestFrequency = 'IMMEDIATE' | 'HOURLY' | 'MORNING' | 'EVENING' | 'WEEKLY';

export interface NotificationPreferences {
  categories: {
    category: NotificationCategory;
    inApp: boolean;
    push: boolean;
    email: boolean;
    locked: boolean;
    // FR-NOT-007: how email and push for this category are gathered. A category
    // about something happening at a time is never held, and says so.
    digest: DigestFrequency;
    digestable: boolean;
  }[];
  // Whether a channel can carry anything for this hasher right now. Push needs
  // both the platform switched on and a device of their own (D12).
  channels: { inApp: boolean; push: boolean; email: boolean };
  push: {
    enabledPlatformWide: boolean;
    devices: { id: string; platform: 'IOS' | 'ANDROID' | 'WEB'; lastSeenAt: string }[];
    quietHours: { start: string; end: string } | null;
  };
  // Null until the hasher sets one; quiet hours evaluate against UTC until then (D36).
  timeZone: string | null;
}

// ─── Hash Passport (apps/api/src/services/passport.service.ts) ───

export interface PassportStamp {
  id: string;
  code: string;
  label: string;
  runId: string | null;
  awardedAt: string;
}

export interface PassportMilestone {
  id: string;
  threshold: number;
  runId: string | null;
  reachedAt: string;
}

export interface PassportPlace {
  id: string;
  country: string;
  stateProvince: string;
  city: string;
  kennelId: string | null;
  firstVisitedAt: string;
}

export interface PassportMemory {
  id: string;
  kind: string;
  title: string;
  note: string | null;
  refType: string | null;
  refId: string | null;
  pinnedAt: string;
}

export interface HashPassport {
  id: string;
  shareToken: string | null;
  runsAttended: number;
  trailsLaid: number;
  beerChecks: number;
  reportsWritten: number;
  photosUploaded: number;
  videosUploaded: number;
  countriesHashed: number;
  kennelsJoined: number;
  distanceMeters: number;
  statsUpdatedAt: string | null;
  createdAt: string;
  hasher: { id: string; displayName: string; hashingSince: string };
  stamps: PassportStamp[];
  milestones: PassportMilestone[];
  places: PassportPlace[];
  memories: PassportMemory[];
}

export interface IdentityTimelineEntry {
  id: string;
  type: string;
  title: string;
  refType: string | null;
  refId: string | null;
  occurredAt: string;
}

export type MediaTargetType = 'RUN' | 'TRAIL' | 'CIRCLE' | 'GALLERY' | 'KENNEL' | 'REEL' | 'POST' | 'PROFILE';
export type MediaKind = 'PHOTO' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
// Ch.22 B.2 capture lifecycle.
export type UploadState = 'QUEUED' | 'UPLOADING' | 'PROCESSING' | 'AVAILABLE' | 'FAILED';
export type ModerationState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REPORTED';

export interface MediaTarget {
  type: MediaTargetType;
  id: string;
}

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  caption: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  capturedAt: string | null;
  uploadState: UploadState;
  moderationState: ModerationState;
  createdAt: string;
  // Attribution is fixed at capture and never changes (BR-CAPSULE-007).
  uploadedBy: string | null;
  uploaderId: string | null;
  links: MediaTarget[] | { targetType: MediaTargetType; targetId: string }[];
}

export interface MediaPage extends Page<MediaAsset> {
  canModerate: boolean;
  storageDriver: 'r2' | 'local';
}

// ─── Scribe Studio (D29) ───

export type TrailReportStatus = 'DRAFT' | 'SCRIBE_EDITING' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type StoryCategory =
  | 'TRAIL'
  | 'BEER_CHECK'
  | 'CIRCLE'
  | 'VISITOR'
  | 'AWARD'
  | 'SONG'
  | 'INCIDENT'
  | 'HUMOR'
  | 'SAFETY'
  | 'HISTORICAL'
  | 'GENERAL';

export interface TrailReport {
  id: string;
  runId: string;
  status: TrailReportStatus;
  title: string;
  // Null on list rows, which carry no body.
  body: string | null;
  aiAssisted: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  scribe: string;
  scribeId: string;
  run: {
    id: string;
    runNumber: number;
    title: string;
    startsAt: string;
    timeZone: string;
    // Fallback cover wherever a report needs a picture and has none of its own.
    posterUrl: string | null;
    kennel: { name: string; shortName: string; slug: string };
  };
  // FR-PUBLISH-008, present only once published.
  citation: string | null;
  assistants: string[];
  reviewers: string[];
  viewer: {
    canEdit: boolean;
    canPublish: boolean;
    // Correcting a published report is a different act from publishing one.
    canRevise: boolean;
    canReview: boolean;
    canGovern: boolean;
    isScribe: boolean;
  };
  // Present only on the `GET` read (for an editor, while a draft awaits a
  // decision) — actions that return their own fresh `report` don't repeat it.
  pendingAiSuggestion?: AiDraftSuggestion | null;
}

// FR-STORY-007. Never applied to report.body until a human decides
// (apps/api/src/services/report.service.ts#decideAiDraft).
export interface AiDraftSuggestion {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'PARTIALLY_ACCEPTED' | 'REJECTED' | 'EXPIRED';
  model: string;
  output: string;
  createdAt: string;
}

export interface ReportRevision {
  id: string;
  version: number;
  title: string;
  body?: string;
  aiAssisted: boolean;
  isPublication: boolean;
  reason: string | null;
  createdAt: string;
  author: string;
}

export interface ReportComment {
  id: string;
  body: string;
  anchor: string | null;
  resolvedAt: string | null;
  createdAt: string;
  author: string;
}

export interface StoryItem {
  id: string;
  category: StoryCategory;
  source: 'AUTOMATIC' | 'MANUAL';
  body: string;
  occurredAt: string;
  refType: string | null;
  refId: string | null;
  createdAt: string;
  contributedBy: string | null;
}

// ─── Run Capsules (D30) ───

export type CapsuleStatus =
  | 'PLANNED'
  | 'PREPARING'
  | 'LIVE'
  | 'DRAFT'
  | 'PENDING_PUBLICATION'
  | 'PUBLISHED'
  | 'ARCHIVED'
  | 'LEGACY';

export type SupplementalType = 'PHOTO' | 'SCANNED_NEWSLETTER' | 'INTERVIEW' | 'REFLECTION' | 'DOCUMENT' | 'OTHER';

export interface CapsuleTimelineEntry {
  at: string;
  kind: 'RUN' | 'STORY' | 'AWARD' | 'REPORT' | 'ATTENDANCE';
  label: string;
  detail?: string;
  refType?: string;
  refId?: string;
}

export interface CapsuleSupplement {
  id: string;
  type: SupplementalType;
  title: string;
  description: string | null;
  addedAt: string;
  media: { id: string; url: string | null; thumbnailUrl: string | null } | null;
  contributedBy: string;
}

export interface CapsuleHero {
  runNumber: number;
  title: string;
  theme: string | null;
  startsAt: string;
  timeZone: string;
  place: string;
  kennel: { name: string; shortName: string; slug: string; primaryColor?: string | null };
  leadHare: string | null;
  leadHareId: string | null;
  scribe: string | null;
  scribeId: string | null;
  hares: { userId: string; name: string; isLead: boolean }[];
  photo: string | null;
}

export type CapsuleRelatedReason = 'SAME_HARE' | 'SAME_KENNEL';

export interface RelatedCapsule {
  id: string;
  runNumber: number;
  title: string;
  startsAt: string;
  kennel: { slug: string; shortName: string; primaryColor: string | null };
  reason: CapsuleRelatedReason;
}

export interface RunCapsule {
  id: string;
  runId: string;
  status: CapsuleStatus;
  isLegacyImport: boolean;
  summary: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  hero: CapsuleHero;
  timeline: CapsuleTimelineEntry[];
  stats: { attended: number; visitors: number; guests: number; hares: number; photos: number; awards: number; songs: number };
  // Null unless you are in the hosting kennel (D23).
  participants: { id: string; userId: string | null; name: string; isVisitor: boolean }[] | null;
  circle: {
    songs: string[];
    announcements: string | null;
    awards: { id: string; title: string; reason: string | null; isDownDown: boolean; recipientName: string | null }[];
  } | null;
  media: { id: string; url: string | null; thumbnailUrl: string | null; caption: string | null; createdAt: string }[];
  report: { id: string; title: string; publishedAt: string } | null;
  supplements: CapsuleSupplement[];
  // Advisory, and only for those who could act on it (FR-CAPSULE-008).
  health: { missingReport: boolean; missingCircle: boolean; noPhotos: boolean; uncaptionedMedia: number } | null;
  // Only populated once published (08H-02 Related Capsules); empty otherwise.
  related: RelatedCapsule[];
  viewer: { canPublish: boolean; canArchive: boolean; canContribute: boolean; awaitingReport: boolean };
}

export interface CapsuleSummary {
  id: string;
  runId: string;
  status: CapsuleStatus;
  summary: string | null;
  publishedAt: string | null;
  hero: Pick<CapsuleHero, 'runNumber' | 'title' | 'startsAt' | 'timeZone' | 'kennel'>;
}

// ─── Membership invitations (FR-MEMBER-005, D53) ───

export type InvitationMethod = 'EMAIL' | 'QR_CODE' | 'LINK';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface MembershipInvitation {
  id: string;
  method: InvitationMethod;
  email: string | null;
  membershipType: MembershipType;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  acceptedByUserId: string | null;
  status: InvitationStatus;
}

// Only the creation response ever carries the token/link — never re-shown.
export interface CreatedInvitation {
  id: string;
  method: InvitationMethod;
  email: string | null;
  membershipType: MembershipType;
  expiresAt: string;
  createdAt: string;
  token: string;
  link: string;
}

export interface InvitationPreview {
  kennel: KennelSummary;
  membershipType: MembershipType;
  expiresAt: string;
}

// ─── Officers and delegations (D32) ───

export type AppointmentMethod = 'APPOINTED' | 'ELECTED' | 'ACCLAIMED' | 'INTERIM' | 'FOUNDING';
export type AppointmentStatus =
  | 'NOMINATED'
  | 'APPOINTED'
  | 'ACTIVE'
  | 'TERM_ENDED'
  | 'RESIGNED'
  | 'REVOKED'
  | 'HISTORICAL';

export interface OfficerPosition {
  id: string;
  title: string;
  description: string | null;
  responsibilities: string | null;
  // Null unless the viewer may appoint or define positions.
  permissions: string[] | null;
  termMonths: number | null;
  appointmentMethod: AppointmentMethod;
  isMismanagement: boolean;
  sortOrder: number;
  archived: boolean;
  holders: { appointmentId: string; name: string; userId: string; startDate: string; endDate: string | null }[];
}

export interface KennelMemberOption {
  userId: string;
  name: string;
}

export interface PositionsPage {
  items: OfficerPosition[];
  // What this kennel already calls each standing role (D40). Empty unless the
  // viewer may define positions.
  roleTitles: Partial<Record<GrantableRole, string>>;
  // Who you may appoint. Empty unless the viewer can appoint or manage.
  members: KennelMemberOption[];
  viewer: {
    canDefinePositions: boolean;
    canAppoint: boolean;
    // Exactly what this viewer may hand out, so the UI never offers more.
    grantableKeys: string[];
  };
}

export interface LeadershipEntry {
  id: string;
  status: AppointmentStatus;
  method: AppointmentMethod;
  startDate: string;
  endDate: string | null;
  endedReason: string | null;
  position: { id: string; title: string };
  officer: string;
  officerId: string;
  current: boolean;
}

export interface DelegationItem {
  id: string;
  permissions: string[];
  reason: string;
  startsAt: string;
  expiresAt: string;
  revokedAt: string | null;
  from: string;
  fromId: string;
  to: string;
  toId: string;
  live: boolean;
  canRevoke: boolean;
}

export interface DelegationsPage {
  items: DelegationItem[];
  members: KennelMemberOption[];
  viewer: { grantableKeys: string[]; oversight: boolean; maxDays: number };
}

// GET /kennels/:slug/settings (D34). What a kennel's own admin may edit, plus
// the standing they may only read.
export interface KennelSettings {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  description: string | null;
  motto: string | null;
  meetingDay: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: string | null;
  landingMessage: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  country: string;
  stateProvince: string;
  city: string;
  timeZone: string;
  latitude: number | null;
  longitude: number | null;
  visibility: 'PUBLIC' | 'UNLISTED' | 'HIDDEN';
  defaultRunVisibility: 'PUBLIC' | 'MEMBERS_ONLY' | 'INVITE_ONLY';
  downDownsEnabled: boolean;
  circleVisibility: 'PUBLIC' | 'MEMBERS' | 'ATTENDEES' | 'OFFICERS';
  // D45 follow-up: null means "use the platform default" (hareNudgeDefaults).
  hareNudgeSoonDays: number | null;
  hareNudgeUrgentDays: number | null;
  hareNudgeDefaults: { soonDays: number; urgentDays: number };
  status: string;
  verificationLevel: string;
  activeMemberCount: number;
  mismanagementCount: number;
  mismanagementNeeded: number;
  viewer: { isFounder: boolean; canAbandon: boolean };
}

// ─── Reels (apps/api/src/services/reel.service.ts, D41) ───

export type ReelStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'REMOVED' | 'DELETED';
// Who sees something a hasher made (D57): everybody, the people they have let
// follow them, or only them. One scale for a whole profile and for each reel.
export type Audience = 'PUBLIC' | 'FOLLOWERS' | 'ONLY_ME';
export type ReelVisibility = Audience;

export interface Reel {
  id: string;
  caption: string | null;
  status: ReelStatus;
  visibility: ReelVisibility;
  publishedAt: string | null;
  createdAt: string;
  // A reel lasts 24 hours unless it is pinned (D58). Pinned reels sit on their
  // author's profile only and never expire, so `expiresAt` is null for them.
  pinned: boolean;
  expiresAt: string | null;
  // Unique signed-in viewers plus anonymous opens (D50).
  viewCount: number;
  engagement: Engagement;
  author: { id: string; name: string; avatarUrl: string | null };
  // All optional: a reel shot at home has none of them.
  kennel: { id: string; slug: string; shortName: string; primaryColor: string | null } | null;
  run: { id: string; runNumber: number | null; title: string | null } | null;
  event: { id: string; slug: string; title: string } | null;
  // Everything in the post, in the order it was added. The first is the cover.
  items: ReelItem[];
  itemCount: number;
  isMine: boolean;
}

export interface ReelItem {
  id: string;
  kind: 'PHOTO' | 'VIDEO';
  url: string;
  posterUrl: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

// ─── Community feed (apps/api/src/services/feed.service.ts, D42) ───

export interface FeedKennel {
  slug: string;
  shortName: string;
  primaryColor: string | null;
}

// ─── Global search (Annex 08Q, scoped MVP) ───

export interface SearchRunHit {
  id: string;
  runNumber: number;
  title: string;
  theme: string | null;
  startsAt: string;
  timeZone: string;
  kennel: FeedKennel;
}

export interface SearchReportHit {
  id: string;
  title: string;
  publishedAt: string;
  run: { runNumber: number; kennel: FeedKennel };
}

export interface SearchHasherHit {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  homeKennel: FeedKennel | null;
}

export interface SearchCapsuleHit {
  id: string;
  summary: string | null;
  publishedAt: string | null;
  run: { runNumber: number; title: string; startsAt: string; kennel: FeedKennel };
}

export interface SearchResults {
  query: string;
  kennels: PublicKennel[];
  runs: SearchRunHit[];
  reports: SearchReportHit[];
  hashers: SearchHasherHit[];
  capsules: SearchCapsuleHit[];
  // Hashtags with something public under them (D59).
  tags: { tag: string; count: number }[];
  total: number;
}

export type FeedItem =
  | {
      // A run being announced — the flyer, as something people can answer (D43).
      kind: 'RUN';
      id: string;
      at: string;
      runNumber: number | null;
      title: string;
      theme: string | null;
      description: string | null;
      startsAt: string;
      timeZone: string;
      meetingPointName: string | null;
      meetingAddress: string | null;
      city: string;
      country: string;
      hashCash: string | null;
      posterUrl: string | null;
      hares: string[];
      goingCount: number;
      // True once the start time has passed and the run is still going.
      happeningNow: boolean;
      kennel: FeedKennel | null;
    }
  | {
      kind: 'REPORT';
      id: string;
      at: string;
      title: string;
      excerpt: string | null;
      kennel: FeedKennel | null;
      run: { id: string; runNumber: number | null; title: string | null } | null;
      author: string | null;
      // The scribe's id, so the card can link to them (D50).
      authorId: string | null;
      coverUrl: string | null;
    }
  | {
      kind: 'PHOTO';
      id: string;
      at: string;
      caption: string | null;
      url: string;
      thumbnailUrl: string | null;
      width: number | null;
      height: number | null;
      kennel: FeedKennel | null;
      run: { id: string; runNumber: number | null; title: string | null } | null;
      author: string | null;
      authorId: string | null;
      authorAvatarUrl: string | null;
    }
  | {
      // A hasher's own words, straight from the composer (D51).
      kind: 'POST';
      id: string;
      at: string;
      body: string;
      edited: boolean;
      author: string | null;
      authorId: string | null;
      authorAvatarUrl: string | null;
      photos: PostPhoto[];
      kennel: FeedKennel | null;
      run: { id: string; runNumber: number | null; title: string | null } | null;
      poll: PostPoll | null;
      linkPreview: LinkPreview | null;
      // How many posts follow this one in the author's thread.
      threadCount: number;
    }
  | {
      // A hasher passing 10, 50, 100 runs (D60). News, so it has no engagement bar.
      kind: 'MILESTONE';
      id: string;
      at: string;
      threshold: number;
      hasher: { id: string; name: string; avatarUrl: string | null };
      run: { id: string; runNumber: number | null; title: string | null } | null;
      kennel: FeedKennel | null;
    }
  | {
      // Somebody passing on somebody else's post, with something of their own
      // on top (D50). The engagement bar on this card acts on the original.
      kind: 'RESHARE';
      id: string;
      at: string;
      commentary: string | null;
      sharer: { id: string; name: string; avatarUrl: string | null };
      subjectType: SubjectType;
      subjectSegment: SubjectSegment;
      subjectId: string;
      original: SubjectPreview | null;
      kennel: FeedKennel | null;
    };

// A card as it leaves the API: the item, plus what people have done to it (D50).
export type FeedEntry = FeedItem & { engagement: Engagement };

export type FeedScope = 'ALL' | 'FOLLOWING';

export interface FeedPage {
  items: FeedEntry[];
  hasMore: boolean;
  page: number;
  limit: number;
  scope: FeedScope;
}

// ─── Haring a run (apps/api/src/services/hare.service.ts, D44) ───

export type HareOfferStatus = 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN';

export interface HareOffer {
  id: string;
  message: string | null;
  wantsLead: boolean;
  status: HareOfferStatus;
  reason: string | null;
  decidedAt: string | null;
  createdAt: string;
  hasher: { id: string; name: string; avatarUrl: string | null };
  run: {
    id: string;
    runNumber: number | null;
    title: string;
    startsAt: string;
    timeZone: string;
    kennel: { slug: string; shortName: string } | null;
  };
  isMine: boolean;
}

export interface HareOffers {
  items: HareOffer[];
  // Whether this viewer answers offers, and whether they could make one.
  canAnswer: boolean;
  canOffer: boolean;
}

export interface RunNeedingHare {
  id: string;
  runNumber: number | null;
  title: string;
  theme: string | null;
  startsAt: string;
  timeZone: string;
  city: string;
  country: string;
  meetingPointName: string | null;
  kennel: { slug: string; shortName: string; primaryColor: string | null } | null;
  offerCount: number;
}

// ─── Social graph and engagement (apps/api/src/services/*, D50) ───

// The URL segment each kind of content is addressed by:
// /api/proxy/engagement/<segment>/<id>/like
export type SubjectSegment = 'reels' | 'posts' | 'reports' | 'photos' | 'runs' | 'capsules' | 'comments';

export type SubjectType = 'REEL' | 'POST' | 'TRAIL_REPORT' | 'MEDIA_ASSET' | 'RUN' | 'RUN_CAPSULE' | 'COMMENT';

// What people have done to a piece of content, and what this viewer has done.
// `views` is unique signed-in viewers plus anonymous opens.
// What a like can be (D60). ON_ON is the plain like.
export type ReactionKind = 'ON_ON' | 'BEER' | 'SHIGGY' | 'DOWN_DOWN';

export interface Engagement {
  likes: number;
  comments: number;
  reshares: number;
  bookmarks: number;
  views: number;
  liked: boolean;
  bookmarked: boolean;
  reshared: boolean;
  // What the likes are made of, and which one is this viewer's (D60).
  reactions: Record<ReactionKind, number>;
  myReaction: ReactionKind | null;
}

export interface EngagementDetail extends Engagement {
  // `href` is the canonical path to the thing, which is what the share dialog
  // turns into a link; `isPublic` says whether that link works for somebody
  // with no account.
  subject: { type: SubjectType; id: string; label: string; href: string; isPublic: boolean };
  // Whether this viewer may take a comment down here.
  canModerate: boolean;
  // Your own post: resharing it is refused, so the button is not offered.
  isMine: boolean;
}

export type CommentStatus = 'VISIBLE' | 'DELETED' | 'REMOVED';

export interface ContentComment {
  id: string;
  parentId: string | null;
  // Null once withdrawn or taken down: the row keeps its place, the words go.
  body: string | null;
  status: CommentStatus;
  editedAt: string | null;
  createdAt: string;
  replyCount: number;
  author: { id: string; name: string; avatarUrl: string | null } | null;
  likes: number;
  liked: boolean;
  isMine: boolean;
}

export interface CommentThreadItem extends ContentComment {
  replies: ContentComment[];
}

export interface Liker {
  id: string;
  name: string;
  avatarUrl: string | null;
  likedAt: string;
}

export interface Bookmark {
  id: string;
  subjectType: SubjectType;
  subjectSegment: SubjectSegment;
  subjectId: string;
  note: string | null;
  savedAt: string;
  // False once the thing has gone private or been taken down. The row still
  // lists so it can be unsaved.
  available: boolean;
  label: string | null;
  href: string | null;
}

// Where one hasher stands with another: nothing, a request waiting on their
// approval, or following (D57). SELF on your own page.
export type FollowRelation = 'NONE' | 'REQUESTED' | 'FOLLOWING' | 'SELF';

export interface FollowState {
  targetId: string;
  followers: number;
  following: boolean;
  // Null for a kennel, which has no approval step.
  relation: FollowRelation | null;
  isSelf: boolean;
  // False once the hasher has closed to new followers entirely.
  followsOpen: boolean | null;
  profileVisibility: Audience | null;
}

// One tile in the photo grid on a hasher's page (D57).
export interface HasherPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  takenAt: string;
  // What it is on, so the tile can open the post, reel or run it belongs to.
  source: { type: 'POST' | 'REEL' | 'RUN'; id: string };
}

export interface HasherPhotoPage extends Page<HasherPhoto> {
  // True when this viewer is shut out by the hasher's profile setting.
  locked: boolean;
}

// Somebody waiting on a locked profile's yes.
export interface FollowRequest {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarPosition: string | null;
  bio: string | null;
  homeKennel: { slug: string; shortName: string; primaryColor: string | null } | null;
  requestedAt: string | null;
}

// The public face of a hasher (D11): handle, picture, words, kennels. Never
// biodata.
export type BlockKind = 'BLOCK' | 'MUTE';

export interface BlockedHasher {
  id: string;
  name: string;
  avatarUrl: string | null;
  kind: BlockKind;
  since: string;
}

export interface PhotoTag {
  id: string;
  status: 'PENDING' | 'APPROVED';
  user: { id: string; name: string; avatarUrl: string | null };
  canRemove: boolean;
}

export interface PendingPhotoTag {
  id: string;
  createdAt: string;
  photo: { id: string; url: string; thumbnailUrl: string | null; caption: string | null };
  by: { id: string; name: string };
}

export interface MentionItem {
  id: string;
  createdAt: string;
  in: 'POST' | 'REEL' | 'COMMENT';
  segment: SubjectSegment;
  targetId: string;
  excerpt: string;
  by: { id: string; name: string; avatarUrl: string | null };
}

export interface TaggableRun {
  id: string;
  runNumber: number | null;
  title: string | null;
  startsAt: string;
  kennel: { id: string; slug: string; shortName: string };
}

export interface HasherProfile {
  id: string;
  name: string;
  // What they are @mentioned as (D59).
  username: string | null;
  isNamed: boolean;
  avatarUrl: string | null;
  avatarPosition: string | null;
  bannerUrl: string | null;
  bannerPosition: string | null;
  bio: string | null;
  homeKennel: { slug: string; shortName: string; primaryColor: string | null } | null;
  kennels: { slug: string; shortName: string; name: string; primaryColor: string | null }[];
  joinedAt: string;
  followers: number;
  following: number;
  isFollowing: boolean;
  relation: FollowRelation;
  profileVisibility: Audience;
  // Whether this viewer may see their posts, photos and reels (D57).
  canSeeContent: boolean;
  // False once they have closed to new followers entirely.
  followsOpen: boolean;
  // How many are waiting on their yes; only filled in on your own page.
  pendingRequests: number;
  isMe: boolean;
}

export interface FollowerSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  homeKennel: { slug: string; shortName: string; primaryColor: string | null } | null;
  isFollowing: boolean;
  isMe: boolean;
}

export interface FollowedKennelSummary {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  city: string;
  country: string;
  logoUrl: string | null;
  primaryColor: string | null;
  isFollowing: boolean;
}

// "Who do they follow" is one list, because it is one question to a reader.
export type FollowingEntry =
  | { kind: 'HASHER'; followedAt: string; hasher: FollowerSummary; kennel: null }
  | { kind: 'KENNEL'; followedAt: string; hasher: null; kennel: FollowedKennelSummary };

// The quote inside a reshare card.
export interface SubjectPreview {
  type: SubjectType;
  segment: SubjectSegment;
  id: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  author: string | null;
  href: string;
  kennel: FeedKennel | null;
}

// ─── A hasher's written post (apps/api/src/services/post.service.ts, D51) ───

export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'REMOVED';

// A picture or a clip on a post. The key stays `photos`; `kind` says which, and
// for a video `thumbnailUrl` is its poster frame.
export interface PostPhoto {
  id: string;
  kind: 'PHOTO' | 'VIDEO';
  url: string;
  thumbnailUrl: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

// Always public once published (D51), so there is no visibility to choose.
// A poll on a post (D60). Results are null until this viewer has voted, the poll
// has closed, or the viewer wrote it.
export interface PostPoll {
  id: string;
  closesAt: string;
  closed: boolean;
  totalVotes: number;
  myVote: string | null;
  options: { id: string; text: string; votes: number | null; share: number | null }[];
}

// What a pasted link looks like, read by the server (D60).
export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

export interface HasherPost {
  id: string;
  body: string;
  // Who may read it (D57): its own audience, narrowing its author's profile.
  visibility: Audience;
  status: PostStatus;
  publishedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
  // Where the hasher was, when they said. Null is normal.
  kennel: { id: string; slug: string; shortName: string; primaryColor: string | null } | null;
  run: { id: string; runNumber: number | null; title: string | null } | null;
  photos: PostPhoto[];
  engagement: Engagement;
  poll: PostPoll | null;
  linkPreview: LinkPreview | null;
  // A thread is one hasher's chain of posts. A part names its first post; the
  // first post counts the parts after it and, on its own page, carries them.
  threadRootId: string | null;
  threadPosition: number;
  threadCount: number;
  thread?: HasherPost[];
  isMine: boolean;
}
