import type { ReactNode } from 'react';
import { Linking, Text, type StyleProp, type TextStyle } from 'react-native';

// Rich text for direct messages (D73), the same marks as the web
// (apps/web/lib/chat-format.tsx) so a message reads the same on both:
//
//   *bold*   _italic_   ~strike~   `mono`
//
// A mark opens at the start of a word and closes at the end of one, on the same
// line, so snake_case, 2*3*4 and a lone * stay exactly as typed. Links are
// recognised too, and only http and https are ever opened.

type Mark = '*' | '_' | '~' | '`';

const isMark = (ch: string): ch is Mark => ch === '*' || ch === '_' || ch === '~' || ch === '`';
const WORD = /[\p{L}\p{N}]/u;
const SPACE = /\s/;

const MARK_STYLE: Record<Mark, TextStyle> = {
  '*': { fontWeight: '700' },
  _: { fontStyle: 'italic' },
  '~': { textDecorationLine: 'line-through' },
  '`': { fontFamily: 'monospace', backgroundColor: 'rgba(0,0,0,0.12)' },
};

function closeOf(src: string, from: number, mark: Mark) {
  for (let j = from + 1; j < src.length; j++) {
    const ch = src[j];
    if (ch === '\n') return -1;
    if (ch !== mark || j === from + 1) continue;
    if (SPACE.test(src[j - 1])) continue;
    if (j + 1 < src.length && WORD.test(src[j + 1])) continue;
    return j;
  }
  return -1;
}

function opensAt(src: string, i: number, mark: Mark) {
  if (i > 0 && WORD.test(src[i - 1])) return false;
  const next = src[i + 1];
  return Boolean(next) && !SPACE.test(next) && next !== mark;
}

const URL_AT = /https?:\/\/[^\s<>"']+/g;

function linkify(text: string, key: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_AT)) {
    const start = match.index ?? 0;
    // Trailing punctuation belongs to the sentence, not the address.
    const url = match[0].replace(/[.,!?;:)\]]+$/, '');
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <Text key={`${key}-l${start}`} style={{ textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(url).catch(() => undefined)}>
        {url}
      </Text>,
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function parse(src: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push(...linkify(buf, `${key}-${out.length}`));
    buf = '';
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (isMark(ch) && opensAt(src, i, ch)) {
      const close = closeOf(src, i, ch);
      if (close > i + 1) {
        flush();
        const inner = src.slice(i + 1, close);
        const k = `${key}-${out.length}`;
        out.push(
          <Text key={k} style={MARK_STYLE[ch]}>
            {/* Inside code, marks are just characters. */}
            {ch === '`' ? inner : parse(inner, k)}
          </Text>,
        );
        i = close + 1;
        continue;
      }
    }
    buf += ch;
    i += 1;
  }
  flush();
  return out;
}

/** A message's words with their marks drawn. Line breaks are kept. */
export function FormattedText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  return <Text style={style}>{parse(text, 'f')}</Text>;
}

/** The words with their marks removed: for a preview or a screen reader. */
export function plainText(text: string): string {
  return text.replace(/(^|[^\p{L}\p{N}])([*_~`])(\S(?:[^\n]*?\S)?)\2(?![\p{L}\p{N}])/gu, '$1$3');
}

/**
 * The toolbar's button: wrap the selection in a mark, or take the mark off if it
 * is already there. With nothing selected it leaves the cursor between a pair.
 */
export function toggleMark(value: string, start: number, end: number, mark: Mark) {
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);
  if (selected && before.endsWith(mark) && after.startsWith(mark)) {
    return { value: before.slice(0, -1) + selected + after.slice(1), start: start - 1, end: end - 1 };
  }
  if (selected.length >= 2 && selected.startsWith(mark) && selected.endsWith(mark)) {
    return { value: before + selected.slice(1, -1) + after, start, end: end - 2 };
  }
  return { value: `${before}${mark}${selected}${mark}${after}`, start: start + 1, end: end + 1 };
}
