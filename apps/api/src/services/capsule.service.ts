import {
  CapsuleStatus,
  type DomainEvent,
  MediaTargetType,
  MembershipStatus,
  ModerationState,
  Prisma,
  RsvpStatus,
  StoryCategory,
  SupplementalType,
  UploadState,
} from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import type { Actor } from './permission.service';
import { recordAudit, recordEvent } from './record.service';
import { type RunAccess, canSeeCircle, canSeeNames, canView, getAccess, publicName, userPublicSelect, viewableAccess } from './run.service';

// Run Capsules (Annex 08H, Ch.22 A.6). The archive builds itself: the capsule
// exists from the moment the run does and grows as the run happens. A human
// publishes it; after that it is history and stops rebuilding (D30).
//
//   Planned → Preparing → Live → Draft → Pending Publication → Published → Archived
//
// Legacy is a separate entry point, not a downstream state.

const C = CapsuleStatus;

// While assembling, the timeline and summary are rebuilt from source. Once
// published the record is frozen (FR-CAPSULE-006, BR-CAPSULE-004).
const ASSEMBLING: CapsuleStatus[] = [C.PLANNED, C.PREPARING, C.LIVE, C.DRAFT, C.PENDING_PUBLICATION];
const FROZEN: CapsuleStatus[] = [C.PUBLISHED, C.ARCHIVED, C.LEGACY];

// What the run's own events contribute to the timeline (FR-CAPSULE-005).
const TIMELINE_EVENTS: Record<string, string> = {
  RunScheduled: 'The run was announced',
  TrailReleased: 'The trail went live',
  CheckInOpened: 'Check-in opened',
  RunStarted: 'The pack set off',
  RunPaused: 'The run was paused',
  RunResumed: 'The run resumed',
  RunEnded: 'The pack came in',
  CircleClosed: 'The Circle closed',
  CircleSkipped: 'The Circle was skipped',
  RunArchived: 'The run was archived',
  RunCancelled: 'The run was cancelled',
};

export interface TimelineEntry {
  at: string;
  kind: 'RUN' | 'STORY' | 'AWARD' | 'REPORT' | 'ATTENDANCE';
  label: string;
  detail?: string;
  refType?: string;
  refId?: string;
}

// ─── Assembly (FR-CAPSULE-002, FR-CAPSULE-005) ───

