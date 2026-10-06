'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import api, { errorMessage } from '@/services/api';
import { DataTable, type Column } from '@/components/DataTable';
import { FilterBar, type FilterField, type FilterValues } from '@/components/FilterBar';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { ReasonDialog } from '@/components/ui/reason-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAdminList } from '@/hooks/useAdminList';
import type { PostRow, ReelRow } from '@/lib/types';
import { cn, formatDate, humanize } from '@/lib/utils';

// What hashers published. Platform staff see it whatever its audience (D57), so
// they can act on a report; that is a moderation exception, not a browse feature,
// and every takedown is written to the audit log with its reason. A takedown is
// a status change: the row stays as history.

const FIELDS = (kind: 'posts' | 'reels'): FilterField[] => [
  { name: 'q', label: kind === 'posts' ? 'Text or hasher' : 'Caption or hasher', type: 'search', placeholder: 'Search' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: kind === 'posts' ? ['PUBLISHED', 'DRAFT', 'ARCHIVED', 'REMOVED'] : ['PUBLISHED', 'DRAFT', 'ARCHIVED', 'REMOVED', 'DELETED'],
  },
];

const gone = (status: string) => status === 'REMOVED' || status === 'DELETED';

function Takedown({ kind, id, label, onDone }: { kind: 'posts' | 'reels'; id: string; label: string; onDone: () => void }) {
  return (
    <ReasonDialog
      title={`Take down this ${kind === 'posts' ? 'post' : 'reel'}?`}
      description={`It is removed everywhere for everyone, its author included. The row stays as history. Reason is recorded in the audit log. (${label})`}
      confirmLabel="Take down"
      destructive
      onConfirm={async (reason) => {
        try {
          await api.post(`/admin/${kind}/${id}/remove`, { reason });
          toast.success('Taken down');
          onDone();
        } catch (err) {
          toast.error(errorMessage(err, 'Could not take it down'));
          throw err;
        }
      }}
      trigger={<Button size="sm" variant="ghost" className="text-destructive" data-testid="takedown">Take down</Button>}
    />
  );
}

function Who({ name, kennel }: { name: string | null; kennel: { id: string; shortName: string } | null }) {
  return (
    <div>
      <p className="font-medium">{name}</p>
      {kennel && (
        <Link href={`/kennels/${kennel.id}`} className="text-xs text-primary-strong underline-offset-4 hover:underline">
          {kennel.shortName}
        </Link>
      )}
    </div>
  );
}

// A thumbnail that cannot load (a deleted object, a storage origin the browser
// blocks) falls back to the kind label, so the row never shows a broken image.
function Thumb({ url, kind }: { url: string | null; kind: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a remote thumbnail of arbitrary size; next/image would need every storage origin allow-listed
      <img src={url} alt="" className="h-12 w-12 rounded-md object-cover" onError={() => setFailed(true)} />
    );
  }
  return (
    <span className="grid h-12 w-12 place-items-center rounded-md bg-muted text-xs text-muted-foreground" aria-hidden>
      {kind}
    </span>
  );
}

function Posts() {
  const [filters, setFilters] = useState<FilterValues>({});
  const list = useAdminList<PostRow>('/admin/posts', filters);

  const columns: Column<PostRow>[] = [
    { key: 'author', header: 'Hasher', cell: (p) => <Who name={p.author.displayName} kennel={p.kennel} /> },
    {
      key: 'body',
      header: 'Post',
      cell: (p) => (
        <div className="max-w-md">
          <p className="line-clamp-3 whitespace-pre-line">{p.body}</p>
          {p.removedReason && <p className="mt-1 text-xs text-destructive">Removed: {p.removedReason}</p>}
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge value={p.status} /> },
    { key: 'audience', header: 'Audience', cell: (p) => humanize(p.visibility) },
    { key: 'when', header: 'Created', cell: (p) => formatDate(p.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (p) => (gone(p.status) ? null : <Takedown kind="posts" id={p.id} label={p.author.displayName ?? 'post'} onDone={list.reload} />),
    },
  ];

  return (
    <div className="space-y-4">
      <FilterBar fields={FIELDS('posts')} values={filters} onChange={setFilters} testId="posts-filters" />
      <DataTable
        testId="posts"
        columns={columns}
        rows={list.data?.items ?? []}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyMessage="No posts match."
        page={list.page}
        limit={list.limit}
        total={list.data?.total ?? 0}
        onPageChange={list.setPage}
      />
    </div>
  );
}

function Reels() {
  const [filters, setFilters] = useState<FilterValues>({});
  const list = useAdminList<ReelRow>('/admin/reels', filters);

  const columns: Column<ReelRow>[] = [
    { key: 'author', header: 'Hasher', cell: (r) => <Who name={r.author.displayName} kennel={r.kennel} /> },
    {
      key: 'reel',
      header: 'Reel',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Thumb url={r.media?.thumbnailUrl ?? null} kind={r.media ? humanize(r.media.kind) : 'None'} />
          <div className="max-w-xs">
            <p className="line-clamp-2">{r.caption || <span className="text-muted-foreground">No caption</span>}</p>
            {r.removedReason && <p className="mt-1 text-xs text-destructive">Removed: {r.removedReason}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge value={r.status} />
          {r.pinned && <StatusBadge value="Pinned" tone="neutral" />}
        </span>
      ),
    },
    { key: 'audience', header: 'Audience', cell: (r) => humanize(r.visibility) },
    { key: 'views', header: 'Views', cell: (r) => <span className="tabular-nums">{r.viewCount}</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (r) => (gone(r.status) ? null : <Takedown kind="reels" id={r.id} label={r.author.displayName ?? 'reel'} onDone={list.reload} />),
    },
  ];

  return (
    <div className="space-y-4">
      <FilterBar fields={FIELDS('reels')} values={filters} onChange={setFilters} testId="reels-filters" />
      <DataTable
        testId="reels"
        columns={columns}
        rows={list.data?.items ?? []}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyMessage="No reels match."
        page={list.page}
        limit={list.limit}
        total={list.data?.total ?? 0}
        onPageChange={list.setPage}
      />
    </div>
  );
}

const TABS = [
  { id: 'posts', label: 'Posts' },
  { id: 'reels', label: 'Reels' },
] as const;

export default function ContentPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('posts');
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        description="Posts and reels. Reported content is handled in the report queue."
        actions={
          <Button asChild variant="outline">
            <Link href="/reports">Open reports</Link>
          </Button>
        }
      />
      <div role="tablist" aria-label="Content type" className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            type="button"
            data-testid={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'posts' ? <Posts /> : <Reels />}
      </div>
    </div>
  );
}
