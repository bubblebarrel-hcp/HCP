import {
  AiSuggestionKind,
  AiSuggestionStatus,
  CapsuleStatus,
  KennelVisibility,
  MembershipStatus,
  Prisma,
  ReportContributorRole,
  RunStatus,
  RunVisibility,
  TrailReportStatus,
} from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import * as ai from './ai.service';
import { type Actor, hasScribeRole } from './permission.service';
import { recordAudit, recordEvent } from './record.service';
import {
  type RunAccess,
  canView,
  getAccess,
  publicName,
  userPublicSelect,
  viewableAccess,
} from './run.service';
import * as stories from './story.service';

// Scribe Studio (Annex 08G, Ch.22 A.5). The Scribe owns the narrative; officers
// provide governance, not authorship.
//
//   Draft → Scribe Editing → Review → Published → Archived
//
// Draft → Published directly is invalid (Ch.22 A.5): a report must pass through
// human editing. Published → Draft is invalid too — corrections are revisions,
// and the original publication is preserved (BR-SCRIBE-011).

const S = TrailReportStatus;

// A report can be started once there is something to report on.
const REPORTABLE: RunStatus[] = [RunStatus.LIVE, RunStatus.CIRCLE, RunStatus.REPORTING, RunStatus.ARCHIVED];
// BR-SCRIBE-007: publication validates the run is actually over.
const PUBLISHABLE_RUN: RunStatus[] = [RunStatus.REPORTING, RunStatus.ARCHIVED];

const EDITING_STATES: TrailReportStatus[] = [S.DRAFT, S.SCRIBE_EDITING, S.REVIEW];

// ─── Access (BR-SCRIBE-003, BR-SCRIBE-004) ───

export interface ReportAccess {
  report: ReportRow;
  run: RunAccess;
  isScribe: boolean;
  isAssistant: boolean;
  isReviewer: boolean;
  // Officers who govern publication rather than write it.
  canGovern: boolean;
  canEdit: boolean;
  canPublish: boolean;
  canReview: boolean;
  canSeeDraft: boolean;
}

const reportSelect = {
  id: true,
  runId: true,
  status: true,
  title: true,
  body: true,
  aiAssisted: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  officialScribeId: true,
  officialScribe: { select: userPublicSelect },
  contributors: { select: { userId: true, role: true, user: { select: userPublicSelect } } },
  run: {
    select: {
      id: true,
      runNumber: true,
      title: true,
      theme: true,
      startsAt: true,
      timeZone: true,
      kennelId: true,
      // A report has no photo of its own yet; the run's flyer is the fallback
      // cover wherever a report is shown a picture (feed card, share preview).
      posterUrl: true,
      kennel: { select: { name: true, shortName: true, slug: true } },
    },
  },
} satisfies Prisma.TrailReportSelect;

type ReportRow = Prisma.TrailReportGetPayload<{ select: typeof reportSelect }>;

function contributorsOf(report: ReportRow, role: ReportContributorRole) {
  return report.contributors.filter((c) => c.role === role);
}

async function buildAccess(actor: Actor | undefined, report: ReportRow): Promise<ReportAccess> {
  const run = await getAccess(actor, report.runId);

  const isScribe = Boolean(actor) && report.officialScribeId === actor!.id;
  const isAssistant =
    Boolean(actor) && contributorsOf(report, ReportContributorRole.ASSISTANT_SCRIBE).some((c) => c.userId === actor!.id);
  const isReviewer =
    Boolean(actor) && contributorsOf(report, ReportContributorRole.REVIEWER).some((c) => c.userId === actor!.id);
  // report.publish is the officer grant; run.manage covers the kennel admin.
  const canGovern = Boolean(run.grants.get('report.publish')) || Boolean(run.canManage);

  const editable = EDITING_STATES.includes(report.status);
  return {
    report,
    run,
    isScribe,
    isAssistant,
    isReviewer,
    canGovern,
    // The permission matrix in 08G-06: Scribe and Assistant Scribe write, officers may too.
    canEdit: editable && (isScribe || isAssistant || canGovern),
    // Publish is the Scribe's act, or an officer's. Assistants never publish.
    canPublish: isScribe || canGovern,
    canReview: isReviewer || canGovern || isScribe || isAssistant,
    // BR-SCRIBE-004: drafts are private to the editorial circle.
    canSeeDraft: isScribe || isAssistant || isReviewer || canGovern,
  };
}

// ─── Serialization ───

