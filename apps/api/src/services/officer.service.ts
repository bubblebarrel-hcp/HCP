import { AppointmentMethod, MembershipStatus, Prisma, RoleAssignmentStatus, type ScopedRole } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid } from '../utils/http';
import {
  type Actor,
  type GrantSource,
  type KennelPermission,
  KENNEL_PERMISSIONS,
  assertKennelPermission,
  resolveKennelContext,
} from './permission.service';
import { recordAudit, recordEvent } from './record.service';
import { publicName, userPublicSelect } from './run.service';

// Officer positions and appointments (Annex 08L-01, Ch.22 A.10).
//
// Two different powers live here and are deliberately kept apart (D32):
//   - defining what a position may do        → kennel.manage
//   - putting a person into an existing seat → officer.appoint
//
// Folding them together would let anyone holding officer.appoint write
// kennel.manage onto a position and then appoint themselves to it. Appointing is
// additionally capped by what the appointer holds, so authority can be handed
// on but never invented.

function isKey(value: string): value is KennelPermission {
  return (KENNEL_PERMISSIONS as readonly string[]).includes(value);
}

async function kennelBySlug(slug: string) {
  const kennel = await prisma.kennel.findUnique({ where: { slug }, select: { id: true, shortName: true } });
  if (!kennel) throw ApiError.notFound('Kennel not found');
  return kennel;
}

const positionSelect = {
  id: true,
  title: true,
  description: true,
  responsibilities: true,
  permissions: true,
  termMonths: true,
  appointmentMethod: true,
  isMismanagement: true,
  sortOrder: true,
  archivedAt: true,
  appointments: {
    where: { status: RoleAssignmentStatus.ACTIVE },
    select: { id: true, startDate: true, endDate: true, user: { select: userPublicSelect } },
  },
} satisfies Prisma.OfficerPositionSelect;

type PositionRow = Prisma.OfficerPositionGetPayload<{ select: typeof positionSelect }>;

function serializePosition(position: PositionRow, canSeeKeys: boolean) {
  return {
    id: position.id,
    title: position.title,
    description: position.description,
    responsibilities: position.responsibilities,
    // Which keys a position carries is governance detail, not public trivia.
    permissions: canSeeKeys ? position.permissions : null,
    termMonths: position.termMonths,
    appointmentMethod: position.appointmentMethod,
    isMismanagement: position.isMismanagement,
    sortOrder: position.sortOrder,
    archived: Boolean(position.archivedAt),
    holders: position.appointments.map((a) => ({
      appointmentId: a.id,
      name: publicName(a.user),
      userId: a.user.id,
      startDate: a.startDate,
      endDate: a.endDate,
    })),
  };
}

async function memberContext(actor: Actor, kennelId: string) {
  const context = await resolveKennelContext(actor, kennelId);
  if (!context.isMember && context.grants.size === 0) {
    throw ApiError.forbidden('Only members see how a kennel is run.', 'MEMBERS_ONLY');
  }
  return context;
}

// ─── Reads ───

export async function listPositions(actor: Actor, slug: string) {
  const kennel = await kennelBySlug(slug);
  const context = await memberContext(actor, kennel.id);
  const canManage = Boolean(context.grants.get('kennel.manage'));
  const canAppoint = Boolean(context.grants.get('officer.appoint'));

  const rows = await prisma.officerPosition.findMany({
    where: { kennelId: kennel.id },
    orderBy: [{ archivedAt: 'asc' }, { sortOrder: 'asc' }],
    select: positionSelect,
  });

  // You cannot appoint someone you cannot see. Whoever may appoint gets the
  // names to choose from, without needing membership.review as well.
  const members = canAppoint || canManage ? await appointableMembers(kennel.id) : [];

  return {
    items: rows.map((r) => serializePosition(r, canManage || canAppoint)),
    members,
    // What this kennel calls each standing role, so the next grant starts from
    // the kennel's own vocabulary rather than the platform's (D40).
    roleTitles: canManage ? await roleTitles(kennel.id) : {},
    viewer: {
      canDefinePositions: canManage,
      canAppoint,
      // What this viewer may hand out, so the UI never offers a key the API
      // would refuse (D32).
      grantableKeys: [...context.grants.keys()],
    },
  };
}

