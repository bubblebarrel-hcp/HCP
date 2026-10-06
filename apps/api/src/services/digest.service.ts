import {
  AccountStatus,
  DeliveryChannel,
  DeliveryStatus,
  DigestFrequency,
  NotificationCategory,
  NotificationPriority,
} from '@prisma/client';
import prisma from '../config/prisma';
import { DIGEST_LABELS, isDue } from '../utils/digest-schedule';
import { logger } from '../utils/logger';
import { sendEmail } from './email.service';
import { sendPush } from './push.service';
import { evaluateQuietHours } from './quiet-hours';

// FR-NOT-007. Email and push for notices that can wait are held (a delivery in
// status HELD) when a hasher asked for their category in a digest, and one
// message per channel goes out when the digest is due.
//
// What is due is decided from the clock alone (utils/digest-schedule.ts), so
// this sweep is safe to run as often as you like, from more than one place, and
// after a restart: the same answer comes out. Nothing here changes what a
// notification says in the app; the inbox copy was delivered when it happened.

export interface DigestTransport {
  email: typeof sendEmail;
  push: typeof sendPush;
}

const live: DigestTransport = { email: sendEmail, push: sendPush };

const CATEGORY_WORDS: Record<string, string> = {
  MEMBERSHIP: 'Membership',
  RUN: 'Runs',
  TRAIL_RELEASE: 'Trail releases',
  REMINDER: 'Reminders',
  REPORT: 'Trail reports',
  ANNOUNCEMENT: 'Announcements',
  GOVERNANCE: 'Governance',
  EVENT: 'Events',
  MEDIA: 'Photos and reels',
  SAFETY: 'Safety',
  SOCIAL: 'Followers and applause',
  SYSTEM: 'Shiggy Trails',
};

