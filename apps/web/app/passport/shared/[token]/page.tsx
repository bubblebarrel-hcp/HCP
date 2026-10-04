'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { PassportView } from '@/components/passport/PassportView';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { HashPassport } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// FR-PASSPORT-007: a read-only passport for anyone holding the link. No account
// needed, no memories, no way back to the hasher's private data.
export default function SharedPassportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [passport, setPassport] = useState<HashPassport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: { passport: HashPassport } }>(`/passports/shared/${token}`)
      .then((res) => {
        if (!cancelled) setPassport(res.data.data.passport);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'This passport link is not valid'));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />} wide>
      {children}
    </FeedLayout>
  );

  if (error) {
    return shell(
      <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="shared-passport-error">
        <p className="font-semibold">{error}</p>
        <p className="mt-1 text-sm text-muted-foreground">The hasher may have created a new link.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/">Back to Shiggy Trails</Link>
        </Button>
      </Card>,
    );
  }
  if (!passport) return shell(<div className="h-96 animate-pulse bg-card sm:rounded-xl" aria-busy />);

  return shell(
    <div className="space-y-4">
      <PassportView passport={passport} />
      <p className="px-4 text-sm text-muted-foreground sm:px-0">
        Shared Hash Passport, read only.{' '}
        <Link href="/auth/register" className="font-medium text-primary-strong hover:underline">
          Start your own
        </Link>
        .
      </p>
    </div>,
  );
}
