import type { Engagement, ReactionKind } from '@/lib/types';

// The hash reactions (D60). ON_ON is the plain like and keeps the heart.
export const REACTIONS: { kind: ReactionKind; emoji: string | null; label: string }[] = [
  { kind: 'ON_ON', emoji: null, label: 'On On!' },
  { kind: 'BEER', emoji: '🍺', label: 'Beer check' },
  { kind: 'SHIGGY', emoji: '🥾', label: 'Shiggy' },
  { kind: 'DOWN_DOWN', emoji: '🍻', label: 'Down-down' },
];

export const reactionLabel = (kind: ReactionKind | null | undefined) =>
  REACTIONS.find((r) => r.kind === kind)?.label ?? 'On On!';

// For screens that are not handed an engagement by a feed read.
export const EMPTY_ENGAGEMENT: Engagement = {
  likes: 0,
  comments: 0,
  reshares: 0,
  bookmarks: 0,
  views: 0,
  liked: false,
  bookmarked: false,
  reshared: false,
  reactions: { ON_ON: 0, BEER: 0, SHIGGY: 0, DOWN_DOWN: 0 },
  myReaction: null,
};