// Derived, never accumulated: rebuilding from source makes replay harmless and
// lets a capsule that predates this code fill itself in, exactly as the Hash
// Passport does (D27).
export async function assemble(runId: string) {
  const capsule = await prisma.runCapsule.findUnique({
    where: { runId },
    select: { id: true, status: true },
  });
  if (!capsule || FROZEN.includes(capsule.status)) return null;

  const [run, events, participations, circle, trails, mediaCount, stories, report] = await Promise.all([
    prisma.run.findUnique({
      where: { id: runId },
      select: { id: true, runNumber: true, title: true, startsAt: true, createdAt: true },
    }),
    prisma.domainEvent.findMany({
      where: { aggregateType: 'Run', aggregateId: runId, eventType: { in: Object.keys(TIMELINE_EVENTS) } },
      orderBy: { occurredAt: 'asc' },
      select: { id: true, eventType: true, occurredAt: true, payload: true },
    }),
    prisma.participation.findMany({
      where: { runId },
      select: { checkedInAt: true, isVisitor: true, guestId: true, rsvpStatus: true },
    }),
    prisma.circle.findUnique({
      where: { runId },
      select: {
        startedAt: true,
        songs: true,
        awards: { select: { id: true, title: true, isDownDown: true, recipientName: true, createdAt: true } },
      },
    }),
    prisma.trail.findMany({
      where: { runId },
      select: {
        estimatedDistanceM: true,
        releasedAt: true,
        _count: { select: { waypoints: true, beerChecks: true } },
      },
    }),
    prisma.mediaAsset.count({
      where: {
        links: { some: { targetType: MediaTargetType.RUN, targetId: runId } },
        uploadState: UploadState.AVAILABLE,
        moderationState: ModerationState.APPROVED,
      },
    }),
    prisma.storyAsset.findMany({
      where: { runId },
      orderBy: { occurredAt: 'asc' },
      select: { id: true, category: true, body: true, occurredAt: true, refType: true, refId: true },
    }),
    prisma.trailReport.findUnique({
      where: { runId },
      select: { id: true, title: true, publishedAt: true },
    }),
  ]);
  if (!run) return null;

  const entries: TimelineEntry[] = [];

  for (const event of events) {
    const reason = (event.payload as { reason?: string } | null)?.reason;
    entries.push({
      at: event.occurredAt.toISOString(),
      kind: 'RUN',
      label: TIMELINE_EVENTS[event.eventType],
      ...(reason ? { detail: reason } : {}),
      refType: 'DomainEvent',
      refId: event.id,
    });
  }

  const checkIns = participations
    .map((p) => p.checkedInAt)
    .filter((at): at is Date => Boolean(at))
    .sort((a, b) => a.getTime() - b.getTime());
  if (checkIns[0]) {
    entries.push({ at: checkIns[0].toISOString(), kind: 'ATTENDANCE', label: 'The first hasher checked in' });
  }

  // Story collection listens to the same lifecycle events this timeline already
  // has, so including both makes the capsule say everything twice ("The trail
  // went live" beside "The trail went live and the pack set off"). The event
  // entry wins; the story only earns a place when it adds something new — a
  // guest arriving, a photo, or whatever the Scribe wrote by hand.
  const coveredEvents = new Set(events.map((e) => e.id));
  for (const story of stories) {
    if (story.refType === 'DomainEvent' && story.refId && coveredEvents.has(story.refId)) continue;
    // Awards are listed from the Circle below, with their reasons.
    if (story.category === StoryCategory.AWARD) continue;
    entries.push({
      at: story.occurredAt.toISOString(),
      kind: 'STORY',
      label: story.body,
      detail: story.category,
      refType: 'StoryAsset',
      refId: story.id,
    });
  }

  for (const award of circle?.awards ?? []) {
    entries.push({
      at: award.createdAt.toISOString(),
      kind: 'AWARD',
      label: award.recipientName ? `${award.title} for ${award.recipientName}` : award.title,
      detail: award.isDownDown ? 'Down-down' : undefined,
      refType: 'Award',
      refId: award.id,
    });
  }

  if (report?.publishedAt) {
    entries.push({
      at: report.publishedAt.toISOString(),
      kind: 'REPORT',
      label: `The Trail Report was published: ${report.title}`,
      refType: 'TrailReport',
      refId: report.id,
    });
  }

  entries.sort((a, b) => a.at.localeCompare(b.at));

  const attended = checkIns.length;
  const visitors = participations.filter((p) => p.isVisitor && (p.checkedInAt || p.rsvpStatus === RsvpStatus.GOING)).length;
  const distanceM = trails.reduce((sum, t) => sum + (t.estimatedDistanceM ?? 0), 0);
  const beerChecks = trails.reduce((sum, t) => sum + t._count.beerChecks, 0);

  // A plain sentence a reader can take in at a glance (FR-CAPSULE-010: insight
  // without ranking anyone).
  const parts = [`${attended} hasher${attended === 1 ? '' : 's'} ran it`];
  if (visitors > 0) parts.push(`${visitors} visiting`);
  if (distanceM > 0) parts.push(`${(distanceM / 1000).toFixed(1)} km`);
  if (beerChecks > 0) parts.push(`${beerChecks} beer check${beerChecks === 1 ? '' : 's'}`);
  if (mediaCount > 0) parts.push(`${mediaCount} photo${mediaCount === 1 ? '' : 's'}`);

  await prisma.runCapsule.update({
    where: { id: capsule.id },
    data: {
      timeline: entries as unknown as Prisma.InputJsonValue,
      summary: `${parts.join(', ')}.`,
    },
  });
  return capsule.id;
}

// ─── Outbox consumer (Ch.24: the most event-dense consumer in the platform) ───

function runIdOf(event: DomainEvent) {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  if (event.aggregateType === 'Run') return event.aggregateId;
  return typeof payload.runId === 'string' ? payload.runId : null;
}

