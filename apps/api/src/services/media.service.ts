import {
  MediaKind,
  MediaModerationMode,
  MediaTargetType,
  ModerationState,
  Prisma,
  UploadState,
} from '@prisma/client';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { ApiError, isUuid, page } from '../utils/http';
import { type Actor, assertKennelPermission, resolveKennelContext } from './permission.service';
import { recordAudit, recordEvent } from './record.service';
import { canView, getAccess, publicName, userPublicSelect } from './run.service';
import { buildStorageKey, createUploadTarget, publicUrlFor, storageDriver } from './storage.service';

// Media (Ch.23 Part F, Ch.22 B.2). The client asks for an upload target, PUTs
// the file straight to storage, then confirms; the API never carries the bytes.
//
// BR-RUN-007: media is never orphaned. Every asset is linked to a run, trail,
// circle or gallery at the moment it is created.

const ALLOWED: Record<MediaKind, string[]> = {
  PHOTO: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif'],
  VIDEO: ['video/mp4', 'video/quicktime', 'video/webm'],
  AUDIO: ['audio/mpeg', 'audio/mp4', 'audio/webm'],
  DOCUMENT: ['application/pdf'],
};

// Exported so the validator refuses exactly what this file refuses. It used to
// keep its own copy of this list, and POST was added here and not there, which
// is a 400 that says the target is invalid when the service would have taken it.
export const SUPPORTED_TARGETS: MediaTargetType[] = [
  MediaTargetType.RUN,
  MediaTargetType.TRAIL,
  MediaTargetType.CIRCLE,
  MediaTargetType.GALLERY,
  MediaTargetType.KENNEL,
  MediaTargetType.REEL,
  MediaTargetType.POST,
  MediaTargetType.PROFILE,
];

// Targets whose media is live the moment it lands, with no moderation queue,
// because the uploader already owns the thing it goes on: a kennel's own
// branding, which only its admins may touch (D37), and a hasher's own reel or
// post (D41, D51). A moderator takes the whole thing down rather than holding
// its pictures back.
const IMMEDIATE_TARGETS: MediaTargetType[] = [
  MediaTargetType.KENNEL,
  MediaTargetType.REEL,
  MediaTargetType.POST,
  MediaTargetType.PROFILE,
];

// Formats every browser can show in an <img> (D56).
const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export interface MediaTarget {
  type: MediaTargetType;
  id: string;
}

interface TargetContext {
  kennelId: string;
  runId: string | null;
  // Whoever can see the target can see its media.
  canUpload: boolean;
  canModerate: boolean;
}

