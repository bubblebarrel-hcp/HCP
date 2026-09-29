import type { DomainEvent } from '@prisma/client';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Evicting a cached public page in the web app.
//
// The public pages are Server Components with `revalidate = 60`. That window
// works for a page whose data *changed*: the next request past 60s regenerates
// it and the new content appears. It does not work for a page whose data
// *disappeared*. When the API starts answering 404, regeneration calls
// `notFound()`, Next discards that render and keeps serving the last successful
// one — measured still serving an archived kennel's description, motto and
// officer names 156 seconds after it was archived, with no sign of expiring.
//
// Time alone cannot fix a deletion, so the archive path has to say so. This is
// best-effort by design: it is cache invalidation, not domain state. A web app
// that is down or misconfigured must never park a DomainEvent, so nothing here
// throws. The failure mode is the old behaviour, which is a stale page, not a
// lost event.

const TIMEOUT_MS = 3_000;

async function post(paths: string[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(env.revalidate.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hcp-revalidate-secret': env.revalidate.secret,
      },
      body: JSON.stringify({ paths }),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn(`Revalidation refused (${res.status}) for ${paths.join(', ')}`);
      return;
    }
    logger.info?.('Revalidated public paths', { paths });
  } catch (err) {
    // An unreachable or slow web app is not an API failure.
    logger.warn(
      `Could not reach the web app to revalidate ${paths.join(', ')}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Drop the web app's cached copy of these paths. Never throws. */
export async function revalidatePaths(paths: (string | null | undefined)[]) {
  if (!env.revalidate.configured) return;
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p) && p!.startsWith('/')))];
  if (wanted.length === 0) return;
  await post(wanted);
}

// Every public page a kennel appears on: its own page, the directory, the home
// page's kennel strip and the sitemap. A rename changes the slug, so the old
// address has to be evicted too or it keeps serving the kennel under its old
// name.
export async function revalidateKennel(slug: string | null | undefined, previousSlug?: string | null) {
  await revalidatePaths([
    slug && `/kennels/${slug}`,
    previousSlug && previousSlug !== slug ? `/kennels/${previousSlug}` : null,
    '/kennels',
    '/',
    '/sitemap.xml',
  ]);
}

// A hasher's post appears on the home feed, on their own page, and at its own
// address (D51). Posting is the one moment where the 60-second window is felt
// as a bug rather than a delay: you write something, the page comes back, and
// it is not there. Kennel changes already ride this mechanism (D35); a post is
// the same problem with a shorter fuse.
export async function revalidatePost(postId: string, authorId: string | null) {
  await revalidatePaths(['/', `/posts/${postId}`, authorId ? `/hashers/${authorId}` : null]);
}

// D35 follow-up. `/runs/[id]`, `/reports/[id]` and `/capsules/[id]` are Client
// Components — only fetch fresh — but each has a server shell around it
// purely for `generateMetadata` (Open Graph title/image for a shared link),
// and that shell's own `publicGet` call carries Next's default 60s cache.
// Nothing evicted it before this: a report withdrawn, a capsule archived, or
// a run whose visibility changed away from public would keep serving its old
// preview card at the same URL — the exact "time alone cannot express a
// disappearance" problem D35 already solved for kennels, just not extended
// here yet. Every listing page for all three is a Client Component with no
// cache of its own, so there is nothing else to evict.
export async function revalidateRun(runId: string) {
  await revalidatePaths([`/runs/${runId}`]);
}

export async function revalidateReport(reportId: string) {
  await revalidatePaths([`/reports/${reportId}`]);
}

export async function revalidateCapsule(capsuleId: string) {
  await revalidatePaths([`/capsules/${capsuleId}`]);
}

// A run's own DomainEvent stream is a poor filter to revalidate on directly —
// it also carries RunRsvpChanged and ParticipantCheckedIn, which can fire
// dozens of times during a single run day and change nothing the share card
// shows (theme, hares, meeting point, poster). Only these change that.
const RUN_METADATA_EVENTS = new Set([
  'RunScheduled',
  'RunUpdated',
  'RunCancelled',
  'RunArchived',
  'HareAssigned',
  'HareRemoved',
]);

/**
 * Outbox consumer. Anything that happens to a kennel can change how it appears
 * publicly — or whether it appears at all — so every Kennel-aggregate event
 * evicts its pages. A post does the same for the feed it lands in. Never
 * throws, so it cannot park an event.
 */
export async function applyRevalidation(event: DomainEvent) {
  if (!env.revalidate.configured) return;
  try {
    if (event.aggregateType === 'Post') {
      // Published, archived or taken down — all three change what the feed
      // should show.
      const post = await prisma.post.findUnique({
        where: { id: event.aggregateId },
        select: { authorId: true },
      });
      await revalidatePost(event.aggregateId, post?.authorId ?? null);
      return;
    }
    if (event.aggregateType === 'TrailReport') {
      await revalidateReport(event.aggregateId);
      return;
    }
    if (event.aggregateType === 'RunCapsule') {
      await revalidateCapsule(event.aggregateId);
      return;
    }
    if (event.aggregateType === 'Run' && RUN_METADATA_EVENTS.has(event.eventType)) {
      await revalidateRun(event.aggregateId);
      return;
    }
    if (event.aggregateType !== 'Kennel') return;
    // The row still exists after archiving; only its status changed.
    const kennel = await prisma.kennel.findUnique({
      where: { id: event.aggregateId },
      select: { slug: true },
    });
    await revalidateKennel(kennel?.slug);
  } catch (err) {
    logger.warn(
      `Revalidation consumer failed for ${event.eventType}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
