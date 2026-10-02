'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/ui/card';
import { FollowButton } from '@/components/social/FollowButton';
import { listFollowers, listFollowing } from '@/lib/social';
import type { FollowerSummary, FollowingEntry } from '@/lib/types';
import { brandColor, cn } from '@/lib/utils';

// Who follows this hasher, and who they follow (D50). Handles and pictures
// only, because that is all public identity is (D11).
//
// A client component: the lists are long, they page, and the Follow button
// beside each row needs a session. The profile above them stays server-rendered.

type Tab = 'followers' | 'following';

function HasherRow({ hasher }: { hasher: FollowerSummary }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar
        name={hasher.name}
        size="md"
        src={hasher.avatarUrl}
        color={brandColor(hasher.homeKennel?.primaryColor)}
      />
      <div className="min-w-0 flex-1">
        <Link href={`/hashers/${hasher.id}`} className="font-medium hover:underline">
          {hasher.name}
        </Link>
        {hasher.homeKennel && (
          <p className="truncate text-sm text-muted-foreground">{hasher.homeKennel.shortName}</p>
        )}
      </div>
      {!hasher.isMe && <FollowButton kind="hasher" target={hasher.id} showCount={false} size="sm" />}
    </li>
  );
}

function KennelRow({ kennel }: { kennel: Extract<FollowingEntry, { kind: 'KENNEL' }>['kennel'] }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar name={kennel.shortName} size="md" src={kennel.logoUrl} color={brandColor(kennel.primaryColor)} />
      <div className="min-w-0 flex-1">
        <Link href={`/kennels/${kennel.slug}`} className="font-medium hover:underline">
          {kennel.shortName}
        </Link>
        <p className="truncate text-sm text-muted-foreground">
          {kennel.city}, {kennel.country}
        </p>
      </div>
      <FollowButton kind="kennel" target={kennel.slug} showCount={false} size="sm" />
    </li>
  );
}

// `flat` drops the card chrome for when this sits inside another card, so the
// profile does not show a border inside a border.
export function FollowLists({
  hasherId,
  followers,
  following,
  flat = false,
  initialTab = 'followers',
}: {
  hasherId: string;
  followers: number;
  following: number;
  flat?: boolean;
  // Which list opens first, so pressing "following" on a profile opens that one.
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [followerRows, setFollowerRows] = useState<FollowerSummary[] | null>(null);
  const [followingRows, setFollowingRows] = useState<FollowingEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (which: Tab) => {
      setLoading(true);
      try {
        if (which === 'followers') {
          setFollowerRows((await listFollowers(hasherId)).items);
        } else {
          setFollowingRows((await listFollowing(hasherId)).items);
        }
      } catch {
        // A list that will not load shows its empty state rather than an alarm.
        if (which === 'followers') setFollowerRows([]);
        else setFollowingRows([]);
      } finally {
        setLoading(false);
      }
    },
    [hasherId],
  );

  useEffect(() => {
    if (tab === 'followers' && followerRows === null) void load('followers');
    if (tab === 'following' && followingRows === null) void load('following');
  }, [tab, followerRows, followingRows, load]);

  const Wrapper = flat ? ('div' as const) : Card;
  const rows = tab === 'followers' ? followerRows : followingRows;
  const tabClass = (active: boolean) =>
    cn(
      'flex-1 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
      active ? 'border-primary text-primary-strong' : 'border-transparent text-muted-foreground hover:text-foreground',
    );

  return (
    <Wrapper
      className={
        flat
          ? 'overflow-hidden rounded-lg border border-border'
          : 'overflow-hidden rounded-none border-x-0 sm:rounded-xl sm:border-x'
      }
      data-testid="follow-lists"
    >
      <div className="flex border-b border-border" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'followers'}
          onClick={() => setTab('followers')}
          className={tabClass(tab === 'followers')}
        >
          {followers} {followers === 1 ? 'Follower' : 'Followers'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'following'}
          onClick={() => setTab('following')}
          className={tabClass(tab === 'following')}
        >
          {following} Following
        </button>
      </div>

      {loading && rows === null ? (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
        </p>
      ) : (rows?.length ?? 0) === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          {tab === 'followers' ? 'Nobody yet.' : 'Not following anybody yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {tab === 'followers'
            ? followerRows?.map((hasher) => <HasherRow key={hasher.id} hasher={hasher} />)
            : followingRows?.map((entry) =>
                entry.kind === 'HASHER' ? (
                  <HasherRow key={`h-${entry.hasher.id}`} hasher={entry.hasher} />
                ) : (
                  <KennelRow key={`k-${entry.kennel.id}`} kennel={entry.kennel} />
                ),
              )}
        </ul>
      )}
    </Wrapper>
  );
}