async function resolveTarget(actor: Actor, target: MediaTarget): Promise<TargetContext> {
  if (!SUPPORTED_TARGETS.includes(target.type)) {
    throw ApiError.badRequest(`Media cannot be attached to a ${target.type.toLowerCase()} yet.`, 'TARGET_NOT_SUPPORTED');
  }
  if (!isUuid(target.id)) throw ApiError.notFound('Target not found');

  if (target.type === MediaTargetType.GALLERY) {
    const gallery = await prisma.gallery.findUnique({ where: { id: target.id }, select: { kennelId: true } });
    if (!gallery) throw ApiError.notFound('Gallery not found');
    const context = await resolveKennelContext(actor, gallery.kennelId);
    if (!context.isMember) throw ApiError.forbidden('Only members add to a kennel gallery.', 'MEMBERS_ONLY');
    return {
      kennelId: gallery.kennelId,
      runId: null,
      canUpload: true,
      canModerate: context.grants.has('media.moderate'),
    };
  }

  // A hasher's reel (D41). The video belongs to the person who shot it, so the
  // only person who may put one on a reel is its author — and a reel that is
  // still a draft is nobody else's business.
  if (target.type === MediaTargetType.REEL) {
    const reel = await prisma.reel.findUnique({
      where: { id: target.id },
      select: { id: true, authorId: true, kennelId: true, status: true },
    });
    if (!reel) throw ApiError.notFound('Reel not found');
    if (reel.authorId !== actor.id) {
      throw ApiError.forbidden('Only the author adds the video to their reel.', 'NOT_THE_AUTHOR');
    }
    return { kennelId: reel.kennelId ?? '', runId: null, canUpload: true, canModerate: true };
  }

  // The photos on a hasher's written post (D51). Same rule as a reel: the
  // post belongs to the person writing it, so only its author may put a photo
  // on it, and a post that is still a draft is nobody else's business.
  if (target.type === MediaTargetType.POST) {
    const post = await prisma.post.findUnique({
      where: { id: target.id },
      select: { id: true, authorId: true, kennelId: true, status: true },
    });
    if (!post) throw ApiError.notFound('Post not found');
    if (post.authorId !== actor.id) {
      throw ApiError.forbidden('Only the author adds photos to their post.', 'NOT_THE_AUTHOR');
    }
    return { kennelId: post.kennelId ?? '', runId: null, canUpload: true, canModerate: true };
  }

  // A hasher's own profile picture or banner (D56). The target is the hasher
  // themself, so the check is simply "is that you": nobody sets somebody else's
  // picture, and there is no kennel or moderator in the way.
  if (target.type === MediaTargetType.PROFILE) {
    if (target.id !== actor.id) {
      throw ApiError.forbidden('You can only change your own profile pictures.', 'NOT_YOUR_PROFILE');
    }
    return { kennelId: '', runId: null, canUpload: true, canModerate: false };
  }

  // A kennel's own logo and banner (D37). Editing how the kennel presents
  // itself is `kennel.manage`, the same permission the settings screen needs,
  // so a member cannot put a picture on the front of the kennel.
  if (target.type === MediaTargetType.KENNEL) {
    const kennel = await prisma.kennel.findUnique({ where: { id: target.id }, select: { id: true } });
    if (!kennel) throw ApiError.notFound('Kennel not found');
    await assertKennelPermission(actor, kennel.id, 'kennel.manage');
    return { kennelId: kennel.id, runId: null, canUpload: true, canModerate: true };
  }

  // RUN, TRAIL and CIRCLE all resolve back to a run.
  let runId = target.id;
  if (target.type === MediaTargetType.TRAIL) {
    const trail = await prisma.trail.findUnique({ where: { id: target.id }, select: { runId: true } });
    if (!trail) throw ApiError.notFound('Trail not found');
    runId = trail.runId;
  }
  if (target.type === MediaTargetType.CIRCLE) {
    const circle = await prisma.circle.findUnique({ where: { id: target.id }, select: { runId: true } });
    if (!circle) throw ApiError.notFound('Circle not found');
    runId = circle.runId;
  }

  const access = await getAccess(actor, runId);
  if (!canView(access)) throw ApiError.notFound('Target not found');

  // Anyone who took part, or belongs to the hosting kennel, may add media.
  const participated = Boolean(access.participation);
  if (!access.isMember && !participated && !access.isHare && !access.canManage) {
    throw ApiError.forbidden('Only people on the run can add media to it.', 'NOT_ON_THE_RUN');
  }

  return {
    kennelId: access.run.kennelId,
    runId,
    canUpload: true,
    canModerate: access.grants.has('media.moderate') || Boolean(access.canManage),
  };
}

// ─── Serialization ───

const mediaSelect = {
  id: true,
  kind: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  durationSec: true,
  caption: true,
  url: true,
  thumbnailUrl: true,
  latitude: true,
  longitude: true,
  capturedAt: true,
  uploadState: true,
  moderationState: true,
  createdAt: true,
  uploader: { select: userPublicSelect },
  links: { select: { targetType: true, targetId: true } },
} satisfies Prisma.MediaAssetSelect;

type MediaRow = Prisma.MediaAssetGetPayload<{ select: typeof mediaSelect }>;

function serialize(media: MediaRow) {
  const { uploader, sizeBytes, ...rest } = media;
  return {
    ...rest,
    // BigInt does not survive JSON; media sizes are far inside Number range.
    sizeBytes: Number(sizeBytes),
    // BR-CAPSULE-007: attribution is permanent.
    uploadedBy: uploader ? publicName(uploader) : null,
    uploaderId: uploader?.id ?? null,
  };
}

// ─── Upload ───

