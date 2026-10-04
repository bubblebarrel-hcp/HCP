import { PhotoTagStatus, Prisma, SubjectType } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { canSeeContentOf } from './audience.service';
import { isBlockedBetween } from './block.service';
import type { Actor } from './permission.service';
import { recordEvent } from './record.service';
import { publicName, userPublicSelect } from './run.service';
import { resolveSubject, resolveVisible } from './subject.service';

// Tagging a hasher in a photo (D60).
//
// A tag is a claim about somebody else, so it is a request. The person tagged
// says yes or no: until they say yes it shows to nobody but them and whoever
// asked, and a no is final — the same person cannot be asked again about the same
// photo. Later they can take the tag off themselves, and so can the person who
// made it and the person who took the photo. A tag can only be made for somebody
// who could already open the photo, so it cannot be a way to show them one.

const S = PhotoTagStatus;
export const MAX_TAGS_PER_PHOTO = 10;

const tagSelect = {
  id: true,
  mediaId: true,
  status: true,
  createdAt: true,
  taggedUserId: true,
  taggedById: true,
  tagged: { select: { ...userPublicSelect, avatarUrl: true } },
} satisfies Prisma.PhotoTagSelect;

export async function tag(actor: Actor, mediaId: string, userId: string) {
  // Whoever tags has to be able to see the photo.
  await resolveSubject(actor, SubjectType.MEDIA_ASSET, mediaId);
  if (!isUuid(userId)) throw ApiError.notFound('Hasher not found');

  const target = await prisma.user.findFirst({
    where: { id: userId, status: 'ACTIVE', deactivatedAt: null, deletedAt: null },
    select: { id: true },
  });
  if (!target || (await isBlockedBetween(actor.id, userId))) throw ApiError.notFound('Hasher not found');

  // They must be able to open it themselves: a tag is not an invitation to a
  // members-only run's photos.
  try {
    await resolveSubject({ id: userId, role: 'USER' }, SubjectType.MEDIA_ASSET, mediaId);
  } catch {
    throw ApiError.badRequest('They cannot see this photo, so they cannot be tagged in it.', 'CANNOT_SEE_PHOTO');
  }

  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaId }, select: { uploaderId: true } });
  const self = userId === actor.id;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.photoTag.findUnique({
      where: { mediaId_taggedUserId: { mediaId, taggedUserId: userId } },
      select: { id: true, status: true },
    });
    if (existing) {
      if (existing.status === S.DECLINED || existing.status === S.REMOVED) {
        throw ApiError.conflict('They have said no to being tagged in this photo.', 'TAG_DECLINED');
      }
      return existing.id;
    }
    const count = await tx.photoTag.count({ where: { mediaId, status: { in: [S.PENDING, S.APPROVED] } } });
    if (count >= MAX_TAGS_PER_PHOTO) {
      throw ApiError.badRequest(`A photo can have ${MAX_TAGS_PER_PHOTO} people tagged.`, 'TOO_MANY_TAGS');
    }
    // Tagging yourself needs nobody's say-so.
    const created = await tx.photoTag.create({
      data: {
        mediaId,
        taggedUserId: userId,
        taggedById: actor.id,
        status: self ? S.APPROVED : S.PENDING,
        decidedAt: self ? new Date() : null,
      },
      select: { id: true },
    });
    if (!self) {
      await recordEvent(tx, {
        eventType: 'PhotoTagRequested',
        aggregateType: 'Photo',
        aggregateId: mediaId,
        actorId: actor.id,
        payload: { tagId: created.id, taggedUserId: userId, uploaderId: media?.uploaderId ?? null },
      });
    }
    return created.id;
  });

  return listForPhoto(actor, mediaId).then((tags) => ({ id: result, tags }));
}

async function ownTag(tagId: string) {
  if (!isUuid(tagId)) throw ApiError.notFound('Tag not found');
  const row = await prisma.photoTag.findUnique({ where: { id: tagId }, select: tagSelect });
  if (!row) throw ApiError.notFound('Tag not found');
  return row;
}

// The tagged hasher's answer. Only theirs to give, and only once.
export async function decide(actor: Actor, tagId: string, approve: boolean) {
  const row = await ownTag(tagId);
  if (row.taggedUserId !== actor.id) throw ApiError.notFound('Tag not found');
  if (row.status !== S.PENDING) return { status: row.status };

  const status = approve ? S.APPROVED : S.DECLINED;
  await prisma.$transaction(async (tx) => {
    await tx.photoTag.update({ where: { id: tagId }, data: { status, decidedAt: new Date() } });
    // Only a yes is news. Telling somebody they were turned down is not kind and
    // is not needed.
    if (approve) {
      await recordEvent(tx, {
        eventType: 'PhotoTagApproved',
        aggregateType: 'Photo',
        aggregateId: row.mediaId,
        actorId: actor.id,
        payload: { tagId, taggerId: row.taggedById },
      });
    }
  });
  return { status };
}

