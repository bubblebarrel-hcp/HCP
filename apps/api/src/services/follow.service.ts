import { FollowTargetType, KennelStatus, MembershipStatus, Prisma, ProfileVisibility } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { type Actor, resolveKennelContext } from './permission.service';
import { recordEvent } from './record.service';
import { publicName, userPublicSelect } from './run.service';

// The social graph (D50).
//
// A follow is interest, not belonging. Following a kennel is not joining it: it
// grants no membership, no vote, no authority, and it is never counted towards
// the four active mismanagement members a kennel needs to be verified (D10).
// The one thing it does is decide what lands in a hasher's feed.
//
// There is still no direct messaging (D8) and a follow does not create a
// channel of any kind. Following somebody is a way to read them, not a way to
// reach them.

// ─── Who may be followed ───

// A hasher whose profile is PRIVATE is not followable: following is a public
// relationship, and the follower list would announce them. MEMBERS_ONLY is
// followable — it governs what of their biodata is shown, not whether they
// exist.
export async function followableUser(actor: Actor | undefined, userId: string) {
  if (!isUuid(userId)) throw ApiError.notFound('Hasher not found');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      hashHandle: true,
      avatarUrl: true,
      bio: true,
      profileVisibility: true,
      status: true,
      deactivatedAt: true,
      createdAt: true,
      person: { select: { firstName: true } },
      homeKennel: { select: { slug: true, shortName: true, primaryColor: true } },
    },
  });
  if (!user) throw ApiError.notFound('Hasher not found');
  if (user.status !== 'ACTIVE' || user.deactivatedAt) throw ApiError.notFound('Hasher not found');
  if (user.profileVisibility === ProfileVisibility.PRIVATE && actor?.id !== user.id) {
    throw ApiError.notFound('Hasher not found');
  }
  return user;
}

// A kennel anybody can find is a kennel anybody can follow (D38). A HIDDEN
// kennel is followable only by its own members, and an archived one by nobody.
async function followableKennel(actor: Actor | undefined, slugOrId: string) {
  const kennel = await prisma.kennel.findFirst({
    where: isUuid(slugOrId) ? { OR: [{ id: slugOrId }, { slug: slugOrId }] } : { slug: slugOrId },
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
      primaryColor: true,
      logoUrl: true,
      city: true,
      country: true,
      status: true,
      visibility: true,
    },
  });
  if (!kennel) throw ApiError.notFound('Kennel not found');
  if (kennel.status === KennelStatus.ARCHIVED) throw ApiError.notFound('Kennel not found');
  if (kennel.visibility === 'HIDDEN') {
    if (!actor) throw ApiError.notFound('Kennel not found');
    const context = await resolveKennelContext(actor, kennel.id);
    if (!context.isMember) throw ApiError.notFound('Kennel not found');
  }
  return kennel;
}

// ─── Following and unfollowing ───

async function setFollow(actor: Actor, type: FollowTargetType, targetId: string, following: boolean) {
  if (type === FollowTargetType.USER && targetId === actor.id) {
    throw ApiError.badRequest('You already have your own posts.', 'CANNOT_FOLLOW_SELF');
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.follow.findUnique({
      where: { followerId_targetType_targetId: { followerId: actor.id, targetType: type, targetId } },
      select: { id: true, unfollowedAt: true },
    });
    const active = Boolean(existing && !existing.unfollowedAt);
    if (active === following) return { following, changed: false };

    if (existing) {
      await tx.follow.update({
        where: { id: existing.id },
        data: following ? { unfollowedAt: null, followedAt: new Date() } : { unfollowedAt: new Date() },
      });
    } else {
      await tx.follow.create({ data: { followerId: actor.id, targetType: type, targetId } });
    }

    // The toggle row is current state; the event is the history, which is where
    // append-only history belongs.
    await recordEvent(tx, {
      eventType: following ? 'HasherFollowed' : 'HasherUnfollowed',
      aggregateType: type === FollowTargetType.USER ? 'User' : 'Kennel',
      aggregateId: targetId,
      actorId: actor.id,
      payload: { targetType: type },
    });

    return { following, changed: true };
  });
}

export async function followUser(actor: Actor, userId: string) {
  await followableUser(actor, userId);
  const result = await setFollow(actor, FollowTargetType.USER, userId, true);
  return { ...result, counts: await countsForUser(userId) };
}

export async function unfollowUser(actor: Actor, userId: string) {
  // No followability check: unfollowing must keep working after somebody has
  // gone private, or the follow is a one-way door.
  if (!isUuid(userId)) throw ApiError.notFound('Hasher not found');
  const result = await setFollow(actor, FollowTargetType.USER, userId, false);
  return { ...result, counts: await countsForUser(userId) };
}