export async function requestUpload(
  actor: Actor,
  input: {
    kind: MediaKind;
    mimeType: string;
    sizeBytes: number;
    target: MediaTarget;
    clientId?: string | null;
    caption?: string | null;
    capturedAt?: Date | null;
    latitude?: number | null;
    longitude?: number | null;
  },
) {
  const context = await resolveTarget(actor, input.target);

  // A profile picture or banner is a still image; a clip would leave the page
  // pointing at something an <img> cannot show.
  if (input.target.type === MediaTargetType.PROFILE) {
    if (input.kind !== MediaKind.PHOTO) {
      throw ApiError.badRequest('A profile picture must be a photo.', 'UNSUPPORTED_MEDIA_TYPE');
    }
    // HEIC is fine for a run photo someone opens later, but most browsers cannot
    // draw it, and a picture that shows as a broken square on your own profile
    // is worse than being asked to pick a different file.
    if (!PROFILE_IMAGE_TYPES.includes(input.mimeType)) {
      throw ApiError.badRequest('Use a JPEG, PNG, WebP or AVIF picture.', 'UNSUPPORTED_MEDIA_TYPE');
    }
  }

  if (!ALLOWED[input.kind].includes(input.mimeType)) {
    throw ApiError.badRequest(`${input.mimeType} is not an accepted ${input.kind.toLowerCase()} format.`, 'UNSUPPORTED_MEDIA_TYPE');
  }
  if (input.sizeBytes > env.media.maxUploadBytes) {
    const mb = Math.floor(env.media.maxUploadBytes / (1024 * 1024));
    throw ApiError.badRequest(`Files must be ${mb}MB or smaller.`, 'FILE_TOO_LARGE');
  }

  // Ch.22 B.2: the offline queue retries with the same clientId, and must not
  // create a second asset.
  if (input.clientId) {
    const existing = await prisma.mediaAsset.findUnique({ where: { clientId: input.clientId }, select: { id: true, storageKey: true, mimeType: true } });
    if (existing) {
      const target = await createUploadTarget(existing.storageKey, existing.mimeType);
      const media = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: existing.id }, select: mediaSelect });
      return { media: serialize(media), upload: { ...target, storageKey: existing.storageKey }, reused: true };
    }
  }

  // Media is filed under the kennel it belongs to. A profile picture, or a reel or
  // post made outside any kennel, has none, and an empty prefix produced keys with
  // a leading slash (and a double slash in the public URL), so those are filed
  // under the person who uploaded them instead.
  const owner = context.kennelId || `users/${actor.id}`;
  const storageKey = buildStorageKey(`${owner}/${input.target.type.toLowerCase()}`, input.mimeType);

  const media = await prisma.$transaction(async (tx) => {
    const created = await tx.mediaAsset.create({
      data: {
        uploaderId: actor.id,
        clientId: input.clientId ?? null,
        kind: input.kind,
        storageKey,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        caption: input.caption?.trim() || null,
        capturedAt: input.capturedAt ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        uploadState: UploadState.QUEUED,
      },
    });
    await tx.mediaLink.create({
      data: { mediaId: created.id, targetType: input.target.type, targetId: input.target.id },
    });
    return tx.mediaAsset.findUniqueOrThrow({ where: { id: created.id }, select: mediaSelect });
  });

  const upload = await createUploadTarget(storageKey, input.mimeType);
  return { media: serialize(media), upload: { ...upload, storageKey }, reused: false };
}

// The client calls this once the PUT to storage succeeded.
export async function confirmUpload(
  actor: Actor,
  mediaId: string,
  input: { width?: number | null; height?: number | null; durationSec?: number | null },
) {
  if (!isUuid(mediaId)) throw ApiError.notFound('Media not found');
  const media = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
    select: { id: true, uploaderId: true, storageKey: true, uploadState: true, links: { select: { targetType: true, targetId: true } } },
  });
  if (!media) throw ApiError.notFound('Media not found');
  if (media.uploaderId !== actor.id) throw ApiError.forbidden('Only the uploader confirms an upload.', 'NOT_UPLOADER');
  if (media.uploadState === UploadState.AVAILABLE) {
    return serialize(await prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId }, select: mediaSelect }));
  }

  const link = media.links[0];
  const context = await resolveTarget(actor, { type: link.targetType, id: link.targetId });
  // A reel posted outside any kennel has no kennel moderation mode to read.
  const kennel = context.kennelId
    ? await prisma.kennel.findUniqueOrThrow({
        where: { id: context.kennelId },
        select: { mediaModerationMode: true },
      })
    : null;

  // BR-RUN-012: the kennel decides whether media appears at once or waits for an
  // officer. Anything other than IMMEDIATE holds it in Processing. Branding is
  // outside that rule (D37): only an admin can upload it, and a kennel logo
  // queued for its own approval would leave the page blank until someone
  // remembered to approve it.
  const immediate =
    IMMEDIATE_TARGETS.includes(link.targetType) || kennel?.mediaModerationMode === MediaModerationMode.IMMEDIATE;
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.mediaAsset.update({
      where: { id: mediaId },
      data: {
        width: input.width ?? null,
        height: input.height ?? null,
        durationSec: input.durationSec ?? null,
        url: publicUrlFor(media.storageKey),
        uploadState: immediate ? UploadState.AVAILABLE : UploadState.PROCESSING,
        moderationState: immediate ? ModerationState.APPROVED : ModerationState.PENDING,
        moderatedAt: immediate ? now : null,
      },
      select: mediaSelect,
    });
    await recordEvent(tx, {
      eventType: 'MediaUploaded',
      aggregateType: 'MediaAsset',
      aggregateId: mediaId,
      actorId: actor.id,
      payload: { kennelId: context.kennelId || null, runId: context.runId, targetType: link.targetType, targetId: link.targetId },
    });
    await recordEvent(tx, {
      eventType: 'MediaLinked',
      aggregateType: 'MediaAsset',
      aggregateId: mediaId,
      actorId: actor.id,
      payload: { targetType: link.targetType, targetId: link.targetId },
    });
    return row;
  });

  return serialize(updated);
}