// Active members, by public name only (D11).
export async function appointableMembers(kennelId: string) {
  const rows = await prisma.membership.findMany({
    where: { kennelId, status: MembershipStatus.ACTIVE },
    select: { user: { select: userPublicSelect } },
  });
  return rows
    .map((m) => ({ userId: m.user.id, name: publicName(m.user) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// FR-GOV-006: the leadership timeline is permanent history, not a current list.
export async function leadershipTimeline(actor: Actor, slug: string) {
  const kennel = await kennelBySlug(slug);
  await memberContext(actor, kennel.id);

  const rows = await prisma.officerAppointment.findMany({
    where: { kennelId: kennel.id },
    orderBy: [{ startDate: 'desc' }],
    select: {
      id: true,
      status: true,
      method: true,
      startDate: true,
      endDate: true,
      endedReason: true,
      position: { select: { id: true, title: true } },
      user: { select: userPublicSelect },
    },
  });

  return {
    items: rows.map((r) => ({
      id: r.id,
      status: r.status,
      method: r.method,
      startDate: r.startDate,
      endDate: r.endDate,
      endedReason: r.endedReason,
      position: r.position,
      officer: publicName(r.user),
      officerId: r.user.id,
      current: r.status === RoleAssignmentStatus.ACTIVE,
    })),
  };
}

// ─── Defining positions (kennel.manage) ───

// You cannot write a key onto a position that you do not hold yourself.
// Otherwise "edit positions" quietly becomes "grant yourself anything".
function assertCanGrantKeys(grants: Map<KennelPermission, GrantSource>, keys: string[]) {
  const unknown = keys.filter((k) => !isKey(k));
  if (unknown.length) {
    throw ApiError.badRequest(`Not a permission: ${unknown.join(', ')}`, 'UNKNOWN_PERMISSION');
  }
  const missing = keys.filter((k) => isKey(k) && !grants.has(k));
  if (missing.length) {
    throw ApiError.forbidden(
      `You cannot give away authority you do not hold: ${missing.join(', ')}`,
      'CANNOT_GRANT_UNHELD_PERMISSION',
    );
  }
}

export interface PositionInput {
  title: string;
  description?: string | null;
  responsibilities?: string | null;
  permissions: string[];
  termMonths?: number | null;
  appointmentMethod?: AppointmentMethod;
  isMismanagement?: boolean;
  sortOrder?: number;
}

export async function createPosition(actor: Actor, slug: string, input: PositionInput) {
  const kennel = await kennelBySlug(slug);
  const source = await assertKennelPermission(actor, kennel.id, 'kennel.manage');
  const context = await resolveKennelContext(actor, kennel.id);
  assertCanGrantKeys(context.grants, input.permissions);

  const existing = await prisma.officerPosition.findFirst({
    where: { kennelId: kennel.id, title: input.title.trim() },
    select: { id: true },
  });
  if (existing) throw ApiError.conflict('That position already exists.', 'POSITION_EXISTS');

  await prisma.$transaction(async (tx) => {
    const position = await tx.officerPosition.create({
      data: {
        kennelId: kennel.id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        responsibilities: input.responsibilities?.trim() || null,
        permissions: input.permissions,
        termMonths: input.termMonths ?? null,
        appointmentMethod: input.appointmentMethod ?? AppointmentMethod.ELECTED,
        isMismanagement: input.isMismanagement ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
      select: { id: true, title: true },
    });
    const event = await recordEvent(tx, {
      eventType: 'OfficerPositionDefined',
      aggregateType: 'OfficerPosition',
      aggregateId: position.id,
      actorId: actor.id,
      payload: { kennelId: kennel.id, title: position.title, permissions: input.permissions },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'officer.position.create',
      resourceType: 'OfficerPosition',
      resourceId: position.id,
      kennelId: kennel.id,
      newState: { title: position.title, permissions: input.permissions },
      policyRef: source,
      domainEventId: event.id,
    });
  });

  return listPositions(actor, slug);
}

export async function updatePosition(actor: Actor, positionId: string, input: Partial<PositionInput>) {
  if (!isUuid(positionId)) throw ApiError.notFound('Position not found');
  const position = await prisma.officerPosition.findUnique({
    where: { id: positionId },
    select: {
      id: true,
      kennelId: true,
      title: true,
      permissions: true,
      archivedAt: true,
      kennel: { select: { slug: true } },
    },
  });
  if (!position) throw ApiError.notFound('Position not found');

  const source = await assertKennelPermission(actor, position.kennelId, 'kennel.manage');
  const context = await resolveKennelContext(actor, position.kennelId);
  if (input.permissions) assertCanGrantKeys(context.grants, input.permissions);

  await prisma.$transaction(async (tx) => {
    await tx.officerPosition.update({
      where: { id: positionId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.responsibilities !== undefined
          ? { responsibilities: input.responsibilities?.trim() || null }
          : {}),
        ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
        ...(input.termMonths !== undefined ? { termMonths: input.termMonths } : {}),
        ...(input.appointmentMethod !== undefined ? { appointmentMethod: input.appointmentMethod } : {}),
        ...(input.isMismanagement !== undefined ? { isMismanagement: input.isMismanagement } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
    const event = await recordEvent(tx, {
      eventType: 'OfficerPositionUpdated',
      aggregateType: 'OfficerPosition',
      aggregateId: positionId,
      actorId: actor.id,
      payload: { kennelId: position.kennelId, ...(input.permissions ? { permissions: input.permissions } : {}) },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'officer.position.update',
      resourceType: 'OfficerPosition',
      resourceId: positionId,
      kennelId: position.kennelId,
      previousState: { title: position.title, permissions: position.permissions },
      newState: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.permissions ? { permissions: input.permissions } : {}),
      },
      policyRef: source,
      domainEventId: event.id,
    });
  });

  return listPositions(actor, position.kennel.slug);
}

// Archived, never deleted: the appointments that reference it are history
// (FR-GOV-006). An archived position grants nothing (permission.service).
export async function archivePosition(actor: Actor, positionId: string, reason: string) {
  if (!isUuid(positionId)) throw ApiError.notFound('Position not found');
  const position = await prisma.officerPosition.findUnique({
    where: { id: positionId },
    select: { id: true, kennelId: true, title: true, archivedAt: true, kennel: { select: { slug: true } } },
  });
  if (!position) throw ApiError.notFound('Position not found');
  if (position.archivedAt) throw ApiError.badRequest('That position is already archived.', 'ALREADY_ARCHIVED');
  const source = await assertKennelPermission(actor, position.kennelId, 'kennel.manage');

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.officerPosition.update({ where: { id: positionId }, data: { archivedAt: now } });
    // Anyone still holding it stops holding it, on the record.
    await tx.officerAppointment.updateMany({
      where: { positionId, status: RoleAssignmentStatus.ACTIVE },
      data: {
        status: RoleAssignmentStatus.TERM_ENDED,
        endDate: now,
        endedReason: `Position archived: ${reason}`,
      },
    });
    const event = await recordEvent(tx, {
      eventType: 'OfficerPositionArchived',
      aggregateType: 'OfficerPosition',
      aggregateId: positionId,
      actorId: actor.id,
      payload: { kennelId: position.kennelId, title: position.title, reason },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'officer.position.archive',
      resourceType: 'OfficerPosition',
      resourceId: positionId,
      kennelId: position.kennelId,
      previousState: { archived: false },
      newState: { archived: true },
      reason,
      policyRef: source,
      domainEventId: event.id,
    });
  });

  return listPositions(actor, position.kennel.slug);
}

// ─── Appointments (officer.appoint) ───

export async function appoint(
  actor: Actor,
  positionId: string,
  input: { userId: string; method?: AppointmentMethod; startDate?: Date | null },
) {
  if (!isUuid(positionId)) throw ApiError.notFound('Position not found');
  const position = await prisma.officerPosition.findUnique({
    where: { id: positionId },
    select: {
      id: true,
      kennelId: true,
      title: true,
      permissions: true,
      termMonths: true,
      archivedAt: true,
      appointmentMethod: true,
      kennel: { select: { slug: true } },
    },
  });
  if (!position) throw ApiError.notFound('Position not found');
  if (position.archivedAt) throw ApiError.badRequest('That position is archived.', 'POSITION_ARCHIVED');

  const source = await assertKennelPermission(actor, position.kennelId, 'officer.appoint');
  const context = await resolveKennelContext(actor, position.kennelId);
  // The cap that stops appointment becoming self-promotion (D32).
  assertCanGrantKeys(context.grants, position.permissions);

  // FR-MEMBER-011: officers are members first.
  const membership = await prisma.membership.findFirst({
    where: { userId: input.userId, kennelId: position.kennelId, status: MembershipStatus.ACTIVE },
    select: { id: true },
  });
  if (!membership) {
    throw ApiError.badRequest('Officers must be active members of the kennel.', 'NOT_A_MEMBER');
  }

  const already = await prisma.officerAppointment.findFirst({
    where: { positionId, userId: input.userId, status: RoleAssignmentStatus.ACTIVE },
    select: { id: true },
  });
  if (already) throw ApiError.conflict('They already hold that position.', 'ALREADY_APPOINTED');

  const startDate = input.startDate ?? new Date();
  const endDate = position.termMonths
    ? new Date(new Date(startDate).setMonth(startDate.getMonth() + position.termMonths))
    : null;

  await prisma.$transaction(async (tx) => {
    const appointment = await tx.officerAppointment.create({
      data: {
        kennelId: position.kennelId,
        positionId,
        userId: input.userId,
        membershipId: membership.id,
        status: RoleAssignmentStatus.ACTIVE,
        method: input.method ?? position.appointmentMethod,
        startDate,
        endDate,
        appointedById: actor.id,
      },
      select: { id: true },
    });
    const event = await recordEvent(tx, {
      eventType: 'RoleAssigned',
      aggregateType: 'OfficerAppointment',
      aggregateId: appointment.id,
      actorId: actor.id,
      payload: {
        kennelId: position.kennelId,
        userId: input.userId,
        positionId,
        title: position.title,
        permissions: position.permissions,
      },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'officer.appoint',
      resourceType: 'OfficerAppointment',
      resourceId: appointment.id,
      kennelId: position.kennelId,
      newState: { userId: input.userId, title: position.title, startDate, endDate },
      policyRef: source,
      domainEventId: event.id,
    });
  });

  return listPositions(actor, position.kennel.slug);
}

// Ch.22 A.10: every ending lands on history, never deletion.
const END_STATUS: Record<string, RoleAssignmentStatus> = {
  'term-ended': RoleAssignmentStatus.TERM_ENDED,
  resigned: RoleAssignmentStatus.RESIGNED,
  revoked: RoleAssignmentStatus.REVOKED,
};

export async function endAppointment(actor: Actor, appointmentId: string, action: string, reason: string) {
  const status = END_STATUS[action];
  if (!status) throw ApiError.badRequest('Unknown action', 'UNKNOWN_ACTION');
  if (!isUuid(appointmentId)) throw ApiError.notFound('Appointment not found');

  const appointment = await prisma.officerAppointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      kennelId: true,
      userId: true,
      status: true,
      position: { select: { title: true } },
      kennel: { select: { slug: true } },
    },
  });
  if (!appointment) throw ApiError.notFound('Appointment not found');
  if (appointment.status !== RoleAssignmentStatus.ACTIVE) {
    throw ApiError.badRequest('That appointment has already ended.', 'ALREADY_ENDED');
  }

  // Standing down needs no permission; ending someone else's does.
  const own = appointment.userId === actor.id;
  if (own && status !== RoleAssignmentStatus.RESIGNED) {
    throw ApiError.badRequest('Standing down from your own position is a resignation.', 'USE_RESIGN');
  }
  const source: GrantSource = own
    ? 'self'
    : await assertKennelPermission(actor, appointment.kennelId, 'officer.appoint');

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.officerAppointment.update({
      where: { id: appointmentId },
      data: { status, endDate: now, endedReason: reason },
    });
    const event = await recordEvent(tx, {
      eventType: 'RoleEnded',
      aggregateType: 'OfficerAppointment',
      aggregateId: appointmentId,
      actorId: actor.id,
      payload: { kennelId: appointment.kennelId, userId: appointment.userId, status, reason },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: `officer.${action}`,
      resourceType: 'OfficerAppointment',
      resourceId: appointmentId,
      kennelId: appointment.kennelId,
      previousState: { status: appointment.status },
      newState: { status },
      reason,
      policyRef: source,
      domainEventId: event.id,
    });
  });

  return listPositions(actor, appointment.kennel.slug);
}

