import {
  AccountStatus,
  DeliveryChannel,
  DeliveryStatus,
  DevicePlatform,
  type DomainEvent,
  KennelStatus,
  MembershipStatus,
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  PlatformRole,
  Prisma,
  ReportContributorRole,
  RoleAssignmentStatus,
  RsvpStatus,
  ScopedRole,
} from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError, isUuid, page } from '../utils/http';
import { isEmailConfigured, sendEmail } from './email.service';
import { isExpoPushToken, isPushConfigured, registerDevice, revokeDevice, sendPush } from './push.service';
import { evaluateQuietHours, quietHoursFor } from './quiet-hours';
import type { Actor } from './permission.service';

// Notification Center (Annex 08P, Ch.22 A.11). The outbox worker hands every
// domain event here; this decides who hears about it, and why.
//
// In-app, email and push all deliver (D12 closed). Nothing is queued for a
// channel that cannot send — no provider, no registered device, or a quiet hour
// in the way — and the reason is recorded on each notification (FR-NOT-010).

const C = NotificationCategory;
const P = NotificationPriority;

interface NotificationSpec {
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  contextType: string;
  contextId: string | null;
  kennelId: string | null;
  recipients: string[];
  // Guests hold no account and no in-app inbox, so they are reached by email
  // alone (D12). Only the events they could act on carry them.
  guests?: GuestRecipient[];
}

interface GuestRecipient {
  id: string;
  name: string;
  email: string;
}

type Payload = Record<string, unknown>;

const str = (payload: Payload, key: string) => (typeof payload[key] === 'string' ? (payload[key] as string) : null);

// D50. A social notification names the person who did the thing, and a person
// in public is their hash handle or "Just <firstName>" (D11) — never their
// email and never their legal name.
async function publicNameOf(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hashHandle: true, person: { select: { firstName: true } } },
  });
  if (!user) return 'A hasher';
  return user.hashHandle ?? (user.person ? `Just ${user.person.firstName}` : 'A hasher');
}

// What to call the thing in a sentence. The enum name would read as
// "liked your TRAIL_REPORT".
function subjectWord(subjectType: string | null) {
  switch (subjectType) {
    case 'TRAIL_REPORT':
      return 'trail report';
    case 'MEDIA_ASSET':
      return 'photo';
    case 'RUN':
      return 'run';
    case 'RUN_CAPSULE':
      return 'Run Capsule';
    case 'COMMENT':
      return 'comment';
    case 'POST':
      return 'post';
    case 'REEL':
    default:
      return 'reel';
  }
}