// A published report is readable by whoever can see the run it belongs to (D29).
// A draft is not readable by anyone outside the editorial circle, ever.
function serialize(access: ReportAccess, opts: { includeBody: boolean }) {
  const { report } = access;
  return {
    id: report.id,
    runId: report.runId,
    status: report.status,
    title: report.title,
    body: opts.includeBody ? report.body : null,
    aiAssisted: report.aiAssisted,
    publishedAt: report.publishedAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    scribe: publicName(report.officialScribe),
    scribeId: report.officialScribeId,
    run: {
      id: report.run.id,
      runNumber: report.run.runNumber,
      title: report.run.title,
      startsAt: report.run.startsAt,
      timeZone: report.run.timeZone,
      posterUrl: report.run.posterUrl,
      kennel: report.run.kennel,
    },
    // FR-PUBLISH-008: a report is a citable historical record.
    citation:
      report.publishedAt &&
      `${report.run.kennel.name}. Run #${report.run.runNumber}. Trail Report. Published ${report.publishedAt
        .toISOString()
        .slice(0, 10)}. Hash Community Platform.`,
    assistants: contributorsOf(report, ReportContributorRole.ASSISTANT_SCRIBE).map((c) => publicName(c.user)),
    reviewers: contributorsOf(report, ReportContributorRole.REVIEWER).map((c) => publicName(c.user)),
    viewer: {
      canEdit: access.canEdit,
      // Publishing and correcting are different acts on different states, and
      // the UI must not offer either where the API would refuse it: an archived
      // report can do neither.
      canPublish: access.canPublish && STEPS.publish.from.includes(report.status),
      canRevise: access.canPublish && report.status === S.PUBLISHED,
      canReview: access.canReview,
      canGovern: access.canGovern,
      isScribe: access.isScribe,
    },
  };
}

async function load(reportId: string) {
  if (!isUuid(reportId)) throw ApiError.notFound('Trail Report not found');
  const report = await prisma.trailReport.findUnique({ where: { id: reportId }, select: reportSelect });
  if (!report) throw ApiError.notFound('Trail Report not found');
  return report;
}

// Everything that reads a report goes through here, so draft privacy is decided
// in exactly one place.
async function readable(actor: Actor | undefined, reportId: string) {
  const access = await buildAccess(actor, await load(reportId));
  const published = access.report.status === S.PUBLISHED || access.report.status === S.ARCHIVED;

  if (published) {
    // Follows the run: a public run's report is public, a members-only run's is not.
    if (!canView(access.run)) throw ApiError.notFound('Trail Report not found');
  } else if (!access.canSeeDraft) {
    // A draft that is not yours does not exist as far as you are concerned.
    throw ApiError.notFound('Trail Report not found');
  }
  return access;
}

export async function getReport(actor: Actor | undefined, reportId: string) {
  const access = await readable(actor, reportId);
  const base = serialize(access, { includeBody: true });
  // A pending draft survives a reload — otherwise the Scribe loses it the
  // moment they navigate away before deciding.
  const pending = access.canEdit
    ? await prisma.aiSuggestion.findFirst({
        where: { reportId, status: AiSuggestionStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, model: true, output: true, createdAt: true },
      })
    : null;
  return { ...base, pendingAiSuggestion: pending };
}

// The run page asks "is there a report yet?" — and must not leak that a private
// draft exists to someone outside the editorial circle.
export async function getForRun(actor: Actor | undefined, runId: string) {
  const run = await viewableAccess(actor, runId);
  const row = await prisma.trailReport.findUnique({ where: { runId }, select: reportSelect });
  if (!row) return { report: null, canStart: (await canStartFor(run)) && reportable(run) };

  const access = await buildAccess(actor, row);
  const published = access.report.status === S.PUBLISHED || access.report.status === S.ARCHIVED;
  if (!published && !access.canSeeDraft) return { report: null, canStart: false };
  return { report: serialize(access, { includeBody: true }), canStart: false };
}

// ─── Starting a draft ───

// The Official Scribe is whoever holds the kennel's SCRIBE role; officers with
// report.publish may start one too, and the hares of the run can write up their
// own trail when no scribe is appointed (D29).
// Authority only. Whether the run has happened yet is a separate question, so
// that an authorised Scribe who is simply early is told that, rather than being
// told they lack permission they actually hold.
async function canStartFor(run: RunAccess) {
  if (!run.actor) return false;
  if (run.grants.get('report.publish') || run.canManage) return true;
  if (run.isHare) return true;
  return hasScribeRole(run.actor.id, run.run.kennelId);
}

function reportable(run: RunAccess) {
  return REPORTABLE.includes(run.run.status);
}

