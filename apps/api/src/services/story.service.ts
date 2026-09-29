import { type DomainEvent, Prisma, StoryCategory, StorySource } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid } from '../utils/http';
import { type Actor, hasScribeRole } from './permission.service';
import { recordEvent } from './record.service';
import { type RunAccess, canSeeNames, publicName, userPublicSelect, viewableAccess } from './run.service';

// Story collection (Annex 08G-01). Stories are not written after the run; they
// accumulate during it. The outbox hands every domain event here and the ones
// worth remembering become StoryAssets, which is the raw material the Scribe
// shapes into the Trail Report.
//
// FR-STORY-001: automatic, no manual intervention.
// FR-STORY-002: the Scribe may add what the system could never notice.

type Payload = Record<string, unknown>;

interface StorySpec {
  category: StoryCategory;
  body: string;
}

const str = (payload: Payload, key: string) => (typeof payload[key] === 'string' ? (payload[key] as string) : null);

// What each event contributes to the story. Events not listed here are real
// history but not story material — a check-in per hasher would drown the
// timeline it is meant to serve.
function specFor(event: DomainEvent, payload: Payload): StorySpec | null {
  switch (event.eventType) {
    case 'TrailReleased':
      return { category: StoryCategory.TRAIL, body: 'The trail went live and the pack set off.' };
    case 'RunStarted':
      return { category: StoryCategory.TRAIL, body: 'The run started.' };
    case 'RunEnded':
      return { category: StoryCategory.TRAIL, body: 'The pack came in and the run ended.' };
    case 'RunPaused': {
      const reason = str(payload, 'reason');
      return { category: StoryCategory.SAFETY, body: reason ? `The run was paused: ${reason}` : 'The run was paused.' };
    }
    case 'RunResumed':
      return { category: StoryCategory.SAFETY, body: 'The run resumed.' };
    case 'CircleClosed':
      return { category: StoryCategory.CIRCLE, body: 'The Circle closed.' };
    case 'AwardRecorded': {
      const title = str(payload, 'title');
      const recipient = str(payload, 'recipientName');
      const downDown = payload.isDownDown === true;
      const what = title ?? (downDown ? 'A down-down' : 'An award');
      return {
        category: StoryCategory.AWARD,
        body: recipient ? `${what} went to ${recipient}.` : `${what} was given in the Circle.`,
      };
    }
    case 'GuestRegistered':
      return { category: StoryCategory.VISITOR, body: 'A guest registered for the run.' };
    case 'MediaUploaded':
      return { category: StoryCategory.GENERAL, body: 'A photo was added to the run.' };
    default:
      return null;
  }
}

// Which run an event belongs to. Most carry it in the payload; run events are
// the run.
async function runIdFor(event: DomainEvent, payload: Payload) {
  if (event.aggregateType === 'Run') return event.aggregateId;
  const fromPayload = str(payload, 'runId');
  if (fromPayload) return fromPayload;
  if (event.aggregateType === 'Trail') {
    const trail = await prisma.trail.findUnique({ where: { id: event.aggregateId }, select: { runId: true } });
    return trail?.runId ?? null;
  }
  return null;
}

// Outbox consumer. At-least-once delivery means this runs again on replay, so
// the event id is the idempotency key.
export async function applyToStory(event: DomainEvent) {
  const payload = (event.payload ?? {}) as Payload;
  const spec = specFor(event, payload);
  if (!spec) return 0;

  const runId = await runIdFor(event, payload);
  if (!runId) return 0;

  const already = await prisma.storyAsset.findFirst({
    where: { runId, refType: 'DomainEvent', refId: event.id },
    select: { id: true },
  });
  if (already) return 0;

  await prisma.storyAsset.create({
    data: {
      runId,
      category: spec.category,
      source: StorySource.AUTOMATIC,
      body: spec.body,
      occurredAt: event.occurredAt,
      contributorId: event.actorId,
      refType: 'DomainEvent',
      refId: event.id,
    },
  });
  return 1;
}

// ─── Reads ───

const storySelect = {
  id: true,
  category: true,
  source: true,
  body: true,
  occurredAt: true,
  refType: true,
  refId: true,
  createdAt: true,
  contributor: { select: userPublicSelect },
} satisfies Prisma.StoryAssetSelect;

