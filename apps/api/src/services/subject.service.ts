import { MediaTargetType, ModerationState, SubjectType, UploadState } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid } from '../utils/http';
import { type Actor } from './permission.service';
import { canSee as canSeeReel, reelIsLive } from './reel.service';
import { canSeeAudience, canSeeContentOf } from './audience.service';
import { canView, getAccess } from './run.service';

// Who may engage with what (D50).
//
// Engagement is polymorphic, so without this file every one of like, comment,
// reshare, bookmark and view would have to re-derive trail secrecy, run
// visibility and draft privacy for five kinds of thing. They re-derive nothing:
// they call `resolveSubject`, which either returns the subject's context or
// throws the same 404 the thing's own endpoint would.
//
// 404 and not 403 throughout: a members-only run must not become findable by
// liking it.

export interface SubjectContext {
  type: SubjectType;
  id: string;
  // Who made it, and so who hears about a like or a comment. Null when nobody
  // in particular did — a run belongs to a kennel, not to a person.
  authorId: string | null;
  // Which kennel's moderators police comments here. Null is normal: a reel
  // posted to no kennel is policed by platform staff.
  kennelId: string | null;
  // What a notification calls it, and what a bookmark list shows.
  label: string;
  // Where it lives on the web, for the notification's link.
  href: string;
}

// The URL segment each type is addressed by. Callers speak paths; the database
// speaks enum.
const BY_SEGMENT: Record<string, SubjectType> = {
  reels: SubjectType.REEL,
  posts: SubjectType.POST,
  reports: SubjectType.TRAIL_REPORT,
  photos: SubjectType.MEDIA_ASSET,
  runs: SubjectType.RUN,
  capsules: SubjectType.RUN_CAPSULE,
  comments: SubjectType.COMMENT,
};

export const SUBJECT_SEGMENTS = Object.keys(BY_SEGMENT);

export function subjectTypeFromSegment(segment: string): SubjectType {
  const type = BY_SEGMENT[segment];
  if (!type) throw ApiError.notFound('Not found');
  return type;
}

export function segmentFor(type: SubjectType): string {
  const found = Object.entries(BY_SEGMENT).find(([, value]) => value === type);
  return found ? found[0] : 'reels';
}

// ─── Per-type resolution ───

async function resolveReel(actor: Actor | undefined, id: string): Promise<SubjectContext> {
  const reel = await prisma.reel.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      kennelId: true,
      runId: true,
      visibility: true,
      status: true,
      caption: true,
      publishedAt: true,
      pinnedAt: true,
    },
  });
  if (!reel) throw ApiError.notFound('Reel not found');
  // A draft is the author's alone, and a removed or deleted reel is nobody's to
  // applaud.
  const mine = actor?.id === reel.authorId;
  if (reel.status === 'REMOVED' || reel.status === 'DELETED') throw ApiError.notFound('Reel not found');
  if (reel.status !== 'PUBLISHED' && !mine) throw ApiError.notFound('Reel not found');
  // Past its 24 hours and not pinned (D58): gone, so it cannot be liked,
  // commented on, reshared or saved by link, its author included.
  if (reel.status === 'PUBLISHED' && !reelIsLive(reel)) throw ApiError.notFound('Reel not found');
  if (!(await canSeeReel(actor, reel))) throw ApiError.notFound('Reel not found');
  return {
    type: SubjectType.REEL,
    id: reel.id,
    authorId: reel.authorId,
    kennelId: reel.kennelId,
    label: reel.caption?.slice(0, 60) || 'a reel',
    href: `/reels/${reel.id}`,
  };
}

// A hasher's written post (D51). It is as visible as its author's profile (D57),
// and only while it is still standing.
async function resolvePost(actor: Actor | undefined, id: string): Promise<SubjectContext> {
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true, kennelId: true, status: true, body: true, visibility: true },
  });
  if (!post) throw ApiError.notFound('Post not found');
  const mine = actor?.id === post.authorId;
  if (post.status === 'REMOVED') throw ApiError.notFound('Post not found');
  if (post.status !== 'PUBLISHED' && !mine) throw ApiError.notFound('Post not found');
  if (!mine && !(await canSeeAudience(actor, post.authorId, post.visibility))) throw ApiError.notFound('Post not found');
  return {
    type: SubjectType.POST,
    id: post.id,
    authorId: post.authorId,
    kennelId: post.kennelId,
    label: post.body.replace(/\s+/g, ' ').trim().slice(0, 60) || 'a post',
    href: `/posts/${post.id}`,
  };
}

