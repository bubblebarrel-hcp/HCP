'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { HasherRow } from '@/components/social/FollowLists';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { listKennelFollowers, listKennelRoster } from '@/lib/social';
import type { FollowerSummary, Page } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';
import { errorCode } from '@/services/api';

// Who is in a kennel and who follows it. Members see the roll of members; anyone
// can see the followers, because following is interest and not belonging (D50).
// Handles and pictures only (D11). The API decides who may see the roll: a
// non-member's request comes back 403 and this page shows the lock.

type Tab = 'members' | 'followers';

interface List {
  rows: FollowerSummary[];
  total: number;
  page: number;
}

const fromPage = (p: Page<FollowerSummary>): List => ({ rows: p.items, total: p.total, page: p.page });

export default function KennelPeoplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [picked, setPicked] = useState<Tab | null>(null);
  // `null` is still loading, `'locked'` is a 403: the viewer is not a member.
  const [members, setMembers] = useState<List | 'locked' | null>(null);
  const [followers, setFollowers] = useState<List | null>(null);
  const [more, setMore] = useState<Tab | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    listKennelFollowers(slug)
      .then((p) => alive && setFollowers(fromPage(p)))
      .catch(() => alive && setFollowers({ rows: [], total: 0, page: 1 }));
    // Signed out there is no roll to ask for: `membersState` below shows the lock.
    if (user) {
      listKennelRoster(slug)
        .then((p) => alive && setMembers(fromPage(p)))
        .catch((err) => alive && setMembers(errorCode(err) === 'FORBIDDEN' ? 'locked' : { rows: [], total: 0, page: 1 }));
    }
    return () => {
      alive = false;
    };
  }, [slug, user, authLoading]);

  const loadMore = useCallback(
    async (which: Tab) => {
      const current = which === 'members' ? members : followers;
      if (!current || current === 'locked') return;
      setMore(which);
      try {
        const next = await (which === 'members' ? listKennelRoster : listKennelFollowers)(slug, current.page + 1);
        const merged = { rows: [...current.rows, ...next.items], total: next.total, page: next.page };
        if (which === 'members') setMembers(merged);
        else setFollowers(merged);
      } finally {
        setMore(null);
      }
    },
    [slug, members, followers],
  );

  // Members land on the roll; everybody else on the followers.
  const membersState = !authLoading && !user ? 'locked' : members;
  const isMember = membersState !== null && membersState !== 'locked';
  const tab: Tab = picked ?? (isMember ? 'members' : 'followers');
  const active = tab === 'members' ? membersState : followers;

  const tabClass = (on: boolean) =>
    cn(
      'flex-1 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
      on ? 'border-primary text-primary-strong' : 'border-transparent text-muted-foreground hover:text-foreground',
    );
  const count = (list: List | 'locked' | null) => (list && list !== 'locked' ? `${list.total} ` : '');

  return (
    <FeedLayout left={<LeftNav />} wide>
      <Card className={cn(bleedCard, 'mb-4 p-5')}>
        <Link
          href={`/kennels/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to kennel
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">People</h1>
      </Card>

      <Card className={cn(bleedCard, 'overflow-hidden')} data-testid="kennel-people">
        <div className="flex border-b border-border" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'members'}
            onClick={() => setPicked('members')}
            className={tabClass(tab === 'members')}
            data-testid="people-tab-members"
          >
            {count(membersState)}Members
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'followers'}
            onClick={() => setPicked('followers')}
            className={tabClass(tab === 'followers')}
            data-testid="people-tab-followers"
          >
            {count(followers)}Followers
          </button>
        </div>

        {active === null ? (
          <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground" aria-busy>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </p>
        ) : active === 'locked' ? (
          <div className="flex items-start gap-3 p-6" data-testid="members-locked">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-semibold">Only members can see who belongs to this kennel.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {user ? 'Ask to join from the kennel page.' : 'Sign in, and join the kennel, to see its members.'}
              </p>
            </div>
          </div>
        ) : active.rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-testid="people-empty">
            {tab === 'members' ? 'No active members yet.' : 'Nobody follows this kennel yet.'}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border" data-testid={`people-${tab}`}>
              {active.rows.map((hasher) => (
                <HasherRow key={hasher.id} hasher={hasher} />
              ))}
            </ul>
            {active.rows.length < active.total && (
              <div className="border-t border-border p-3 text-center">
                <Button type="button" variant="outline" size="sm" disabled={more === tab} onClick={() => loadMore(tab)}>
                  {more === tab ? 'Loading…' : 'Show more'}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </FeedLayout>
  );
}
