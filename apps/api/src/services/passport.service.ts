import { MembershipStatus, Prisma, type DomainEvent, RunType, TrailReportStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid } from '../utils/http';
import { displayName } from '../serializers/user';
import type { Actor } from './permission.service';
import { recordEvent } from './record.service';

// Hash Passport (Annex 08D section 4, Ch.23 Part A). Every hasher owns one from
// the moment they register, and it grows by itself.
//
// The passport is DERIVED, never authored: Chapter 24 makes it a consumer that
// never produces the facts it reflects. So rather than incrementing counters on
// each event, the whole passport is rebuilt from the source tables. That makes
// replay harmless and lets a passport that predates this code fill itself in.

export const MILESTONES = [10, 50, 100, 500, 1000];

// FR-PASSPORT-002
export const STAMPS = {
  FIRST_HASH: 'First Hash',
  FIRST_HARE: 'First Hare',
  FIRST_VISITING_KENNEL: 'First Visiting Kennel',
  FIRST_INTERNATIONAL: 'First International Run',
  RED_DRESS_RUN: 'Red Dress Run',
  CHARITY_RUN: 'Charity Run',
  FIRST_INTERHASH: 'Interhash',
  NASH_HASH: 'Nash Hash',
  FULL_MOON_RUN: 'Full Moon Run',
} as const;

export type StampCode = keyof typeof STAMPS;

const runTypeStamp: Partial<Record<RunType, StampCode>> = {
  RED_DRESS: 'RED_DRESS_RUN',
  CHARITY: 'CHARITY_RUN',
  INTERHASH: 'FIRST_INTERHASH',
  NASH_HASH: 'NASH_HASH',
  FULL_MOON: 'FULL_MOON_RUN',
};

