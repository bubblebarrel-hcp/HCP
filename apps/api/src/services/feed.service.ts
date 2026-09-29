import { ModerationState, Prisma, RunStatus, RunVisibility, SubjectType, UploadState } from '@prisma/client';
import prisma from '../config/prisma';
import { type Actor } from './permission.service';
import { canView, getAccess, publicName, userPublicSelect } from './run.service';
import * as reports from './report.service';
import * as follows from './follow.service';
import * as stats from './stats.service';
import { resolveVisible, segmentFor } from './subject.service';

// The community feed (Ch.9 Part 4): what hashers have made, from everywhere,
// newest first. Two kinds of thing so far — published trail reports and the
// photos hashers put on their runs — merged into one stream rather than a wall
// of kennels, which the directory already does better (D42).
//
// Ranking is recency. The Bible asks for relevance over recency eventually
// (BR-CXP-012), and that wants a signal this platform does not collect yet;
// nothing here forecloses it.

// A photo on a post, as the card shows it.
export interface FeedPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
}

export type FeedItem =
  | {
      // A run the kennel is announcing: the flyer that lands in WhatsApp today,
      // as something people can actually answer (D43).
      kind: 'RUN';
      id: string;
      at: Date;
      runNumber: number | null;
      title: string;
      theme: string | null;
      description: string | null;
      startsAt: Date;
      timeZone: string;
      meetingPointName: string | null;
      meetingAddress: string | null;
      city: string;
      country: string;
      hashCash: string | null;
      posterUrl: string | null;
      hares: string[];
      goingCount: number;
      // True once the start time has passed and the run is still going.
      happeningNow: boolean;
      kennel: { slug: string; shortName: string; primaryColor: string | null } | null;
    }
  | {
      kind: 'REPORT';
      id: string;
      at: Date;
      title: string;
      excerpt: string | null;
      kennel: { slug: string; shortName: string; primaryColor: string | null } | null;
      run: { id: string; runNumber: number | null; title: string | null } | null;
      author: string | null;
      // The scribe's id, so a card can link to them and the following feed can
      // tell whose work this is (D50).
      authorId: string | null;
      coverUrl: string | null;
    }
  | {
      kind: 'PHOTO';
      id: string;
      at: Date;
      caption: string | null;
      url: string;
      thumbnailUrl: string | null;
      width: number | null;
      height: number | null;
      kennel: { slug: string; shortName: string; primaryColor: string | null } | null;
      run: { id: string; runNumber: number | null; title: string | null } | null;
      author: string | null;
      authorId: string | null;
      authorAvatarUrl: string | null;
    }
  | {
      // A hasher's own words, straight from the composer (D51).
      kind: 'POST';
      id: string;
      at: Date;
      body: string;
      edited: boolean;
      author: string | null;
      authorId: string | null;
      authorAvatarUrl: string | null;
      photos: FeedPhoto[];
      kennel: { slug: string; shortName: string; primaryColor: string | null } | null;
      run: { id: string; runNumber: number | null; title: string | null } | null;
    }
  | {
      // Somebody passing on somebody else's post, with something of their own
      // on top (D50). The card is the sharer's; the quote inside it is not.
      kind: 'RESHARE';
      id: string;
      at: Date;
      commentary: string | null;
      sharer: { id: string; name: string; avatarUrl: string | null };
      // The engagement bar on this card acts on the original, not on the
      // wrapper: a like belongs to whoever made the thing.
      subjectType: SubjectType;
      subjectSegment: string;
      subjectId: string;
      original: SubjectPreview | null;
      kennel: { slug: string; shortName: string; primaryColor: string | null } | null;
    };

// A quote of somebody else's post, small enough to sit inside another card.
export interface SubjectPreview {
  type: SubjectType;
  segment: string;
  id: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  author: string | null;
  href: string;
  kennel: { slug: string; shortName: string; primaryColor: string | null } | null;
}

// A feed card as it leaves the API: the item, plus what people have done to it.
export type FeedEntry = FeedItem & { engagement: stats.Engagement };

