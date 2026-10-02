import { MediaTargetType, ModerationState, PostStatus, ReelStatus, UploadState } from '@prisma/client';
import prisma from '../config/prisma';
import { page } from '../utils/http';
import { canSeeContentOf } from './audience.service';
import { followableUser } from './follow.service';
import { type Actor } from './permission.service';
import { canSee as canSeeReel } from './reel.service';
import { canView, getAccess } from './run.service';

// The photo grid on a hasher's page (D57): every picture they took, in one place,
// newest first, the way a profile reads on a phone.
//
// "Theirs" means they uploaded it, wherever it went: onto one of their posts,
// into one of their reels, or onto a run. Each still answers to the thing it is
// on, so a photo of a members-only run stays with that run's members and a reel
// narrowed to its author stays with its author. On top of that sits the profile
// itself: a locked profile shows its photos only to the followers it approved.
//
// The photos are collected and filtered in memory and the page is cut from
// what survives. A hasher's photos number in the hundreds at most, and the
// alternative, paging the database and then dropping rows, makes a page
// that is short for reasons nobody can see.

export interface ProfilePhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  takenAt: Date;
  // What it is on, so a tile can open the post, reel or run it belongs to.
  source: { type: 'POST' | 'REEL' | 'RUN'; id: string };
}

const SOURCES: MediaTargetType[] = [MediaTargetType.POST, MediaTargetType.REEL, MediaTargetType.RUN];

export async function listPhotos(actor: Actor | undefined, userId: string, opts: { page: number; limit: number }) {
  const user = await followableUser(actor, userId);

  // The profile decides first; nothing below runs for a viewer who is shut out.
  if (!(await canSeeContentOf(actor, user.id))) {
    return { ...page<ProfilePhoto>([], 0, opts.page, opts.limit), locked: true };
  }

  const assets = await prisma.mediaAsset.findMany({
    where: {
      uploaderId: user.id,
      kind: 'PHOTO',
      uploadState: UploadState.AVAILABLE,
      moderationState: { not: ModerationState.REJECTED },
      url: { not: null },
      links: { some: { targetType: { in: SOURCES } } },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      url: true,
      thumbnailUrl: true,
      width: true,
      height: true,
      caption: true,
      createdAt: true,
      links: { select: { targetType: true, targetId: true } },
    },
  });

  const isMe = actor?.id === user.id;
  const idsOf = (type: MediaTargetType) => [
    ...new Set(assets.flatMap((a) => a.links.filter((l) => l.targetType === type).map((l) => l.targetId))),
  ];

  // One read per kind, not per photo.
  const [posts, reels] = await Promise.all([
    prisma.post.findMany({
      where: { id: { in: idsOf(MediaTargetType.POST) }, authorId: user.id },
      select: { id: true, status: true },
    }),
    prisma.reel.findMany({
      where: { id: { in: idsOf(MediaTargetType.REEL) }, authorId: user.id },
      select: { id: true, status: true, visibility: true, kennelId: true, runId: true, authorId: true },
    }),
  ]);
  const publishedPosts = new Set(
    posts.filter((p) => p.status === PostStatus.PUBLISHED || (isMe && p.status !== PostStatus.REMOVED)).map((p) => p.id),
  );
  const reelById = new Map(reels.map((r) => [r.id, r]));
  const reelOk = new Map<string, boolean>();
  for (const reel of reels) {
    const standing = reel.status === ReelStatus.PUBLISHED || (isMe && reel.status !== ReelStatus.REMOVED);
    reelOk.set(reel.id, standing && (await canSeeReel(actor, reel)));
  }
  const runOk = new Map<string, boolean>();
  for (const runId of idsOf(MediaTargetType.RUN)) {
    runOk.set(runId, canView(await getAccess(actor, runId)));
  }

  const visible: ProfilePhoto[] = [];
  for (const asset of assets) {
    if (!asset.url) continue;
    // A photo can be linked to more than one thing; it shows once, on the first
    // one this viewer is allowed to see, in the order post, reel, run.
    let source: ProfilePhoto['source'] | null = null;
    for (const type of SOURCES) {
      const link = asset.links.find((l) => l.targetType === type);
      if (!link) continue;
      const ok =
        type === MediaTargetType.POST
          ? publishedPosts.has(link.targetId)
          : type === MediaTargetType.REEL
            ? reelById.has(link.targetId) && reelOk.get(link.targetId) === true
            : runOk.get(link.targetId) === true;
      if (ok) {
        source = { type: type as 'POST' | 'REEL' | 'RUN', id: link.targetId };
        break;
      }
    }
    if (!source) continue;
    visible.push({
      id: asset.id,
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl,
      width: asset.width,
      height: asset.height,
      caption: asset.caption,
      takenAt: asset.createdAt,
      source,
    });
  }

  const start = (opts.page - 1) * opts.limit;
  return {
    ...page(visible.slice(start, start + opts.limit), visible.length, opts.page, opts.limit),
    locked: false,
  };
}
