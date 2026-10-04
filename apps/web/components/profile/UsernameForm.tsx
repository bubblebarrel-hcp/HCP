'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import api, { errorMessage } from '@/services/api';

// What other hashers type to mention you (D59). The hash handle is still the
// name shown everywhere (D11); this is only how you are addressed, so it can be
// short and it has to be unique.
//
// Mirrors USERNAME_PATTERN in apps/api/src/utils/entities.ts — change both together.
const PATTERN = /^[a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9])$/;

export function UsernameForm() {
  const { user, refreshUser } = useAuth();
  const [value, setValue] = useState(user?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const next = value.trim().replace(/^@/, '').toLowerCase();
  const changed = next !== (user.username ?? '');

  const save = async () => {
    if (!PATTERN.test(next) || next.includes('..')) {
      setError('3 to 30 letters, numbers, "_" or ".", starting and ending on a letter or number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.patch('/me/username', { username: next });
      await refreshUser();
      toast.success(`You are @${next} now.`);
    } catch (err) {
      setError(errorMessage(err, 'Could not change your username.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="mt-4 border-t border-border pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      data-testid="username-form"
    >
      <Field
        label="Username"
        htmlFor="username"
        hint="How other hashers @mention you. Your hash handle is still the name people see."
        error={error ?? undefined}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
            <Input
              id="username"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="pl-7"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={31}
              aria-invalid={error ? true : undefined}
              data-testid="username-input"
            />
          </div>
          <Button type="submit" size="sm" className="h-10" disabled={busy || !changed} data-testid="username-save">
            Save
          </Button>
        </div>
      </Field>
    </form>
  );
}
