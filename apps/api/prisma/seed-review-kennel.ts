import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AppointmentMethod,
  CapsuleStatus,
  ChalkSymbol,
  CheckInMethod,
  Gender,
  KennelStatus,
  MembershipStatus,
  MembershipType,
  PlatformRole,
  PrismaClient,
  ReleaseMode,
  RoleAssignmentStatus,
  RsvpStatus,
  RunStatus,
  RunVisibility,
  ScopedRole,
  TrailStatus,
  TrailStyle,
  TrustLevel,
  VerificationLevel,
  WaypointKind,
} from '@prisma/client';
import { encryptField } from '../src/utils/field-crypto';
import { usernameFrom } from '../src/utils/entities';

// A fully staffed, verified "review kennel" for a real database, so every role in
// the app can be driven by hand (a Play Console review video, a store reviewer,
// a QA pass against production). It is NOT the dev seed: no @hcp.test accounts,
// no shared dev password, and nothing runs without explicit confirmation.
//
// Required environment:
//   SEED_DATABASE_URL | DATABASE_URL   the production database (public URL when run
//                                      from outside Railway)
//   PERSON_ENCRYPTION_KEY              must match the API's
//   REVIEW_EMAIL_DOMAIN                a domain YOU control, e.g. example.org. Accounts
//                                      become gm@<domain>, scribe@<domain> ... Mail to
//                                      them bounces if nobody owns the domain.
//   REVIEW_PASSWORD                    at least 12 characters; one password for all
//   CONFIRM_PRODUCTION_SEED=yes        the seed prints the database host first
//
// Idempotent: every write is an upsert or find-then-create. Re-running never
// touches a password unless RESET_REVIEW_PASSWORD=1. Nothing is deleted. History
// is append-only (kennels with history are archived, not deleted), so to retire
// the kennel, archive it from the admin dashboard and deactivate the accounts.
const connectionString = (process.env.SEED_DATABASE_URL || process.env.DATABASE_URL) as string;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const MIN_PASSWORD_LENGTH = 12;
const KENNEL_SLUG = 'review-h3-owerri';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

interface Account {
  local: string;
  firstName: string;
  lastName: string;
  handle: string | null;
  gender: Gender;
  /** What this account is for, printed in the summary. */
  note: string;
}

// Five mismanagement officers (D10 needs 4), then every kennel-scoped role,
// then plain members and the people who test the edges.
const accounts: Account[] = [
  { local: 'gm', firstName: 'Gift', lastName: 'Master', handle: 'Review GM', gender: Gender.FEMALE, note: 'Grand Master and kennel admin: run privacy, officers, members, delegation' },
  { local: 'jm', firstName: 'Joel', lastName: 'Master', handle: 'Review JM', gender: Gender.MALE, note: 'Joint Master: reviews and suspends memberships' },
  { local: 'ra', firstName: 'Rita', lastName: 'Advisor', handle: 'Review RA', gender: Gender.FEMALE, note: 'Religious Advisor: Circle and awards' },
  { local: 'cash', firstName: 'Chike', lastName: 'Cash', handle: 'Review Cash', gender: Gender.MALE, note: 'Hash Cash' },
  { local: 'onsec', firstName: 'Ola', lastName: 'Secretary', handle: 'Review OnSec', gender: Gender.FEMALE, note: 'On Sec: invites and membership review' },
  { local: 'scribe', firstName: 'Sade', lastName: 'Scribe', handle: 'Review Scribe', gender: Gender.FEMALE, note: 'Scribe: Scribe Studio, trail reports, Run Capsules' },
  { local: 'ascribe', firstName: 'Abel', lastName: 'Assist', handle: 'Review Assistant Scribe', gender: Gender.MALE, note: 'Assistant scribe' },
  { local: 'hare', firstName: 'Hana', lastName: 'Hare', handle: 'Review Hare', gender: Gender.FEMALE, note: 'Lead hare of the upcoming run: lays the hidden trail, sets release' },
  { local: 'cohare', firstName: 'Cody', lastName: 'Cohare', handle: 'Review Co-hare', gender: Gender.MALE, note: 'Co-hare of the upcoming run' },
  { local: 'mod', firstName: 'Mona', lastName: 'Moderator', handle: 'Review Moderator', gender: Gender.FEMALE, note: 'Kennel moderator: reports and content' },
  { local: 'photo', firstName: 'Femi', lastName: 'Photo', handle: 'Review Photographer', gender: Gender.MALE, note: 'Photographer' },
  { local: 'member1', firstName: 'Uche', lastName: 'Runner', handle: 'Review Runner One', gender: Gender.MALE, note: 'Ordinary full member: RSVP, check in, record a run, post, reel, DM' },
  { local: 'member2', firstName: 'Nora', lastName: 'Walker', handle: 'Review Runner Two', gender: Gender.FEMALE, note: 'Ordinary full member: the second person for follows, DMs and reports' },
  { local: 'applicant', firstName: 'Ayo', lastName: 'Applicant', handle: null, gender: Gender.MALE, note: 'Pending membership request: approve or reject it as GM/JM; un-named, so shows as "Just Ayo" (D11)' },
  { local: 'visitor', firstName: 'Vera', lastName: 'Visitor', handle: null, gender: Gender.FEMALE, note: 'Signed-in hasher with no kennel: find a kennel, ask to join, visitor check-in' },
];

