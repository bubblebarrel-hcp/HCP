'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { InvitationsPanel } from '@/components/membership/InvitationsPanel';
import { MemberCard } from '@/components/membership/MemberCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { notifyMembershipsChanged } from '@/lib/membership';
import type {
  GrantableRole,
  KennelMember,
  MembershipStatus,
  OfficerPosition,
  Page,
  PositionsPage,
  ViewerMembership,
} from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

const tabs: { status: MembershipStatus; label: string; empty: string }[] = [
  { status: 'PENDING_REVIEW', label: 'Requests', empty: 'No requests waiting.' },
  { status: 'ACTIVE', label: 'Members', empty: 'No active members yet.' },
  { status: 'SUSPENDED', label: 'Suspended', empty: 'Nobody is suspended.' },
  { status: 'REJECTED', label: 'Not approved', empty: 'No declined requests.' },
  { status: 'WITHDRAWN', label: 'Withdrawn', empty: 'No requests have been withdrawn.' },
  { status: 'RESIGNED', label: 'Left', empty: 'Nobody has left the kennel.' },
  { status: 'REMOVED', label: 'Removed', empty: 'Nobody has been removed.' },
];

const PAGE_SIZE = 20;

function fetchViewer(slug: string) {
  return api
    .get<{ data: ViewerMembership }>(`/kennels/${encodeURIComponent(slug)}/membership`)
    .then((res) => res.data.data);
}

function fetchMembers(slug: string, status: MembershipStatus, pageNum: number, query: string) {
  const search = new URLSearchParams({
    status,
    page: String(pageNum),
    limit: String(PAGE_SIZE),
    ...(query ? { q: query } : {}),
  });
  return api
    .get<{ data: Page<KennelMember> }>(`/kennels/${encodeURIComponent(slug)}/members?${search}`)
    .then((res) => res.data.data);
}

