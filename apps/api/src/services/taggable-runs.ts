import prisma from '../config/prisma';
import type { Actor } from './permission.service';
import { canView, getAccess } from './run.service';

// Runs a hasher might be writing about (D60): the ones they went to and the ones
// their kennels held, lately, and only those they may see.
export async function taggableRuns(actor: Actor) {
  const now = Date.now();
  const rows = await prisma.run.findMany({
    where: {
      cancelledAt: null,
      startsAt: { gte: new Date(now - 60 * 24 * 60 * 60 * 1000), lte: new Date(now + 24 * 60 * 60 * 1000) },
      OR: [
        { participations: { some: { userId: actor.id } } },
        { kennel: { memberships: { some: { userId: actor.id, status: 'ACTIVE' } } } },
      ],
    },
    orderBy: { startsAt: 'desc' },
    take: 25,
    select: {
      id: true,
      runNumber: true,
      title: true,
      startsAt: true,
      kennel: { select: { id: true, slug: true, shortName: true } },
    },
  });
  const visible: typeof rows = [];
  for (const row of rows) {
    if (canView(await getAccess(actor, row.id))) visible.push(row);
    if (visible.length >= 12) break;
  }
  return visible;
}
