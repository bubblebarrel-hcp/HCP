import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  AccountStatus,
  Audience,
  CommentStatus,
  MediaTargetType,
  MembershipStatus,
  PostStatus,
  ReelStatus,
  RoleAssignmentStatus,
} from '@prisma/client';
import prisma from '../config/prisma';
import { ApiError } from '../utils/http';
import { logger } from '../utils/logger';
import { approveAllPending, pendingRequestCount } from './follow.service';
import { recordAudit, recordEvent } from './record.service';
import { deleteObject } from './storage.service';

// What a hasher decides about their own account (D57): who sees what they make,
// stepping away for a while, and leaving for good.

// ─── Who sees what I make ───

export async function getPrivacy(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { profileVisibility: true } });
  return { profileVisibility: user.profileVisibility, pendingRequests: await pendingRequestCount(userId) };
}

// One setting for the whole profile: posts, photos and reels. FOLLOWERS is a
// locked profile, where a follow becomes a request. Opening it back up to
// everybody lets in whoever was waiting, in the same transaction, so the lock
// and the queue can never disagree.
export async function setProfileVisibility(userId: string, level: Audience) {
  const current = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { profileVisibility: true } });
  if (current.profileVisibility === level) return getPrivacy(userId);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { profileVisibility: level } });
    const admitted = level === Audience.PUBLIC ? await approveAllPending(tx, userId) : 0;
    const event = await recordEvent(tx, {
      eventType: 'ProfileVisibilityChanged',
      aggregateType: 'Identity',
      aggregateId: userId,
      actorId: userId,
      payload: { from: current.profileVisibility, to: level, admitted },
    });
    await recordAudit(tx, {
      actorId: userId,
      action: 'identity.profile.visibility',
      resourceType: 'Identity',
      resourceId: userId,
      previousState: { profileVisibility: current.profileVisibility },
      newState: { profileVisibility: level },
      policyRef: 'self',
      domainEventId: event.id,
    });
  });
  return getPrivacy(userId);
}

// ─── Stepping away, and leaving ───

async function confirmPassword(userId: string, password: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw ApiError.badRequest('That password is not right.', 'INVALID_PASSWORD');
  }
  return user;
}

// Deactivating hides the hasher everywhere and ends every session, and signing
// back in brings it all back (auth.service#login). Nothing is removed.
export async function deactivate(userId: string, password: string) {
  await confirmPassword(userId, password);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: AccountStatus.DEACTIVATED, deactivatedAt: now } });
    await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    const event = await recordEvent(tx, {
      eventType: 'AccountDeactivated',
      aggregateType: 'Identity',
      aggregateId: userId,
      actorId: userId,
    });
    await recordAudit(tx, {
      actorId: userId,
      action: 'identity.account.deactivate',
      resourceType: 'Identity',
      resourceId: userId,
      previousState: { status: AccountStatus.ACTIVE },
      newState: { status: AccountStatus.DEACTIVATED },
      policyRef: 'self',
      domainEventId: event.id,
    });
  });
  return { deactivated: true };
}

// The kennel offices a hasher still holds. Deleting them out from under a kennel
// would leave a seat nobody resigned, so it has to be done first, on purpose.
async function heldOffices(userId: string) {
  const [appointments, roles] = await Promise.all([
    prisma.officerAppointment.count({ where: { userId, status: RoleAssignmentStatus.ACTIVE } }),
    prisma.roleAssignment.count({
      where: {
        userId,
        kennelId: { not: null },
        status: { in: [RoleAssignmentStatus.ACTIVE, RoleAssignmentStatus.APPOINTED] },
      },
    }),
  ]);
  return appointments + roles;
}

const PERSONAL_MEDIA: MediaTargetType[] = [MediaTargetType.POST, MediaTargetType.REEL, MediaTargetType.PROFILE];

