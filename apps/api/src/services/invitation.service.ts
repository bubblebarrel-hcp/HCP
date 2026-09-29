import { InvitationMethod, KennelStatus, MembershipStatus, MembershipTimelineType, MembershipType } from '@prisma/client';
import { env } from '../config/env';
import prisma from '../config/prisma';
import { ApiError, isUuid } from '../utils/http';
import { hashToken, randomToken } from '../utils/jwt';
import { isEmailConfigured, sendEmail } from './email.service';
import { type Actor, assertKennelPermission } from './permission.service';
import { recordAudit, recordEvent } from './record.service';
import { getNumberSetting } from './settings.service';

// FR-MEMBER-005. The one way in to a hidden kennel (D20/FR-MEMBER-001): every
// other join path runs through checkEligibility, which refuses a HIDDEN
// kennel outright, but an invitation never calls it. Redeeming one creates the
// membership directly — the officer who sent it already decided.
//
// The token is random, stored only as a SHA-256 hash, and single-use, the same
// shape as email verification and password reset.

const OPEN: MembershipStatus[] = [
  MembershipStatus.APPLICANT,
  MembershipStatus.PENDING_REVIEW,
  MembershipStatus.ACTIVE,
  MembershipStatus.INACTIVE,
  MembershipStatus.SUSPENDED,
];

function link(token: string) {
  return `/invitations/${token}`;
}

async function findKennel(slug: string) {
  const kennel = await prisma.kennel.findFirst({
    where: { slug, status: { not: KennelStatus.ARCHIVED } },
    select: { id: true, name: true, shortName: true, slug: true },
  });
  if (!kennel) throw ApiError.notFound('Kennel not found');
  return kennel;
}

export async function listInvitations(actor: Actor, slug: string) {
  const kennel = await findKennel(slug);
  await assertKennelPermission(actor, kennel.id, 'membership.review');

  const rows = await prisma.membershipInvitation.findMany({
    where: { kennelId: kennel.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      method: true,
      email: true,
      membershipType: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      createdAt: true,
      acceptedByUserId: true,
    },
  });
  // The token is never re-shown after creation (security), so the list can
  // only say what state an invite is in, never hand out its link again.
  const now = new Date();
  return rows.map((r) => ({
    ...r,
    status: r.acceptedAt ? 'accepted' : r.revokedAt ? 'revoked' : r.expiresAt < now ? 'expired' : 'pending',
  }));
}

export async function createInvitation(
  actor: Actor,
  slug: string,
  input: { method: InvitationMethod; email?: string | null; membershipType?: MembershipType },
) {
  const kennel = await findKennel(slug);
  await assertKennelPermission(actor, kennel.id, 'membership.review');

  if (input.method === InvitationMethod.EMAIL && !input.email) {
    throw ApiError.badRequest('An email invitation needs an address.', 'EMAIL_REQUIRED');
  }

  const days = await getNumberSetting('membership.invitationExpiryDays');
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const invitation = await prisma.$transaction(async (tx) => {
    const created = await tx.membershipInvitation.create({
      data: {
        kennelId: kennel.id,
        invitedById: actor.id,
        method: input.method,
        email: input.email?.trim().toLowerCase() || null,
        tokenHash: hashToken(token),
        membershipType: input.membershipType ?? MembershipType.FULL,
        expiresAt,
      },
    });
    const event = await recordEvent(tx, {
      eventType: 'MembershipInvitationSent',
      aggregateType: 'MembershipInvitation',
      aggregateId: created.id,
      actorId: actor.id,
      payload: { kennelId: kennel.id, method: input.method, email: created.email },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'membership.invitation.create',
      resourceType: 'MembershipInvitation',
      resourceId: created.id,
      kennelId: kennel.id,
      newState: { method: input.method, email: created.email, expiresAt },
      policyRef: 'membership.review',
      domainEventId: event.id,
    });
    return created;
  });

  if (input.method === InvitationMethod.EMAIL && invitation.email) {
    const result = await sendEmail({
      to: invitation.email,
      subject: `You're invited to join ${kennel.name} on HCP`,
      body: `A mismanagement member has invited you to join ${kennel.name} on the Hash Community Platform. This link is good for ${days} days.`,
      action: { label: 'Accept the invitation', path: link(token) },
    });
    if (!result.sent && isEmailConfigured()) {
      throw ApiError.badRequest('Could not send the invitation email. Try again.', 'EMAIL_SEND_FAILED');
    }
  }

  return {
    id: invitation.id,
    method: invitation.method,
    email: invitation.email,
    membershipType: invitation.membershipType,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    // Shown once, at creation, so the officer can copy or QR it. Never
    // reconstructable afterwards — only the hash is stored.
    token,
    link: `${env.appBaseUrl}${link(token)}`,
  };
}