async function resolveReport(actor: Actor | undefined, id: string): Promise<SubjectContext> {
  const report = await prisma.trailReport.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      title: true,
      officialScribeId: true,
      runId: true,
      run: { select: { kennelId: true } },
    },
  });
  if (!report) throw ApiError.notFound('Trail Report not found');
  // Engagement is a thing you do to a published report. A draft is private to
  // the editorial circle (BR-SCRIBE-004) and there is nothing to discuss yet.
  if (report.status !== 'PUBLISHED' && report.status !== 'ARCHIVED') {
    throw ApiError.notFound('Trail Report not found');
  }
  const access = await getAccess(actor, report.runId);
  if (!canView(access)) throw ApiError.notFound('Trail Report not found');
  return {
    type: SubjectType.TRAIL_REPORT,
    id: report.id,
    authorId: report.officialScribeId,
    kennelId: report.run.kennelId,
    label: report.title,
    href: `/reports/${report.id}`,
  };
}

async function resolveRun(actor: Actor | undefined, id: string): Promise<SubjectContext> {
  const access = await getAccess(actor, id);
  if (!canView(access)) throw ApiError.notFound('Run not found');
  const run = access.run;
  return {
    type: SubjectType.RUN,
    id,
    // A run is the kennel's, not a person's — the hares hared it, they did not
    // author it, and notifying three hares about a like is noise.
    authorId: null,
    kennelId: run.kennelId,
    label: run.title || (run.runNumber ? `Run #${run.runNumber}` : 'a run'),
    href: `/runs/${id}`,
  };
}

async function resolveCapsule(actor: Actor | undefined, id: string): Promise<SubjectContext> {
  const capsule = await prisma.runCapsule.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      runId: true,
      run: { select: { kennelId: true, runNumber: true, title: true } },
    },
  });
  if (!capsule) throw ApiError.notFound('Run Capsule not found');
  // Only a finished capsule is a thing to engage with; one still assembling is
  // not yet a record of anything (D30).
  if (!['PUBLISHED', 'ARCHIVED', 'LEGACY'].includes(capsule.status)) {
    throw ApiError.notFound('Run Capsule not found');
  }
  const access = await getAccess(actor, capsule.runId);
  if (!canView(access)) throw ApiError.notFound('Run Capsule not found');
  return {
    type: SubjectType.RUN_CAPSULE,
    id: capsule.id,
    authorId: null,
    kennelId: capsule.run.kennelId,
    label: capsule.run.title || (capsule.run.runNumber ? `Run #${capsule.run.runNumber}` : 'a Run Capsule'),
    href: `/capsules/${capsule.id}`,
  };
}

