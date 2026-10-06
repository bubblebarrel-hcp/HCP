'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FollowButton } from '@/components/social/FollowButton';
import { listFollowers, listFollowing, removeFollower } from '@/lib/social';
import type { FollowerSummary, FollowingEntry } from '@/lib/types';
import { brandColor, cn } from '@/lib/utils';
import { errorMessage } from '@/services/api';

// Who follows this hasher, and who they follow (D50). Handles and pictures
// only, because that is all public identity is (D11).
//
// A client component: the lists are long, they page, and the Follow button
// beside each row needs a session. The profile above them stays server-rendered.

type Tab = 'followers' | 'following';

export function HasherRow({
  hasher,
  onRemove,
}: {
  hasher: FollowerSummary;
  // Offered only on your own followers list (D57).
  onRemove?: (hasher: FollowerSummary) => Promise<void>;
}) {
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
      {onRemove ? (
        <ActionDialog
          trigger={
            <Button type="button" variant="outline" size="sm" data-testid="remove-follower">
              <UserMinus className="h-4 w-4" aria-hidden /> Remove
            </Button>
          }
          title={`Remove ${hasher.name}?`}
          description="They stop following you and, if your profile is locked, lose access to your photos, posts and reels. They are not told, and they can ask again."
          confirmLabel="Remove follower"
          destructive
          onConfirm={async () => {
            try {
              await onRemove(hasher);
            } catch (err) {
              toast.error(errorMessage(err, 'Could not remove that follower'));
              throw err;
            }
          }}
        />
      ) : (
        !hasher.isMe && <FollowButton kind="hasher" target={hasher.id} showCount={false} size="sm" />
      )}
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
  only,
  canRemove = false,
  onFollowerRemoved,
}: {
  hasherId: string;
  followers: number;
  following: number;
  flat?: boolean;
  // Which list opens first, so pressing "following" on a profile opens that one.
  initialTab?: Tab;
  // Show just this list, with no tab strip of its own: the page around it already
  // has tabs, and two strips for the same thing is one too many.
  only?: Tab;
  // Your own followers list can remove a follower (D57).
  canRemove?: boolean;
  onFollowerRemoved?: () => void;
}) {
  const [pickedTab, setTab] = useState<Tab>(initialTab);
  const tab = only ?? pickedTab;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
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
      {!only && (
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
      )}

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
            ? followerRows?.map((hasher) => (
                <HasherRow
                  key={hasher.id}
                  hasher={hasher}
                  onRemove={
                    canRemove
                      ? async (gone) => {
                          await removeFollower(gone.id);
                          setFollowerRows((current) => (current ?? []).filter((row) => row.id !== gone.id));
                          toast.success(`${gone.name} no longer follows you.`);
                          onFollowerRemoved?.();
                        }
                      : undefined
                  }
                />
              ))
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
