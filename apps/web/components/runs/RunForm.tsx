'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { RUN_TYPES, RUN_VISIBILITIES, runFormSchema, type RunFormValues } from '@/lib/run-schema';
import { runTypeLabel, runVisibilityLabel } from '@/lib/runs';
import { bleedCard } from '@/lib/utils';

export interface RunFormMember {
  userId: string;
  displayName: string;
}

// Plan or edit a run. Officers with run.manage see hares and the run number;
// hares editing their own run do not. Visibility is only editable with
// run.visibility.change (D3/D13).
export function RunForm({
  defaults,
  members,
  canManage,
  canChangeVisibility,
  submitLabel,
  onSubmit,
}: {
  defaults: RunFormValues;
  members?: RunFormMember[];
  canManage: boolean;
  canChangeVisibility: boolean;
  submitLabel: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const { register, handleSubmit, control, setValue, formState } = useForm<RunFormValues>({
    resolver: zodResolver(runFormSchema),
    defaultValues: defaults,
  });
  const [busy, setBusy] = useState(false);
  const lead = useWatch({ control, name: 'leadHareId' });
  const coHares = useWatch({ control, name: 'coHareIds' });
  const e = formState.errors;

  const submit = handleSubmit(async (v) => {
    const payload: Record<string, unknown> = {
      title: v.title,
      runType: v.runType,
      theme: v.theme,
      description: v.description,
      startsAtLocal: v.startsAtLocal,
      timeZone: v.timeZone,
      meetingPointName: v.meetingPointName,
      meetingAddress: v.meetingAddress,
      capacity: v.capacity ? Number(v.capacity) : null,
      hashCash: v.hashCash,
      allowGuests: v.allowGuests,
      allowVisitors: v.allowVisitors,
      ...(canChangeVisibility ? { visibility: v.visibility } : {}),
    };
    if (canManage) {
      payload.runNumber = Number(v.runNumber);
      if (members) {
        const others = v.coHareIds.filter((id) => id !== v.leadHareId);
        payload.hares = v.leadHareId
          ? [{ userId: v.leadHareId, isLead: true }, ...others.map((userId) => ({ userId, isLead: false }))]
          : others.map((userId, i) => ({ userId, isLead: i === 0 }));
      }
    }
    setBusy(true);
    try {
      await onSubmit(payload);
    } finally {
      setBusy(false);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4" data-testid="run-form">
      <Card className={bleedCard}>
        <CardHeader className="pb-3">
          <CardTitle>The run</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          {canManage ? (
            <Field label="Run number" htmlFor="runNumber" error={e.runNumber?.message}>
              <Input id="runNumber" inputMode="numeric" aria-invalid={Boolean(e.runNumber)} {...register('runNumber')} />
            </Field>
          ) : (
            <input type="hidden" {...register('runNumber')} />
          )}
          <Field label="Title" htmlFor="title" error={e.title?.message}>
            <Input id="title" aria-invalid={Boolean(e.title)} {...register('title')} />
          </Field>
          <Field label="Run type" htmlFor="runType" error={e.runType?.message}>
            <Select id="runType" {...register('runType')}>
              {RUN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {runTypeLabel[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Theme (optional)" htmlFor="theme" error={e.theme?.message}>
            <Input id="theme" {...register('theme')} />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Description (optional)"
              htmlFor="description"
              error={e.description?.message}
              hint="Never describe the trail itself: it stays secret until release."
            >
              <Textarea id="description" rows={4} {...register('description')} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className={bleedCard}>
        <CardHeader className="pb-3">
          <CardTitle>When and where</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Start" htmlFor="startsAtLocal" error={e.startsAtLocal?.message} hint="In the run's local time.">
            <Input
              id="startsAtLocal"
              type="datetime-local"
              aria-invalid={Boolean(e.startsAtLocal)}
              {...register('startsAtLocal')}
            />
          </Field>
          <Field label="Time zone" htmlFor="timeZone" error={e.timeZone?.message} hint="IANA name, e.g. Africa/Lagos.">
            <Input id="timeZone" {...register('timeZone')} />
          </Field>
          <Field label="Meeting point" htmlFor="meetingPointName" error={e.meetingPointName?.message}>
            <Input id="meetingPointName" aria-invalid={Boolean(e.meetingPointName)} {...register('meetingPointName')} />
          </Field>
          <Field label="Address (optional)" htmlFor="meetingAddress" error={e.meetingAddress?.message}>
            <Input id="meetingAddress" {...register('meetingAddress')} />
          </Field>
        </CardContent>
      </Card>

      <Card className={bleedCard}>
        <CardHeader className="pb-3">
          <CardTitle>Who can come</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {canChangeVisibility ? (
            <Field label="Visibility" htmlFor="visibility" error={e.visibility?.message}>
              <Select id="visibility" {...register('visibility')}>
                {RUN_VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {runVisibilityLabel[v]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Visibility</p>
              <p className="flex h-10 items-center text-sm">{runVisibilityLabel[defaults.visibility]}</p>
              <p className="text-xs text-muted-foreground">Set by the kennel admin (D3).</p>
            </div>
          )}
          <Field label="Capacity (optional)" htmlFor="capacity" error={e.capacity?.message} hint="No waitlist: when full, Going is closed.">
            <Input id="capacity" inputMode="numeric" aria-invalid={Boolean(e.capacity)} {...register('capacity')} />
          </Field>
          <Field label="Hash cash (optional)" htmlFor="hashCash" error={e.hashCash?.message}>
            <Input id="hashCash" placeholder="₦2,000" {...register('hashCash')} />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Open to</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-primary" {...register('allowVisitors')} />
              Visiting hashers from other kennels
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-primary" {...register('allowGuests')} />
              Guests without an account
            </label>
          </fieldset>
        </CardContent>
      </Card>

      {canManage && members && (
        <Card className={bleedCard}>
          <CardHeader className="pb-3">
            <CardTitle>Hares</CardTitle>
            <CardDescription>
              Hares are active members of the kennel. At least one is needed before the run is published.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Lead hare" htmlFor="leadHareId" error={e.leadHareId?.message}>
              <Select
                id="leadHareId"
                {...register('leadHareId')}
                onChange={(ev) => {
                  setValue('leadHareId', ev.target.value, { shouldDirty: true });
                  setValue(
                    'coHareIds',
                    (coHares ?? []).filter((id) => id !== ev.target.value),
                    { shouldDirty: true },
                  );
                }}
              >
                <option value="">No hare yet</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName}
                  </option>
                ))}
              </Select>
            </Field>
            <fieldset>
              <legend className="text-sm font-medium">Co-hares</legend>
              {e.coHareIds?.message && (
                <p className="text-xs text-destructive" role="alert">
                  {e.coHareIds.message}
                </p>
              )}
              <div className="mt-2 grid max-h-64 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2">
                {members
                  .filter((m) => m.userId !== lead)
                  .map((m) => (
                    <label key={m.userId} className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        value={m.userId}
                        className="h-5 w-5 accent-primary"
                        {...register('coHareIds')}
                      />
                      {m.displayName}
                    </label>
                  ))}
              </div>
            </fieldset>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2 px-4 sm:px-0">
        <Button type="submit" size="lg" disabled={busy} data-testid="run-form-submit">
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