export async function applyToCapsule(event: DomainEvent) {
  const runId = runIdOf(event);
  if (!runId) return 0;

  await assemble(runId);

  // The capsule reaches Pending Publication through the run archiving or its
  // report being published (D30). Announcing that is this consumer's job, so
  // the services that move it stay simple; the guard keeps replay idempotent.
  const capsule = await prisma.runCapsule.findUnique({
    where: { runId },
    select: { id: true, status: true, run: { select: { kennelId: true, runNumber: true } } },
  });
  if (!capsule || capsule.status !== C.PENDING_PUBLICATION) return 0;

  const announced = await prisma.domainEvent.findFirst({
    where: { aggregateType: 'RunCapsule', aggregateId: capsule.id, eventType: 'RunCapsuleReadyForPublication' },
    select: { id: true },
  });
  if (announced) return 0;

  await prisma.$transaction(async (tx) => {
    await recordEvent(tx, {
      eventType: 'RunCapsuleReadyForPublication',
      aggregateType: 'RunCapsule',
      aggregateId: capsule.id,
      // Nobody did this: the run reaching its end did.
      actorId: null,
      payload: { runId, kennelId: capsule.run.kennelId, runNumber: capsule.run.runNumber },
    });
  });
  return 1;
}

// ─── Access ───

const capsuleSelect = {
  id: true,
  runId: true,
  status: true,
  summary: true,
  timeline: true,
  isLegacyImport: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  trailReport: { select: { id: true, title: true, status: true, publishedAt: true, officialScribe: { select: userPublicSelect } } },
  supplementals: {
    orderBy: { addedAt: 'desc' },
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      addedAt: true,
      mediaAsset: { select: { id: true, url: true, thumbnailUrl: true } },
      contributor: { select: userPublicSelect },
    },
  },
  run: {
    select: {
      id: true,
      runNumber: true,
      title: true,
      theme: true,
      startsAt: true,
      timeZone: true,
      city: true,
      country: true,
      kennelId: true,
      kennel: { select: { name: true, shortName: true, slug: true, primaryColor: true } },
      hares: { select: { isLead: true, user: { select: userPublicSelect } } },
    },
  },
} satisfies Prisma.RunCapsuleSelect;

type CapsuleRow = Prisma.RunCapsuleGetPayload<{ select: typeof capsuleSelect }>;

// Publishing a capsule is the Scribe's or an officer's act, gated on the report
// (Ch.22 A.6). Archiving is an officer's alone (08H-05 permission matrix).
function authority(access: RunAccess, report: CapsuleRow['trailReport']) {
  const isScribe = Boolean(access.actor && report && report.officialScribe.id === access.actor.id);
  const canGovern = Boolean(access.grants.get('report.publish')) || Boolean(access.canManage);
  return { isScribe, canGovern, canPublishReport: Boolean(report?.publishedAt) };
}

// FR-EXPLORER-008. Prisma has no "order by nearest date" clause, and the
// corpus is small enough at this stage that fetching a kennel's frozen
// capsules and ranking them in memory is simpler than a raw query — revisit
// if a kennel's history ever runs into the thousands.
async function relatedCapsules(kennelId: string, excludeRunId: string, startsAt: Date, leadHareId: string | null) {
  const rows = await prisma.runCapsule.findMany({
    where: {
      status: { in: FROZEN },
      run: { kennelId, id: { not: excludeRunId } },
    },
    orderBy: { publishedAt: 'desc' },
    take: 60,
    select: {
      id: true,
      run: {
        select: {
          runNumber: true,
          title: true,
          startsAt: true,
          kennel: { select: { slug: true, shortName: true, primaryColor: true } },
          hares: { select: { userId: true } },
        },
      },
    },
  });

  const scored = rows.map((r) => {
    const sameHare = leadHareId ? r.run.hares.some((h) => h.userId === leadHareId) : false;
    const daysApart = Math.abs(r.run.startsAt.getTime() - startsAt.getTime()) / 86_400_000;
    return { row: r, sameHare, daysApart };
  });
  scored.sort((a, b) => {
    if (a.sameHare !== b.sameHare) return a.sameHare ? -1 : 1;
    return a.daysApart - b.daysApart;
  });

  return scored.slice(0, 6).map(({ row, sameHare }) => ({
    id: row.id,
    runNumber: row.run.runNumber,
    title: row.run.title,
    startsAt: row.run.startsAt,
    kennel: row.run.kennel,
    reason: sameHare ? ('SAME_HARE' as const) : ('SAME_KENNEL' as const),
  }));
}