// Which subject each kind of card is engagement-wise. A reshare points at what
// it quotes, so liking a reshared report likes the report.
function subjectOf(item: FeedItem): { type: SubjectType; id: string } {
  switch (item.kind) {
    case 'REPORT':
      return { type: SubjectType.TRAIL_REPORT, id: item.id };
    case 'PHOTO':
      return { type: SubjectType.MEDIA_ASSET, id: item.id };
    case 'RUN':
      return { type: SubjectType.RUN, id: item.id };
    case 'POST':
      return { type: SubjectType.POST, id: item.id };
    case 'RESHARE':
      return { type: item.subjectType, id: item.subjectId };
  }
}

// Over-fetch each source, filter by what this viewer may see, then merge. The
// alternative is a union view in SQL that would have to re-implement run
// visibility, which is exactly the thing that must live in one place.
const OVER_FETCH = 4;

// How many photos from one run may share a page of the feed.
const MAX_PHOTOS_PER_RUN = 2;

// One announcement per kennel per page. A kennel with six runs booked is not
// six pieces of news, and the card lists the rest under "Future runs" anyway.
const MAX_RUNS_PER_KENNEL = 1;

async function recentPhotos(actor: Actor | undefined, limit: number): Promise<FeedItem[]> {
  const where: Prisma.MediaAssetWhereInput = {
    kind: 'PHOTO',
    uploadState: UploadState.AVAILABLE,
    moderationState: ModerationState.APPROVED,
    url: { not: null },
    // Photos of a run or its circle. Kennel branding and reel videos are not
    // feed material, and a gallery has no run to check visibility against yet.
    links: { some: { targetType: { in: ['RUN', 'CIRCLE', 'TRAIL'] } } },
  };

  const rows = await prisma.mediaAsset.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit * OVER_FETCH,
    select: {
      id: true,
      url: true,
      thumbnailUrl: true,
      caption: true,
      width: true,
      height: true,
      createdAt: true,
      uploader: { select: { ...userPublicSelect, avatarUrl: true } },
      links: { select: { targetType: true, targetId: true } },
    },
  });

  const items: FeedItem[] = [];
  // One run's photo dump must not become the whole feed. BR-CXP-012 asks for
  // meaningful participation over volume; the cheapest honest version of that
  // is a cap per run, with the rest still on the run's own page.
  const perRun = new Map<string, number>();

  for (const row of rows) {
    // A photo is visible exactly when the run it belongs to is.
    const link = row.links.find((l) => l.targetType === 'RUN');
    if (!link) continue;
    if ((perRun.get(link.targetId) ?? 0) >= MAX_PHOTOS_PER_RUN) continue;
    const access = await getAccess(actor, link.targetId);
    if (!canView(access)) continue;
    if (!row.url) continue;
    perRun.set(link.targetId, (perRun.get(link.targetId) ?? 0) + 1);

    items.push({
      kind: 'PHOTO',
      id: row.id,
      at: row.createdAt,
      caption: row.caption,
      url: row.url,
      thumbnailUrl: row.thumbnailUrl,
      width: row.width,
      height: row.height,
      // The colour is filled in for the whole page at the end, because the run
      // access shape does not carry it and one query beats one per photo.
      kennel: access.run.kennel
        ? { slug: access.run.kennel.slug, shortName: access.run.kennel.shortName, primaryColor: null }
        : null,
      run: { id: access.run.id, runNumber: access.run.runNumber, title: access.run.title },
      author: row.uploader ? publicName(row.uploader) : null,
      authorId: row.uploader?.id ?? null,
      authorAvatarUrl: row.uploader?.avatarUrl ?? null,
    });
  }
  return items;
}