export async function followKennel(actor: Actor, slugOrId: string) {
  const kennel = await followableKennel(actor, slugOrId);
  const result = await setFollow(actor, FollowTargetType.KENNEL, kennel.id, true);
  return { ...result, counts: { followers: await followerCount(FollowTargetType.KENNEL, kennel.id) } };
}

export async function unfollowKennel(actor: Actor, slugOrId: string) {
  const kennel = await prisma.kennel.findFirst({
    where: isUuid(slugOrId) ? { OR: [{ id: slugOrId }, { slug: slugOrId }] } : { slug: slugOrId },
    select: { id: true },
  });
  if (!kennel) throw ApiError.notFound('Kennel not found');
  const result = await setFollow(actor, FollowTargetType.KENNEL, kennel.id, false);
  return { ...result, counts: { followers: await followerCount(FollowTargetType.KENNEL, kennel.id) } };
}

// ─── Counts and membership of the graph ───

export function followerCount(type: FollowTargetType, targetId: string) {
  return prisma.follow.count({ where: { targetType: type, targetId, unfollowedAt: null } });
}

export async function countsForUser(userId: string) {
  const [followers, following] = await Promise.all([
    followerCount(FollowTargetType.USER, userId),
    prisma.follow.count({ where: { followerId: userId, unfollowedAt: null } }),
  ]);
  return { followers, following };
}

export async function isFollowing(actorId: string | undefined, type: FollowTargetType, targetId: string) {
  if (!actorId) return false;
  const row = await prisma.follow.findUnique({
    where: { followerId_targetType_targetId: { followerId: actorId, targetType: type, targetId } },
    select: { unfollowedAt: true },
  });
  return Boolean(row && !row.unfollowedAt);
}

// Which of these targets the actor already follows, in one query. The kennel
// directory asks this about a page of twenty kennels at a time.
export async function followingSet(actorId: string | undefined, type: FollowTargetType, targetIds: string[]) {
  const set = new Set<string>();
  if (!actorId || targetIds.length === 0) return set;
  const rows = await prisma.follow.findMany({
    where: { followerId: actorId, targetType: type, targetId: { in: targetIds }, unfollowedAt: null },
    select: { targetId: true },
  });
  for (const row of rows) set.add(row.targetId);
  return set;
}

// Everything this hasher follows, as ids by type. This is what the "Following"
// feed is built from.
export async function followedBy(actorId: string) {
  const rows = await prisma.follow.findMany({
    where: { followerId: actorId, unfollowedAt: null },
    select: { targetType: true, targetId: true },
  });
  return {
    userIds: rows.filter((r) => r.targetType === FollowTargetType.USER).map((r) => r.targetId),
    kennelIds: rows.filter((r) => r.targetType === FollowTargetType.KENNEL).map((r) => r.targetId),
  };
}

// Whether this viewer follows one target, and how many others do. The kennel
// form takes a slug, because that is what the public page is addressed by.
export async function followState(actor: Actor | undefined, type: FollowTargetType, slugOrId: string) {
  const targetId =
    type === FollowTargetType.KENNEL ? (await followableKennel(actor, slugOrId)).id : (await followableUser(actor, slugOrId)).id;
  const [followers, following] = await Promise.all([
    followerCount(type, targetId),
    isFollowing(actor?.id, type, targetId),
  ]);
  // Nobody follows themself, so the button is not offered on your own page.
  return { targetId, followers, following, isSelf: type === FollowTargetType.USER && actor?.id === targetId };
}

// ─── Lists ───

