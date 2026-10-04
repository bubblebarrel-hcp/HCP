import {
  AccountStatus,
  ModerationActionKind,
  PlatformRole,
  Prisma,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  SubjectType,
} from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import * as admin from './admin.service';
import { allocateUsername } from './entity.service';
import { followableUser } from './follow.service';
import * as media from './media.service';
import { type Actor, assertKennelPermission } from './permission.service';
import * as posts from './post.service';
import { recordAudit, recordEvent } from './record.service';
import * as reels from './reel.service';
import { publicName, userPublicSelect } from './run.service';
import { resolveSubject } from './subject.service';
import * as engagement from './engagement.service';

// Reports and moderation (D61).
//
// A hasher can report a person, a post, a reel, a comment or a photo. The report
// is a request for a human to look: nothing is hidden, removed or suspended by
// being reported, however many people report it (AI assists, humans decide).
//
// Who looks. Platform staff see every report. A kennel's moderators (those with
// `media.moderate`) also see reports about content made in their kennel and may
// dismiss it or take that content down, and hand it up. Reports about a person,
// including every impersonation, are platform staff's alone: a kennel is not the
// place to decide who somebody really is, and a moderator never rules on a
// report about themselves.
//
// The reporter is confidential. Nothing the target can read names them, kennel
// moderators see "a member", and only platform staff see who. The reporter hears
// the outcome in one line and nothing more, so a report is never a way to learn
// what happened to somebody else.

const REPORTS_PER_DAY = 15;
const REPEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_DETAILS = 1000;

// What each reason is worth in the queue. Somebody in danger first, then the
// things that hurt a person, then the rest.
const PRIORITY: Record<ReportReason, number> = {
  SELF_HARM: 2,
  VIOLENCE: 2,
  HARASSMENT: 1,
  HATE: 1,
  SEXUAL: 1,
  PRIVATE_INFO: 1,
  IMPERSONATION: 1,
  SCAM: 1,
  SPAM: 0,
  OTHER: 0,
};

export const REASON_LABEL: Record<ReportReason, string> = {
  SPAM: 'Spam',
  SCAM: 'Scam or fraud',
  HARASSMENT: 'Harassment or bullying',
  HATE: 'Hate',
  VIOLENCE: 'Violence or threats',
  SEXUAL: 'Nudity or sexual content',
  PRIVATE_INFO: 'Private information',
  SELF_HARM: 'Self-harm',
  IMPERSONATION: 'Impersonation',
  OTHER: 'Something else',
};

const A = ModerationActionKind;
const S = ReportStatus;

// Closing a report, as opposed to leaving a note on it.
const CLOSING: ModerationActionKind[] = [A.DISMISS, A.REMOVE_CONTENT, A.WARN_USER, A.SUSPEND_USER, A.RESET_IDENTITY];
// What a kennel's moderators may do. Everything else is platform staff's.
const KENNEL_MAY: ModerationActionKind[] = [A.DISMISS, A.REMOVE_CONTENT, A.NOTE, A.ESCALATE];
// These tell somebody something, so they need words to say it with.
const NEEDS_REASON: ModerationActionKind[] = [A.REMOVE_CONTENT, A.WARN_USER, A.SUSPEND_USER, A.RESET_IDENTITY];

type TargetInfo = { targetUserId: string | null; kennelId: string | null; snapshot: Prisma.InputJsonObject };

// ─── Filing ───

async function userCard(id: string) {
  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      ...userPublicSelect,
      username: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      status: true,
      homeKennel: { select: { slug: true, shortName: true } },
    },
  });
  if (!u) return null;
  return {
    id: u.id,
    name: publicName(u),
    hashHandle: u.hashHandle,
    username: u.username,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt,
    status: u.status,
    homeKennel: u.homeKennel,
  };
}

