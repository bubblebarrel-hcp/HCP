import { HareOfferStatus, Prisma, RunStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { type Actor } from './permission.service';
import { recordAudit, recordEvent } from './record.service';
import {
  addHare,
  canOperate,
  getAccess,
  canView,
  operateSource,
  publicName,
  userPublicSelect,
} from './run.service';

// Offering to hare a run (D44).
//
// Every kennel ends its flyer the same way: "please pick a date convenient for
// you to hare a run". Those dates already exist here as runs with no hare; this
// is the answer, and the answer is a conversation rather than a claim —
// a hasher offers, an officer says yes. A trail is the kennel's name on the
// line, so nobody hares by pressing a button alone.

const S = HareOfferStatus;

// A run can still take a hare while it is being planned. Once the trail is
// released the job is done and the offer would be meaningless.
const OPEN_TO_OFFERS: RunStatus[] = [RunStatus.SCHEDULED, RunStatus.PLANNING, RunStatus.TRAIL_HIDDEN];

const offerSelect = {
  id: true,
  message: true,
  wantsLead: true,
  status: true,
  reason: true,
  decidedAt: true,
  createdAt: true,
  user: { select: { ...userPublicSelect, avatarUrl: true } },
  run: {
    select: {
      id: true,
      runNumber: true,
      title: true,
      startsAt: true,
      timeZone: true,
      kennelId: true,
      kennel: { select: { slug: true, shortName: true } },
    },
  },
} satisfies Prisma.HareOfferSelect;

type OfferRow = Prisma.HareOfferGetPayload<{ select: typeof offerSelect }>;

function serialize(offer: OfferRow, viewerId?: string) {
  return {
    id: offer.id,
    message: offer.message,
    wantsLead: offer.wantsLead,
    status: offer.status,
    reason: offer.reason,
    decidedAt: offer.decidedAt,
    createdAt: offer.createdAt,
    // Public identity only (D11).
    hasher: { id: offer.user.id, name: publicName(offer.user), avatarUrl: offer.user.avatarUrl },
    run: {
      id: offer.run.id,
      runNumber: offer.run.runNumber,
      title: offer.run.title,
      startsAt: offer.run.startsAt,
      timeZone: offer.run.timeZone,
      kennel: offer.run.kennel,
    },
    isMine: viewerId ? offer.user.id === viewerId : false,
  };
}

async function findOffer(id: string) {
  if (!isUuid(id)) throw ApiError.notFound('Offer not found');
  const offer = await prisma.hareOffer.findUnique({
    where: { id },
    select: { ...offerSelect, userId: true, runId: true },
  });
  if (!offer) throw ApiError.notFound('Offer not found');
  return offer;
}

// ─── Offering ───

export async function offer(actor: Actor, runId: string, input: { message?: string | null; wantsLead?: boolean }) {
  const access = await getAccess(actor, runId);
  if (!canView(access)) throw ApiError.notFound('Run not found');

  // FR-MEMBER-011 in spirit: you hare for a kennel you belong to.
  if (!access.isMember) {
    throw ApiError.forbidden('Only members of the hosting kennel can offer to hare.', 'MEMBERS_ONLY');
  }
  if (access.run.cancelledAt) throw ApiError.badRequest('That run was called off.', 'RUN_CANCELLED');
  if (!OPEN_TO_OFFERS.includes(access.run.status)) {
    throw ApiError.badRequest('That run is past the point of taking on a hare.', 'RUN_NOT_OPEN_TO_HARES');
  }
  if (access.run.startsAt.getTime() <= Date.now()) {
    throw ApiError.badRequest('That run has already started.', 'RUN_ALREADY_STARTED');
  }

  const alreadyHaring = await prisma.runHare.findUnique({
    where: { runId_userId: { runId, userId: actor.id } },
    select: { userId: true },
  });
  if (alreadyHaring) throw ApiError.conflict('You are already haring that run.', 'ALREADY_A_HARE');

  const pending = await prisma.hareOffer.findFirst({
    where: { runId, userId: actor.id, status: S.OFFERED },
    select: { id: true },
  });
  if (pending) throw ApiError.conflict('You have already offered to hare that run.', 'ALREADY_OFFERED');

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.hareOffer.create({
      data: {
        runId,
        userId: actor.id,
        message: input.message?.trim() || null,
        wantsLead: input.wantsLead ?? false,
        status: S.OFFERED,
      },
      select: { ...offerSelect, userId: true, runId: true },
    });
    const event = await recordEvent(tx, {
      eventType: 'HareOffered',
      aggregateType: 'Run',
      aggregateId: runId,
      actorId: actor.id,
      payload: { offerId: row.id, kennelId: access.run.kennelId, wantsLead: row.wantsLead },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'hare.offer',
      resourceType: 'HareOffer',
      resourceId: row.id,
      kennelId: access.run.kennelId,
      newState: { runId, wantsLead: row.wantsLead },
      domainEventId: event.id,
    });
    return row;
  });

  return serialize(created, actor.id);
}