export async function startDraft(actor: Actor, runId: string, input: { title?: string | null; scribeId?: string | null }) {
  const run = await viewableAccess(actor, runId);
  if (!(await canStartFor(run))) {
    throw ApiError.forbidden(
      'Only the kennel Scribe, the run’s hares or an officer with report permissions can start the Trail Report.',
      'SCRIBE_ROLE_REQUIRED',
    );
  }
  if (!reportable(run)) {
    throw ApiError.badRequest('There is nothing to report on until the run has started.', 'RUN_NOT_REPORTABLE');
  }

  // BR-SCRIBE-002: one official report per run. The unique index is the real
  // guarantee; this is the readable error.
  const existing = await prisma.trailReport.findUnique({ where: { runId }, select: { id: true } });
  if (existing) throw ApiError.badRequest('This run already has a Trail Report.', 'REPORT_EXISTS');

  // Whoever starts it is the Scribe, unless an officer nominates someone.
  let scribeId = actor.id;
  if (input.scribeId && input.scribeId !== actor.id) {
    if (!run.grants.get('report.publish') && !run.canManage) {
      throw ApiError.forbidden('Only an officer can appoint someone else as Scribe.', 'OFFICER_REQUIRED');
    }
    const member = await prisma.membership.findFirst({
      where: { userId: input.scribeId, kennelId: run.run.kennelId, status: MembershipStatus.ACTIVE },
      select: { id: true },
    });
    if (!member) throw ApiError.badRequest('The Scribe must be an active member of the kennel.', 'NOT_A_MEMBER');
    scribeId = input.scribeId;
  }

  const created = await prisma.$transaction(async (tx) => {
    const report = await tx.trailReport.create({
      data: {
        runId,
        officialScribeId: scribeId,
        title: input.title?.trim() || `#${run.run.runNumber} ${run.run.title}`,
        status: S.DRAFT,
      },
      select: { id: true },
    });
    const event = await recordEvent(tx, {
      eventType: 'TrailReportDraftCreated',
      aggregateType: 'TrailReport',
      aggregateId: report.id,
      actorId: actor.id,
      payload: { runId, kennelId: run.run.kennelId, scribeId },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'report.draft.create',
      resourceType: 'TrailReport',
      resourceId: report.id,
      kennelId: run.run.kennelId,
      newState: { status: S.DRAFT, scribeId },
      policyRef: run.grants.get('report.publish') ?? (run.isHare ? 'hare' : 'scribe'),
      domainEventId: event.id,
    });
    return report;
  });

  return serialize(await buildAccess(actor, await load(created.id)), { includeBody: true });
}

// ─── Editing ───

export async function updateDraft(
  actor: Actor,
  reportId: string,
  input: { title?: string; body?: string },
) {
  const access = await readable(actor, reportId);
  if (!access.canEdit) {
    if (access.report.status === S.PUBLISHED || access.report.status === S.ARCHIVED) {
      throw ApiError.badRequest(
        'A published report is history. Corrections are made as a revision.',
        'REPORT_PUBLISHED',
      );
    }
    throw ApiError.forbidden('Only the Scribe and assistant scribes write the report.', 'NOT_THE_SCRIBE');
  }

  // FR-EDITOR-008: continuous auto-save. Saves do not each become a revision —
  // revisions are named checkpoints and every state change (see transition).
  const updated = await prisma.trailReport.update({
    where: { id: reportId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
    },
    select: reportSelect,
  });
  return serialize(await buildAccess(actor, updated), { includeBody: true });
}

