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
  Prisma,
  PrismaClient,
  ReleaseMode,
  RoleAssignmentStatus,
  RsvpStatus,
  RunStatus,
  RunType,
  RunVisibility,
  ScopedRole,
  TrailStatus,
  TrailStyle,
  TrustLevel,
  VerificationLevel,
  WaypointKind,
} from '@prisma/client';
import { env } from '../src/config/env';
import { encryptField } from '../src/utils/field-crypto';
import { usernameFrom } from '../src/utils/entities';

// Idempotent by design: every write is an upsert, or a find-then-create keyed on
// something stable, so re-running against a populated database is safe.
//
// The seed writes rows directly, bypassing services and the event outbox. It
// still respects D10: the two kennels seeded as verified each get 4+ active
// mismanagement officers.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

interface SeedPerson {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  hashHandle: string | null;
  gender: Gender;
  country: string;
  stateProvince: string;
  city: string;
  role?: PlatformRole;
}

async function upsertUser(p: SeedPerson) {
  const passwordHash = await bcrypt.hash(p.password, 12);
  const user = await prisma.user.upsert({
    where: { email: p.email },
    create: {
      email: p.email,
      passwordHash,
      platformRole: p.role ?? PlatformRole.USER,
      hashHandle: p.hashHandle,
      // What they are @mentioned as (D59): the handle, or the part of the email
      // before the "@" for the seeded accounts that have none.
      username: usernameFrom(p.hashHandle) ?? p.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      trustLevel: TrustLevel.VERIFIED_EMAIL,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      person: {
        create: {
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: encryptField('1988-06-15'),
          gender: p.gender,
          phone: encryptField('+2348000000000'),
          nationality: p.country,
          country: p.country,
          stateProvince: p.stateProvince,
          city: p.city,
          languages: ['English'],
          emergencyContactName: encryptField('Seed Contact'),
          emergencyContactPhone: encryptField('+2348000000001'),
          emergencyContactRelationship: encryptField('Sibling'),
        },
      },
      passport: { create: {} },
      ...(p.hashHandle ? { hashNames: { create: { name: p.hashHandle, isPrimary: true } } } : {}),
    },
    // Re-running resets demo passwords and roles, nothing a real signup created.
    update: { passwordHash, platformRole: p.role ?? PlatformRole.USER },
  });
  return user;
}

interface SeedKennel {
  name: string;
  shortName: string;
  slug: string;
  country: string;
  stateProvince: string;
  city: string;
  timeZone: string;
  latitude: number;
  longitude: number;
  meetingDay: string;
  motto: string;
  description: string;
  status: KennelStatus;
  verificationLevel: VerificationLevel;
  defaultRunVisibility: RunVisibility;
}