// The offerer changes their mind. Kept as history: a kennel counting on someone
// should be able to see that the offer was pulled, and when.
export async function withdraw(actor: Actor, offerId: string, reason?: string | null) {
  const offer = await findOffer(offerId);
  if (offer.userId !== actor.id) throw ApiError.forbidden('Only the hasher who offered can withdraw it.', 'NOT_YOURS');
  if (offer.status !== S.OFFERED) throw ApiError.badRequest('That offer has already been answered.', 'OFFER_ANSWERED');

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.hareOffer.update({
      where: { id: offer.id },
      data: { status: S.WITHDRAWN, decidedAt: new Date(), reason: reason?.trim() || null },
      select: { ...offerSelect, userId: true, runId: true },
    });
    await recordEvent(tx, {
      eventType: 'HareOfferWithdrawn',
      aggregateType: 'Run',
      aggregateId: offer.runId,
      actorId: actor.id,
      payload: { offerId: offer.id, kennelId: offer.run.kennelId },
    });
    return row;
  });
  return serialize(updated, actor.id);
}

// ─── Answering ───

export async function accept(actor: Actor, offerId: string) {
  const offer = await findOffer(offerId);
  const access = await getAccess(actor, offer.runId);
  if (!canOperate(access)) {
    throw ApiError.forbidden('Only the kennel’s run officers answer a hare offer.', 'KENNEL_PERMISSION_REQUIRED');
  }
  if (offer.status !== S.OFFERED) throw ApiError.badRequest('That offer has already been answered.', 'OFFER_ANSWERED');
  if (access.run.cancelledAt) throw ApiError.badRequest('That run was called off.', 'RUN_CANCELLED');

  const existingHares = await prisma.runHare.findMany({ where: { runId: offer.runId }, select: { isLead: true } });
  // The first hare on a run leads it; after that, wanting to lead is a request
  // the officers grant by ending the current lead, not something an offer does.
  const isLead = existingHares.length === 0;

  const updated = await prisma.$transaction(async (tx) => {
    await addHare(tx, actor.id, offer.runId, offer.run.kennelId, { userId: offer.userId, isLead });

    const row = await tx.hareOffer.update({
      where: { id: offer.id },
      data: { status: S.ACCEPTED, decidedById: actor.id, decidedAt: new Date() },
      select: { ...offerSelect, userId: true, runId: true },
    });
    const event = await recordEvent(tx, {
      eventType: 'HareOfferAccepted',
      aggregateType: 'Run',
      aggregateId: offer.runId,
      actorId: actor.id,
      payload: { offerId: offer.id, kennelId: offer.run.kennelId, userId: offer.userId, isLead },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'hare.offer.accept',
      resourceType: 'HareOffer',
      resourceId: offer.id,
      kennelId: offer.run.kennelId,
      previousState: { status: S.OFFERED },
      newState: { status: S.ACCEPTED, userId: offer.userId, isLead },
      policyRef: operateSource(access),
      domainEventId: event.id,
    });
    return row;
  });

  return serialize(updated, actor.id);
}