// ─── Kennel-scoped roles (Ch.23 Part B, RoleAssignment) ─────────────────────
//
// An office is a seat with a title and a term; a role is a standing job like
// scribe or photographer. Both are real grants read by permission.service, and
// neither is ever a claim on a token (a person is never a role).
//
// HARE and CO_HARE are deliberately absent: they belong to a run, and
// run.service grants them when the hares are set. Granting them kennel-wide
// would make somebody permanently the hare of nothing.
export const GRANTABLE_ROLES = [
  'KENNEL_ADMIN',
  'SCRIBE',
  'ASSISTANT_SCRIBE',
  'REVIEWER',
  'PHOTOGRAPHER',
  'VOLUNTEER',
  'MODERATOR',
  'EVENT_ORGANIZER',
] as const satisfies readonly ScopedRole[];

export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

export function isGrantableRole(value: string): value is GrantableRole {
  return (GRANTABLE_ROLES as readonly string[]).includes(value);
}

// Handing out authority is kennel.manage, the same bar as defining what an
// office may do (D32) — and stricter than officer.appoint, because KENNEL_ADMIN
// carries every kennel permission there is.
export async function grantRole(
  actor: Actor,
  slug: string,
  input: { userId: string; role: GrantableRole; title?: string | null },
) {
  // The Joi schema checks this at the edge; checking it here too means a future
  // caller that is not an HTTP route cannot hand out a run-scoped role
  // kennel-wide, which would make somebody permanently the hare of nothing.
  if (!isGrantableRole(input.role)) {
    throw ApiError.badRequest('That role is set by the run it belongs to.', 'ROLE_NOT_KENNEL_SCOPED');
  }
  const kennel = await kennelBySlug(slug);
  const source = await assertKennelPermission(actor, kennel.id, 'kennel.manage');

  // FR-MEMBER-011 again: authority in a kennel follows membership of it.
  const membership = await prisma.membership.findFirst({
    where: { userId: input.userId, kennelId: kennel.id, status: MembershipStatus.ACTIVE },
    select: { id: true },
  });
  if (!membership) throw ApiError.badRequest('Roles go to active members of the kennel.', 'NOT_A_MEMBER');

  const already = await prisma.roleAssignment.findFirst({
    where: { userId: input.userId, kennelId: kennel.id, role: input.role, status: RoleAssignmentStatus.ACTIVE },
    select: { id: true },
  });
  if (already) throw ApiError.conflict('They already hold that role.', 'ALREADY_GRANTED');

  await prisma.$transaction(async (tx) => {
    const assignment = await tx.roleAssignment.create({
      data: {
        userId: input.userId,
        kennelId: kennel.id,
        membershipId: membership.id,
        role: input.role,
        // The kennel's own word for the job; null falls back to the platform's.
        title: input.title?.trim() || null,
        status: RoleAssignmentStatus.ACTIVE,
        grantedById: actor.id,
      },
      select: { id: true },
    });
    const event = await recordEvent(tx, {
      eventType: 'RoleAssigned',
      aggregateType: 'RoleAssignment',
      aggregateId: assignment.id,
      actorId: actor.id,
      payload: { kennelId: kennel.id, userId: input.userId, role: input.role, title: input.title?.trim() || null },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'role.assign',
      resourceType: 'RoleAssignment',
      resourceId: assignment.id,
      kennelId: kennel.id,
      newState: { userId: input.userId, role: input.role, title: input.title?.trim() || null },
      policyRef: source,
      domainEventId: event.id,
    });
  });

  return { granted: true, role: input.role };
}