// BR-SCRIBE-008: a revision records editor, timestamp, number and reason.
async function snapshot(
  tx: Prisma.TransactionClient,
  report: { id: string; title: string; body: string; aiAssisted: boolean },
  authorId: string,
  opts: { reason?: string | null; isPublication?: boolean } = {},
) {
  const last = await tx.reportRevision.findFirst({
    where: { reportId: report.id },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return tx.reportRevision.create({
    data: {
      reportId: report.id,
      version: (last?.version ?? 0) + 1,
      title: report.title,
      body: report.body,
      authorId,
      aiAssisted: report.aiAssisted,
      isPublication: opts.isPublication ?? false,
      reason: opts.reason?.trim() || null,
    },
    select: { id: true, version: true },
  });
}

// ─── Lifecycle (Ch.22 A.5) ───

type Authority = 'edit' | 'publish' | 'govern';

interface Step {
  from: TrailReportStatus[];
  to: TrailReportStatus;
  authority: Authority;
  event: string;
  action: string;
  label: string;
  reasonRequired?: boolean;
}

const STEPS: Record<string, Step> = {
  'start-editing': {
    from: [S.DRAFT],
    to: S.SCRIBE_EDITING,
    authority: 'edit',
    event: 'TrailReportEditingStarted',
    action: 'report.editing.start',
    label: 'Start writing',
  },
  'submit-review': {
    from: [S.SCRIBE_EDITING],
    to: S.REVIEW,
    authority: 'edit',
    event: 'TrailReportSubmittedForReview',
    action: 'report.review.submit',
    label: 'Send for review',
  },
  'return-to-editing': {
    from: [S.REVIEW],
    to: S.SCRIBE_EDITING,
    authority: 'edit',
    event: 'TrailReportReturnedToEditing',
    action: 'report.review.return',
    label: 'Take it back for edits',
  },
  publish: {
    from: [S.SCRIBE_EDITING, S.REVIEW],
    to: S.PUBLISHED,
    authority: 'publish',
    event: 'TrailReportPublished',
    action: 'report.publish',
    label: 'Publish the Trail Report',
  },
  archive: {
    from: [S.PUBLISHED],
    to: S.ARCHIVED,
    authority: 'govern',
    event: 'TrailReportArchived',
    action: 'report.archive',
    label: 'Archive the report',
    reasonRequired: true,
  },
};

export type ReportAction = keyof typeof STEPS;

function holds(access: ReportAccess, authority: Authority) {
  if (authority === 'edit') return access.isScribe || access.isAssistant || access.canGovern;
  if (authority === 'publish') return access.canPublish;
  return access.canGovern;
}

export async function transition(
  actor: Actor,
  reportId: string,
  action: string,
  input: { reason?: string | null },
) {
  const step = STEPS[action];
  if (!step) throw ApiError.badRequest('Unknown action', 'UNKNOWN_ACTION');

  const access = await readable(actor, reportId);
  const { report } = access;

  if (!step.from.includes(report.status)) {
    throw ApiError.badRequest(
      `A report that is ${report.status.toLowerCase().replace('_', ' ')} cannot do that.`,
      'INVALID_TRANSITION',
    );
  }
  if (!holds(access, step.authority)) {
    throw ApiError.forbidden(
      step.authority === 'publish'
        ? 'Only the Scribe or an officer with report permissions publishes.'
        : 'You do not have editorial authority over this report.',
      'REPORT_AUTHORITY_REQUIRED',
    );
  }
  if (step.reasonRequired && !input.reason?.trim()) {
    throw ApiError.badRequest('A reason is required.', 'REASON_REQUIRED');
  }

  // BR-SCRIBE-007: validate before publication, and refuse rather than publish
  // something incomplete.
  if (step.to === S.PUBLISHED) {
    if (!report.body.trim()) {
      throw ApiError.badRequest('There is nothing written to publish yet.', 'REPORT_EMPTY');
    }
    if (!PUBLISHABLE_RUN.includes(access.run.run.status)) {
      throw ApiError.badRequest('The run has to be over before its report can be published.', 'RUN_NOT_FINISHED');
    }
    if (report.aiAssisted) {
      // BR-SCRIBE-005: AI text never reaches publication unaccepted.
      throw ApiError.badRequest(
        'This draft still contains unaccepted AI suggestions. Accept or discard them first.',
        'AI_SUGGESTIONS_PENDING',
      );
    }
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.trailReport.update({
      where: { id: reportId },
      data: {
        status: step.to,
        ...(step.to === S.PUBLISHED ? { publishedAt: now, publishedById: actor.id } : {}),
      },
      select: { id: true, title: true, body: true, aiAssisted: true },
    });

    // The published version is preserved as a revision, so a later correction
    // can never quietly replace what readers first saw (BR-SCRIBE-011).
    if (step.to === S.PUBLISHED) {
      await snapshot(tx, updated, actor.id, { reason: input.reason, isPublication: true });
      // FR-PUBLISH-001: the report is linked to the Run Capsule on publication.
      const capsule = await tx.runCapsule.findUnique({
        where: { runId: report.runId },
        select: { id: true, status: true },
      });
      if (capsule) {
        // A published report is what the capsule was waiting for (Ch.22 A.6:
        // Pending Publication is gated on Trail Report publication). A capsule
        // already published or archived stays where it is.
        const assembling: CapsuleStatus[] = [
          CapsuleStatus.PLANNED,
          CapsuleStatus.PREPARING,
          CapsuleStatus.LIVE,
          CapsuleStatus.DRAFT,
        ];
        const stillAssembling = assembling.includes(capsule.status);
        await tx.runCapsule.update({
          where: { id: capsule.id },
          data: {
            trailReportId: reportId,
            ...(stillAssembling ? { status: CapsuleStatus.PENDING_PUBLICATION } : {}),
          },
        });
      } else {
        await tx.runCapsule.create({
          data: { runId: report.runId, trailReportId: reportId, status: CapsuleStatus.PENDING_PUBLICATION },
        });
      }
    }

    const event = await recordEvent(tx, {
      eventType: step.event,
      aggregateType: 'TrailReport',
      aggregateId: reportId,
      actorId: actor.id,
      payload: {
        runId: report.runId,
        kennelId: report.run.kennelId,
        // The Passport counts reports written, and credits the Scribe, not
        // whichever officer pressed publish.
        scribeId: report.officialScribeId,
        from: report.status,
        to: step.to,
        ...(input.reason ? { reason: input.reason.trim() } : {}),
      },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: step.action,
      resourceType: 'TrailReport',
      resourceId: reportId,
      kennelId: report.run.kennelId,
      previousState: { status: report.status },
      newState: { status: step.to },
      reason: input.reason?.trim() || null,
      policyRef: access.isScribe ? 'scribe' : (access.run.grants.get('report.publish') ?? 'kennel-admin'),
      domainEventId: event.id,
    });
  });

  return serialize(await buildAccess(actor, await load(reportId)), { includeBody: true });
}

// ─── Post-publication corrections (FR-PUBLISH-003, BR-SCRIBE-011) ───

export async function revise(
  actor: Actor,
  reportId: string,
  input: { title?: string; body?: string; reason: string },
) {
  const access = await readable(actor, reportId);
  if (access.report.status !== S.PUBLISHED) {
    throw ApiError.badRequest('Only a published report is corrected by revision.', 'NOT_PUBLISHED');
  }
  if (!access.canPublish) {
    throw ApiError.forbidden('Only the Scribe or an officer corrects a published report.', 'REPORT_AUTHORITY_REQUIRED');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.trailReport.update({
      where: { id: reportId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
      },
      select: { id: true, title: true, body: true, aiAssisted: true },
    });
    const revision = await snapshot(tx, row, actor.id, { reason: input.reason, isPublication: true });
    const event = await recordEvent(tx, {
      eventType: 'TrailReportRevised',
      aggregateType: 'TrailReport',
      aggregateId: reportId,
      actorId: actor.id,
      payload: {
        runId: access.report.runId,
        scribeId: access.report.officialScribeId,
        version: revision.version,
        reason: input.reason.trim(),
      },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'report.revise',
      resourceType: 'TrailReport',
      resourceId: reportId,
      kennelId: access.report.run.kennelId,
      newState: { version: revision.version },
      reason: input.reason.trim(),
      policyRef: access.isScribe ? 'scribe' : 'report.publish',
      domainEventId: event.id,
    });
    return row;
  });

  return serialize(await buildAccess(actor, await load(updated.id)), { includeBody: true });
}