// One line of somebody's comment, for the body of a notification.
function excerpt(body: string, max = 140) {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// ─── Audiences ───

async function activeMemberIds(kennelId: string) {
  const rows = await prisma.membership.findMany({
    where: { kennelId, status: MembershipStatus.ACTIVE },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

// Officers who can act on it: kennel admins plus officer positions carrying the
// permission. Delegates are not included yet.
async function officerIds(kennelId: string, permission: string) {
  const [admins, officers] = await Promise.all([
    prisma.roleAssignment.findMany({
      where: { kennelId, role: ScopedRole.KENNEL_ADMIN, status: RoleAssignmentStatus.ACTIVE },
      select: { userId: true },
    }),
    prisma.officerAppointment.findMany({
      where: {
        kennelId,
        status: RoleAssignmentStatus.ACTIVE,
        position: { archivedAt: null, permissions: { has: permission } },
      },
      select: { userId: true },
    }),
  ]);
  const members = new Set(await activeMemberIds(kennelId));
  return [...new Set([...admins, ...officers].map((r) => r.userId))].filter((id) => members.has(id));
}

// Platform staff. The only audience that is not scoped to a kennel: a kennel
// waiting to be let into the directory is the platform's business, not its own
// (D10 — standing is granted, never taken).
async function platformAdminIds() {
  const rows = await prisma.user.findMany({
    where: { platformRole: PlatformRole.ADMIN, status: AccountStatus.ACTIVE },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// The people who run a kennel, whether or not they hold an officer position.
async function kennelAdminIds(kennelId: string) {
  const rows = await prisma.roleAssignment.findMany({
    where: { kennelId, role: ScopedRole.KENNEL_ADMIN, status: RoleAssignmentStatus.ACTIVE },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

async function participantIds(runId: string, opts: { checkedInOnly?: boolean } = {}) {
  const rows = await prisma.participation.findMany({
    where: {
      runId,
      ...(opts.checkedInOnly
        ? { checkedInAt: { not: null } }
        : { rsvpStatus: { in: [RsvpStatus.GOING, RsvpStatus.MAYBE] } }),
      userId: { not: null },
    },
    select: { userId: true },
  });
  return rows.map((r) => r.userId).filter((id): id is string => Boolean(id));
}

// Everyone registered for the run who is not a member: name and email were
// captured with consent at registration (D23).
async function guestRecipients(runId: string): Promise<GuestRecipient[]> {
  const rows = await prisma.participation.findMany({
    where: { runId, guestId: { not: null }, rsvpStatus: { in: [RsvpStatus.GOING, RsvpStatus.MAYBE] } },
    select: { guest: { select: { id: true, firstName: true, email: true } } },
  });
  const byEmail = new Map<string, GuestRecipient>();
  for (const row of rows) {
    if (!row.guest?.email) continue;
    const key = row.guest.email.toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, { id: row.guest.id, name: row.guest.firstName, email: row.guest.email });
  }
  return [...byEmail.values()];
}

async function runContext(runId: string) {
  return prisma.run.findUnique({
    where: { id: runId },
    select: { id: true, runNumber: true, title: true, kennelId: true, kennel: { select: { shortName: true } } },
  });
}

// ─── Event → notification ───

async function specFor(event: DomainEvent): Promise<NotificationSpec | null> {
  const payload = (event.payload ?? {}) as Payload;

  switch (event.eventType) {
    // ── Membership ──
    case 'MembershipRequested': {
      const kennelId = str(payload, 'kennelId');
      if (!kennelId) return null;
      const kennel = await prisma.kennel.findUnique({ where: { id: kennelId }, select: { shortName: true } });
      return {
        category: C.MEMBERSHIP,
        priority: P.NORMAL,
        title: 'New membership request',
        body: `Someone asked to join ${kennel?.shortName ?? 'your kennel'}.`,
        contextType: 'Membership',
        contextId: event.aggregateId,
        kennelId,
        recipients: await officerIds(kennelId, 'membership.review'),
      };
    }
    case 'MembershipApproved':
    case 'MembershipRejected':
    case 'MembershipSuspended':
    case 'MembershipReinstated':
    case 'MembershipRemoved': {
      const kennelId = str(payload, 'kennelId');
      const userId = str(payload, 'userId');
      if (!kennelId || !userId) return null;
      const kennel = await prisma.kennel.findUnique({ where: { id: kennelId }, select: { shortName: true } });
      const name = kennel?.shortName ?? 'the kennel';
      const wording: Record<string, { title: string; body: string; priority: NotificationPriority }> = {
        MembershipApproved: { title: `Welcome to ${name}`, body: 'Your membership was approved. On On!', priority: P.NORMAL },
        MembershipRejected: { title: `${name} declined your request`, body: 'You can ask again after the cooldown period.', priority: P.NORMAL },
        MembershipSuspended: { title: `Your ${name} membership is suspended`, body: 'Ask the mismanagement if you need the details.', priority: P.HIGH },
        MembershipReinstated: { title: `You are back in ${name}`, body: 'Your membership is active again.', priority: P.NORMAL },
        MembershipRemoved: { title: `You were removed from ${name}`, body: 'Your runs and history stay with you.', priority: P.HIGH },
      };
      const copy = wording[event.eventType];
      return {
        category: C.MEMBERSHIP,
        priority: copy.priority,
        title: copy.title,
        body: copy.body,
        contextType: 'Membership',
        contextId: event.aggregateId,
        kennelId,
        recipients: [userId],
      };
    }

    // ── Runs ──
    case 'RunScheduled': {
      const run = await runContext(event.aggregateId);
      if (!run) return null;
      return {
        category: C.RUN,
        priority: P.NORMAL,
        title: `New run: #${run.runNumber} ${run.title}`,
        body: `${run.kennel.shortName} published a run. RSVP when you know.`,
        contextType: 'Run',
        contextId: run.id,
        kennelId: run.kennelId,
        recipients: await activeMemberIds(run.kennelId),
      };
    }
    case 'RunCancelled': {
      const run = await runContext(event.aggregateId);
      if (!run) return null;
      const reason = str(payload, 'reason');
      return {
        category: C.RUN,
        priority: P.HIGH,
        title: `Cancelled: #${run.runNumber} ${run.title}`,
        body: reason ? `The run was cancelled: ${reason}` : 'The run was cancelled.',
        contextType: 'Run',
        contextId: run.id,
        kennelId: run.kennelId,
        recipients: [...(await participantIds(run.id)), ...(await activeMemberIds(run.kennelId))],
        // A guest who turns up to a cancelled run has had a wasted journey.
        guests: await guestRecipients(run.id),
      };
    }
    case 'RunUpdated': {
      // Only the details a hasher would turn up at the wrong place or time for.
      const fields = Array.isArray(payload.fields) ? (payload.fields as string[]) : [];
      const material = ['startsAt', 'timeZone', 'meetingPointName', 'meetingAddress', 'visibility'];
      if (!fields.some((f) => material.includes(f))) return null;
      const run = await runContext(event.aggregateId);
      if (!run) return null;
      return {
        category: C.RUN,
        priority: P.NORMAL,
        title: `Run details changed: #${run.runNumber} ${run.title}`,
        body: 'The time or meeting point changed. Check the run before you set off.',
        contextType: 'Run',
        contextId: run.id,
        kennelId: run.kennelId,
        recipients: await participantIds(run.id),
      };
    }
    case 'CheckInOpened': {
      const run = await runContext(event.aggregateId);
      if (!run) return null;
      return {
        category: C.RUN,
        priority: P.NORMAL,
        title: `Check-in is open: #${run.runNumber}`,
        body: `Check in for ${run.title}.`,
        contextType: 'Run',
        contextId: run.id,
        kennelId: run.kennelId,
        recipients: await participantIds(run.id),
      };
    }
    case 'RunPaused':
    case 'RunResumed': {
      const run = await runContext(event.aggregateId);
      if (!run) return null;
      const paused = event.eventType === 'RunPaused';
      const reason = str(payload, 'reason');
      return {
        // Safety-critical: FR-NOT-006 lets these through quiet hours.
        category: C.SAFETY,
        priority: paused ? P.CRITICAL : P.NORMAL,
        title: paused ? `Run paused: #${run.runNumber}` : `Run resumed: #${run.runNumber}`,
        body: paused ? (reason ? `The hares paused the run: ${reason}` : 'The hares paused the run.') : 'On On, the run is back on.',
        contextType: 'Run',
        contextId: run.id,
        kennelId: run.kennelId,
        recipients: await participantIds(run.id, { checkedInOnly: true }),
      };
    }

    // ── Trails (D6/D12) ──
    case 'TrailReleased': {
      const trail = await prisma.trail.findUnique({
        where: { id: event.aggregateId },
        select: { id: true, name: true, runId: true },
      });
      if (!trail) return null;
      const run = await runContext(trail.runId);
      if (!run) return null;
      return {
        category: C.TRAIL_RELEASE,
        priority: P.HIGH,
        title: `Trail released: ${trail.name}`,
        body: `The trail for #${run.runNumber} ${run.title} is live. On On!`,
        contextType: 'Trail',
        contextId: trail.id,
        kennelId: run.kennelId,
        // D12: the hosting kennel's members plus everyone registered for the
        // run, guests included.
        recipients: [...(await activeMemberIds(run.kennelId)), ...(await participantIds(run.id))],
        guests: await guestRecipients(run.id),
      };
    }

    // ── Run Capsules (08H) ──
    case 'RunCapsuleReadyForPublication': {
      const kennelId = str(payload, 'kennelId');
      const runNumber = typeof payload.runNumber === 'number' ? payload.runNumber : null;
      if (!kennelId) return null;
      const runId = str(payload, 'runId');
      const report = runId
        ? await prisma.trailReport.findUnique({ where: { runId }, select: { officialScribeId: true } })
        : null;
      const officers = await officerIds(kennelId, 'report.publish');
      return {
        category: C.REPORT,
        priority: P.LOW,
        title: `Run Capsule ready: #${runNumber ?? ''}`.trim(),
        body: 'The run is over and its capsule has assembled itself. Publish it when the Trail Report is out.',
        contextType: 'RunCapsule',
        contextId: event.aggregateId,
        kennelId,
        // The Scribe writes it up; the officers hold the pen on publication.
        recipients: [...officers, ...(report ? [report.officialScribeId] : [])],
      };
    }

    // ── Trail Reports (08G) ──
    case 'TrailReportSubmittedForReview': {
      const report = await prisma.trailReport.findUnique({
        where: { id: event.aggregateId },
        select: {
          title: true,
          contributors: { where: { role: ReportContributorRole.REVIEWER }, select: { userId: true } },
          run: { select: { runNumber: true, kennelId: true } },
        },
      });
      if (!report) return null;
      return {
        category: C.REPORT,
        priority: P.NORMAL,
        title: `Ready for review: ${report.title}`,
        body: `The Scribe sent the Trail Report for #${report.run.runNumber} to its reviewers.`,
        contextType: 'TrailReport',
        contextId: event.aggregateId,
        kennelId: report.run.kennelId,
        recipients: report.contributors.map((c) => c.userId),
      };
    }
    case 'TrailReportPublished': {
      const report = await prisma.trailReport.findUnique({
        where: { id: event.aggregateId },
        select: { title: true, run: { select: { runNumber: true, kennelId: true } } },
      });
      if (!report) return null;
      return {
        category: C.REPORT,
        priority: P.NORMAL,
        title: `Trail Report published: ${report.title}`,
        body: `The story of run #${report.run.runNumber} is written. Read it while the memory is fresh.`,
        contextType: 'TrailReport',
        contextId: event.aggregateId,
        kennelId: report.run.kennelId,
        // The whole kennel, not only those who ran: a report is the kennel's record.
        recipients: await activeMemberIds(report.run.kennelId),
      };
    }

    // ── Haring (D44) ──
    case 'HareOffered': {
      const kennelId = str(payload, 'kennelId');
      const run = await runContext(event.aggregateId);
      if (!kennelId || !run) return null;
      return {
        category: C.RUN,
        priority: P.NORMAL,
        title: 'Someone has offered to hare',
        body: `A hasher offered to hare run #${run.runNumber} for ${run.kennel.shortName}. It needs an answer before they can start planning.`,
        contextType: 'Run',
        contextId: run.id,
        kennelId,
        recipients: await officerIds(kennelId, 'run.manage'),
      };
    }
    case 'HareOfferAccepted':
    case 'HareOfferDeclined': {
      const kennelId = str(payload, 'kennelId');
      const userId = str(payload, 'userId');
      const run = await runContext(event.aggregateId);
      if (!kennelId || !userId || !run) return null;
      const accepted = event.eventType === 'HareOfferAccepted';
      return {
        category: C.RUN,
        priority: accepted ? P.HIGH : P.NORMAL,
        title: accepted
          ? `You are haring run #${run.runNumber}`
          : `${run.kennel.shortName} answered your hare offer`,
        body: accepted
          ? 'The trail is yours to set. Plan it from the run page — nobody sees it until you release it.'
          : 'They have gone another way this time. The dates they still need haring are on the kennel page.',
        contextType: 'Run',
        contextId: run.id,
        kennelId,
        recipients: [userId],
      };
    }

    // The calendar speaking up about a date nobody is haring (D45).
    case 'RunHareReminderIssued': {
      const kennelId = str(payload, 'kennelId');
      const stage = str(payload, 'stage');
      const run = await runContext(event.aggregateId);
      if (!kennelId || !run || !stage) return null;

      const days = typeof payload.daysAway === 'number' ? payload.daysAway : null;
      const offers = typeof payload.offerCount === 'number' ? payload.offerCount : 0;
      const when = days === null ? 'soon' : days <= 1 ? 'tomorrow' : `in ${days} days`;

      if (stage === 'offers-waiting') {
        return {
          category: C.RUN,
          priority: P.NORMAL,
          title: `${offers === 1 ? 'A hasher has' : `${offers} hashers have`} offered to hare run #${run.runNumber}`,
          body: `Nobody has answered them, and the run is ${when}. An answer either way lets them plan or lets someone else step up.`,
          contextType: 'Run',
          contextId: run.id,
          kennelId,
          recipients: await officerIds(kennelId, 'run.manage'),
        };
      }

      if (stage === 'no-trail-planned') {
        const hareUserIds = Array.isArray(payload.hareUserIds)
          ? payload.hareUserIds.filter((id): id is string => typeof id === 'string')
          : [];
        return {
          category: C.RUN,
          priority: P.NORMAL,
          title: `No trail started yet for run #${run.runNumber}`,
          body: `You're down as hare and it's ${when}. Start planning the trail when you get a moment.`,
          contextType: 'Run',
          contextId: run.id,
          kennelId,
          recipients: hareUserIds,
        };
      }

      const urgent = stage === 'no-hare-urgent';
      return {
        category: C.RUN,
        priority: urgent ? P.HIGH : P.NORMAL,
        title: `Run #${run.runNumber} still has no hare`,
        body: urgent
          ? `It is ${when} and nobody is laying the trail. If you can take it, say so on the run — it is a short walk from here to On On.`
          : `It is ${when} and nobody has taken it on yet. Ask the pack, or take it yourself.`,
        contextType: 'Run',
        contextId: run.id,
        kennelId,
        // Close in, this is everybody's problem; further out it is the
        // mismanagement's to solve quietly.
        recipients: urgent ? await activeMemberIds(kennelId) : await officerIds(kennelId, 'run.manage'),
      };
    }

    // ── Kennels awaiting the platform (D33/D10) ──
    case 'KennelCreated': {
      const kennel = await prisma.kennel.findUnique({
        where: { id: event.aggregateId },
        select: { name: true, city: true, country: true, status: true },
      });
      if (!kennel || kennel.status !== KennelStatus.PENDING_VERIFICATION) return null;
      return {
        category: C.SYSTEM,
        priority: P.NORMAL,
        title: 'A kennel is waiting for review',
        body: `${kennel.name} was founded in ${kennel.city}, ${kennel.country}. It stays out of the directory and off the map until the platform activates it.`,
        contextType: 'Kennel',
        contextId: event.aggregateId,
        // Deliberately not scoped to the kennel: a kennel must not be able to
        // switch off the notice that asks for it to be reviewed.
        kennelId: null,
        recipients: await platformAdminIds(),
      };
    }
    case 'KennelVerified': {
      const kennel = await prisma.kennel.findUnique({
        where: { id: event.aggregateId },
        select: { name: true, latitude: true, longitude: true },
      });
      if (!kennel) return null;
      const located = kennel.latitude !== null && kennel.longitude !== null;
      return {
        category: C.GOVERNANCE,
        priority: P.HIGH,
        title: `${kennel.name} is live`,
        body: located
          ? 'It is in the kennel directory and on the world map. On On!'
          : 'It is in the kennel directory. Add your coordinates in kennel settings to put it on the map.',
        contextType: 'Kennel',
        contextId: event.aggregateId,
        kennelId: event.aggregateId,
        // The people who can act on what is still missing.
        recipients: await kennelAdminIds(event.aggregateId),
      };
    }

    // ── Social (D50) ──
    //
    // Only the acts that are about a person reach that person: a follow, a
    // like, a comment, a reply, a reshare. A bookmark never notifies anybody —
    // saving something is private — and a view is a tally, not news.
    //
    // Nothing here notifies the actor about their own act, and nothing fans out
    // to a crowd: the audience of a social notification is one person.
    case 'HasherFollowed': {
      if (!event.actorId) return null;
      // Despite its name this event also records kennel follows, with the kennel's
      // id as the aggregate. That id is not a user, so there is nobody to tell:
      // a follow is interest, and it pings no officer (D50). Without this guard
      // the notification insert broke its foreign key and the event stuck.
      if (event.aggregateType !== 'User') return null;
      const follower = await publicNameOf(event.actorId);
      return {
        category: C.SOCIAL,
        priority: P.LOW,
        title: `${follower} is following you`,
        body: 'They will see your reels and reports in their feed.',
        contextType: 'User',
        contextId: event.actorId,
        kennelId: null,
        recipients: [event.aggregateId],
      };
    }
    case 'ContentLiked': {
      const authorId = str(payload, 'authorId');
      if (!authorId || !event.actorId || authorId === event.actorId) return null;
      const who = await publicNameOf(event.actorId);
      return {
        category: C.SOCIAL,
        priority: P.LOW,
        title: `${who} liked your ${subjectWord(str(payload, 'subjectType'))}`,
        body: 'On On!',
        contextType: event.aggregateType,
        contextId: event.aggregateId,
        kennelId: str(payload, 'kennelId'),
        recipients: [authorId],
      };
    }
    case 'ContentCommented': {
      if (!event.actorId) return null;
      const who = await publicNameOf(event.actorId);
      const parentId = str(payload, 'parentId');
      const authorId = str(payload, 'authorId');

      // A reply belongs to the person replied to; a top-level comment belongs
      // to whoever made the thing. Never both, and never the actor.
      let recipient: string | null = authorId;
      let title = `${who} commented on your ${subjectWord(str(payload, 'subjectType'))}`;
      if (parentId) {
        const parent = await prisma.contentComment.findUnique({
          where: { id: parentId },
          select: { authorId: true },
        });
        recipient = parent?.authorId ?? null;
        title = `${who} replied to you`;
      }
      if (!recipient || recipient === event.actorId) return null;

      const commentId = str(payload, 'commentId');
      const comment = commentId
        ? await prisma.contentComment.findUnique({ where: { id: commentId }, select: { body: true } })
        : null;
      return {
        category: C.SOCIAL,
        priority: P.NORMAL,
        title,
        body: comment ? excerpt(comment.body) : 'Go and see what they said.',
        contextType: event.aggregateType,
        contextId: event.aggregateId,
        kennelId: str(payload, 'kennelId'),
        recipients: [recipient],
      };
    }
    case 'ContentReshared': {
      const authorId = str(payload, 'authorId');
      if (!authorId || !event.actorId || authorId === event.actorId) return null;
      const who = await publicNameOf(event.actorId);
      return {
        category: C.SOCIAL,
        priority: P.NORMAL,
        title: `${who} reshared your ${subjectWord(str(payload, 'subjectType'))}`,
        body: payload.hasCommentary ? 'They added something of their own.' : 'It is in their feed now.',
        contextType: event.aggregateType,
        contextId: event.aggregateId,
        kennelId: str(payload, 'kennelId'),
        recipients: [authorId],
      };
    }
    case 'ContentCommentRemoved': {
      const commentId = str(payload, 'commentId');
      if (!commentId) return null;
      const comment = await prisma.contentComment.findUnique({
        where: { id: commentId },
        select: { authorId: true },
      });
      if (!comment || comment.authorId === event.actorId) return null;
      return {
        category: C.SOCIAL,
        priority: P.NORMAL,
        title: 'A comment of yours was taken down',
        body: str(payload, 'reason') ?? 'A moderator removed it.',
        contextType: event.aggregateType,
        contextId: event.aggregateId,
        kennelId: null,
        recipients: [comment.authorId],
      };
    }

    default:
      return null;
  }
}

// ─── Evaluation (Ch.22 A.11 Created → Evaluated → Delivered) ───

// BR-RUN-013: a kennel only sends what it has enabled.
async function kennelAllows(kennelId: string | null, category: NotificationCategory) {
  if (!kennelId) return true;
  const rule = await prisma.kennelNotificationRule.findUnique({
    where: { kennelId_category: { kennelId, category } },
    select: { enabled: true },
  });
  return rule?.enabled ?? true;
}

// BR-NOT-003: the member has the final say on non-emergency notifications. A
// kennel-scoped preference beats the account-wide one; with neither set, the
// channel's own default applies.
async function channelEnabled(
  userId: string,
  category: NotificationCategory,
  channel: DeliveryChannel,
  kennelId: string | null,
  fallback: boolean,
) {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId, category, channel, OR: [{ kennelId }, { kennelId: null }] },
    select: { enabled: true, kennelId: true },
  });
  const scoped = rows.find((r) => r.kennelId === kennelId);
  return (scoped ?? rows.find((r) => r.kennelId === null))?.enabled ?? fallback;
}

// Email costs the reader more attention than a badge does, so it is on by
// default only where missing it has a real consequence: a decision about their
// membership, a trail going live, a safety call.
const EMAIL_BY_DEFAULT = new Set<NotificationCategory>([C.MEMBERSHIP, C.TRAIL_RELEASE, C.SAFETY]);

// Push buzzes a pocket, so the default set is what a hasher would want to be
// interrupted for: something about their standing in a kennel, a run they are
// part of, a trail going live, and anything about safety. Announcements,
// reports and media wait to be looked at (FR-NOT-009 lets anyone change this).
const PUSH_BY_DEFAULT = new Set<NotificationCategory>([C.MEMBERSHIP, C.RUN, C.TRAIL_RELEASE, C.SAFETY]);

// FR-NOT (deep links). Only the contexts with an unambiguous public-web route
// and an id that is directly usable in it. Left out on purpose:
// 'Kennel' (contextId is the kennel's id, not its slug — /kennels/:slug needs
// a lookup this path deliberately skips rather than adding one more query to
// every email sent, and some Kennel notifications go to platform admins, who
// work in a different app this URL was never meant to open) and 'Membership'
// (no page of its own). A notification without a mapped context still sends,
// just without a button — never a guessed or broken link.
const EMAIL_DEEP_LINKS: Partial<Record<string, { path: (id: string) => string; label: string }>> = {
  Run: { path: (id) => `/runs/${id}`, label: 'Open the run' },
  RunCapsule: { path: (id) => `/capsules/${id}`, label: 'Open the Run Capsule' },
  Trail: { path: (id) => `/trails/${id}`, label: 'Open the trail' },
  TrailReport: { path: (id) => `/reports/${id}`, label: 'Read the trail report' },
  User: { path: (id) => `/hashers/${id}`, label: 'View profile' },
};

async function deliverEmail(notificationId: string, to: string, spec: NotificationSpec) {
  const delivery = await prisma.notificationDelivery.create({
    data: { notificationId, channel: DeliveryChannel.EMAIL, status: DeliveryStatus.PENDING },
  });
  const link = spec.contextId ? EMAIL_DEEP_LINKS[spec.contextType] : undefined;
  const result = await sendEmail({
    to,
    subject: spec.title,
    body: spec.body,
    ...(link ? { action: { label: link.label, path: link.path(spec.contextId!) } } : {}),
  });
  await prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: {
      status: result.sent ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
      providerMessageId: result.providerMessageId ?? null,
      error: result.error ?? null,
      attemptedAt: new Date(),
    },
  });
  return result.sent;
}

async function deliverPush(notificationId: string, userId: string, spec: NotificationSpec) {
  const delivery = await prisma.notificationDelivery.create({
    data: { notificationId, channel: DeliveryChannel.PUSH, status: DeliveryStatus.PENDING },
  });
  const result = await sendPush(userId, {
    title: spec.title,
    body: spec.body,
    // Enough for the app to open the thing this is about without another fetch.
    data: {
      notificationId,
      category: spec.category,
      contextType: spec.contextType,
      contextId: spec.contextId,
      kennelId: spec.kennelId,
    },
    priority: spec.priority === P.CRITICAL || spec.priority === P.HIGH ? 'high' : 'default',
  });
  await prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: {
      // One device reached is a delivered notification; the rest is detail the
      // error column keeps for whoever has to debug a silent handset.
      status: result.sent > 0 ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
      providerMessageId: result.providerMessageId ?? null,
      error: result.error ?? null,
      attemptedAt: new Date(),
    },
  });
  return result.sent > 0;
}

export async function fanOut(event: DomainEvent) {
  // At-least-once delivery (Ch.24): re-running an event must not notify twice.
  const already = await prisma.notification.findFirst({ where: { domainEventId: event.id }, select: { id: true } });
  if (already) return 0;

  const spec = await specFor(event);
  if (!spec) return 0;

  if (!(await kennelAllows(spec.kennelId, spec.category))) return 0;

  // Nobody needs telling about their own action.
  const recipients = [...new Set(spec.recipients)].filter((id) => id !== event.actorId);
  const now = new Date();
  const emailable = isEmailConfigured();
  const pushOn = isPushConfigured();
  let created = 0;

  // One query each rather than one per recipient: a kennel-wide trail release
  // can be hundreds of people.
  const people = await prisma.user.findMany({
    where: { id: { in: recipients } },
    select: { id: true, email: true, timeZone: true },
  });
  const addresses = emailable ? new Map(people.map((u) => [u.id, u.email])) : new Map<string, string>();
  const zones = new Map(people.map((u) => [u.id, u.timeZone]));

  // Who could be pushed to at all. Someone who has never opened the mobile app
  // has no device, and queueing push for them would be a delivery row that
  // could only ever fail.
  const pushable = pushOn
    ? new Set(
        (
          await prisma.pushDevice.findMany({
            where: { userId: { in: recipients }, revokedAt: null },
            select: { userId: true },
            distinct: ['userId'],
          })
        ).map((d) => d.userId),
      )
    : new Set<string>();

  for (const recipientUserId of recipients) {
    const inApp = await channelEnabled(recipientUserId, spec.category, DeliveryChannel.IN_APP, spec.kennelId, true);
    const wantsEmail =
      emailable &&
      Boolean(addresses.get(recipientUserId)) &&
      (await channelEnabled(
        recipientUserId,
        spec.category,
        DeliveryChannel.EMAIL,
        spec.kennelId,
        EMAIL_BY_DEFAULT.has(spec.category),
      ));
    // Push is wanted only if the platform can send, this hasher owns a live
    // device, and they have not turned the channel off for this category.
    let wantsPush =
      pushOn &&
      pushable.has(recipientUserId) &&
      (await channelEnabled(
        recipientUserId,
        spec.category,
        DeliveryChannel.PUSH,
        spec.kennelId,
        PUSH_BY_DEFAULT.has(spec.category),
      ));

    // FR-NOT-006. Only push is quietened: the in-app copy still lands and email
    // still sends, so nothing is lost, it just stops buzzing.
    let quietNote: string | null = null;
    if (wantsPush) {
      const quiet = await evaluateQuietHours(recipientUserId, spec.priority, zones.get(recipientUserId), now);
      quietNote = quiet.reason;
      if (quiet.suppressed) wantsPush = false;
    }

    if (!inApp && !wantsEmail && !wantsPush) continue;

    const notification = await prisma.$transaction(async (tx) => {
      const row = await tx.notification.create({
        data: {
          recipientUserId,
          category: spec.category,
          priority: spec.priority,
          status: NotificationStatus.DELIVERED,
          title: spec.title,
          body: spec.body,
          contextType: spec.contextType,
          contextId: spec.contextId,
          domainEventId: event.id,
          deliveryPolicy: 'immediate',
          // FR-NOT-010: why this arrived, in plain words.
          // FR-NOT-010: why this arrived, on which channels, and what was
          // held back — in plain words a hasher can read.
          evaluationReason: [
            `${event.eventType}: `,
            [inApp ? 'in-app' : null, wantsEmail ? 'email' : null, wantsPush ? 'push' : null]
              .filter(Boolean)
              .join(' and ') || 'no',
            ' delivery.',
            emailable ? '' : ' Email is not configured.',
            !pushOn
              ? ' Push is switched off platform-wide.'
              : !pushable.has(recipientUserId)
                ? ' No device is registered for push.'
                : '',
            quietNote ? ` ${quietNote}` : '',
          ].join(''),
          deliveredAt: now,
        },
      });
      if (inApp) {
        await tx.notificationDelivery.create({
          data: {
            notificationId: row.id,
            channel: DeliveryChannel.IN_APP,
            status: DeliveryStatus.SENT,
            attemptedAt: now,
          },
        });
      }
      return row;
    });

    // Sending is a network call, so it happens after the transaction commits: a
    // slow provider must not hold a database transaction open, and a failed
    // send is recorded on the delivery row rather than losing the notification.
    if (wantsEmail) await deliverEmail(notification.id, addresses.get(recipientUserId)!, spec);
    if (wantsPush) await deliverPush(notification.id, recipientUserId, spec);
    created++;
  }

  // Guests: email only, and only while there is a provider to send it.
  for (const guest of emailable ? (spec.guests ?? []) : []) {
    const notification = await prisma.notification.create({
      data: {
        recipientGuestId: guest.id,
        category: spec.category,
        priority: spec.priority,
        status: NotificationStatus.DELIVERED,
        title: spec.title,
        body: spec.body,
        contextType: spec.contextType,
        contextId: spec.contextId,
        domainEventId: event.id,
        deliveryPolicy: 'immediate',
        evaluationReason: `${event.eventType}: guest registered for this run, email only.`,
        deliveredAt: now,
      },
    });
    await deliverEmail(notification.id, guest.email, spec);
    created++;
  }
  return created;
}

// ─── Reads ───

const notificationSelect = {
  id: true,
  category: true,
  priority: true,
  status: true,
  title: true,
  body: true,
  contextType: true,
  contextId: true,
  evaluationReason: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export async function listMine(actor: Actor, opts: { unreadOnly: boolean; page: number; limit: number }) {
  const where: Prisma.NotificationWhereInput = {
    recipientUserId: actor.id,
    ...(opts.unreadOnly ? { readAt: null } : {}),
  };
  const [rows, total, unread] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      select: notificationSelect,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { recipientUserId: actor.id, readAt: null } }),
  ]);
  return { ...page(rows, total, opts.page, opts.limit), unread };
}

