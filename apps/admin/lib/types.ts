// Response shapes from the Shiggy Trails API (apps/api). Keep in step with the services.

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
  status: string;
  trustLevel: string;
  hashHandle: string | null;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  homeKennelId: string | null;
  createdAt: string;
}

export const KENNEL_STATUSES = ['DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export const VERIFICATION_LEVELS = ['PENDING', 'COMMUNITY_VERIFIED', 'OFFICER_VERIFIED', 'PLATFORM_VERIFIED'] as const;
export const KENNEL_VISIBILITIES = ['PUBLIC', 'UNLISTED', 'HIDDEN'] as const;
export const RUN_VISIBILITIES = ['PUBLIC', 'MEMBERS_ONLY', 'INVITE_ONLY'] as const;
export const ORG_TYPES = [
  'LOCAL_KENNEL',
  'REGIONAL_ASSOCIATION',
  'NATIONAL_ASSOCIATION',
  'CONTINENTAL_ASSOCIATION',
  'INTERNATIONAL_COMMITTEE',
  'WORKING_GROUP',
  'HERITAGE_FOUNDATION',
  'TEMPORARY_EVENT_COMMITTEE',
] as const;

export interface AdminKennel {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  orgType: (typeof ORG_TYPES)[number];
  country: string;
  stateProvince: string;
  city: string;
  timeZone: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  motto: string | null;
  meetingDay: string | null;
  status: (typeof KENNEL_STATUSES)[number];
  verificationLevel: (typeof VERIFICATION_LEVELS)[number];
  visibility: (typeof KENNEL_VISIBILITIES)[number];
  defaultRunVisibility: (typeof RUN_VISIBILITIES)[number];
  createdAt: string;
  updatedAt: string;
  _count: { memberships: number; runs: number };
  // Only on the single-kennel endpoint
  activeMismanagementCount?: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  trustLevel: string;
  displayName: string;
  fullName: string | null;
  country: string | null;
  homeKennel: { id: string; shortName: string } | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminStats {
  kennels: number;
  activeKennels: number;
  verifiedKennels: number;
  pendingKennels: number;
  users: number;
  recentSignups: number;
}

// The review queue (GET /admin/kennels/pending). A founded kennel is out of the
// directory and off the map until the platform activates it (D33/D10).
export interface PendingKennel {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  city: string;
  country: string;
  createdAt: string;
  activeMemberCount: number;
  foundedBy: string | null;
  mismanagementCount: number;
  mismanagementNeeded: number;
  readyForReview: boolean;
  hasCoordinates: boolean;
  waitingDays: number;
}

export interface PendingKennels {
  items: PendingKennel[];
  total: number;
  minimum: number;
}

// ─── Reports and moderation (D61) ───

export type ReportReason =
  | 'SPAM'
  | 'SCAM'
  | 'HARASSMENT'
  | 'HATE'
  | 'VIOLENCE'
  | 'SEXUAL'
  | 'PRIVATE_INFO'
  | 'SELF_HARM'
  | 'IMPERSONATION'
  | 'OTHER';
export type ReportStatus = 'OPEN' | 'IN_REVIEW' | 'ACTIONED' | 'DISMISSED';
export type ReportTargetType = 'USER' | 'POST' | 'REEL' | 'COMMENT' | 'MEDIA_ASSET';
export type ModerationActionKind =
  | 'DISMISS'
  | 'REMOVE_CONTENT'
  | 'WARN_USER'
  | 'SUSPEND_USER'
  | 'RESET_IDENTITY'
  | 'ESCALATE'
  | 'NOTE';

export interface ReportRow {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  target: { userId: string | null; name: string | null };
  reason: ReportReason;
  reasonLabel: string;
  details: string | null;
  status: ReportStatus;
  priority: number;
  escalated: boolean;
  summary: string;
  openReportsOnTarget: number;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ReportHasher {
  id: string;
  name: string;
  hashHandle: string | null;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  status: string;
  homeKennel: { slug: string; shortName: string } | null;
}

export interface ReportDetail {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  reasonLabel: string;
  details: string | null;
  status: ReportStatus;
  priority: number;
  escalated: boolean;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  reporter: { id: string; name: string; createdAt: string } | null;
  snapshot: Record<string, unknown>;
  current: { status: string | null; removed: boolean } | null;
  target: ReportHasher | null;
  // Who answers for it: the hasher themself, or the author of the content.
  answerable: { id: string; name: string } | null;
  impersonated: ReportHasher | null;
  sameHandle: boolean;
  siblings: { id: string; reason: ReportReason; reasonLabel: string; status: ReportStatus; details: string | null; createdAt: string }[];
  priorActions: { kind: ModerationActionKind; at: string; reason: ReportReason }[];
  actions: { id: string; kind: ModerationActionKind; note: string | null; by: string; at: string }[];
  may: ModerationActionKind[];
}
