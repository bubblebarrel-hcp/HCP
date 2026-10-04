import { Prisma, SubjectType } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid } from '../utils/http';
import type { Actor } from './permission.service';
import { recordEvent } from './record.service';
import { resolveSubject } from './subject.service';

// Polls on a post (D60): "Where's the on-after?"
//
// The post's words are the question; a poll is two to five answers and a time it
// closes. Open or closed is the clock against `closesAt`, not a stored state, so
// there is nothing to sweep and no state to add to Chapter 22. One vote per
// hasher, changeable while it is open. Who voted for what is never shown, only
// the tallies, and those are not shown to somebody who has not voted until it
// closes: a poll nobody has answered should not be answered by looking.

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 5;
export const MAX_OPTION_LENGTH = 80;
export const DEFAULT_HOURS = 24;
export const MAX_HOURS = 24 * 7;

export interface PollInput {
  options: string[];
  // How long it stays open once the post is up.
  hours?: number;
}

export const pollSelect = {
  id: true,
  closesAt: true,
  createdAt: true,
  options: { orderBy: { position: 'asc' }, select: { id: true, text: true } },
} satisfies Prisma.PollSelect;

export function cleanPoll(input: PollInput) {
  const options = (input.options ?? []).map((o) => String(o).trim()).filter(Boolean);
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    throw ApiError.badRequest(`A poll has ${MIN_OPTIONS} to ${MAX_OPTIONS} answers.`, 'POLL_OPTIONS');
  }
  if (options.some((o) => o.length > MAX_OPTION_LENGTH)) {
    throw ApiError.badRequest(`An answer is at most ${MAX_OPTION_LENGTH} characters.`, 'POLL_OPTION_LONG');
  }
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
    throw ApiError.badRequest('Two answers are the same.', 'POLL_DUPLICATE');
  }
  const hours = Math.min(MAX_HOURS, Math.max(1, Math.round(input.hours ?? DEFAULT_HOURS)));
  return { options, hours };
}

// For a nested create on the post itself.
export function pollCreateData(input: PollInput): Prisma.PollCreateWithoutPostInput {
  const { options, hours } = cleanPoll(input);
  return {
    closesAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    options: { create: options.map((text, position) => ({ text, position })) },
  };
}

export async function createPoll(tx: Prisma.TransactionClient, postId: string, input: PollInput) {
  const { options, hours } = cleanPoll(input);
  return tx.poll.create({
    data: {
      postId,
      closesAt: new Date(Date.now() + hours * 60 * 60 * 1000),
      options: { create: options.map((text, position) => ({ text, position })) },
    },
  });
}

// The clock starts when the post is published, not when its draft was started.
export async function startClock(tx: Prisma.TransactionClient, postId: string) {
  const poll = await tx.poll.findUnique({ where: { postId }, select: { id: true, closesAt: true, createdAt: true } });
  if (!poll) return;
  const length = poll.closesAt.getTime() - poll.createdAt.getTime();
  await tx.poll.update({ where: { id: poll.id }, data: { closesAt: new Date(Date.now() + length) } });
}

export interface SerializedPoll {
  id: string;
  closesAt: Date;
  closed: boolean;
  totalVotes: number;
  myVote: string | null;
  options: { id: string; text: string; votes: number | null; share: number | null }[];
}

type PollRow = Prisma.PollGetPayload<{ select: typeof pollSelect }> & { postId?: string };

// Bulk, for a page of posts: one read for the polls' tallies and one for what
// this viewer voted.
export async function pollsFor(
  viewerId: string | undefined,
  authorIdByPost: Map<string, string>,
): Promise<Map<string, SerializedPoll>> {
  const out = new Map<string, SerializedPoll>();
  const postIds = [...authorIdByPost.keys()];
  if (postIds.length === 0) return out;

  const polls = await prisma.poll.findMany({
    where: { postId: { in: postIds } },
    select: { ...pollSelect, postId: true },
  });
  if (polls.length === 0) return out;

  const pollIds = polls.map((p) => p.id);
  const [tallies, mine] = await Promise.all([
    prisma.pollVote.groupBy({ by: ['optionId'], where: { pollId: { in: pollIds } }, _count: { _all: true } }),
    viewerId
      ? prisma.pollVote.findMany({
          where: { pollId: { in: pollIds }, userId: viewerId },
          select: { pollId: true, optionId: true },
        })
      : Promise.resolve([]),
  ]);
  const counts = new Map(tallies.map((t) => [t.optionId, t._count._all]));
  const voted = new Map(mine.map((v) => [v.pollId, v.optionId]));

  for (const poll of polls as (PollRow & { postId: string })[]) {
    const closed = poll.closesAt.getTime() <= Date.now();
    const myVote = voted.get(poll.id) ?? null;
    // Results are for people who have answered, for the author, and for
    // everybody once it is over.
    const showResults = closed || myVote !== null || (viewerId !== undefined && authorIdByPost.get(poll.postId) === viewerId);
    const total = poll.options.reduce((sum, o) => sum + (counts.get(o.id) ?? 0), 0);
    out.set(poll.postId, {
      id: poll.id,
      closesAt: poll.closesAt,
      closed,
      totalVotes: showResults ? total : 0,
      myVote,
      options: poll.options.map((o) => {
        const votes = counts.get(o.id) ?? 0;
        return {
          id: o.id,
          text: o.text,
          votes: showResults ? votes : null,
          share: showResults && total > 0 ? Math.round((votes / total) * 100) : showResults ? 0 : null,
        };
      }),
    });
  }
  return out;
}

export async function vote(actor: Actor, postId: string, optionId: string) {
  // Whoever may read the post may answer its poll, and nobody else may find it.
  await resolveSubject(actor, SubjectType.POST, postId);
  if (!isUuid(optionId)) throw ApiError.notFound('That answer is not on this poll');

  const poll = await prisma.poll.findUnique({ where: { postId }, select: { id: true, closesAt: true, options: { select: { id: true } } } });
  if (!poll) throw ApiError.notFound('This post has no poll');
  if (poll.closesAt.getTime() <= Date.now()) throw ApiError.badRequest('This poll has closed.', 'POLL_CLOSED');
  if (!poll.options.some((o) => o.id === optionId)) throw ApiError.notFound('That answer is not on this poll');

  await prisma.$transaction(async (tx) => {
    const existing = await tx.pollVote.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId: actor.id } },
      select: { id: true, optionId: true },
    });
    if (existing?.optionId === optionId) return;
    if (existing) await tx.pollVote.update({ where: { id: existing.id }, data: { optionId } });
    else await tx.pollVote.create({ data: { pollId: poll.id, optionId, userId: actor.id } });
    await recordEvent(tx, {
      eventType: 'PollVoted',
      aggregateType: 'Post',
      aggregateId: postId,
      actorId: actor.id,
      payload: { pollId: poll.id, changed: Boolean(existing) },
    });
  });

  const author = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  const polls = await pollsFor(actor.id, new Map([[postId, author?.authorId ?? '']]));
  return { poll: polls.get(postId) ?? null };
}
