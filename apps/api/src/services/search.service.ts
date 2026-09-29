import { CapsuleStatus, Prisma, ProfileVisibility, TrailReportStatus } from '@prisma/client';
import prisma from '../config/prisma';
import type { Actor } from './permission.service';
import { publicName, userPublicSelect, visibleRunsWhere } from './run.service';
import * as kennels from './kennel.service';

// Annex 08Q, scoped down to what the platform actually has at this stage: a
// keyword search across the five domains a hasher would plausibly look for —
// kennels, runs, trail reports, hashers, run capsules. Everything else the
// annex lists (governance records, evidence records, conversations, a
// knowledge graph, semantic/voice search) needs infrastructure or corpus
// size this platform does not have yet.
//
// "Permission-aware results" (08Q's own guiding principle) means every query
// here nests the same visibility rule the domain's own listing endpoint uses
// — `visibleRunsWhere` for runs and anything hung off a run, `discoverableWhere`
// (via kennel.service#listPublic) for kennels, and the platform's existing
// "PRIVATE profile, unless it's you" rule for hashers.

const contains = (q: string): Prisma.StringFilter => ({ contains: q, mode: 'insensitive' });

const FROZEN_CAPSULE: CapsuleStatus[] = [CapsuleStatus.PUBLISHED, CapsuleStatus.ARCHIVED, CapsuleStatus.LEGACY];

async function searchRuns(actor: Actor | undefined, q: string, limit: number) {
  const visible = await visibleRunsWhere(actor);
  const rows = await prisma.run.findMany({
    where: { AND: [visible, { OR: [{ title: contains(q) }, { theme: contains(q) }] }] },
    select: {
      id: true,
      runNumber: true,
      title: true,
      theme: true,
      startsAt: true,
      timeZone: true,
      kennel: { select: { slug: true, shortName: true, primaryColor: true } },
    },
    orderBy: { startsAt: 'desc' },
    take: limit,
  });
  return rows;
}

async function searchReports(actor: Actor | undefined, q: string, limit: number) {
  const visibleRun = await visibleRunsWhere(actor);
  const rows = await prisma.trailReport.findMany({
    where: {
      status: { in: [TrailReportStatus.PUBLISHED, TrailReportStatus.ARCHIVED] },
      run: visibleRun,
      OR: [{ title: contains(q) }, { body: contains(q) }],
    },
    select: {
      id: true,
      title: true,
      publishedAt: true,
      run: { select: { runNumber: true, kennel: { select: { slug: true, shortName: true, primaryColor: true } } } },
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
  return rows;
}

async function searchHashers(actor: Actor | undefined, q: string, limit: number) {
  // Only named hashers are searchable by handle — "Just <firstName>" has no
  // stable public name to type into a search box (D5/D11), and firstName
  // itself is private biodata, never queried here.
  const rows = await prisma.user.findMany({
    where: { status: 'ACTIVE', deactivatedAt: null, hashHandle: contains(q) },
    select: { ...userPublicSelect, avatarUrl: true, profileVisibility: true, homeKennel: { select: { slug: true, shortName: true, primaryColor: true } } },
    take: limit * 2,
  });
  return rows
    .filter((u) => u.profileVisibility !== ProfileVisibility.PRIVATE || u.id === actor?.id)
    .slice(0, limit)
    .map((u) => ({ id: u.id, name: publicName(u), avatarUrl: u.avatarUrl, homeKennel: u.homeKennel }));
}

async function searchCapsules(actor: Actor | undefined, q: string, limit: number) {
  const visibleRun = await visibleRunsWhere(actor);
  const rows = await prisma.runCapsule.findMany({
    where: {
      status: { in: FROZEN_CAPSULE },
      run: { AND: [visibleRun, { OR: [{ title: contains(q) }, { theme: contains(q) }] }] },
    },
    select: {
      id: true,
      summary: true,
      publishedAt: true,
      run: {
        select: { runNumber: true, title: true, startsAt: true, kennel: { select: { slug: true, shortName: true, primaryColor: true } } },
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
  return rows;
}

export async function globalSearch(actor: Actor | undefined, q: string, limit: number) {
  const query = q.trim();
  const [kennelPage, runs, reports, hashers, capsules] = await Promise.all([
    kennels.listPublic({ page: 1, limit, q: query }),
    searchRuns(actor, query, limit),
    searchReports(actor, query, limit),
    searchHashers(actor, query, limit),
    searchCapsules(actor, query, limit),
  ]);

  const results = { kennels: kennelPage.items, runs, reports, hashers, capsules };
  return {
    query,
    ...results,
    total: Object.values(results).reduce((sum, list) => sum + list.length, 0),
  };
}
