// Response shapes from apps/api. Keep in step with the API serializers.

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Social (D50/D51/D42/D43): likes, comments, reshares, bookmarks, follows,
// feed, hasher profiles, posts. Mirrors apps/web/lib/types.ts's own mirror of
// apps/api/src/services/{feed,engagement,follow,post}.service.ts. ───

export type SubjectSegment = 'reels' | 'posts' | 'reports' | 'photos' | 'runs' | 'capsules' | 'comments';
export type SubjectType = 'REEL' | 'POST' | 'TRAIL_REPORT' | 'MEDIA_ASSET' | 'RUN' | 'RUN_CAPSULE' | 'COMMENT';

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
  subject: { type: SubjectType; id: string; label: string; href: string; isPublic: boolean };
  canModerate: boolean;
  isMine: boolean;
}

export type CommentStatus = 'VISIBLE' | 'DELETED' | 'REMOVED';

export interface ContentComment {
  id: string;
  parentId: string | null;
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

// Who may see something a hasher made (D57): everybody, the people they have let
// follow them, or only them. One scale for a whole profile and for each reel.
export type Audience = 'PUBLIC' | 'FOLLOWERS' | 'ONLY_ME';

// Where one hasher stands with another: nothing, a request waiting on their
// approval, or following (D57). SELF on your own page.
export type FollowRelation = 'NONE' | 'REQUESTED' | 'FOLLOWING' | 'SELF';

export interface FollowState {
  targetId: string;
  followers: number;
  following: boolean;
  relation: FollowRelation | null;
  isSelf: boolean;
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
  source: { type: 'POST' | 'REEL' | 'RUN'; id: string };
}

export interface HasherPhotoPage extends Page<HasherPhoto> {
  locked: boolean;
}

// Somebody waiting on a locked profile's yes.
// A hasher in a followers or following list (D50).
export interface FollowerRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarPosition: string | null;
  bio: string | null;
  homeKennel: { slug: string; shortName: string; primaryColor: string | null } | null;
  isFollowing: boolean;
  isMe: boolean;
}

export interface FollowedKennelRow {
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
  | { kind: 'HASHER'; followedAt: string; hasher: FollowerRow; kennel: null }
  | { kind: 'KENNEL'; followedAt: string; hasher: null; kennel: FollowedKennelRow };

// A locked profile's lists come back empty and say why (D57).
export interface FollowerPage extends Page<FollowerRow> {
  locked?: boolean;
}
export interface FollowingPage extends Page<FollowingEntry> {
  locked?: boolean;
}

export interface FollowRequest {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarPosition: string | null;
  bio: string | null;
  homeKennel: { slug: string; shortName: string; primaryColor: string | null } | null;
  requestedAt: string | null;
}

export type BlockKind = 'BLOCK' | 'MUTE';

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

export interface BlockedHasher {
  id: string;
  name: string;
  avatarUrl: string | null;
  kind: BlockKind;
  since: string;
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
  // Where the viewer stands: BLOCK, MUTE or null (D60).
  myBlock?: BlockKind | null;
  isNamed: boolean;
  avatarUrl: string | null;
  // CSS "x% y%" crop for the round picture; null is centred.
  avatarPosition: string | null;
  bannerUrl: string | null;
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
  followsOpen: boolean;
  pendingRequests: number;
  isMe: boolean;
}

export interface FollowSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  isFollowing?: boolean;
}

export interface FeedKennel {
  slug: string;
  shortName: string;
  primaryColor: string | null;
}

export interface PostPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
}

// One post, as its own screen shows it (D51, D57).
export interface HasherPost {
  id: string;
  body: string;
  // Who may read it: its own audience, narrowing its author's profile.
  visibility: Audience;
  status: string;
  publishedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
  kennel: { id: string; slug: string; shortName: string; primaryColor: string | null } | null;
  run: { id: string; runNumber: number | null; title: string | null } | null;
  photos: PostPhoto[];
  engagement: Engagement;
  poll: PostPoll | null;
  linkPreview: LinkPreview | null;
  isMine: boolean;
}

// What a reel is made of (D48): videos and photos in the order they were added.
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

export interface Reel {
  id: string;
  caption: string | null;
  status: string;
  visibility: Audience;
  publishedAt: string | null;
  createdAt: string;
  // A reel lasts 24 hours unless it is pinned to its author's profile (D58).
  pinned: boolean;
  expiresAt: string | null;
  viewCount: number;
  engagement: Engagement;
  author: { id: string; name: string; avatarUrl: string | null };
  kennel: { id: string; slug: string; shortName: string; primaryColor: string | null } | null;
  run: { id: string; runNumber: number | null; title: string | null } | null;
  event?: { id: string; slug: string; title: string } | null;
  items: ReelItem[];
  itemCount: number;
  isMine: boolean;
}

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