const kennels: SeedKennel[] = [
  {
    name: 'Abuja Hash House Harriers',
    shortName: 'Abuja H3',
    slug: 'abuja-h3-abuja',
    country: 'Nigeria',
    stateProvince: 'FCT',
    city: 'Abuja',
    timeZone: 'Africa/Lagos',
    latitude: 9.0765,
    longitude: 7.3986,
    meetingDay: 'Saturday',
    motto: 'On On through the rocks',
    description:
      'Saturday afternoon trails through the hills and savannah around the capital, finishing with a proper Circle. Visitors and virgins always welcome.',
    status: KennelStatus.ACTIVE,
    verificationLevel: VerificationLevel.OFFICER_VERIFIED,
    defaultRunVisibility: RunVisibility.PUBLIC,
  },
  {
    name: 'Lagos Hash House Harriers',
    shortName: 'Lagos H3',
    slug: 'lagos-h3-lagos',
    country: 'Nigeria',
    stateProvince: 'Lagos',
    city: 'Lagos',
    timeZone: 'Africa/Lagos',
    latitude: 6.4541,
    longitude: 3.3947,
    meetingDay: 'Saturday',
    motto: 'Traffic cannot stop the pack',
    description:
      'One of the oldest kennels in West Africa. Trails wind through estates, beaches and back streets, with beer checks the pack still talks about.',
    status: KennelStatus.ACTIVE,
    verificationLevel: VerificationLevel.OFFICER_VERIFIED,
    defaultRunVisibility: RunVisibility.MEMBERS_ONLY,
  },
  {
    name: 'Port Harcourt Hash House Harriers',
    shortName: 'PH H3',
    slug: 'ph-h3-port-harcourt',
    country: 'Nigeria',
    stateProvince: 'Rivers',
    city: 'Port Harcourt',
    timeZone: 'Africa/Lagos',
    latitude: 4.8156,
    longitude: 7.0498,
    meetingDay: 'Saturday',
    motto: 'Mud is a feature',
    description: 'Creek-side trails and generous shiggy. A small, loud and very welcoming pack.',
    status: KennelStatus.ACTIVE,
    verificationLevel: VerificationLevel.PENDING,
    defaultRunVisibility: RunVisibility.PUBLIC,
  },
  {
    name: 'Accra Hash House Harriers',
    shortName: 'Accra H3',
    slug: 'accra-h3-accra',
    country: 'Ghana',
    stateProvince: 'Greater Accra',
    city: 'Accra',
    timeZone: 'Africa/Accra',
    latitude: 5.6037,
    longitude: -0.187,
    meetingDay: 'Monday',
    motto: 'Monday blues, cured',
    description: 'Monday evening runs across Accra, with a monthly full moon special.',
    status: KennelStatus.ACTIVE,
    verificationLevel: VerificationLevel.PENDING,
    defaultRunVisibility: RunVisibility.PUBLIC,
  },
  {
    name: 'Nairobi Hash House Harriers',
    shortName: 'Nairobi H3',
    slug: 'nairobi-h3-nairobi',
    country: 'Kenya',
    stateProvince: 'Nairobi County',
    city: 'Nairobi',
    timeZone: 'Africa/Nairobi',
    latitude: -1.2921,
    longitude: 36.8219,
    meetingDay: 'Sunday',
    motto: 'Altitude training, allegedly',
    description: 'Sunday trails through tea farms, forest edges and ridges above the city.',
    status: KennelStatus.ACTIVE,
    verificationLevel: VerificationLevel.PENDING,
    defaultRunVisibility: RunVisibility.PUBLIC,
  },
  {
    name: 'Kigali Hash House Harriers',
    shortName: 'Kigali H3',
    slug: 'kigali-h3-kigali',
    country: 'Rwanda',
    stateProvince: 'Kigali',
    city: 'Kigali',
    timeZone: 'Africa/Kigali',
    latitude: -1.9441,
    longitude: 30.0619,
    meetingDay: 'Saturday',
    motto: 'A thousand hills, a thousand checks',
    description: 'Every trail goes up. Every trail also comes down, eventually.',
    status: KennelStatus.ACTIVE,
    verificationLevel: VerificationLevel.PENDING,
    defaultRunVisibility: RunVisibility.PUBLIC,
  },
  {
    name: 'Johannesburg Hash House Harriers',
    shortName: 'Joburg H3',
    slug: 'joburg-h3-johannesburg',
    country: 'South Africa',
    stateProvince: 'Gauteng',
    city: 'Johannesburg',
    timeZone: 'Africa/Johannesburg',
    latitude: -26.2041,
    longitude: 28.0473,
    meetingDay: 'Tuesday',
    motto: 'Highveld harriers',
    description: 'Tuesday evening trails with a strong walkers pack and a legendary song book.',
    status: KennelStatus.ACTIVE,
    verificationLevel: VerificationLevel.PENDING,
    defaultRunVisibility: RunVisibility.PUBLIC,
  },
  {
    name: 'Enugu Hash House Harriers',
    shortName: 'Enugu H3',
    slug: 'enugu-h3-enugu',
    country: 'Nigeria',
    stateProvince: 'Enugu',
    city: 'Enugu',
    timeZone: 'Africa/Lagos',
    latitude: 6.4584,
    longitude: 7.5464,
    meetingDay: 'Saturday',
    motto: 'Coal City on-on',
    description: 'A new kennel still gathering its founding mismanagement. Awaiting verification.',
    status: KennelStatus.PENDING_VERIFICATION,
    verificationLevel: VerificationLevel.PENDING,
    defaultRunVisibility: RunVisibility.MEMBERS_ONLY,
  },
];

const officerTitles = ['Grand Master', 'Joint Master', 'Religious Advisor', 'Hash Cash', 'On Sec'];

// Demo permission profiles (PERMISSION-MATRIX.md). Real kennels set their own
// on OfficerPosition.permissions; there is no platform-wide default.
const officerPermissions: Record<string, string[]> = {
  'Grand Master': ['membership.review', 'membership.suspend', 'membership.remove', 'membership.invite', 'officer.appoint', 'kennel.manage'],
  'Joint Master': ['membership.review', 'membership.suspend'],
  'On Sec': ['membership.review', 'membership.invite'],
};

