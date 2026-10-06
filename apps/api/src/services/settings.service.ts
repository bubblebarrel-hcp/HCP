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
} as const;

type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getNumberSetting(key: SettingKey): Promise<number> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  const value = row?.value;
  return typeof value === 'number' ? value : SETTING_DEFAULTS[key];
}
