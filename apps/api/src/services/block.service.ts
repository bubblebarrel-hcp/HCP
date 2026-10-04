import { BlockKind, FollowTargetType } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid } from '../utils/http';
import type { Actor } from './permission.service';
import { recordEvent } from './record.service';
import { publicName, userPublicSelect } from './run.service';

// Blocking and muting (D60).
//
// A block is for somebody who should not be able to reach you; a mute is for
// somebody you would rather not read. Neither is a role and neither opens a
// channel (D8): both only take things away.
//
//   BLOCK  both ways. Neither can see the other's posts, reels or photos, follow
//          the other, or notify the other. Existing follows end.
//   MUTE   one way and silent. The muted hasher's things leave the muter's feeds
//          and lists and their notifications stop. They are not told, and nothing
//          changes for them.
//
// This module imports no other content service, so audience.service can ask it
// who is out of reach without a cycle.

const active = { endedAt: null };

export interface Hidden {
  // Hashers who blocked the viewer or whom the viewer blocked. Their content is
  // out of reach in both directions, profile pages included.
  blocked: Set<string>;
  // Hashers the viewer muted. Out of their lists and notifications, still
  // reachable on purpose (their profile, a link).
  muted: Set<string>;
}

const EMPTY: Hidden = { blocked: new Set(), muted: new Set() };

export async function hiddenFor(viewerId: string | undefined): Promise<Hidden> {
  if (!viewerId) return { blocked: new Set(), muted: new Set() };
  const rows = await prisma.userBlock.findMany({
    where: { ...active, OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true, kind: true },
  });
  if (rows.length === 0) return EMPTY;
  const hidden: Hidden = { blocked: new Set(), muted: new Set() };
  for (const row of rows) {
    const other = row.blockerId === viewerId ? row.blockedId : row.blockerId;
    if (row.kind === BlockKind.BLOCK) hidden.blocked.add(other);
    // A mute is the muter's alone: being muted changes nothing for you.
    else if (row.blockerId === viewerId) hidden.muted.add(other);
  }
  return hidden;
}

// Everyone this viewer should not see in a list: blocked either way, or muted.
export async function listHiddenIds(viewerId: string | undefined) {
  const { blocked, muted } = await hiddenFor(viewerId);
  return new Set([...blocked, ...muted]);
}

export async function isBlockedBetween(a: string | undefined, b: string) {
  if (!a || a === b) return false;
  const row = await prisma.userBlock.findFirst({
    where: {
      ...active,
      kind: BlockKind.BLOCK,
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(row);
}

// Of these recipients, the ones who have not blocked or muted the actor and whom
// the actor has not blocked. A social notification goes only to them.
export async function reachable(actorId: string, recipientIds: string[]) {
  if (recipientIds.length === 0) return recipientIds;
  const rows = await prisma.userBlock.findMany({
    where: {
      ...active,
      OR: [
        { blockerId: { in: recipientIds }, blockedId: actorId },
        { blockerId: actorId, blockedId: { in: recipientIds }, kind: BlockKind.BLOCK },
      ],
    },
    select: { blockerId: true, blockedId: true },
  });
  const out = new Set(rows.map((r) => (r.blockerId === actorId ? r.blockedId : r.blockerId)));
  return recipientIds.filter((id) => !out.has(id));
}

async function target(actor: Actor, userId: string) {
  if (!isUuid(userId)) throw ApiError.notFound('Hasher not found');
  if (userId === actor.id) throw ApiError.badRequest('You cannot do that to yourself.', 'SELF');
  const user = await prisma.user.findFirst({
    where: { id: userId, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  if (!user) throw ApiError.notFound('Hasher not found');
}

export async function setRelation(actor: Actor, userId: string, kind: BlockKind) {
  await target(actor, userId);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: actor.id, blockedId: userId } },
    });
    if (existing && !existing.endedAt && existing.kind === kind) return;

    if (existing) {
      await tx.userBlock.update({ where: { id: existing.id }, data: { kind, endedAt: null, createdAt: new Date() } });
    } else {
      await tx.userBlock.create({ data: { blockerId: actor.id, blockedId: userId, kind } });
    }

    if (kind === BlockKind.BLOCK) {
      // A block ends every follow between them, requests included. Following
      // is interest (D50) and there is none left to keep.
      const now = new Date();
      await tx.follow.updateMany({
        where: {
          targetType: FollowTargetType.USER,
          unfollowedAt: null,
          OR: [
            { followerId: actor.id, targetId: userId },
            { followerId: userId, targetId: actor.id },
          ],
        },
        data: { unfollowedAt: now },
      });
    }

    await recordEvent(tx, {
      eventType: kind === BlockKind.BLOCK ? 'HasherBlocked' : 'HasherMuted',
      aggregateType: 'User',
      aggregateId: userId,
      actorId: actor.id,
      payload: {},
    });
  });
  return { kind };
}

export async function clearRelation(actor: Actor, userId: string, kind: BlockKind) {
  if (!isUuid(userId)) throw ApiError.notFound('Hasher not found');
  await prisma.$transaction(async (tx) => {
    const existing = await tx.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: actor.id, blockedId: userId } },
    });
    if (!existing || existing.endedAt || existing.kind !== kind) return;
    await tx.userBlock.update({ where: { id: existing.id }, data: { endedAt: new Date() } });
    await recordEvent(tx, {
      eventType: kind === BlockKind.BLOCK ? 'HasherUnblocked' : 'HasherUnmuted',
      aggregateType: 'User',
      aggregateId: userId,
      actorId: actor.id,
      payload: {},
    });
  });
  return { kind: null };
}

// Where the viewer stands with one hasher, for the profile menu. Only the
// viewer's own side: that somebody has blocked you is not for you to see.
export async function myRelationTo(viewerId: string | undefined, userId: string): Promise<BlockKind | null> {
  if (!viewerId || viewerId === userId) return null;
  const row = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: viewerId, blockedId: userId } },
    select: { kind: true, endedAt: true },
  });
  return row && !row.endedAt ? row.kind : null;
}

export async function listMine(actor: Actor) {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId: actor.id, ...active },
    orderBy: { createdAt: 'desc' },
    select: { kind: true, createdAt: true, blocked: { select: { ...userPublicSelect, avatarUrl: true } } },
  });
  return rows.map((row) => ({
    id: row.blocked.id,
    name: publicName(row.blocked),
    avatarUrl: row.blocked.avatarUrl,
    kind: row.kind,
    since: row.createdAt,
  }));
}

// Has this hasher blocked the viewer? Then their page is not there for them.
export async function blockedBy(viewerId: string | undefined, userId: string) {
  if (!viewerId || viewerId === userId) return false;
  const row = await prisma.userBlock.findFirst({
    where: { blockerId: userId, blockedId: viewerId, kind: BlockKind.BLOCK, ...active },
    select: { id: true },
  });
  return Boolean(row);
}
