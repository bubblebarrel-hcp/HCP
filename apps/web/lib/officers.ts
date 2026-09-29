// The permission keys, in the words a hasher would use rather than the dotted
// strings the API stores. Mirrors KENNEL_PERMISSIONS in the API and
// CODEX/PERMISSION-MATRIX.md; keep the three in step.
export const permissionLabel: Record<string, string> = {
  'membership.review': 'Review join requests',
  'membership.suspend': 'Suspend and reinstate members',
  'membership.remove': 'Remove members',
  'membership.invite': 'Invite new members',
  'officer.appoint': 'Appoint officers',
  'kennel.manage': 'Manage the kennel and its offices',
  'run.manage': 'Create and run the kennel’s runs',
  'run.visibility.change': 'Change run privacy',
  'trail.manage': 'Plan and release trails',
  'report.publish': 'Publish trail reports',
  'media.moderate': 'Moderate photos',
};

export const ALL_PERMISSION_KEYS = Object.keys(permissionLabel);

export const appointmentMethodLabel: Record<string, string> = {
  APPOINTED: 'Appointed',
  ELECTED: 'Elected',
  ACCLAIMED: 'Acclaimed',
  INTERIM: 'Interim',
  FOUNDING: 'Founding',
};

export const appointmentStatusLabel: Record<string, string> = {
  NOMINATED: 'Nominated',
  APPOINTED: 'Appointed',
  ACTIVE: 'Serving',
  TERM_ENDED: 'Term ended',
  RESIGNED: 'Resigned',
  REVOKED: 'Revoked',
  HISTORICAL: 'Historical',
};

export function appointmentTone(status: string) {
  if (status === 'ACTIVE') return 'bg-primary text-primary-foreground';
  if (status === 'REVOKED') return 'bg-destructive/10 text-destructive';
  return 'text-muted-foreground';
}

// A delegation that has run out reads differently from one taken back.
export function delegationState(d: { live: boolean; revokedAt: string | null; expiresAt: string }) {
  if (d.revokedAt) return { label: 'Revoked', tone: 'bg-destructive/10 text-destructive' };
  if (d.live) return { label: 'Live', tone: 'bg-primary text-primary-foreground' };
  if (new Date(d.expiresAt) <= new Date()) return { label: 'Expired', tone: 'text-muted-foreground' };
  return { label: 'Scheduled', tone: 'bg-accent text-accent-foreground' };
}