// Runs that have been announced and have not finished. A run is announced when
// it leaves Draft, which is the moment the kennel meant to tell people, and it
// stays on the feed while it is happening: a hasher reading at four o'clock is
// exactly the person who still wants to see it (D43).
const STILL_RUNNING_HOURS = 6;
const ANNOUNCED: RunStatus[] = [
  RunStatus.SCHEDULED,
  RunStatus.PLANNING,
  RunStatus.TRAIL_HIDDEN,
  RunStatus.TRAIL_RELEASED,
  RunStatus.CHECK_IN_OPEN,
  RunStatus.LIVE,
  RunStatus.CIRCLE,
];

async function upcomingRuns(actor: Actor | undefined, limit: number): Promise<FeedItem[]> {
  const rows = await prisma.run.findMany({
    where: {
      status: { in: ANNOUNCED },
      cancelledAt: null,
      startsAt: { gte: new Date(Date.now() - STILL_RUNNING_HOURS * 60 * 60 * 1000) },
      // A run nobody outside the kennel may see is not an announcement; the
      // per-run check below still runs, this only keeps the page cheap.
      ...(actor ? {} : { visibility: RunVisibility.PUBLIC }),
    },
    orderBy: { startsAt: 'asc' },
    take: limit * OVER_FETCH,
    select: {
      id: true,
      runNumber: true,
      title: true,
      theme: true,
      description: true,
      startsAt: true,
      timeZone: true,
      meetingPointName: true,
      meetingAddress: true,
      city: true,
      country: true,
      hashCash: true,
      posterUrl: true,
      scheduledAt: true,
      createdAt: true,
      kennelId: true,
      kennel: { select: { slug: true, shortName: true, primaryColor: true } },
      // Lead first, then in the order the kennel named them — a flyer's
      // hare list is not alphabetical.
      hares: {
        orderBy: [{ isLead: 'desc' }, { addedAt: 'asc' }],
        select: { isLead: true, user: { select: userPublicSelect } },
      },
      _count: { select: { participations: { where: { rsvpStatus: 'GOING' } } } },
    },
  });

  const items: FeedItem[] = [];
  const perKennel = new Map<string, number>();

  for (const row of rows) {
    if ((perKennel.get(row.kennelId) ?? 0) >= MAX_RUNS_PER_KENNEL) continue;
    const access = await getAccess(actor, row.id);
    if (!canView(access)) continue;
    perKennel.set(row.kennelId, (perKennel.get(row.kennelId) ?? 0) + 1);

    items.push({
      kind: 'RUN',
      id: row.id,
      // An announcement is news when it was announced, not when the run is.
      at: row.scheduledAt ?? row.createdAt,
      runNumber: row.runNumber,
      title: row.title,
      theme: row.theme,
      description: row.description,
      startsAt: row.startsAt,
      timeZone: row.timeZone,
      meetingPointName: row.meetingPointName,
      meetingAddress: row.meetingAddress,
      city: row.city,
      country: row.country,
      hashCash: row.hashCash,
      posterUrl: row.posterUrl,
      hares: row.hares.map((h) => publicName(h.user)),
      goingCount: row._count.participations,
      happeningNow: row.startsAt.getTime() <= Date.now(),
      kennel: row.kennel,
    });
  }
  return items;
}