export type FeedItem =
  | {
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

export type FeedEntry = FeedItem & { engagement: Engagement };
export type FeedScope = 'ALL' | 'FOLLOWING';

export interface SessionUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  status: string;
  hashHandle: string | null;
  // What they are @mentioned as (D59); null only after the account is deleted.
  username?: string | null;
  // hashHandle, or "Just <firstName>" (D11)
  displayName: string;
  avatarUrl?: string | null;
  avatarPosition?: string | null;
  bannerUrl?: string | null;
  bannerPosition?: string | null;
  // Who sees what they make: posts, photos and reels (D57).
  profileVisibility?: Audience;
  emailVerified: boolean;
  homeKennelId: string | null;
  createdAt: string;
}

export interface PublicKennel {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  country: string;
  city: string;
  motto: string | null;
  meetingDay: string | null;
  description: string;
  verificationLevel: 'PENDING' | 'COMMUNITY_VERIFIED' | 'OFFICER_VERIFIED' | 'PLATFORM_VERIFIED';
  activeMemberCount: number;
  primaryColor: string | null;
  createdAt: string;
}

export interface KennelDetail extends PublicKennel {
  orgType: string;
  stateProvince: string;
  timeZone: string;
  latitude: number | null;
  longitude: number | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: string | null;
  foundedOn: string | null;
  landingMessage: string | null;
  followerCount: number;
  officers: { title: string; name: string; avatarUrl: string | null }[];
}

export type MembershipType = 'FULL' | 'ASSOCIATE' | 'VISITING' | 'HONORARY' | 'LIFE' | 'GUEST' | 'VIRGIN' | 'COMMITTEE';

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

export interface MyMembership {
  id: string;
  status: MembershipStatus;
  type: string;
  startDate: string | null;
  createdAt: string;
  kennel: { id: string; name: string; shortName: string; slug: string; city: string; country: string; primaryColor: string | null };
  canManage?: boolean;
}

export interface OwnMembership {
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
  kennel: { id: string; name: string; shortName: string; slug: string; city: string; country: string; primaryColor: string | null };
}

export interface MembershipViewer {
  kennel: { id: string; name: string; shortName: string; slug: string };
  signedIn: boolean;
  membership: OwnMembership | null;
  canRequest: boolean;
  reason: string | null;
  permissions: string[];
  pendingCount: number;
}

// ─── Runs (mobile slice) ───

export type RsvpStatus = 'GOING' | 'MAYBE' | 'NOT_GOING' | 'CANCELLED';

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

export interface RunSummary {
  id: string;
  runNumber: number;
  title: string;
  status: RunStatus;
  runType?: RunType;
  visibility?: RunVisibility;
  startsAt: string;
  timeZone: string;
  meetingPointName: string | null;
  capacity?: number | null;
  goingCount: number;
  hares?: { displayName: string; isLead: boolean }[];
  kennel: { name: string; shortName: string; slug: string; primaryColor?: string | null };
}

// A date a kennel has set and nobody is haring yet (D44).
export interface RunNeedingHare {
  id: string;
  runNumber: number | null;
  title: string;
  startsAt: string;
  timeZone: string;
  meetingPointName: string | null;
  kennel: { slug: string; shortName: string; primaryColor: string | null } | null;
  offerCount: number;
}

export interface RunParticipant {
  id: string;
  kind: 'hasher' | 'guest';
  displayName: string;
  rsvpStatus: RsvpStatus;
  isVisitor: boolean;
  isVirginRun: boolean;
  homeKennel: string | null;
  checkedInAt: string | null;
  checkInMethod: string | null;
  // D23: null unless the viewer operates this run (a hare or run.manage).
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

// The whole run as the API sends it (apps/web lib/types.ts RunDetail).
export interface RunDetail extends Omit<RunSummary, 'goingCount'> {
  kennel: RunSummary['kennel'] & { timeZone?: string; downDownsEnabled?: boolean };
  description: string | null;
  theme: string | null;
  meetingAddress: string | null;
  hashCash: string | null;
  posterUrl: string | null;
  allowVisitors: boolean;
  allowGuests?: boolean;
  isPaused?: boolean;
  cancelReason: string | null;
  circleSkipReason: string | null;
  counts: { going: number; maybe: number; checkedIn: number; visitors: number; guests: number };
  pauses: { pausedAt: string; resumedAt: string | null; reason: string | null }[];
  circle: {
    startedAt: string | null;
    endedAt: string | null;
    songs: string[];
    announcements: string | null;
    notes: string | null;
    awards: RunAward[];
  } | null;
  participants: RunParticipant[] | null;
  timeline: { id: string; type: string; occurredAt: string; actor: string | null; reason: string | null }[] | null;
  viewer: RunViewer;
}

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
  isMine: boolean;
}