async function serialize(actor: Actor | undefined, capsule: CapsuleRow, access: RunAccess) {
  const { isScribe, canGovern, canPublishReport } = authority(access, capsule.trailReport);
  const names = canSeeNames(access);
  // FR-CIRCLE-014: the Circle has its own audience, narrower than or equal to the
  // run's. It governs the songs and awards here, and the award entries the
  // timeline was built with.
  const circleVisible = await canSeeCircle(access);
  const published = FROZEN.includes(capsule.status);

  const [attendance, media, circle] = await Promise.all([
    prisma.participation.findMany({
      where: { runId: capsule.runId },
      select: {
        id: true,
        checkedInAt: true,
        isVisitor: true,
        rsvpStatus: true,
        user: { select: userPublicSelect },
        guest: { select: { firstName: true } },
      },
    }),
    prisma.mediaAsset.findMany({
      where: {
        links: { some: { targetType: MediaTargetType.RUN, targetId: capsule.runId } },
        uploadState: UploadState.AVAILABLE,
        moderationState: ModerationState.APPROVED,
      },
      orderBy: { createdAt: 'asc' },
      take: 24,
      // createdAt is upload time, not capture time (no EXIF pass exists yet),
      // so the Explorer's gallery-by-timeline-entry grouping (FR-EXPLORER-005)
      // is nearest-neighbour on upload order, not a claim about when the
      // photo was actually taken.
      select: { id: true, url: true, thumbnailUrl: true, caption: true, createdAt: true },
    }),
    prisma.circle.findUnique({
      where: { runId: capsule.runId },
      select: {
        songs: true,
        announcements: true,
        awards: {
          select: { id: true, title: true, reason: true, isDownDown: true, recipientName: true },
        },
      },
    }),
  ]);

  const checkedIn = attendance.filter((p) => p.checkedInAt);
  const lead = capsule.run.hares.find((h) => h.isLead) ?? capsule.run.hares[0];

  const related = published
    ? await relatedCapsules(capsule.run.kennelId, capsule.runId, capsule.run.startsAt, lead?.user.id ?? null)
    : [];

  return {
    id: capsule.id,
    runId: capsule.runId,
    status: capsule.status,
    isLegacyImport: capsule.isLegacyImport,
    summary: capsule.summary,
    publishedAt: capsule.publishedAt,
    archivedAt: capsule.archivedAt,
    // The cover page (08H-02 Hero Overview).
    hero: {
      runNumber: capsule.run.runNumber,
      title: capsule.run.title,
      theme: capsule.run.theme,
      startsAt: capsule.run.startsAt,
      timeZone: capsule.run.timeZone,
      place: [capsule.run.city, capsule.run.country].filter(Boolean).join(', '),
      kennel: capsule.run.kennel,
      leadHare: lead ? publicName(lead.user) : null,
      leadHareId: lead?.user.id ?? null,
      scribe: capsule.trailReport ? publicName(capsule.trailReport.officialScribe) : null,
      scribeId: capsule.trailReport?.officialScribe.id ?? null,
      // The full bench, not just the lead (08H-02 Participant Explorer).
      hares: capsule.run.hares.map((h) => ({ userId: h.user.id, name: publicName(h.user), isLead: h.isLead })),
      photo: media[0]?.thumbnailUrl ?? media[0]?.url ?? null,
    },
    timeline: ((capsule.timeline ?? []) as unknown as TimelineEntry[]).filter(
      (entry) => circleVisible || entry.kind !== 'AWARD',
    ),
    stats: {
      attended: checkedIn.length,
      visitors: checkedIn.filter((p) => p.isVisitor).length,
      guests: checkedIn.filter((p) => p.guest).length,
      hares: capsule.run.hares.length,
      photos: media.length,
      awards: circleVisible ? (circle?.awards.length ?? 0) : 0,
      songs: circleVisible ? (circle?.songs.length ?? 0) : 0,
    },
    // D23: who was there is for the hosting kennel.
    participants: names
      ? checkedIn.map((p) => ({
          id: p.id,
          userId: p.user?.id ?? null,
          name: p.user ? publicName(p.user) : `${p.guest?.firstName ?? 'A'} (guest)`,
          isVisitor: p.isVisitor,
        }))
      : null,
    circle: circleVisible ? circle : null,
    media,
    report: capsule.trailReport?.publishedAt
      ? {
          id: capsule.trailReport.id,
          title: capsule.trailReport.title,
          publishedAt: capsule.trailReport.publishedAt,
        }
      : null,
    // BR-CAPSULE-005: later additions, never mixed into the record.
    supplements: capsule.supplementals.map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      description: s.description,
      addedAt: s.addedAt,
      media: s.mediaAsset,
      contributedBy: publicName(s.contributor),
    })),
    // FR-CAPSULE-008: advisory, never blocking, and only for the people who
    // could act on it.
    health: canGovern || isScribe
      ? {
          missingReport: !capsule.trailReport?.publishedAt,
          missingCircle: !circle,
          noPhotos: media.length === 0,
          uncaptionedMedia: media.filter((m) => !m.caption).length,
        }
      : null,
    related,
    viewer: {
      canPublish: (isScribe || canGovern) && capsule.status === C.PENDING_PUBLICATION && canPublishReport,
      canArchive: canGovern && capsule.status === C.PUBLISHED,
      // Anyone in the pack may enrich a published capsule.
      canContribute: Boolean(actor) && access.isMember && published,
      awaitingReport: capsule.status === C.PENDING_PUBLICATION && !canPublishReport,
    },
  };
}

