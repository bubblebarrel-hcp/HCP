'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, Copy, EyeOff, Link2, Loader2, Mail, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { getEngagement } from '@/lib/social';
import type { SubjectSegment } from '@/lib/types';
import { cn } from '@/lib/utils';

// Sending a link out of Shiggy Trails (D50). Distinct from Reshare, which passes a post
// along *inside* the platform and creates a feed entry: this puts a URL on
// somebody's clipboard or into WhatsApp, and Shiggy Trails never hears about it again.
//
// WhatsApp is first because it is where a hash flyer actually lives today —
// the whole premise of the run announcement card (D43).
//
// Nothing here is tracked. A share count would need the other end to report
// back, which it never does, so a number here would be a number of times the
// button was pressed dressed up as a number of times something was read.

interface Props {
  segment: SubjectSegment;
  id: string;
  // What the link is of, for the message text. The dialog asks the API for the
  // canonical path and the real label when it opens.
  fallbackLabel?: string;
  // Rendered as the dialog trigger via Radix `asChild`, so it must be a single
  // element that forwards a ref — a plain <button> does.
  trigger: React.ReactElement;
}

// Each channel takes the URL and the text and builds its own share link. These
// are the documented public endpoints; none of them need a key or an SDK, and
// none of them load third-party script into the page.
const channels: {
  name: string;
  build: (url: string, text: string) => string;
  className: string;
}[] = [
  {
    name: 'WhatsApp',
    // WhatsApp puts the text and the URL in one message, so the URL goes in the
    // text rather than in a separate parameter it would ignore.
    build: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    className: 'bg-[#25D366] text-black',
  },
  {
    name: 'Telegram',
    build: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    className: 'bg-[#229ED9] text-white',
  },
  {
    name: 'X',
    build: (url, text) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    className: 'bg-foreground text-background',
  },
  {
    name: 'Facebook',
    // Facebook reads the page's own Open Graph tags and ignores any text passed
    // here, so only the URL is sent.
    build: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    className: 'bg-[#1877F2] text-white',
  },
];

// navigator.share never changes, so there is nothing to subscribe to.
const subscribeNever = () => () => {};

export function ShareDialog({ segment, id, fallbackLabel, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [label, setLabel] = useState(fallbackLabel ?? 'this');
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyHint, setCopyHint] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);

  // `navigator.share` exists on phones and not on most desktops, and asking on
  // the server would be guessing.
  const canNativeShare = useSyncExternalStore(
    subscribeNever,
    () => typeof navigator.share === 'function',
    () => false,
  );

  // The canonical path comes from the API, not from wherever the reader happens
  // to be standing — a photo's card sits in the feed but its link is the run.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    setCopied(false);
    setCopyHint(false);
    getEngagement(segment, id)
      .then((detail) => {
        if (!alive) return;
        setUrl(new URL(detail.subject.href, window.location.origin).toString());
        setLabel(detail.subject.label || fallbackLabel || 'this');
        setIsPublic(detail.subject.isPublic);
      })
      .catch(() => {
        // Fall back to the address bar rather than showing nothing: a link to
        // the page the reader is on is still a working link.
        if (alive) setUrl(window.location.href);
      });
    return () => {
      alive = false;
    };
  }, [open, segment, id, fallbackLabel]);

  const text = `${label} — on Shiggy Trails`;

  // The clipboard API needs a secure context and a permission the browser can
  // refuse — over plain http on a phone on the kennel's wifi, it will. So this
  // falls back to selecting the field and asking the old command, and if even
  // that is refused it says so and leaves the link selected for the reader to
  // copy themselves. A Copy button that silently does nothing is the one
  // outcome worth ruling out.
  const copy = async () => {
    if (!url) return;
    const done = () => {
      setCopied(true);
      setCopyHint(false);
      window.setTimeout(() => setCopied(false), 2000);
    };

    try {
      await navigator.clipboard.writeText(url);
      done();
      return;
    } catch {
      // Fall through.
    }

    const field = fieldRef.current;
    if (field) {
      field.focus();
      field.select();
      try {
        if (document.execCommand('copy')) {
          done();
          return;
        }
      } catch {
        // Fall through.
      }
    }
    setCopied(false);
    setCopyHint(true);
  };

  const nativeShare = async () => {
    if (!url) return;
    try {
      await navigator.share({ title: label, text, url });
      setOpen(false);
    } catch {
      // Cancelling the sheet throws; that is not an error worth showing.
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* asChild so the caller's own button is the trigger: Radix then owns the
          focus return and the keyboard, rather than a div listening for clicks. */}
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {open && (
        <DialogContent title="Share" description="Send a link to this, anywhere.">
          {!url ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Getting the link…
            </p>
          ) : (
            <div className="space-y-4">
              {/* Honesty before the send: a members-only run's link is a 404 to
                  everybody it reaches, and finding that out from a confused
                  reply is worse than being told now. */}
              {isPublic === false && (
                <p className="flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-sm">
                  <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    This one is not public. Anybody who opens the link without the right membership will be told it
                    does not exist.
                  </span>
                </p>
              )}

              <div>
                <label htmlFor={`share-url-${id}`} className="text-sm font-medium">
                  Link
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id={`share-url-${id}`}
                    ref={fieldRef}
                    readOnly
                    value={url}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="share-url"
                  />
                  <Button type="button" onClick={copy} data-testid="share-copy">
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" aria-hidden /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" aria-hidden /> Copy
                      </>
                    )}
                  </Button>
                </div>
                {copyHint && (
                  <p className="mt-1 text-sm text-muted-foreground" data-testid="share-copy-hint">
                    This browser would not let the page use the clipboard. The link is selected — copy it yourself.
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium">Send it</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {channels.map((channel) => (
                    <a
                      key={channel.name}
                      href={channel.build(url, text)}
                      target="_blank"
                      // noreferrer as well as noopener: the receiving site has
                      // no business knowing which Shiggy Trails page this came from.
                      rel="noopener noreferrer"
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-semibold',
                        'transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        channel.className,
                      )}
                      data-testid={`share-${channel.name.toLowerCase()}`}
                    >
                      {channel.name}
                    </a>
                  ))}

                  <a
                    href={`mailto:?subject=${encodeURIComponent(label)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    data-testid="share-email"
                  >
                    <Mail className="h-4 w-4" aria-hidden /> Email
                  </a>

                  {/* The phone's own share sheet reaches everything else a
                      hasher actually uses, so there is no list to keep growing. */}
                  {canNativeShare && (
                    <button
                      type="button"
                      onClick={nativeShare}
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      data-testid="share-native"
                    >
                      <Share2 className="h-4 w-4" aria-hidden /> More…
                    </button>
                  )}
                </div>
              </div>

              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Sharing happens outside Shiggy Trails, so nothing here is counted. To pass it on inside the hash, use Reshare.
              </p>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