// ─── Revisions (BR-SCRIBE-008) ───

export async function listRevisions(actor: Actor, reportId: string) {
  const access = await readable(actor, reportId);
  // History is for the editorial circle and officers; readers get the report.
  if (!access.canSeeDraft) throw ApiError.forbidden('Revision history is not public.', 'NOT_VISIBLE');

  const rows = await prisma.reportRevision.findMany({
    where: { reportId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      title: true,
      aiAssisted: true,
      isPublication: true,
      reason: true,
      createdAt: true,
      author: { select: userPublicSelect },
    },
  });
  return {
    items: rows.map(({ author, ...rest }) => ({ ...rest, author: publicName(author) })),
  };
}

export async function getRevision(actor: Actor, reportId: string, version: number) {
  const access = await readable(actor, reportId);
  if (!access.canSeeDraft) throw ApiError.forbidden('Revision history is not public.', 'NOT_VISIBLE');
  const revision = await prisma.reportRevision.findUnique({
    where: { reportId_version: { reportId, version } },
    select: {
      id: true,
      version: true,
      title: true,
      body: true,
      aiAssisted: true,
      isPublication: true,
      reason: true,
      createdAt: true,
      author: { select: userPublicSelect },
    },
  });
  if (!revision) throw ApiError.notFound('Revision not found');
  const { author, ...rest } = revision;
  return { ...rest, author: publicName(author) };
}

