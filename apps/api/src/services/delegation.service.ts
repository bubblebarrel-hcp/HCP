import { MembershipStatus, RoleAssignmentStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid } from '../utils/http';
import { type Actor, type KennelPermission, KENNEL_PERMISSIONS, resolveKennelContext } from './permission.service';
import { appointableMembers } from './officer.service';
import { recordAudit, recordEvent } from './record.service';
import { publicName, userPublicSelect } from './run.service';

// Delegation (FR-GOV-033, Ch.22 A.10). A time-boxed loan of authority the
// delegator actually holds, with a reason and an audit record.
//
// "Delegations never exceed the delegator's own authority" is enforced twice on
// purpose: here when granting, and again at every permission check (D19),
// because the delegator may lose a key after granting it. A delegate holding a
// key their delegator no longer has would be authority conjured from nothing.

// Long enough to cover a holiday or an injury, short enough that nobody hands
// over their office for a year by accident.
const MAX_DAYS = 90;

function isKey(value: string): value is KennelPermission {
  return (KENNEL_PERMISSIONS as readonly string[]).includes(value);
}

async function kennelBySlug(slug: string) {
  const kennel = await prisma.kennel.findUnique({ where: { slug }, select: { id: true } });
  if (!kennel) throw ApiError.notFound('Kennel not found');
  return kennel;
}

export async function listDelegations(actor: Actor, slug: string) {
  const kennel = await kennelBySlug(slug);
  const context = await resolveKennelContext(actor, kennel.id);
  if (!context.isMember && context.grants.size === 0) {
    throw ApiError.forbidden('Only members see a kennel’s delegations.', 'MEMBERS_ONLY');
  }

  // Officers who can appoint oversee the kennel's delegations; everyone else
  // sees only the ones they are party to.
  const oversight = Boolean(context.grants.get('officer.appoint')) || Boolean(context.grants.get('kennel.manage'));
  const rows = await prisma.delegation.findMany({
    where: {
      kennelId: kennel.id,
      ...(oversight ? {} : { OR: [{ delegatorId: actor.id }, { delegateId: actor.id }] }),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      permissions: true,
      reason: true,
      startsAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
      delegatorId: true,
      delegateId: true,
      delegator: { select: userPublicSelect },
      delegate: { select: userPublicSelect },
    },
  });

  // Anyone with something to lend needs the list of people to lend it to.
  const members = context.grants.size > 0 ? await appointableMembers(kennel.id) : [];

  const now = new Date();
  return {
    members,
    items: rows.map((r) => ({
      id: r.id,
      permissions: r.permissions,
      reason: r.reason,
      startsAt: r.startsAt,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      from: publicName(r.delegator),
      fromId: r.delegatorId,
      to: publicName(r.delegate),
      toId: r.delegateId,
      // Live only while all three hold: granted, started, not expired.
      live: !r.revokedAt && r.startsAt <= now && r.expiresAt > now,
      canRevoke: r.delegatorId === actor.id || oversight,
    })),
    viewer: {
      // Only what the actor holds right now can be lent out.
      grantableKeys: [...context.grants.keys()],
      oversight,
      maxDays: MAX_DAYS,
    },
  };
}

