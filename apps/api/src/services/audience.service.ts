import { Audience, FollowStatus, FollowTargetType } from '@prisma/client';
import prisma from '../config/prisma';
import { type Actor } from './permission.service';

// Who may see what a hasher has made (D57).
//
// One scale, three steps: everybody (PUBLIC), the people the hasher has let
// follow them (FOLLOWERS), or only the hasher (ONLY_ME). It applies to a whole
// profile, which governs posts, photos and reels, and to each reel, which can
// narrow that for itself but never widen it. Every place that shows a hasher's
// things asks here, so the rule lives once.
//
// This is about a hasher's own content. A run's photos, a trail report and a
// Run Capsule are a kennel's record and keep following the run's visibility
// (D3); the one place a profile's setting reaches into them is the feed and the
// profile's own photo grid, where it is the person being shown.

// Whether somebody at this relationship to the author clears this audience.
export function audienceAllows(level: Audience, rel: { isSelf: boolean; follows: boolean }) {
  if (rel.isSelf) return true;
  switch (level) {
    case Audience.PUBLIC:
      return true;
    case Audience.FOLLOWERS:
      return rel.follows;
    case Audience.ONLY_ME:
      return false;
  }
}

// Of these hashers, the ones the actor actively follows. A request still waiting
// for approval is not a follow here: it opens nothing.
export async function activeFollowSet(actorId: string | undefined, userIds: string[]) {
  const set = new Set<string>();
  if (!actorId || userIds.length === 0) return set;
  const rows = await prisma.follow.findMany({
    where: {
      followerId: actorId,
      targetType: FollowTargetType.USER,
      targetId: { in: userIds },
      status: FollowStatus.ACTIVE,
      unfollowedAt: null,
    },
    select: { targetId: true },
  });
  for (const row of rows) set.add(row.targetId);
  return set;
}

// A deactivated or deleted hasher is nobody's to look at, themself included
// (they cannot be signed in): their things leave every surface at once.
const standing = { status: 'ACTIVE' as const, deactivatedAt: null, deletedAt: null };

// Of these authors, the ones whose profile-level content this viewer may see.
// One pair of queries for a whole page, because the feed asks about dozens of
// authors at once and one query per card does not survive a phone.
export async function contentVisibleAuthors(actor: Actor | undefined, authorIds: string[]) {
  const unique = [...new Set(authorIds)];
  const visible = new Set<string>();
  if (unique.length === 0) return visible;

  const [users, follows] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: unique }, ...standing },
      select: { id: true, profileVisibility: true },
    }),
    activeFollowSet(actor?.id, unique),
  ]);
  for (const user of users) {
    if (audienceAllows(user.profileVisibility, { isSelf: actor?.id === user.id, follows: follows.has(user.id) })) {
      visible.add(user.id);
    }
  }
  return visible;
}

export async function canSeeContentOf(actor: Actor | undefined, authorId: string) {
  return (await contentVisibleAuthors(actor, [authorId])).has(authorId);
}

// A reel's audience and its author's profile must both clear. The stricter wins.
export async function canSeeAudience(actor: Actor | undefined, authorId: string, level: Audience) {
  const visible = await canSeeContentOf(actor, authorId);
  if (!visible) return false;
  if (actor?.id === authorId) return true;
  if (level === Audience.PUBLIC) return true;
  if (level === Audience.ONLY_ME) return false;
  return (await activeFollowSet(actor?.id, [authorId])).has(authorId);
}

// Where one hasher stands with another, for the follow button and the lock card.
export type Relation = 'SELF' | 'FOLLOWING' | 'REQUESTED' | 'NONE';

export async function relationTo(actorId: string | undefined, userId: string): Promise<Relation> {
  if (!actorId) return 'NONE';
  if (actorId === userId) return 'SELF';
  const row = await prisma.follow.findUnique({
    where: { followerId_targetType_targetId: { followerId: actorId, targetType: FollowTargetType.USER, targetId: userId } },
    select: { status: true, unfollowedAt: true },
  });
  if (!row || row.unfollowedAt) return 'NONE';
  return row.status === FollowStatus.ACTIVE ? 'FOLLOWING' : 'REQUESTED';
}