export async function decline(actor: Actor, offerId: string, reason: string) {
  const offer = await findOffer(offerId);
  const access = await getAccess(actor, offer.runId);
  if (!canOperate(access)) {
    throw ApiError.forbidden('Only the kennel’s run officers answer a hare offer.', 'KENNEL_PERMISSION_REQUIRED');
  }
  if (offer.status !== S.OFFERED) throw ApiError.badRequest('That offer has already been answered.', 'OFFER_ANSWERED');

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.hareOffer.update({
      where: { id: offer.id },
      data: { status: S.DECLINED, decidedById: actor.id, decidedAt: new Date(), reason: reason.trim() },
      select: { ...offerSelect, userId: true, runId: true },
    });
    const event = await recordEvent(tx, {
      eventType: 'HareOfferDeclined',
      aggregateType: 'Run',
      aggregateId: offer.runId,
      actorId: actor.id,
      payload: { offerId: offer.id, kennelId: offer.run.kennelId, userId: offer.userId },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'hare.offer.decline',
      resourceType: 'HareOffer',
      resourceId: offer.id,
      kennelId: offer.run.kennelId,
      previousState: { status: S.OFFERED },
      newState: { status: S.DECLINED },
      reason,
      policyRef: operateSource(access),
      domainEventId: event.id,
    });
    return row;
  });

  return serialize(updated, actor.id);
}

// ─── Reads ───

// What is on the table for one run. Officers see every offer; a member sees
// their own, because who else offered is the kennel's business until it is
// decided.
export async function listForRun(actor: Actor, runId: string) {
  const access = await getAccess(actor, runId);
  if (!canView(access)) throw ApiError.notFound('Run not found');
  const canAnswer = canOperate(access);

  const rows = await prisma.hareOffer.findMany({
    where: { runId, ...(canAnswer ? {} : { userId: actor.id }) },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    select: { ...offerSelect, userId: true, runId: true },
  });

  return {
    items: rows.map((r) => serialize(r, actor.id)),
    canAnswer,
    // Whether this viewer could offer right now, so a screen never shows a
    // button the API would refuse.
    canOffer:
      access.isMember &&
      !access.run.cancelledAt &&
      OPEN_TO_OFFERS.includes(access.run.status) &&
      access.run.startsAt.getTime() > Date.now() &&
      !rows.some((r) => r.userId === actor.id && r.status === S.OFFERED),
  };
}

// Runs a kennel has dated but not hared — the list the flyer is asking people
// to pick from. Public, because a visitor thinking of joining should be able to
// see that a kennel needs hares.
export async function listRunsNeedingHares(
  actor: Actor | undefined,
  opts: { kennelSlug?: string; page: number; limit: number },
) {
  const where: Prisma.RunWhereInput = {
    status: { in: OPEN_TO_OFFERS },
    cancelledAt: null,
    startsAt: { gte: new Date() },
    hares: { none: {} },
    ...(opts.kennelSlug ? { kennel: { slug: opts.kennelSlug } } : {}),
    ...(actor ? {} : { visibility: 'PUBLIC' }),
  };

  const rows = await prisma.run.findMany({
    where,
    orderBy: { startsAt: 'asc' },
    skip: (opts.page - 1) * opts.limit,
    take: opts.limit,
    select: {
      id: true,
      runNumber: true,
      title: true,
      theme: true,
      startsAt: true,
      timeZone: true,
      city: true,
      country: true,
      meetingPointName: true,
      kennel: { select: { slug: true, shortName: true, primaryColor: true } },
      _count: { select: { hareOffers: { where: { status: S.OFFERED } } } },
    },
  });

  const visible = [];
  for (const row of rows) {
    const access = await getAccess(actor, row.id);
    if (!canView(access)) continue;
    const { _count, ...rest } = row;
    visible.push({ ...rest, offerCount: _count.hareOffers });
  }

  const total = await prisma.run.count({ where });
  return page(visible, total, opts.page, opts.limit);
}