export async function ensurePassport(userId: string) {
  const existing = await prisma.hashPassport.findUnique({ where: { userId }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.hashPassport.create({ data: { userId }, select: { id: true } });
  return created.id;
}

// ─── Rebuild ───

interface Earned {
  code: StampCode;
  runId: string | null;
  awardedAt: Date;
}

export async function rebuildPassport(userId: string) {
  const passportId = await ensurePassport(userId);

  const [user, attendances, hareRuns, memberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { homeKennel: { select: { country: true } } },
    }),
    prisma.participation.findMany({
      where: { userId, checkedInAt: { not: null } },
      orderBy: { checkedInAt: 'asc' },
      select: {
        checkedInAt: true,
        isVisitor: true,
        run: {
          select: {
            id: true,
            runType: true,
            // A run carries country and city only; PlaceVisited keeps an empty
            // state/province rather than inventing one.
            country: true,
            city: true,
            kennelId: true,
            startsAt: true,
            trails: { select: { estimatedDistanceM: true }, orderBy: { createdAt: 'asc' }, take: 1 },
          },
        },
      },
    }),
    prisma.runHare.findMany({
      where: { userId },
      orderBy: { addedAt: 'asc' },
      select: { runId: true, addedAt: true, run: { select: { status: true } } },
    }),
    prisma.membership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      select: { kennelId: true },
    }),
  ]);

  const homeCountry = user?.homeKennel?.country ?? null;
  const earned: Earned[] = [];
  const add = (code: StampCode, runId: string | null, awardedAt: Date) => {
    if (!earned.some((e) => e.code === code)) earned.push({ code, runId, awardedAt });
  };

  // Places (FR-PASSPORT-003) and stamps, in the order they happened.
  const places = new Map<string, { country: string; stateProvince: string; city: string; kennelId: string | null; firstVisitedAt: Date }>();
  for (const attendance of attendances) {
    const at = attendance.checkedInAt!;
    const run = attendance.run;

    if (earned.length === 0) add('FIRST_HASH', run.id, at);
    if (attendance.isVisitor) add('FIRST_VISITING_KENNEL', run.id, at);
    if (homeCountry && run.country && run.country !== homeCountry) add('FIRST_INTERNATIONAL', run.id, at);
    const typeStamp = runTypeStamp[run.runType];
    if (typeStamp) add(typeStamp, run.id, at);

    const key = `${run.country}|${run.city ?? ''}`;
    if (!places.has(key)) {
      places.set(key, {
        country: run.country,
        stateProvince: '',
        city: run.city ?? '',
        kennelId: run.kennelId,
        firstVisitedAt: at,
      });
    }
  }

  // Laying a trail counts once the run exists, not only once it is run.
  const firstHare = hareRuns[0];
  if (firstHare) add('FIRST_HARE', firstHare.runId, firstHare.addedAt);

  const runsAttended = attendances.length;
  const distanceMeters = attendances.reduce((sum, a) => sum + (a.run.trails[0]?.estimatedDistanceM ?? 0), 0);
  const countriesHashed = new Set([...places.values()].map((p) => p.country)).size;

  // Reports written credits the Official Scribe of each published report (D29),
  // not whoever pressed publish.
  const reportsWritten = await prisma.trailReport.count({
    where: { officialScribeId: userId, status: { in: [TrailReportStatus.PUBLISHED, TrailReportStatus.ARCHIVED] } },
  });

  const reachedMilestones = MILESTONES.filter((threshold) => runsAttended >= threshold).map((threshold) => ({
    threshold,
    runId: attendances[threshold - 1]?.run.id ?? null,
    reachedAt: attendances[threshold - 1]?.checkedInAt ?? new Date(),
  }));

  const [existingStamps, existingMilestones] = await Promise.all([
    prisma.passportStamp.findMany({ where: { passportId }, select: { code: true } }),
    prisma.passportMilestone.findMany({ where: { passportId }, select: { threshold: true } }),
  ]);
  const haveStamps = new Set(existingStamps.map((s) => s.code));
  const haveMilestones = new Set(existingMilestones.map((m) => m.threshold));

  const newStamps = earned.filter((e) => !haveStamps.has(e.code));
  const newMilestones = reachedMilestones.filter((m) => !haveMilestones.has(m.threshold));

  await prisma.$transaction(async (tx) => {
    for (const stamp of newStamps) {
      await tx.passportStamp.create({
        data: { passportId, code: stamp.code, runId: stamp.runId, awardedAt: stamp.awardedAt },
      });
      await tx.identityTimelineEntry.create({
        data: {
          userId,
          type: 'AWARD',
          title: `Passport stamp: ${STAMPS[stamp.code]}`,
          refType: stamp.runId ? 'Run' : null,
          refId: stamp.runId,
          occurredAt: stamp.awardedAt,
        },
      });
      await recordEvent(tx, {
        eventType: 'PassportStampAwarded',
        aggregateType: 'HashPassport',
        aggregateId: passportId,
        // The passport never has a human actor: it reflects what already happened.
        actorId: null,
        payload: { userId, code: stamp.code, runId: stamp.runId },
      });
    }

    for (const milestone of newMilestones) {
      await tx.passportMilestone.create({
        data: { passportId, threshold: milestone.threshold, runId: milestone.runId, reachedAt: milestone.reachedAt },
      });
      await tx.identityTimelineEntry.create({
        data: {
          userId,
          type: 'MILESTONE',
          title: `${milestone.threshold} runs`,
          refType: milestone.runId ? 'Run' : null,
          refId: milestone.runId,
          occurredAt: milestone.reachedAt,
        },
      });
      await recordEvent(tx, {
        eventType: 'PassportMilestoneReached',
        aggregateType: 'HashPassport',
        aggregateId: passportId,
        actorId: null,
        payload: { userId, threshold: milestone.threshold, runId: milestone.runId },
      });
    }

    for (const place of places.values()) {
      const existing = await tx.placeVisited.findFirst({
        where: {
          passportId,
          country: place.country,
          stateProvince: place.stateProvince,
          city: place.city,
        },
        select: { id: true },
      });
      if (!existing) await tx.placeVisited.create({ data: { passportId, ...place } });
    }

    // FR-PASSPORT-005. Beer checks, photos and videos still have no source to
    // derive from; they stay at zero rather than guessing.
    await tx.hashPassport.update({
      where: { id: passportId },
      data: {
        runsAttended,
        trailsLaid: hareRuns.length,
        countriesHashed,
        kennelsJoined: memberships.length,
        distanceMeters,
        reportsWritten,
        statsUpdatedAt: new Date(),
      },
    });
  });

  return passportId;
}

// ─── Outbox consumer ───

// Which hashers' passports an event touches.
function affectedUsers(event: DomainEvent): string[] {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const userId = typeof payload.userId === 'string' ? payload.userId : null;

  switch (event.eventType) {
    case 'ParticipantCheckedIn':
    case 'ParticipantCheckInReverted':
    case 'HareAssigned':
    case 'HareRemoved':
    case 'MembershipApproved':
    case 'MembershipRemoved':
    case 'MembershipResigned':
      return userId ? [userId] : [];
    // A published or corrected report changes the Scribe's tally (D29).
    case 'TrailReportPublished':
    case 'TrailReportArchived':
    case 'TrailReportRevised': {
      const scribeId = typeof payload.scribeId === 'string' ? payload.scribeId : null;
      return scribeId ? [scribeId] : [];
    }
    default:
      return [];
  }
}

export async function applyToPassport(event: DomainEvent) {
  const users = affectedUsers(event);
  for (const userId of users) await rebuildPassport(userId);
  return users.length;
}

// ─── Reads ───

const STALE_MS = 5 * 60 * 1000;

