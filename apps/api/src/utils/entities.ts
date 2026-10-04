// #hashtags and @mentions in a hasher's own words (D59).
//
// The same patterns are in apps/web/lib/entities.ts, which draws them; the two
// have to agree on what counts, so changing one means changing the other.

// A username is what a mention is typed as: lowercase letters, digits, "_" and
// ".", 3 to 30 characters, starting and ending on a letter or digit. A hash
// handle cannot do the job: it has spaces and is not unique.
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9])$/;

// Names no hasher can hold, so a mention never reads like the platform speaking.
export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'moderator',
  'mod',
  'support',
  'help',
  'staff',
  'team',
  'official',
  'system',
  'root',
  'hcp',
  'shiggy',
  'shiggytrails',
  'everyone',
  'all',
  'here',
  'channel',
  'kennel',
  'mismanagement',
  'hare',
  'scribe',
]);

export function isValidUsername(candidate: string) {
  return USERNAME_PATTERN.test(candidate) && !candidate.includes('..') && !RESERVED_USERNAMES.has(candidate);
}

// Not preceded by a letter, digit, "_", "&" or "/" — so a URL fragment
// ("page#top") and an HTML entity ("&#39;") are not tags — and with at least one
// letter in it, so "#1" is a number and not a tag.
const HASHTAG = /(?<![\p{L}\p{N}_&#/])#([\p{L}\p{N}_]{2,50})(?![\p{L}\p{N}_])/gu;

// Not preceded by anything that makes it an e-mail address or part of a word, and
// not followed by something that would make it longer than a username can be.
const MENTION = /(?<![\p{L}\p{N}_@.])@([a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9]))(?![\p{L}\p{N}_@])/giu;

// A post that tags forty things is shouting, not labelling. Past these the rest is
// ordinary text.
export const MAX_TAGS = 20;
export const MAX_MENTIONS = 10;

export interface Entities {
  // Lowercase, without the "#".
  tags: string[];
  // Lowercase, without the "@".
  mentions: string[];
}

export function extractEntities(text: string | null | undefined): Entities {
  if (!text) return { tags: [], mentions: [] };

  const tags = new Set<string>();
  for (const match of text.matchAll(HASHTAG)) {
    if (!/\p{L}/u.test(match[1])) continue;
    tags.add(match[1].toLowerCase());
    if (tags.size >= MAX_TAGS) break;
  }

  const mentions = new Set<string>();
  for (const match of text.matchAll(MENTION)) {
    const name = match[1].toLowerCase();
    if (name.includes('..')) continue;
    mentions.add(name);
    if (mentions.size >= MAX_MENTIONS) break;
  }

  return { tags: [...tags], mentions: [...mentions] };
}

// What a hasher types after a "#" in a search box or a URL.
export function normalizeTag(raw: string) {
  const tag = raw.trim().replace(/^#/, '').toLowerCase();
  return /^[\p{L}\p{N}_]{2,50}$/u.test(tag) && /\p{L}/u.test(tag) ? tag : null;
}

// A username made from a hash handle: the first free one wins, and anything that
// cannot be made into a valid name falls back to "hasher_" and a number.
export function usernameFrom(handle: string | null | undefined) {
  const slug = (handle ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
    .replace(/_+$/g, '');
  return isValidUsername(slug) ? slug : null;
}