// What is being reported, as it is now, and who answers for it. The reporter has
// to be able to see it themself: you cannot report what you cannot find.
async function inspect(actor: Actor, type: ReportTargetType, id: string): Promise<TargetInfo> {
  if (!isUuid(id)) throw ApiError.notFound('Not found');

  if (type === ReportTargetType.USER) {
    await followableUser(actor, id);
    const card = await userCard(id);
    return { targetUserId: id, kennelId: null, snapshot: { kind: 'USER', ...card } as Prisma.InputJsonObject };
  }

  const subjectType = {
    [ReportTargetType.POST]: SubjectType.POST,
    [ReportTargetType.REEL]: SubjectType.REEL,
    [ReportTargetType.COMMENT]: SubjectType.COMMENT,
    [ReportTargetType.MEDIA_ASSET]: SubjectType.MEDIA_ASSET,
  }[type];
  const subject = await resolveSubject(actor, subjectType, id);

  let snapshot: Prisma.InputJsonObject;
  if (type === ReportTargetType.POST) {
    const p = await prisma.post.findUnique({ where: { id }, select: { body: true, visibility: true } });
    snapshot = { kind: 'POST', body: p?.body ?? '', visibility: p?.visibility ?? null };
  } else if (type === ReportTargetType.REEL) {
    const r = await prisma.reel.findUnique({ where: { id }, select: { caption: true, media: { select: { url: true } } } });
    snapshot = { kind: 'REEL', caption: r?.caption ?? null, mediaUrl: r?.media?.url ?? null };
  } else if (type === ReportTargetType.COMMENT) {
    const c = await prisma.contentComment.findUnique({ where: { id }, select: { body: true, subjectType: true, subjectId: true } });
    snapshot = { kind: 'COMMENT', body: c?.body ?? '', on: c?.subjectType ?? null, onId: c?.subjectId ?? null };
  } else {
    const m = await prisma.mediaAsset.findUnique({ where: { id }, select: { url: true, caption: true } });
    snapshot = { kind: 'MEDIA_ASSET', url: m?.url ?? null, caption: m?.caption ?? null };
  }
  return { targetUserId: subject.authorId, kennelId: subject.kennelId, snapshot: { ...snapshot, href: subject.href } };
}

export interface ReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string | null;
  // Impersonation only: is it you they are pretending to be, or somebody else?
  impersonating?: 'ME' | 'OTHER';
  impersonatedUserId?: string | null;
}