// Ch.22 A.10: a role that ends is recorded as ended, never deleted.
export async function revokeRole(actor: Actor, assignmentId: string, reason: string) {
  if (!isUuid(assignmentId)) throw ApiError.notFound('Role not found');
  const assignment = await prisma.roleAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, userId: true, kennelId: true, role: true, status: true, runId: true },
  });
  if (!assignment?.kennelId) throw ApiError.notFound('Role not found');
  if (assignment.status !== RoleAssignmentStatus.ACTIVE) {
    throw ApiError.badRequest('That role has already ended.', 'ROLE_NOT_ACTIVE');
  }
  // A hare's role belongs to their run and ends with it.
  if (assignment.runId || !isGrantableRole(assignment.role)) {
    throw ApiError.badRequest('That role is set by the run it belongs to.', 'ROLE_NOT_KENNEL_SCOPED');
  }

  const source = await assertKennelPermission(actor, assignment.kennelId, 'kennel.manage');

  // A kennel with nobody who can run it cannot appoint its way out again.
  if (assignment.role === 'KENNEL_ADMIN') {
    const others = await prisma.roleAssignment.count({
      where: {
        kennelId: assignment.kennelId,
        role: 'KENNEL_ADMIN',
        status: RoleAssignmentStatus.ACTIVE,
        NOT: { id: assignment.id },
      },
    });
    if (others === 0) {
      throw ApiError.badRequest(
        'A kennel keeps at least one admin. Grant someone else the role first.',
        'LAST_KENNEL_ADMIN',
      );
    }
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.roleAssignment.update({
      where: { id: assignment.id },
      data: { status: RoleAssignmentStatus.REVOKED, endDate: now },
    });
    const event = await recordEvent(tx, {
      eventType: 'RoleEnded',
      aggregateType: 'RoleAssignment',
      aggregateId: assignment.id,
      actorId: actor.id,
      payload: { kennelId: assignment.kennelId, userId: assignment.userId, role: assignment.role, reason },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'role.revoke',
      resourceType: 'RoleAssignment',
      resourceId: assignment.id,
      kennelId: assignment.kennelId,
      previousState: { status: RoleAssignmentStatus.ACTIVE, role: assignment.role },
      newState: { status: RoleAssignmentStatus.REVOKED },
      reason,
      policyRef: source,
      domainEventId: event.id,
    });
  });

  return { revoked: true, role: assignment.role };
}

