import { MediaTargetType, ModerationState, UploadState } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, page } from '../utils/http';
import { contentVisibleAuthors } from './audience.service';
import { type Actor } from './permission.service';
import { canView, getAccess } from './run.service';

// The Photos tab on a kennel's page: every photo hashers put on one of this
// kennel's runs, newest first. A photo answers to the run it is on, so a
// members-only run's pictures stay with its members, and to the person who took
// it, so a locked profile's photos stay with its followers (D57).
//
// Collected and filtered in memory, the way a hasher's own grid is: a kennel's
// photos number in the hundreds, and paging the database then dropping rows
// would give pages that are short for reasons nobody can see.

export interface KennelPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  takenAt: Date;
  run: { id: string; runNumber: number | null; title: string };
}

export async function listPhotos(actor: Actor | undefined, slug: string, opts: { page: number; limit: number }) {
  const kennel = await prisma.kennel.findUnique({ where: { slug }, select: { id: true } });
  if (!kennel) throw ApiError.notFound('Kennel not found', 'KENNEL_NOT_FOUND');

  const runs = await prisma.run.findMany({ where: { kennelId: kennel.id }, select: { id: true } });
  const assets = await prisma.mediaAsset.findMany({
    where: {
      kind: 'PHOTO',
      uploadState: UploadState.AVAILABLE,
      moderationState: ModerationState.APPROVED,
      url: { not: null },
      links: { some: { targetType: MediaTargetType.RUN, targetId: { in: runs.map((r) => r.id) } } },
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
      uploaderId: true,
      links: { where: { targetType: MediaTargetType.RUN }, select: { targetId: true } },
    },
  });

  const readable = await contentVisibleAuthors(
    actor,
    assets.map((a) => a.uploaderId).filter((id): id is string => Boolean(id)),
  );

  // One access check per run, not per photo.
  const runAccess = new Map<string, Awaited<ReturnType<typeof getAccess>> | null>();
  const visible: KennelPhoto[] = [];
  for (const asset of assets) {
    if (!asset.url) continue;
    if (asset.uploaderId && !readable.has(asset.uploaderId)) continue;
    const runId = asset.links[0]?.targetId;
    if (!runId) continue;
    if (!runAccess.has(runId)) {
      const access = await getAccess(actor, runId);
      runAccess.set(runId, canView(access) ? access : null);
    }
    const access = runAccess.get(runId);
    if (!access) continue;
    visible.push({
      id: asset.id,
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl,
      width: asset.width,
      height: asset.height,
      caption: asset.caption,
      takenAt: asset.createdAt,
      run: { id: access.run.id, runNumber: access.run.runNumber, title: access.run.title },
    });
  }

  const start = (opts.page - 1) * opts.limit;
  return page(visible.slice(start, start + opts.limit), visible.length, opts.page, opts.limit);
}