export async function revokeInvitation(actor: Actor, id: string) {
  if (!isUuid(id)) throw ApiError.notFound('Invitation not found');
  const invitation = await prisma.membershipInvitation.findUnique({
    where: { id },
    select: { id: true, kennelId: true, acceptedAt: true, revokedAt: true },
  });
  if (!invitation) throw ApiError.notFound('Invitation not found');
  await assertKennelPermission(actor, invitation.kennelId, 'membership.review');

  if (invitation.acceptedAt) throw ApiError.conflict('Already accepted; nothing to revoke.', 'ALREADY_ACCEPTED');
  if (invitation.revokedAt) return { revoked: true };

  await prisma.$transaction(async (tx) => {
    await tx.membershipInvitation.update({ where: { id }, data: { revokedAt: new Date() } });
    const event = await recordEvent(tx, {
      eventType: 'MembershipInvitationRevoked',
      aggregateType: 'MembershipInvitation',
      aggregateId: id,
      actorId: actor.id,
      payload: { kennelId: invitation.kennelId },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'membership.invitation.revoke',
      resourceType: 'MembershipInvitation',
      resourceId: id,
      kennelId: invitation.kennelId,
      previousState: { revoked: false },
      newState: { revoked: true },
      policyRef: 'membership.review',
      domainEventId: event.id,
    });
  });

  return { revoked: true };
}

async function loadValid(token: string) {
  const invitation = await prisma.membershipInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      kennelId: true,
      invitedById: true,
      method: true,
      membershipType: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      kennel: { select: { id: true, name: true, shortName: true, slug: true } },
    },
  });
  if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return null;
  }
  return invitation;
}

// Anonymous: a hasher previews what they are accepting before logging in.
export async function previewInvitation(token: string) {
  const invitation = await loadValid(token);
  if (!invitation) throw ApiError.notFound('That invitation link is no longer valid.', 'INVALID_INVITATION');
  return {
    kennel: invitation.kennel,
    membershipType: invitation.membershipType,
    expiresAt: invitation.expiresAt,
  };
}

export async function acceptInvitation(actor: Actor, token: string) {
  const invitation = await loadValid(token);
  if (!invitation) throw ApiError.notFound('That invitation link is no longer valid.', 'INVALID_INVITATION');

  const open = await prisma.membership.findFirst({
    where: { userId: actor.id, kennelId: invitation.kennelId, status: { in: OPEN } },
    select: { id: true },
  });
  if (open) throw ApiError.conflict('You already have a request or membership with this kennel.', 'REQUEST_PENDING');

  const now = new Date();
  const membership = await prisma.$transaction(async (tx) => {
    const created = await tx.membership.create({
      data: {
        userId: actor.id,
        kennelId: invitation.kennelId,
        type: invitation.membershipType,
        status: MembershipStatus.ACTIVE,
        approvedById: invitation.invitedById,
        approvedAt: now,
        startDate: now,
        timeline: {
          create: [
            { type: MembershipTimelineType.REQUESTED, toStatus: MembershipStatus.PENDING_REVIEW, actorId: actor.id, note: 'Joined by invitation' },
            { type: MembershipTimelineType.APPROVED, fromStatus: MembershipStatus.PENDING_REVIEW, toStatus: MembershipStatus.ACTIVE, actorId: invitation.invitedById, note: 'Invitation accepted' },
          ],
        },
      },
    });

    await tx.membershipInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: now, acceptedByUserId: actor.id },
    });

    const acceptedEvent = await recordEvent(tx, {
      eventType: 'MembershipInvitationAccepted',
      aggregateType: 'MembershipInvitation',
      aggregateId: invitation.id,
      actorId: actor.id,
      payload: { kennelId: invitation.kennelId, membershipId: created.id },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'membership.invitation.accept',
      resourceType: 'MembershipInvitation',
      resourceId: invitation.id,
      kennelId: invitation.kennelId,
      newState: { membershipId: created.id },
      policyRef: 'self',
      domainEventId: acceptedEvent.id,
    });

    // Reuses MembershipApproved (Chapter 24) rather than inventing a parallel
    // event: notification.service.ts already fans this out with the same
    // "Welcome to <kennel>" copy an officer's approval sends, and an invited
    // hasher is, functionally, an approved one.
    const approvedEvent = await recordEvent(tx, {
      eventType: 'MembershipApproved',
      aggregateType: 'Membership',
      aggregateId: created.id,
      actorId: invitation.invitedById,
      payload: { kennelId: invitation.kennelId, userId: actor.id, type: invitation.membershipType, viaInvitation: true },
    });
    await recordAudit(tx, {
      actorId: invitation.invitedById,
      action: 'membership.approve',
      resourceType: 'Membership',
      resourceId: created.id,
      kennelId: invitation.kennelId,
      newState: { status: MembershipStatus.ACTIVE, type: invitation.membershipType },
      policyRef: 'invitation',
      domainEventId: approvedEvent.id,
    });

    return created;
  });

  return { membershipId: membership.id, kennel: invitation.kennel };
}