// Restoring is an officer's act (08G-06 permission matrix) and is itself a new
// revision: nothing in the history is ever removed.
export async function restoreRevision(actor: Actor, reportId: string, version: number, reason: string) {
  const access = await readable(actor, reportId);
  if (!access.canGovern) throw ApiError.forbidden('Only officers restore a previous version.', 'OFFICER_REQUIRED');
  if (access.report.status === S.ARCHIVED) {
    throw ApiError.badRequest('An archived report is not edited.', 'REPORT_ARCHIVED');
  }

  const source = await prisma.reportRevision.findUnique({
    where: { reportId_version: { reportId, version } },
    select: { title: true, body: true },
  });
  if (!source) throw ApiError.notFound('Revision not found');

  await prisma.$transaction(async (tx) => {
    const row = await tx.trailReport.update({
      where: { id: reportId },
      data: { title: source.title, body: source.body },
      select: { id: true, title: true, body: true, aiAssisted: true },
    });
    const revision = await snapshot(tx, row, actor.id, {
      reason: `Restored version ${version}: ${reason}`,
      isPublication: access.report.status === S.PUBLISHED,
    });
    const event = await recordEvent(tx, {
      eventType: 'TrailReportRevised',
      aggregateType: 'TrailReport',
      aggregateId: reportId,
      actorId: actor.id,
      payload: { runId: access.report.runId, restoredFrom: version, version: revision.version },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'report.revision.restore',
      resourceType: 'TrailReport',
      resourceId: reportId,
      kennelId: access.report.run.kennelId,
      previousState: { version },
      newState: { version: revision.version },
      reason,
      policyRef: access.run.grants.get('report.publish') ?? 'kennel-admin',
      domainEventId: event.id,
    });
  });

  return serialize(await buildAccess(actor, await load(reportId)), { includeBody: true });
}

// ─── Contributors (BR-SCRIBE-003) ───

export async function addContributor(
  actor: Actor,
  reportId: string,
  input: { userId: string; role: ReportContributorRole },
) {
  const access = await readable(actor, reportId);
  // The Scribe picks their own helpers; officers may also assign reviewers.
  if (!access.isScribe && !access.canGovern) {
    throw ApiError.forbidden('Only the Scribe or an officer adds contributors.', 'REPORT_AUTHORITY_REQUIRED');
  }
  const member = await prisma.membership.findFirst({
    where: { userId: input.userId, kennelId: access.report.run.kennelId, status: MembershipStatus.ACTIVE },
    select: { id: true },
  });
  if (!member) throw ApiError.badRequest('Contributors must be active members of the kennel.', 'NOT_A_MEMBER');
  if (input.userId === access.report.officialScribeId) {
    throw ApiError.badRequest('They are already the Scribe.', 'ALREADY_SCRIBE');
  }

  await prisma.trailReportContributor.upsert({
    where: { reportId_userId_role: { reportId, userId: input.userId, role: input.role } },
    create: { reportId, userId: input.userId, role: input.role },
    update: {},
  });
  return serialize(await buildAccess(actor, await load(reportId)), { includeBody: true });
}

export async function removeContributor(
  actor: Actor,
  reportId: string,
  userId: string,
  role: ReportContributorRole,
) {
  const access = await readable(actor, reportId);
  if (!access.isScribe && !access.canGovern) {
    throw ApiError.forbidden('Only the Scribe or an officer removes contributors.', 'REPORT_AUTHORITY_REQUIRED');
  }
  await prisma.trailReportContributor.deleteMany({ where: { reportId, userId, role } });
  return serialize(await buildAccess(actor, await load(reportId)), { includeBody: true });
}

// ─── Review comments (FR-EDITOR-009, FR-STORY-009) ───

export async function listComments(actor: Actor, reportId: string) {
  const access = await readable(actor, reportId);
  if (!access.canSeeDraft) throw ApiError.forbidden('Review comments are not public.', 'NOT_VISIBLE');
  const rows = await prisma.reportReviewComment.findMany({
    where: { reportId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      body: true,
      anchor: true,
      resolvedAt: true,
      createdAt: true,
      author: { select: userPublicSelect },
    },
  });
  return { items: rows.map(({ author, ...rest }) => ({ ...rest, author: publicName(author) })) };
}

export async function addComment(actor: Actor, reportId: string, input: { body: string; anchor?: string | null }) {
  const access = await readable(actor, reportId);
  if (!access.canReview) throw ApiError.forbidden('Only the editorial circle comments here.', 'NOT_A_REVIEWER');
  if (access.report.status === S.ARCHIVED) {
    throw ApiError.badRequest('An archived report is closed for review.', 'REPORT_ARCHIVED');
  }

  const comment = await prisma.reportReviewComment.create({
    data: { reportId, authorId: actor.id, body: input.body.trim(), anchor: input.anchor?.trim() || null },
    select: {
      id: true,
      body: true,
      anchor: true,
      resolvedAt: true,
      createdAt: true,
      author: { select: userPublicSelect },
    },
  });
  const { author, ...rest } = comment;
  return { ...rest, author: publicName(author) };
}

