import { ActorType, Prisma } from '@prisma/client';

// Ch.24: a domain event is written in the same transaction as the state change
// it describes (transactional outbox), so an event exists if and only if the
// change committed. Consumers (notifications, passport, search, audit, capsule)
// read unpublished rows; none are wired yet.
//
// An AI agent is never the actor on an event (Ch.24 AI Event Boundaries): the
// actor is a human user id, or null with actorType SYSTEM for rule-based
// automatic transitions.
type Tx = Prisma.TransactionClient;

export interface EventInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  actorId: string | null;
  payload?: Prisma.InputJsonValue;
  version?: number;
  clientOccurredAt?: Date;
}

export async function recordEvent(tx: Tx, input: EventInput) {
  const event = await tx.domainEvent.create({
    data: {
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      actorId: input.actorId,
      actorType: input.actorId ? ActorType.USER : ActorType.SYSTEM,
      payload: input.payload ?? {},
      version: input.version ?? 1,
      clientOccurredAt: input.clientOccurredAt,
    },
  });

  // Wake the outbox worker immediately when a new domain event lands. Postgres
  // NOTIFY is delivered after commit, so this is a real queue wake-up without
  // needing a broker or a polling-only architecture. The timer remains as a
  // safety net in case the listener is not ready or a node is restarted.
  await tx.$queryRaw`SELECT pg_notify('hcp_outbox_notify', ${event.id}) IS NULL`;

  return event;
}

export interface AuditInput {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  kennelId?: string | null;
  previousState?: Prisma.InputJsonValue;
  newState?: Prisma.InputJsonValue;
  reason?: string | null;
  // How the actor was authorized, e.g. "kennel-admin", "officer:Grand Master",
  // "delegation:<id>", "platform-admin" or "self" (PERMISSION-MATRIX.md).
  policyRef?: string | null;
  domainEventId?: string | null;
}

// AuditLog is the governance record (who was allowed to do what, and why). It
// references the DomainEvent; it does not replace it.
export function recordAudit(tx: Tx, input: AuditInput) {
  return tx.auditLog.create({
    data: {
      actorId: input.actorId,
      actorType: input.actorId ? ActorType.USER : ActorType.SYSTEM,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      kennelId: input.kennelId ?? null,
      previousState: input.previousState,
      newState: input.newState,
      reason: input.reason ?? null,
      policyRef: input.policyRef ?? null,
      domainEventId: input.domainEventId ?? null,
    },
  });
}
