'use client';

import { useMemo, useState } from 'react';
import { BookOpen, GalleryHorizontal, ListTree, Rows3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { timelineTone } from '@/lib/capsules';
import type { CapsuleTimelineEntry, RunCapsule } from '@/lib/types';
import { bleedCard, cn, formatDate } from '@/lib/utils';

// 08H-02: the Explorer is a set of reading modes over the same timeline and
// media, not four different pages. Traditional article, Timeline narrative,
// Story Card view and Gallery-first mode are all here (FR-EXPLORER-004); the
// Interactive Trail Map and Hash Time Machine are not — both need trail
// geodata and a replay engine this pass does not build (see CODEX/TODO.md).
//
// "Synchronized" (FR-EXPLORER-002) is honest about what the data can support:
// media has no capture timestamp (no EXIF pass exists yet), only an upload
// time, so a timeline entry's "nearby photos" are its nearest neighbours by
// upload order — useful, but not a claim about what was happening in frame.

type Mode = 'timeline' | 'cards' | 'gallery' | 'article';

const MODES: { value: Mode; label: string; icon: typeof ListTree }[] = [
  { value: 'timeline', label: 'Timeline', icon: ListTree },
  { value: 'cards', label: 'Story cards', icon: Rows3 },
  { value: 'gallery', label: 'Gallery', icon: GalleryHorizontal },
  { value: 'article', label: 'Article', icon: BookOpen },
];

type Media = RunCapsule['media'][number];

// Up to three media items whose upload time sits closest to this entry's own
// moment. A soft signal, not a hard link — never claimed as more than that.
function nearestMedia(entry: CapsuleTimelineEntry, media: Media[], take = 3) {
  const at = new Date(entry.at).getTime();
  return [...media]
    .map((m) => ({ m, gap: Math.abs(new Date(m.createdAt).getTime() - at) }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, take)
    .map(({ m }) => m);
}

function Thumb({ media, size = 'md' }: { media: Media; size?: 'sm' | 'md' }) {
  const src = media.thumbnailUrl ?? media.url;
  if (!src) return null;
  return (
    // Storage is an arbitrary host (R2 or the dev API), so next/image would
    // need every deployment's domain configured up front.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={media.caption ?? ''}
      loading="lazy"
      className={cn('rounded-md bg-muted object-cover', size === 'sm' ? 'h-16 w-16' : 'aspect-square w-full')}
    />
  );
}

function TimelineView({
  entries,
  media,
  selected,
  onSelect,
}: {
  entries: CapsuleTimelineEntry[];
  media: Media[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const active = selected != null ? entries[selected] : null;
  const activeMedia = active ? nearestMedia(active, media) : [];

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
      <ol className="space-y-3 border-l-2 border-border pl-4 text-sm">
        {entries.map((entry, i) => (
          <li key={`${entry.at}-${i}`}>
            <button
              type="button"
              onClick={() => onSelect(selected === i ? -1 : i)}
              className={cn(
                'block w-full rounded-md text-left transition-colors hover:bg-muted/50',
                selected === i && 'bg-muted',
              )}
              data-testid="capsule-timeline-entry"
            >
              <span className={cn('font-medium', timelineTone(entry.kind))}>{entry.label}</span>
              <span className="text-muted-foreground">
                {' · '}
                <time dateTime={entry.at}>{formatDate(entry.at)}</time>
              </span>
              {entry.detail && entry.kind !== 'STORY' && <p className="text-muted-foreground">&ldquo;{entry.detail}&rdquo;</p>}
            </button>
          </li>
        ))}
        {entries.length === 0 && <li className="text-muted-foreground">Nothing recorded for this run.</li>}
      </ol>

      <div className="space-y-2" data-testid="capsule-timeline-synced">
        {active ? (
          activeMedia.length > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">Photos from around this moment</p>
              <div className="grid grid-cols-2 gap-2">
                {activeMedia.map((m) => (
                  <Thumb key={m.id} media={m} size="sm" />
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No photos land near this moment.</p>
          )
        ) : (
          <p className="text-xs text-muted-foreground">Select an entry to see what else was happening then.</p>
        )}
      </div>
    </div>
  );
}

function StoryCardsView({ entries, media }: { entries: CapsuleTimelineEntry[]; media: Media[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Nothing recorded for this run.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map((entry, i) => {
        const near = nearestMedia(entry, media, 1)[0];
        return (
          <Card key={`${entry.at}-${i}`} className="overflow-hidden" data-testid="capsule-story-card">
            {near && <Thumb media={near} />}
            <div className="p-3">
              <p className={cn('text-sm font-medium', timelineTone(entry.kind))}>{entry.label}</p>
              <p className="text-xs text-muted-foreground">
                <time dateTime={entry.at}>{formatDate(entry.at)}</time>
              </p>
              {entry.detail && entry.kind !== 'STORY' && (
                <p className="mt-1 text-sm text-muted-foreground">&ldquo;{entry.detail}&rdquo;</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

const KIND_GROUP: Record<CapsuleTimelineEntry['kind'], string> = {
  RUN: 'On trail',
  STORY: 'Moments',
  AWARD: 'Circle',
  REPORT: 'The report',
  ATTENDANCE: 'Arriving',
};

function GalleryView({ entries, media }: { entries: CapsuleTimelineEntry[]; media: Media[] }) {
  // Every photo grouped under whichever timeline entry sits nearest to it —
  // FR-EXPLORER-005's grouping, approximated from upload order (see the note
  // at the top of this file).
  const groups = useMemo(() => {
    if (entries.length === 0 || media.length === 0) return [] as { label: string; items: Media[] }[];
    const buckets = new Map<string, Media[]>();
    for (const m of media) {
      const at = new Date(m.createdAt).getTime();
      let closest = entries[0];
      let bestGap = Infinity;
      for (const entry of entries) {
        const gap = Math.abs(new Date(entry.at).getTime() - at);
        if (gap < bestGap) {
          bestGap = gap;
          closest = entry;
        }
      }
      const label = KIND_GROUP[closest.kind];
      buckets.set(label, [...(buckets.get(label) ?? []), m]);
    }
    return [...buckets.entries()].map(([label, items]) => ({ label, items }));
  }, [entries, media]);

  if (media.length === 0) return <p className="text-sm text-muted-foreground">No photographs yet.</p>;
  if (groups.length === 0) {
    return (
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {media.map((m) => (
          <li key={m.id}>
            <Thumb media={m} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {g.items.map((m) => (
              <li key={m.id}>
                <Thumb media={m} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ArticleView({ summary, entries }: { summary: string | null; entries: CapsuleTimelineEntry[] }) {
  const story = entries.filter((e) => e.kind === 'STORY' || e.kind === 'AWARD');
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {summary && <p className="font-medium">{summary}</p>}
      {story.length === 0 ? (
        <p className="text-muted-foreground">No written account of this run beyond what was recorded automatically.</p>
      ) : (
        story.map((entry, i) => <p key={`${entry.at}-${i}`}>{entry.detail ?? entry.label}</p>)
      )}
    </div>
  );
}

export function CapsuleExplorer({ capsule }: { capsule: RunCapsule }) {
  const [mode, setMode] = useState<Mode>('timeline');
  const [selected, setSelected] = useState<number | null>(null);
  const entries = capsule.timeline;

  return (
    <Card className={bleedCard} data-testid="capsule-explorer">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">What happened</CardTitle>
          <div className="flex gap-1 rounded-md bg-muted p-1" role="tablist" aria-label="Reading mode">
            {MODES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                  mode === value ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
                data-testid={`capsule-mode-${value}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mode === 'timeline' && (
          <TimelineView entries={entries} media={capsule.media} selected={selected} onSelect={setSelected} />
        )}
        {mode === 'cards' && <StoryCardsView entries={entries} media={capsule.media} />}
        {mode === 'gallery' && <GalleryView entries={entries} media={capsule.media} />}
        {mode === 'article' && <ArticleView summary={capsule.summary} entries={entries} />}
      </CardContent>
    </Card>
  );
}