// A photo is visible exactly when the thing it is a photo of is — the same rule
// the feed applies (D42). A media asset linked to neither a run nor a reel is
// kennel branding or trail evidence, and neither of those is something to like.
async function resolveMedia(actor: Actor | undefined, id: string): Promise<SubjectContext> {
  const media = await prisma.mediaAsset.findUnique({
    where: { id },
    select: {
      id: true,
      uploaderId: true,
      caption: true,
      uploadState: true,
      moderationState: true,
      links: { select: { targetType: true, targetId: true } },
    },
  });
  if (!media) throw ApiError.notFound('Photo not found');
  if (media.uploadState !== UploadState.AVAILABLE) throw ApiError.notFound('Photo not found');
  if (media.moderationState === ModerationState.REJECTED) throw ApiError.notFound('Photo not found');

  // A photo is a hasher's own thing as well as a run's: the person who took it
  // can lock their profile, and then it is for their followers (D57).
  if (media.uploaderId && actor?.id !== media.uploaderId && !(await canSeeContentOf(actor, media.uploaderId))) {
    throw ApiError.notFound('Photo not found');
  }

  const runLink = media.links.find((l) => l.targetType === MediaTargetType.RUN);
  if (runLink) {
    const access = await getAccess(actor, runLink.targetId);
    if (!canView(access)) throw ApiError.notFound('Photo not found');
    return {
      type: SubjectType.MEDIA_ASSET,
      id: media.id,
      authorId: media.uploaderId,
      kennelId: access.run.kennelId,
      label: media.caption?.slice(0, 60) || 'a photo',
      href: `/runs/${runLink.targetId}`,
    };
  }

  const reelLink = media.links.find((l) => l.targetType === MediaTargetType.REEL);
  if (reelLink) {
    // Inherit the post's audience rather than restating it.
    const reel = await resolveReel(actor, reelLink.targetId);
    return {
      type: SubjectType.MEDIA_ASSET,
      id: media.id,
      authorId: media.uploaderId,
      kennelId: reel.kennelId,
      label: media.caption?.slice(0, 60) || 'a photo',
      href: reel.href,
    };
  }

  throw ApiError.notFound('Photo not found');
}

// A comment is as visible as what it is about, and it is likeable so that a
// thread can agree with itself without another comment.
async function resolveComment(actor: Actor | undefined, id: string): Promise<SubjectContext> {
  const comment = await prisma.contentComment.findUnique({
    where: { id },
    select: { id: true, authorId: true, subjectType: true, subjectId: true, status: true, body: true },
  });
  if (!comment) throw ApiError.notFound('Comment not found');
  if (comment.status === 'REMOVED') throw ApiError.notFound('Comment not found');
  const parent = await resolveSubject(actor, comment.subjectType, comment.subjectId);
  return {
    type: SubjectType.COMMENT,
    id: comment.id,
    authorId: comment.authorId,
    kennelId: parent.kennelId,
    label: comment.body.slice(0, 60),
    href: parent.href,
  };
}

// ─── The one entry point ───

export async function resolveSubject(
  actor: Actor | undefined,
  type: SubjectType,
  id: string,
): Promise<SubjectContext> {
  // `id` columns are uuid: an arbitrary string is a failed cast, not a miss.
  if (!isUuid(id)) throw ApiError.notFound('Not found');
  switch (type) {
    case SubjectType.REEL:
      return resolveReel(actor, id);
    case SubjectType.POST:
      return resolvePost(actor, id);
    case SubjectType.TRAIL_REPORT:
      return resolveReport(actor, id);
    case SubjectType.RUN:
      return resolveRun(actor, id);
    case SubjectType.RUN_CAPSULE:
      return resolveCapsule(actor, id);
    case SubjectType.MEDIA_ASSET:
      return resolveMedia(actor, id);
    case SubjectType.COMMENT:
      return resolveComment(actor, id);
    default:
      throw ApiError.notFound('Not found');
  }
}

// Would somebody with no account see this? Asked by the share dialog, which
// has to say so before a hasher sends a link to WhatsApp: a members-only run's
// link is a 404 to everybody it reaches, and finding that out from a confused
// reply is worse than being told first.
//
// It is the same resolution, run as nobody — not a second rule that could drift
// out of step with the first.
export async function isPubliclyVisible(type: SubjectType, id: string): Promise<boolean> {
  try {
    await resolveSubject(undefined, type, id);
    return true;
  } catch {
    return false;
  }
}

// Bulk resolution for a bookmark list or a feed of reshares, where a subject
// that has since become invisible is dropped rather than raised. Sequential on
// purpose: each resolution already fans out into its own queries, and a
// bookmark page is twenty rows, not twenty thousand.
export async function resolveVisible(
  actor: Actor | undefined,
  refs: { type: SubjectType; id: string }[],
): Promise<Map<string, SubjectContext>> {
  const out = new Map<string, SubjectContext>();
  for (const ref of refs) {
    try {
      out.set(`${ref.type}:${ref.id}`, await resolveSubject(actor, ref.type, ref.id));
    } catch {
      // Gone, or never theirs to see. Either way it is not on this page.
    }
  }
  return out;
}