export default function KennelMembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();

  const [viewer, setViewer] = useState<ViewerMembership | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [status, setStatus] = useState<MembershipStatus>('PENDING_REVIEW');
  const [pageNum, setPageNum] = useState(1);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [list, setList] = useState<Page<KennelMember> | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  // The offices this kennel has defined, so a member can be given one without
  // leaving the roll. Stays empty for a viewer who may not appoint.
  const [positions, setPositions] = useState<OfficerPosition[]>([]);
  const [roleTitles, setRoleTitles] = useState<Partial<Record<GrantableRole, string>>>({});

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  const loadViewer = useCallback(async () => {
    try {
      setViewer(await fetchViewer(slug));
      setViewerError(null);
    } catch (err) {
      setViewerError(errorMessage(err, 'Could not load this kennel'));
    }
  }, [slug]);

  const canReview = viewer?.permissions.includes('membership.review') ?? false;

  const loadList = useCallback(async () => {
    try {
      setList(await fetchMembers(slug, status, pageNum, query));
      setListError(null);
    } catch (err) {
      setListError(errorMessage(err, 'Could not load members'));
    }
  }, [slug, status, pageNum, query]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchViewer(slug)
      .then((data) => {
        if (cancelled) return;
        setViewer(data);
        setViewerError(null);
      })
      .catch((err) => {
        if (!cancelled) setViewerError(errorMessage(err, 'Could not load this kennel'));
      });
    return () => {
      cancelled = true;
    };
  }, [user, slug]);

  useEffect(() => {
    if (!user || !canReview) return;
    let cancelled = false;
    fetchMembers(slug, status, pageNum, query)
      .then((data) => {
        if (cancelled) return;
        setList(data);
        setListError(null);
      })
      .catch((err) => {
        if (!cancelled) setListError(errorMessage(err, 'Could not load members'));
      });
    return () => {
      cancelled = true;
    };
  }, [user, canReview, slug, status, pageNum, query]);

  const canAppoint = viewer?.permissions.includes('officer.appoint') ?? false;

  const loadPositions = useCallback(async () => {
    // Nothing to offer, and nothing to clear: the list starts empty, and
    // MemberCard checks the permission again before showing the control.
    if (!canAppoint) return;
    try {
      const res = await api.get<{ data: PositionsPage }>(`/kennels/${encodeURIComponent(slug)}/positions`);
      setPositions(res.data.data.items);
      setRoleTitles(res.data.data.roleTitles ?? {});
    } catch {
      // No positions offered rather than a broken page: the roll still works.
      setPositions([]);
    }
  }, [slug, canAppoint]);

  useEffect(() => {
    if (!canAppoint) return;
    let cancelled = false;
    api
      .get<{ data: PositionsPage }>(`/kennels/${encodeURIComponent(slug)}/positions`)
      .then((res) => {
        if (cancelled) return;
        setPositions(res.data.data.items);
        setRoleTitles(res.data.data.roleTitles ?? {});
      })
      // No offices offered rather than a broken page: the roll still works.
      .catch(() => {
        if (!cancelled) setPositions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, canAppoint]);

  const refresh = useCallback(async () => {
    await Promise.all([loadList(), loadViewer(), loadPositions()]);
    notifyMembershipsChanged();
  }, [loadList, loadViewer, loadPositions]);

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />} wide>
      {children}
    </FeedLayout>
  );

  if (loading || !user || (!viewer && !viewerError)) {
    return shell(<div className="h-48 animate-pulse bg-card sm:rounded-xl" aria-busy />);
  }

  if (viewerError || !viewer) {
    return shell(
      <Card className={cn(bleedCard, 'p-8 text-center')}>
        <p className="font-semibold">{viewerError}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/kennels">Back to kennels</Link>
        </Button>
      </Card>,
    );
  }

  if (!canReview) {
    return shell(
      <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="members-forbidden">
        <p className="font-semibold">You don&apos;t manage members of {viewer.kennel.shortName}.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Member management is for officers the kennel has given that permission.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/kennels/${slug}`}>Back to {viewer.kennel.shortName}</Link>
        </Button>
      </Card>,
    );
  }

  const permissions = new Set(viewer.permissions);
  const tab = tabs.find((t) => t.status === status) ?? tabs[0];
  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.limit)) : 1;

  return shell(
    <>
      <Card className={cn(bleedCard, 'mb-4 p-5')}>
        <Link
          href={`/kennels/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {viewer.kennel.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Members</h1>
        <p className="text-muted-foreground">Review requests and look after the pack. Every decision is recorded.</p>
        {/* Search commits on submit so each keystroke is not a request */}
        <form
          role="search"
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPageNum(1);
            setList(null);
            setQuery(draft.trim());
          }}
        >
          <label htmlFor="member-search" className="sr-only">
            Search members
          </label>
          <Input
            id="member-search"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Hash handle or first name"
            className="sm:w-72"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </Card>

      <div className="mb-4">
        <InvitationsPanel slug={slug} />
      </div>

      <nav
        aria-label="Member lists"
        className="mb-4 flex overflow-x-auto border-y border-border bg-card px-2 sm:rounded-xl sm:border"
      >
        {tabs.map((t) => {
          const active = t.status === status;
          return (
            <button
              key={t.status}
              type="button"
              aria-current={active ? 'page' : undefined}
              data-testid={`members-tab-${t.status}`}
              onClick={() => {
                if (active) return;
                setStatus(t.status);
                setPageNum(1);
                setList(null);
              }}
              className={cn(
                'relative min-h-11 whitespace-nowrap px-4 py-3 text-sm font-semibold',
                active
                  ? 'text-primary-strong after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {t.status === 'PENDING_REVIEW' && viewer.pendingCount > 0 && (
                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {viewer.pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {listError ? (
        <Card className={cn(bleedCard, 'p-8 text-center')}>
          <p className="font-semibold">{listError}</p>
          <Button variant="outline" className="mt-4" onClick={() => void loadList()}>
            Try again
          </Button>
        </Card>
      ) : !list ? (
        <div className="space-y-3" aria-busy>
          <div className="h-32 animate-pulse bg-card sm:rounded-xl" />
          <div className="h-32 animate-pulse bg-card sm:rounded-xl" />
        </div>
      ) : list.items.length === 0 ? (
        <p
          className="border-y border-dashed border-border bg-card p-10 text-center text-muted-foreground sm:rounded-xl sm:border-x"
          data-testid="members-empty"
        >
          {query ? `Nobody matches “${query}”.` : tab.empty}
        </p>
      ) : (
        <ul className="space-y-3" data-testid="members-list">
          {list.items.map((m) => (
            <li key={m.id}>
              <MemberCard
                membership={m}
                viewerId={user.id}
                permissions={permissions}
                positions={positions}
                roleTitles={roleTitles}
                slug={slug}
                onChanged={refresh}
              />
            </li>
          ))}
        </ul>
      )}

      {list && totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
          <Button variant="outline" disabled={pageNum <= 1} onClick={() => setPageNum((p) => p - 1)}>
            Previous
          </Button>
          <span className="px-2 text-muted-foreground">
            Page {pageNum} of {totalPages}
          </span>
          <Button variant="outline" disabled={pageNum >= totalPages} onClick={() => setPageNum((p) => p + 1)}>
            Next
          </Button>
        </nav>
      )}
    </>,
  );
}