async function load(capsuleId: string) {
  if (!isUuid(capsuleId)) throw ApiError.notFound('Run Capsule not found');
  const capsule = await prisma.runCapsule.findUnique({ where: { id: capsuleId }, select: capsuleSelect });
  if (!capsule) throw ApiError.notFound('Run Capsule not found');
  return capsule;
}

// A capsule is as visible as the run it preserves (D30).
async function readable(actor: Actor | undefined, capsule: CapsuleRow) {
  const access = await getAccess(actor, capsule.runId);
  if (!canView(access)) throw ApiError.notFound('Run Capsule not found');
  return access;
}

// ─── Reads ───

export async function getForRun(actor: Actor | undefined, runId: string) {
  const access = await viewableAccess(actor, runId);
  let capsule = await prisma.runCapsule.findUnique({ where: { runId }, select: capsuleSelect });
  if (!capsule) return null;

  // Assemble on read while it is still growing, so a capsule is never stale in
  // front of a reader.
  if (ASSEMBLING.includes(capsule.status)) {
    await assemble(runId);
    capsule = await prisma.runCapsule.findUnique({ where: { runId }, select: capsuleSelect });
    if (!capsule) return null;
  }
  return serialize(actor, capsule, access);
}

export async function getCapsule(actor: Actor | undefined, capsuleId: string) {
  const capsule = await load(capsuleId);
  const access = await readable(actor, capsule);
  if (ASSEMBLING.includes(capsule.status)) {
    await assemble(capsule.runId);
    return serialize(actor, await load(capsuleId), access);
  }
  return serialize(actor, capsule, access);
}

