'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { History, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import {
  appointmentStatusLabel,
  appointmentTone,
  delegationState,
  permissionLabel,
} from '@/lib/officers';
import type { DelegationsPage, LeadershipEntry, PositionsPage } from '@/lib/types';
import { bleedCard, cn, formatDate } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// How a kennel is run (Annex 08L, D32). Defining an office and filling it are
// different powers, and this page only offers what the API would actually
// allow: every control is gated on what the viewer holds.

export default function OfficersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { loading } = useAuth();
  const [positions, setPositions] = useState<PositionsPage | null>(null);
  const [leadership, setLeadership] = useState<LeadershipEntry[]>([]);
  const [delegations, setDelegations] = useState<DelegationsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newPosition, setNewPosition] = useState({ title: '', permissions: [] as string[], termMonths: '' });
  const [appointTo, setAppointTo] = useState<Record<string, string>>({});
  const [grant, setGrant] = useState({ delegateId: '', permissions: [] as string[], reason: '', expiresAt: '' });

  async function load() {
    const [p, l, d] = await Promise.all([
      api.get<{ data: PositionsPage }>(`/kennels/${slug}/positions`),
      api.get<{ data: { items: LeadershipEntry[] } }>(`/kennels/${slug}/leadership`),
      api.get<{ data: DelegationsPage }>(`/kennels/${slug}/delegations`),
    ]);
    setPositions(p.data.data);
    setLeadership(l.data.data.items);
    setDelegations(d.data.data);
  }

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    Promise.all([
      api.get<{ data: PositionsPage }>(`/kennels/${slug}/positions`),
      api.get<{ data: { items: LeadershipEntry[] } }>(`/kennels/${slug}/leadership`),
      api.get<{ data: DelegationsPage }>(`/kennels/${slug}/delegations`),
    ])
      .then(([p, l, d]) => {
        if (cancelled) return;
        setPositions(p.data.data);
        setLeadership(l.data.data.items);
        setDelegations(d.data.data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'You cannot see how this kennel is run.'));
      });
    return () => {
      cancelled = true;
    };
  }, [slug, loading]);

  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      await load();
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
    } finally {
      setBusy(false);
    }
  }

  // ActionDialog keeps itself open when onConfirm throws, so the failure has to
  // surface here and then be rethrown rather than swallowed.
  async function mutate(fn: () => Promise<unknown>, success: string) {
    try {
      await fn();
      await load();
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
      throw err;
    }
  }

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />} wide>
      {children}
    </FeedLayout>
  );

  if (error) {
    return shell(
      <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="officers-denied">
        <p className="font-semibold">{error}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/kennels/${slug}`}>Back to the kennel</Link>
        </Button>
      </Card>,
    );
  }
  if (!positions || !delegations) return shell(<div className="h-96 animate-pulse bg-card sm:rounded-xl" aria-busy />);

  const { canAppoint, canDefinePositions, grantableKeys } = positions.viewer;

  return shell(
    <div className="space-y-4">
      <Card className={bleedCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            How this kennel is run
          </CardTitle>
          <CardDescription>
            Offices, who holds them, and who is standing in. Defining an office and filling it are separate
            permissions.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* ─── Positions ─── */}
      <Card className={bleedCard} data-testid="positions-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Offices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {positions.items.map((position) => (
              <li
                key={position.id}
                className={cn('rounded-lg border border-border p-4', position.archived && 'opacity-60')}
                data-testid="position-row"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{position.title}</span>
                  {position.archived && <Badge>Archived</Badge>}
                  {position.isMismanagement && <Badge>Mismanagement</Badge>}
                  {position.termMonths && (
                    <span className="text-sm text-muted-foreground">{position.termMonths}-month term</span>
                  )}
                </div>

                {position.permissions && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {position.permissions.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No permissions</span>
                    ) : (
                      position.permissions.map((key) => (
                        <Badge key={key} className="bg-muted text-foreground">
                          {permissionLabel[key] ?? key}
                        </Badge>
                      ))
                    )}
                  </div>
                )}

                <p className="mt-2 text-sm">
                  {position.holders.length === 0 ? (
                    <span className="text-muted-foreground">Vacant</span>
                  ) : (
                    position.holders.map((h) => h.name).join(', ')
                  )}
                </p>

                {canAppoint && !position.archived && (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <Field label="Appoint" htmlFor={`appoint-${position.id}`}>
                      <Select
                        id={`appoint-${position.id}`}
                        value={appointTo[position.id] ?? ''}
                        onChange={(e) => setAppointTo((s) => ({ ...s, [position.id]: e.target.value }))}
                        data-testid="appoint-select"
                      >
                        <option value="">Choose a member…</option>
                        {positions.members.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || !appointTo[position.id]}
                      onClick={() =>
                        run(
                          () =>
                            api.post(`/positions/${position.id}/appointments`, { userId: appointTo[position.id] }),
                          'Appointed',
                        )
                      }
                      data-testid="appoint-submit"
                    >
                      <UserPlus className="h-4 w-4" aria-hidden />
                      Appoint
                    </Button>
                    {position.holders.map((h) => (
                      <ActionDialog
                        key={h.appointmentId}
                        trigger={
                          <Button type="button" size="sm" variant="outline" disabled={busy} data-testid="end-appointment">
                            End {h.name}
                          </Button>
                        }
                        title={`End ${h.name} in ${position.title}`}
                        description="The appointment stays on the leadership timeline. Nothing is erased."
                        confirmLabel="End the appointment"
                        destructive
                        text={{ label: 'Why', required: true, placeholder: 'Term completed' }}
                        onConfirm={async (values) => {
                          await mutate(
                            () => api.post(`/appointments/${h.appointmentId}/term-ended`, { reason: values.text }),
                            'Appointment ended',
                          );
                        }}
                      />
                    ))}
                    {canDefinePositions && (
                      <ActionDialog
                        trigger={
                          <Button type="button" size="sm" variant="outline" disabled={busy} data-testid="archive-position">
                            Archive
                          </Button>
                        }
                        title={`Retire ${position.title}`}
                        description="Anyone holding it stops holding it, on the record. The office and its history remain."
                        confirmLabel="Archive the office"
                        destructive
                        text={{ label: 'Why', required: true, placeholder: 'Folded into another role' }}
                        onConfirm={async (values) => {
                          await mutate(
                            () => api.post(`/positions/${position.id}/archive`, { reason: values.text }),
                            'Office archived',
                          );
                        }}
                      />
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {canDefinePositions && (
            <div className="space-y-3 border-t border-border pt-4" data-testid="define-position">
              <p className="font-medium">Define an office</p>
              <div className="flex flex-wrap gap-2">
                <Field label="Title" htmlFor="new-position-title">
                  <Input
                    id="new-position-title"
                    value={newPosition.title}
                    onChange={(e) => setNewPosition((s) => ({ ...s, title: e.target.value }))}
                    placeholder="Hash Cash"
                    data-testid="new-position-title"
                  />
                </Field>
                <Field label="Term (months)" htmlFor="new-position-term">
                  <Input
                    id="new-position-term"
                    type="number"
                    min={1}
                    max={120}
                    value={newPosition.termMonths}
                    onChange={(e) => setNewPosition((s) => ({ ...s, termMonths: e.target.value }))}
                    className="w-32"
                  />
                </Field>
              </div>
              <fieldset>
                <legend className="text-sm font-medium">What it may do</legend>
                <p className="mb-2 text-sm text-muted-foreground">
                  Only what you hold yourself. You cannot give away authority you do not have.
                </p>
                <div className="flex flex-wrap gap-2">
                  {grantableKeys.map((key) => (
                    <label key={key} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={newPosition.permissions.includes(key)}
                        onChange={(e) =>
                          setNewPosition((s) => ({
                            ...s,
                            permissions: e.target.checked
                              ? [...s.permissions, key]
                              : s.permissions.filter((k) => k !== key),
                          }))
                        }
                      />
                      {permissionLabel[key] ?? key}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button
                type="button"
                disabled={busy || newPosition.title.trim().length < 2}
                onClick={() =>
                  run(async () => {
                    await api.post(`/kennels/${slug}/positions`, {
                      title: newPosition.title,
                      permissions: newPosition.permissions,
                      ...(newPosition.termMonths ? { termMonths: Number(newPosition.termMonths) } : {}),
                    });
                    setNewPosition({ title: '', permissions: [], termMonths: '' });
                  }, 'Office defined')
                }
                data-testid="new-position-submit"
              >
                Define it
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Delegations ─── */}
      <Card className={bleedCard} data-testid="delegations-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-4 w-4" aria-hidden />
            Standing in
          </CardTitle>
          <CardDescription>
            A time-boxed loan of authority you hold. It expires by itself, and stops the moment you lose the
            permission yourself.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {delegations.items.length === 0 && <p className="text-sm text-muted-foreground">Nobody is standing in.</p>}
          <ul className="space-y-2">
            {delegations.items.map((d) => {
              const state = delegationState(d);
              return (
                <li key={d.id} className="rounded-lg border border-border p-3 text-sm" data-testid="delegation-row">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn(state.tone)}>{state.label}</Badge>
                    <span className="font-medium">
                      {d.from} → {d.to}
                    </span>
                    <span className="text-muted-foreground">until {formatDate(d.expiresAt)}</span>
                  </div>
                  <p className="mt-1">{d.permissions.map((k) => permissionLabel[k] ?? k).join(', ')}</p>
                  <p className="text-muted-foreground">“{d.reason}”</p>
                  {d.canRevoke && !d.revokedAt && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={busy}
                      onClick={() => run(() => api.post(`/delegations/${d.id}/revoke`, {}), 'Taken back')}
                      data-testid="delegation-revoke"
                    >
                      Take it back
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>

          {grantableKeys.length > 0 && (
            <div className="space-y-3 border-t border-border pt-4" data-testid="grant-delegation">
              <p className="font-medium">Hand something over</p>
              <div className="flex flex-wrap gap-2">
                <Field label="To" htmlFor="delegate-to">
                  <Select
                    id="delegate-to"
                    value={grant.delegateId}
                    onChange={(e) => setGrant((s) => ({ ...s, delegateId: e.target.value }))}
                    data-testid="delegate-select"
                  >
                    <option value="">Choose a member…</option>
                    {delegations.members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={`Until (max ${delegations.viewer.maxDays} days)`} htmlFor="delegate-until">
                  <Input
                    id="delegate-until"
                    type="date"
                    value={grant.expiresAt}
                    onChange={(e) => setGrant((s) => ({ ...s, expiresAt: e.target.value }))}
                    data-testid="delegate-until"
                  />
                </Field>
              </div>
              <Field label="Why" htmlFor="delegate-reason">
                <Input
                  id="delegate-reason"
                  value={grant.reason}
                  onChange={(e) => setGrant((s) => ({ ...s, reason: e.target.value }))}
                  placeholder="Away for a fortnight"
                  data-testid="delegate-reason"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                {grantableKeys.map((key) => (
                  <label key={key} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={grant.permissions.includes(key)}
                      onChange={(e) =>
                        setGrant((s) => ({
                          ...s,
                          permissions: e.target.checked
                            ? [...s.permissions, key]
                            : s.permissions.filter((k) => k !== key),
                        }))
                      }
                    />
                    {permissionLabel[key] ?? key}
                  </label>
                ))}
              </div>
              <Button
                type="button"
                disabled={
                  busy || !grant.delegateId || grant.permissions.length === 0 || grant.reason.trim().length < 3 || !grant.expiresAt
                }
                onClick={() =>
                  run(async () => {
                    await api.post(`/kennels/${slug}/delegations`, {
                      delegateId: grant.delegateId,
                      permissions: grant.permissions,
                      reason: grant.reason,
                      expiresAt: new Date(`${grant.expiresAt}T12:00:00`).toISOString(),
                    });
                    setGrant({ delegateId: '', permissions: [], reason: '', expiresAt: '' });
                  }, 'Handed over')
                }
                data-testid="delegate-submit"
              >
                Hand it over
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Leadership timeline (FR-GOV-006) ─── */}
      <Card className={bleedCard} data-testid="leadership-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-4 w-4" aria-hidden />
            Leadership timeline
          </CardTitle>
          <CardDescription>Permanent history. Offices end, they are never erased.</CardDescription>
        </CardHeader>
        <CardContent>
          {leadership.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody has held office yet.</p>
          ) : (
            <ol className="space-y-3 border-l-2 border-border pl-4 text-sm">
              {leadership.map((entry) => (
                <li key={entry.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{entry.position.title}</span>
                    <span>{entry.officer}</span>
                    <Badge className={cn(appointmentTone(entry.status))}>
                      {appointmentStatusLabel[entry.status] ?? entry.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {formatDate(entry.startDate)}
                    {entry.endDate ? ` to ${formatDate(entry.endDate)}` : ' to present'}
                  </p>
                  {entry.endedReason && <p className="text-muted-foreground">“{entry.endedReason}”</p>}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>,
  );
}