// Posts (D51). A post is always public, so unlike every other source here
// there is nothing to filter per viewer and no need to over-fetch — what the
// query returns is what goes on the page.
async function recentPosts(limit: number): Promise<FeedItem[]> {
  const rows = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      body: true,
      publishedAt: true,
      editedAt: true,
      createdAt: true,
      author: { select: { ...userPublicSelect, avatarUrl: true } },
      kennel: { select: { slug: true, shortName: true, primaryColor: true } },
      run: { select: { id: true, runNumber: true, title: true } },
    },
  });
  if (rows.length === 0) return [];

  const links = await prisma.mediaLink.findMany({
    where: { targetType: 'POST', targetId: { in: rows.map((r) => r.id) } },
    orderBy: { createdAt: 'asc' },
    select: {
      targetId: true,
      media: {
        select: {
          id: true,
          url: true,
          thumbnailUrl: true,
          width: true,
          height: true,
          uploadState: true,
          moderationState: true,
        },
      },
    },
  });
  const photosByPost = new Map<string, FeedPhoto[]>();
  for (const link of links) {
    const media = link.media;
    if (media.uploadState !== UploadState.AVAILABLE) continue;
    if (media.moderationState === ModerationState.REJECTED) continue;
    if (!media.url) continue;
    const list = photosByPost.get(link.targetId) ?? [];
    list.push({
      id: media.id,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl,
      width: media.width,
      height: media.height,
    });
    photosByPost.set(link.targetId, list);
  }

  return rows.map((row) => ({
    kind: 'POST' as const,
    id: row.id,
    at: row.publishedAt ?? row.createdAt,
    body: row.body,
    edited: Boolean(row.editedAt),
    author: publicName(row.author),
    authorId: row.author.id,
    authorAvatarUrl: row.author.avatarUrl,
    photos: photosByPost.get(row.id) ?? [],
    kennel: row.kennel,
    run: row.run,
  }));
}

// ─── Reshares (D50) ───

