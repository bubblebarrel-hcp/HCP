import Link from 'next/link';
import {
  Beer,
  BookOpen,
  CalendarDays,
  Camera,
  ListTree,
  MapPin,
  Megaphone,
  MessageSquare,
  Rabbit,
  Repeat2,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/ui/card';
import { PostActions } from '@/components/feed/PostActions';
import { EngagementBar } from '@/components/social/EngagementBar';
import { ExpandableText } from '@/components/social/ExpandableText';
import { LinkPreviewCard } from '@/components/social/LinkPreviewCard';
import { PollCard } from '@/components/social/PollCard';
import { MilestoneCard } from '@/components/feed/MilestoneCard';
import { PostMedia } from '@/components/feed/PostMedia';
import type { FeedEntry, FeedItem, SubjectSegment } from '@/lib/types';
import { formatRunWhen } from '@/lib/runs';
import { bleedCard, brandColor, cn, formatDate } from '@/lib/utils';

// One thing in the community feed (D42): a trail report somebody published, or
// a photo somebody put on their run. A Server Component on purpose — the home
// page reads without JavaScript, and nothing here needs the browser.

function Attribution({
  name,
  authorId,
  avatarUrl,
  kennel,
  at,
  icon,
}: {
  name: string | null;
  // When we know who they are, the name is a link to them — which is where the
  // Follow button lives (D50).
  authorId?: string | null;
  avatarUrl?: string | null;
  kennel: FeedItem['kennel'];
  at: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar
        name={name ?? kennel?.shortName ?? 'Hash'}
        size="sm"
        src={avatarUrl ?? null}
        color={brandColor(kennel?.primaryColor)}
      />
      <p className="min-w-0 flex-1 text-sm">
        {authorId && name ? (
          <Link href={`/hashers/${authorId}`} className="font-medium hover:underline">
            {name}
          </Link>
        ) : (
          <span className="font-medium">{name ?? 'A hasher'}</span>
        )}
        {kennel && (
          <>
            {' · '}
            <Link href={`/kennels/${kennel.slug}`} className="text-primary-strong hover:underline">
              {kennel.shortName}
            </Link>
          </>
        )}
        <span className="block text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            {icon}
            <time dateTime={at}>{formatDate(at)}</time>
          </span>
        </span>
      </p>
    </div>
  );
}

// A run being announced (D43). The flyer a kennel posts to WhatsApp says the
// same things every time — run number, theme, when, where, who is haring, hash
// cash, what to bring, and what is coming after — so the card says them in
// that order, with the flyer itself on top when there is one. Unlike the
// WhatsApp version, every line of it is real data: the date is a date, the
// kennel is a link, and "On On" writes an RSVP.
function RunAnnouncement({ item }: { item: Extract<FeedItem, { kind: 'RUN' }> }) {
  const heading = item.runNumber ? `Run #${item.runNumber}` : 'Next run';
  const venue = [item.meetingPointName, item.meetingAddress].filter(Boolean).join(', ');

  return (
    <Card className={cn(bleedCard, 'overflow-hidden')} data-testid="feed-run">
      <div className="p-4 pb-3">
        <Attribution
          name={item.kennel?.shortName ?? 'A kennel'}
          kennel={item.kennel}
          at={item.at}
          icon={<Megaphone className="h-3.5 w-3.5" aria-hidden />}
        />
      </div>

      {item.posterUrl && (
        <>
          {/* Storage is an arbitrary host, so next/image would need every
              deployment's domain configured up front. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.posterUrl}
            alt={`Flyer for ${heading}${item.theme ? `, ${item.theme}` : ''}`}
            loading="lazy"
            className="max-h-[36rem] w-full bg-muted object-contain"
          />
        </>
      )}

      <div className="space-y-3 p-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-strong">
            {heading}
            {item.happeningNow && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground" data-testid="feed-run-live">
                On trail now
              </span>
            )}
          </p>
          <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
          {item.theme && <p className="text-[15px] italic text-muted-foreground">{item.theme}</p>}
        </div>

        <dl className="grid gap-2 text-[15px] sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <dt className="sr-only">When</dt>
              <dd>
                <time dateTime={item.startsAt}>{formatRunWhen(item.startsAt, item.timeZone)}</time>
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <dt className="sr-only">Where</dt>
              <dd className="break-words">{venue || `${item.city}, ${item.country}`}</dd>
            </div>
          </div>
          {item.hares.length > 0 && (
            <div className="flex items-start gap-2">
              <Rabbit className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <dt className="sr-only">Hares</dt>
                <dd className="break-words">
                  {item.hares.length === 1 ? 'Hare: ' : 'Hares: '}
                  {item.hares.join(', ')}
                </dd>
              </div>
            </div>
          )}
          {item.hashCash && (
            <div className="flex items-start gap-2">
              <Beer className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="sr-only">Hash cash</dt>
                <dd>{item.hashCash}</dd>
              </div>
            </div>
          )}
        </dl>

        {item.description && <p className="whitespace-pre-line leading-relaxed text-[15px]">{item.description}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/runs/${item.id}`}
            className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            data-testid="feed-run-cta"
          >
            {item.happeningNow ? 'On On — catch them up' : 'On On — I’m coming'}
          </Link>
          {item.goingCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {item.goingCount} {item.goingCount === 1 ? 'hasher is' : 'hashers are'} coming
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

// Somebody passing on somebody else's post (D50). The outer card is the
// sharer's — their picture, their words — and the quote inside it keeps its own
// attribution, so it is never unclear whose work it was.
function Reshare({ item }: { item: Extract<FeedItem, { kind: 'RESHARE' }> }) {
  const original = item.original;
  return (
    <Card className={cn(bleedCard, 'p-4')} data-testid="feed-reshare">
      <div className="flex items-center gap-3">
        <Avatar name={item.sharer.name} size="sm" src={item.sharer.avatarUrl} />
        <p className="min-w-0 flex-1 text-sm">
          <Link href={`/hashers/${item.sharer.id}`} className="font-medium hover:underline">
            {item.sharer.name}
          </Link>
          <span className="block text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Repeat2 className="h-3.5 w-3.5" aria-hidden />
              reshared · <time dateTime={item.at}>{formatDate(item.at)}</time>
            </span>
          </span>
        </p>
      </div>

      {item.commentary && <p className="mt-3 whitespace-pre-line leading-relaxed text-[15px]">{item.commentary}</p>}

      {original ? (
        <Link
          href={original.href}
          className="mt-3 block overflow-hidden rounded-xl border border-border transition-colors hover:bg-muted/50"
        >
          {original.imageUrl && (
            // Storage is an arbitrary host, so next/image would need every
            // deployment's domain configured up front.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={original.imageUrl} alt="" loading="lazy" className="max-h-72 w-full bg-muted object-cover" />
          )}
          <div className="p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {subjectWords[original.type] ?? 'Post'}
              {original.author ? ` by ${original.author}` : ''}
              {original.kennel ? ` · ${original.kennel.shortName}` : ''}
            </p>
            <p className="mt-0.5 font-semibold leading-snug">{original.title}</p>
            {original.excerpt && <p className="mt-1 text-sm text-muted-foreground">{original.excerpt}</p>}
          </div>
        </Link>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
          The original is no longer available.
        </p>
      )}
    </Card>
  );
}

const subjectWords: Record<string, string> = {
  REEL: 'Reel',
  POST: 'Post',
  TRAIL_REPORT: 'Trail report',
  MEDIA_ASSET: 'Photo',
  RUN: 'Run',
  RUN_CAPSULE: 'Run Capsule',
};

// Which subject the bar under a card acts on. A reshare's bar acts on what it
// quotes, because a like belongs to whoever made the thing.
function engagementTarget(item: FeedEntry): { segment: SubjectSegment; id: string; authorId: string | null } | null {
  switch (item.kind) {
    // News, not a thing to like (D60).
    case 'MILESTONE':
      return null;
    case 'REPORT':
      return { segment: 'reports', id: item.id, authorId: item.authorId };
    case 'PHOTO':
      return { segment: 'photos', id: item.id, authorId: item.authorId };
    case 'RUN':
      // A run belongs to the kennel, not to a person, so anybody may reshare it.
      return { segment: 'runs', id: item.id, authorId: null };
    case 'POST':
      return { segment: 'posts', id: item.id, authorId: item.authorId };
    case 'RESHARE':
      // The quote's author is not carried on the card, so the bar finds out for
      // itself when it reads the engagement.
      return { segment: item.subjectSegment, id: item.subjectId, authorId: null };
  }
}

// A hasher's own words (D51). Words first, photos under them — the opposite of
// a reel, which is media with a caption.
function HasherPostCard({ item }: { item: Extract<FeedItem, { kind: 'POST' }> }) {
  return (
    <Card className={cn(bleedCard, 'overflow-hidden')} data-testid="feed-post">
      <div className="p-4 pb-3">
        <Attribution
          name={item.author}
          authorId={item.authorId}
          avatarUrl={item.authorAvatarUrl}
          kennel={item.kennel}
          at={item.at}
          icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden />}
        />
        <ExpandableText
          text={item.body}
          href={`/posts/${item.id}`}
          className="mt-2 whitespace-pre-line leading-relaxed text-[15px]"
          data-testid="feed-post-body"
        />
        {item.edited && <p className="mt-1 text-xs text-muted-foreground">edited</p>}
        {item.poll && <PollCard postId={item.id} initial={item.poll} />}
        {item.linkPreview && <LinkPreviewCard preview={item.linkPreview} />}
      </div>

      <PostMedia items={item.photos} />

      {item.threadCount > 0 && (
        <p className="px-4 py-3 text-sm">
          <Link
            href={`/posts/${item.id}`}
            className="inline-flex items-center gap-1.5 font-medium text-primary-strong hover:underline"
            data-testid="feed-post-thread"
          >
            <ListTree className="h-4 w-4" aria-hidden />
            Thread · {item.threadCount} more {item.threadCount === 1 ? 'post' : 'posts'}
          </Link>
        </p>
      )}

      {item.run && (
        <p className="px-4 py-3 text-sm">
          <Link href={`/runs/${item.run.id}`} className="font-medium text-primary-strong hover:underline">
            Run #{item.run.runNumber ?? '—'}
            {item.run.title ? ` · ${item.run.title}` : ''}
          </Link>
        </p>
      )}
    </Card>
  );
}

function Body({ item }: { item: FeedItem }) {
  if (item.kind === 'RUN') return <RunAnnouncement item={item} />;
  if (item.kind === 'RESHARE') return <Reshare item={item} />;
  if (item.kind === 'POST') return <HasherPostCard item={item} />;
  if (item.kind === 'MILESTONE') return <MilestoneCard item={item} />;

  if (item.kind === 'REPORT') {
    return (
      <Card className={cn(bleedCard, 'p-4')} data-testid="feed-report">
        <Attribution
          name={item.author}
          authorId={item.authorId}
          kennel={item.kennel}
          at={item.at}
          icon={<BookOpen className="h-3.5 w-3.5" aria-hidden />}
        />
        <Link href={`/reports/${item.id}`} className="mt-3 block">
          <h3 className="text-lg font-semibold leading-snug hover:underline">{item.title}</h3>
        </Link>
        {item.run && (
          <p className="text-sm text-muted-foreground">
            Run #{item.run.runNumber ?? '—'}
            {item.run.title ? ` · ${item.run.title}` : ''}
          </p>
        )}
        {item.excerpt && <p className="mt-2 leading-relaxed text-[15px]">{item.excerpt}</p>}
        <Link
          href={`/reports/${item.id}`}
          className="mt-3 inline-block text-sm font-medium text-primary-strong hover:underline"
        >
          Read the trail report
        </Link>
      </Card>
    );
  }

  return (
    <Card className={cn(bleedCard, 'overflow-hidden')} data-testid="feed-photo">
      <div className="p-4 pb-3">
        <Attribution
          name={item.author}
          authorId={item.authorId}
          avatarUrl={item.authorAvatarUrl}
          kennel={item.kennel}
          at={item.at}
          icon={<Camera className="h-3.5 w-3.5" aria-hidden />}
        />
        {item.caption && <p className="mt-2 text-[15px]">{item.caption}</p>}
      </div>
      {/* Storage is an arbitrary host (R2 or the dev API), so next/image would
          need every deployment's domain configured up front. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt={item.caption ?? `Photo by ${item.author ?? 'a hasher'}`}
        width={item.width ?? undefined}
        height={item.height ?? undefined}
        loading="lazy"
        className="max-h-[36rem] w-full bg-muted object-cover"
      />
      {item.run && (
        <p className="px-4 py-3 text-sm">
          <Link href={`/runs/${item.run.id}`} className="font-medium text-primary-strong hover:underline">
            Run #{item.run.runNumber ?? '—'}
            {item.run.title ? ` · ${item.run.title}` : ''}
          </Link>
        </p>
      )}
    </Card>
  );
}

// The card, and under it what people have done to it (D50). The bar is a Client
// Component; everything above it stays a Server Component, so the home page
// still renders its content without JavaScript.
export function FeedCard({ item }: { item: FeedEntry }) {
  const target = engagementTarget(item);
  if (!target) return <Body item={item} />;
  return (
    <div
      className="relative overflow-hidden rounded-none border-y border-border bg-card sm:rounded-xl sm:border"
      data-post-card={item.kind === 'POST' ? '' : undefined}
    >
      <div className="[&>*]:rounded-none [&>*]:border-0">
        <Body item={item} />
      </div>
      {item.kind === 'POST' && <PostActions id={item.id} authorId={item.authorId} body={item.body} threadCount={item.threadCount} />}
      <EngagementBar
        segment={target.segment}
        id={target.id}
        initial={item.engagement}
        authorId={target.authorId}
        // A run announcement is a flyer; "seen by" is not what it is for.
        showViews={item.kind !== 'RUN'}
      />
    </div>
  );
}
