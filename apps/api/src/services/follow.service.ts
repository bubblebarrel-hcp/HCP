import { Audience, FollowStatus, FollowTargetType, KennelStatus, MembershipStatus, Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { audienceAllows, relationTo } from './audience.service';
import { blockedBy, myRelationTo } from './block.service';
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
//
// A hasher decides who may follow them (D57). A PUBLIC profile is followed at
// once. A locked one (FOLLOWERS) turns a follow into a request that waits for
// their approval, and until then it opens nothing. One that has closed to
// everybody (ONLY_ME) takes no new followers at all.

// ─── Who may be followed ───

// Anybody who is still here can be found and asked: the name, picture and words
// are public identity (D11) and a locked profile is exactly the one somebody
// needs to be able to find in order to ask. What a lock hides is the content,
// and that is decided by audience.service, not here. A deactivated or deleted
// hasher is not here at all.
export async function followableUser(actor: Actor | undefined, userId: string) {
  if (!isUuid(userId)) throw ApiError.notFound('Hasher not found');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      hashHandle: true,
      username: true,
      avatarUrl: true,
      avatarPosition: true,
      bannerUrl: true,
      bannerPosition: true,
      bio: true,
      profileVisibility: true,
      status: true,
      deactivatedAt: true,
      deletedAt: true,
      createdAt: true,
      person: { select: { firstName: true } },
      homeKennel: { select: { slug: true, shortName: true, primaryColor: true } },
    },
  });
  if (!user) throw ApiError.notFound('Hasher not found');
  if (user.status !== 'ACTIVE' || user.deactivatedAt || user.deletedAt) throw ApiError.notFound('Hasher not found');
  // Somebody who has blocked you is not there for you (D60). Their page is a 404,
  // the same as one that never existed, so a block does not announce itself.
  if (await blockedBy(actor?.id, user.id)) throw ApiError.notFound('Hasher not found');
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

// `status` is what a new follow lands as: ACTIVE, or PENDING when the person
// being followed has to say yes first (D57). A repeat of something already in
// that state changes nothing.
async function setFollow(
  actor: Actor,
  type: FollowTargetType,
  targetId: string,
  following: boolean,
  status: FollowStatus = FollowStatus.ACTIVE,
) {
  if (type === FollowTargetType.USER && targetId === actor.id) {
    throw ApiError.badRequest('You already have your own posts.', 'CANNOT_FOLLOW_SELF');
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.follow.findUnique({
      where: { followerId_targetType_targetId: { followerId: actor.id, targetType: type, targetId } },
      select: { id: true, unfollowedAt: true, status: true },
    });
    const live = Boolean(existing && !existing.unfollowedAt);

    if (!following) {
      if (!existing || !live) return { following: false, requested: false, changed: false };
      await tx.follow.update({ where: { id: existing.id }, data: { unfollowedAt: new Date() } });
      // Withdrawing a request is not unfollowing: nothing was ever followed.
      await recordEvent(tx, {
        eventType: existing.status === FollowStatus.PENDING ? 'FollowRequestCancelled' : 'HasherUnfollowed',
        aggregateType: type === FollowTargetType.USER ? 'User' : 'Kennel',
        aggregateId: targetId,
        actorId: actor.id,
        payload: { targetType: type },
      });
      return { following: false, requested: false, changed: true };
    }

    // Already following, or already asked: nothing to add.
    if (existing && live && existing.status === FollowStatus.ACTIVE) {
      return { following: true, requested: false, changed: false };
    }
    if (existing && live && existing.status === status) {
      return { following: false, requested: true, changed: false };
    }

    if (existing) {
      await tx.follow.update({
        where: { id: existing.id },
        data: { unfollowedAt: null, followedAt: new Date(), status },
      });
    } else {
      await tx.follow.create({ data: { followerId: actor.id, targetType: type, targetId, status } });
    }

    // The toggle row is current state; the event is the history, which is where
    // append-only history belongs.
    await recordEvent(tx, {
      eventType: status === FollowStatus.PENDING ? 'FollowRequested' : 'HasherFollowed',
      aggregateType: type === FollowTargetType.USER ? 'User' : 'Kennel',
      aggregateId: targetId,
      actorId: actor.id,
      payload: { targetType: type },
    });

    return { following: status === FollowStatus.ACTIVE, requested: status === FollowStatus.PENDING, changed: true };
  });
}

