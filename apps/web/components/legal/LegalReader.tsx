'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LegalDocument } from '@/components/legal/LegalDocument';
import type { LegalDoc } from '@/lib/legal';

// How close to the bottom (px) counts as having reached the end.
const END_TOLERANCE = 24;

// Sign-up reader: the document in a dialog, with the accept button disabled
// until it has been scrolled to the end. Someone who already accepted can
// re-read it with the button gone.
export function LegalReader({
  doc,
  open,
  alreadyAccepted,
  onAccept,
  onClose,
}: {
  doc: LegalDoc;
  open: boolean;
  alreadyAccepted: boolean;
  onAccept: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title={doc.title}
        description="Read to the end to accept."
        className="max-w-3xl overflow-hidden p-0 [&>div:first-child]:px-6 [&>div:first-child]:pt-5"
      >
        {/* Mounted only while open, so scroll state resets on every open. */}
        <ReaderBody doc={doc} alreadyAccepted={alreadyAccepted} onAccept={onAccept} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function ReaderBody({ doc, alreadyAccepted, onAccept, onClose }: { doc: LegalDoc; alreadyAccepted: boolean; onAccept: () => void; onClose: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(alreadyAccepted);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    // Nothing to scroll (tall screen, short document): already at the end.
    if (max <= END_TOLERANCE) {
      setProgress(1);
      setReachedEnd(true);
      return;
    }
    setProgress(Math.min(1, el.scrollTop / max));
    if (max - el.scrollTop <= END_TOLERANCE) setReachedEnd(true);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.focus({ preventScroll: true }); // so arrow keys and space scroll the document
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const pct = Math.round(progress * 100);

  return (
    <div className="flex h-[70dvh] max-h-[44rem] flex-col">
      <div className="px-6 pb-3">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`${doc.title} reading progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div
        ref={scroller}
        tabIndex={0}
        role="region"
        aria-label={doc.title}
        onScroll={measure}
        data-testid={`legal-scroll-${doc.slug}`}
        className="min-h-0 flex-1 overflow-y-auto border-y border-border px-6 py-6 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <LegalDocument doc={doc} />
      </div>

      <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {reachedEnd ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-primary-strong">
              <Check className="h-4 w-4" aria-hidden />
              {alreadyAccepted ? 'You have already accepted this.' : 'You have reached the end.'}
            </span>
          ) : (
            <>Scroll to the end to enable the button ({pct}%).</>
          )}
        </p>
        <div className="flex gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            {alreadyAccepted ? 'Close' : 'Cancel'}
          </Button>
          {!alreadyAccepted && (
            <Button type="button" disabled={!reachedEnd} onClick={onAccept} data-testid={`legal-accept-${doc.slug}`}>
              I have read and accept
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