async function serializeUsers(actorId: string | undefined, userIds: string[]) {
  if (userIds.length === 0) return [];
  const [users, following] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds }, status: 'ACTIVE', deactivatedAt: null },
      select: {
        ...userPublicSelect,
        avatarUrl: true,
        bio: true,
        profileVisibility: true,
        homeKennel: { select: { slug: true, shortName: true, primaryColor: true } },
      },
    }),
    followingSet(actorId, FollowTargetType.USER, userIds),
  ]);
  // Preserve the order the ids came in, which is the order the follows happened.
  const byId = new Map(users.map((u) => [u.id, u]));
  return userIds
    .map((id) => byId.get(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    // Somebody who has since gone private is not listed to anyone but themself.
    .filter((u) => u.profileVisibility !== ProfileVisibility.PRIVATE || u.id === actorId)
    .map((u) => ({
      id: u.id,
      name: publicName(u),
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      homeKennel: u.homeKennel,
      isFollowing: following.has(u.id),
      isMe: u.id === actorId,
    }));
}

// Who follows this hasher. A follower list is public in the sense that the
// handles on it are public identity (D11) — there is no biodata here.
export async function listFollowers(actor: Actor | undefined, userId: string, opts: { page: number; limit: number }) {
  await followableUser(actor, userId);
  const where: Prisma.FollowWhereInput = {
    targetType: FollowTargetType.USER,
    targetId: userId,
    unfollowedAt: null,
  };
  const [rows, total] = await prisma.$transaction([
    prisma.follow.findMany({
      where,
      orderBy: { followedAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: { followerId: true },
    }),
    prisma.follow.count({ where }),
  ]);
  return page(await serializeUsers(actor?.id, rows.map((r) => r.followerId)), total, opts.page, opts.limit);
}

// Who this hasher follows — both the people and the kennels, because "who do
// they follow" is one question to a reader.
export async function listFollowing(actor: Actor | undefined, userId: string, opts: { page: number; limit: number }) {
  await followableUser(actor, userId);
  const where: Prisma.FollowWhereInput = { followerId: userId, unfollowedAt: null };
  const [rows, total] = await prisma.$transaction([
    prisma.follow.findMany({
      where,
      orderBy: { followedAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: { targetType: true, targetId: true, followedAt: true },
    }),
    prisma.follow.count({ where }),
  ]);

  const userIds = rows.filter((r) => r.targetType === FollowTargetType.USER).map((r) => r.targetId);
  const kennelIds = rows.filter((r) => r.targetType === FollowTargetType.KENNEL).map((r) => r.targetId);

  const [users, kennels, followedKennels] = await Promise.all([
    serializeUsers(actor?.id, userIds),
    kennelIds.length
      ? prisma.kennel.findMany({
          where: { id: { in: kennelIds }, status: { not: KennelStatus.ARCHIVED } },
          select: {
            id: true,
            slug: true,
            name: true,
            shortName: true,
            city: true,
            country: true,
            logoUrl: true,
            primaryColor: true,
          },
        })
      : [],
    followingSet(actor?.id, FollowTargetType.KENNEL, kennelIds),
  ]);

  const usersById = new Map(users.map((u) => [u.id, u]));
  const kennelsById = new Map(kennels.map((k) => [k.id, k]));

  const items = rows
    .map((row) => {
      if (row.targetType === FollowTargetType.USER) {
        const user = usersById.get(row.targetId);
        return user ? { kind: 'HASHER' as const, followedAt: row.followedAt, hasher: user, kennel: null } : null;
      }
      const kennel = kennelsById.get(row.targetId);
      return kennel
        ? {
            kind: 'KENNEL' as const,
            followedAt: row.followedAt,
            hasher: null,
            kennel: { ...kennel, isFollowing: followedKennels.has(kennel.id) },
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return page(items, total, opts.page, opts.limit);
}

export async function listKennelFollowers(
  actor: Actor | undefined,
  slugOrId: string,
  opts: { page: number; limit: number },
) {
  const kennel = await followableKennel(actor, slugOrId);
  const where: Prisma.FollowWhereInput = {
    targetType: FollowTargetType.KENNEL,
    targetId: kennel.id,
    unfollowedAt: null,
  };
  const [rows, total] = await prisma.$transaction([
    prisma.follow.findMany({
      where,
      orderBy: { followedAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: { followerId: true },
    }),
    prisma.follow.count({ where }),
  ]);
  return page(await serializeUsers(actor?.id, rows.map((r) => r.followerId)), total, opts.page, opts.limit);
}

// ─── The public face of a hasher ───

// Following somebody needs somewhere to press follow, and there was no public
// hasher page before this. It shows public identity only (D11): the handle they
// chose or "Just <firstName>", their picture, their words about themselves, and
// their home kennel. Biodata stays in PersonProfile, which is private and is
// not selected here at all.
export async function hasherProfile(actor: Actor | undefined, userId: string) {
  const user = await followableUser(actor, userId);
  const [counts, following, memberships] = await Promise.all([
    countsForUser(user.id),
    isFollowing(actor?.id, FollowTargetType.USER, user.id),
    // Which kennels they run with. Public because a kennel's member list is
    // already visible to the people who can see the kennel.
    prisma.membership.findMany({
      where: {
        userId: user.id,
        status: MembershipStatus.ACTIVE,
        kennel: { status: { not: KennelStatus.ARCHIVED }, visibility: { not: 'HIDDEN' } },
      },
      select: { kennel: { select: { slug: true, shortName: true, name: true, primaryColor: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return {
    id: user.id,
    name: publicName(user),
    // Whether they have been named yet, so the page can say "not yet named"
    // rather than pretending "Just Chidi" is a hash handle.
    isNamed: Boolean(user.hashHandle),
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    homeKennel: user.homeKennel,
    kennels: memberships.map((m) => m.kennel),
    joinedAt: user.createdAt,
    followers: counts.followers,
    following: counts.following,
    isFollowing: following,
    isMe: actor?.id === user.id,
  };
}