export interface HareOffers {
  items: HareOffer[];
  canAnswer: boolean;
  canOffer: boolean;
}

export type CapsuleStatus = 'PLANNED' | 'PREPARING' | 'LIVE' | 'DRAFT' | 'PENDING_PUBLICATION' | 'PUBLISHED' | 'ARCHIVED' | 'LEGACY';

export interface RunCapsule {
  id: string;
  runId: string;
  status: CapsuleStatus;
  summary: string | null;
  timeline: unknown[];
  viewer: { awaitingReport: boolean };
}

// ─── Governance (D32, mobile slice: positions/appointments; delegations and
// standing roles stay web-only for now, same "desk work" split as trails) ───

export interface OfficerHolder {
  appointmentId: string;
  name: string;
  userId: string;
  startDate: string;
  endDate: string | null;
}

export interface OfficerPosition {
  id: string;
  title: string;
  description: string | null;
  responsibilities: string | null;
  permissions: string[] | null;
  termMonths: number | null;
  appointmentMethod: string;
  isMismanagement: boolean;
  sortOrder: number;
  archived: boolean;
  holders: OfficerHolder[];
}

export interface AppointableMember {
  userId: string;
  name: string;
}

export interface PositionsResponse {
  items: OfficerPosition[];
  members: AppointableMember[];
  roleTitles: Record<string, string>;
  viewer: { canDefinePositions: boolean; canAppoint: boolean; grantableKeys: string[] };
}

export interface LeadershipEntry {
  id: string;
  status: string;
  method: string;
  startDate: string;
  endDate: string | null;
  endedReason: string | null;
  position: { id: string; title: string };
  officer: string;
  officerId: string;
  current: boolean;
}

export interface NotificationItem {
  id: string;
  category: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  status: string;
  title: string;
  body: string;
  contextType: string | null;
  contextId: string | null;
  readAt: string | null;
  createdAt: string;
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
  stamps: { id: string; code: string; label: string; runId: string | null; awardedAt: string }[];
  milestones: { id: string; threshold: number; runId: string | null; reachedAt: string }[];
  places: { id: string; country: string; stateProvince: string | null; city: string | null; kennelId: string | null; firstVisitedAt: string }[];
  memories: { id: string; kind: string; title: string; note: string | null; refType: string | null; refId: string | null; pinnedAt: string }[];
}

// GET /me/notification-preferences (D12). `channels.push` is the honest
// answer to "can this hasher be pushed to right now": it needs the platform
// switched on and a device of their own.
export interface NotificationPreferences {
  categories: {
    category: string;
    inApp: boolean;
    push: boolean;
    email: boolean;
    locked: boolean;
  }[];
  channels: { inApp: boolean; push: boolean; email: boolean };
  push: {
    enabledPlatformWide: boolean;
    devices: { id: string; platform: 'IOS' | 'ANDROID' | 'WEB'; lastSeenAt: string }[];
    quietHours: { start: string; end: string } | null;
  };
}

// ─── Trail reports (D29): the reader's view. Writing stays on the web. ───

export type TrailReportStatus = 'DRAFT' | 'SCRIBE_EDITING' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export interface TrailReport {
  id: string;
  runId: string;
  status: TrailReportStatus;
  title: string;
  // Null on list rows, which carry no body.
  body: string | null;
  publishedAt: string | null;
  scribe: string;
  run: {
    id: string;
    runNumber: number;
    title: string;
    startsAt: string;
    timeZone: string;
    posterUrl: string | null;
    kennel: { name: string; shortName: string; slug: string };
  };
  citation: string | null;
  reviewers: string[];
  viewer: { canEdit: boolean };
}

// ─── Search (web SearchResults) and saved items ───

export interface SearchResults {
  query: string;
  kennels: PublicKennel[];
  runs: {
    id: string;
    runNumber: number;
    title: string;
    startsAt: string;
    timeZone: string;
    kennel: { shortName: string; primaryColor: string | null };
  }[];
  reports: { id: string; title: string; publishedAt: string; run: { runNumber: number; kennel: { shortName: string; primaryColor: string | null } } }[];
  hashers: { id: string; name: string; username: string | null; avatarUrl: string | null; homeKennel: { shortName: string } | null }[];
  capsules: {
    id: string;
    summary: string | null;
    run: { runNumber: number; title: string; startsAt: string; kennel: { shortName: string; primaryColor: string | null } };
  }[];
  tags: { tag: string; count: number }[];
  total: number;
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

export interface IdentityTimelineEntry {
  id: string;
  type: string;
  title: string;
  refType: string | null;
  refId: string | null;
  occurredAt: string;
}
