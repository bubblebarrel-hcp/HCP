import prisma from '../config/prisma';

// Platform-wide configurable values with code defaults. The database row wins
// when present, so an admin can tune a value without a deploy.
export const SETTING_DEFAULTS = {
  // D10: a kennel needs at least this many active mismanagement members to be
  // verified at any level above PENDING.
  'kennel.verification.minMismanagement': 4,
  // FR-MEMBER-002 / D20: days after a rejection or removal before the same
  // hasher may ask to join that kennel again.
  'membership.reapplyCooldownDays': 30,
  // D45: how far ahead a kennel is told that a run still has no hare, and how
  // close it has to get before the whole kennel is asked rather than the
  // officers alone.
  'hare.nudge.soonDays': 21,
  'hare.nudge.urgentDays': 7,
  // FR-MEMBER-005: how long an invitation link/QR/email stays redeemable.
  'membership.invitationExpiryDays': 14,
  // FR-NOT-013/016: when work waiting on a person is first mentioned, and when
  // it is raised with whoever runs the kennel. Each step happens once.
  'escalation.membership.waitingDays': 3,
  'escalation.membership.escalatedDays': 7,
  'escalation.report.overdueDays': 5,
  'escalation.report.escalatedDays': 12,
  // D74: automatic action when enough different hashers report the same person.
  // 1 is on, 0 is off. Everything below is read each time, so a change applies at
  // once and to no past decision.
  'moderation.auto.enabled': 1,
  // Reports older than this stop counting.
  'moderation.auto.windowDays': 30,
  // The score at which a hasher is warned, held for a while, and held for review.
  'moderation.auto.warnScore': 3,
  'moderation.auto.holdScore': 5,
  'moderation.auto.reviewScore': 8,
  // How long a hold lasts before it lifts by itself.
  'moderation.auto.holdHours': 72,
  // A reporter's account must be at least this old for a report to count.
  'moderation.auto.minReporterAgeDays': 7,
} as const;

type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getNumberSetting(key: SettingKey): Promise<number> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  const value = row?.value;
  return typeof value === 'number' ? value : SETTING_DEFAULTS[key];
}

// Text settings. Kept apart from the numeric ones so a number is never read as text.
export const STRING_SETTING_DEFAULTS = {
  // The app version gate. Below `min` the app is blocked until it is updated;
  // below `latest` it only asks. Both are plain x.y.z, compared by number.
  'mobile.version.min': '1.0.0',
  'mobile.version.latest': '1.0.0',
  'mobile.storeUrl.android': 'https://play.google.com/store/apps/details?id=com.shiggytrails.app',
  // Empty until the app is on the App Store; the app then offers no link.
  'mobile.storeUrl.ios': '',
} as const;

type StringSettingKey = keyof typeof STRING_SETTING_DEFAULTS;

export async function getStringSetting(key: StringSettingKey): Promise<string> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  const value = row?.value;
  return typeof value === 'string' ? value : STRING_SETTING_DEFAULTS[key];
}