// Taking a tag off: the person in it, the person who made it, or the person who
// took the photo. The row stays (append-only); it just stops showing.
export async function remove(actor: Actor, tagId: string) {
  const row = await ownTag(tagId);
  const media = await prisma.mediaAsset.findUnique({ where: { id: row.mediaId }, select: { uploaderId: true } });
  const allowed = [row.taggedUserId, row.taggedById, media?.uploaderId].includes(actor.id);
  if (!allowed) throw ApiError.notFound('Tag not found');
  if (row.status === S.REMOVED) return { status: row.status };

  await prisma.photoTag.update({ where: { id: tagId }, data: { status: S.REMOVED, decidedAt: new Date() } });
  return { status: S.REMOVED };
}

// Who is in a photo, as far as this viewer may know: approved tags for anybody
// who can see the photo, and a pending one only for the two people it is between.
export async function listForPhoto(actor: Actor | undefined, mediaId: string) {
  await resolveSubject(actor, SubjectType.MEDIA_ASSET, mediaId);
  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaId }, select: { uploaderId: true } });
  const rows = await prisma.photoTag.findMany({
    where: { mediaId, status: { in: [S.APPROVED, S.PENDING] } },
    orderBy: { createdAt: 'asc' },
    select: tagSelect,
  });
  return rows
    .filter((row) => row.status === S.APPROVED || row.taggedUserId === actor?.id || row.taggedById === actor?.id)
    .map((row) => ({
      id: row.id,
      status: row.status,
      user: { id: row.tagged.id, name: publicName(row.tagged), avatarUrl: row.tagged.avatarUrl },
      // Who may take it off.
      canRemove: [row.taggedUserId, row.taggedById, media?.uploaderId].includes(actor?.id),
    }));
}

// Tags waiting for this hasher's answer.
export async function pendingForMe(actor: Actor) {
  const rows = await prisma.photoTag.findMany({
    where: { taggedUserId: actor.id, status: S.PENDING },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      media: { select: { id: true, url: true, thumbnailUrl: true, caption: true } },
      tagger: { select: { ...userPublicSelect, avatarUrl: true } },
    },
  });
  // A photo that has since become none of their business is not on the list.
  const visible = await resolveVisible(
    actor,
    rows.map((r) => ({ type: SubjectType.MEDIA_ASSET, id: r.media.id })),
  );
  return rows
    .filter((r) => visible.has(`${SubjectType.MEDIA_ASSET}:${r.media.id}`) && r.media.url)
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      photo: { id: r.media.id, url: r.media.url as string, thumbnailUrl: r.media.thumbnailUrl, caption: r.media.caption },
      by: { id: r.tagger.id, name: publicName(r.tagger) },
    }));
}

// Photos a hasher is in, for their profile: approved tags only, and only photos
// the viewer may open, on a profile the viewer may read (D57).
export async function photosOf(actor: Actor | undefined, userId: string, opts: { page: number; limit: number }) {
  if (!isUuid(userId)) throw ApiError.notFound('Hasher not found');
  if (actor?.id !== userId && !(await canSeeContentOf(actor, userId))) {
    return page([], 0, opts.page, opts.limit);
  }
  const where: Prisma.PhotoTagWhereInput = { taggedUserId: userId, status: S.APPROVED };
  const rows = await prisma.photoTag.findMany({
    where,
    orderBy: { decidedAt: 'desc' },
    take: 200,
    select: { media: { select: { id: true, url: true, thumbnailUrl: true, caption: true, width: true, height: true } } },
  });
  const visible = await resolveVisible(
    actor,
    rows.map((r) => ({ type: SubjectType.MEDIA_ASSET, id: r.media.id })),
  );
  const all = rows
    .filter((r) => visible.has(`${SubjectType.MEDIA_ASSET}:${r.media.id}`) && r.media.url)
    .map((r) => ({ ...r.media, url: r.media.url as string }));
  const start = (opts.page - 1) * opts.limit;
  return page(all.slice(start, start + opts.limit), all.length, opts.page, opts.limit);
}