// ─── Reads ───

export async function listForTarget(
  actor: Actor | undefined,
  target: MediaTarget,
  opts: { page: number; limit: number },
) {
  // Viewing follows the target: if you cannot see the run, you cannot see its photos.
  let canModerate = false;
  if (actor) {
    const context = await resolveTarget(actor, target);
    canModerate = context.canModerate;
  } else {
    if (target.type !== MediaTargetType.RUN) throw ApiError.notFound('Target not found');
    const access = await getAccess(undefined, target.id);
    if (!canView(access)) throw ApiError.notFound('Target not found');
  }

  const where: Prisma.MediaAssetWhereInput = {
    links: { some: { targetType: target.type, targetId: target.id } },
    ...(canModerate
      ? { moderationState: { not: ModerationState.REJECTED } }
      : { uploadState: UploadState.AVAILABLE, moderationState: ModerationState.APPROVED }),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.mediaAsset.findMany({
      where,
      select: mediaSelect,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.mediaAsset.count({ where }),
  ]);
  return { ...page(rows.map(serialize), total, opts.page, opts.limit), canModerate, storageDriver };
}

// ─── Moderation (BR-RUN-012) ───

export async function moderate(actor: Actor, mediaId: string, approve: boolean, reason?: string | null) {
  if (!isUuid(mediaId)) throw ApiError.notFound('Media not found');
  const media = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
    select: { id: true, moderationState: true, links: { select: { targetType: true, targetId: true } } },
  });
  if (!media) throw ApiError.notFound('Media not found');

  const link = media.links[0];
  const context = await resolveTarget(actor, { type: link.targetType, id: link.targetId });
  await assertKennelPermission(actor, context.kennelId, 'media.moderate');

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.mediaAsset.update({
      where: { id: mediaId },
      data: {
        moderationState: approve ? ModerationState.APPROVED : ModerationState.REJECTED,
        uploadState: approve ? UploadState.AVAILABLE : UploadState.PROCESSING,
        moderatedById: actor.id,
        moderatedAt: now,
      },
      select: mediaSelect,
    });
    const event = await recordEvent(tx, {
      eventType: 'MediaModerated',
      aggregateType: 'MediaAsset',
      aggregateId: mediaId,
      actorId: actor.id,
      payload: { approved: approve, ...(reason ? { reason } : {}) },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: approve ? 'media.approve' : 'media.reject',
      resourceType: 'MediaAsset',
      resourceId: mediaId,
      kennelId: context.kennelId,
      previousState: { moderationState: media.moderationState },
      newState: { moderationState: approve ? ModerationState.APPROVED : ModerationState.REJECTED },
      reason: reason?.trim() || null,
      policyRef: 'media.moderate',
      domainEventId: event.id,
    });
    return row;
  });

  return serialize(updated);
}

export async function getMedia(actor: Actor, mediaId: string) {
  if (!isUuid(mediaId)) throw ApiError.notFound('Media not found');
  const media = await prisma.mediaAsset.findUnique({ where: { id: mediaId }, select: mediaSelect });
  if (!media) throw ApiError.notFound('Media not found');
  const link = media.links[0];
  await resolveTarget(actor, { type: link.targetType, id: link.targetId });
  return serialize(media);
}
