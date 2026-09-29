import { Client } from 'pg';

import { env } from '../config/env';
import prisma from '../config/prisma';
import { logger } from '../utils/logger';
import { fanOut } from './notification.service';
import { applyToPassport } from './passport.service';
import { applyToStory } from './story.service';
import { applyToCapsule } from './capsule.service';
import { applyRevalidation } from './revalidate.service';

// The transactional outbox consumer. Domain events are written in the same
// transaction as the change they describe; this drains them into notifications.
//
// It runs in-process on a timer: no Redis or message broker yet. That is fine
// for one API instance and is the piece to replace when the platform scales
// (Ch.24 leaves the transport to Phase 2/3).

const BATCH_SIZE = 50;
const INTERVAL_MS = 5_000;
// After this many failures an event is parked rather than retried forever.
const MAX_ATTEMPTS = 5;

let timer: NodeJS.Timeout | null = null;
let listener: Client | null = null;
let draining = false;

export async function drainOutbox() {
  // One drain at a time, so a slow batch cannot overlap the next tick.
  if (draining) return { handled: 0, failed: 0 };
  draining = true;
  let handled = 0;
  let failed = 0;

  try {
    const events = await prisma.domainEvent.findMany({
      where: { publishedAt: null, attempts: { lt: MAX_ATTEMPTS } },
      // Per-aggregate order is what Ch.24 guarantees; oldest first gives that.
      orderBy: { occurredAt: 'asc' },
      take: BATCH_SIZE,
    });

    for (const event of events) {
      try {
        // Consumers are independent and each is idempotent (Ch.24), so an event
        // that is redelivered is simply re-applied.
        const created = await fanOut(event);
        await applyToPassport(event);
        // Story collection (FR-STORY-001): the run writes its own timeline as
        // it happens, ready for the Scribe.
        await applyToStory(event);
        // Capsule assembly (FR-CAPSULE-002): the archive builds itself as the
        // run happens, and stops the moment it is published.
        await applyToCapsule(event);
        // Cache invalidation for the public pages. Deliberately last and
        // deliberately unable to throw: a web app that is down must not park a
        // domain event (see revalidate.service).
        await applyRevalidation(event);
        await prisma.domainEvent.update({ where: { id: event.id }, data: { publishedAt: new Date() } });
        handled++;
        if (created > 0) {
          logger.info?.('Outbox fanned out event', { eventType: event.eventType, notifications: created });
        }
      } catch (err) {
        failed++;
        await prisma.domainEvent.update({ where: { id: event.id }, data: { attempts: { increment: 1 } } });
        logger.error('Outbox event failed', {
          eventId: event.id,
          eventType: event.eventType,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    draining = false;
  }
  return { handled, failed };
}

async function startOutboxListener() {
  if (listener) return;

  try {
    const client = new Client({ connectionString: env.databaseUrl });
    listener = client;

    client.on('notification', () => {
      void drainOutbox();
    });

    client.on('error', (error) => {
      logger.warn?.('Outbox Postgres listener error', { message: error.message });
    });

    await client.connect();
    await client.query('LISTEN hcp_outbox_notify');

    logger.info('Outbox Postgres listener started on channel hcp_outbox_notify');
  } catch (error) {
    listener = null;
    logger.warn?.('Outbox Postgres listener unavailable; falling back to timer polling', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startOutbox() {
  if (timer) return;
  timer = setInterval(() => void drainOutbox(), INTERVAL_MS);
  // Never hold the process open just for the worker.
  timer.unref?.();

  void startOutboxListener();
  logger.info(`Outbox worker started (every ${INTERVAL_MS / 1000}s, with Postgres wake-up)`);
}

export async function stopOutbox() {
  if (timer) clearInterval(timer);
  timer = null;

  if (listener) {
    await listener.end();
    listener = null;
  }
}
