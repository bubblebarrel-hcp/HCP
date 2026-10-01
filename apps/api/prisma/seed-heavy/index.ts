import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AccountStatus,
  AiSuggestionKind,
  AiSuggestionStatus,
  AppointmentMethod,
  CapsuleStatus,
  ChalkSymbol,
  CheckInMethod,
  CommentStatus,
  FollowTargetType,
  Gender,
  HareOfferStatus,
  InvitationMethod,
  KennelStatus,
  MediaKind,
  MediaModerationMode,
  MediaTargetType,
  MembershipStatus,
  MembershipTimelineType,
  MembershipType,
  ModerationState,
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  PostStatus,
  Prisma,
  PrismaClient,
  ProfileVisibility,
  ReelStatus,
  ReelVisibility,
  ReleaseMode,
  ReportContributorRole,
  RoleAssignmentStatus,
  RsvpStatus,
  RunStatus,
  RunType,
  RunVisibility,
  ScopedRole,
  StoryCategory,
  StorySource,
  SubjectType,
  SupplementalType,
  TrailReportStatus,
  TrailStatus,
  TrailStyle,
  TrustLevel,
  UploadState,
  VerificationLevel,
  WaypointKind,
} from '@prisma/client';
import { env } from '../../src/config/env';
import { encryptField } from '../../src/utils/field-crypto';
import { rebuildPassport } from '../../src/services/passport.service';
import { generateBranding, generatePhotos, generateVideos, type SeedImage } from './assets';
import {
  AWARD_TITLES,
  BIOS,
  COMMENTS,
  HASH_HANDLES,
  NAME_POOLS,
  PHOTO_CAPTIONS,
  POSTS,
  REEL_CAPTIONS,
  REJECT_REASONS,
  REPLIES,
  REVIEW_COMMENTS,
  RUN_BLURBS,
  SONGS,
  STORY_BITS,
  THEMES,
  WEATHER,
  reportBody,
  runTitle,
} from './data';

// HEAVY SEED. Run after the base seed (`npm run prisma:seed`), with
// `npm run prisma:seed:heavy`.
//
// It fills a local database with enough of everything to exercise each feature
// without hand-building state first: ~100 hashers across ten kennels, every
// membership status, a few hundred runs in every lifecycle state, hidden trails
// with each release mode, trail reports at every stage, Run Capsules, photos,
// reels, posts and a dense social graph.
//
// Safe by construction:
//   - refuses to run unless DATABASE_URL points at this machine;
//   - one transaction, so a failure leaves nothing half-written;
//   - writes a marker, so a second run is a no-op. To start over:
//       npx prisma migrate reset && npm run prisma:seed && npm run prisma:seed:heavy
//   - deterministic: the same seed produces the same database (dates move with "today").

const MARKER = 'seed.heavy.v1';

const url = process.env.DATABASE_URL ?? '';
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
})();
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) && !process.env.SEED_HEAVY_ALLOW_REMOTE) {
  console.error(`Refusing to run the heavy seed against "${host || 'an unparseable DATABASE_URL'}": it only runs against a local database.`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// ───────────────────────── small helpers ─────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261001);
const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
const chance = (p: number) => rnd() < p;
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
function shuffled<T>(a: readonly T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function sample<T>(a: readonly T[], n: number): T[] {
  return shuffled(a).slice(0, Math.max(0, Math.min(n, a.length)));
}
function weighted<T>(items: readonly [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r <= 0) return item;
  }
  return items[items.length - 1][0];
}

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);
const plus = (d: Date, minutes: number) => new Date(d.getTime() + minutes * MIN);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const pad2 = (n: number) => String(n).padStart(2, '0');
const mediaUrl = (storageKey: string) => `${env.apiBaseUrl}/uploads/${storageKey}`;

function* chunks<T>(rows: T[], size = 1000) {
  for (let i = 0; i < rows.length; i += size) yield rows.slice(i, i + size);
}

type Tx = Prisma.TransactionClient;
interface U {
  id: string;
  handle: string | null;
  first: string;
}
const label = (u: U) => u.handle ?? `Just ${u.first}`;

const DOW: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

// Local start time per kennel, expressed in UTC.
const START_UTC: Record<string, [number, number]> = {
  'abuja-h3-abuja': [14, 0],
  'lagos-h3-lagos': [14, 0],
  'ph-h3-port-harcourt': [14, 30],
  'accra-h3-accra': [17, 0],
  'nairobi-h3-nairobi': [12, 0],
  'kigali-h3-kigali': [13, 0],
  'joburg-h3-johannesburg': [15, 30],
  'enugu-h3-enugu': [14, 0],
  'kumasi-h3-kumasi': [15, 0],
  'ibadan-h3-ibadan': [14, 0],
};

function meetingDate(kennelSlug: string, meetingDay: string, offsetWeeks: number) {
  const [h, m] = START_UTC[kennelSlug] ?? [14, 0];
  const target = DOW[meetingDay] ?? 6;
  const delta = (target - now.getUTCDay() + 7) % 7 || 7; // next one, strictly after today
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + delta + offsetWeeks * 7, h, m));
}

function haversineM(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// A closed loop around a centre, as [lng, lat] like the base seed's routes.
function loopRoute(lat: number, lng: number) {
  const points = int(7, 10);
  const radius = 0.006 + rnd() * 0.009;
  const coords: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const r = radius * (0.75 + rnd() * 0.5);
    coords.push([lng + Math.cos(a) * r, lat + Math.sin(a) * r * 0.9]);
  }
  coords.push(coords[0]);
  let dist = 0;
  for (let i = 1; i < coords.length; i++) dist += haversineM(coords[i - 1], coords[i]);
  return { coords, distanceM: Math.round(dist * 1.18) };
}

// ───────────────────────── kennel plan ─────────────────────────

interface NewKennel {
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
  archivedAt?: Date;
}

const EXTRA_KENNELS: NewKennel[] = [
  {
    name: 'Kumasi Hash House Harriers', shortName: 'Kumasi H3', slug: 'kumasi-h3-kumasi', country: 'Ghana', stateProvince: 'Ashanti', city: 'Kumasi',
    timeZone: 'Africa/Accra', latitude: 6.6885, longitude: -1.6244, meetingDay: 'Saturday', motto: 'Garden City, wild trails',
    description: 'A new kennel with four mismanagement already in place and a verification request waiting for the platform.', status: KennelStatus.PENDING_VERIFICATION,
  },
  {
    name: 'Ibadan Hash House Harriers', shortName: 'Ibadan H3', slug: 'ibadan-h3-ibadan', country: 'Nigeria', stateProvince: 'Oyo', city: 'Ibadan',
    timeZone: 'Africa/Lagos', latitude: 7.3775, longitude: 3.947, meetingDay: 'Sunday', motto: 'Seven hills, one pack',
    description: 'Still gathering its founding mismanagement. Three of the four needed so far.', status: KennelStatus.PENDING_VERIFICATION,
  },
  {
    name: 'Warri Hash House Harriers', shortName: 'Warri H3', slug: 'warri-h3-warri', country: 'Nigeria', stateProvince: 'Delta', city: 'Warri',
    timeZone: 'Africa/Lagos', latitude: 5.5167, longitude: 5.75, meetingDay: 'Saturday', motto: 'Gone but not forgotten',
    description: 'Archived. Kept as history: a kennel with a past is archived, never deleted.', status: KennelStatus.ARCHIVED, archivedAt: daysAgo(210),
  },
];

const BRAND_COLORS: Record<string, [string, string]> = {
  'abuja-h3-abuja': ['#F4511E', '#171717'],
  'lagos-h3-lagos': ['#0E7C86', '#F4F1E8'],
  'ph-h3-port-harcourt': ['#6D4C41', '#F2B134'],
  'accra-h3-accra': ['#C0392B', '#F2B134'],
  'nairobi-h3-nairobi': ['#2E7D32', '#F4F1E8'],
  'kigali-h3-kigali': ['#1565C0', '#F2B134'],
  'joburg-h3-johannesburg': ['#7B1FA2', '#F4F1E8'],
  'enugu-h3-enugu': ['#455A64', '#F4511E'],
  'kumasi-h3-kumasi': ['#E65100', '#171717'],
  'ibadan-h3-ibadan': ['#AD1457', '#F4F1E8'],
  'warri-h3-warri': ['#546E7A', '#CFD8DC'],
};
const hexRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

// How many of the ~100 hashers call each kennel home.
const HOME_WEIGHTS: [string, number][] = [
  ['abuja-h3-abuja', 22], ['lagos-h3-lagos', 20], ['ph-h3-port-harcourt', 10], ['accra-h3-accra', 10], ['nairobi-h3-nairobi', 9],
  ['kigali-h3-kigali', 7], ['joburg-h3-johannesburg', 8], ['enugu-h3-enugu', 4], ['kumasi-h3-kumasi', 4], ['ibadan-h3-ibadan', 2],
];
const POOL_FOR_COUNTRY = (country: string) => NAME_POOLS[country] ?? NAME_POOLS.Nigeria;

const OFFICER_TITLES = ['Grand Master', 'Joint Master', 'Religious Advisor', 'Hash Cash', 'On Sec'];
const OFFICER_PERMISSIONS: Record<string, string[]> = {
  'Grand Master': ['membership.review', 'membership.suspend', 'membership.remove', 'membership.invite', 'officer.appoint', 'kennel.manage'],
  'Joint Master': ['membership.review', 'membership.suspend'],
  'On Sec': ['membership.review', 'membership.invite'],
};

interface KennelCtx {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  city: string;
  country: string;
  timeZone: string;
  latitude: number;
  longitude: number;
  meetingDay: string;
  status: KennelStatus;
  defaultRunVisibility: RunVisibility;
  members: U[];
  officers: U[];
  scribe?: U;
  assistantScribe?: U;
  moderator?: U;
  photographer?: U;
  admin?: U;
  runs: RunCtx[];
}

interface RunCtx {
  id: string;
  kennel: KennelCtx;
  number: number;
  title: string;
  startsAt: Date;
  status: RunStatus;
  visibility: RunVisibility;
  past: boolean;
  hares: U[];
  attendees: U[];
  lat: number;
  lng: number;
  reportId?: string;
  reportPublished?: boolean;
  capsuleId?: string;
  capsulePublished?: boolean;
}

// ───────────────────────── main ─────────────────────────

