// #hashtags and @mentions in a hasher's own words (D59).
//
// These are the same patterns as apps/api/src/utils/entities.ts, which decides
// what is indexed and who is told. This file only draws them, but the two have
// to agree on what counts: changing one means changing the other.

// One pass, so a "#tag" inside an "@name" (or the other way round) is not found
// twice. Not preceded by a letter, digit or "_", so "page#top", "&#39;" and
// "mail@example.com" are plain text.
const ENTITY =
  /(?<![\p{L}\p{N}_&#/])#([\p{L}\p{N}_]{2,50})(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_@.])@([a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9]))(?![\p{L}\p{N}_@])/giu;

export type Token =
  | { kind: 'text'; text: string }
  | { kind: 'tag'; text: string; tag: string }
  | { kind: 'mention'; text: string; username: string };

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  const push = (token: Token) => {
    const previous = tokens[tokens.length - 1];
    // Whatever was not an entity stays one run of text.
    if (token.kind === 'text' && previous?.kind === 'text') previous.text += token.text;
    else tokens.push(token);
  };

  for (const match of text.matchAll(ENTITY)) {
    const index = match.index ?? 0;
    // Group 1 is a hashtag, group 2 a mention; the other is undefined.
    const [, tag, user] = match;
    const isTag = tag !== undefined && /\p{L}/u.test(tag);
    const isMention = user !== undefined && !user.includes('..');
    if (!isTag && !isMention) continue;

    if (index > last) push({ kind: 'text', text: text.slice(last, index) });
    if (isTag) push({ kind: 'tag', text: match[0], tag: tag.toLowerCase() });
    else push({ kind: 'mention', text: match[0], username: user.toLowerCase() });
    last = index + match[0].length;
  }
  if (last < text.length) push({ kind: 'text', text: text.slice(last) });
  return tokens;
}

// What is in a /tags/<tag> address, or null when it could not be a tag.
export function normalizeTag(raw: string) {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const tag = decoded.trim().replace(/^#/, '').toLowerCase();
  return /^[\p{L}\p{N}_]{2,50}$/u.test(tag) && /\p{L}/u.test(tag) ? tag : null;
}

// What the hasher is in the middle of typing, if it is a mention: the "@" before
// the caret and the letters after it. Null when the caret is anywhere else.
export function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = /(?:^|[^\p{L}\p{N}_@.])@([a-zA-Z0-9_.]{0,30})$/u.exec(before);
  if (!match) return null;
  return { start: before.length - match[1].length - 1, query: match[1] };
}