export async function unreadCount(actor: Actor) {
  return { unread: await prisma.notification.count({ where: { recipientUserId: actor.id, readAt: null } }) };
}

export async function markRead(actor: Actor, notificationId: string) {
  if (!isUuid(notificationId)) throw ApiError.notFound('Notification not found');
  const { count } = await prisma.notification.updateMany({
    where: { id: notificationId, recipientUserId: actor.id, readAt: null },
    data: { readAt: new Date(), status: NotificationStatus.READ },
  });
  if (count === 0) {
    const exists = await prisma.notification.findFirst({
      where: { id: notificationId, recipientUserId: actor.id },
      select: { id: true },
    });
    if (!exists) throw ApiError.notFound('Notification not found');
  }
}

export async function markAllRead(actor: Actor) {
  const { count } = await prisma.notification.updateMany({
    where: { recipientUserId: actor.id, readAt: null },
    data: { readAt: new Date(), status: NotificationStatus.READ },
  });
  return { marked: count };
}

// ─── Preferences (FR-NOT-009) ───

// Categories a hasher can actually receive today.
export const PREFERENCE_CATEGORIES: NotificationCategory[] = [
  C.MEMBERSHIP,
  C.RUN,
  C.TRAIL_RELEASE,
  C.SAFETY,
  C.REMINDER,
  C.REPORT,
  C.ANNOUNCEMENT,
  C.GOVERNANCE,
  // Follows, likes, comments and reshares (D50). Its own switch, because
  // applause and a trail release are not the same kind of interruption.
  C.SOCIAL,
];

