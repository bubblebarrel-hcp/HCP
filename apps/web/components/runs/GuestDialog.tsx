'use client';

import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import type { RunDetail } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

interface Values {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consent: boolean;
  checkIn: boolean;
}

const empty: Values = { firstName: '', lastName: '', email: '', phone: '', consent: false, checkIn: false };

// D23: a guest gives first name, last name, email and consent; phone is optional.
// Officers adding a walk-in can check them in straight away.
export function GuestDialog({
  runId,
  trigger,
  officer = false,
  allowCheckIn = false,
  onDone,
}: {
  runId: string;
  trigger: React.ReactNode;
  officer?: boolean;
  allowCheckIn?: boolean;
  onDone: (run: RunDetail) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!values.firstName.trim()) next.firstName = 'Enter a first name';
    if (!values.lastName.trim()) next.lastName = 'Enter a last name';
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) next.email = 'Enter a valid email';
    if (!values.consent) next.consent = 'Consent is needed to record a guest';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const res = await api.post<{ data: { run: RunDetail; registration: { displayName: string } } }>(
        `/runs/${runId}/guests`,
        {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
          consent: true,
          checkIn: officer && allowCheckIn && values.checkIn,
        },
      );
      onDone(res.data.data.run);
      toast.success(
        officer ? `${res.data.data.registration.displayName} added.` : "You're registered. See you on trail!",
      );
      setOpen(false);
      setValues(empty);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not register the guest'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) {
          setValues(empty);
          setErrors({});
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={officer ? 'Add a guest' : 'Register as a guest'}
        description={
          officer ? 'For someone hashing without an HCP account.' : 'No account needed. The hares will know you are coming.'
        }
      >
        <form onSubmit={submit} noValidate className="space-y-4" data-testid="guest-dialog">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor={`${id}-first`} error={errors.firstName}>
              <Input
                id={`${id}-first`}
                autoComplete="given-name"
                value={values.firstName}
                aria-invalid={Boolean(errors.firstName)}
                onChange={(e) => set('firstName', e.target.value)}
              />
            </Field>
            <Field label="Last name" htmlFor={`${id}-last`} error={errors.lastName}>
              <Input
                id={`${id}-last`}
                autoComplete="family-name"
                value={values.lastName}
                aria-invalid={Boolean(errors.lastName)}
                onChange={(e) => set('lastName', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Email" htmlFor={`${id}-email`} error={errors.email}>
            <Input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              value={values.email}
              aria-invalid={Boolean(errors.email)}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <Field label="Phone (optional)" htmlFor={`${id}-phone`}>
            <Input
              id={`${id}-phone`}
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>
          <div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                checked={values.consent}
                aria-invalid={Boolean(errors.consent)}
                onChange={(e) => set('consent', e.target.checked)}
              />
              <span>
                {officer ? 'The guest agrees' : 'I agree'} that HCP stores this name and email to record the run.
              </span>
            </label>
            {errors.consent && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {errors.consent}
              </p>
            )}
          </div>
          {officer && allowCheckIn && (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={values.checkIn}
                onChange={(e) => set('checkIn', e.target.checked)}
              />
              Check them in now
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} data-testid="guest-dialog-submit">
              {busy ? 'Saving…' : officer ? 'Add guest' : 'Register'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
