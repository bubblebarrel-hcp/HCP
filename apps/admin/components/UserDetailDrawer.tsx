'use client';

import { useEffect, useState } from 'react';
import api, { errorMessage } from '@/services/api';
import { Drawer } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/card';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import type { AdminUserDetail } from '@/lib/types';
import { cn, formatDate, humanize } from '@/lib/utils';

// Everything staff may see about one hasher. Opening it is audited server-side
// (GET /admin/users/:id writes a `user.detail.view` entry), because it shows the
// private biodata (D5). Direct messages and medical notes are never in it.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Fields({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value || <span className="text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function UserDetailDrawer({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [state, setState] = useState<{ id: string; user?: AdminUserDetail; error?: string } | null>(null);
  const [viewing, setViewing] = useState<'avatar' | 'banner' | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    api
      .get<{ data: { user: AdminUserDetail } }>(`/admin/users/${userId}`)
      .then((res) => alive && setState({ id: userId, user: res.data.data.user }))
      .catch((err) => alive && setState({ id: userId, error: errorMessage(err, 'Could not load this hasher') }));
    return () => {
      alive = false;
    };
  }, [userId]);

  // Whatever has arrived for another hasher is not this one's.
  const current = state && state.id === userId ? state : null;
  const u = current?.user;
  const b = u?.biodata;

  return (
    <Drawer
      open={userId !== null}
      onOpenChange={(open) => !open && onClose()}
      title={u?.displayName ?? 'Hasher'}
      description={u ? u.email : undefined}
    >
      {!current && <p className="text-sm text-muted-foreground" role="status">Loading…</p>}
      {current?.error && <p className="text-sm text-destructive" role="alert">{current.error}</p>}
      {u && (
        <div className="space-y-4" data-testid="user-detail">
          <div className="flex items-center gap-4">
            <button
              type="button"
              disabled={!u.avatarUrl}
              onClick={() => setViewing('avatar')}
              aria-label="Open picture full screen"
              data-testid="user-avatar-view"
              className="rounded-full enabled:cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {u.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- storage is an arbitrary host
                <img src={u.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-full bg-muted text-xl font-semibold">
                  {u.displayName.replace(/^Just /, '').slice(0, 2).toUpperCase()}
                </span>
              )}
            </button>
            <div className="min-w-0 space-y-1">
              <p className="text-lg font-semibold">{u.displayName}</p>
              {u.username && <p className="text-sm text-muted-foreground">@{u.username}</p>}
              <div className="flex flex-wrap gap-1.5">
                <Badge className={cn(u.status === 'SUSPENDED' && 'border-destructive/30 bg-destructive/10 text-destructive')}>
                  {humanize(u.status)}
                </Badge>
                <Badge>{humanize(u.role)}</Badge>
                <Badge>{humanize(u.trustLevel)}</Badge>
              </div>
            </div>
          </div>

          {u.bannerUrl && (
            <button
              type="button"
              onClick={() => setViewing('banner')}
              aria-label="Open banner full screen"
              data-testid="user-banner-view"
              className="block w-full cursor-zoom-in overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- storage is an arbitrary host */}
              <img src={u.bannerUrl} alt="" className="h-28 w-full object-cover" referrerPolicy="no-referrer" />
            </button>
          )}
          {u.bio && <p className="whitespace-pre-wrap text-sm">{u.bio}</p>}

          <Section title="Account">
            <Fields
              rows={[
                ['Email', `${u.email}${u.emailVerifiedAt ? ' (verified)' : ' (not verified)'}`],
                ['Joined', formatDate(u.createdAt)],
                ['Last sign-in', formatDate(u.lastLoginAt)],
                ['Home kennel', u.homeKennel?.name],
                ['Profile visible to', humanize(u.profileVisibility)],
                ['Direct messages', humanize(u.dmPolicy)],
                ['Language', u.preferredLanguage + (u.timeZone ? ` · ${u.timeZone}` : '')],
                ['Terms accepted', `${formatDate(u.termsAcceptedAt)}${u.termsVersion ? ` (v${u.termsVersion})` : ''}`],
                ...(u.deactivatedAt ? ([['Deactivated', formatDate(u.deactivatedAt)]] as [string, string][]) : []),
                ...(u.deletedAt ? ([['Deleted', formatDate(u.deletedAt)]] as [string, string][]) : []),
              ]}
            />
          </Section>

          <Section title="Hash names">
            {u.hashNames.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not named yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {u.hashNames.map((n) => (
                  <li key={n.id}>
                    {n.name}
                    {n.isPrimary && <Badge className="ml-2">Primary</Badge>}
                    {n.isAlias && <Badge className="ml-2">Alias</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Private details">
            {b ? (
              <Fields
                rows={[
                  ['Name', [b.firstName, b.middleName, b.lastName].filter(Boolean).join(' ')],
                  ['Date of birth', b.dateOfBirth],
                  ['Gender', humanize(b.gender)],
                  ['Phone', b.phone],
                  ['Nationality', b.nationality],
                  ['Location', [b.city, b.stateProvince, b.country].filter(Boolean).join(', ')],
                  ['Address', b.addressLine],
                  ['Occupation', b.occupation],
                  ['Languages', b.languages.join(', ')],
                  ['Emergency contact', `${b.emergencyContactName} (${b.emergencyContactRelationship}) · ${b.emergencyContactPhone}`],
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No biodata on file.</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Viewing this is recorded in the audit log.</p>
          </Section>

          <Section title="Kennels">
            {u.memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">No memberships.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {u.memberships.map((m) => (
                  <li key={m.id}>
                    {m.kennel.shortName}
                    {m.isHomeKennel && ' (home)'} · {humanize(m.type)} · {humanize(m.status)}
                    {m.startDate && ` · since ${formatDate(m.startDate)}`}
                  </li>
                ))}
              </ul>
            )}
            {(u.offices.length > 0 || u.roles.length > 0) && (
              <p className="mt-2 text-sm text-muted-foreground">
                Holds {[...u.offices.map((o) => `office at ${o.kennel.shortName}`), ...u.roles.map((r) => r.title ?? humanize(r.role))].join(', ')}.
              </p>
            )}
          </Section>

          <Section title="Activity">
            <Fields
              rows={[
                ['Posts', String(u.activity.posts)],
                ['Reels', String(u.activity.reels)],
                ['Followers', String(u.activity.followers)],
                ['Following', String(u.activity.following)],
                ['Reports about them', String(u.activity.reportsAgainst)],
              ]}
            />
          </Section>

          {u.enforcements.length > 0 && (
            <Section title="Automatic actions">
              <ul className="space-y-1 text-sm">
                {u.enforcements.map((e) => (
                  <li key={e.id}>
                    {humanize(e.level)} · {formatDate(e.createdAt)} · {e.reporterCount} reporters
                    {e.liftedAt ? ' · lifted' : e.confirmedAt ? ' · confirmed' : ''}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <PhotoViewer
            photos={[{ url: (viewing === 'banner' ? u.bannerUrl : u.avatarUrl) ?? '', label: u.displayName }]}
            open={viewing !== null}
            onOpenChange={(open) => !open && setViewing(null)}
          />
        </div>
      )}
    </Drawer>
  );
}