const OFFICER_TITLES = ['Grand Master', 'Joint Master', 'Religious Advisor', 'Hash Cash', 'On Sec'];
const OFFICER_PERMISSIONS: Record<string, string[]> = {
  'Grand Master': ['membership.review', 'membership.suspend', 'membership.remove', 'membership.invite', 'officer.appoint', 'kennel.manage'],
  'Joint Master': ['membership.review', 'membership.suspend'],
  'On Sec': ['membership.review', 'membership.invite'],
};

async function main() {
  const domain = required('REVIEW_EMAIL_DOMAIN').toLowerCase().replace(/^@/, '');
  const password = required('REVIEW_PASSWORD');
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`REVIEW_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  if (domain === 'hcp.test' || domain.endsWith('.test')) throw new Error('REVIEW_EMAIL_DOMAIN must be a real domain, not a .test dev domain');
  const resetPassword = process.env.RESET_REVIEW_PASSWORD === '1';

  const host = new URL(connectionString).host;
  console.log(`Target database host: ${host}`);
  if (process.env.CONFIRM_PRODUCTION_SEED !== 'yes') {
    throw new Error('Set CONFIRM_PRODUCTION_SEED=yes to write the review kennel to the database above.');
  }

  const admin = await prisma.user.findFirst({ where: { platformRole: PlatformRole.ADMIN }, orderBy: { createdAt: 'asc' } });
  if (!admin) throw new Error('No platform admin exists. Run prisma:seed:production first.');

  const passwordHash = await bcrypt.hash(password, 12);

  // ── accounts ──────────────────────────────────────────────
  const users: Record<string, { id: string; email: string }> = {};
  for (const a of accounts) {
    const email = `${a.local}@${domain}`;
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        platformRole: PlatformRole.USER,
        hashHandle: a.handle,
        username: usernameFrom(a.handle) ?? `review_${a.local}`,
        trustLevel: TrustLevel.VERIFIED_EMAIL,
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        person: {
          create: {
            firstName: a.firstName,
            lastName: a.lastName,
            dateOfBirth: encryptField('1988-06-15'),
            gender: a.gender,
            phone: encryptField('+2348000000000'),
            nationality: 'Nigeria',
            country: 'Nigeria',
            stateProvince: 'Imo',
            city: 'Owerri',
            languages: ['English'],
            emergencyContactName: encryptField('Review Contact'),
            emergencyContactPhone: encryptField('+2348000000001'),
            emergencyContactRelationship: encryptField('Sibling'),
          },
        },
        passport: { create: {} },
        ...(a.handle ? { hashNames: { create: { name: a.handle, isPrimary: true } } } : {}),
      },
      // Never demote to or from ADMIN, and keep the password unless asked.
      update: resetPassword ? { passwordHash } : {},
    });
    users[a.local] = { id: user.id, email };
  }
  const u = (local: string) => users[local].id;

  // ── kennel ────────────────────────────────────────────────
  const kennel = await prisma.kennel.upsert({
    where: { slug: KENNEL_SLUG },
    create: {
      name: 'Review Hash House Harriers',
      shortName: 'Review H3',
      slug: KENNEL_SLUG,
      country: 'Nigeria',
      stateProvince: 'Imo',
      city: 'Owerri',
      timeZone: 'Africa/Lagos',
      latitude: 5.4836,
      longitude: 7.0333,
      meetingDay: 'Saturday',
      motto: 'Every role, one pack',
      description: 'A fully staffed kennel for app review and testing. Every office is held, so every feature can be tried.',
      status: KennelStatus.ACTIVE,
      verificationLevel: VerificationLevel.OFFICER_VERIFIED,
      verifiedAt: new Date(),
      defaultRunVisibility: RunVisibility.PUBLIC,
      createdById: admin.id,
    },
    update: {},
  });
  const kennelId = kennel.id;

  // ── memberships (everyone but the visitor) ────────────────
  const startDate = new Date('2025-01-04');
  async function ensureMembership(local: string, status: MembershipStatus, type: MembershipType) {
    const existing = await prisma.membership.findFirst({ where: { kennelId, userId: u(local) } });
    if (existing) return existing;
    const active = status === MembershipStatus.ACTIVE;
    return prisma.membership.create({
      data: {
        kennelId,
        userId: u(local),
        type,
        status,
        ...(active ? { startDate, approvedAt: startDate } : {}),
        timeline: { create: { type: active ? 'APPROVED' : 'REQUESTED', toStatus: status, note: 'Review kennel seed' } },
      },
    });
  }

  const memberLocals = ['gm', 'jm', 'ra', 'cash', 'onsec', 'scribe', 'ascribe', 'hare', 'cohare', 'mod', 'photo', 'member1', 'member2'];
  const memberships: Record<string, { id: string }> = {};
  for (const local of memberLocals) {
    memberships[local] = await ensureMembership(local, MembershipStatus.ACTIVE, MembershipType.FULL);
    await prisma.user.update({ where: { id: u(local) }, data: { homeKennelId: kennelId } });
  }
  await ensureMembership('applicant', MembershipStatus.PENDING_REVIEW, MembershipType.VIRGIN);
  await prisma.user.update({ where: { id: u('applicant') }, data: { homeKennelId: kennelId } });

  // ── officers: five mismanagement posts (D10 needs 4) ──────
  for (const [i, title] of OFFICER_TITLES.entries()) {
    const position = await prisma.officerPosition.upsert({
      where: { kennelId_title: { kennelId, title } },
      create: { kennelId, title, sortOrder: i, isMismanagement: true, termMonths: 12, permissions: OFFICER_PERMISSIONS[title] ?? [] },
      update: { permissions: OFFICER_PERMISSIONS[title] ?? [] },
    });
    const holder = ['gm', 'jm', 'ra', 'cash', 'onsec'][i];
    const existing = await prisma.officerAppointment.findFirst({ where: { kennelId, positionId: position.id, userId: u(holder) } });
    if (!existing) {
      await prisma.officerAppointment.create({
        data: {
          kennelId,
          positionId: position.id,
          userId: u(holder),
          membershipId: memberships[holder].id,
          method: AppointmentMethod.ELECTED,
          status: RoleAssignmentStatus.ACTIVE,
          startDate: new Date('2026-01-10'),
        },
      });
    }
  }

  // ── kennel-scoped roles ───────────────────────────────────
  const roles: [string, ScopedRole][] = [
    ['gm', ScopedRole.KENNEL_ADMIN],
    ['scribe', ScopedRole.SCRIBE],
    ['ascribe', ScopedRole.ASSISTANT_SCRIBE],
    ['mod', ScopedRole.MODERATOR],
    ['photo', ScopedRole.PHOTOGRAPHER],
  ];
  for (const [local, role] of roles) {
    const have = await prisma.roleAssignment.findFirst({ where: { kennelId, userId: u(local), role, runId: null } });
    if (!have) await prisma.roleAssignment.create({ data: { kennelId, userId: u(local), role } });
  }

  // ── runs: one archived with a Circle, one upcoming with a hidden trail ──
  const now = new Date();
  const daysToSaturday = (6 - now.getUTCDay() + 7) % 7 || 7;
  const nextSaturday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToSaturday, 14, 0));
  const lastSaturday = new Date(nextSaturday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const minutes = (base: Date, n: number) => new Date(base.getTime() + n * 60 * 1000);
  const place = { timeZone: 'Africa/Lagos', country: 'Nigeria', city: 'Owerri' };

  async function ensureRun(
    runNumber: number,
    data: Record<string, unknown>,
    hares: { local: string; isLead: boolean }[],
    capsuleStatus: CapsuleStatus,
  ) {
    const existing = await prisma.run.findUnique({ where: { kennelId_runNumber: { kennelId, runNumber } } });
    if (existing) return { run: existing, created: false };
    const run = await prisma.run.create({
      data: {
        kennelId,
        runNumber,
        createdById: u('gm'),
        ...(data as object),
        hares: { create: hares.map((h) => ({ userId: u(h.local), isLead: h.isLead })) },
        capsule: { create: { status: capsuleStatus } },
      } as never,
    });
    for (const h of hares) {
      await prisma.roleAssignment.create({
        data: { userId: u(h.local), role: h.isLead ? ScopedRole.HARE : ScopedRole.CO_HARE, runId: run.id, kennelId },
      });
    }
    return { run, created: true };
  }

  const past = await ensureRun(
    1,
    {
      ...place,
      startsAt: lastSaturday,
      title: 'Founders Loop',
      description: 'The review kennel\'s first run: archived, with attendance, a Circle and a trail report to write.',
      status: RunStatus.ARCHIVED,
      visibility: RunVisibility.PUBLIC,
      meetingPointName: 'Imo State Library gate',
      scheduledAt: minutes(lastSaturday, -6 * 24 * 60),
      trailReleasedAt: minutes(lastSaturday, -30),
      checkInOpenedAt: minutes(lastSaturday, -30),
      startedAt: lastSaturday,
      endedAt: minutes(lastSaturday, 90),
      archivedAt: minutes(lastSaturday, 3 * 24 * 60),
    },
    [{ local: 'hare', isLead: true }],
    CapsuleStatus.DRAFT,
  );
  if (past.created) {
    const runId = past.run.id;
    const lockedAt = minutes(lastSaturday, 3 * 24 * 60);
    for (const [i, local] of ['gm', 'jm', 'ra', 'scribe', 'hare', 'member1', 'member2'].entries()) {
      await prisma.participation.create({
        data: {
          runId,
          userId: u(local),
          isVisitor: false,
          homeKennelId: kennelId,
          rsvpStatus: RsvpStatus.GOING,
          checkInMethod: CheckInMethod.OFFICER,
          checkedInAt: minutes(lastSaturday, -20 + i),
          checkedInById: u('jm'),
          lockedAt,
        },
      });
    }
    await prisma.circle.create({
      data: {
        runId,
        startedAt: minutes(lastSaturday, 90),
        endedAt: minutes(lastSaturday, 130),
        songs: ['Swing Low'],
        announcements: 'Next run is hidden. Ask the hare nicely.',
        notes: 'A seeded Circle for review.',
        awards: {
          create: [{ title: 'Down-down', reason: 'Called On On the wrong way', isDownDown: true, recipientUserId: u('member1'), awardedById: u('ra') }],
        },
      },
    });
    await prisma.trail.create({
      data: {
        runId,
        name: 'Main Trail',
        style: TrailStyle.DEAD_HARE,
        status: TrailStatus.ARCHIVED,
        estimatedDistanceM: 5200,
        estimatedDurationMin: 55,
        terrain: 'Town streets and a little shiggy',
        routeGeoJson: { type: 'LineString', coordinates: [[7.0333, 5.4836], [7.0378, 5.4869], [7.0412, 5.4841], [7.0333, 5.4836]] },
        startLatitude: 5.4836,
        startLongitude: 7.0333,
        finishLatitude: 5.4836,
        finishLongitude: 7.0333,
        releaseMode: ReleaseMode.AT_RUN_START,
        lockedAt: minutes(lastSaturday, -120),
        lockedById: u('hare'),
        releasedAt: lastSaturday,
        releasedById: u('hare'),
        hares: { create: [{ userId: u('hare'), isLead: true }] },
      },
    });
  }

  const upcoming = await ensureRun(
    2,
    {
      ...place,
      startsAt: nextSaturday,
      title: 'Hidden Trail Test',
      description: 'A scheduled run with a locked, hidden trail. RSVP, check in, and watch it release at the start.',
      status: RunStatus.SCHEDULED,
      visibility: RunVisibility.PUBLIC,
      meetingPointName: 'Imo State Library gate',
      meetingAddress: 'Imo State Library, Owerri',
      capacity: 40,
      hashCash: '₦2,000',
      scheduledAt: minutes(now, -2 * 24 * 60),
    },
    [
      { local: 'hare', isLead: true },
      { local: 'cohare', isLead: false },
    ],
    CapsuleStatus.PREPARING,
  );
  if (upcoming.created) {
    const runId = upcoming.run.id;
    for (const [local, rsvpStatus] of [['gm', RsvpStatus.GOING], ['member1', RsvpStatus.GOING], ['member2', RsvpStatus.MAYBE]] as const) {
      await prisma.participation.create({ data: { runId, userId: u(local), rsvpStatus, homeKennelId: kennelId } });
    }
    const trail = await prisma.trail.create({
      data: {
        runId,
        name: 'Main Trail',
        style: TrailStyle.DEAD_HARE,
        status: TrailStatus.HIDDEN,
        estimatedDistanceM: 5800,
        estimatedDurationMin: 60,
        terrain: 'Town streets, a market and one optimistic hill',
        notes: 'Beer check behind the library. Do not tell the pack.',
        routeGeoJson: { type: 'LineString', coordinates: [[7.0333, 5.4836], [7.0371, 5.4862], [7.0409, 5.4851], [7.0394, 5.4813], [7.0333, 5.4836]] },
        startLatitude: 5.4836,
        startLongitude: 7.0333,
        finishLatitude: 5.4836,
        finishLongitude: 7.0333,
        releaseMode: ReleaseMode.AT_RUN_START,
        lockedAt: minutes(now, -60),
        lockedById: u('hare'),
        safetyReviewedAt: minutes(now, -60),
        safetyReviewedById: u('gm'),
        hares: { create: [{ userId: u('hare'), isLead: true }, { userId: u('cohare'), isLead: false }] },
      },
    });
    const trailId = trail.id;
    await prisma.waypoint.createMany({
      data: [
        { trailId, kind: WaypointKind.START, label: 'Library gate', latitude: 5.4836, longitude: 7.0333, sequence: 0 },
        { trailId, kind: WaypointKind.CHECKPOINT, label: 'First check', latitude: 5.4862, longitude: 7.0371, sequence: 1 },
        { trailId, kind: WaypointKind.HAZARD, label: 'Busy road crossing', latitude: 5.4851, longitude: 7.0409, sequence: 2, notes: 'Marshal here' },
        { trailId, kind: WaypointKind.FINISH, label: 'On In', latitude: 5.4836, longitude: 7.0333, sequence: 3 },
      ],
    });
    await prisma.beerCheck.create({
      data: { trailId, name: 'Library beer check', latitude: 5.4813, longitude: 7.0394, sequence: 0, notes: 'Two crates, one cooler' },
    });
    await prisma.digitalChalkSymbol.createMany({
      data: [
        { trailId, symbol: ChalkSymbol.ON_ON, latitude: 5.4843, longitude: 7.0345, placedById: u('hare') },
        { trailId, symbol: ChalkSymbol.CHECK, latitude: 5.4862, longitude: 7.0371, placedById: u('hare') },
        { trailId, symbol: ChalkSymbol.ON_IN, latitude: 5.4837, longitude: 7.0335, placedById: u('cohare') },
      ],
    });
  }

  console.log(`\nReview kennel ready: ${kennel.name} (/${KENNEL_SLUG}), verified, ${OFFICER_TITLES.length} mismanagement officers.`);
  console.log(`Password: the REVIEW_PASSWORD you supplied${resetPassword ? ' (reset on this run)' : ' (unchanged for accounts that already existed)'}\n`);
  for (const a of accounts) console.log(`  ${users[a.local].email.padEnd(32)} ${a.note}`);
  console.log(`\nPlatform admin (already seeded): ${admin.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
