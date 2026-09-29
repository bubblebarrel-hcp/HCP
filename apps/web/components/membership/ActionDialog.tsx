'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';

export interface ActionValues {
  text: string;
  until: string;
  type: string;
}

// One dialog for every membership decision: optional or required text, an
// optional end date and an optional membership type. Destructive decisions use
// the danger button. Web's equivalent of admin's ConfirmDialog; never window.confirm.
// onConfirm should show its own error toast and rethrow, which keeps the dialog open.
export function ActionDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  text,
  until,
  types,
  defaultType,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  text?: { label: string; required?: boolean; placeholder?: string; hint?: string };
  until?: { label: string; hint?: string };
  types?: { value: string; label: string; hint?: string }[];
  defaultType?: string;
  onConfirm: (values: ActionValues) => Promise<void>;
}) {
  const id = useId();
  const initial = (): ActionValues => ({ text: '', until: '', type: defaultType ?? types?.[0]?.value ?? '' });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<ActionValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [minDate] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

  function change(next: boolean) {
    if (busy) return;
    setOpen(next);
    if (!next) {
      setValues(initial());
      setError(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text?.required && values.text.trim().length < 3) {
      setError(`Add a ${text.label.toLowerCase()} of at least 3 characters.`);
      return;
    }
    setBusy(true);
    try {
      await onConfirm(values);
      setBusy(false);
      setOpen(false);
      setValues(initial());
      setError(null);
    } catch {
      setBusy(false);
    }
  }

  const selectedHint = types?.find((t) => t.value === values.type)?.hint;

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description}>
        <form onSubmit={submit} className="space-y-4" data-testid="action-dialog" noValidate>
          {types && (
            <Field label="Membership type" htmlFor={`${id}-type`} hint={selectedHint}>
              <Select
                id={`${id}-type`}
                value={values.type}
                onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))}
              >
                {types.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {text && (
            <Field
              label={`${text.label} ${text.required ? '(required)' : '(optional)'}`}
              htmlFor={`${id}-text`}
              error={error ?? undefined}
              hint={text.hint}
            >
              <Textarea
                id={`${id}-text`}
                value={values.text}
                placeholder={text.placeholder}
                maxLength={1000}
                aria-invalid={error ? true : undefined}
                required={text.required}
                onChange={(e) => {
                  setValues((v) => ({ ...v, text: e.target.value }));
                  if (error) setError(null);
                }}
              />
            </Field>
          )}
          {until && (
            <Field label={`${until.label} (optional)`} htmlFor={`${id}-until`} hint={until.hint}>
              <Input
                id={`${id}-until`}
                type="date"
                min={minDate}
                value={values.until}
                onChange={(e) => setValues((v) => ({ ...v, until: e.target.value }))}
              />
            </Field>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => change(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={destructive ? 'destructive' : 'default'}
              disabled={busy}
              data-testid="action-dialog-confirm"
            >
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