export async function grant(
  actor: Actor,
  slug: string,
  input: { delegateId: string; permissions: string[]; reason: string; expiresAt: Date },
) {
  const kennel = await kennelBySlug(slug);
  const context = await resolveKennelContext(actor, kennel.id);

  if (input.delegateId === actor.id) {
    throw ApiError.badRequest('You already hold your own authority.', 'SELF_DELEGATION');
  }

  const unknown = input.permissions.filter((p) => !isKey(p));
  if (unknown.length) throw ApiError.badRequest(`Not a permission: ${unknown.join(', ')}`, 'UNKNOWN_PERMISSION');

  // FR-GOV-033: never more than the delegator holds.
  const missing = input.permissions.filter((p) => isKey(p) && !context.grants.has(p));
  if (missing.length) {
    throw ApiError.forbidden(
      `You cannot delegate authority you do not hold: ${missing.join(', ')}`,
      'CANNOT_DELEGATE_UNHELD_PERMISSION',
    );
  }

  const member = await prisma.membership.findFirst({
    where: { userId: input.delegateId, kennelId: kennel.id, status: MembershipStatus.ACTIVE },
    select: { id: true },
  });
  if (!member) throw ApiError.badRequest('Delegates must be active members of the kennel.', 'NOT_A_MEMBER');

  const now = new Date();
  if (input.expiresAt <= now) throw ApiError.badRequest('Pick an expiry in the future.', 'EXPIRY_IN_PAST');
  const maxExpiry = new Date(now.getTime() + MAX_DAYS * 24 * 60 * 60 * 1000);
  if (input.expiresAt > maxExpiry) {
    throw ApiError.badRequest(`A delegation can run for at most ${MAX_DAYS} days.`, 'EXPIRY_TOO_FAR');
  }

  // Where the authority came from, so the audit trail reads back properly.
  const appointment = await prisma.officerAppointment.findFirst({
    where: { userId: actor.id, kennelId: kennel.id, status: RoleAssignmentStatus.ACTIVE },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    const delegation = await tx.delegation.create({
      data: {
        kennelId: kennel.id,
        delegatorId: actor.id,
        delegateId: input.delegateId,
        sourceAppointmentId: appointment?.id ?? null,
        permissions: input.permissions,
        reason: input.reason.trim(),
        expiresAt: input.expiresAt,
      },
      select: { id: true },
    });
    const event = await recordEvent(tx, {
      eventType: 'DelegationGranted',
      aggregateType: 'Delegation',
      aggregateId: delegation.id,
      actorId: actor.id,
      payload: {
        kennelId: kennel.id,
        delegateId: input.delegateId,
        permissions: input.permissions,
        expiresAt: input.expiresAt.toISOString(),
      },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'delegation.grant',
      resourceType: 'Delegation',
      resourceId: delegation.id,
      kennelId: kennel.id,
      newState: { delegateId: input.delegateId, permissions: input.permissions, expiresAt: input.expiresAt },
      reason: input.reason.trim(),
      policyRef: appointment ? `officer-appointment:${appointment.id}` : 'kennel-admin',
      domainEventId: event.id,
    });
  });

  return listDelegations(actor, slug);
}

export async function revoke(actor: Actor, delegationId: string, reason: string | null) {
  if (!isUuid(delegationId)) throw ApiError.notFound('Delegation not found');
  const delegation = await prisma.delegation.findUnique({
    where: { id: delegationId },
    select: {
      id: true,
      kennelId: true,
      delegatorId: true,
      delegateId: true,
      revokedAt: true,
      kennel: { select: { slug: true } },
    },
  });
  if (!delegation) throw ApiError.notFound('Delegation not found');
  if (delegation.revokedAt) throw ApiError.badRequest('That delegation is already revoked.', 'ALREADY_REVOKED');

  const context = await resolveKennelContext(actor, delegation.kennelId);
  const own = delegation.delegatorId === actor.id;
  const oversight = Boolean(context.grants.get('officer.appoint')) || Boolean(context.grants.get('kennel.manage'));
  if (!own && !oversight) {
    throw ApiError.forbidden('Only the delegator or an officer can take this back.', 'CANNOT_REVOKE');
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.delegation.update({ where: { id: delegationId }, data: { revokedAt: now } });
    const event = await recordEvent(tx, {
      eventType: 'DelegationRevoked',
      aggregateType: 'Delegation',
      aggregateId: delegationId,
      actorId: actor.id,
      payload: { kennelId: delegation.kennelId, delegateId: delegation.delegateId },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'delegation.revoke',
      resourceType: 'Delegation',
      resourceId: delegationId,
      kennelId: delegation.kennelId,
      previousState: { revoked: false },
      newState: { revoked: true },
      reason: reason?.trim() || null,
      policyRef: own ? 'self' : 'officer.appoint',
      domainEventId: event.id,
    });
  });

  return listDelegations(actor, delegation.kennel.slug);
}