interface Held {
  id: string;
  channel: DeliveryChannel;
  createdAt: Date;
  notification: {
    id: string;
    recipientUserId: string | null;
    category: NotificationCategory;
    title: string;
    body: string;
    readAt: Date | null;
    evaluationReason: string | null;
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function composeEmail(items: Held[]) {
  const byCategory = new Map<NotificationCategory, Held[]>();
  for (const item of items) {
    const list = byCategory.get(item.notification.category) ?? [];
    list.push(item);
    byCategory.set(item.notification.category, list);
  }
  const paragraphs: string[] = [];
  for (const [category, list] of byCategory) {
    paragraphs.push(`${CATEGORY_WORDS[category] ?? category} (${list.length})`);
    for (const item of list) paragraphs.push(`• ${item.notification.title}. ${item.notification.body}`);
  }
  return {
    subject: `Your Shiggy Trails digest: ${plural(items.length, 'update')}`,
    body: items.map((i) => i.notification.title).join('. '),
    paragraphs,
  };
}

export function composePush(items: Held[]) {
  const first = items[0].notification.title;
  return {
    title: `${plural(items.length, 'update')} on Shiggy Trails`,
    body: items.length === 1 ? first : `${first}, and ${plural(items.length - 1, 'more')}`,
  };
}

async function mark(
  ids: string[],
  status: DeliveryStatus,
  extra: { providerMessageId?: string | null; error?: string | null } = {},
) {
  await prisma.notificationDelivery.updateMany({
    where: { id: { in: ids } },
    data: {
      status,
      providerMessageId: extra.providerMessageId ?? null,
      error: extra.error ?? null,
      attemptedAt: new Date(),
    },
  });
}

// FR-NOT-010: the explanation says what became of the held copy.
async function explain(items: Held[], sentence: string) {
  for (const item of items) {
    await prisma.notification.update({
      where: { id: item.notification.id },
      data: { evaluationReason: `${item.notification.evaluationReason ?? ''} ${sentence}`.trim() },
    });
  }
}

export interface DigestSummary {
  held: number;
  emails: number;
  pushes: number;
  skippedRead: number;
  deferred: number;
}

// `userIds` limits a sweep to some hashers. The timer never passes it; it is for a
// check that must not send someone else's held mail.
export async function sendDueDigests(
  now = new Date(),
  transport: DigestTransport = live,
  userIds?: string[],
): Promise<DigestSummary> {
  const summary: DigestSummary = { held: 0, emails: 0, pushes: 0, skippedRead: 0, deferred: 0 };

  const rows = (await prisma.notificationDelivery.findMany({
    where: {
      status: DeliveryStatus.HELD,
      channel: { in: [DeliveryChannel.EMAIL, DeliveryChannel.PUSH] },
      ...(userIds ? { notification: { recipientUserId: { in: userIds } } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 5000,
    select: {
      id: true,
      channel: true,
      createdAt: true,
      notification: {
        select: { id: true, recipientUserId: true, category: true, title: true, body: true, readAt: true, evaluationReason: true },
      },
    },
  })) as Held[];
  summary.held = rows.length;
  if (rows.length === 0) return summary;

  const byUser = new Map<string, Held[]>();
  for (const row of rows) {
    const userId = row.notification.recipientUserId;
    if (!userId) continue;
    const list = byUser.get(userId) ?? [];
    list.push(row);
    byUser.set(userId, list);
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [...byUser.keys()] } },
    select: { id: true, email: true, timeZone: true, status: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  const prefs = await prisma.notificationDigestPreference.findMany({
    where: { userId: { in: [...byUser.keys()] } },
    select: { userId: true, category: true, frequency: true },
  });
  const frequencyOf = (userId: string, category: NotificationCategory) =>
    prefs.find((p) => p.userId === userId && p.category === category)?.frequency ?? DigestFrequency.IMMEDIATE;

  for (const [userId, items] of byUser) {
    try {
      const user = userById.get(userId);

      // Nobody to send to: a deactivated or deleted account gets no mail.
      if (!user || user.status !== AccountStatus.ACTIVE) {
        await mark(items.map((i) => i.id), DeliveryStatus.SKIPPED, { error: 'Account is not active' });
        continue;
      }

      // Read in the app already: sending it again is noise, not a digest.
      const read = items.filter((i) => i.notification.readAt);
      if (read.length > 0) {
        await mark(read.map((i) => i.id), DeliveryStatus.SKIPPED, { error: 'Read in the app before the digest' });
        summary.skippedRead += read.length;
      }
      const unread = items.filter((i) => !i.notification.readAt);

      for (const channel of [DeliveryChannel.EMAIL, DeliveryChannel.PUSH]) {
        const due = unread.filter(
          (i) =>
            i.channel === channel &&
            isDue(frequencyOf(userId, i.notification.category), user.timeZone, i.createdAt, now),
        );
        if (due.length === 0) continue;
        const ids = due.map((d) => d.id);
        // A digest names the schedule that released it, so the explanation is true.
        const freq = frequencyOf(userId, due[0].notification.category);
        const label = DIGEST_LABELS[freq];

        if (channel === DeliveryChannel.EMAIL) {
          const mail = composeEmail(due);
          const result = await transport.email({
            to: user.email,
            subject: mail.subject,
            body: mail.body,
            paragraphs: mail.paragraphs,
            action: { label: 'Open Shiggy Trails', path: '/' },
          });
          await mark(ids, result.sent ? DeliveryStatus.SENT : DeliveryStatus.FAILED, {
            providerMessageId: result.providerMessageId,
            error: result.error,
          });
          if (result.sent) {
            summary.emails++;
            await explain(due, `Sent by email in your ${label} digest.`);
          }
        } else {
          // Quiet hours are judged now, when the buzz would happen. A held push
          // simply waits for the next sweep outside the window.
          const quiet = await evaluateQuietHours(userId, NotificationPriority.NORMAL, user.timeZone, now);
          if (quiet.suppressed) {
            summary.deferred += due.length;
            continue;
          }
          const msg = composePush(due);
          const result = await transport.push(userId, {
            ...msg,
            data: { digest: true, count: due.length },
            priority: 'default',
          });
          await mark(ids, result.sent > 0 ? DeliveryStatus.SENT : DeliveryStatus.FAILED, {
            providerMessageId: result.providerMessageId,
            error: result.error,
          });
          if (result.sent > 0) {
            summary.pushes++;
            await explain(due, `Pushed in your ${label} digest.`);
          }
        }
      }
    } catch (err) {
      // One hasher's failure must not hold up everyone else's digest.
      logger.error('Digest failed for a hasher', { userId, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return summary;
}

// ─── The sweep ───

// Ten minutes: fine enough that "every hour" lands near the hour and "every
// morning" near eight, coarse enough to be one cheap query most of the time.
const INTERVAL_MS = 10 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await sendDueDigests();
  } catch (err) {
    logger.error('Digest sweep failed', { message: err instanceof Error ? err.message : String(err) });
  } finally {
    running = false;
  }
}

export function startDigestSweeper() {
  if (timer) return;
  timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref?.();
  logger.info(`Digest sweeper started (every ${INTERVAL_MS / 60000} minutes)`);
}

export function stopDigestSweeper() {
  if (timer) clearInterval(timer);
  timer = null;
}
