import { Prisma, ReleaseMode, TrailStatus } from '@prisma/client';
import { recordEvent } from './record.service';

// Trails follow their run (Ch.22 A.4 advances in lockstep with A.3). Kept in its
// own module so run.service can call it without importing trail.service, which
// imports run.service for access checks.

async function releaseTrails(
  tx: Prisma.TransactionClient,
  runId: string,
  modes: ReleaseMode[],
  actorId: string | null,
  now: Date,
  trigger: string,
) {
  const due = await tx.trail.findMany({
    where: { runId, status: TrailStatus.HIDDEN, releasedAt: null, releaseMode: { in: modes } },
    select: { id: true, releaseMode: true },
  });
  for (const trail of due) {
    await tx.trail.update({
      where: { id: trail.id },
      data: { status: TrailStatus.RELEASED, releasedAt: now, releasedById: actorId },
    });
    // D12: the consumer of this event alerts the hosting kennel's members and
    // everyone registered for the run. No consumer runs yet.
    await recordEvent(tx, {
      eventType: 'TrailReleased',
      aggregateType: 'Trail',
      aggregateId: trail.id,
      actorId,
      payload: { runId, releaseMode: trail.releaseMode, trigger },
    });
  }
}

async function advanceTrails(
  tx: Prisma.TransactionClient,
  runId: string,
  from: TrailStatus[],
  to: TrailStatus,
  eventType: string,
  actorId: string | null,
) {
  const trails = await tx.trail.findMany({ where: { runId, status: { in: from } }, select: { id: true } });
  for (const trail of trails) {
    await tx.trail.update({ where: { id: trail.id }, data: { status: to } });
    await recordEvent(tx, {
      eventType,
      aggregateType: 'Trail',
      aggregateId: trail.id,
      actorId,
      payload: { runId, toStatus: to },
    });
  }
}

// Called inside the run transition transaction.
export async function syncTrailsWithRun(
  tx: Prisma.TransactionClient,
  runId: string,
  action: string,
  actorId: string,
  now: Date,
) {
  switch (action) {
    case 'open-check-in':
      await releaseTrails(tx, runId, [ReleaseMode.CHECK_IN], actorId, now, 'check-in opened');
      break;
    case 'start':
      await releaseTrails(tx, runId, [ReleaseMode.AT_RUN_START], actorId, now, 'run start');
      await advanceTrails(tx, runId, [TrailStatus.RELEASED], TrailStatus.LIVE, 'TrailWentLive', actorId);
      break;
    case 'end':
      await advanceTrails(tx, runId, [TrailStatus.LIVE], TrailStatus.COMPLETED, 'TrailCompleted', actorId);
      break;
    case 'archive':
      await advanceTrails(
        tx,
        runId,
        [TrailStatus.COMPLETED, TrailStatus.RELEASED, TrailStatus.LIVE],
        TrailStatus.ARCHIVED,
        'TrailArchived',
        actorId,
      );
      break;
    default:
      break;
  }
}