// Build the quote inside a reshare card. Everything here is read straight from
// the database rather than through each thing's own service, because the
// visibility decision has already been made by `resolveVisible` before this
// runs — this only fills in what a quote card shows.
async function previewsFor(refs: { type: SubjectType; id: string }[]): Promise<Map<string, SubjectPreview>> {
  const out = new Map<string, SubjectPreview>();
  if (refs.length === 0) return out;

  const idsOf = (type: SubjectType) => refs.filter((r) => r.type === type).map((r) => r.id);
  const key = (type: SubjectType, id: string) => `${type}:${id}`;

  const [reels, reportRows, media, runs, capsules, hasherPosts] = await Promise.all([
    idsOf(SubjectType.REEL).length
      ? prisma.reel.findMany({
          where: { id: { in: idsOf(SubjectType.REEL) } },
          select: {
            id: true,
            caption: true,
            author: { select: userPublicSelect },
            kennel: { select: { slug: true, shortName: true, primaryColor: true } },
            media: { select: { thumbnailUrl: true, url: true, kind: true } },
          },
        })
      : [],
    idsOf(SubjectType.TRAIL_REPORT).length
      ? prisma.trailReport.findMany({
          where: { id: { in: idsOf(SubjectType.TRAIL_REPORT) } },
          select: {
            id: true,
            title: true,
            body: true,
            officialScribe: { select: userPublicSelect },
            run: {
              select: { posterUrl: true, kennel: { select: { slug: true, shortName: true, primaryColor: true } } },
            },
          },
        })
      : [],
    idsOf(SubjectType.MEDIA_ASSET).length
      ? prisma.mediaAsset.findMany({
          where: { id: { in: idsOf(SubjectType.MEDIA_ASSET) } },
          select: {
            id: true,
            caption: true,
            url: true,
            thumbnailUrl: true,
            uploader: { select: userPublicSelect },
            links: { select: { targetType: true, targetId: true } },
          },
        })
      : [],
    idsOf(SubjectType.RUN).length
      ? prisma.run.findMany({
          where: { id: { in: idsOf(SubjectType.RUN) } },
          select: {
            id: true,
            runNumber: true,
            title: true,
            theme: true,
            posterUrl: true,
            kennel: { select: { slug: true, shortName: true, primaryColor: true } },
          },
        })
      : [],
    idsOf(SubjectType.RUN_CAPSULE).length
      ? prisma.runCapsule.findMany({
          where: { id: { in: idsOf(SubjectType.RUN_CAPSULE) } },
          select: {
            id: true,
            run: {
              select: {
                runNumber: true,
                title: true,
                kennel: { select: { slug: true, shortName: true, primaryColor: true } },
              },
            },
          },
        })
      : [],
    idsOf(SubjectType.POST).length
      ? prisma.post.findMany({
          where: { id: { in: idsOf(SubjectType.POST) } },
          select: {
            id: true,
            body: true,
            author: { select: userPublicSelect },
            kennel: { select: { slug: true, shortName: true, primaryColor: true } },
          },
        })
      : [],
  ]);

  for (const reel of reels) {
    out.set(key(SubjectType.REEL, reel.id), {
      type: SubjectType.REEL,
      segment: segmentFor(SubjectType.REEL),
      id: reel.id,
      title: reel.caption || 'A reel',
      excerpt: null,
      // A video has no frame grab yet (D41), so the poster is whatever the
      // cover asset carries and null is an honest answer.
      imageUrl: reel.media?.thumbnailUrl ?? (reel.media?.kind === 'PHOTO' ? reel.media.url : null),
      author: publicName(reel.author),
      href: `/reels?reel=${reel.id}`,
      kennel: reel.kennel ? { slug: reel.kennel.slug, shortName: reel.kennel.shortName, primaryColor: reel.kennel.primaryColor } : null,
    });
  }
  for (const report of reportRows) {
    out.set(key(SubjectType.TRAIL_REPORT, report.id), {
      type: SubjectType.TRAIL_REPORT,
      segment: segmentFor(SubjectType.TRAIL_REPORT),
      id: report.id,
      title: report.title,
      excerpt: excerptOf(report.body),
      // Same fallback as the report's own feed card: no photo of its own yet,
      // so the run's flyer carries the visual instead of the quote going bare.
      imageUrl: report.run?.posterUrl ?? null,
      author: publicName(report.officialScribe),
      href: `/reports/${report.id}`,
      kennel: report.run.kennel,
    });
  }
  for (const asset of media) {
    const runLink = asset.links.find((l) => l.targetType === 'RUN');
    out.set(key(SubjectType.MEDIA_ASSET, asset.id), {
      type: SubjectType.MEDIA_ASSET,
      segment: segmentFor(SubjectType.MEDIA_ASSET),
      id: asset.id,
      title: asset.caption || 'A photo',
      excerpt: null,
      imageUrl: asset.thumbnailUrl ?? asset.url,
      author: asset.uploader ? publicName(asset.uploader) : null,
      href: runLink ? `/runs/${runLink.targetId}` : '/',
      kennel: null,
    });
  }
  for (const run of runs) {
    out.set(key(SubjectType.RUN, run.id), {
      type: SubjectType.RUN,
      segment: segmentFor(SubjectType.RUN),
      id: run.id,
      title: run.runNumber ? `Run #${run.runNumber} ${run.title}` : run.title,
      excerpt: run.theme,
      imageUrl: run.posterUrl,
      author: null,
      href: `/runs/${run.id}`,
      kennel: run.kennel,
    });
  }
  for (const post of hasherPosts) {
    out.set(key(SubjectType.POST, post.id), {
      type: SubjectType.POST,
      segment: segmentFor(SubjectType.POST),
      id: post.id,
      // A post has no title, so the quote card names who wrote it and shows the
      // words themselves rather than inventing a headline out of them.
      title: publicName(post.author),
      excerpt: excerptOf(post.body),
      imageUrl: null,
      author: publicName(post.author),
      href: `/posts/${post.id}`,
      kennel: post.kennel,
    });
  }
  for (const capsule of capsules) {
    out.set(key(SubjectType.RUN_CAPSULE, capsule.id), {
      type: SubjectType.RUN_CAPSULE,
      segment: segmentFor(SubjectType.RUN_CAPSULE),
      id: capsule.id,
      title: capsule.run.runNumber ? `Run #${capsule.run.runNumber} Capsule` : 'A Run Capsule',
      excerpt: capsule.run.title,
      imageUrl: null,
      author: null,
      href: `/capsules/${capsule.id}`,
      kennel: capsule.run.kennel,
    });
  }

  return out;
}

