import { Prisma } from '@prisma/client';

// D11: a hasher without a hash handle is shown as "Just <firstName>".
export function displayName(hashHandle: string | null | undefined, firstName: string | null | undefined): string {
  if (hashHandle && hashHandle.trim()) return hashHandle.trim();
  return firstName ? `Just ${firstName}` : 'Just a Hasher';
}

export const sessionUserSelect = {
  id: true,
  email: true,
  platformRole: true,
  status: true,
  trustLevel: true,
  hashHandle: true,
  username: true,
  avatarUrl: true,
  avatarPosition: true,
  bannerUrl: true,
  bannerPosition: true,
  profileVisibility: true,
  emailVerifiedAt: true,
  homeKennelId: true,
  createdAt: true,
  person: { select: { firstName: true } },
} satisfies Prisma.UserSelect;

export type SessionUserRow = Prisma.UserGetPayload<{ select: typeof sessionUserSelect }>;

// What the signed-in user sees about themself. Biodata beyond first name stays
// behind a dedicated profile endpoint; passwordHash never leaves the service.
export function serializeSessionUser(user: SessionUserRow) {
  return {
    id: user.id,
    email: user.email,
    role: user.platformRole,
    status: user.status,
    trustLevel: user.trustLevel,
    hashHandle: user.hashHandle,
    // What they are @mentioned as (D59).
    username: user.username,
    displayName: displayName(user.hashHandle, user.person?.firstName),
    avatarUrl: user.avatarUrl,
    avatarPosition: user.avatarPosition,
    bannerUrl: user.bannerUrl,
    bannerPosition: user.bannerPosition,
    // Who sees what they make: PUBLIC, FOLLOWERS or ONLY_ME (D57).
    profileVisibility: user.profileVisibility,
    emailVerified: Boolean(user.emailVerifiedAt),
    homeKennelId: user.homeKennelId,
    createdAt: user.createdAt,
  };
}

export type SessionUser = ReturnType<typeof serializeSessionUser>;
