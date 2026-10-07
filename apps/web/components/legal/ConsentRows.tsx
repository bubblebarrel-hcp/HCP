'use client';

import { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { LegalReader } from '@/components/legal/LegalReader';
import { LEGAL_DOCS, type LegalDoc } from '@/lib/legal';
import { cn } from '@/lib/utils';

export type Consent = { terms: boolean; privacy: boolean };

// The sign-up consent: one row per document, each opening the reader. A row only
// turns to "Accepted" once its document has been scrolled to the end, and the
// form stays blocked until both are.
export function ConsentRows({ value, onChange, error }: { value: Consent; onChange: (next: Consent) => void; error?: string }) {
  const [open, setOpen] = useState<LegalDoc | null>(null);

  return (
    <div className="space-y-2" data-testid="register-consent">
      <p className="text-sm font-medium">Terms and privacy</p>
      <p className="text-sm text-muted-foreground">Read each document to the end and accept it to create your account.</p>
      <ul className="space-y-2">
        {([LEGAL_DOCS.terms, LEGAL_DOCS.privacy] as LegalDoc[]).map((doc) => {
          const accepted = value[doc.slug];
          return (
            <li key={doc.slug}>
              <button
                type="button"
                onClick={() => setOpen(doc)}
                data-testid={`register-read-${doc.slug}`}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  accepted ? 'border-primary-strong/40' : 'border-border',
                )}
              >
                <span
                  className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border', accepted ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}
                  aria-hidden
                >
                  {accepted && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1 font-medium">{doc.title}</span>
                <span className={cn('text-xs', accepted ? 'font-medium text-primary-strong' : 'text-muted-foreground')}>{accepted ? 'Accepted' : 'Read and accept'}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {open && (
        <LegalReader
          doc={open}
          open
          alreadyAccepted={value[open.slug]}
          onAccept={() => {
            onChange({ ...value, [open.slug]: true });
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