async function recentReshares(actor: Actor | undefined, limit: number): Promise<FeedItem[]> {
  // Nothing anonymous here would be wrong, but a reshare of a members-only run
  // has to be dropped for a signed-out reader, and that check is per row.
  const rows = await prisma.contentReshare.findMany({
    where: { undoneAt: null },
    orderBy: { createdAt: 'desc' },
    take: limit * OVER_FETCH,
    select: {
      id: true,
      subjectType: true,
      subjectId: true,
      commentary: true,
      createdAt: true,
      sharer: { select: { ...userPublicSelect, avatarUrl: true } },
    },
  });
  if (rows.length === 0) return [];

  // The subject decides who may see the reshare; a reshare opens no doors.
  const visible = await resolveVisible(
    actor,
    rows.map((r) => ({ type: r.subjectType, id: r.subjectId })),
  );
  const kept = rows.filter((r) => visible.has(`${r.subjectType}:${r.subjectId}`));
  const previews = await previewsFor(kept.map((r) => ({ type: r.subjectType, id: r.subjectId })));

  return kept.map((row) => {
    const preview = previews.get(`${row.subjectType}:${row.subjectId}`) ?? null;
    return {
      kind: 'RESHARE' as const,
      id: row.id,
      at: row.createdAt,
      commentary: row.commentary,
      sharer: { id: row.sharer.id, name: publicName(row.sharer), avatarUrl: row.sharer.avatarUrl },
      subjectType: row.subjectType,
      subjectSegment: segmentFor(row.subjectType),
      subjectId: row.subjectId,
      original: preview,
      kennel: preview?.kennel ?? null,
    };
  });
}

// A card wants a taste of the story, not the story. The published body is
// plain text with paragraph breaks, so the first couple of lines do.
function excerptOf(body: string | null) {
  if (!body) return null;
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 220 ? `${flat.slice(0, 219).trimEnd()}…` : flat;
}

// Two feeds, one pipeline. "Everything" is the home page (D42); "following" is
// the same stream narrowed to the hashers and kennels this reader chose (D50).
export type FeedScope = 'ALL' | 'FOLLOWING';