type StoryRow = Prisma.StoryAssetGetPayload<{ select: typeof storySelect }>;

function serialize(story: StoryRow) {
  const { contributor, ...rest } = story;
  return { ...rest, contributedBy: contributor ? publicName(contributor) : null };
}

// FR-STORY-003: the timeline, in the order it happened. It belongs to the
// hosting kennel, so it follows the same rule as the run's other internals.
export async function listTimeline(actor: Actor, runId: string) {
  const access = await viewableAccess(actor, runId);
  if (!canSeeNames(access)) {
    throw ApiError.forbidden('The story timeline is for members of the hosting kennel.', 'MEMBERS_ONLY');
  }
  const rows = await prisma.storyAsset.findMany({
    where: { runId },
    select: storySelect,
    orderBy: { occurredAt: 'asc' },
  });
  return { items: rows.map(serialize), canContribute: await canContribute(access) };
}

// The same people who may write the report may shape the story behind it: the
// kennel's Scribe, the run's hares, and officers with report permissions (D29).
async function canContribute(access: RunAccess) {
  if (!access.actor) return false;
  if (access.grants.get('report.publish') || access.canManage || access.isHare) return true;
  return hasScribeRole(access.actor.id, access.run.kennelId);
}

// ─── Manual entries (FR-STORY-002) ───

export async function createManual(
  actor: Actor,
  runId: string,
  input: { category: StoryCategory; body: string; occurredAt?: Date | null },
) {
  const access = await viewableAccess(actor, runId);
  if (!(await canContribute(access))) {
    throw ApiError.forbidden('Only the Scribe, the hares and kennel officers add to the story.', 'SCRIBE_ROLE_REQUIRED');
  }

  const created = await prisma.$transaction(async (tx) => {
    const story = await tx.storyAsset.create({
      data: {
        runId,
        category: input.category,
        source: StorySource.MANUAL,
        body: input.body.trim(),
        occurredAt: input.occurredAt ?? new Date(),
        contributorId: actor.id,
      },
      select: storySelect,
    });
    await recordEvent(tx, {
      eventType: 'StoryAssetCreated',
      aggregateType: 'StoryAsset',
      aggregateId: story.id,
      actorId: actor.id,
      payload: { runId, category: input.category },
    });
    return story;
  });

  return serialize(created);
}

export async function updateManual(actor: Actor, storyId: string, input: { body?: string; category?: StoryCategory }) {
  const story = await requireManual(actor, storyId);
  const updated = await prisma.storyAsset.update({
    where: { id: story.id },
    data: {
      ...(input.body !== undefined ? { body: input.body.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
    },
    select: storySelect,
  });
  return serialize(updated);
}

export async function removeManual(actor: Actor, storyId: string) {
  const story = await requireManual(actor, storyId);
  await prisma.storyAsset.delete({ where: { id: story.id } });
}

// Only manual entries are editable, and only until the report is published:
// automatic assets are the record of what happened and are never rewritten.
async function requireManual(actor: Actor, storyId: string) {
  if (!isUuid(storyId)) throw ApiError.notFound('Story entry not found');
  const story = await prisma.storyAsset.findUnique({
    where: { id: storyId },
    select: { id: true, runId: true, source: true },
  });
  if (!story) throw ApiError.notFound('Story entry not found');

  const access = await viewableAccess(actor, story.runId);
  if (!(await canContribute(access))) {
    throw ApiError.forbidden('Only the Scribe, the hares and kennel officers change the story.', 'SCRIBE_ROLE_REQUIRED');
  }
  if (story.source === StorySource.AUTOMATIC) {
    throw ApiError.badRequest('Collected events are the record of the run and cannot be edited.', 'AUTOMATIC_STORY');
  }
  const report = await prisma.trailReport.findUnique({ where: { runId: story.runId }, select: { publishedAt: true } });
  if (report?.publishedAt) {
    throw ApiError.badRequest('The Trail Report is published; the story behind it is now history.', 'REPORT_PUBLISHED');
  }
  return story;
}
