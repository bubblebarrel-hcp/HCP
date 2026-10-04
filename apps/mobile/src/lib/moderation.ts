// Reporting (D61). The reasons, in the words a hasher reads. The API's
// ReportReason enum is the source; keep them in step with apps/web/lib/moderation.ts.

export type ReportTargetType = 'USER' | 'POST' | 'REEL' | 'COMMENT' | 'MEDIA_ASSET';
export type ReportReason =
  | 'SPAM'
  | 'SCAM'
  | 'HARASSMENT'
  | 'HATE'
  | 'VIOLENCE'
  | 'SEXUAL'
  | 'PRIVATE_INFO'
  | 'SELF_HARM'
  | 'IMPERSONATION'
  | 'OTHER';

export const REPORT_REASONS: { value: ReportReason; label: string; hint: string; hasherOnly?: boolean }[] = [
  { value: 'IMPERSONATION', label: 'Pretending to be someone', hint: "Using somebody's name, picture or identity.", hasherOnly: true },
  { value: 'HARASSMENT', label: 'Harassment or bullying', hint: 'Targeting, insulting or hounding somebody.' },
  { value: 'VIOLENCE', label: 'Violence or threats', hint: 'Threatening or encouraging harm.' },
  { value: 'SELF_HARM', label: 'Self-harm', hint: 'Somebody may be at risk of hurting themself.' },
  { value: 'HATE', label: 'Hate', hint: 'Attacking people for who they are.' },
  { value: 'SEXUAL', label: 'Nudity or sexual content', hint: 'Not for a hash community.' },
  { value: 'PRIVATE_INFO', label: 'Private information', hint: "Somebody's address, number or details, shared without them." },
  { value: 'SCAM', label: 'Scam or fraud', hint: 'Trying to get money or details out of people.' },
  { value: 'SPAM', label: 'Spam', hint: 'Repeated, unwanted or promotional.' },
  { value: 'OTHER', label: 'Something else', hint: 'Tell us in your own words.' },
];

export const TARGET_WORDS: Record<ReportTargetType, string> = {
  USER: 'this hasher',
  POST: 'this post',
  REEL: 'this reel',
  COMMENT: 'this comment',
  MEDIA_ASSET: 'this photo',
};

// What an engagement segment is, as a thing that can be reported. A trail report, a
// run and a Run Capsule are a kennel's record, not a hasher's.
export const REPORTABLE: Record<string, ReportTargetType | undefined> = {
  posts: 'POST',
  reels: 'REEL',
  photos: 'MEDIA_ASSET',
  comments: 'COMMENT',
};