export async function followUser(actor: Actor, userId: string) {
  const target = await followableUser(actor, userId);
  if (target.id === actor.id) {
    throw ApiError.badRequest('You already have your own posts.', 'CANNOT_FOLLOW_SELF');
  }
  if ((await myRelationTo(actor.id, userId)) === 'BLOCK') {
    throw ApiError.badRequest('You blocked this hasher. Unblock them first.', 'BLOCKED');
  }
  if (target.profileVisibility === Audience.ONLY_ME) {
    throw ApiError.forbidden('This hasher is not taking new followers.', 'FOLLOWS_CLOSED');
  }
  const status = target.profileVisibility === Audience.PUBLIC ? FollowStatus.ACTIVE : FollowStatus.PENDING;
  const result = await setFollow(actor, FollowTargetType.USER, userId, true, status);
  return {
    ...result,
    relation: await relationTo(actor.id, userId),
    counts: await countsForUser(userId),
  };
}

export async function unfollowUser(actor: Actor, userId: string) {
  // No followability check: unfollowing, or withdrawing a request, must keep
  // working after somebody has locked their profile, or the follow is a one-way
  // door.
  if (!isUuid(userId)) throw ApiError.notFound('Hasher not found');
  const result = await setFollow(actor, FollowTargetType.USER, userId, false);
  return { ...result, relation: await relationTo(actor.id, userId), counts: await countsForUser(userId) };
}

// ─── Follow requests (D57) ───