async function main() {
  const already = await prisma.platformSetting.findUnique({ where: { key: MARKER } });
  if (already) {
    console.log('Heavy seed already applied to this database. To start over:');
    console.log('  npx prisma migrate reset && npm run prisma:seed && npm run prisma:seed:heavy');
    return;
  }

  const baseKennel = await prisma.kennel.findUnique({ where: { slug: 'abuja-h3-abuja' } });
  if (!baseKennel) {
    console.error('The base seed has not run. Run `npm run prisma:seed` first.');
    process.exit(1);
  }

  console.log('Drawing placeholder media into uploads/seed ...');
  const photos = generatePhotos();
  const videos = generateVideos(12);
  console.log(`  ${photos.length} photos, ${videos.length} videos`);
  const passwordHash = await bcrypt.hash(env.seedUserPassword, 10);

  const summary = { users: 0, runs: 0, participations: 0, reports: 0, photos: 0, reels: 0, posts: 0, comments: 0, likes: 0, follows: 0 };
  let allUserIds: string[] = [];
  let plainEmail = '';
  let gmEmails: string[] = [];

  console.log('Seeding (one transaction) ...');
  await prisma.$transaction(
    async (db) => {
      const admin = await db.user.findUniqueOrThrow({ where: { email: env.seedAdminEmail } });
      const demoHasher = await db.user.findUniqueOrThrow({ where: { email: env.seedUserEmail } });

      // ── kennels ───────────────────────────────────────────────
      for (const k of EXTRA_KENNELS) {
        await db.kennel.upsert({
          where: { slug: k.slug },
          update: {},
          create: {
            name: k.name, shortName: k.shortName, slug: k.slug, country: k.country, stateProvince: k.stateProvince, city: k.city,
            timeZone: k.timeZone, latitude: k.latitude, longitude: k.longitude, meetingDay: k.meetingDay, motto: k.motto,
            description: k.description, status: k.status, archivedAt: k.archivedAt ?? null, verificationLevel: VerificationLevel.PENDING,
            defaultRunVisibility: RunVisibility.PUBLIC, createdById: admin.id, foundedOn: daysAgo(400),
          },
        });
      }

      const kennelRows = await db.kennel.findMany({ where: { slug: { in: Object.keys(BRAND_COLORS) } } });
      const kennels = new Map<string, KennelCtx>();
      for (const [index, k] of kennelRows.entries()) {
        const [primary, secondary] = BRAND_COLORS[k.slug];
        const brand = generateBranding(k.slug, index, hexRgb(primary), hexRgb(secondary));
        const moderation =
          k.slug === 'lagos-h3-lagos'
            ? MediaModerationMode.OFFICER_APPROVAL
            : k.slug === 'accra-h3-accra'
              ? MediaModerationMode.COMMUNITY_REPORTING
              : k.slug === 'nairobi-h3-nairobi'
                ? MediaModerationMode.AI_ASSISTED
                : undefined;
        const verified = ['accra-h3-accra', 'nairobi-h3-nairobi', 'ph-h3-port-harcourt'].includes(k.slug);
        await db.kennel.update({
          where: { id: k.id },
          data: {
            logoUrl: mediaUrl(brand.logo.storageKey),
            bannerUrl: mediaUrl(brand.banner.storageKey),
            bannerPosition: pick(['50% 50%', '50% 30%', '50% 70%']),
            primaryColor: primary,
            secondaryColor: secondary,
            landingMessage: `Welcome to ${k.shortName}. ${k.motto}.`,
            foundedOn: k.foundedOn ?? daysAgo(int(500, 4000)),
            ...(moderation ? { mediaModerationMode: moderation } : {}),
            ...(verified ? { verificationLevel: VerificationLevel.OFFICER_VERIFIED, verifiedAt: daysAgo(120) } : {}),
          },
        });
        kennels.set(k.slug, {
          id: k.id, slug: k.slug, name: k.name, shortName: k.shortName, city: k.city, country: k.country, timeZone: k.timeZone,
          latitude: k.latitude ?? 0, longitude: k.longitude ?? 0, meetingDay: k.meetingDay ?? 'Saturday', status: k.status,
          defaultRunVisibility: k.defaultRunVisibility, members: [], officers: [], runs: [],
        });
      }
      const K = (slug: string) => kennels.get(slug)!;
      const activeKennels = [...kennels.values()].filter((k) => k.status === KennelStatus.ACTIVE);

      // ── people ────────────────────────────────────────────────
      const handles = shuffled(HASH_HANDLES);
      let handleIdx = 0;
      const people: { u: U; email: string; home: string; country: string }[] = [];
      const userRows: Prisma.UserCreateManyInput[] = [];
      const personRows: Prisma.PersonProfileCreateManyInput[] = [];
      const passportRows: Prisma.HashPassportCreateManyInput[] = [];
      const hashNameRows: Prisma.HashNameCreateManyInput[] = [];

      const homePlan: string[] = [];
      for (const [slug, n] of HOME_WEIGHTS) for (let i = 0; i < n; i++) homePlan.push(slug);
      for (const [i, slug] of shuffled(homePlan).entries()) {
        const kennel = K(slug);
        const pool = POOL_FOR_COUNTRY(kennel.country);
        const female = chance(0.48);
        const first = pick(female ? pool.female : pool.male);
        const last = pick(pool.last);
        const named = chance(0.68) && handleIdx < handles.length;
        const handle = named ? handles[handleIdx++] : null;
        const id = randomUUID();
        const email = `member${pad2(i + 1)}@hcp.test`;
        const createdAt = daysAgo(int(40, 900));
        userRows.push({
          id, email, passwordHash, hashHandle: handle, trustLevel: chance(0.6) ? TrustLevel.VERIFIED_MEMBER : TrustLevel.VERIFIED_EMAIL,
          emailVerifiedAt: createdAt, termsAcceptedAt: createdAt, bio: pick(BIOS), homeKennelId: kennel.id,
          profileVisibility: weighted<ProfileVisibility>([[ProfileVisibility.PUBLIC, 5], [ProfileVisibility.MEMBERS_ONLY, 4], [ProfileVisibility.PRIVATE, 1]]),
          lastLoginAt: daysAgo(int(0, 20)), createdAt,
        });
        personRows.push({
          userId: id, firstName: first, lastName: last, dateOfBirth: encryptField(`${int(1965, 2000)}-${pad2(int(1, 12))}-${pad2(int(1, 28))}`),
          gender: female ? Gender.FEMALE : Gender.MALE, phone: encryptField(`+2348${int(10000000, 99999999)}`), nationality: kennel.country,
          country: kennel.country, stateProvince: kennel.city, city: kennel.city, languages: ['English'],
          emergencyContactName: encryptField('Seed Contact'), emergencyContactPhone: encryptField('+2348000000001'),
          emergencyContactRelationship: encryptField('Sibling'),
        });
        passportRows.push({ userId: id });
        if (handle) hashNameRows.push({ userId: id, name: handle, isPrimary: true, kennelId: kennel.id, bestowedAt: daysAgo(int(20, 700)) });
        people.push({ u: { id, handle, first }, email, home: slug, country: kennel.country });
      }

      // Three accounts in states an admin has to be able to see and a login has to refuse.
      const edge: [string, string, AccountStatus, boolean][] = [
        ['unverified', 'Ngozi', AccountStatus.PENDING_VERIFICATION, false],
        ['suspended', 'Emeka', AccountStatus.SUSPENDED, true],
        ['deactivated', 'Bisi', AccountStatus.DEACTIVATED, true],
      ];
      for (const [tag, first, status, verified] of edge) {
        const id = randomUUID();
        userRows.push({
          id, email: `${tag}@hcp.test`, passwordHash, status, trustLevel: verified ? TrustLevel.VERIFIED_EMAIL : TrustLevel.UNVERIFIED,
          emailVerifiedAt: verified ? daysAgo(100) : null, termsAcceptedAt: daysAgo(100), deactivatedAt: status === AccountStatus.DEACTIVATED ? daysAgo(10) : null,
        });
        personRows.push({
          userId: id, firstName: first, lastName: 'Edgecase', dateOfBirth: encryptField('1990-01-01'), gender: Gender.OTHER, phone: encryptField('+2348000000002'),
          nationality: 'Nigeria', country: 'Nigeria', stateProvince: 'Lagos', city: 'Lagos', languages: ['English'],
          emergencyContactName: encryptField('Seed Contact'), emergencyContactPhone: encryptField('+2348000000001'), emergencyContactRelationship: encryptField('Sibling'),
        });
        passportRows.push({ userId: id });
      }

      for (const part of chunks(userRows)) await db.user.createMany({ data: part });
      for (const part of chunks(personRows)) await db.personProfile.createMany({ data: part });
      for (const part of chunks(passportRows)) await db.hashPassport.createMany({ data: part });
      for (const part of chunks(hashNameRows)) await db.hashName.createMany({ data: part });
      summary.users = people.length + edge.length;

      // The base seed's ten officers and demo hasher join the pool at their kennels.
      const officers = await db.user.findMany({ where: { email: { startsWith: 'officer' } }, orderBy: { email: 'asc' }, include: { person: { select: { firstName: true } } } });
      const officerU = (email: string): U | undefined => {
        const o = officers.find((x) => x.email === email);
        return o ? { id: o.id, handle: o.hashHandle, first: o.person?.firstName ?? 'Officer' } : undefined;
      };
      const abujaOfficers = [1, 2, 3, 4, 5].map((n) => officerU(`officer${n}@hcp.test`)).filter(Boolean) as U[];
      const lagosOfficers = [6, 7, 8, 9, 10].map((n) => officerU(`officer${n}@hcp.test`)).filter(Boolean) as U[];
      K('abuja-h3-abuja').members.push(...abujaOfficers);
      K('lagos-h3-lagos').members.push(...lagosOfficers);
      for (const p of people) K(p.home).members.push(p.u);
      for (const k of kennels.values()) allUserIds.push(...k.members.map((m) => m.id));
      allUserIds.push(demoHasher.id);
      const everyone = [...people.map((p) => p.u), ...abujaOfficers, ...lagosOfficers, { id: demoHasher.id, handle: null, first: 'Chidi' }];

      // ── memberships ──────────────────────────────────────────
      const membershipRows: Prisma.MembershipCreateManyInput[] = [];
      const timelineRows: Prisma.MembershipTimelineEntryCreateManyInput[] = [];
      const memberTypeFor = () =>
        weighted<MembershipType>([[MembershipType.FULL, 72], [MembershipType.ASSOCIATE, 10], [MembershipType.LIFE, 4], [MembershipType.HONORARY, 2], [MembershipType.VIRGIN, 5]]);
      const addMembership = (
        userId: string, kennelId: string, status: MembershipStatus, type: MembershipType, extra: Partial<Prisma.MembershipCreateManyInput> = {},
        timeline: [MembershipTimelineType, MembershipStatus | null, MembershipStatus | null, string | null, Date][] = [],
      ) => {
        const id = randomUUID();
        membershipRows.push({ id, userId, kennelId, status, type, ...extra });
        for (const [type2, from, to, note, at] of timeline) {
          timelineRows.push({ membershipId: id, type: type2, fromStatus: from, toStatus: to, note, occurredAt: at, actorId: null });
        }
        return id;
      };
      const activeAt = new Map<string, Set<string>>(); // kennelId -> userIds with any membership
      const hold = (kennelId: string, userId: string) => {
        if (!activeAt.has(kennelId)) activeAt.set(kennelId, new Set());
        activeAt.get(kennelId)!.add(userId);
      };

      // Existing memberships from the base seed (officers, demo hasher) are not duplicated.
      const existingMemberships = await db.membership.findMany({ select: { userId: true, kennelId: true } });
      for (const m of existingMemberships) hold(m.kennelId, m.userId);

      for (const p of people) {
        const kennel = K(p.home);
        const start = daysAgo(int(30, 800));
        addMembership(p.u.id, kennel.id, MembershipStatus.ACTIVE, memberTypeFor(), { isHomeKennel: true, startDate: start, approvedAt: start, approvedById: admin.id }, [
          [MembershipTimelineType.REQUESTED, null, MembershipStatus.PENDING_REVIEW, null, plus(start, -2 * 24 * 60)],
          [MembershipTimelineType.APPROVED, MembershipStatus.PENDING_REVIEW, MembershipStatus.ACTIVE, 'Seeded', start],
        ]);
        hold(kennel.id, p.u.id);
        // About a third also run with a second kennel as a visitor member.
        if (chance(0.33)) {
          const other = pick(activeKennels.filter((k) => k.id !== kennel.id));
          if (!activeAt.get(other.id)?.has(p.u.id)) {
            const s = daysAgo(int(10, 300));
            addMembership(p.u.id, other.id, MembershipStatus.ACTIVE, MembershipType.VISITING, { startDate: s, approvedAt: s }, [
              [MembershipTimelineType.APPROVED, MembershipStatus.PENDING_REVIEW, MembershipStatus.ACTIVE, 'Visiting member', s],
            ]);
            hold(other.id, p.u.id);
            other.members.push(p.u);
          }
        }
      }

      // Every other status, at every active kennel, so each review queue and tab has rows.
      const nonActive: [MembershipStatus, MembershipTimelineType, string, number][] = [
        [MembershipStatus.PENDING_REVIEW, MembershipTimelineType.REQUESTED, 'Would like to run with the pack', 2],
        [MembershipStatus.SUSPENDED, MembershipTimelineType.SUSPENSION, 'Repeated down-down avoidance', 1],
        [MembershipStatus.INACTIVE, MembershipTimelineType.TYPE_CHANGED, 'No run in six months', 1],
        [MembershipStatus.REJECTED, MembershipTimelineType.REJECTED, 'Could not verify identity', 1],
        [MembershipStatus.WITHDRAWN, MembershipTimelineType.WITHDRAWAL, 'Changed my mind', 1],
        [MembershipStatus.RESIGNED, MembershipTimelineType.RESIGNATION, 'Moved cities', 1],
        [MembershipStatus.REMOVED, MembershipTimelineType.REMOVAL, 'Conduct on trail', 1],
      ];
      for (const kennel of [...activeKennels, K('kumasi-h3-kumasi'), K('ibadan-h3-ibadan')]) {
        const candidates = shuffled(everyone.filter((u) => !activeAt.get(kennel.id)?.has(u.id)));
        let ci = 0;
        for (const [status, tType, note, count] of nonActive) {
          for (let n = 0; n < count && ci < candidates.length; n++, ci++) {
            const u = candidates[ci];
            const at = daysAgo(int(3, 160));
            addMembership(
              u.id, kennel.id, status, MembershipType.FULL,
              {
                ...(status === MembershipStatus.SUSPENDED ? { suspensionReason: note, suspendedUntil: plus(now, int(2, 20) * 24 * 60) } : {}),
                ...(status === MembershipStatus.RESIGNED || status === MembershipStatus.REMOVED ? { endDate: at } : {}),
              },
              [[MembershipTimelineType.REQUESTED, null, MembershipStatus.PENDING_REVIEW, null, plus(at, -3 * 24 * 60)], ...(status === MembershipStatus.PENDING_REVIEW ? [] : [[tType, MembershipStatus.PENDING_REVIEW, status, note, at] as [MembershipTimelineType, MembershipStatus | null, MembershipStatus | null, string | null, Date]])],
            );
            hold(kennel.id, u.id);
          }
        }
      }
      // The archived kennel kept a few people on record.
      for (const u of sample(everyone, 6)) {
        const warri = kennelRows.find((k) => k.slug === 'warri-h3-warri')!;
        addMembership(u.id, warri.id, MembershipStatus.RESIGNED, MembershipType.FULL, { endDate: daysAgo(220) }, [
          [MembershipTimelineType.ARCHIVED, MembershipStatus.ACTIVE, MembershipStatus.RESIGNED, 'Kennel archived', daysAgo(210)],
        ]);
      }
      for (const part of chunks(membershipRows)) await db.membership.createMany({ data: part });
      for (const part of chunks(timelineRows)) await db.membershipTimelineEntry.createMany({ data: part });

      // ── officers, roles ──────────────────────────────────────
      async function seatOfficers(kennel: KennelCtx, seated: U[], count: number) {
        for (const [i, title] of OFFICER_TITLES.slice(0, count).entries()) {
          const position = await db.officerPosition.upsert({
            where: { kennelId_title: { kennelId: kennel.id, title } },
            create: { kennelId: kennel.id, title, sortOrder: i, isMismanagement: true, termMonths: 12, permissions: OFFICER_PERMISSIONS[title] ?? [] },
            update: { permissions: OFFICER_PERMISSIONS[title] ?? [] },
          });
          const person = seated[i];
          if (!person) continue;
          const m = await db.membership.findFirst({ where: { kennelId: kennel.id, userId: person.id, status: MembershipStatus.ACTIVE } });
          const exists = await db.officerAppointment.findFirst({ where: { kennelId: kennel.id, positionId: position.id, userId: person.id } });
          if (!exists) {
            await db.officerAppointment.create({
              data: {
                kennelId: kennel.id, positionId: position.id, userId: person.id, membershipId: m?.id, method: pick([AppointmentMethod.ELECTED, AppointmentMethod.APPOINTED, AppointmentMethod.ACCLAIMED]),
                status: RoleAssignmentStatus.ACTIVE, startDate: daysAgo(int(60, 300)),
              },
            });
          }
          if (!kennel.officers.some((o) => o.id === person.id)) kennel.officers.push(person);
        }
      }
      const officerPlan: [string, number][] = [
        ['ph-h3-port-harcourt', 5], ['accra-h3-accra', 5], ['nairobi-h3-nairobi', 5], ['kigali-h3-kigali', 5], ['joburg-h3-johannesburg', 5],
        ['enugu-h3-enugu', 2], ['kumasi-h3-kumasi', 4], ['ibadan-h3-ibadan', 3],
      ];
      for (const [slug, count] of officerPlan) {
        const k = K(slug);
        await seatOfficers(k, k.members.filter((m) => people.some((p) => p.u.id === m.id && p.home === slug)).slice(0, count), count);
      }
      K('abuja-h3-abuja').officers.push(...abujaOfficers);
      K('lagos-h3-lagos').officers.push(...lagosOfficers);

      // A past Grand Master at Abuja, so the leadership timeline has history.
      {
        const abuja = K('abuja-h3-abuja');
        const gm = await db.officerPosition.findUniqueOrThrow({ where: { kennelId_title: { kennelId: abuja.id, title: 'Grand Master' } } });
        const former = abuja.members.find((m) => !abuja.officers.some((o) => o.id === m.id));
        if (former) {
          await db.officerAppointment.create({
            data: {
              kennelId: abuja.id, positionId: gm.id, userId: former.id, method: AppointmentMethod.ELECTED, status: RoleAssignmentStatus.TERM_ENDED,
              startDate: daysAgo(500), endDate: daysAgo(160), endedReason: 'Term ended',
            },
          });
        }
      }

      const roleRows: Prisma.RoleAssignmentCreateManyInput[] = [];
      const nonOfficers = (k: KennelCtx) => k.members.filter((m) => !k.officers.some((o) => o.id === m.id));
      for (const k of kennels.values()) {
        if (k.slug === 'warri-h3-warri') continue;
        k.admin = k.officers[0];
        if (k.admin && k.slug !== 'abuja-h3-abuja') roleRows.push({ userId: k.admin.id, role: ScopedRole.KENNEL_ADMIN, kennelId: k.id });
        const free = nonOfficers(k);
        if (k.slug === 'abuja-h3-abuja') k.scribe = abujaOfficers[2];
        else if (free[0]) k.scribe = free[0];
        if (k.scribe && k.slug !== 'abuja-h3-abuja') roleRows.push({ userId: k.scribe.id, role: ScopedRole.SCRIBE, kennelId: k.id });
        k.assistantScribe = free[1];
        if (k.assistantScribe) roleRows.push({ userId: k.assistantScribe.id, role: ScopedRole.ASSISTANT_SCRIBE, kennelId: k.id });
        k.moderator = free[2];
        if (k.moderator && ['abuja-h3-abuja', 'lagos-h3-lagos', 'accra-h3-accra'].includes(k.slug)) roleRows.push({ userId: k.moderator.id, role: ScopedRole.MODERATOR, kennelId: k.id });
        k.photographer = free[3];
        if (k.photographer) roleRows.push({ userId: k.photographer.id, role: ScopedRole.PHOTOGRAPHER, kennelId: k.id });
      }
      // The base seed already made Lagos' admin missing and Abuja's scribe and admin, so only add what is absent.
      {
        const existingRoles = await db.roleAssignment.findMany({ where: { kennelId: { not: null }, runId: null }, select: { userId: true, kennelId: true, role: true } });
        const have = new Set(existingRoles.map((r) => `${r.userId}|${r.kennelId}|${r.role}`));
        const fresh = roleRows.filter((r) => !have.has(`${r.userId}|${r.kennelId}|${r.role}`));
        for (const part of chunks(fresh)) await db.roleAssignment.createMany({ data: part });
      }

      // ── invitations ──────────────────────────────────────────
      const invitationRows: Prisma.MembershipInvitationCreateManyInput[] = [];
      for (const slug of ['abuja-h3-abuja', 'lagos-h3-lagos', 'nairobi-h3-nairobi', 'accra-h3-accra']) {
        const k = K(slug);
        const inviter = k.officers[0];
        if (!inviter) continue;
        const mk = (method: InvitationMethod, extra: Partial<Prisma.MembershipInvitationCreateManyInput>) =>
          invitationRows.push({ kennelId: k.id, invitedById: inviter.id, method, tokenHash: sha(randomBytes(16).toString('hex')), membershipType: MembershipType.FULL, expiresAt: plus(now, 7 * 24 * 60), ...extra });
        mk(InvitationMethod.EMAIL, { email: `invitee.${k.slug}@example.com` });
        mk(InvitationMethod.LINK, {});
        mk(InvitationMethod.QR_CODE, {});
        mk(InvitationMethod.EMAIL, { email: `accepted.${k.slug}@example.com`, acceptedAt: daysAgo(6), acceptedByUserId: pick(k.members).id });
        mk(InvitationMethod.LINK, { revokedAt: daysAgo(3) });
        mk(InvitationMethod.EMAIL, { email: `expired.${k.slug}@example.com`, expiresAt: daysAgo(4) });
      }
      for (const part of chunks(invitationRows)) await db.membershipInvitation.createMany({ data: part });

      // ── guests ───────────────────────────────────────────────
      const guestRows: Prisma.GuestProfileCreateManyInput[] = [];
      const guests: { id: string; name: string }[] = [];
      for (let i = 0; i < 24; i++) {
        const pool = NAME_POOLS.Nigeria;
        const first = pick(chance(0.5) ? pool.female : pool.male);
        const last = pick(pool.last);
        const id = randomUUID();
        guests.push({ id, name: `${first} ${last}` });
        guestRows.push({ id, firstName: first, lastName: last, email: `guest${pad2(i + 1)}@example.com`, phone: chance(0.6) ? `+2348${int(10000000, 99999999)}` : null, consentAt: daysAgo(int(5, 200)) });
      }
      for (const part of chunks(guestRows)) await db.guestProfile.createMany({ data: part });

      // ── runs ─────────────────────────────────────────────────
      const runRows: Prisma.RunCreateManyInput[] = [];
      const capsuleRows: Prisma.RunCapsuleCreateManyInput[] = [];
      const hareRows: Prisma.RunHareCreateManyInput[] = [];
      const hareRoleRows: Prisma.RoleAssignmentCreateManyInput[] = [];
      const participationRows: Prisma.ParticipationCreateManyInput[] = [];
      const circleRows: Prisma.CircleCreateManyInput[] = [];
      const awardRows: Prisma.AwardCreateManyInput[] = [];
      const hareOfferRows: Prisma.HareOfferCreateManyInput[] = [];
      const trailRows: Prisma.TrailCreateManyInput[] = [];
      const trailHareRows: Prisma.TrailHareCreateManyInput[] = [];
      const waypointRows: Prisma.WaypointCreateManyInput[] = [];
      const beerCheckRows: Prisma.BeerCheckCreateManyInput[] = [];
      const chalkRows: Prisma.DigitalChalkSymbolCreateManyInput[] = [];

      const existingRuns = await db.run.findMany({ select: { id: true, kennelId: true, runNumber: true, startsAt: true, status: true, visibility: true, title: true, meetingLatitude: true, meetingLongitude: true } });
      const hareIdsOnExisting = new Map<string, string[]>();
      for (const h of await db.runHare.findMany()) hareIdsOnExisting.set(h.runId, [...(hareIdsOnExisting.get(h.runId) ?? []), h.userId]);

      interface RunSpec {
        status: RunStatus;
        startsAt: Date;
        hares: number; // how many, 0 = un-hared
        trail?: { status: TrailStatus; mode: ReleaseMode };
        type?: RunType;
        visibility?: RunVisibility;
        cancelReason?: string;
      }

      function nextNumber(kennel: KennelCtx, existingMax: number) {
        const used = kennel.runs.map((r) => r.number);
        return Math.max(existingMax, ...used, 0) + 1;
      }

      function addRun(kennel: KennelCtx, number: number, spec: RunSpec): RunCtx {
        const id = randomUUID();
        const past = spec.status === RunStatus.ARCHIVED;
        const title = runTitle(kennel.city, number, rnd);
        const visibility = spec.visibility ?? (chance(0.12) ? (kennel.defaultRunVisibility === RunVisibility.PUBLIC ? RunVisibility.MEMBERS_ONLY : RunVisibility.PUBLIC) : kennel.defaultRunVisibility);
        const lat = kennel.latitude + (rnd() - 0.5) * 0.05;
        const lng = kennel.longitude + (rnd() - 0.5) * 0.05;
        const weather = pick(WEATHER);
        const s = spec.startsAt;
        const live = spec.status === RunStatus.LIVE || spec.status === RunStatus.CIRCLE || spec.status === RunStatus.REPORTING;
        runRows.push({
          id, kennelId: kennel.id, runNumber: number, title, description: pick(RUN_BLURBS), theme: chance(0.25) ? pick(THEMES) : null,
          runType: spec.type ?? weighted<RunType>([[RunType.REGULAR, 80], [RunType.FULL_MOON, 5], [RunType.RED_DRESS, 3], [RunType.CHARITY, 4], [RunType.THEMED, 5], [RunType.INTERHASH, 2], [RunType.CAMPOUT, 1]]),
          status: spec.status, visibility, startsAt: s, timeZone: kennel.timeZone, meetingPointName: `${pick(['Main gate', 'Car park', 'Roundabout', 'Football field', 'Market square', 'Beach entrance'])}, ${kennel.city}`,
          meetingAddress: `${int(1, 120)} ${pick(['Ridge', 'Lake', 'Market', 'Station', 'Hilltop'])} Road, ${kennel.city}`, meetingLatitude: lat, meetingLongitude: lng,
          country: kennel.country, city: kennel.city, capacity: chance(0.4) ? int(25, 80) : null, hashCash: chance(0.7) ? `₦${int(1, 5) * 1000}` : null,
          weather: weather as Prisma.InputJsonValue, createdById: kennel.admin?.id ?? admin.id,
          scheduledAt: spec.status === RunStatus.DRAFT ? null : plus(s, -int(5, 12) * 24 * 60),
          checkInOpenedAt: past || spec.status === RunStatus.CHECK_IN_OPEN || live ? plus(s, -30) : null,
          startedAt: past || live ? s : null,
          endedAt: past ? plus(s, int(70, 110)) : spec.status === RunStatus.CIRCLE || spec.status === RunStatus.REPORTING ? plus(s, 85) : null,
          archivedAt: past ? plus(s, 3 * 24 * 60) : null,
          trailReleasedAt: past || live ? plus(s, -30) : null,
          ...(spec.status === RunStatus.CANCELLED
            ? { cancelReason: spec.cancelReason ?? 'Venue unavailable', cancelledAt: plus(now, -24 * 60), cancelledById: kennel.admin?.id ?? admin.id }
            : {}),
        });

        const pool = kennel.members.filter((m) => !kennel.officers.some((o) => o.id === m.id) || chance(0.4));
        const hares = sample(pool.length ? pool : kennel.members, spec.hares);
        for (const [i, h] of hares.entries()) {
          hareRows.push({ runId: id, userId: h.id, isLead: i === 0 });
          hareRoleRows.push({ userId: h.id, role: i === 0 ? ScopedRole.HARE : ScopedRole.CO_HARE, runId: id, kennelId: kennel.id });
        }
        capsuleRows.push({ runId: id, status: past || live ? CapsuleStatus.DRAFT : spec.status === RunStatus.DRAFT ? CapsuleStatus.PLANNED : CapsuleStatus.PREPARING });

        const ctx: RunCtx = { id, kennel, number, title, startsAt: s, status: spec.status, visibility, past, hares, attendees: [], lat, lng };
        kennel.runs.push(ctx);

        if (spec.trail && hares.length) addTrail(ctx, spec.trail.status, spec.trail.mode);
        return ctx;
      }

      function addTrail(run: RunCtx, status: TrailStatus, mode: ReleaseMode) {
        const id = randomUUID();
        const { coords, distanceM } = loopRoute(run.lat, run.lng);
        const released = status === TrailStatus.RELEASED || status === TrailStatus.LIVE || status === TrailStatus.COMPLETED || status === TrailStatus.ARCHIVED;
        const lead = run.hares[0];
        trailRows.push({
          id, runId: run.id, name: 'Main Trail', style: weighted<TrailStyle>([[TrailStyle.DEAD_HARE, 6], [TrailStyle.LIVE_HARE, 2], [TrailStyle.A_TO_B, 1], [TrailStyle.A_TO_A, 1]]),
          status, estimatedDistanceM: distanceM, estimatedDurationMin: Math.round(distanceM / 90) + int(5, 20), terrain: pick(['Rock, scrub and one very optimistic hill', 'Lake shore and shiggy', 'Estate roads and a short bush path', 'Farm tracks and a river crossing', 'Forest edge with a long climb']),
          routeGeoJson: { type: 'LineString', coordinates: coords } as Prisma.InputJsonValue, startLatitude: coords[0][1], startLongitude: coords[0][0], finishLatitude: coords[0][1], finishLongitude: coords[0][0],
          notes: 'Beer check somewhere. Do not tell the pack.', releaseMode: mode,
          releaseAt: mode === ReleaseMode.SCHEDULED ? plus(run.startsAt, -90) : null,
          ...(mode === ReleaseMode.GEOFENCE ? { geofenceLatitude: coords[0][1], geofenceLongitude: coords[0][0], geofenceRadiusM: 150 } : {}),
          lockedAt: status === TrailStatus.DRAFT || status === TrailStatus.PLANNING || status === TrailStatus.IDEA ? null : plus(run.startsAt, -24 * 60),
          lockedById: lead?.id, safetyReviewedAt: status === TrailStatus.DRAFT || status === TrailStatus.PLANNING ? null : plus(run.startsAt, -24 * 60), safetyReviewedById: lead?.id,
          releasedAt: released ? plus(run.startsAt, -20) : null, releasedById: released ? lead?.id : null,
        });
        for (const [i, h] of run.hares.entries()) trailHareRows.push({ trailId: id, userId: h.id, isLead: i === 0 });
        const kinds: [WaypointKind, string][] = [
          [WaypointKind.START, 'Start'], [WaypointKind.CHECKPOINT, 'First check'], [WaypointKind.HAZARD, 'Road crossing'],
          [WaypointKind.REGROUP, 'Regroup'], [WaypointKind.SCENIC, 'View point'], [WaypointKind.ON_IN, 'On In'], [WaypointKind.FINISH, 'Finish'],
        ];
        for (const [i, [kind, name]] of kinds.entries()) {
          const c = coords[Math.min(i, coords.length - 1)];
          waypointRows.push({ trailId: id, kind, label: name, latitude: c[1], longitude: c[0], sequence: i, notes: kind === WaypointKind.HAZARD ? 'Marshal here' : null });
        }
        for (let b = 0; b < int(1, 2); b++) {
          const c = coords[Math.min(2 + b * 2, coords.length - 1)];
          beerCheckRows.push({ trailId: id, name: pick(['Water tower beer check', 'Church wall beer check', 'Lakeside beer check', 'Boot of a Corolla']), latitude: c[1], longitude: c[0], sequence: b, notes: pick(['Two crates, one cooler', 'Cold. Miraculously.', null]) });
        }
        const symbols = [ChalkSymbol.ON_ON, ChalkSymbol.CHECK, ChalkSymbol.FALSE_TRAIL, ChalkSymbol.BACK_CHECK, ChalkSymbol.BEER_NEAR, ChalkSymbol.TRUE_TRAIL, ChalkSymbol.ON_IN];
        for (const [i, symbol] of symbols.entries()) {
          const c = coords[i % coords.length];
          chalkRows.push({ trailId: id, symbol, latitude: c[1] + 0.0002, longitude: c[0] + 0.0002, placedById: run.hares[i % run.hares.length]?.id ?? lead?.id ?? admin.id });
        }
      }

      function attendance(run: RunCtx, opts: { checkIn: boolean; lock: boolean; headcount?: number; rsvpOnly?: boolean }) {
        const k = run.kennel;
        const local = shuffled(k.members);
        const n = opts.headcount ?? Math.max(5, Math.min(local.length, Math.round(local.length * (0.35 + rnd() * 0.4))));
        const going = new Map<string, U>();
        for (const h of run.hares) going.set(h.id, h);
        for (const m of local) {
          if (going.size >= n) break;
          going.set(m.id, m);
        }
        const visitors = sample(everyone.filter((u) => !k.members.some((m) => m.id === u.id)), chance(0.6) ? int(1, 4) : 0);
        const lockedAt = opts.lock ? plus(run.startsAt, 3 * 24 * 60) : null;
        let i = 0;
        const methods = [CheckInMethod.OFFICER, CheckInMethod.QR, CheckInMethod.GPS, CheckInMethod.MANUAL];
        const add = (u: U, visitor: boolean) => {
          const goes = opts.checkIn ? chance(0.92) : true;
          participationRows.push({
            runId: run.id, userId: u.id, rsvpStatus: RsvpStatus.GOING, isVisitor: visitor, homeKennelId: visitor ? (people.find((p) => p.u.id === u.id)?.home ? K(people.find((p) => p.u.id === u.id)!.home).id : null) : k.id,
            checkInMethod: opts.checkIn && goes ? pick(methods) : null, checkedInAt: opts.checkIn && goes ? plus(run.startsAt, -20 + (i++ % 25)) : null, checkedInById: opts.checkIn && goes ? k.officers[0]?.id : null, lockedAt,
          });
          if (opts.checkIn && goes) run.attendees.push(u);
        };
        for (const u of going.values()) add(u, false);
        for (const u of visitors) add(u, true);
        // A few who said they were coming, and a couple who said no or maybe.
        if (!opts.rsvpOnly) {
          for (const u of sample(local.filter((m) => !going.has(m.id)), 2)) {
            participationRows.push({ runId: run.id, userId: u.id, rsvpStatus: pick([RsvpStatus.NOT_GOING, RsvpStatus.MAYBE]), homeKennelId: k.id, lockedAt });
          }
        }
        for (const g of sample(guests, chance(0.5) ? int(1, 2) : 0)) {
          participationRows.push({
            runId: run.id, guestId: g.id, rsvpStatus: RsvpStatus.GOING, isVisitor: true, isVirginRun: chance(0.5),
            checkInMethod: opts.checkIn ? CheckInMethod.OFFICER : null, checkedInAt: opts.checkIn ? plus(run.startsAt, -8) : null, checkedInById: opts.checkIn ? k.officers[0]?.id : null, lockedAt,
          });
        }
      }

      // Remembered so the capsule timeline can mention them (see the capsule loop).
      const awardsByRun = new Map<string, { title: string; reason: string | null; at: Date }[]>();

      function circle(run: RunCtx, closed: boolean) {
        const circleId = randomUUID();
        circleRows.push({
          id: circleId, runId: run.id, startedAt: plus(run.startsAt, 95), endedAt: closed ? plus(run.startsAt, 135) : null, songs: sample(SONGS, int(1, 3)),
          announcements: chance(0.6) ? pick(['Red Dress Run in three weeks. Bring the dress.', 'AGM next month, bring your complaints.', 'Hash Cash is due. All of it.', 'New songbook arrives Saturday.']) : null,
          notes: chance(0.5) ? 'A good Circle. Visitors welcomed, virgins named.' : null,
        });
        const pool = run.attendees.length ? run.attendees : run.kennel.members;
        for (let a = 0; a < int(1, 4); a++) {
          const t = pick(AWARD_TITLES);
          awardRows.push({ circleId, title: t.title, reason: t.reason, isDownDown: t.isDownDown, recipientUserId: pick(pool).id, awardedById: run.kennel.officers[0]?.id ?? null });
          awardsByRun.set(run.id, [...(awardsByRun.get(run.id) ?? []), { title: t.title, reason: t.reason, at: plus(run.startsAt, 100 + a * 5) }]);
        }
      }

      const slugs = [...kennels.keys()].filter((s) => K(s).status === KennelStatus.ACTIVE);
      for (const slug of slugs) {
        const kennel = K(slug);
        const mine = existingRuns.filter((r) => r.kennelId === kennel.id);
        for (const r of mine) {
          kennel.runs.push({
            id: r.id, kennel, number: r.runNumber, title: r.title, startsAt: r.startsAt, status: r.status, visibility: r.visibility, past: r.status === RunStatus.ARCHIVED,
            hares: (hareIdsOnExisting.get(r.id) ?? []).map((id) => kennel.members.find((m) => m.id === id)).filter(Boolean) as U[], attendees: [],
            lat: r.meetingLatitude ?? kennel.latitude, lng: r.meetingLongitude ?? kennel.longitude,
          });
        }
        const minExisting = mine.length ? Math.min(...mine.map((r) => r.runNumber)) : 100;
        const maxExisting = mine.length ? Math.max(...mine.map((r) => r.runNumber)) : 100;
        const lastWeekTaken = mine.some((r) => r.status === RunStatus.ARCHIVED);
        const pastStart = lastWeekTaken ? 2 : 1; // offsets in weeks before the next meeting

        // Twelve weeks of history, newest first.
        const PAST = 12;
        for (let i = 0; i < PAST; i++) {
          const startsAt = meetingDate(slug, kennel.meetingDay, -(pastStart + i));
          const number = minExisting - 1 - i;
          const run = addRun(kennel, number, {
            status: RunStatus.ARCHIVED, startsAt, hares: int(1, 3), trail: { status: chance(0.7) ? TrailStatus.ARCHIVED : TrailStatus.COMPLETED, mode: pick([ReleaseMode.AT_RUN_START, ReleaseMode.AT_RUN_START, ReleaseMode.SCHEDULED, ReleaseMode.CHECK_IN]) },
          });
          attendance(run, { checkIn: true, lock: true });
          circle(run, true);
        }
        // Existing archived run from the base seed keeps its own data; just let it host photos.
        for (const r of kennel.runs.filter((x) => x.past && x.attendees.length === 0)) r.attendees = kennel.members.slice(0, 8);

        // What is coming. Some are deliberately incomplete so the nudges and offers have something to find.
        const upcomingTaken = new Set(mine.map((r) => r.startsAt.toISOString().slice(0, 10)));
        const planned: [number, RunSpec][] = [
          [0, { status: RunStatus.SCHEDULED, startsAt: meetingDate(slug, kennel.meetingDay, 0), hares: 2, trail: { status: TrailStatus.HIDDEN, mode: ReleaseMode.AT_RUN_START } }],
          [1, { status: RunStatus.SCHEDULED, startsAt: meetingDate(slug, kennel.meetingDay, 1), hares: 0 }], // un-hared
          [2, { status: RunStatus.SCHEDULED, startsAt: meetingDate(slug, kennel.meetingDay, 2), hares: 1 }], // hare, no trail
          [3, { status: RunStatus.PLANNING, startsAt: meetingDate(slug, kennel.meetingDay, 3), hares: 2, trail: { status: TrailStatus.PLANNING, mode: ReleaseMode.SCHEDULED } }],
          [4, { status: RunStatus.TRAIL_HIDDEN, startsAt: meetingDate(slug, kennel.meetingDay, 4), hares: 2, trail: { status: TrailStatus.HIDDEN, mode: ReleaseMode.MANUAL } }],
          [5, { status: RunStatus.CANCELLED, startsAt: meetingDate(slug, kennel.meetingDay, 5), hares: 1, cancelReason: 'Heavy flooding on the trail' }],
          [6, { status: RunStatus.DRAFT, startsAt: meetingDate(slug, kennel.meetingDay, 6), hares: 0 }],
        ];
        let numberCursor = maxExisting;
        for (const [week, spec] of planned) {
          const day = spec.startsAt.toISOString().slice(0, 10);
          numberCursor = nextNumber(kennel, numberCursor);
          if (upcomingTaken.has(day)) continue;
          const run = addRun(kennel, numberCursor, spec);
          if (spec.status !== RunStatus.DRAFT && spec.status !== RunStatus.CANCELLED) attendance(run, { checkIn: false, lock: false, headcount: int(3, Math.min(14, Math.max(4, kennel.members.length))), rsvpOnly: true });
          if (week === 5) attendance(run, { checkIn: false, lock: false, headcount: 4, rsvpOnly: true });
        }
      }

      // Live and just-finished runs, so check-in, the Circle and reporting can be tried now.
      {
        const abuja = K('abuja-h3-abuja');
        const accra = K('accra-h3-accra');
        const today = (mins: number) => plus(now, mins);
        let n = nextNumber(abuja, Math.max(0, ...abuja.runs.map((r) => r.number)));
        const live: [KennelCtx, number, RunSpec, 'rsvp' | 'checkin' | 'circle'][] = [
          [abuja, n++, { status: RunStatus.CHECK_IN_OPEN, startsAt: today(45), hares: 2, trail: { status: TrailStatus.HIDDEN, mode: ReleaseMode.CHECK_IN } }, 'rsvp'],
          [abuja, n++, { status: RunStatus.LIVE, startsAt: today(-25), hares: 2, trail: { status: TrailStatus.LIVE, mode: ReleaseMode.AT_RUN_START } }, 'checkin'],
          [abuja, n++, { status: RunStatus.CIRCLE, startsAt: today(-110), hares: 2, trail: { status: TrailStatus.COMPLETED, mode: ReleaseMode.AT_RUN_START } }, 'circle'],
          [abuja, n++, { status: RunStatus.REPORTING, startsAt: today(-220), hares: 3, trail: { status: TrailStatus.COMPLETED, mode: ReleaseMode.AT_RUN_START } }, 'circle'],
        ];
        for (const [kennel, num, spec, mode] of live) {
          const run = addRun(kennel, num, spec);
          attendance(run, { checkIn: mode !== 'rsvp', lock: false, headcount: 14, rsvpOnly: mode === 'rsvp' });
          if (mode === 'circle') circle(run, spec.status === RunStatus.REPORTING);
        }
        // A geofenced trail at Accra: unlocks only when the server verifies a location.
        const an = nextNumber(accra, Math.max(0, ...accra.runs.map((r) => r.number)));
        const geo = addRun(accra, an, { status: RunStatus.CHECK_IN_OPEN, startsAt: today(30), hares: 2, trail: { status: TrailStatus.HIDDEN, mode: ReleaseMode.GEOFENCE } });
        attendance(geo, { checkIn: false, lock: false, headcount: 8, rsvpOnly: true });
      }

      // ── hare offers ──────────────────────────────────────────
      for (const k of kennels.values()) {
        const unhared = k.runs.filter((r) => !r.past && r.hares.length === 0 && r.status === RunStatus.SCHEDULED);
        for (const run of unhared) {
          const pool = shuffled(k.members.filter((m) => !run.hares.some((h) => h.id === m.id)));
          const offer = (u: U | undefined, status: HareOfferStatus, extra: Partial<Prisma.HareOfferCreateManyInput> = {}) => {
            if (u) hareOfferRows.push({ runId: run.id, userId: u.id, message: pick(['Happy to hare this one, I know a good lake trail.', 'Can I co-hare with someone experienced?', 'I have been dying to lay a trail.']), wantsLead: chance(0.5), status, ...extra });
          };
          offer(pool[0], HareOfferStatus.OFFERED);
          offer(pool[1], HareOfferStatus.OFFERED, { wantsLead: true });
          offer(pool[2], HareOfferStatus.DECLINED, { decidedById: k.officers[0]?.id, decidedAt: daysAgo(2), reason: 'Already two trails this month, let us spread it out' });
          offer(pool[3], HareOfferStatus.WITHDRAWN, { reason: 'Travelling that weekend' });
        }
        for (const run of k.runs.filter((r) => !r.past && r.hares.length > 0 && r.status === RunStatus.SCHEDULED).slice(0, 2)) {
          hareOfferRows.push({ runId: run.id, userId: run.hares[0].id, message: 'Thanks for having me', wantsLead: true, status: HareOfferStatus.ACCEPTED, decidedById: k.officers[0]?.id, decidedAt: daysAgo(4) });
        }
      }

      for (const part of chunks(runRows)) await db.run.createMany({ data: part });
      for (const part of chunks(capsuleRows)) await db.runCapsule.createMany({ data: part });
      for (const part of chunks(hareRows)) await db.runHare.createMany({ data: part, skipDuplicates: true });
      for (const part of chunks(hareRoleRows)) await db.roleAssignment.createMany({ data: part });
      for (const part of chunks(participationRows)) await db.participation.createMany({ data: part, skipDuplicates: true });
      for (const part of chunks(circleRows)) await db.circle.createMany({ data: part });
      for (const part of chunks(awardRows)) await db.award.createMany({ data: part });
      for (const part of chunks(hareOfferRows)) await db.hareOffer.createMany({ data: part });
      for (const part of chunks(trailRows)) await db.trail.createMany({ data: part });
      for (const part of chunks(trailHareRows)) await db.trailHare.createMany({ data: part, skipDuplicates: true });
      for (const part of chunks(waypointRows)) await db.waypoint.createMany({ data: part });
      for (const part of chunks(beerCheckRows)) await db.beerCheck.createMany({ data: part });
      for (const part of chunks(chalkRows)) await db.digitalChalkSymbol.createMany({ data: part });
      summary.runs = runRows.length;
      summary.participations = participationRows.length;

      // ── stories, trail reports, capsules ─────────────────────
      const storyRows: Prisma.StoryAssetCreateManyInput[] = [];
      const reportRows: Prisma.TrailReportCreateManyInput[] = [];
      const revisionRows: Prisma.ReportRevisionCreateManyInput[] = [];
      const contributorRows: Prisma.TrailReportContributorCreateManyInput[] = [];
      const commentRows: Prisma.ReportReviewCommentCreateManyInput[] = [];
      const aiRows: Prisma.AiSuggestionCreateManyInput[] = [];
      const capsuleUpdates: { runId: string; data: Prisma.RunCapsuleUncheckedUpdateInput }[] = [];
      const supplementalRows: Prisma.SupplementalArtifactCreateManyInput[] = [];
      const reportSubjects: { reportId: string; run: RunCtx }[] = [];

      for (const k of kennels.values()) {
        if (!k.scribe) continue;
        const pastRuns = k.runs.filter((r) => r.past).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
        for (const [idx, run] of pastRuns.entries()) {
          for (const bit of sample(STORY_BITS, int(3, 6))) {
            storyRows.push({ runId: run.id, category: bit.category as StoryCategory, source: chance(0.6) ? StorySource.AUTOMATIC : StorySource.MANUAL, body: bit.body, occurredAt: plus(run.startsAt, int(0, 140)), contributorId: pick(run.attendees.length ? run.attendees : k.members).id });
          }
          // Newest run: a report still in the works, rotating through each stage.
          const stages: (TrailReportStatus | null)[] = [TrailReportStatus.SCRIBE_EDITING, TrailReportStatus.REVIEW, TrailReportStatus.DRAFT, null];
          let status: TrailReportStatus | null;
          if (idx === 0) status = stages[[...kennels.keys()].indexOf(k.slug) % stages.length];
          else if (idx === 1 && chance(0.5)) status = TrailReportStatus.PUBLISHED; // capsule left pending below
          else status = chance(0.72) ? TrailReportStatus.PUBLISHED : null;
          if (idx === 5 && status === TrailReportStatus.PUBLISHED) status = TrailReportStatus.ARCHIVED;
          if (!status) continue;

          const reportId = randomUUID();
          const hareNames = run.hares.length ? run.hares.map(label).join(' and ') : 'The hares';
          const published = status === TrailReportStatus.PUBLISHED || status === TrailReportStatus.ARCHIVED;
          const w = WEATHER[idx % WEATHER.length];
          const body = reportBody(rnd, { hares: hareNames, meeting: `${run.title.split(' ')[0]} ${run.kennel.city}`, distanceKm: (3 + rnd() * 6).toFixed(1), weather: w.summary });
          const publishedAt = published ? plus(run.startsAt, int(1, 3) * 24 * 60) : null;
          const title = `${run.title}: ${pick(['a muddy triumph', 'the one with the false trail', 'rain, rocks and a very late beer check', 'On On, finally', 'everyone lost, nobody cared'])}`;
          reportRows.push({ id: reportId, runId: run.id, status, officialScribeId: k.scribe.id, title, body: status === TrailReportStatus.DRAFT && idx === 0 ? '' : body, aiAssisted: false, publishedAt, publishedById: published ? k.scribe.id : null, createdAt: plus(run.startsAt, 6 * 60) });
          revisionRows.push({ reportId, version: 1, title, body, authorId: k.scribe.id, isPublication: published, reason: published ? 'First publication' : null });
          if (published && chance(0.25)) {
            revisionRows.push({ reportId, version: 2, title, body: `${body}\n\nCorrection: the beer check was behind the church, not the school.`, authorId: k.scribe.id, isPublication: false, reason: 'Corrected the beer check location' });
          }
          if (k.assistantScribe && chance(0.4)) contributorRows.push({ reportId, userId: k.assistantScribe.id, role: ReportContributorRole.ASSISTANT_SCRIBE });
          if (k.officers[0] && chance(0.3)) contributorRows.push({ reportId, userId: k.officers[0].id, role: ReportContributorRole.REVIEWER });
          if (status === TrailReportStatus.REVIEW) {
            for (const c of sample(REVIEW_COMMENTS, 2)) commentRows.push({ reportId, authorId: k.officers[0]?.id ?? k.scribe.id, body: c.body, anchor: c.anchor, resolvedAt: chance(0.3) ? daysAgo(1) : null });
          }
          if (k.slug === 'abuja-h3-abuja' && idx === 0) {
            // A draft written by the AI, waiting for a human to accept it.
            aiRows.push({ kind: AiSuggestionKind.TRAIL_REPORT_DRAFT, status: AiSuggestionStatus.PENDING, requestedById: k.scribe.id, kennelId: k.id, runId: run.id, reportId, model: 'claude-opus-5', promptVersion: 'trail-report-v1', output: body, sourceRefs: { storyAssets: 4, attendance: run.attendees.length } as Prisma.InputJsonValue });
            reportRows[reportRows.length - 1].aiAssisted = true;
          }

          for (const s of storyRows.filter((x) => x.runId === run.id)) (s as Prisma.StoryAssetCreateManyInput).trailReportId = published ? reportId : null;
          run.reportId = reportId;
          run.reportPublished = published;
          reportSubjects.push({ reportId, run });

          // Capsule follows the report: published, or waiting for a scribe to publish it.
          const capsulePending = idx === 1 && published;
          const capsuleStatus = published && !capsulePending ? CapsuleStatus.PUBLISHED : capsulePending ? CapsuleStatus.PENDING_PUBLICATION : CapsuleStatus.DRAFT;
          run.capsulePublished = capsuleStatus === CapsuleStatus.PUBLISHED;
          capsuleUpdates.push({
            runId: run.id,
            data: {
              status: capsuleStatus, trailReportId: published ? reportId : null, publishedAt: capsuleStatus === CapsuleStatus.PUBLISHED ? publishedAt : null, publishedById: capsuleStatus === CapsuleStatus.PUBLISHED ? k.scribe.id : null,
              summary: `${run.title}: ${run.attendees.length} hashers, ${w.summary.toLowerCase()}.`,
              // Same shape capsule.service#assemble writes: published capsules are
              // frozen, so this is what the Explorer reads back.
              timeline: [
                { at: plus(run.startsAt, -6 * 24 * 60), kind: 'RUN', label: 'The run was announced' },
                { at: plus(run.startsAt, -30), kind: 'RUN', label: 'The trail went live' },
                { at: run.startsAt, kind: 'RUN', label: 'The pack set off' },
                { at: plus(run.startsAt, 95), kind: 'RUN', label: 'The pack came in' },
                { at: plus(run.startsAt, 135), kind: 'RUN', label: 'The Circle closed' },
                { at: plus(run.startsAt, 3 * 24 * 60), kind: 'RUN', label: 'The run was archived' },
                ...storyRows.filter((s) => s.runId === run.id).slice(0, 4).map((s) => ({ at: s.occurredAt as Date, kind: 'STORY', label: s.body, refType: 'StoryAsset' })),
                ...(awardsByRun.get(run.id) ?? []).map((a) => ({ at: a.at, kind: 'AWARD', label: a.title, ...(a.reason ? { detail: a.reason } : {}) })),
                ...(published && publishedAt ? [{ at: publishedAt, kind: 'REPORT', label: `The Trail Report was published: ${title}`, refType: 'TrailReport', refId: reportId }] : []),
              ]
                .sort((x, y) => x.at.getTime() - y.at.getTime())
                .map((e) => ({ ...e, at: e.at.toISOString() })) as unknown as Prisma.InputJsonValue,
            },
          });
        }
        // The oldest run without a report becomes a legacy import at Abuja, so that state exists.
        if (k.slug === 'abuja-h3-abuja') {
          const old = pastRuns.find((r) => !r.reportId);
          if (old) capsuleUpdates.push({ runId: old.id, data: { status: CapsuleStatus.LEGACY, isLegacyImport: true, summary: 'Imported from the kennel newsletter archive.' } });
        }
      }
      // Reports first: story assets point at them.
      for (const part of chunks(reportRows)) await db.trailReport.createMany({ data: part });
      for (const part of chunks(storyRows)) await db.storyAsset.createMany({ data: part });
      for (const part of chunks(revisionRows)) await db.reportRevision.createMany({ data: part });
      for (const part of chunks(contributorRows)) await db.trailReportContributor.createMany({ data: part, skipDuplicates: true });
      for (const part of chunks(commentRows)) await db.reportReviewComment.createMany({ data: part });
      for (const part of chunks(aiRows)) await db.aiSuggestion.createMany({ data: part });
      for (const u of capsuleUpdates) await db.runCapsule.update({ where: { runId: u.runId }, data: u.data });
      summary.reports = reportRows.length;

      // ── media: run photos, posts, reels ──────────────────────
      const mediaRows: Prisma.MediaAssetCreateManyInput[] = [];
      const linkRows: Prisma.MediaLinkCreateManyInput[] = [];
      const photoOf = (img: SeedImage) => ({ storageKey: img.storageKey, url: mediaUrl(img.storageKey), width: img.width, height: img.height, sizeBytes: BigInt(img.sizeBytes), mimeType: 'image/png', kind: MediaKind.PHOTO });
      const photoAssets: { id: string; run?: RunCtx; uploaderId: string; moderation: ModerationState }[] = [];

      for (const k of kennels.values()) {
        const moderated = k.slug === 'lagos-h3-lagos' || k.slug === 'accra-h3-accra';
        for (const run of k.runs.filter((r) => r.past)) {
          for (let i = 0; i < int(2, 6); i++) {
            const img = pick(photos);
            const uploader = pick(run.attendees.length ? run.attendees : k.members);
            let moderation: ModerationState = ModerationState.APPROVED;
            if (moderated && chance(0.18)) moderation = k.slug === 'lagos-h3-lagos' ? ModerationState.PENDING : pick([ModerationState.REPORTED, ModerationState.PENDING]);
            if (moderated && chance(0.04)) moderation = ModerationState.REJECTED;
            const id = randomUUID();
            mediaRows.push({
              id, uploaderId: uploader.id, ...photoOf(img), caption: pick(PHOTO_CAPTIONS), capturedAt: plus(run.startsAt, int(-20, 130)), latitude: run.lat, longitude: run.lng,
              uploadState: UploadState.AVAILABLE, moderationState: moderation,
              ...(moderation === ModerationState.REJECTED ? { moderatedById: k.moderator?.id ?? k.officers[0]?.id, moderatedAt: daysAgo(2) } : moderation === ModerationState.APPROVED && moderated ? { moderatedById: k.officers[0]?.id, moderatedAt: plus(run.startsAt, 24 * 60) } : {}),
            });
            linkRows.push({ mediaId: id, targetType: MediaTargetType.RUN, targetId: run.id });
            photoAssets.push({ id, run, uploaderId: uploader.id, moderation });
          }
        }
      }

      // Posts
      const postRows: Prisma.PostCreateManyInput[] = [];
      const postMeta: { id: string; authorId: string; status: PostStatus; publishedAt: Date | null; kennelId: string | null }[] = [];
      for (let i = 0; i < 96; i++) {
        const author = pick(everyone);
        const home = people.find((p) => p.u.id === author.id)?.home;
        const kennel = home && chance(0.6) ? K(home) : null;
        const run = kennel && chance(0.4) ? pick(kennel.runs.filter((r) => r.past) ?? []) : undefined;
        const id = randomUUID();
        const status = i === 0 || i === 1 ? PostStatus.REMOVED : i === 2 || i === 3 ? PostStatus.ARCHIVED : PostStatus.PUBLISHED;
        const publishedAt = daysAgo(rnd() * 40);
        postRows.push({
          id, authorId: author.id, kennelId: kennel?.id ?? null, runId: run?.id ?? null, body: pick(POSTS), status, publishedAt, createdAt: publishedAt,
          ...(status === PostStatus.ARCHIVED ? { archivedAt: daysAgo(1) } : {}),
          ...(status === PostStatus.REMOVED ? { removedAt: daysAgo(2), removedById: admin.id, removedReason: 'Off-topic advertising' } : {}),
          ...(chance(0.15) ? { editedAt: plus(publishedAt, 30) } : {}),
        });
        postMeta.push({ id, authorId: author.id, status, publishedAt, kennelId: kennel?.id ?? null });
        if (chance(0.38)) {
          for (let p = 0; p < int(1, 3); p++) {
            const img = pick(photos);
            const mid = randomUUID();
            mediaRows.push({ id: mid, uploaderId: author.id, ...photoOf(img), caption: null, capturedAt: publishedAt, uploadState: UploadState.AVAILABLE, moderationState: ModerationState.APPROVED });
            linkRows.push({ mediaId: mid, targetType: MediaTargetType.POST, targetId: id });
          }
        }
      }

      // Reels
      const reelRows: Prisma.ReelCreateManyInput[] = [];
      const reelMeta: { id: string; visibility: ReelVisibility; status: ReelStatus }[] = [];
      for (const [i, v] of videos.entries()) {
        const author = pick(everyone);
        const home = people.find((p) => p.u.id === author.id)?.home;
        const kennel = home ? K(home) : undefined;
        const run = kennel && chance(0.5) ? pick(kennel.runs.filter((r) => r.past)) : undefined;
        const membersOnly = run?.visibility !== RunVisibility.PUBLIC && run !== undefined;
        const mid = randomUUID();
        const reelId = randomUUID();
        const status = i === videos.length - 1 ? ReelStatus.REMOVED : i === videos.length - 2 ? ReelStatus.ARCHIVED : ReelStatus.PUBLISHED;
        const publishedAt = daysAgo(rnd() * 25);
        mediaRows.push({
          id: mid, uploaderId: author.id, kind: MediaKind.VIDEO, storageKey: v.storageKey, url: mediaUrl(v.storageKey), mimeType: 'video/mp4', sizeBytes: BigInt(v.sizeBytes),
          width: v.width, height: v.height, durationSec: v.durationSec, capturedAt: publishedAt, uploadState: UploadState.AVAILABLE, moderationState: ModerationState.APPROVED,
        });
        linkRows.push({ mediaId: mid, targetType: MediaTargetType.REEL, targetId: reelId });
        const visibility = membersOnly ? ReelVisibility.KENNEL_ONLY : ReelVisibility.PUBLIC;
        reelRows.push({
          id: reelId, authorId: author.id, kennelId: kennel?.id ?? null, runId: run?.id ?? null, caption: pick(REEL_CAPTIONS), status, visibility, mediaId: mid, publishedAt,
          viewCount: int(5, 400), createdAt: publishedAt,
          ...(status === ReelStatus.ARCHIVED ? { archivedAt: daysAgo(3) } : {}),
          ...(status === ReelStatus.REMOVED ? { removedAt: daysAgo(1), removedById: admin.id, removedReason: 'Contained copyrighted music' } : {}),
        });
        reelMeta.push({ id: reelId, visibility, status });
      }
      // And a reel still being made.
      if (videos.length) {
        reelRows.push({ authorId: pick(everyone).id, caption: 'Work in progress', status: ReelStatus.DRAFT, visibility: ReelVisibility.PUBLIC });
      }

      // Kennel galleries: a featured set of photos each.
      const galleryRows: Prisma.GalleryCreateManyInput[] = [];
      for (const k of kennels.values()) {
        if (k.status !== KennelStatus.ACTIVE || !k.admin) continue;
        const galleryId = randomUUID();
        galleryRows.push({ id: galleryId, kennelId: k.id, title: `${k.shortName} favourites`, description: 'The photos we keep sending each other.', isFeatured: true, createdById: k.admin.id });
        for (const p of sample(photoAssets.filter((a) => a.run?.kennel.id === k.id && a.moderation === ModerationState.APPROVED), 5)) {
          linkRows.push({ mediaId: p.id, targetType: MediaTargetType.GALLERY, targetId: galleryId });
        }
      }

      // Uploaded when it was taken, not when the seed ran, so the feed orders
      // them through the weeks instead of piling 300 photos at "now".
      for (const m of mediaRows) if (m.capturedAt && !m.createdAt) m.createdAt = m.capturedAt as Date;
      for (const part of chunks(mediaRows)) await db.mediaAsset.createMany({ data: part });
      for (const part of chunks(linkRows)) await db.mediaLink.createMany({ data: part, skipDuplicates: true });
      for (const part of chunks(postRows)) await db.post.createMany({ data: part });
      for (const part of chunks(reelRows)) await db.reel.createMany({ data: part });
      for (const part of chunks(galleryRows)) await db.gallery.createMany({ data: part });
      summary.photos = photoAssets.length;
      summary.reels = reelRows.length;
      summary.posts = postRows.length;

      // A couple of capsule supplements: a reflection and a photo added after publication.
      {
        const published = reportSubjects.filter((r) => r.run.capsulePublished);
        for (const r of sample(published, 6)) {
          const capsule = await db.runCapsule.findUnique({ where: { runId: r.run.id }, select: { id: true } });
          if (!capsule) continue;
          const photoForRun = photoAssets.find((a) => a.run?.id === r.run.id);
          supplementalRows.push({ capsuleId: capsule.id, type: SupplementalType.REFLECTION, title: 'A few years on', description: 'Still the best beer check we ever had.', contributorId: pick(r.run.kennel.members).id });
          if (photoForRun) supplementalRows.push({ capsuleId: capsule.id, type: SupplementalType.PHOTO, title: 'Found this in my camera roll', mediaAssetId: photoForRun.id, contributorId: photoForRun.uploaderId });
        }
        for (const part of chunks(supplementalRows)) await db.supplementalArtifact.createMany({ data: part });
      }

      // ── social graph ─────────────────────────────────────────
      // Only things anybody may see, so seeded engagement never exposes a members-only run.
      interface Subject { type: SubjectType; id: string; pop: number }
      const subjects: Subject[] = [];
      for (const p of postMeta) if (p.status === PostStatus.PUBLISHED) subjects.push({ type: SubjectType.POST, id: p.id, pop: rnd() ** 2 });
      for (const r of reelMeta) if (r.status === ReelStatus.PUBLISHED && r.visibility === ReelVisibility.PUBLIC) subjects.push({ type: SubjectType.REEL, id: r.id, pop: rnd() ** 2 });
      for (const { reportId, run } of reportSubjects) {
        if (run.visibility !== RunVisibility.PUBLIC) continue;
        if (run.reportPublished) subjects.push({ type: SubjectType.TRAIL_REPORT, id: reportId, pop: rnd() ** 2 });
        if (run.capsulePublished) subjects.push({ type: SubjectType.RUN_CAPSULE, id: run.capsuleId ?? run.id, pop: rnd() ** 2 * 0.5 });
      }
      for (const k of kennels.values()) {
        for (const run of k.runs.filter((r) => r.visibility === RunVisibility.PUBLIC && r.status !== RunStatus.DRAFT && r.status !== RunStatus.CANCELLED)) subjects.push({ type: SubjectType.RUN, id: run.id, pop: rnd() ** 2 * 0.7 });
      }
      for (const a of photoAssets) {
        if (a.run && a.run.visibility === RunVisibility.PUBLIC && a.moderation === ModerationState.APPROVED && chance(0.3)) subjects.push({ type: SubjectType.MEDIA_ASSET, id: a.id, pop: rnd() ** 2 * 0.6 });
      }
      // Capsule subjects use the capsule's own id.
      const capsuleIds = new Map((await db.runCapsule.findMany({ where: { status: CapsuleStatus.PUBLISHED }, select: { id: true, runId: true } })).map((c) => [c.runId, c.id]));
      for (const s of subjects) if (s.type === SubjectType.RUN_CAPSULE) s.id = capsuleIds.get(s.id) ?? s.id;
      const subjectsFiltered = subjects.filter((s) => s.type !== SubjectType.RUN_CAPSULE || capsuleIds.size > 0);
      const popular = (n: number) => {
        const out: Subject[] = [];
        for (const s of shuffled(subjectsFiltered)) if (chance(0.15 + s.pop * 0.85)) out.push(s);
        return out.slice(0, n);
      };

      // Follows
      const followRows: Prisma.FollowCreateManyInput[] = [];
      const followKey = new Set<string>();
      for (const u of everyone) {
        for (const target of sample(everyone.filter((x) => x.id !== u.id), int(4, 16))) {
          const key = `${u.id}|USER|${target.id}`;
          if (followKey.has(key)) continue;
          followKey.add(key);
          followRows.push({ followerId: u.id, targetType: FollowTargetType.USER, targetId: target.id, followedAt: daysAgo(int(1, 120)), unfollowedAt: chance(0.06) ? daysAgo(int(0, 5)) : null });
        }
        for (const k of sample(activeKennels, int(1, 4))) {
          const key = `${u.id}|KENNEL|${k.id}`;
          if (followKey.has(key)) continue;
          followKey.add(key);
          followRows.push({ followerId: u.id, targetType: FollowTargetType.KENNEL, targetId: k.id, followedAt: daysAgo(int(1, 200)) });
        }
      }
      for (const part of chunks(followRows)) await db.follow.createMany({ data: part });
      summary.follows = followRows.length;

      // Likes
      const likeRows: Prisma.ContentLikeCreateManyInput[] = [];
      const likeKey = new Set<string>();
      for (const u of everyone) {
        for (const s of popular(int(12, 40))) {
          const key = `${u.id}|${s.type}|${s.id}`;
          if (likeKey.has(key)) continue;
          likeKey.add(key);
          likeRows.push({ userId: u.id, subjectType: s.type, subjectId: s.id, likedAt: daysAgo(rnd() * 30), unlikedAt: chance(0.05) ? daysAgo(rnd() * 3) : null });
        }
      }

      // Comments and replies
      interface CommentRec { id: string; subject: Subject; status: CommentStatus; parentId: string | null }
      const commentsOut: Prisma.ContentCommentCreateManyInput[] = [];
      const recs: CommentRec[] = [];
      for (const s of subjectsFiltered.filter((x) => x.pop > 0.18)) {
        for (let c = 0; c < int(1, 7); c++) {
          const author = pick(everyone);
          const id = randomUUID();
          const createdAt = daysAgo(rnd() * 28);
          const status = chance(0.03) ? CommentStatus.DELETED : chance(0.02) ? CommentStatus.REMOVED : CommentStatus.VISIBLE;
          commentsOut.push({
            id, subjectType: s.type, subjectId: s.id, authorId: author.id, body: pick(COMMENTS), status, createdAt,
            ...(status === CommentStatus.DELETED ? { deletedAt: plus(createdAt, 60) } : {}),
            ...(status === CommentStatus.REMOVED ? { removedAt: plus(createdAt, 90), removedById: admin.id, removedReason: 'Abusive language' } : {}),
          });
          recs.push({ id, subject: s, status, parentId: null });
          if (status === CommentStatus.VISIBLE && chance(0.35)) {
            for (let r = 0; r < int(1, 3); r++) {
              const rid = randomUUID();
              commentsOut.push({ id: rid, subjectType: s.type, subjectId: s.id, authorId: pick(everyone).id, parentId: id, body: pick(REPLIES), status: CommentStatus.VISIBLE, createdAt: plus(createdAt, int(5, 600)) });
              recs.push({ id: rid, subject: s, status: CommentStatus.VISIBLE, parentId: id });
            }
          }
        }
      }
      const replyCount = new Map<string, number>();
      for (const r of recs) if (r.parentId && r.status === CommentStatus.VISIBLE) replyCount.set(r.parentId, (replyCount.get(r.parentId) ?? 0) + 1);
      for (const c of commentsOut) c.replyCount = replyCount.get(c.id as string) ?? 0;
      for (const c of recs.filter((x) => x.status === CommentStatus.VISIBLE && chance(0.2))) {
        const liker = pick(everyone);
        const key = `${liker.id}|COMMENT|${c.id}`;
        if (!likeKey.has(key)) {
          likeKey.add(key);
          likeRows.push({ userId: liker.id, subjectType: SubjectType.COMMENT, subjectId: c.id, likedAt: daysAgo(rnd() * 20) });
        }
      }
      for (const part of chunks(commentsOut)) await db.contentComment.createMany({ data: part });
      for (const part of chunks(likeRows)) await db.contentLike.createMany({ data: part });
      summary.comments = commentsOut.length;
      summary.likes = likeRows.length;

      // Reshares, bookmarks, views
      const reshareRows: Prisma.ContentReshareCreateManyInput[] = [];
      const bookmarkRows: Prisma.ContentBookmarkCreateManyInput[] = [];
      const viewRows: Prisma.ContentViewCreateManyInput[] = [];
      const rsKey = new Set<string>();
      const bmKey = new Set<string>();
      const vwKey = new Set<string>();
      for (const u of everyone) {
        for (const s of sample(popular(30), int(0, 2))) {
          const key = `${u.id}|${s.type}|${s.id}`;
          if (rsKey.has(key) || s.type === SubjectType.COMMENT) continue;
          rsKey.add(key);
          reshareRows.push({ sharerId: u.id, subjectType: s.type, subjectId: s.id, commentary: chance(0.45) ? pick(['This one!', 'Everyone needs to read this.', 'Throwback to a great trail.', 'On On!']) : null, createdAt: daysAgo(rnd() * 20), undoneAt: chance(0.04) ? daysAgo(1) : null });
        }
        for (const s of sample(popular(30), int(0, 5))) {
          const key = `${u.id}|${s.type}|${s.id}`;
          if (bmKey.has(key)) continue;
          bmKey.add(key);
          bookmarkRows.push({ userId: u.id, subjectType: s.type, subjectId: s.id, note: chance(0.2) ? 'Come back to this' : null, createdAt: daysAgo(rnd() * 25), removedAt: chance(0.05) ? daysAgo(1) : null });
        }
        for (const s of popular(int(15, 45))) {
          const key = `${u.id}|${s.type}|${s.id}`;
          if (vwKey.has(key)) continue;
          vwKey.add(key);
          const first = daysAgo(rnd() * 28);
          viewRows.push({ viewerId: u.id, subjectType: s.type, subjectId: s.id, firstViewedAt: first, lastViewedAt: plus(first, int(0, 3000)), viewCount: int(1, 6) });
        }
      }
      for (const part of chunks(reshareRows)) await db.contentReshare.createMany({ data: part });
      for (const part of chunks(bookmarkRows)) await db.contentBookmark.createMany({ data: part });
      for (const part of chunks(viewRows)) await db.contentView.createMany({ data: part });

      // Denormalised counters, computed from the rows above.
      const stats = new Map<string, Prisma.ContentStatsCreateManyInput>();
      const stat = (t: SubjectType, id: string) => {
        const key = `${t}|${id}`;
        if (!stats.has(key)) stats.set(key, { subjectType: t, subjectId: id, likeCount: 0, commentCount: 0, reshareCount: 0, bookmarkCount: 0, viewerCount: 0, anonViewCount: 0 });
        return stats.get(key)!;
      };
      for (const l of likeRows) if (!l.unlikedAt) stat(l.subjectType, l.subjectId).likeCount!++;
      for (const c of commentsOut) if (c.status === CommentStatus.VISIBLE) stat(c.subjectType, c.subjectId).commentCount!++;
      for (const r of reshareRows) if (!r.undoneAt) stat(r.subjectType, r.subjectId).reshareCount!++;
      for (const b of bookmarkRows) if (!b.removedAt) stat(b.subjectType, b.subjectId).bookmarkCount!++;
      for (const v of viewRows) stat(v.subjectType, v.subjectId).viewerCount!++;
      for (const s of subjectsFiltered) {
        const st = stat(s.type, s.id);
        st.anonViewCount = Math.round(s.pop * int(10, 140));
      }
      for (const part of chunks([...stats.values()])) await db.contentStats.createMany({ data: part });

      // ── notifications for the accounts most likely to be logged in as ──
      const notifyFor = [demoHasher.id, ...abujaOfficers.slice(0, 2).map((u) => u.id), ...lagosOfficers.slice(0, 1).map((u) => u.id), ...people.slice(0, 6).map((p) => p.u.id)];
      const notificationRows: Prisma.NotificationCreateManyInput[] = [];
      for (const userId of notifyFor) {
        const homeRuns = sample(kennels.get('abuja-h3-abuja')!.runs.filter((r) => !r.past), 3);
        const pastRun = pick(reportSubjects.filter((r) => r.run.reportPublished)).run;
        const mk = (category: NotificationCategory, title: string, body: string, contextType: string, contextId: string, read: boolean, priority: NotificationPriority = NotificationPriority.NORMAL, ageDays = rnd() * 9) => {
          const at = daysAgo(ageDays);
          notificationRows.push({ recipientUserId: userId, category, priority, status: read ? NotificationStatus.READ : NotificationStatus.DELIVERED, title, body, contextType, contextId, deliveredAt: at, readAt: read ? plus(at, 40) : null, createdAt: at });
        };
        for (const r of homeRuns) mk(NotificationCategory.RUN, `New run: ${r.title}`, `${r.kennel.shortName} announced a run. On On!`, 'Run', r.id, chance(0.4));
        mk(NotificationCategory.REPORT, 'A trail report was published', `${pastRun.title} now has a write-up.`, 'TrailReport', pastRun.reportId!, chance(0.5));
        mk(NotificationCategory.TRAIL_RELEASE, 'Trail released', 'The hares have released the trail. Time to chase them.', 'Run', pastRun.id, true, NotificationPriority.HIGH);
        mk(NotificationCategory.MEMBERSHIP, 'Welcome to the kennel', 'Your membership was approved. On On!', 'Run', pastRun.id, true);
        mk(NotificationCategory.SOCIAL, `${label(pick(everyone))} liked your post`, 'Somebody out there enjoyed it.', 'Post', pick(postMeta.filter((p) => p.status === PostStatus.PUBLISHED)).id, false, NotificationPriority.LOW, rnd() * 3);
        mk(NotificationCategory.REMINDER, 'A run still needs a hare', 'No hare yet for an upcoming date. Put your hand up?', 'Run', pick(homeRuns).id, false, NotificationPriority.NORMAL, 1);
      }
      for (const part of chunks(notificationRows)) await db.notification.createMany({ data: part });

      // A login with no authority anywhere, for testing what an ordinary hasher sees.
      const officerIds = new Set([...kennels.values()].flatMap((k) => k.officers.map((o) => o.id)));
      const roleHolders = new Set((await db.roleAssignment.findMany({ where: { runId: null }, select: { userId: true } })).map((r) => r.userId));
      const hareIds = new Set(hareRows.map((h) => h.userId));
      plainEmail = people.find((p) => !officerIds.has(p.u.id) && !roleHolders.has(p.u.id) && !hareIds.has(p.u.id))?.email ?? 'member50@hcp.test';
      gmEmails = ['abuja-h3-abuja', 'lagos-h3-lagos', 'kigali-h3-kigali'].map((s) => {
        const gm = K(s).officers[0];
        return `${s.split('-')[0]}: ${officers.find((o) => o.id === gm?.id)?.email ?? people.find((p) => p.u.id === gm?.id)?.email}`;
      });
      await db.platformSetting.create({ data: { key: MARKER, value: { at: now.toISOString() } as Prisma.InputJsonValue, description: 'Heavy seed applied' } });
      allUserIds = [...new Set(allUserIds)];
    },
    { timeout: 15 * 60 * 1000, maxWait: 60 * 1000 },
  );

  // Derived from attendance, so it runs once the data is in: stamps, milestones,
  // places and lifetime statistics.
  console.log(`Rebuilding ${allUserIds.length} Hash Passports ...`);
  for (const id of allUserIds) await rebuildPassport(id);

  console.log('\nHeavy seed complete.');
  console.log(`  Hashers:        ${summary.users} (member01..member${pad2(summary.users - 3)}@hcp.test, plus unverified / suspended / deactivated@hcp.test)`);
  console.log(`  Runs:           ${summary.runs}   Attendance rows: ${summary.participations}`);
  console.log(`  Trail reports:  ${summary.reports}   Photos: ${summary.photos}   Reels: ${summary.reels}   Posts: ${summary.posts}`);
  console.log(`  Follows: ${summary.follows}   Likes: ${summary.likes}   Comments: ${summary.comments}`);
  console.log(`  Password for every seeded account: ${env.seedUserPassword}`);
  console.log('  Useful logins:');
  console.log('    admin@hcp.test        platform admin');
  console.log('    officer1@hcp.test     Abuja Grand Master and kennel admin');
  console.log('    officer3@hcp.test     Abuja scribe');
  console.log(`    ${plainEmail.padEnd(21)} an ordinary hasher: no office, no role, never a hare`);
  console.log(`    Grand Masters         ${gmEmails.join(' | ')}`);
  console.log('    kumasi-h3-kumasi has the 4 mismanagement it needs: activate it from the admin app');
  console.log('    ibadan-h3-ibadan and enugu-h3-enugu are short of them, to test the D10 gate\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
