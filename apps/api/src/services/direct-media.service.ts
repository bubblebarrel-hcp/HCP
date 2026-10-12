import { MediaKind } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid } from '../utils/http';
import { conversationFor, hasSeenSticker, recentStickerIds } from './direct-message.service';
import type { Actor } from './permission.service';
import { recordEvent } from './record.service';
import { buildStorageKey, createUploadTarget, deleteObject, objectSize, signedReadUrl } from './storage.service';

// Files and stickers for direct messages (D73).
//
// The same three steps a photo takes (D28): ask for an upload target, send the
// bytes straight to storage, then confirm. Unlike a photo on a run these are
// private: they hang off a conversation, are listed nowhere, and are read
// through signed addresses that expire. A file can only be sent into the
// conversation it was uploaded for, by the person who uploaded it, once.

const MB = 1024 * 1024;

const FILES: Record<'PHOTO' | 'VIDEO' | 'AUDIO', { types: string[]; max: number; maxSeconds?: number }> = {
  PHOTO: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'], max: 10 * MB },
  // Not re-encoded: the clip plays as it was recorded, so the cap is the guard.
  VIDEO: { types: ['video/mp4', 'video/quicktime', 'video/webm'], max: 50 * MB, maxSeconds: 180 },
  AUDIO: { types: ['audio/mp4', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/aac', 'audio/x-m4a'], max: 10 * MB, maxSeconds: 300 },
};

const STICKER_TYPES = ['image/webp', 'image/png'];
const STICKER_MAX = 512 * 1024;
const STICKER_SIDE_MAX = 1024;
const STICKERS_PER_HASHER = 200;
const FAVORITES_PER_HASHER = 200;
// A runaway client cannot fill the bucket with files that are never sent.
const PENDING_PER_HOUR = 60;

type FileKind = keyof typeof FILES;

// ─── Files ───

export async function requestAttachmentUpload(
  actor: Actor,
  conversationId: string,
  input: { kind: FileKind; mimeType: string; sizeBytes: number; width?: number | null; height?: number | null; durationSec?: number | null },
) {
  const conversation = await conversationFor(actor, conversationId);
  if (!conversation.mayShareFiles) {
    throw ApiError.forbidden('Wait for them to accept before you send pictures, stickers or voice.', 'DM_MEDIA_NEEDS_ACCEPT');
  }

  const rule = FILES[input.kind];
  if (!rule.types.includes(input.mimeType)) {
    throw ApiError.badRequest(`${input.mimeType} is not an accepted ${input.kind.toLowerCase()} format.`, 'UNSUPPORTED_MEDIA_TYPE');
  }
  if (input.sizeBytes < 1 || input.sizeBytes > rule.max) {
    throw ApiError.badRequest(`Files must be ${Math.floor(rule.max / MB)}MB or smaller.`, 'FILE_TOO_LARGE');
  }
  if (rule.maxSeconds && input.durationSec && input.durationSec > rule.maxSeconds) {
    throw ApiError.badRequest(`That is longer than ${Math.floor(rule.maxSeconds / 60)} minutes.`, 'FILE_TOO_LONG');
  }

  const pending = await prisma.directAttachment.count({
    where: { uploaderId: actor.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (pending >= PENDING_PER_HOUR) {
    throw new ApiError(429, 'Slow down a little. Try again in a few minutes.', 'DM_RATE_LIMITED');
  }

  const storageKey = buildStorageKey(`dm/${conversation.id}`, input.mimeType);
  const row = await prisma.directAttachment.create({
    data: {
      uploaderId: actor.id,
      conversationId: conversation.id,
      kind: input.kind as MediaKind,
      storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      width: input.width ?? null,
      height: input.height ?? null,
      durationSec: input.durationSec ?? null,
    },
    select: { id: true },
  });
  const upload = await createUploadTarget(storageKey, input.mimeType);
  return { attachment: { id: row.id }, upload: { ...upload, storageKey } };
}

// The client calls this once the PUT to storage succeeded. What was stored is
// measured, not trusted: a presigned address cannot cap a size by itself.
export async function confirmAttachment(
  actor: Actor,
  attachmentId: string,
  input: { width?: number | null; height?: number | null; durationSec?: number | null },
) {
  if (!isUuid(attachmentId)) throw ApiError.notFound('File not found');
  const file = await prisma.directAttachment.findUnique({ where: { id: attachmentId } });
  if (!file || file.uploaderId !== actor.id) throw ApiError.notFound('File not found');
  // Still a member, and not blocked, by the time it lands.
  await conversationFor(actor, file.conversationId);

  if (file.state === 'READY') return summary(file);

  const rule = FILES[file.kind as FileKind];
  const stored = await objectSize(file.storageKey);
  if (stored === null || stored < 1) throw ApiError.badRequest('The upload did not arrive. Try again.', 'UPLOAD_MISSING');
  if (stored > rule.max) {
    await deleteObject(file.storageKey).catch(() => undefined);
    await prisma.directAttachment.delete({ where: { id: file.id } });
    throw ApiError.badRequest(`Files must be ${Math.floor(rule.max / MB)}MB or smaller.`, 'FILE_TOO_LARGE');
  }
  const durationSec = input.durationSec ?? file.durationSec;
  if (file.kind === 'AUDIO' && (!durationSec || durationSec < 0.5)) {
    throw ApiError.badRequest('That recording is empty.', 'AUDIO_EMPTY');
  }
  if (rule.maxSeconds && durationSec && durationSec > rule.maxSeconds + 2) {
    await deleteObject(file.storageKey).catch(() => undefined);
    await prisma.directAttachment.delete({ where: { id: file.id } });
    throw ApiError.badRequest(`That is longer than ${Math.floor(rule.maxSeconds / 60)} minutes.`, 'FILE_TOO_LONG');
  }

  const ready = await prisma.directAttachment.update({
    where: { id: file.id },
    data: {
      state: 'READY',
      confirmedAt: new Date(),
      sizeBytes: stored,
      width: input.width ?? file.width,
      height: input.height ?? file.height,
      durationSec: durationSec ?? null,
    },
  });
  return summary(ready);
}

async function summary(f: { id: string; kind: MediaKind; mimeType: string; width: number | null; height: number | null; durationSec: number | null; sizeBytes: number; storageKey: string }) {
  return {
    id: f.id,
    kind: f.kind,
    mimeType: f.mimeType,
    width: f.width,
    height: f.height,
    durationSec: f.durationSec,
    sizeBytes: f.sizeBytes,
    url: await signedReadUrl(f.storageKey),
  };
}

// ─── Stickers ───

export async function requestStickerUpload(actor: Actor, input: { mimeType: string; sizeBytes: number; width?: number | null; height?: number | null }) {
  if (!STICKER_TYPES.includes(input.mimeType)) {
    throw ApiError.badRequest('A sticker is a PNG or WebP picture.', 'UNSUPPORTED_MEDIA_TYPE');
  }
  if (input.sizeBytes < 1 || input.sizeBytes > STICKER_MAX) {
    throw ApiError.badRequest('A sticker must be 512KB or smaller.', 'FILE_TOO_LARGE');
  }
  if ((input.width ?? 0) > STICKER_SIDE_MAX || (input.height ?? 0) > STICKER_SIDE_MAX) {
    throw ApiError.badRequest('A sticker is at most 1024 pixels on a side.', 'FILE_TOO_LARGE');
  }
  const owned = await prisma.sticker.count({ where: { ownerId: actor.id, deletedAt: null } });
  if (owned >= STICKERS_PER_HASHER) {
    throw ApiError.conflict(`You can keep ${STICKERS_PER_HASHER} stickers. Delete one to make another.`, 'STICKER_LIMIT');
  }
  const pending = await prisma.sticker.count({
    where: { ownerId: actor.id, confirmedAt: null, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (pending >= 20) throw new ApiError(429, 'Slow down a little. Try again in a few minutes.', 'DM_RATE_LIMITED');

  const storageKey = buildStorageKey(`stickers/${actor.id}`, input.mimeType);
  const row = await prisma.sticker.create({
    data: { ownerId: actor.id, storageKey, mimeType: input.mimeType, sizeBytes: input.sizeBytes, width: input.width ?? null, height: input.height ?? null },
    select: { id: true },
  });
  const upload = await createUploadTarget(storageKey, input.mimeType);
  return { sticker: { id: row.id }, upload: { ...upload, storageKey } };
}

export async function confirmSticker(actor: Actor, stickerId: string) {
  if (!isUuid(stickerId)) throw ApiError.notFound('Sticker not found');
  const sticker = await prisma.sticker.findUnique({ where: { id: stickerId } });
  if (!sticker || sticker.ownerId !== actor.id || sticker.deletedAt) throw ApiError.notFound('Sticker not found');
  if (sticker.confirmedAt) return stickerView(sticker, actor.id, new Set());

  const stored = await objectSize(sticker.storageKey);
  if (stored === null || stored < 1) throw ApiError.badRequest('The upload did not arrive. Try again.', 'UPLOAD_MISSING');
  if (stored > STICKER_MAX) {
    await deleteObject(sticker.storageKey).catch(() => undefined);
    await prisma.sticker.delete({ where: { id: sticker.id } });
    throw ApiError.badRequest('A sticker must be 512KB or smaller.', 'FILE_TOO_LARGE');
  }
  const confirmed = await prisma.$transaction(async (tx) => {
    const row = await tx.sticker.update({ where: { id: sticker.id }, data: { confirmedAt: new Date(), sizeBytes: stored } });
    await recordEvent(tx, { eventType: 'StickerCreated', aggregateType: 'Sticker', aggregateId: row.id, actorId: actor.id, payload: {} });
    return row;
  });
  return stickerView(confirmed, actor.id, new Set());
}

type StickerRow = { id: string; ownerId: string; storageKey: string; width: number | null; height: number | null };

async function stickerView(s: StickerRow, me: string, favorites: Set<string>) {
  return {
    id: s.id,
    url: await signedReadUrl(s.storageKey),
    width: s.width,
    height: s.height,
    mine: s.ownerId === me,
    favorite: favorites.has(s.id),
  };
}

// The tray: what I made, what I starred (mine or somebody's I was sent), and
// what I sent lately.
export async function listStickers(actor: Actor) {
  const [mineRows, favRows, recentIds] = await Promise.all([
    prisma.sticker.findMany({ where: { ownerId: actor.id, confirmedAt: { not: null }, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.stickerFavorite.findMany({ where: { userId: actor.id }, orderBy: { createdAt: 'desc' }, include: { sticker: true } }),
    recentStickerIds(actor.id),
  ]);
  const favoriteIds = new Set(favRows.map((f) => f.stickerId));
  const recentRows = recentIds.length ? await prisma.sticker.findMany({ where: { id: { in: recentIds }, confirmedAt: { not: null } } }) : [];
  const recentById = new Map(recentRows.map((r) => [r.id, r]));
  const view = (s: StickerRow) => stickerView(s, actor.id, favoriteIds);
  return {
    mine: await Promise.all(mineRows.map(view)),
    favorites: await Promise.all(favRows.filter((f) => f.sticker.confirmedAt).map((f) => view(f.sticker))),
    recent: await Promise.all(recentIds.map((id) => recentById.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s)).map(view)),
  };
}

// Leaves my tray. Messages already sent keep showing it: they are what was said.
export async function deleteSticker(actor: Actor, stickerId: string) {
  if (!isUuid(stickerId)) throw ApiError.notFound('Sticker not found');
  const sticker = await prisma.sticker.findUnique({ where: { id: stickerId } });
  if (!sticker || sticker.ownerId !== actor.id || sticker.deletedAt) throw ApiError.notFound('Sticker not found');
  await prisma.$transaction(async (tx) => {
    await tx.sticker.update({ where: { id: stickerId }, data: { deletedAt: new Date() } });
    await recordEvent(tx, { eventType: 'StickerDeleted', aggregateType: 'Sticker', aggregateId: stickerId, actorId: actor.id, payload: {} });
  });
  return { deleted: true };
}

export async function setFavorite(actor: Actor, stickerId: string, favorite: boolean) {
  if (!isUuid(stickerId)) throw ApiError.notFound('Sticker not found');
  const sticker = await prisma.sticker.findFirst({ where: { id: stickerId, confirmedAt: { not: null } }, select: { id: true, ownerId: true, deletedAt: true } });
  if (!sticker) throw ApiError.notFound('Sticker not found');
  if (!favorite) {
    await prisma.stickerFavorite.deleteMany({ where: { userId: actor.id, stickerId } });
    return { favorite: false };
  }
  // You can star your own, or one you were sent or sent: not any id you guess.
  const allowed = sticker.ownerId === actor.id ? !sticker.deletedAt : await hasSeenSticker(actor.id, stickerId);
  if (!allowed) throw ApiError.notFound('Sticker not found');
  const count = await prisma.stickerFavorite.count({ where: { userId: actor.id } });
  if (count >= FAVORITES_PER_HASHER) throw ApiError.conflict('Your favourites are full. Remove one first.', 'FAVORITES_LIMIT');
  await prisma.stickerFavorite.upsert({
    where: { userId_stickerId: { userId: actor.id, stickerId } },
    create: { userId: actor.id, stickerId },
    update: {},
  });
  return { favorite: true };
}