async function loadPassport(userId: string) {
  const passportId = await ensurePassport(userId);
  const current = await prisma.hashPassport.findUniqueOrThrow({
    where: { id: passportId },
    select: { statsUpdatedAt: true },
  });
  // Passports that predate the consumer, or have gone stale, fill themselves in.
  if (!current.statsUpdatedAt || Date.now() - current.statsUpdatedAt.getTime() > STALE_MS) {
    await rebuildPassport(userId);
  }

  return prisma.hashPassport.findUniqueOrThrow({
    where: { id: passportId },
    select: {
      id: true,
      shareToken: true,
      runsAttended: true,
      trailsLaid: true,
      beerChecks: true,
      reportsWritten: true,
      photosUploaded: true,
      videosUploaded: true,
      countriesHashed: true,
      kennelsJoined: true,
      distanceMeters: true,
      statsUpdatedAt: true,
      createdAt: true,
      user: { select: { id: true, hashHandle: true, createdAt: true, person: { select: { firstName: true } } } },
      stamps: { orderBy: { awardedAt: 'asc' }, select: { id: true, code: true, runId: true, awardedAt: true } },
      milestones: { orderBy: { threshold: 'asc' }, select: { id: true, threshold: true, runId: true, reachedAt: true } },
      places: {
        orderBy: { firstVisitedAt: 'asc' },
        select: { id: true, country: true, stateProvince: true, city: true, kennelId: true, firstVisitedAt: true },
      },
      memories: {
        orderBy: { pinnedAt: 'desc' },
        select: { id: true, kind: true, title: true, note: true, refType: true, refId: true, pinnedAt: true },
      },
    },
  });
}

type PassportRow = Awaited<ReturnType<typeof loadPassport>>;

function serialize(passport: PassportRow, opts: { includePrivate: boolean }) {
  const { user, shareToken, memories, ...rest } = passport;
  return {
    ...rest,
    shareToken: opts.includePrivate ? shareToken : null,
    hasher: {
      id: user.id,
      displayName: displayName(user.hashHandle, user.person?.firstName),
      hashingSince: user.createdAt,
    },
    stamps: passport.stamps.map((s) => ({ ...s, label: STAMPS[s.code as StampCode] ?? s.code })),
    // Memories are the hasher's own notes; a shared passport does not include them.
    memories: opts.includePrivate ? memories : [],
  };
}

export async function getMyPassport(actor: Actor) {
  return serialize(await loadPassport(actor.id), { includePrivate: true });
}

// FR-PASSPORT-007: a read-only link. The token is the whole secret, so it is
// rotatable and never exposed on someone else's view.
export async function getSharedPassport(shareToken: string) {
  if (!isUuid(shareToken)) throw ApiError.notFound('Passport not found');
  const found = await prisma.hashPassport.findUnique({
    where: { shareToken },
    select: { userId: true, user: { select: { status: true, deactivatedAt: true, deletedAt: true } } },
  });
  if (!found) throw ApiError.notFound('Passport not found');
  // Somebody who has stepped away or left has no public page, and a link to a
  // passport is a public page (D57).
  if (found.user.status !== 'ACTIVE' || found.user.deactivatedAt || found.user.deletedAt) {
    throw ApiError.notFound('Passport not found');
  }
  return serialize(await loadPassport(found.userId), { includePrivate: false });
}

export async function rotateShareToken(actor: Actor) {
  const passportId = await ensurePassport(actor.id);
  const updated = await prisma.hashPassport.update({
    where: { id: passportId },
    data: { shareToken: crypto.randomUUID() },
    select: { shareToken: true },
  });
  return updated;
}

// ─── Memories (FR-PASSPORT-006) ───

export const MEMORY_KINDS = ['FAVORITE_TRAIL', 'FAVORITE_BEER_STOP', 'FAVORITE_PHOTO', 'NOTE'];

export async function addMemory(
  actor: Actor,
  input: { kind: string; title: string; note?: string | null; refType?: string | null; refId?: string | null },
) {
  const passportId = await ensurePassport(actor.id);
  const count = await prisma.passportMemory.count({ where: { passportId } });
  if (count >= 200) throw ApiError.conflict('That is a lot of memories. Remove one first.', 'TOO_MANY_MEMORIES');

  await prisma.passportMemory.create({
    data: {
      passportId,
      kind: input.kind,
      title: input.title.trim(),
      note: input.note?.trim() || null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
    },
  });
}

export async function removeMemory(actor: Actor, memoryId: string) {
  if (!isUuid(memoryId)) throw ApiError.notFound('Memory not found');
  const passportId = await ensurePassport(actor.id);
  const { count } = await prisma.passportMemory.deleteMany({ where: { id: memoryId, passportId } });
  if (count === 0) throw ApiError.notFound('Memory not found');
}

// The hasher's own timeline (Ch.23 IdentityTimeline).
export async function getTimeline(actor: Actor) {
  const rows = await prisma.identityTimelineEntry.findMany({
    where: { userId: actor.id },
    orderBy: { occurredAt: 'desc' },
    take: 100,
    select: { id: true, type: true, title: true, refType: true, refId: true, occurredAt: true },
  });
  return rows;
}