export async function getPreferences(actor: Actor) {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId: actor.id, kennelId: null, eventId: null },
    select: { category: true, channel: true, enabled: true },
  });
  const setting = (category: NotificationCategory, channel: DeliveryChannel, fallback = true) =>
    rows.find((r) => r.category === category && r.channel === channel)?.enabled ?? fallback;

  const [devices, quiet, user] = await Promise.all([
    prisma.pushDevice.findMany({
      where: { userId: actor.id, revokedAt: null },
      select: { id: true, platform: true, lastSeenAt: true },
      orderBy: { lastSeenAt: 'desc' },
    }),
    quietHoursFor(actor.id),
    prisma.user.findUnique({ where: { id: actor.id }, select: { timeZone: true } }),
  ]);

  return {
    categories: PREFERENCE_CATEGORIES.map((category) => ({
      category,
      inApp: setting(category, DeliveryChannel.IN_APP),
      // Matches PUSH_BY_DEFAULT in the fan-out, so the switch a hasher sees is
      // the behaviour they get.
      push: setting(category, DeliveryChannel.PUSH, PUSH_BY_DEFAULT.has(category)),
      // Same again for email.
      email: setting(category, DeliveryChannel.EMAIL, EMAIL_BY_DEFAULT.has(category)),
      // Safety notifications are never fully silenced (BR-NOT-007).
      locked: category === C.SAFETY,
    })),
    // Whether a channel can actually carry anything for this hasher right now.
    // Push needs both a platform that can send and a device of their own, and
    // the screen says which is missing rather than offering a dead switch.
    channels: {
      inApp: true,
      push: isPushConfigured() && devices.length > 0,
      email: isEmailConfigured(),
    },
    push: {
      // A hasher with no device sees why the switches do nothing yet.
      enabledPlatformWide: isPushConfigured(),
      devices,
      quietHours: quiet,
    },
    // Without this, quiet hours evaluate against UTC (quiet-hours.ts#localMinutes
    // falls back there when null), which puts the window in the wrong place for
    // most of the world (D36).
    timeZone: user?.timeZone ?? null,
  };
}