// Suggestions stay separate until the Scribe accepts them (FR-EDITOR-009), so
// resolving is the Scribe's call, not the reviewer's.
export async function resolveComment(actor: Actor, reportId: string, commentId: string) {
  const access = await readable(actor, reportId);
  if (!access.isScribe && !access.isAssistant && !access.canGovern) {
    throw ApiError.forbidden('The Scribe decides when a comment is settled.', 'NOT_THE_SCRIBE');
  }
  if (!isUuid(commentId)) throw ApiError.notFound('Comment not found');
  const { count } = await prisma.reportReviewComment.updateMany({
    where: { id: commentId, reportId, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  if (count === 0) {
    const exists = await prisma.reportReviewComment.findFirst({ where: { id: commentId, reportId }, select: { id: true } });
    if (!exists) throw ApiError.notFound('Comment not found');
  }
  return listComments(actor, reportId);
}

// ─── AI assistance (FR-STORY-007, BR-SCRIBE-005) ───

// D14 names Claude; apps/api/src/services/ai.service.ts is the only caller of
// the SDK. Requesting a draft never touches report.body — it only creates a
// PENDING AiSuggestion. The body is written exclusively by decideAiDraft,
// which is a human action (Ch.22 A.5: "AI drafts cannot reach Published
// without passing through human Scribe Editing"). Without ANTHROPIC_API_KEY
// configured this throws the same friendly error it always did.
export async function requestAiDraft(actor: Actor, reportId: string) {
  const access = await readable(actor, reportId);
  if (!access.canEdit) throw ApiError.forbidden('Only the Scribe asks for a draft.', 'NOT_THE_SCRIBE');
  if (!ai.aiConfigured()) {
    throw ApiError.badRequest(
      'AI drafting is not switched on yet. The Scribe writes this one unaided.',
      'AI_NOT_CONFIGURED',
    );
  }

  const runId = access.report.runId;
  const [timeline, circle, hares, attendance] = await Promise.all([
    stories.listTimeline(actor, runId),
    prisma.circle.findUnique({
      where: { runId },
      select: {
        songs: true,
        announcements: true,
        awards: { select: { title: true, recipientName: true, isDownDown: true, reason: true } },
      },
    }),
    prisma.runHare.findMany({ where: { runId }, select: { user: { select: userPublicSelect } } }),
    prisma.participation.count({ where: { runId, checkedInAt: { not: null } } }),
  ]);

  const context: ai.DraftContext = {
    run: {
      runNumber: access.report.run.runNumber,
      title: access.report.run.title,
      theme: access.report.run.theme,
      startsAt: access.report.run.startsAt.toISOString(),
      timeZone: access.report.run.timeZone,
      kennelName: access.report.run.kennel.name,
    },
    hares: hares.map((h) => publicName(h.user)),
    attendance,
    timeline: timeline.items.map((s) => ({ category: s.category, body: s.body, occurredAt: s.occurredAt.toISOString() })),
    circle: circle ? { songs: circle.songs, announcements: circle.announcements, awards: circle.awards } : null,
  };

  let draft: Awaited<ReturnType<typeof ai.draftTrailReport>>;
  try {
    draft = await ai.draftTrailReport(context);
  } catch (err) {
    throw ApiError.badRequest(err instanceof Error ? err.message : 'Claude could not draft this one.', 'AI_REQUEST_FAILED');
  }

  const suggestion = await prisma.$transaction(async (tx) => {
    const row = await tx.aiSuggestion.create({
      data: {
        kind: AiSuggestionKind.TRAIL_REPORT_DRAFT,
        status: AiSuggestionStatus.PENDING,
        requestedById: actor.id,
        kennelId: access.report.run.kennelId,
        runId,
        reportId,
        model: draft.model,
        promptVersion: draft.promptVersion,
        input: context as unknown as Prisma.InputJsonValue,
        output: draft.output,
        sourceRefs: timeline.items.map((s) => ({ type: 'StoryAsset', id: s.id })) as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.trailReport.update({ where: { id: reportId }, data: { aiAssisted: true } });
    const event = await recordEvent(tx, {
      eventType: 'AiDraftRequested',
      aggregateType: 'TrailReport',
      aggregateId: reportId,
      actorId: actor.id,
      payload: { runId, suggestionId: row.id, model: draft.model },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'report.ai_draft.request',
      resourceType: 'AiSuggestion',
      resourceId: row.id,
      kennelId: access.report.run.kennelId,
      domainEventId: event.id,
    });
    return row;
  });

  return {
    report: serialize(await buildAccess(actor, await load(reportId)), { includeBody: true }),
    suggestion: {
      id: suggestion.id,
      status: suggestion.status,
      model: suggestion.model,
      output: suggestion.output,
      createdAt: suggestion.createdAt,
    },
  };
}

// A human decision on a pending AiSuggestion (BR-SCRIBE-005). REJECTED leaves
// report.body untouched; ACCEPTED/PARTIALLY_ACCEPTED write whatever text the
// Scribe is keeping — the raw output verbatim counts as ACCEPTED, anything
// edited first is PARTIALLY_ACCEPTED, both write the same way. Either way
// `aiAssisted` clears: the flag means "there is AI text waiting on a human,"
// not "this report was ever touched by AI" (Ch.22 A.5).
export async function decideAiDraft(
  actor: Actor,
  reportId: string,
  suggestionId: string,
  input: { decision: 'ACCEPTED' | 'PARTIALLY_ACCEPTED' | 'REJECTED'; body?: string },
) {
  const access = await readable(actor, reportId);
  if (!access.canEdit) throw ApiError.forbidden('Only the Scribe decides on an AI draft.', 'NOT_THE_SCRIBE');
  if (!isUuid(suggestionId)) throw ApiError.notFound('Suggestion not found');

  const suggestion = await prisma.aiSuggestion.findUnique({ where: { id: suggestionId } });
  if (!suggestion || suggestion.reportId !== reportId) throw ApiError.notFound('Suggestion not found');
  if (suggestion.status !== AiSuggestionStatus.PENDING) {
    throw ApiError.badRequest('That suggestion was already decided.', 'ALREADY_DECIDED');
  }

  const keeping = input.decision !== 'REJECTED';
  const body = input.body?.trim();
  if (keeping && !body) throw ApiError.badRequest('Provide the text to keep.', 'BODY_REQUIRED');

  await prisma.$transaction(async (tx) => {
    await tx.aiSuggestion.update({
      where: { id: suggestionId },
      data: { status: AiSuggestionStatus[input.decision], decidedById: actor.id, decidedAt: new Date() },
    });
    await tx.trailReport.update({
      where: { id: reportId },
      data: { aiAssisted: false, ...(keeping ? { body } : {}) },
    });
    const event = await recordEvent(tx, {
      eventType: keeping ? 'AiDraftAccepted' : 'AiDraftRejected',
      aggregateType: 'TrailReport',
      aggregateId: reportId,
      actorId: actor.id,
      payload: { suggestionId, decision: input.decision },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: `report.ai_draft.${input.decision.toLowerCase()}`,
      resourceType: 'AiSuggestion',
      resourceId: suggestionId,
      kennelId: access.report.run.kennelId,
      domainEventId: event.id,
    });
  });

  return { report: serialize(await buildAccess(actor, await load(reportId)), { includeBody: true }) };
}

// ─── The archive (FR-PUBLISH-009) ───

export async function listPublished(
  actor: Actor | undefined,
  opts: { kennelSlug?: string; page: number; limit: number },
) {
  // Only reports whose run the viewer can see. Public runs are visible to
  // anonymous readers; members-only runs need membership.
  //
  // Anonymous readers get this pushed straight into the query — `getAccess`
  // resolves an anonymous actor to isMember:false/isHare:false/canManage:null,
  // so `canView` reduces exactly to "run is public and its kennel isn't
  // hidden." Without this, `where`'s count included every members-only
  // report too, so an all-private-runs page answered zero items with a
  // non-zero total.
  const runFilter: Prisma.RunWhereInput = actor
    ? { ...(opts.kennelSlug ? { kennel: { slug: opts.kennelSlug } } : {}) }
    : {
        visibility: RunVisibility.PUBLIC,
        kennel: {
          visibility: { not: KennelVisibility.HIDDEN },
          ...(opts.kennelSlug ? { slug: opts.kennelSlug } : {}),
        },
      };
  const where: Prisma.TrailReportWhereInput = {
    status: { in: [S.PUBLISHED, S.ARCHIVED] },
    ...(Object.keys(runFilter).length ? { run: runFilter } : {}),
  };

  const rows = await prisma.trailReport.findMany({
    where,
    select: reportSelect,
    orderBy: { publishedAt: 'desc' },
    // Over-fetch modestly, then filter by visibility; published reports are few
    // per kennel and this keeps the permission check in one place.
    skip: (opts.page - 1) * opts.limit,
    take: opts.limit,
  });

  const visible = [];
  for (const row of rows) {
    const access = await buildAccess(actor, row);
    if (canView(access.run)) visible.push(serialize(access, { includeBody: false }));
  }
  const total = await prisma.trailReport.count({ where });
  return page(visible, total, opts.page, opts.limit);
}