async function ensureOfficers(kennelId: string, people: { id: string }[]) {
  for (const [i, title] of officerTitles.entries()) {
    const permissions = officerPermissions[title] ?? [];
    const position = await prisma.officerPosition.upsert({
      where: { kennelId_title: { kennelId, title } },
      create: { kennelId, title, sortOrder: i, isMismanagement: true, termMonths: 12, permissions },
      update: { permissions },
    });

    const person = people[i];
    if (!person) continue;

    let membership = await prisma.membership.findFirst({ where: { kennelId, userId: person.id } });
    if (!membership) {
      membership = await prisma.membership.create({
        data: {
          kennelId,
          userId: person.id,
          type: MembershipType.FULL,
          status: MembershipStatus.ACTIVE,
          startDate: new Date('2024-01-06'),
          approvedAt: new Date('2024-01-06'),
          timeline: { create: { type: 'APPROVED', toStatus: MembershipStatus.ACTIVE, note: 'Seeded' } },
        },
      });
    }

    const existing = await prisma.officerAppointment.findFirst({
      where: { kennelId, positionId: position.id, userId: person.id },
    });
    if (!existing) {
      await prisma.officerAppointment.create({
        data: {
          kennelId,
          positionId: position.id,
          userId: person.id,
          membershipId: membership.id,
          method: AppointmentMethod.ELECTED,
          status: RoleAssignmentStatus.ACTIVE,
          startDate: new Date('2026-01-10'),
        },
      });
    }
  }
}