export async function file(actor: Actor, input: ReportInput) {
  if (input.reason === ReportReason.IMPERSONATION && input.targetType !== ReportTargetType.USER) {
    throw ApiError.badRequest('Impersonation is reported against the hasher doing it.', 'IMPERSONATION_NEEDS_HASHER');
  }
  const details = input.details?.trim() || null;
  if (details && details.length > MAX_DETAILS) {
    throw ApiError.badRequest(`Keep it under ${MAX_DETAILS} characters.`, 'DETAILS_TOO_LONG');
  }
  if (input.reason === ReportReason.OTHER && !details) {
    throw ApiError.badRequest('Tell us what is wrong.', 'DETAILS_REQUIRED');
  }

  const recent = await prisma.contentReport.count({
    where: { reporterId: actor.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (recent >= REPORTS_PER_DAY) {
    throw new ApiError(429, 'You have sent a lot of reports today. Try again tomorrow.', 'REPORT_RATE_LIMITED');
  }

  const info = await inspect(actor, input.targetType, input.targetId);
  if (info.targetUserId === actor.id) {
    throw ApiError.badRequest('That is yours. Edit or delete it instead.', 'OWN_CONTENT');
  }

  const again = await prisma.contentReport.findFirst({
    where: {
      reporterId: actor.id,
      targetType: input.targetType,
      targetId: input.targetId,
      createdAt: { gte: new Date(Date.now() - REPEAT_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (again) throw ApiError.conflict('You have already reported this. We have it.', 'ALREADY_REPORTED');

  // Who is being copied. Never taken on trust that it is a real, different hasher.
  let impersonatedUserId: string | null = null;
  let impersonatedCard: Awaited<ReturnType<typeof userCard>> = null;
  if (input.reason === ReportReason.IMPERSONATION) {
    if (input.impersonating === 'ME') {
      impersonatedUserId = actor.id;
    } else if (input.impersonating === 'OTHER') {
      const id = input.impersonatedUserId;
      if (!id || !isUuid(id)) {
        throw ApiError.badRequest('Say who they are pretending to be.', 'IMPERSONATED_REQUIRED');
      }
      const real = await prisma.user.findFirst({
        where: { id, status: AccountStatus.ACTIVE, deletedAt: null },
        select: { id: true },
      });
      if (!real) throw ApiError.badRequest('We could not find that hasher.', 'IMPERSONATED_NOT_FOUND');
      impersonatedUserId = id;
    } else {
      throw ApiError.badRequest('Say whether they are pretending to be you or somebody else.', 'IMPERSONATING_REQUIRED');
    }
    if (impersonatedUserId === input.targetId) {
      throw ApiError.badRequest('That is the same hasher.', 'IMPERSONATION_SAME');
    }
    impersonatedCard = await userCard(impersonatedUserId);
  }

  const priority = PRIORITY[input.reason];
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.contentReport.create({
      data: {
        reporterId: actor.id,
        targetType: input.targetType,
        targetId: input.targetId,
        targetUserId: info.targetUserId,
        kennelId: info.kennelId,
        reason: input.reason,
        details,
        impersonatedUserId,
        snapshot: { ...info.snapshot, ...(impersonatedCard ? { impersonated: impersonatedCard as unknown as Prisma.InputJsonObject } : {}) },
        priority,
      },
      select: { id: true, status: true, createdAt: true },
    });
    await recordEvent(tx, {
      eventType: 'ReportFiled',
      aggregateType: 'Report',
      aggregateId: created.id,
      actorId: actor.id,
      payload: { reason: input.reason, targetType: input.targetType, priority },
    });
    return created;
  });
  return { id: row.id, status: row.status, createdAt: row.createdAt };
}

// What the reporter is told, and no more: not who was spoken to, not what was done
// to anybody.
export async function listMine(actor: Actor) {
  const rows = await prisma.contentReport.findMany({
    where: { reporterId: actor.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, targetType: true, reason: true, status: true, createdAt: true, resolvedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    targetType: r.targetType,
    reason: r.reason,
    reasonLabel: REASON_LABEL[r.reason],
    status: r.status,
    outcome:
      r.status === S.ACTIONED
        ? 'We reviewed it and took action.'
        : r.status === S.DISMISSED
          ? 'We reviewed it and did not find a breach of the rules.'
          : 'We have it and will look.',
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
  }));
}

// ─── Who may see a report ───

interface Scope {
  platform: boolean;
  kennelId: string | null;
}

async function scopeFor(actor: Actor, kennelSlug?: string): Promise<Scope> {
  if (kennelSlug) {
    const kennel = await prisma.kennel.findUnique({ where: { slug: kennelSlug }, select: { id: true } });
    if (!kennel) throw ApiError.notFound('Kennel not found');
    await assertKennelPermission(actor, kennel.id, 'media.moderate');
    return { platform: false, kennelId: kennel.id };
  }
  if (actor.role !== PlatformRole.ADMIN) throw ApiError.forbidden('Platform staff only.', 'PLATFORM_ONLY');
  return { platform: true, kennelId: null };
}

// A kennel's moderators see content made in their kennel and never a report
// about themselves.
function visibleWhere(actor: Actor, scope: Scope): Prisma.ContentReportWhereInput {
  if (scope.platform) return {};
  return {
    kennelId: scope.kennelId,
    targetType: { not: ReportTargetType.USER },
    NOT: { targetUserId: actor.id },
  };
}

async function loadFor(actor: Actor, reportId: string, kennelSlug?: string) {
  if (!isUuid(reportId)) throw ApiError.notFound('Report not found');
  const scope = await scopeFor(actor, kennelSlug);
  const report = await prisma.contentReport.findFirst({
    where: { id: reportId, ...visibleWhere(actor, scope) },
    include: { actions: { orderBy: { createdAt: 'asc' } } },
  });
  if (!report) throw ApiError.notFound('Report not found');
  return { report, scope };
}

// ─── The queue ───

export type QueueFilter = 'open' | 'resolved' | 'all';

export async function queue(
  actor: Actor,
  opts: { kennelSlug?: string; filter: QueueFilter; reason?: ReportReason; page: number; limit: number },
) {
  const scope = await scopeFor(actor, opts.kennelSlug);
  const where: Prisma.ContentReportWhereInput = {
    ...visibleWhere(actor, scope),
    ...(opts.filter === 'open' ? { status: { in: [S.OPEN, S.IN_REVIEW] } } : {}),
    ...(opts.filter === 'resolved' ? { status: { in: [S.ACTIONED, S.DISMISSED] } } : {}),
    ...(opts.reason ? { reason: opts.reason } : {}),
    // A report a kennel has handed up is platform staff's.
    ...(scope.platform ? {} : { escalatedAt: null }),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.contentReport.findMany({
      where,
      orderBy: opts.filter === 'resolved' ? [{ resolvedAt: 'desc' }] : [{ priority: 'desc' }, { createdAt: 'asc' }],
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        targetUserId: true,
        reason: true,
        details: true,
        status: true,
        priority: true,
        escalatedAt: true,
        snapshot: true,
        createdAt: true,
        resolvedAt: true,
        reporterId: true,
      },
    }),
    prisma.contentReport.count({ where }),
  ]);

  // How many people are reporting the same thing, which is what tells a pile-on
  // from a one-off. One grouped read for the page.
  const targetIds = [...new Set(rows.map((r) => r.targetId))];
  const grouped = targetIds.length
    ? await prisma.contentReport.groupBy({
        by: ['targetType', 'targetId'],
        where: { targetId: { in: targetIds }, status: { in: [S.OPEN, S.IN_REVIEW] } },
        _count: { _all: true },
      })
    : [];
  const same = new Map(grouped.map((g) => [`${g.targetType}:${g.targetId}`, g._count._all]));

  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.flatMap((r) => (r.targetUserId ? [r.targetUserId] : [])))] } },
    select: userPublicSelect,
  });
  const names = new Map(users.map((u) => [u.id, publicName(u)]));

  const items = rows.map((r) => ({
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    target: { userId: r.targetUserId, name: r.targetUserId ? (names.get(r.targetUserId) ?? null) : null },
    reason: r.reason,
    reasonLabel: REASON_LABEL[r.reason],
    details: r.details,
    status: r.status,
    priority: r.priority,
    escalated: r.escalatedAt !== null,
    summary: summaryOf(r.snapshot),
    openReportsOnTarget: same.get(`${r.targetType}:${r.targetId}`) ?? 1,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
  }));
  return page(items, total, opts.page, opts.limit);
}

