import prisma from '../config/prisma';
import { type Actor } from './permission.service';
import { publicName, userPublicSelect } from './run.service';
import { followableUser } from './follow.service';

// Annex 08J Part 5 — Community Analytics, scoped to what's honestly
// computable from data the platform already has: a hasher's own attendance
// pattern (FR-COMMUNITY-034's "Co-Hares" collaboration network, applied to
// one person) and a kennel's membership growth (FR-COMMUNITY-031). Everything
// else in 08J-04 — mentorship networks, Legacy Profiles, tributes, an AI
// heritage assistant, a knowledge base — needs a concept (mentorship, a
// deceased-member policy) or a corpus this platform does not have yet.
//
// Computed live rather than through a materialized rollup: the same
// "corpus is small, rank in memory" reasoning as capsule.service#relatedCapsules
// and search.service.ts.

const MONTHS_BACK = 12;

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function last12Months(): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ key: monthKey(d), label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }) });
  }
  return months;
}

// ─── A hasher's own pattern (public identity only, D11; PRIVATE profiles are
// not analyzed for anyone but themselves, same rule as the rest of D50) ───

export async function getHasherDna(actor: Actor | undefined, userId: string) {
  const user = await followableUser(actor, userId);
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (MONTHS_BACK - 1), 1));

  const [attendance, hareRuns] = await Promise.all([
    prisma.participation.findMany({
      where: { userId: user.id, checkedInAt: { not: null } },
      select: {
        checkedInAt: true,
        run: { select: { startsAt: true, kennel: { select: { id: true, slug: true, shortName: true, primaryColor: true } } } },
      },
    }),
    prisma.runHare.findMany({ where: { userId: user.id }, select: { runId: true } }),
  ]);

  // Monthly trend: the last 12 calendar months, zero-filled.
  const months = last12Months();
  const monthCounts = new Map(months.map((m) => [m.key, 0]));
  for (const p of attendance) {
    const at = p.checkedInAt ?? p.run.startsAt;
    if (at < since) continue;
    const key = monthKey(at);
    if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const trend = months.map((m) => ({ month: m.label, count: monthCounts.get(m.key) ?? 0 }));

  // Top kennels by attendance, all-time.
  const kennelCounts = new Map<string, { slug: string; shortName: string; primaryColor: string | null; count: number }>();
  for (const p of attendance) {
    const k = p.run.kennel;
    const entry = kennelCounts.get(k.id) ?? { slug: k.slug, shortName: k.shortName, primaryColor: k.primaryColor, count: 0 };
    entry.count += 1;
    kennelCounts.set(k.id, entry);
  }
  const topKennels = [...kennelCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  // Co-hares: everyone who has laid trail alongside this hasher, most often first.
  const runIds = hareRuns.map((h) => h.runId);
  let topCoHares: { userId: string; name: string; count: number }[] = [];
  if (runIds.length > 0) {
    const coRows = await prisma.runHare.findMany({
      where: { runId: { in: runIds }, userId: { not: user.id } },
      select: { user: { select: userPublicSelect } },
    });
    const coCounts = new Map<string, { name: string; count: number }>();
    for (const row of coRows) {
      const entry = coCounts.get(row.user.id) ?? { name: publicName(row.user), count: 0 };
      entry.count += 1;
      coCounts.set(row.user.id, entry);
    }
    topCoHares = [...coCounts.entries()]
      .map(([id, v]) => ({ userId: id, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  return {
    trend,
    topKennels,
    topCoHares,
    trailsLaid: hareRuns.length,
    runsAttended: attendance.length,
  };
}

// ─── A kennel's growth (FR-COMMUNITY-031). Public: counts only, no member
// identities, so this is safe on a page a visitor reads without an account. ───

export async function getKennelGrowth(kennelId: string) {
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (MONTHS_BACK - 1), 1));
  const [joins, activeCount] = await Promise.all([
    prisma.membership.findMany({
      where: { kennelId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.membership.count({ where: { kennelId, status: 'ACTIVE' } }),
  ]);

  const months = last12Months();
  const monthCounts = new Map(months.map((m) => [m.key, 0]));
  for (const m of joins) {
    const key = monthKey(m.createdAt);
    if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const trend = months.map((m) => ({ month: m.label, count: monthCounts.get(m.key) ?? 0 }));

  return { trend, activeMemberCount: activeCount, newMembersLast12Months: joins.length };
}