async function main() {
  const admin = await upsertUser({
    email: env.seedAdminEmail,
    password: env.seedAdminPassword,
    firstName: 'Platform',
    lastName: 'Admin',
    hashHandle: 'Admin Wipes',
    gender: Gender.PREFER_NOT_TO_SAY,
    country: 'Nigeria',
    stateProvince: 'Imo',
    city: 'Owerri',
    role: PlatformRole.ADMIN,
  });

  const hasher = await upsertUser({
    email: env.seedUserEmail,
    password: env.seedUserPassword,
    firstName: 'Chidi',
    lastName: 'Okeke',
    // Un-named hasher, so the "Just <firstName>" display rule (D11) is visible
    hashHandle: null,
    gender: Gender.MALE,
    country: 'Nigeria',
    stateProvince: 'FCT',
    city: 'Abuja',
  });

  const officerSeed: [string, string, string | null, Gender][] = [
    ['Amaka', 'Nwosu', 'Pothole Queen', Gender.FEMALE],
    ['Tunde', 'Bakare', 'Generator', Gender.MALE],
    ['Ngozi', 'Eze', 'Shiggy Diva', Gender.FEMALE],
    ['Emeka', 'Obi', 'Two Beers Short', Gender.MALE],
    ['Zainab', 'Bello', null, Gender.FEMALE],
    ['Folake', 'Adeyemi', 'Wrong Way', Gender.FEMALE],
    ['Ifeanyi', 'Uche', 'Danfo', Gender.MALE],
    ['Bisi', 'Olatunji', 'Jollof Wars', Gender.FEMALE],
    ['Segun', 'Ade', 'Back Check', Gender.MALE],
    ['Kemi', 'Ojo', null, Gender.FEMALE],
  ];

  const officers = [];
  for (const [i, [firstName, lastName, hashHandle, gender]] of officerSeed.entries()) {
    officers.push(
      await upsertUser({
        email: `officer${i + 1}@hcp.test`,
        password: env.seedUserPassword,
        firstName,
        lastName,
        hashHandle,
        gender,
        country: 'Nigeria',
        stateProvince: i < 5 ? 'FCT' : 'Lagos',
        city: i < 5 ? 'Abuja' : 'Lagos',
      }),
    );
  }

  const kennelIds: Record<string, string> = {};
  for (const k of kennels) {
    const kennel = await prisma.kennel.upsert({
      where: { slug: k.slug },
      create: {
        ...k,
        verifiedAt: k.verificationLevel === VerificationLevel.PENDING ? null : new Date('2026-02-01'),
        createdById: admin.id,
      },
      update: {},
    });
    kennelIds[k.slug] = kennel.id;
  }

  // Verified kennels carry 5 active mismanagement officers each (D10 needs 4).
  await ensureOfficers(kennelIds['abuja-h3-abuja'], officers.slice(0, 5));
  await ensureOfficers(kennelIds['lagos-h3-lagos'], officers.slice(5, 10));

  // Abuja's Grand Master is also its kennel admin (D3: sets run privacy).
  const abujaAdmin = await prisma.roleAssignment.findFirst({
    where: { kennelId: kennelIds['abuja-h3-abuja'], userId: officers[0].id, role: ScopedRole.KENNEL_ADMIN },
  });
  if (!abujaAdmin) {
    await prisma.roleAssignment.create({
      data: { kennelId: kennelIds['abuja-h3-abuja'], userId: officers[0].id, role: ScopedRole.KENNEL_ADMIN },
    });
  }

  // Abuja has a Hash Scribe, so Scribe Studio has an owner out of the box
  // (D29: the SCRIBE role is what lets someone start a Trail Report).
  const abujaScribe = await prisma.roleAssignment.findFirst({
    where: { kennelId: kennelIds['abuja-h3-abuja'], userId: officers[2].id, role: ScopedRole.SCRIBE },
  });
  if (!abujaScribe) {
    await prisma.roleAssignment.create({
      data: { kennelId: kennelIds['abuja-h3-abuja'], userId: officers[2].id, role: ScopedRole.SCRIBE },
    });
  }

  // The demo hasher is a pending applicant at Abuja with it as home kennel.
  const pending = await prisma.membership.findFirst({
    where: { kennelId: kennelIds['abuja-h3-abuja'], userId: hasher.id },
  });
  if (!pending) {
    await prisma.membership.create({
      data: {
        kennelId: kennelIds['abuja-h3-abuja'],
        userId: hasher.id,
        type: MembershipType.VIRGIN,
        status: MembershipStatus.PENDING_REVIEW,
        timeline: { create: { type: 'REQUESTED', toStatus: MembershipStatus.PENDING_REVIEW } },
      },
    });
  }
  await prisma.user.update({ where: { id: hasher.id }, data: { homeKennelId: kennelIds['abuja-h3-abuja'] } });

  await prisma.platformSetting.upsert({
    where: { key: 'kennel.verification.minMismanagement' },
    create: {
      key: 'kennel.verification.minMismanagement',
      value: 4,
      description: 'D10: minimum active mismanagement members for kennel verification',
    },
    update: {},
  });

  await prisma.platformSetting.upsert({
    where: { key: 'membership.reapplyCooldownDays' },
    create: {
      key: 'membership.reapplyCooldownDays',
      value: 30,
      description: 'D20: days after a rejection or removal before the hasher may ask to join that kennel again',
    },
    update: {},
  });

  // Demo runs, keyed on (kennel, run number). Abuja: an archived run with
  // attendance and a Circle, a published upcoming run and a draft. Lagos: a
  // members-only upcoming run. Times are 15:00 Africa/Lagos (14:00 UTC).
  const abujaId = kennelIds['abuja-h3-abuja'];
  const lagosId = kennelIds['lagos-h3-lagos'];
  const now = new Date();
  const daysToSaturday = (6 - now.getUTCDay() + 7) % 7 || 7;
  const nextSaturday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToSaturday, 14, 0),
  );
  const lastSaturday = new Date(nextSaturday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const minutes = (base: Date, n: number) => new Date(base.getTime() + n * 60 * 1000);

  async function ensureRun(
    kennelId: string,
    runNumber: number,
    data: Omit<Prisma.RunUncheckedCreateInput, 'kennelId' | 'runNumber' | 'createdById'>,
    hares: { id: string; isLead: boolean }[],
    capsuleStatus: CapsuleStatus,
  ) {
    const existing = await prisma.run.findUnique({ where: { kennelId_runNumber: { kennelId, runNumber } } });
    if (existing) return { run: existing, created: false };
    const run = await prisma.run.create({
      data: {
        kennelId,
        runNumber,
        createdById: admin.id,
        ...data,
        hares: { create: hares.map((h) => ({ userId: h.id, isLead: h.isLead })) },
        capsule: { create: { status: capsuleStatus } },
      },
    });
    for (const h of hares) {
      await prisma.roleAssignment.create({
        data: { userId: h.id, role: h.isLead ? ScopedRole.HARE : ScopedRole.CO_HARE, runId: run.id, kennelId },
      });
    }
    return { run, created: true };
  }

  const lagosTime = { timeZone: 'Africa/Lagos', country: 'Nigeria' };

  const past = await ensureRun(
    abujaId,
    411,
    {
      ...lagosTime,
      city: 'Abuja',
      startsAt: lastSaturday,
      title: 'Jabi Lake Loop',
      description: 'Lake shore shiggy, two false trails and a beer check with a view.',
      status: RunStatus.ARCHIVED,
      visibility: RunVisibility.PUBLIC,
      meetingPointName: 'Jabi Lake Mall car park',
      scheduledAt: minutes(lastSaturday, -6 * 24 * 60),
      trailReleasedAt: minutes(lastSaturday, -30),
      checkInOpenedAt: minutes(lastSaturday, -30),
      startedAt: lastSaturday,
      endedAt: minutes(lastSaturday, 95),
      archivedAt: minutes(lastSaturday, 3 * 24 * 60),
    },
    [
      { id: officers[1].id, isLead: true },
      { id: officers[3].id, isLead: false },
    ],
    CapsuleStatus.DRAFT,
  );
  if (past.created) {
    const runId = past.run.id;
    const lockedAt = minutes(lastSaturday, 3 * 24 * 60);
    const guest = await prisma.guestProfile.create({
      data: { firstName: 'Ada', lastName: 'Visitor', email: 'ada.visitor@example.com', consentAt: lastSaturday },
    });
    const attendees = [
      ...officers.slice(0, 5).map((o) => ({ userId: o.id, isVisitor: false, homeKennelId: abujaId })),
      ...officers.slice(5, 7).map((o) => ({ userId: o.id, isVisitor: true, homeKennelId: lagosId })),
    ];
    for (const [i, attendee] of attendees.entries()) {
      await prisma.participation.create({
        data: {
          runId,
          ...attendee,
          rsvpStatus: RsvpStatus.GOING,
          checkInMethod: CheckInMethod.OFFICER,
          checkedInAt: minutes(lastSaturday, -20 + i),
          checkedInById: officers[1].id,
          lockedAt,
        },
      });
    }
    await prisma.participation.create({
      data: {
        runId,
        guestId: guest.id,
        rsvpStatus: RsvpStatus.GOING,
        isVisitor: true,
        isVirginRun: true,
        checkInMethod: CheckInMethod.OFFICER,
        checkedInAt: minutes(lastSaturday, -5),
        checkedInById: officers[1].id,
        lockedAt,
      },
    });
    await prisma.circle.create({
      data: {
        runId,
        startedAt: minutes(lastSaturday, 95),
        endedAt: minutes(lastSaturday, 140),
        songs: ["Here's to Generator", 'Swing Low'],
        announcements: 'Red Dress Run in three weeks. Bring the dress.',
        notes: 'Two visitors from Lagos H3 and one virgin welcomed to the Circle.',
        awards: {
          create: [
            {
              title: 'Down-down',
              reason: 'Called On On the wrong way at the second check',
              isDownDown: true,
              recipientUserId: officers[2].id,
              awardedById: officers[0].id,
            },
            { title: 'First Hash', reason: 'Finished the long trail', recipientGuestId: guest.id, awardedById: officers[0].id },
          ],
        },
      },
    });
    await prisma.runCapsule.update({
      where: { runId },
      data: {
        timeline: [
          { at: minutes(lastSaturday, -6 * 24 * 60).toISOString(), kind: 'RUN', label: 'The run was announced' },
          { at: minutes(lastSaturday, -30).toISOString(), kind: 'RUN', label: 'The trail went live' },
          { at: lastSaturday.toISOString(), kind: 'RUN', label: 'The pack set off' },
          { at: minutes(lastSaturday, 95).toISOString(), kind: 'RUN', label: 'The pack came in' },
          { at: minutes(lastSaturday, 140).toISOString(), kind: 'RUN', label: 'The Circle closed' },
          { at: lockedAt.toISOString(), kind: 'RUN', label: 'The run was archived' },
        ],
      },
    });
  }

  const upcoming = await ensureRun(
    abujaId,
    412,
    {
      ...lagosTime,
      city: 'Abuja',
      startsAt: nextSaturday,
      title: 'Aso Rock Ramble',
      description: 'Hills, rocks and a beer check the hares refuse to describe. Bring a torch.',
      theme: 'Bring a torch',
      status: RunStatus.SCHEDULED,
      visibility: RunVisibility.PUBLIC,
      meetingPointName: 'Millennium Park main gate',
      meetingAddress: 'Millennium Park, Maitama, Abuja',
      capacity: 40,
      hashCash: '₦2,000',
      scheduledAt: minutes(now, -2 * 24 * 60),
    },
    [
      { id: officers[1].id, isLead: true },
      { id: officers[3].id, isLead: false },
    ],
    CapsuleStatus.PREPARING,
  );
  if (upcoming.created) {
    for (const [officer, rsvpStatus] of [
      [officers[0], RsvpStatus.GOING],
      [officers[2], RsvpStatus.MAYBE],
      [officers[4], RsvpStatus.GOING],
    ] as const) {
      await prisma.participation.create({
        data: { runId: upcoming.run.id, userId: officer.id, rsvpStatus, homeKennelId: abujaId },
      });
    }
  }

  await ensureRun(
    abujaId,
    413,
    {
      ...lagosTime,
      city: 'Abuja',
      startsAt: minutes(nextSaturday, 7 * 24 * 60),
      title: 'Red Dress Run',
      description: 'Draft: route still being argued over.',
      runType: RunType.RED_DRESS,
      status: RunStatus.DRAFT,
      visibility: RunVisibility.PUBLIC,
      meetingPointName: 'To be confirmed',
    },
    [{ id: officers[0].id, isLead: true }],
    CapsuleStatus.PLANNED,
  );

  // Demo trails. The upcoming run's trail is still hidden (it releases when the
  // run starts); the archived run's trail is released history.
  async function ensureTrail(
    runId: string,
    name: string,
    data: Omit<Prisma.TrailUncheckedCreateInput, 'runId' | 'name'>,
    hares: { id: string; isLead: boolean }[],
  ) {
    const existing = await prisma.trail.findFirst({ where: { runId, name } });
    if (existing) return { trail: existing, created: false };
    const trail = await prisma.trail.create({
      data: { runId, name, ...data, hares: { create: hares.map((h) => ({ userId: h.id, isLead: h.isLead })) } },
    });
    return { trail, created: true };
  }

  // A loop around Millennium Park, Abuja.
  const abujaRoute = [
    [7.4913, 9.0658],
    [7.4952, 9.0689],
    [7.4998, 9.0721],
    [7.5041, 9.0703],
    [7.5023, 9.0662],
    [7.4961, 9.0641],
    [7.4913, 9.0658],
  ];

  const hiddenTrail = await ensureTrail(
    upcoming.run.id,
    'Main Trail',
    {
      style: TrailStyle.DEAD_HARE,
      status: TrailStatus.HIDDEN,
      estimatedDistanceM: 7400,
      estimatedDurationMin: 75,
      terrain: 'Rock, scrub and one very optimistic hill',
      notes: 'Beer check behind the water tower. Do not tell the pack.',
      routeGeoJson: { type: 'LineString', coordinates: abujaRoute },
      startLatitude: 9.0658,
      startLongitude: 7.4913,
      finishLatitude: 9.0658,
      finishLongitude: 7.4913,
      releaseMode: ReleaseMode.AT_RUN_START,
      lockedAt: minutes(now, -60),
      lockedById: officers[1].id,
      safetyReviewedAt: minutes(now, -60),
      safetyReviewedById: officers[1].id,
    },
    [
      { id: officers[1].id, isLead: true },
      { id: officers[3].id, isLead: false },
    ],
  );
  if (hiddenTrail.created) {
    const trailId = hiddenTrail.trail.id;
    await prisma.waypoint.createMany({
      data: [
        { trailId, kind: WaypointKind.START, label: 'Park gate', latitude: 9.0658, longitude: 7.4913, sequence: 0 },
        { trailId, kind: WaypointKind.CHECKPOINT, label: 'First check', latitude: 9.0689, longitude: 7.4952, sequence: 1 },
        { trailId, kind: WaypointKind.HAZARD, label: 'Busy road crossing', latitude: 9.0721, longitude: 7.4998, sequence: 2, notes: 'Marshal here' },
        { trailId, kind: WaypointKind.REGROUP, label: 'Regroup on the rocks', latitude: 9.0703, longitude: 7.5041, sequence: 3 },
        { trailId, kind: WaypointKind.FINISH, label: 'On In', latitude: 9.0658, longitude: 7.4913, sequence: 4 },
      ],
    });
    await prisma.beerCheck.create({
      data: { trailId, name: 'Water tower beer check', latitude: 9.0662, longitude: 7.5023, sequence: 0, notes: 'Two crates, one cooler' },
    });
    await prisma.digitalChalkSymbol.createMany({
      data: [
        { trailId, symbol: ChalkSymbol.ON_ON, latitude: 9.0668, longitude: 7.4925, placedById: officers[1].id },
        { trailId, symbol: ChalkSymbol.CHECK, latitude: 9.0689, longitude: 7.4952, placedById: officers[1].id },
        { trailId, symbol: ChalkSymbol.FALSE_TRAIL, latitude: 9.0698, longitude: 7.4971, placedById: officers[1].id },
        { trailId, symbol: ChalkSymbol.BEER_NEAR, latitude: 9.0665, longitude: 7.5011, placedById: officers[3].id },
        { trailId, symbol: ChalkSymbol.ON_IN, latitude: 9.0659, longitude: 7.4917, placedById: officers[1].id },
      ],
    });
  }

  const pastTrail = await ensureTrail(
    past.run.id,
    'Main Trail',
    {
      style: TrailStyle.DEAD_HARE,
      status: TrailStatus.ARCHIVED,
      estimatedDistanceM: 6800,
      estimatedDurationMin: 70,
      terrain: 'Lake shore and shiggy',
      routeGeoJson: {
        type: 'LineString',
        coordinates: [
          [7.4165, 9.0723],
          [7.4208, 9.0754],
          [7.4251, 9.0736],
          [7.4223, 9.0698],
          [7.4165, 9.0723],
        ],
      },
      startLatitude: 9.0723,
      startLongitude: 7.4165,
      finishLatitude: 9.0723,
      finishLongitude: 7.4165,
      releaseMode: ReleaseMode.AT_RUN_START,
      lockedAt: minutes(lastSaturday, -120),
      lockedById: officers[1].id,
      releasedAt: lastSaturday,
      releasedById: officers[1].id,
    },
    [{ id: officers[1].id, isLead: true }],
  );
  if (pastTrail.created) {
    await prisma.beerCheck.create({
      data: { trailId: pastTrail.trail.id, name: 'Lakeside beer check', latitude: 9.0754, longitude: 7.4208, sequence: 0 },
    });
  }

  const lagosRun = await ensureRun(
    lagosId,
    288,
    {
      ...lagosTime,
      city: 'Lagos',
      startsAt: nextSaturday,
      title: 'Lekki Lagoon Crawl',
      description: 'Members-only shiggy along the lagoon.',
      status: RunStatus.SCHEDULED,
      visibility: RunVisibility.MEMBERS_ONLY,
      meetingPointName: 'Lekki Conservation Centre gate',
      scheduledAt: minutes(now, -24 * 60),
    },
    [{ id: officers[6].id, isLead: true }],
    CapsuleStatus.PREPARING,
  );
  if (lagosRun.created) {
    await prisma.participation.create({
      data: { runId: lagosRun.run.id, userId: officers[5].id, rsvpStatus: RsvpStatus.GOING, homeKennelId: lagosId },
    });
  }

  const glossary: [string, string][] = [
    ['On On', 'The call hashers shout when they are on the true trail.'],
    ['Hare', 'The person who lays the trail for the pack to follow.'],
    ['Virgin', 'Someone at their very first hash run.'],
    ['Circle', 'The gathering after the run for awards, songs and down-downs.'],
    ['Down-Down', 'A drink downed in the Circle, usually as a (dis)honour.'],
    ['Beer Check', 'A stop on trail where refreshments are waiting.'],
    ['Mismanagement', 'The kennel committee: Grand Master, Religious Advisor, Hash Cash and friends.'],
    ['Shiggy', 'Mud, swamp, thorns or anything else unpleasant on trail.'],
  ];
  for (const [term, definition] of glossary) {
    const found = await prisma.glossaryTerm.findFirst({ where: { kennelId: null, term } });
    if (!found) await prisma.glossaryTerm.create({ data: { term, definition } });
  }

  console.log('\nSeed complete.');
  console.log(`  Admin:   ${env.seedAdminEmail} / ${env.seedAdminPassword}`);
  console.log(`  Hasher:  ${env.seedUserEmail} / ${env.seedUserPassword}`);
  console.log(`  Officers: officer1..10@hcp.test / ${env.seedUserPassword}`);
  console.log(`  Kennels: ${kennels.length} (2 verified with 5 mismanagement each)\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