export async function listCapsules(
  actor: Actor | undefined,
  opts: { kennelSlug?: string; page: number; limit: number },
) {
  const where: Prisma.RunCapsuleWhereInput = {
    status: { in: [C.PUBLISHED, C.ARCHIVED, C.LEGACY] },
    ...(opts.kennelSlug ? { run: { kennel: { slug: opts.kennelSlug } } } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.runCapsule.findMany({
      where,
      select: capsuleSelect,
      orderBy: { publishedAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.runCapsule.count({ where }),
  ]);

  const visible = [];
  for (const row of rows) {
    const access = await getAccess(actor, row.runId);
    if (!canView(access)) continue;
    visible.push({
      id: row.id,
      runId: row.runId,
      status: row.status,
      summary: row.summary,
      publishedAt: row.publishedAt,
      hero: {
        runNumber: row.run.runNumber,
        title: row.run.title,
        startsAt: row.run.startsAt,
        timeZone: row.run.timeZone,
        kennel: row.run.kennel,
      },
    });
  }
  return page(visible, total, opts.page, opts.limit);
}

// ─── Lifecycle ───

export async function transition(actor: Actor, capsuleId: string, action: string, input: { reason?: string | null }) {
  const capsule = await load(capsuleId);
  const access = await readable(actor, capsule);
  const { isScribe, canGovern, canPublishReport } = authority(access, capsule.trailReport);
  const now = new Date();

  if (action === 'publish') {
    if (capsule.status !== C.PENDING_PUBLICATION) {
      throw ApiError.badRequest(
        capsule.status === C.PUBLISHED || capsule.status === C.ARCHIVED
          ? 'This capsule is already part of the record.'
          : 'The run has to be over before its capsule can be published.',
        'INVALID_TRANSITION',
      );
    }
    if (!isScribe && !canGovern) {
      throw ApiError.forbidden('Only the Scribe or an officer publishes a capsule.', 'CAPSULE_AUTHORITY_REQUIRED');
    }
    // Ch.22 A.6: publication is gated on the Trail Report.
    if (!canPublishReport) {
      throw ApiError.badRequest(
        'Publish the Trail Report first: the capsule is built around it.',
        'REPORT_NOT_PUBLISHED',
      );
    }
  } else if (action === 'archive') {
    if (capsule.status !== C.PUBLISHED) {
      throw ApiError.badRequest('Only a published capsule is archived.', 'INVALID_TRANSITION');
    }
    if (!canGovern) throw ApiError.forbidden('Only officers archive a capsule.', 'OFFICER_REQUIRED');
    if (!input.reason?.trim()) throw ApiError.badRequest('A reason is required.', 'REASON_REQUIRED');
  } else {
    throw ApiError.badRequest('Unknown action', 'UNKNOWN_ACTION');
  }

  const publishing = action === 'publish';

  await prisma.$transaction(async (tx) => {
    await tx.runCapsule.update({
      where: { id: capsuleId },
      data: publishing
        ? { status: C.PUBLISHED, publishedAt: now, publishedById: actor.id }
        : { status: C.ARCHIVED, archivedAt: now },
    });
    const event = await recordEvent(tx, {
      eventType: publishing ? 'RunCapsulePublished' : 'RunCapsuleArchived',
      aggregateType: 'RunCapsule',
      aggregateId: capsuleId,
      actorId: actor.id,
      payload: {
        runId: capsule.runId,
        kennelId: capsule.run.kennelId,
        runNumber: capsule.run.runNumber,
        ...(input.reason ? { reason: input.reason.trim() } : {}),
      },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: publishing ? 'capsule.publish' : 'capsule.archive',
      resourceType: 'RunCapsule',
      resourceId: capsuleId,
      kennelId: capsule.run.kennelId,
      previousState: { status: capsule.status },
      newState: { status: publishing ? C.PUBLISHED : C.ARCHIVED },
      reason: input.reason?.trim() || null,
      policyRef: isScribe && !canGovern ? 'scribe' : (access.grants.get('report.publish') ?? 'kennel-admin'),
      domainEventId: event.id,
    });
  });

  return getCapsule(actor, capsuleId);
}

// ─── Enrichment (BR-CAPSULE-005, FR-CAPSULE-007) ───

export async function addSupplement(
  actor: Actor,
  capsuleId: string,
  input: { type: SupplementalType; title: string; description?: string | null; mediaAssetId?: string | null },
) {
  const capsule = await load(capsuleId);
  const access = await readable(actor, capsule);

  if (!FROZEN.includes(capsule.status)) {
    throw ApiError.badRequest(
      'The capsule is still being assembled. Add photos and stories to the run itself for now.',
      'CAPSULE_NOT_PUBLISHED',
    );
  }
  const member = await prisma.membership.findFirst({
    where: { userId: actor.id, kennelId: capsule.run.kennelId, status: MembershipStatus.ACTIVE },
    select: { id: true },
  });
  if (!member) {
    throw ApiError.forbidden('Only members of the hosting kennel add to its archive.', 'MEMBERS_ONLY');
  }
  if (input.mediaAssetId) {
    const media = await prisma.mediaAsset.findUnique({ where: { id: input.mediaAssetId }, select: { id: true } });
    if (!media) throw ApiError.badRequest('That media does not exist.', 'MEDIA_NOT_FOUND');
  }

  await prisma.$transaction(async (tx) => {
    const supplement = await tx.supplementalArtifact.create({
      data: {
        capsuleId,
        type: input.type,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        mediaAssetId: input.mediaAssetId ?? null,
        contributorId: actor.id,
      },
      select: { id: true },
    });
    await recordEvent(tx, {
      eventType: 'RunCapsuleSupplementAdded',
      aggregateType: 'RunCapsule',
      aggregateId: capsuleId,
      actorId: actor.id,
      payload: { runId: capsule.runId, supplementId: supplement.id, type: input.type },
    });
  });

  // Enrichment never changes the capsule's state (Ch.22 A.6).
  return getCapsule(actor, capsuleId);
}
