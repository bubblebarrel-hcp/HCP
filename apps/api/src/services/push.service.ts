import { DevicePlatform } from '@prisma/client';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Push delivery through Expo's push service (D12's remaining launch blocker).
//
// Expo sits in front of APNs and FCM, which is what the mobile app already
// talks to, and its send API is a plain HTTP POST — no SDK, no new dependency,
// and nothing to rotate but an optional access token. Unlike Resend there is no
// key to make it "configured": a hasher who has registered a device can be
// pushed to, and one who has not simply cannot. So `isPushConfigured` is about
// whether the platform can send at all, and the per-recipient question is
// whether they have a live device.

const EXPO_SEND = 'https://exp.host/--/api/v2/push/send';
// Expo accepts at most 100 messages per request.
const CHUNK = 100;
const TIMEOUT_MS = 10_000;

export interface PushMessage {
  title: string;
  body: string;
  // Travels with the notification so a tap can open the thing it is about.
  data?: Record<string, unknown>;
  priority?: 'default' | 'high';
}

export interface PushResult {
  sent: number;
  failed: number;
  providerMessageId?: string;
  error?: string;
}

export function isPushConfigured() {
  return env.push.enabled;
}

// An Expo token looks like ExponentPushToken[xxxxxxxx] or ExpoPushToken[...].
// Checking the shape here keeps obviously-wrong values out of the table, so a
// send failure means a real delivery problem rather than a typo.
export function isExpoPushToken(token: string) {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

async function postChunk(messages: unknown[]): Promise<ExpoTicket[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(EXPO_SEND, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(env.push.accessToken ? { Authorization: `Bearer ${env.push.accessToken}` } : {}),
      },
      body: JSON.stringify(messages),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Expo push returned ${res.status}`);
    }
    const json = (await res.json()) as { data?: ExpoTicket[]; errors?: { message: string }[] };
    if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
    return json.data ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * A token Expo reports as dead is retired rather than deleted: the row is the
 * evidence of what was tried, and History is append-only. A device that comes
 * back simply registers again and gets a fresh row.
 */
async function revokeToken(pushToken: string, reason: string) {
  await prisma.pushDevice.updateMany({
    where: { pushToken, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  logger.info?.('Retired a dead push token', { reason });
}

/** Live devices for a hasher. A revoked device is not a device. */
export async function devicesFor(userId: string) {
  return prisma.pushDevice.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, pushToken: true, platform: true },
  });
}

/**
 * Send one message to every live device a hasher has. Never throws: a push
 * provider having a bad day must not take down the outbox or the request that
 * triggered it, and the delivery row records what happened.
 */
export async function sendPush(userId: string, message: PushMessage): Promise<PushResult> {
  if (!env.push.enabled) return { sent: 0, failed: 0, error: 'Push is disabled' };

  const devices = await devicesFor(userId);
  if (devices.length === 0) return { sent: 0, failed: 0, error: 'No registered device' };

  const payloads = devices.map((d) => ({
    to: d.pushToken,
    title: message.title,
    body: message.body,
    data: message.data ?? {},
    sound: 'default',
    // Android needs a channel to make a high-priority notification audible.
    ...(d.platform === DevicePlatform.ANDROID ? { channelId: 'default' } : {}),
    priority: message.priority ?? 'default',
  }));

  let sent = 0;
  let failed = 0;
  let firstId: string | undefined;
  const errors: string[] = [];

  for (let i = 0; i < payloads.length; i += CHUNK) {
    const slice = payloads.slice(i, i + CHUNK);
    let tickets: ExpoTicket[];
    try {
      tickets = await postChunk(slice);
    } catch (err) {
      failed += slice.length;
      errors.push(err instanceof Error ? err.message : String(err));
      continue;
    }

    for (let j = 0; j < slice.length; j++) {
      const ticket = tickets[j];
      const token = devices[i + j]?.pushToken;
      if (ticket?.status === 'ok') {
        sent++;
        firstId ??= ticket.id;
        continue;
      }
      failed++;
      const detail = ticket?.details?.error;
      if (detail) errors.push(detail);
      else if (ticket?.message) errors.push(ticket.message);
      // The device uninstalled the app or the token was reissued. Keeping it
      // would mean failing every future send to this hasher.
      if (detail === 'DeviceNotRegistered' && token) {
        await revokeToken(token, detail);
      }
    }
  }

  return {
    sent,
    failed,
    providerMessageId: firstId,
    error: errors.length ? [...new Set(errors)].join('; ').slice(0, 500) : undefined,
  };
}

/** Register or refresh a device. Re-registering the same token moves it to
 * whoever is signed in now, which is what a shared handset should do. */
export async function registerDevice(userId: string, pushToken: string, platform: DevicePlatform) {
  const existing = await prisma.pushDevice.findUnique({ where: { pushToken } });
  if (existing) {
    return prisma.pushDevice.update({
      where: { pushToken },
      data: { userId, platform, lastSeenAt: new Date(), revokedAt: null },
      select: { id: true, platform: true, lastSeenAt: true, createdAt: true },
    });
  }
  return prisma.pushDevice.create({
    data: { userId, pushToken, platform },
    select: { id: true, platform: true, lastSeenAt: true, createdAt: true },
  });
}

/** Signing out retires the device so the next person holding the phone does
 * not get someone else's mail. */
export async function revokeDevice(userId: string, pushToken: string) {
  const { count } = await prisma.pushDevice.updateMany({
    where: { userId, pushToken, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count > 0;
}