// Deleting an account removes the person and keeps the record (D57).
//
// What goes: the name, handle, picture and banner, the biodata, the login and
// every session, follows in both directions, bookmarks, notifications and
// devices, and everything they posted or put in a reel, photos included. What
// stays is what other people's history is made of: the runs they attended, the
// reports and capsules that name them, and the photos they put on a run, all of
// which now read "Deleted hasher". That follows the rule that history is never
// destructively edited, and it is why a kennel's records do not lose a Saturday.
//
// It is not reversible, which is why it asks for the password and a typed word.
export async function deleteAccount(userId: string, password: string) {
  const user = await confirmPassword(userId, password);
  if (user.deletedAt) throw ApiError.badRequest('That account is already deleted.', 'ALREADY_DELETED');
  if ((await heldOffices(userId)) > 0) {
    throw ApiError.conflict(
      'You still hold an office or role in a kennel. Resign it first so the kennel is not left with an empty seat.',
      'HOLDS_OFFICE',
    );
  }

  const now = new Date();
  const personalMedia = await prisma.mediaAsset.findMany({
    where: { uploaderId: userId, links: { some: { targetType: { in: PERSONAL_MEDIA } } } },
    select: { id: true, storageKey: true },
  });
  const kennels = await prisma.membership.findMany({
    where: { userId, status: { notIn: [MembershipStatus.RESIGNED, MembershipStatus.REMOVED, MembershipStatus.REJECTED, MembershipStatus.WITHDRAWN, MembershipStatus.ARCHIVED] } },
    select: { kennelId: true },
  });

  await prisma.$transaction(
    async (tx) => {
      // The login, and everything that could be used to get back in.
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.emailVerificationToken.deleteMany({ where: { userId } });

      // Who they follow and who follows them, and their private lists.
      await tx.follow.deleteMany({
        where: { OR: [{ followerId: userId }, { targetType: 'USER', targetId: userId }] },
      });
      await tx.contentBookmark.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { recipientUserId: userId } });
      await tx.notificationPreference.deleteMany({ where: { userId } });
      await tx.pushDevice.deleteMany({ where: { userId } });

      // What they made and kept for themself. Archived, not erased, like any
      // post or reel its author takes down (Ch.22).
      await tx.post.updateMany({
        where: { authorId: userId, status: { in: [PostStatus.DRAFT, PostStatus.PUBLISHED] } },
        data: { status: PostStatus.ARCHIVED, archivedAt: now },
      });
      await tx.reel.updateMany({
        where: { authorId: userId, status: { in: [ReelStatus.DRAFT, ReelStatus.PUBLISHED] } },
        data: { status: ReelStatus.ARCHIVED, archivedAt: now },
      });
      await tx.contentComment.updateMany({
        where: { authorId: userId, status: CommentStatus.VISIBLE },
        data: { status: CommentStatus.DELETED, deletedAt: now },
      });
      // The files themselves go too; the rows stay, emptied, so nothing that
      // pointed at them breaks.
      if (personalMedia.length > 0) {
        await tx.mediaAsset.updateMany({
          where: { id: { in: personalMedia.map((m) => m.id) } },
          data: { url: null, thumbnailUrl: null, caption: null, moderationState: 'REJECTED' },
        });
      }

      // Out of every kennel they were in, as a resignation. Their attendance and
      // anything they did there stays in that kennel's history.
      await tx.membership.updateMany({
        where: { userId, status: { notIn: [MembershipStatus.RESIGNED, MembershipStatus.REMOVED, MembershipStatus.REJECTED, MembershipStatus.WITHDRAWN, MembershipStatus.ARCHIVED] } },
        data: { status: MembershipStatus.RESIGNED, isHomeKennel: false },
      });

      // A Hash Passport link is a public address for a person; the old one dies.
      await tx.hashPassport.updateMany({ where: { userId }, data: { shareToken: randomUUID() } });

      // The biodata is wiped in place: the columns are required, so they are
      // emptied rather than dropped.
      await tx.personProfile.updateMany({
        where: { userId },
        data: {
          firstName: 'Deleted',
          middleName: null,
          lastName: 'Hasher',
          dateOfBirth: '',
          phone: '',
          nationality: '',
          country: '',
          stateProvince: '',
          city: '',
          addressLine: null,
          occupation: null,
          languages: [],
          emergencyContactName: '',
          emergencyContactPhone: '',
          emergencyContactRelationship: '',
          medicalNotes: null,
        },
      });

      // Last, the person. The address is freed for anybody who wants it, and the
      // password becomes something nobody knows.
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted+${userId}@deleted.invalid`,
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
          hashHandle: null,
          avatarUrl: null,
          avatarPosition: null,
          bannerUrl: null,
          bannerPosition: null,
          bio: null,
          timeZone: null,
          homeKennelId: null,
          profileVisibility: Audience.ONLY_ME,
          status: AccountStatus.DEACTIVATED,
          deactivatedAt: now,
          deletedAt: now,
        },
      });

      const event = await recordEvent(tx, {
        eventType: 'AccountDeleted',
        aggregateType: 'Identity',
        aggregateId: userId,
        actorId: userId,
        payload: { kennelIds: kennels.map((k) => k.kennelId) },
      });
      await recordAudit(tx, {
        actorId: userId,
        action: 'identity.account.delete',
        resourceType: 'Identity',
        resourceId: userId,
        previousState: { status: user.status },
        newState: { status: AccountStatus.DEACTIVATED, deleted: true },
        policyRef: 'self',
        domainEventId: event.id,
      });
    },
    { timeout: 30_000 },
  );

  // Best effort, after the commit: a file that cannot be removed now is an
  // orphan in a bucket, not a reason to keep the account.
  for (const media of personalMedia) {
    deleteObject(media.storageKey).catch((err) => logger.warn?.('Could not delete a file for a deleted account', { err }));
  }
  return { deleted: true };
}
