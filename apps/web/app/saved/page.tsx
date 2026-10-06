'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark as BookmarkIcon, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { useAuth } from '@/context/AuthContext';
import { listBookmarks, setBookmarked } from '@/lib/social';
import type { Bookmark, SubjectSegment } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';

// What this hasher saved (D50). Private, always: a bookmark is never shown to
// anybody else and never told the author, which is the difference between
// saving something and applauding it.

const filters: { label: string; segment?: SubjectSegment }[] = [
  { label: 'Everything' },
  { label: 'Reels', segment: 'reels' },
  { label: 'Trail reports', segment: 'reports' },
  { label: 'Photos', segment: 'photos' },
  { label: 'Runs', segment: 'runs' },
  { label: 'Capsules', segment: 'capsules' },
];

const subjectWords: Record<string, string> = {
  REEL: 'Reel',
  TRAIL_REPORT: 'Trail report',
  MEDIA_ASSET: 'Photo',
  RUN: 'Run',
  RUN_CAPSULE: 'Run Capsule',
};

export default function SavedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [segment, setSegment] = useState<SubjectSegment | undefined>();
  const [rows, setRows] = useState<Bookmark[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setRows((await listBookmarks(1, segment)).items);
    } catch {
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [segment]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    if (user) void load();
  }, [user, load]);

  const unsave = async (row: Bookmark) => {
    // Optimistic: the row goes now and comes back only if the API refuses.
    setRows((current) => current?.filter((b) => b.id !== row.id) ?? null);
    try {
      await setBookmarked(row.subjectSegment, row.subjectId, false);
    } catch {
      void load();
    }
  };

  return (
    <FeedLayout left={<LeftNav />}>
      <h1 className="px-4 text-2xl font-semibold sm:px-0">Saved</h1>
      <p className="mt-1 px-4 text-sm text-muted-foreground sm:px-0">
        Only you can see this. Saving something never tells the hasher who made it.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 px-4 sm:px-0">
        {filters.map((filter) => (
          <button
            key={filter.label}
            type="button"
            onClick={() => setSegment(filter.segment)}
            aria-pressed={segment === filter.segment}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              segment === filter.segment
                ? 'border-primary bg-primary/10 text-primary-strong font-medium'
                : 'border-border hover:bg-muted',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {busy && rows === null ? (
          <p className="flex items-center gap-2 px-4 text-sm text-muted-foreground sm:px-0">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </p>
        ) : (rows?.length ?? 0) === 0 ? (
          <Card className="border-dashed p-10 text-center">
            <BookmarkIcon className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium">Nothing saved yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The bookmark on any card puts it here.{' '}
              <Link href="/" className="text-primary-strong hover:underline">
                Back to the feed
              </Link>
              .
            </p>
          </Card>
        ) : (
          <ul className="space-y-2" data-testid="saved-list">
            {rows?.map((row) => (
              <li key={row.id}>
                <Card className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {subjectWords[row.subjectType] ?? 'Post'} · saved{' '}
                      <time dateTime={row.savedAt}>{formatDate(row.savedAt)}</time>
                    </p>
                    {row.available && row.href ? (
                      <Link href={row.href} className="mt-0.5 block font-medium hover:underline">
                        {row.label}
                      </Link>
                    ) : (
                      // Kept so it can be unsaved, but it says nothing about
                      // what it was: it may have gone private, not just away.
                      <p className="mt-0.5 font-medium text-muted-foreground">No longer available to you</p>
                    )}
                    {row.note && <p className="mt-1 text-sm text-muted-foreground">{row.note}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => unsave(row)} data-testid="saved-remove">
                    Remove
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FeedLayout>
  );
}