// Who is waiting for this hasher's yes, oldest first: the order they asked in.
export async function listRequests(actor: Actor, opts: { page: number; limit: number }) {
  const where: Prisma.FollowWhereInput = {
    targetType: FollowTargetType.USER,
    targetId: actor.id,
    status: FollowStatus.PENDING,
    unfollowedAt: null,
  };
  const [rows, total] = await prisma.$transaction([
    prisma.follow.findMany({
      where,
      orderBy: { followedAt: 'asc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: { followerId: true, followedAt: true },
    }),
    prisma.follow.count({ where }),
  ]);
  const people = await serializeUsers(actor.id, rows.map((r) => r.followerId));
  const at = new Map(rows.map((r) => [r.followerId, r.followedAt]));
  return page(
    people.map((p) => ({ ...p, requestedAt: at.get(p.id) ?? null })),
    total,
    opts.page,
    opts.limit,
  );
}

export function pendingRequestCount(userId: string) {
  return prisma.follow.count({
    where: { targetType: FollowTargetType.USER, targetId: userId, status: FollowStatus.PENDING, unfollowedAt: null },
  });
}

async function pendingFrom(actorId: string, followerId: string) {
  if (!isUuid(followerId)) throw ApiError.notFound('Request not found');
  const row = await prisma.follow.findUnique({
    where: {
      followerId_targetType_targetId: { followerId, targetType: FollowTargetType.USER, targetId: actorId },
    },
    select: { id: true, status: true, unfollowedAt: true },
  });
  if (!row || row.unfollowedAt || row.status !== FollowStatus.PENDING) throw ApiError.notFound('Request not found');
  return row;
}

export async function approveRequest(actor: Actor, followerId: string) {
  const row = await pendingFrom(actor.id, followerId);
  await prisma.$transaction(async (tx) => {
    await tx.follow.update({
      where: { id: row.id },
      data: { status: FollowStatus.ACTIVE, followedAt: new Date() },
    });
    await recordEvent(tx, {
      eventType: 'FollowRequestApproved',
      aggregateType: 'User',
      aggregateId: actor.id,
      actorId: actor.id,
      payload: { followerId },
    });
  });
  return { approved: true, counts: await countsForUser(actor.id) };
}

// A decline is quiet: the person is not told, so asking was never an
// announcement and being refused is not a message (D57). They can ask again.
export async function declineRequest(actor: Actor, followerId: string) {
  const row = await pendingFrom(actor.id, followerId);
  await prisma.$transaction(async (tx) => {
    await tx.follow.update({ where: { id: row.id }, data: { unfollowedAt: new Date() } });
    await recordEvent(tx, {
      eventType: 'FollowRequestDeclined',
      aggregateType: 'User',
      aggregateId: actor.id,
      actorId: actor.id,
      payload: { followerId },
    });
  });
  return { declined: true };
}

// Take somebody off your followers. They are not told, and they can ask again.
export async function removeFollower(actor: Actor, followerId: string) {
  if (!isUuid(followerId)) throw ApiError.notFound('Follower not found');
  const row = await prisma.follow.findUnique({
    where: {
      followerId_targetType_targetId: { followerId, targetType: FollowTargetType.USER, targetId: actor.id },
    },
    select: { id: true, status: true, unfollowedAt: true },
  });
  if (!row || row.unfollowedAt || row.status !== FollowStatus.ACTIVE) throw ApiError.notFound('Follower not found');
  await prisma.$transaction(async (tx) => {
    await tx.follow.update({ where: { id: row.id }, data: { unfollowedAt: new Date() } });
    await recordEvent(tx, {
      eventType: 'FollowerRemoved',
      aggregateType: 'User',
      aggregateId: actor.id,
      actorId: actor.id,
      payload: { followerId },
    });
  });
  return { removed: true, counts: await countsForUser(actor.id) };
}

// Opening a profile to everybody lets everyone who was waiting in. Called inside
// the transaction that changes the setting, so the two cannot disagree.
export async function approveAllPending(tx: Prisma.TransactionClient, userId: string) {
  const waiting = await tx.follow.findMany({
    where: { targetType: FollowTargetType.USER, targetId: userId, status: FollowStatus.PENDING, unfollowedAt: null },
    select: { id: true, followerId: true },
  });
  if (waiting.length === 0) return 0;
  await tx.follow.updateMany({
    where: { id: { in: waiting.map((w) => w.id) } },
    data: { status: FollowStatus.ACTIVE, followedAt: new Date() },
  });
  for (const w of waiting) {
    await recordEvent(tx, {
      eventType: 'FollowRequestApproved',
      aggregateType: 'User',
      aggregateId: userId,
      actorId: null,
      payload: { followerId: w.followerId, reason: 'profile-opened' },
    });
  }
  return waiting.length;
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

// Only live follows count: a request still waiting is not a follower yet.
export function followerCount(type: FollowTargetType, targetId: string) {
  return prisma.follow.count({
    where: { targetType: type, targetId, status: FollowStatus.ACTIVE, unfollowedAt: null },
  });
}

export async function countsForUser(userId: string) {
  const [followers, following] = await Promise.all([
    followerCount(FollowTargetType.USER, userId),
    prisma.follow.count({ where: { followerId: userId, status: FollowStatus.ACTIVE, unfollowedAt: null } }),
  ]);
  return { followers, following };
}

export async function isFollowing(actorId: string | undefined, type: FollowTargetType, targetId: string) {
  if (!actorId) return false;
  const row = await prisma.follow.findUnique({
    where: { followerId_targetType_targetId: { followerId: actorId, targetType: type, targetId } },
    select: { unfollowedAt: true, status: true },
  });
  return Boolean(row && !row.unfollowedAt && row.status === FollowStatus.ACTIVE);
}

// Which of these targets the actor already follows, in one query. The kennel
// directory asks this about a page of twenty kennels at a time.
export async function followingSet(actorId: string | undefined, type: FollowTargetType, targetIds: string[]) {
  const set = new Set<string>();
  if (!actorId || targetIds.length === 0) return set;
  const rows = await prisma.follow.findMany({
    where: {
      followerId: actorId,
      targetType: type,
      targetId: { in: targetIds },
      status: FollowStatus.ACTIVE,
      unfollowedAt: null,
    },
    select: { targetId: true },
  });
  for (const row of rows) set.add(row.targetId);
  return set;
}

// Everything this hasher follows, as ids by type. This is what the "Following"
// feed is built from.
export async function followedBy(actorId: string) {
  const rows = await prisma.follow.findMany({
    where: { followerId: actorId, status: FollowStatus.ACTIVE, unfollowedAt: null },
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
  const targetUser = type === FollowTargetType.USER ? await followableUser(actor, slugOrId) : null;
  const targetId = targetUser ? targetUser.id : (await followableKennel(actor, slugOrId)).id;
  const [followers, following, relation] = await Promise.all([
    followerCount(type, targetId),
    isFollowing(actor?.id, type, targetId),
    type === FollowTargetType.USER ? relationTo(actor?.id, targetId) : Promise.resolve(null),
  ]);
  // Nobody follows themself, so the button is not offered on your own page.
  return {
    targetId,
    followers,
    following,
    // NONE, REQUESTED (waiting on approval), FOLLOWING or SELF; null for a kennel.
    relation,
    isSelf: type === FollowTargetType.USER && actor?.id === targetId,
    // A hasher who has closed to everybody (ONLY_ME) takes no new followers; a
    // locked one takes requests (D57). Null for a kennel.
    followsOpen: targetUser ? targetUser.profileVisibility !== Audience.ONLY_ME : null,
    profileVisibility: targetUser ? targetUser.profileVisibility : null,
  };
}

// ─── Lists ───

async function serializeUsers(actorId: string | undefined, userIds: string[]) {
  if (userIds.length === 0) return [];
  const [users, following] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds }, status: 'ACTIVE', deactivatedAt: null, deletedAt: null },
      select: {
        ...userPublicSelect,
        avatarUrl: true,
        avatarPosition: true,
        bio: true,
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
    .map((u) => ({
      id: u.id,
      name: publicName(u),
      avatarUrl: u.avatarUrl,
      avatarPosition: u.avatarPosition,
      bio: u.bio,
      homeKennel: u.homeKennel,
      isFollowing: following.has(u.id),
      isMe: u.id === actorId,
    }));
}

// Who follows this hasher. A follower list is public in the sense that the
// handles on it are public identity (D11) — there is no biodata here.
//
// On a locked profile the list is for the hasher and the people they have let in
// (D57): everybody else gets an empty list that says why, not an error, so the
// page can show the lock rather than a failure.
async function listVisibleTo(actor: Actor | undefined, user: { id: string; profileVisibility: Audience }) {
  if (actor?.id === user.id) return true;
  const relation = await relationTo(actor?.id, user.id);
  return audienceAllows(user.profileVisibility, { isSelf: false, follows: relation === 'FOLLOWING' });
}

const LOCKED_PAGE = (opts: { page: number; limit: number }) => ({ ...page([], 0, opts.page, opts.limit), locked: true });

export async function listFollowers(actor: Actor | undefined, userId: string, opts: { page: number; limit: number }) {
  const target = await followableUser(actor, userId);
  if (!(await listVisibleTo(actor, target))) return LOCKED_PAGE(opts);
  const where: Prisma.FollowWhereInput = {
    targetType: FollowTargetType.USER,
    targetId: userId,
    status: FollowStatus.ACTIVE,
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
  const target = await followableUser(actor, userId);
  if (!(await listVisibleTo(actor, target))) return LOCKED_PAGE(opts);
  const where: Prisma.FollowWhereInput = { followerId: userId, status: FollowStatus.ACTIVE, unfollowedAt: null };
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
    status: FollowStatus.ACTIVE,
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
  const [counts, relation, memberships, requests] = await Promise.all([
    countsForUser(user.id),
    relationTo(actor?.id, user.id),
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
    // Only the hasher themself is told how many are waiting.
    actor?.id === user.id ? pendingRequestCount(user.id) : Promise.resolve(0),
  ]);

  // A locked profile still shows who it belongs to, so there is somebody to ask;
  // what it keeps back is the content: posts, photos, reels, who follows whom.
  const canSeeContent = audienceAllows(user.profileVisibility, {
    isSelf: actor?.id === user.id,
    follows: relation === 'FOLLOWING',
  });

  return {
    id: user.id,
    name: publicName(user),
    // What they are @mentioned as (D59). A chosen name, like the handle.
    username: user.username,
    // Whether they have been named yet, so the page can say "not yet named"
    // rather than pretending "Just Chidi" is a hash handle.
    isNamed: Boolean(user.hashHandle),
    avatarUrl: user.avatarUrl,
    avatarPosition: user.avatarPosition,
    bannerUrl: user.bannerUrl,
    bannerPosition: user.bannerPosition,
    bio: user.bio,
    homeKennel: user.homeKennel,
    kennels: memberships.map((m) => m.kennel),
    joinedAt: user.createdAt,
    followers: counts.followers,
    following: counts.following,
    isFollowing: relation === 'FOLLOWING',
    // NONE, REQUESTED, FOLLOWING or SELF: the follow button's whole state.
    relation,
    profileVisibility: user.profileVisibility,
    // Whether this viewer may see what the hasher has made (D57).
    canSeeContent,
    // ONLY_ME has closed to new followers; the button is not offered.
    followsOpen: user.profileVisibility !== Audience.ONLY_ME,
    pendingRequests: requests,
    isMe: actor?.id === user.id,
    // Where the viewer stands: BLOCK, MUTE or null (D60). Only their own side.
    myBlock: await myRelationTo(actor?.id, user.id),
  };
}