function summaryOf(snapshot: Prisma.JsonValue): string {
  const s = (snapshot ?? {}) as Record<string, unknown>;
  const text = (s.body ?? s.caption ?? s.bio ?? s.name ?? '') as string;
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > 140 ? `${flat.slice(0, 139)}…` : flat;
}

export async function counts(actor: Actor, kennelSlug?: string) {
  const scope = await scopeFor(actor, kennelSlug);
  const base: Prisma.ContentReportWhereInput = {
    ...visibleWhere(actor, scope),
    status: { in: [S.OPEN, S.IN_REVIEW] },
    ...(scope.platform ? {} : { escalatedAt: null }),
  };
  const [open, urgent] = await Promise.all([
    prisma.contentReport.count({ where: base }),
    prisma.contentReport.count({ where: { ...base, priority: { gte: 2 } } }),
  ]);
  return { open, urgent };
}

// ─── One report ───

export async function detail(actor: Actor, reportId: string, kennelSlug?: string) {
  const { report, scope } = await loadFor(actor, reportId, kennelSlug);
  const snapshot = (report.snapshot ?? {}) as Record<string, unknown>;

  const [reporter, targetNow, impersonated, siblings, history, answerable] = await Promise.all([
    scope.platform ? userCard(report.reporterId) : Promise.resolve(null),
    report.targetType === ReportTargetType.USER ? userCard(report.targetId) : Promise.resolve(null),
    report.impersonatedUserId ? userCard(report.impersonatedUserId) : Promise.resolve(null),
    prisma.contentReport.findMany({
      where: { targetType: report.targetType, targetId: report.targetId, id: { not: report.id } },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { id: true, reason: true, status: true, details: true, createdAt: true, reporterId: true },
    }),
    // What moderation has done about this hasher before: never anything that was
    // only looked at.
    report.targetUserId && scope.platform
      ? prisma.moderationAction.findMany({
          where: {
            kind: { in: [A.REMOVE_CONTENT, A.WARN_USER, A.SUSPEND_USER, A.RESET_IDENTITY] },
            report: { targetUserId: report.targetUserId },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { kind: true, createdAt: true, report: { select: { reason: true } } },
        })
      : Promise.resolve([]),
    // Who answers for it: for content, its author. Platform staff only.
    report.targetUserId && scope.platform ? userCard(report.targetUserId) : Promise.resolve(null),
  ]);

  const actorIds = [...new Set(report.actions.map((a) => a.actorId))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: userPublicSelect })
    : [];
  const actorName = new Map(actors.map((u) => [u.id, publicName(u)]));

  // A live look at the thing, which may have changed or gone since it was reported.
  let current: { status: string | null; removed: boolean } | null = null;
  if (report.targetType === ReportTargetType.POST) {
    const p = await prisma.post.findUnique({ where: { id: report.targetId }, select: { status: true } });
    current = { status: p?.status ?? null, removed: p?.status === 'REMOVED' || p?.status === 'ARCHIVED' };
  } else if (report.targetType === ReportTargetType.REEL) {
    const r = await prisma.reel.findUnique({ where: { id: report.targetId }, select: { status: true } });
    current = { status: r?.status ?? null, removed: r?.status === 'REMOVED' || r?.status === 'DELETED' };
  } else if (report.targetType === ReportTargetType.COMMENT) {
    const c = await prisma.contentComment.findUnique({ where: { id: report.targetId }, select: { status: true } });
    current = { status: c?.status ?? null, removed: c?.status !== 'VISIBLE' };
  } else if (report.targetType === ReportTargetType.MEDIA_ASSET) {
    const m = await prisma.mediaAsset.findUnique({ where: { id: report.targetId }, select: { moderationState: true } });
    current = { status: m?.moderationState ?? null, removed: m?.moderationState === 'REJECTED' };
  }

  const sameHandle =
    targetNow && impersonated && targetNow.hashHandle && impersonated.hashHandle
      ? targetNow.hashHandle.trim().toLowerCase() === impersonated.hashHandle.trim().toLowerCase()
      : false;

  return {
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    reasonLabel: REASON_LABEL[report.reason],
    details: report.details,
    status: report.status,
    priority: report.priority,
    escalated: report.escalatedAt !== null,
    createdAt: report.createdAt,
    resolvedAt: report.resolvedAt,
    resolutionNote: report.resolutionNote,
    // The reporter is platform staff's to know and nobody else's.
    reporter: reporter ? { id: reporter.id, name: reporter.name, createdAt: reporter.createdAt } : null,
    snapshot,
    current,
    // For a report about a hasher: who they are now. For impersonation: the real
    // one beside them, so the two can be compared.
    target: targetNow,
    answerable: answerable ? { id: answerable.id, name: answerable.name } : null,
    impersonated,
    sameHandle,
    siblings: siblings.map((s) => ({
      id: s.id,
      reason: s.reason,
      reasonLabel: REASON_LABEL[s.reason],
      status: s.status,
      details: s.details,
      createdAt: s.createdAt,
    })),
    priorActions: history.map((h) => ({ kind: h.kind, at: h.createdAt, reason: h.report.reason })),
    actions: report.actions.map((a) => ({
      id: a.id,
      kind: a.kind,
      note: a.note,
      by: actorName.get(a.actorId) ?? 'A moderator',
      at: a.createdAt,
    })),
    // What this viewer may do about it.
    may: scope.platform ? Object.values(A) : KENNEL_MAY,
  };
}