// IANA zone names only ("Africa/Lagos", not "GMT+1" or "WAT"): `Intl` can
// resolve one on any platform without a lookup table of our own, and a
// fixed offset silently drifts across daylight saving.
function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function setTimeZone(actor: Actor, timeZone: string) {
  if (!isValidTimeZone(timeZone)) {
    throw ApiError.badRequest('Not a recognised time zone.', 'INVALID_TIME_ZONE');
  }
  await prisma.user.update({ where: { id: actor.id }, data: { timeZone } });
  return { timeZone };
}

export async function updatePreferences(
  actor: Actor,
  updates: { category: NotificationCategory; channel: DeliveryChannel; enabled: boolean }[],
) {
  for (const update of updates) {
    // BR-NOT-007: attention optimisation never suppresses safety.
    if (update.category === C.SAFETY && update.channel === DeliveryChannel.IN_APP && !update.enabled) {
      throw ApiError.badRequest('Safety notifications cannot be switched off.', 'SAFETY_ALWAYS_ON');
    }
    // The unique key includes nullable kennelId/eventId, which Prisma cannot
    // address through upsert, so this is find-then-write.
    const existing = await prisma.notificationPreference.findFirst({
      where: {
        userId: actor.id,
        category: update.category,
        channel: update.channel,
        kennelId: null,
        eventId: null,
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.notificationPreference.update({ where: { id: existing.id }, data: { enabled: update.enabled } });
    } else {
      await prisma.notificationPreference.create({
        data: { userId: actor.id, category: update.category, channel: update.channel, enabled: update.enabled },
      });
    }
  }
  return getPreferences(actor);
}

// ─── Quiet hours (FR-NOT-006) ───

// The schema hangs quiet hours off a preference row, so there is no single
// account-level place to put them. Writing the same window onto every
// account-wide PUSH row keeps the answer the same whichever row is read, and
// keeps it right if a hasher later scopes a preference to one kennel.
export async function setQuietHours(actor: Actor, window: { start: string; end: string } | null) {
  const data = { quietHoursStart: window?.start ?? null, quietHoursEnd: window?.end ?? null };

  for (const category of PREFERENCE_CATEGORIES) {
    const existing = await prisma.notificationPreference.findFirst({
      where: { userId: actor.id, category, channel: DeliveryChannel.PUSH, kennelId: null, eventId: null },
      select: { id: true },
    });
    if (existing) {
      await prisma.notificationPreference.update({ where: { id: existing.id }, data });
    } else if (window) {
      // Only materialise rows when there is a window to store; clearing one
      // that was never set should not litter the table.
      await prisma.notificationPreference.create({
        data: {
          userId: actor.id,
          category,
          channel: DeliveryChannel.PUSH,
          enabled: PUSH_BY_DEFAULT.has(category),
          ...data,
        },
      });
    }
  }
  return { quietHours: window };
}

// ─── Devices (D12) ───

export async function listDevices(actor: Actor) {
  const items = await prisma.pushDevice.findMany({
    where: { userId: actor.id, revokedAt: null },
    select: { id: true, platform: true, lastSeenAt: true, createdAt: true },
    orderBy: { lastSeenAt: 'desc' },
  });
  // The token itself is never returned. It is a sending credential, and a
  // screen listing a hasher's devices has no use for it.
  return { items, total: items.length, pushEnabled: isPushConfigured() };
}

export async function registerMyDevice(actor: Actor, pushToken: string, platform: DevicePlatform) {
  if (!isExpoPushToken(pushToken)) {
    throw ApiError.badRequest('That does not look like an Expo push token.', 'INVALID_PUSH_TOKEN');
  }
  const device = await registerDevice(actor.id, pushToken, platform);
  return { device, pushEnabled: isPushConfigured() };
}

export async function revokeMyDevice(actor: Actor, pushToken: string) {
  const revoked = await revokeDevice(actor.id, pushToken);
  if (!revoked) throw ApiError.notFound('No such device on your account.');
  return { revoked: true };
}
