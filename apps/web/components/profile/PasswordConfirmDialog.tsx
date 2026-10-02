'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';

// An account decision that has to be meant: it asks for the password, and when
// `typeWord` is given, for that word typed out as well. Deactivating asks for
// the first; deleting, which cannot be undone, asks for both (D57).
//
// onConfirm throws to keep the dialog open, and shows its own error message.
export function PasswordConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  typeWord,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  typeWord?: string;
  onConfirm: (password: string) => Promise<void>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  function change(next: boolean) {
    if (busy) return;
    setOpen(next);
    if (!next) {
      setPassword('');
      setTyped('');
      setError(null);
    }
  }

  const ready = password.length > 0 && (!typeWord || typed === typeWord);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(password);
      setBusy(false);
      setOpen(false);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description}>
        <form onSubmit={submit} className="space-y-4" data-testid="password-confirm" noValidate>
          <Field label="Your password" htmlFor={`${id}-password`} error={error ?? undefined}>
            <Input
              id={`${id}-password`}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError(null);
              }}
              aria-invalid={error ? true : undefined}
              data-testid="confirm-password"
            />
          </Field>
          {typeWord && (
            <Field label={`Type ${typeWord} to confirm`} htmlFor={`${id}-word`}>
              <Input
                id={`${id}-word`}
                value={typed}
                autoComplete="off"
                onChange={(event) => setTyped(event.target.value)}
                data-testid="confirm-word"
              />
            </Field>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => change(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy || !ready} data-testid="confirm-submit">
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