// ─── Doing something about it ───

export interface ActionInput {
  kind: ModerationActionKind;
  note?: string | null;
  // Close every other open report about the same thing the same way. On by
  // default: a pile-on is one decision.
  closeSiblings?: boolean;
}

export async function act(actor: Actor, reportId: string, input: ActionInput, kennelSlug?: string) {
  const { report, scope } = await loadFor(actor, reportId, kennelSlug);
  const kind = input.kind;
  const note = input.note?.trim() || null;

  if (!scope.platform && !KENNEL_MAY.includes(kind)) {
    throw ApiError.forbidden('Only platform staff can do that.', 'PLATFORM_ONLY');
  }
  if (!scope.platform && report.escalatedAt) {
    throw ApiError.forbidden('This has been handed to platform staff.', 'ESCALATED');
  }
  if (report.status === S.ACTIONED || report.status === S.DISMISSED) {
    throw ApiError.badRequest('This report is closed. File a new one for anything new.', 'REPORT_CLOSED');
  }
  if (NEEDS_REASON.includes(kind) && (!note || note.length < 3)) {
    throw ApiError.badRequest('Say why, in words the hasher will read.', 'REASON_REQUIRED');
  }
  if (kind === A.NOTE && !note) throw ApiError.badRequest('Write the note.', 'NOTE_REQUIRED');

  const isUser = report.targetType === ReportTargetType.USER;
  if (kind === A.REMOVE_CONTENT && isUser) {
    throw ApiError.badRequest('A hasher is not content. Reset their identity or suspend them.', 'NOT_CONTENT');
  }
  if (kind === A.RESET_IDENTITY && !isUser) {
    throw ApiError.badRequest('Only a hasher has an identity to reset.', 'NOT_A_HASHER');
  }
  if ((kind === A.WARN_USER || kind === A.SUSPEND_USER) && !report.targetUserId) {
    throw ApiError.badRequest('Nobody answers for this.', 'NO_TARGET_USER');
  }

  // The act itself, through the services that already own it, so a removal here is
  // the same removal a moderator would make from the thing's own page.
  if (kind === A.REMOVE_CONTENT) {
    await takeDown(actor, report.targetType, report.targetId, note as string);
  } else if (kind === A.SUSPEND_USER) {
    const user = await prisma.user.findUnique({ where: { id: report.targetUserId as string }, select: { platformRole: true } });
    if (user?.platformRole === PlatformRole.ADMIN) {
      throw ApiError.badRequest('Platform staff are not suspended from a report.', 'PLATFORM_ADMIN');
    }
    await admin.updateStatus(actor.id, report.targetUserId as string, AccountStatus.SUSPENDED, note);
  }

  const closing = CLOSING.includes(kind);
  const status = closing ? (kind === A.DISMISS ? S.DISMISSED : S.ACTIONED) : S.IN_REVIEW;
  const now = new Date();
  const policyRef = scope.platform ? 'platform-admin' : 'media.moderate';

  await prisma.$transaction(async (tx) => {
    if (kind === A.RESET_IDENTITY) {
      const before = await tx.user.findUniqueOrThrow({
        where: { id: report.targetId },
        select: { hashHandle: true, username: true, avatarUrl: true, bannerUrl: true, bio: true },
      });
      await tx.user.update({
        where: { id: report.targetId },
        data: {
          hashHandle: null,
          username: await allocateUsername(tx, null),
          avatarUrl: null,
          avatarPosition: null,
          bannerUrl: null,
          bannerPosition: null,
          bio: null,
        },
      });
      await recordAudit(tx, {
        actorId: actor.id,
        action: 'identity.reset',
        resourceType: 'Identity',
        resourceId: report.targetId,
        previousState: before,
        newState: { hashHandle: null, avatarUrl: null, bannerUrl: null, bio: null },
        reason: note,
        policyRef,
      });
    }

    const targetReports = closing && input.closeSiblings !== false
      ? await tx.contentReport.findMany({
          where: {
            id: { not: report.id },
            targetType: report.targetType,
            targetId: report.targetId,
            status: { in: [S.OPEN, S.IN_REVIEW] },
            // A kennel closes only what it can see.
            ...(scope.platform ? {} : { kennelId: scope.kennelId, escalatedAt: null }),
          },
          select: { id: true, reporterId: true },
        })
      : [];

    const close = async (id: string, reporterId: string, withNote: string | null) => {
      await tx.contentReport.update({
        where: { id },
        data: { status, resolvedById: actor.id, resolvedAt: now, resolutionNote: withNote, assignedToId: actor.id },
      });
      await tx.moderationAction.create({ data: { reportId: id, actorId: actor.id, kind, note: withNote } });
      // The reporter hears the outcome in a line, and nothing else.
      await recordEvent(tx, {
        eventType: 'ReportResolved',
        aggregateType: 'Report',
        aggregateId: id,
        actorId: actor.id,
        payload: { reporterId, outcome: status },
      });
    };

    if (closing) {
      await close(report.id, report.reporterId, note);
      for (const sibling of targetReports) await close(sibling.id, sibling.reporterId, `Closed with report ${report.id}`);
    } else {
      await tx.moderationAction.create({ data: { reportId: report.id, actorId: actor.id, kind, note } });
      await tx.contentReport.update({
        where: { id: report.id },
        data: {
          status,
          assignedToId: actor.id,
          ...(kind === A.ESCALATE ? { escalatedAt: now, priority: Math.min(2, report.priority + 1) } : {}),
        },
      });
    }

    const event = await recordEvent(tx, {
      eventType: 'ModerationActionTaken',
      aggregateType: 'Report',
      aggregateId: report.id,
      actorId: actor.id,
      payload: { kind, targetType: report.targetType, targetUserId: report.targetUserId, closed: closing },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: `report.${kind.toLowerCase()}`,
      resourceType: 'ContentReport',
      resourceId: report.id,
      kennelId: report.kennelId,
      previousState: { status: report.status },
      newState: { status },
      reason: note,
      policyRef,
      domainEventId: event.id,
    });

    // Tell the hasher a rule was broken, in the words the moderator wrote (D61).
    // Taking content down already tells its author through its own event.
    if ((kind === A.WARN_USER || kind === A.RESET_IDENTITY) && report.targetUserId) {
      await recordEvent(tx, {
        eventType: 'ModerationWarningIssued',
        aggregateType: 'Report',
        aggregateId: report.id,
        actorId: actor.id,
        payload: { targetUserId: report.targetUserId, kind, message: note },
      });
    }
  });

  return detail(actor, reportId, kennelSlug);
}

async function takeDown(actor: Actor, type: ReportTargetType, id: string, reason: string) {
  try {
    if (type === ReportTargetType.POST) await posts.remove(actor, id, reason);
    else if (type === ReportTargetType.REEL) await reels.remove(actor, id, reason);
    else if (type === ReportTargetType.COMMENT) await engagement.removeComment(actor, id, reason);
    else if (type === ReportTargetType.MEDIA_ASSET) await media.moderate(actor, id, false, reason);
  } catch (error) {
    // Already gone (the author withdrew it) is the outcome asked for.
    if (error instanceof ApiError && error.status === 404) return;
    throw error;
  }
}