export async function list(actor: Actor | undefined, opts: { page: number; limit: number; scope?: FeedScope }) {
  const scope: FeedScope = opts.scope ?? 'ALL';
  // Nobody signed out follows anybody, so the narrow feed is empty rather than
  // secretly the wide one.
  const graph = scope === 'FOLLOWING' && actor ? await follows.followedBy(actor.id) : null;
  if (scope === 'FOLLOWING' && !graph) {
    return { items: [] as FeedEntry[], hasMore: false, page: opts.page, limit: opts.limit, scope };
  }
  const followedUsers = new Set(graph?.userIds ?? []);
  const followedKennels = new Set(graph?.kennelIds ?? []);

  // Reports already know how to filter themselves by run visibility, so the
  // feed asks them rather than re-deriving who may read what.
  const reported = await reports.listPublished(actor, { page: 1, limit: opts.limit * OVER_FETCH });

  // The list view leaves the body out and the kennel's colour is not in its
  // shape, so both are fetched once for the page rather than per card.
  const reportIds = reported.items.map((r) => r.id);
  const runIds = [...new Set(reported.items.map((r) => r.run?.id).filter(Boolean) as string[])];
  const slugs = [...new Set(reported.items.map((r) => r.run?.kennel?.slug).filter(Boolean) as string[])];
  const [bodies, kennels, runPosters] = await Promise.all([
    reportIds.length
      ? prisma.trailReport.findMany({ where: { id: { in: reportIds } }, select: { id: true, body: true } })
      : Promise.resolve([]),
    slugs.length
      ? prisma.kennel.findMany({ where: { slug: { in: slugs } }, select: { slug: true, primaryColor: true } })
      : Promise.resolve([]),
    // A report has no photo of its own yet, but a run's flyer is exactly the
    // kind of "visual attraction that catches the eye" a feed card wants, and
    // it already exists the moment the run was announced — falling back to it
    // costs nothing and a report never has to go uncovered while a kennel is
    // still building the habit of adding photos.
    runIds.length
      ? prisma.run.findMany({ where: { id: { in: runIds } }, select: { id: true, posterUrl: true } })
      : Promise.resolve([]),
  ]);
  const bodyById = new Map(bodies.map((b) => [b.id, b.body]));
  const colourBySlug = new Map(kennels.map((k) => [k.slug, k.primaryColor]));
  const posterByRunId = new Map(runPosters.map((r) => [r.id, r.posterUrl]));

  const asReports: FeedItem[] = reported.items.map((r) => ({
    kind: 'REPORT',
    id: r.id,
    at: new Date(r.publishedAt ?? r.createdAt),
    title: r.title,
    excerpt: excerptOf(bodyById.get(r.id) ?? null),
    kennel: r.run?.kennel
      ? {
          slug: r.run.kennel.slug,
          shortName: r.run.kennel.shortName,
          primaryColor: colourBySlug.get(r.run.kennel.slug) ?? null,
        }
      : null,
    run: r.run ? { id: r.run.id, runNumber: r.run.runNumber, title: r.run.title } : null,
    author: r.scribe ?? null,
    authorId: r.scribeId ?? null,
    coverUrl: (r.run?.id ? posterByRunId.get(r.run.id) : null) ?? null,
  }));

  const [photos, runs, reshares, hasherPosts] = await Promise.all([
    recentPhotos(actor, opts.limit),
    upcomingRuns(actor, opts.limit),
    recentReshares(actor, opts.limit),
    recentPosts(opts.limit),
  ]);

  let merged = [...asReports, ...photos, ...runs, ...reshares, ...hasherPosts].sort(
    (a, b) => b.at.getTime() - a.at.getTime(),
  );

  if (scope === 'FOLLOWING') {
    // Kennels are followed by id but carried on a card by slug, so the ids are
    // turned into slugs once rather than per card.
    const slugs = followedKennels.size
      ? await prisma.kennel.findMany({ where: { id: { in: [...followedKennels] } }, select: { slug: true } })
      : [];
    const followedSlugs = new Set(slugs.map((k) => k.slug));

    merged = merged.filter((item) => {
      if (item.kennel && followedSlugs.has(item.kennel.slug)) return true;
      switch (item.kind) {
        case 'REPORT':
        case 'PHOTO':
        case 'POST':
          return Boolean(item.authorId && followedUsers.has(item.authorId));
        case 'RESHARE':
          // Your own reshares belong in your feed: you put them there.
          return followedUsers.has(item.sharer.id) || item.sharer.id === actor?.id;
        // A run is a kennel's announcement and has no author to follow.
        case 'RUN':
          return false;
      }
    });
  }

  const start = (opts.page - 1) * opts.limit;
  const items = merged.slice(start, start + opts.limit);

  // Fill in the brand colour for any kennel the photo pass could not carry.
  const missing = [...new Set(items.map((i) => i.kennel?.slug).filter((s): s is string => Boolean(s)))].filter(
    (slug) => !colourBySlug.has(slug),
  );
  if (missing.length) {
    const more = await prisma.kennel.findMany({
      where: { slug: { in: missing } },
      select: { slug: true, primaryColor: true },
    });
    for (const k of more) colourBySlug.set(k.slug, k.primaryColor);
  }
  for (const item of items) {
    if (item.kennel && item.kennel.primaryColor === null) {
      item.kennel.primaryColor = colourBySlug.get(item.kennel.slug) ?? null;
    }
  }

  // The numbers under every card, in one pass for the page (D50).
  const engagement = await stats.engagementFor(actor?.id, items.map(subjectOf));
  const entries: FeedEntry[] = items.map((item) => {
    const ref = subjectOf(item);
    return { ...item, engagement: engagement.get(stats.subjectKey(ref.type, ref.id)) ?? { ...stats.EMPTY } };
  });

  return {
    items: entries,
    // What was merged, not what exists: an honest "there is more" rather than a
    // count this cannot compute without reading everything.
    hasMore: merged.length > start + opts.limit,
    page: opts.page,
    limit: opts.limit,
    scope,
  };
}
