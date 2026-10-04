import Link from 'next/link';
import { tokenize } from '@/lib/entities';
import { cn } from '@/lib/utils';

// A hasher's words with their #hashtags and @mentions as links (D59). A server
// component on purpose: a post shared as a link still has working links in it
// without JavaScript.
//
// A mention goes to /u/<username>, which hands over to that hasher's page. It is
// drawn for anything shaped like a username, whether or not somebody holds it:
// the words are what was written, and the API alone decides who was told.
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {tokenize(text).map((token, index) => {
        if (token.kind === 'text') return token.text;
        const href = token.kind === 'tag' ? `/tags/${encodeURIComponent(token.tag)}` : `/u/${token.username}`;
        return (
          <Link
            key={index}
            href={href}
            className={cn('font-medium text-primary-strong hover:underline', className)}
            data-testid={token.kind === 'tag' ? 'hashtag-link' : 'mention-link'}
          >
            {token.text}
          </Link>
        );
      })}
    </>
  );
}
