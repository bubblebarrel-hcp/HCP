import { MembershipStatus, PlatformRole, RoleAssignmentStatus, ScopedRole } from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError } from '../utils/http';

// Kennel-scoped authority, resolved against the database on every check and
// never read from a token claim. CODEX/PERMISSION-MATRIX.md is the spec for
// this file: keep the two in step.
export const KENNEL_PERMISSIONS = [
  'membership.review',
  'membership.suspend',
  'membership.remove',
  'membership.invite',
  'officer.appoint',
  'kennel.manage',
  'run.manage',
  'run.visibility.change',
  'trail.manage',
  'report.publish',
  'media.moderate',
] as const;

export type KennelPermission = (typeof KENNEL_PERMISSIONS)[number];

export interface Actor {
  id: string;
  role: PlatformRole;
}

// Where a grant came from, recorded as AuditLog.policyRef so every decision can
// be explained later (08L-04 FR-GOV-034).
export type GrantSource = string;

export interface KennelContext {
  // Holds an ACTIVE membership of the kennel.
  isMember: boolean;
  grants: Map<KennelPermission, GrantSource>;
}

function isKennelPermission(value: string): value is KennelPermission {
  return (KENNEL_PERMISSIONS as readonly string[]).includes(value);
}

function stillCurrent(now: Date) {
  return { OR: [{ endDate: null }, { endDate: { gt: now } }] };
}

// Authority a person holds in their own right: kennel admin role and officer
// positions. Both require an ACTIVE membership (FR-MEMBER-011), so a suspended
// officer holds nothing until reinstated.
async function directGrants(userId: string, kennelId: string, now: Date): Promise<KennelContext> {
  const grants = new Map<KennelPermission, GrantSource>();

  const membership = await prisma.membership.findFirst({
    where: { userId, kennelId, status: MembershipStatus.ACTIVE },
    select: { id: true },
  });
  if (!membership) return { isMember: false, grants };

  const [adminRole, appointments] = await Promise.all([
    prisma.roleAssignment.findFirst({
      where: {
        userId,
        kennelId,
        role: ScopedRole.KENNEL_ADMIN,
        status: RoleAssignmentStatus.ACTIVE,
        ...stillCurrent(now),
      },
      select: { id: true },
    }),
    prisma.officerAppointment.findMany({
      where: { userId, kennelId, status: RoleAssignmentStatus.ACTIVE, ...stillCurrent(now) },
      select: { position: { select: { title: true, permissions: true, archivedAt: true } } },
    }),
  ]);

  if (adminRole) {
    for (const p of KENNEL_PERMISSIONS) grants.set(p, 'kennel-admin');
  }
  for (const { position } of appointments) {
    if (position.archivedAt) continue;
    for (const p of position.permissions) {
      if (isKennelPermission(p) && !grants.has(p)) grants.set(p, `officer:${position.title}`);
    }
  }
  return { isMember: true, grants };
}

// Membership plus every permission the actor holds in one kennel.
export async function resolveKennelContext(actor: Actor, kennelId: string): Promise<KennelContext> {
  const now = new Date();
  const direct = await directGrants(actor.id, kennelId, now);

  // Platform admins can act in any kennel. The override is visible in the audit
  // trail as policyRef "platform-admin", never silent.
  if (actor.role === PlatformRole.ADMIN) {
    return {
      isMember: direct.isMember,
      grants: new Map<KennelPermission, GrantSource>(KENNEL_PERMISSIONS.map((p) => [p, 'platform-admin'])),
    };
  }
  if (!direct.isMember) return direct;

  const grants = direct.grants;
  const delegations = await prisma.delegation.findMany({
    where: { delegateId: actor.id, kennelId, revokedAt: null, startsAt: { lte: now }, expiresAt: { gt: now } },
    select: { id: true, delegatorId: true, permissions: true },
  });

  // FR-GOV-033: a delegation never exceeds the delegator's own authority. That is
  // judged now, not when it was granted, so a delegate loses a permission the
  // moment the delegator does. Delegations do not chain.
  const delegatorGrants = new Map<string, Map<KennelPermission, GrantSource>>();
  for (const d of delegations) {
    if (!delegatorGrants.has(d.delegatorId)) {
      delegatorGrants.set(d.delegatorId, (await directGrants(d.delegatorId, kennelId, now)).grants);
    }
    const held = delegatorGrants.get(d.delegatorId)!;
    for (const p of d.permissions) {
      if (isKennelPermission(p) && held.has(p) && !grants.has(p)) grants.set(p, `delegation:${d.id}`);
    }
  }
  return { isMember: true, grants };
}

// The editorial roles are RoleAssignments, not officer-position permissions: a
// kennel appoints a Hash Scribe without making them an officer. Scribe Studio
// asks this in two places (starting a report, adding to the story), so it lives
// here rather than in either of them (D29).
export async function hasScribeRole(userId: string, kennelId: string) {
  const now = new Date();
  const assignment = await prisma.roleAssignment.findFirst({
    where: {
      userId,
      kennelId,
      role: { in: [ScopedRole.SCRIBE, ScopedRole.ASSISTANT_SCRIBE] },
      status: RoleAssignmentStatus.ACTIVE,
      ...stillCurrent(now),
    },
    select: { id: true },
  });
  return Boolean(assignment);
}

export async function resolveKennelPermissions(actor: Actor, kennelId: string) {
  return (await resolveKennelContext(actor, kennelId)).grants;
}

export async function assertKennelPermission(
  actor: Actor,
  kennelId: string,
  permission: KennelPermission,
): Promise<GrantSource> {
  const source = (await resolveKennelPermissions(actor, kennelId)).get(permission);
  if (!source) {
    throw ApiError.forbidden("You don't have permission to do that in this kennel.", 'KENNEL_PERMISSION_REQUIRED');
  }
  return source;
}