// What this kennel already calls each role, taken from the grants it has made.
// A kennel that calls its photographer the Hash Flash said so once; the next
// grant should not make them say it again (D40).
export async function roleTitles(kennelId: string) {
  const rows = await prisma.roleAssignment.findMany({
    where: { kennelId, runId: null, title: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { role: true, title: true },
  });
  const named: Partial<Record<GrantableRole, string>> = {};
  for (const row of rows) {
    // Most recent wins, and the loop runs newest first.
    if (isGrantableRole(row.role) && !named[row.role] && row.title) named[row.role] = row.title;
  }
  return named;
}

// Renaming what a kennel calls a job it has already handed out. The authority
// is untouched, so this is presentation rather than domain state — the same
// reasoning kennel branding follows (D35) — and it lands in the audit log
// without inventing a domain event Chapter 24 does not have.
export async function renameRole(actor: Actor, assignmentId: string, title: string | null) {
  if (!isUuid(assignmentId)) throw ApiError.notFound('Role not found');
  const assignment = await prisma.roleAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, kennelId: true, role: true, title: true, status: true, runId: true },
  });
  if (!assignment?.kennelId) throw ApiError.notFound('Role not found');
  if (assignment.status !== RoleAssignmentStatus.ACTIVE) {
    throw ApiError.badRequest('That role has already ended.', 'ROLE_NOT_ACTIVE');
  }
  if (assignment.runId) throw ApiError.badRequest('That role is set by the run it belongs to.', 'ROLE_NOT_KENNEL_SCOPED');

  const source = await assertKennelPermission(actor, assignment.kennelId, 'kennel.manage');
  const next = title?.trim() || null;

  await prisma.$transaction(async (tx) => {
    await tx.roleAssignment.update({ where: { id: assignment.id }, data: { title: next } });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'role.rename',
      resourceType: 'RoleAssignment',
      resourceId: assignment.id,
      kennelId: assignment.kennelId,
      previousState: { title: assignment.title },
      newState: { title: next },
      policyRef: source,
    });
  });

  return { renamed: true, title: next };
}
