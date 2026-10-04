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
