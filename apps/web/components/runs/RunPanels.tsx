'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Award, Beer, Check, Megaphone, Music, Pause, Pencil, Play, StickyNote, UserPlus } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { GuestDialog } from '@/components/runs/GuestDialog';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { formatClock, rsvpLabel } from '@/lib/runs';
import type { RsvpStatus, RunDetail } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';

export type Send = (
  method: 'post' | 'put' | 'patch' | 'delete',
  path: string,
  body?: object,
  success?: string,
) => Promise<void>;

const ignore = () => undefined;

// ─── RSVP and self check-in ───

export function RsvpPanel({ run, send, onRun }: { run: RunDetail; send: Send; onRun: (run: RunDetail) => void }) {
  const v = run.viewer;
  const p = v.participation;
  const responded = p && p.rsvpStatus !== 'CANCELLED';
  const spotsLeft = run.capacity ? Math.max(0, run.capacity - run.counts.going) : null;

  return (
    <Card className={cn(bleedCard, 'space-y-3 p-5')} data-testid="rsvp-panel">
      <div>
        <h2 className="font-semibold">Are you coming?</h2>
        <p className="text-sm text-muted-foreground" data-testid="rsvp-counts">
          {run.counts.going} going · {run.counts.maybe} maybe
          {spotsLeft !== null && ` · ${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`}
          {run.counts.checkedIn > 0 && ` · ${run.counts.checkedIn} checked in`}
        </p>
      </div>

      {!v.signedIn ? (
        <div className="space-y-2">
          {v.canRegisterAsGuest && (
            <GuestDialog
              runId={run.id}
              onDone={onRun}
              trigger={
                <Button className="w-full" data-testid="register-guest">
                  Register as a guest
                </Button>
              }
            />
          )}
          <Button asChild variant={v.canRegisterAsGuest ? 'outline' : 'default'} className="w-full">
            <Link href="/auth/login">Log in to RSVP</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {p?.checkedInAt && (
            <p
              className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary-strong"
              data-testid="checked-in"
            >
              <Check className="h-4 w-4" aria-hidden />
              Checked in at {formatClock(p.checkedInAt, run.timeZone)}
            </p>
          )}
          {v.canCheckIn && (
            <Button
              className="w-full"
              data-testid="self-check-in"
              onClick={() => void send('post', `/runs/${run.id}/check-in`, undefined, 'Checked in. On On!').catch(ignore)}
            >
              Check in
            </Button>
          )}
          {v.canRespond && (
            <>
              <div role="group" aria-label="RSVP" className="grid grid-cols-3 gap-2">
                {(['GOING', 'MAYBE', 'NOT_GOING'] as RsvpStatus[]).map((status) => {
                  const selected = p?.rsvpStatus === status;
                  return (
                    <Button
                      key={status}
                      variant={selected ? 'default' : 'outline'}
                      aria-pressed={selected}
                      className="px-2"
                      disabled={status === 'GOING' && Boolean(v.goingBlockedReason)}
                      data-testid={`rsvp-${status}`}
                      onClick={() =>
                        void send('put', `/runs/${run.id}/rsvp`, { status }, `RSVP: ${rsvpLabel[status]}`).catch(ignore)
                      }
                    >
                      {rsvpLabel[status]}
                    </Button>
                  );
                })}
              </div>
              {v.goingBlockedReason && <p className="text-xs text-muted-foreground">{v.goingBlockedReason}</p>}
              {responded && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void send('delete', `/runs/${run.id}/rsvp`, undefined, 'RSVP withdrawn.').catch(ignore)}
                >
                  Withdraw RSVP
                </Button>
              )}
            </>
          )}
          {!v.canRespond && !v.canCheckIn && !p?.checkedInAt && (
            <p className="text-sm text-muted-foreground" data-testid="rsvp-blocked">
              {v.rsvpBlockedReason}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Organiser controls ───

const stepHelp: Record<string, string> = {
  schedule: 'Members see the run and can RSVP.',
  'start-planning': 'The hares start preparing the trail.',
  'hide-trail': 'Planning is locked. The trail stays secret until it is released.',
  'release-trail': 'The trail is released to the pack.',
  'open-check-in': 'Hashers can check in.',
  start: 'The run goes live.',
  end: 'The run ends and the Circle begins.',
  'close-circle': 'The Circle record is kept and the run moves to reporting.',
  archive: 'Attendance is locked for good and the run becomes part of its Run Capsule.',
};

const CHECK_IN_ALLOWED = ['CHECK_IN_OPEN', 'LIVE', 'CIRCLE', 'REPORTING'];

export function OrganiserPanel({ run, send, onRun }: { run: RunDetail; send: Send; onRun: (run: RunDetail) => void }) {
  const v = run.viewer;
  if (!v.canOperate) return null;
  const next = v.nextStep;

  return (
    <Card className={cn(bleedCard, 'space-y-3 p-5')} data-testid="organiser-panel">
      <div>
        <h2 className="font-semibold">Run the run</h2>
        <p className="text-sm text-muted-foreground">
          You are {v.isHare ? 'a hare on this run' : 'a kennel officer with run permissions'}.
        </p>
      </div>

      {next ? (
        <ActionDialog
          trigger={
            <Button className="w-full" data-testid="run-next-step">
              {next.label}
            </Button>
          }
          title={`${next.label}?`}
          description={stepHelp[next.action]}
          confirmLabel={next.label}
          onConfirm={() => send('post', `/runs/${run.id}/actions/${next.action}`, {}, `${next.label}: done.`)}
        />
      ) : (
        ['DRAFT', 'REPORTING'].includes(run.status) && (
          <p className="text-sm text-muted-foreground">
            A kennel officer with run permissions {run.status === 'DRAFT' ? 'publishes' : 'archives'} this run.
          </p>
        )
      )}

      <div className="flex flex-wrap gap-2">
        {v.canPause && (
          <ActionDialog
            trigger={
              <Button variant="outline" data-testid="run-pause">
                <Pause className="h-4 w-4" aria-hidden />
                Pause
              </Button>
            }
            title="Pause the run?"
            description="Use this for weather, an emergency or a lost hasher. The pause is recorded."
            confirmLabel="Pause run"
            text={{ label: 'Reason', required: true, placeholder: 'Thunderstorm at the second check' }}
            onConfirm={({ text }) => send('post', `/runs/${run.id}/actions/pause`, { reason: text }, 'Run paused.')}
          />
        )}
        {v.canResume && (
          <Button
            variant="outline"
            data-testid="run-resume"
            onClick={() => void send('post', `/runs/${run.id}/actions/resume`, {}, 'Run resumed.').catch(ignore)}
          >
            <Play className="h-4 w-4" aria-hidden />
            Resume
          </Button>
        )}
        {v.canEdit && (
          <Button asChild variant="outline">
            <Link href={`/runs/${run.id}/edit`}>
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </Link>
          </Button>
        )}
        {v.canAddGuest && (
          <GuestDialog
            runId={run.id}
            officer
            allowCheckIn={CHECK_IN_ALLOWED.includes(run.status)}
            onDone={onRun}
            trigger={
              <Button variant="outline" data-testid="add-guest">
                <UserPlus className="h-4 w-4" aria-hidden />
                Add guest
              </Button>
            }
          />
        )}
        {v.canSkipCircle && (
          <ActionDialog
            trigger={<Button variant="ghost">Skip the Circle</Button>}
            title="Skip the Circle?"
            description="The run moves straight to reporting. A reason is required (BR-RUN-005)."
            confirmLabel="Skip the Circle"
            text={{ label: 'Reason', required: true }}
            onConfirm={({ text }) =>
              send('post', `/runs/${run.id}/actions/skip-circle`, { reason: text }, 'Circle skipped.')
            }
          />
        )}
        {v.canCancel && (
          <ActionDialog
            trigger={
              <Button variant="ghost" className="text-destructive" data-testid="run-cancel">
                Cancel run
              </Button>
            }
            title="Cancel this run?"
            description="The run stays visible as cancelled with your reason. RSVPs are kept for the record. This can't be undone."
            confirmLabel="Cancel run"
            destructive
            text={{ label: 'Reason', required: true, placeholder: 'Venue flooded' }}
            onConfirm={({ text }) => send('post', `/runs/${run.id}/actions/cancel`, { reason: text }, 'Run cancelled.')}
          />
        )}
      </div>
    </Card>
  );
}

// ─── Attendance ───

const rsvpOrder: Record<RsvpStatus, number> = { GOING: 0, MAYBE: 1, NOT_GOING: 2, CANCELLED: 3 };

export function AttendanceCard({ run, send }: { run: RunDetail; send: Send }) {
  if (!run.participants) return null;
  const correct = run.viewer.canCorrectAttendance;
  const people = [...run.participants].sort(
    (a, b) => Number(Boolean(b.checkedInAt)) - Number(Boolean(a.checkedInAt)) || rsvpOrder[a.rsvpStatus] - rsvpOrder[b.rsvpStatus],
  );

  return (
    <Card className={bleedCard} data-testid="attendance-card">
      <CardHeader className="pb-3">
        <CardTitle>Who&apos;s coming</CardTitle>
        <CardDescription>
          {run.counts.going} going · {run.counts.maybe} maybe · {run.counts.checkedIn} checked in · {run.counts.visitors}{' '}
          {run.counts.visitors === 1 ? 'visitor' : 'visitors'} · {run.counts.guests}{' '}
          {run.counts.guests === 1 ? 'guest' : 'guests'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody has RSVP&apos;d yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {people.map((person) => (
              <li key={person.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0" data-testid="participant">
                <Avatar name={person.displayName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{person.displayName}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {person.kind === 'guest' && <Badge>Guest</Badge>}
                    {person.isVisitor && person.kind === 'hasher' && (
                      <Badge>Visitor{person.homeKennel ? ` · ${person.homeKennel}` : ''}</Badge>
                    )}
                    {person.isVirginRun && <Badge className="border-accent/30 bg-accent/10 text-accent-strong">Virgin</Badge>}
                  </div>
                  {/* D23: only present at all if the API decided this viewer may contact a guest. */}
                  {person.contact && (
                    <p className="mt-0.5 text-xs text-muted-foreground" data-testid="guest-contact">
                      {person.contact.email}
                      {person.contact.phone ? ` · ${person.contact.phone}` : ''}
                    </p>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {person.checkedInAt ? (
                    <span className="inline-flex items-center gap-1 font-medium text-primary-strong">
                      <Check className="h-4 w-4" aria-hidden />
                      {formatClock(person.checkedInAt, run.timeZone)}
                    </span>
                  ) : (
                    rsvpLabel[person.rsvpStatus]
                  )}
                </span>
                {correct &&
                  (person.checkedInAt ? (
                    <ActionDialog
                      trigger={
                        <Button variant="ghost" size="sm" data-testid="participant-undo-check-in">
                          Undo
                        </Button>
                      }
                      title={`Undo ${person.displayName}'s check-in?`}
                      description="The correction is recorded in the audit log."
                      confirmLabel="Undo check-in"
                      destructive
                      text={{ label: 'Reason' }}
                      onConfirm={({ text }) =>
                        send(
                          'delete',
                          `/runs/${run.id}/participants/${person.id}/check-in`,
                          { reason: text },
                          'Check-in undone.',
                        )
                      }
                    />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="participant-check-in"
                      onClick={() =>
                        void send(
                          'post',
                          `/runs/${run.id}/participants/${person.id}/check-in`,
                          undefined,
                          `${person.displayName} checked in.`,
                        ).catch(ignore)
                      }
                    >
                      Check in
                    </Button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Circle (Annex 08E-04) ───

function CircleEditDialog({ run, send }: { run: RunDetail; send: Send }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const initial = () => ({
    songs: (run.circle?.songs ?? []).join('\n'),
    announcements: run.circle?.announcements ?? '',
    notes: run.circle?.notes ?? '',
  });
  const [values, setValues] = useState(initial);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (next) setValues(initial());
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="circle-edit">
          <Pencil className="h-4 w-4" aria-hidden />
          Record
        </Button>
      </DialogTrigger>
      <DialogContent title="Circle record" description="Songs, announcements and notes become part of the Run Capsule.">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await send(
                'patch',
                `/runs/${run.id}/circle`,
                {
                  songs: values.songs.split('\n').map((s) => s.trim()).filter(Boolean),
                  announcements: values.announcements,
                  notes: values.notes,
                },
                'Circle record saved.',
              );
              setOpen(false);
            } catch {
              /* toast already shown */
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Songs" htmlFor={`${id}-songs`} hint="One song per line.">
            <Textarea
              id={`${id}-songs`}
              rows={4}
              value={values.songs}
              onChange={(e) => setValues((v) => ({ ...v, songs: e.target.value }))}
            />
          </Field>
          <Field label="Announcements" htmlFor={`${id}-announcements`}>
            <Textarea
              id={`${id}-announcements`}
              rows={3}
              value={values.announcements}
              onChange={(e) => setValues((v) => ({ ...v, announcements: e.target.value }))}
            />
          </Field>
          <Field label="Notes" htmlFor={`${id}-notes`} hint="For the Hash Scribe's trail report.">
            <Textarea
              id={`${id}-notes`}
              rows={4}
              value={values.notes}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AwardDialog({ run, send }: { run: RunDetail; send: Send }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const blank = { title: '', recipient: '', otherName: '', reason: '', isDownDown: false };
  const [values, setValues] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const candidates = (run.participants ?? []).filter((p) => p.checkedInAt || p.rsvpStatus === 'GOING');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) {
          setValues(blank);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="award-add">
          <Award className="h-4 w-4" aria-hidden />
          Add award
        </Button>
      </DialogTrigger>
      <DialogContent title="Add an award or down-down" description="Recognition, not ranking.">
        <form
          className="space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (values.title.trim().length < 2) return setError('Give the award a title.');
            if (!values.recipient) return setError('Choose who it is for.');
            if (values.recipient === '__other' && !values.otherName.trim()) return setError('Enter a name.');
            setError(null);
            setBusy(true);
            try {
              await send(
                'post',
                `/runs/${run.id}/circle/awards`,
                {
                  title: values.title,
                  reason: values.reason,
                  isDownDown: values.isDownDown,
                  ...(values.recipient === '__other'
                    ? { recipientName: values.otherName }
                    : { participationId: values.recipient }),
                },
                'Award recorded.',
              );
              setOpen(false);
              setValues(blank);
            } catch {
              /* toast already shown */
            } finally {
              setBusy(false);
            }
          }}
        >
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Field label="Title" htmlFor={`${id}-title`}>
            <Input
              id={`${id}-title`}
              placeholder="Down-down, Best trail, Hare recognition…"
              value={values.title}
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            />
          </Field>
          <Field label="For" htmlFor={`${id}-recipient`}>
            <Select
              id={`${id}-recipient`}
              value={values.recipient}
              onChange={(e) => setValues((v) => ({ ...v, recipient: e.target.value }))}
            >
              <option value="">Choose…</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
              <option value="__other">Someone else</option>
            </Select>
          </Field>
          {values.recipient === '__other' && (
            <Field label="Name" htmlFor={`${id}-other`}>
              <Input
                id={`${id}-other`}
                value={values.otherName}
                onChange={(e) => setValues((v) => ({ ...v, otherName: e.target.value }))}
              />
            </Field>
          )}
          <Field label="Reason (optional)" htmlFor={`${id}-reason`}>
            <Textarea
              id={`${id}-reason`}
              rows={2}
              value={values.reason}
              onChange={(e) => setValues((v) => ({ ...v, reason: e.target.value }))}
            />
          </Field>
          {run.kennel.downDownsEnabled && (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={values.isDownDown}
                onChange={(e) => setValues((v) => ({ ...v, isDownDown: e.target.checked }))}
              />
              This is a down-down
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} data-testid="award-submit">
              {busy ? 'Saving…' : 'Add award'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CircleCard({ run, send }: { run: RunDetail; send: Send }) {
  const v = run.viewer;
  const c = run.circle;
  if (!v.canSeeNames || (!c && !v.canRecordCircle && !run.circleSkipReason)) return null;

  return (
    <Card className={bleedCard} data-testid="circle-card">
      <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
        <CardTitle>Circle</CardTitle>
        {v.canRecordCircle && (
          <div className="flex gap-2">
            <CircleEditDialog run={run} send={send} />
            <AwardDialog run={run} send={send} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-5 text-[15px]">
        {run.circleSkipReason && (
          <p className="rounded-lg bg-muted p-3 text-sm">
            <span className="font-medium">Circle skipped:</span> {run.circleSkipReason}
          </p>
        )}
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Music className="h-4 w-4" aria-hidden />
            Songs
          </h3>
          {c?.songs.length ? (
            <ul className="mt-1 list-inside list-disc">
              {c.songs.map((song, i) => (
                <li key={`${song}-${i}`}>{song}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No songs recorded.</p>
          )}
        </section>
        {c?.announcements && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Megaphone className="h-4 w-4" aria-hidden />
              Announcements
            </h3>
            <p className="mt-1 whitespace-pre-line">{c.announcements}</p>
          </section>
        )}
        {c?.notes && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <StickyNote className="h-4 w-4" aria-hidden />
              Notes
            </h3>
            <p className="mt-1 whitespace-pre-line">{c.notes}</p>
          </section>
        )}
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Award className="h-4 w-4" aria-hidden />
            Awards and down-downs
          </h3>
          {c?.awards.length ? (
            <ul className="mt-2 space-y-2" data-testid="award-list">
              {c.awards.map((award) => (
                <li key={award.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  {award.isDownDown ? (
                    <Beer className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" aria-label="Down-down" />
                  ) : (
                    <Award className="mt-0.5 h-5 w-5 shrink-0 text-primary-strong" aria-label="Award" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="font-semibold">{award.title}</span>
                      {award.recipient && <> · {award.recipient}</>}
                    </p>
                    {award.reason && <p className="text-sm text-muted-foreground">{award.reason}</p>}
                  </div>
                  {v.canRecordCircle && (
                    <ActionDialog
                      trigger={
                        <Button variant="ghost" size="sm" data-testid="award-remove">
                          Remove
                        </Button>
                      }
                      title={`Remove "${award.title}"?`}
                      description="Corrections before archive are recorded in the audit log."
                      confirmLabel="Remove"
                      destructive
                      onConfirm={() =>
                        send('delete', `/runs/${run.id}/circle/awards/${award.id}`, undefined, 'Award removed.')
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No awards recorded.</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
