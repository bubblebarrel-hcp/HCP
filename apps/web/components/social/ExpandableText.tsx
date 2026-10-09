'use client';
import { useState } from 'react';
import Link from 'next/link';
import { RichText } from '@/components/social/RichText';

// A long post, cut short with a "Read more" (D51). Cutting happens on the text
// itself rather than with CSS, so the server-rendered page carries only the
// preview and "Read more" is a real link to the post, which is how it works with
// JavaScript off. With JavaScript on, the same click opens the rest in place.
//
// The cut is at a word, never inside a #tag or @mention, so RichText still links
// what is left.

export const PREVIEW_CHARS = 280;
export const PREVIEW_LINES = 6;

// Where to cut, or null when the text is short enough to show whole.
export function previewOf(text: string, maxChars = PREVIEW_CHARS, maxLines = PREVIEW_LINES) {
  const lines = text.split('\n');
  let cut = text;
  if (lines.length > maxLines) cut = lines.slice(0, maxLines).join('\n');
  if (cut.length > maxChars) {
    cut = cut.slice(0, maxChars);
    const lastSpace = cut.search(/\s\S*$/);
    if (lastSpace > maxChars * 0.6) cut = cut.slice(0, lastSpace);
  }
  return cut.length < text.length ? cut.trimEnd() : null;
}

export function ExpandableText({
  text,
  href,
  className,
  'data-testid': testId,
}: {
  text: string;
  // Where the whole post lives; the no-JavaScript "Read more" goes here.
  href: string;
  className?: string;
  'data-testid'?: string;
}) {
  const [open, setOpen] = useState(false);
  const preview = open ? null : previewOf(text);

  return (
    <p className={className} data-testid={testId}>
      <RichText text={preview ?? text} />
      {preview !== null && (
        <>
          {'… '}
          <Link
            href={href}
            onClick={(event) => {
              // Plain clicks open it here; a modified click still opens the post.
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              setOpen(true);
            }}
            className="font-medium text-primary-strong hover:underline"
            data-testid="read-more"
          >
            Read more
          </Link>
        </>
      )}
    </p>
  );
}
