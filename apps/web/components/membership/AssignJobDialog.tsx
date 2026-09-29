'use client';

import { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { grantableRoles, roleLabel } from '@/lib/membership';
import type { GrantableRole, KennelMember, OfficerPosition } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

// Giving a member a job in the kennel (D39, D40).
//
// Two shapes of job, deliberately kept apart because the API does:
//   - an office  — a seat this kennel defined, with a title and a term
//   - a role     — a standing job carrying platform authority (scribe, admin)
//
// Kennels name things their own way — a photographer is the Hash Flash in one
// kennel and the Hash Snapper in the next — so an office title is free text and
// a role carries the kennel's own word for it alongside the authority it grants.

const NEW_OFFICE = 'new-office';

export function AssignJobDialog({
  member,
  slug,
  positions,
  canAppoint,
  canGrantRoles,
  roleTitles,
  onDone,
}: {
  member: KennelMember;
  slug: string;
  positions: OfficerPosition[];
  canAppoint: boolean;
  canGrantRoles: boolean;
  // What this kennel already calls each role, so its vocabulary is the default.
  roleTitles: Partial<Record<GrantableRole, string>>;
  onDone: () => Promise<void>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState('');
  const [title, setTitle] = useState('');
  const [mismanagement, setMismanagement] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const name = member.member.displayName;

  const options = useMemo(() => {
    // What they already hold never appears as something to give them again.
    const heldPositions = new Set(member.offices.map((o) => o.positionId));
    const heldRoles = new Set(member.roles.map((r) => r.role));
    const offices = canAppoint
      ? positions
          .filter((p) => !p.archived && !heldPositions.has(p.id))
          .map((p) => ({
            value: `office:${p.id}`,
            label: p.title,
            hint: p.isMismanagement ? 'A mismanagement office of this kennel' : 'An office of this kennel',
          }))
      : [];
    const roles = canGrantRoles
      ? grantableRoles
          .filter((r) => !heldRoles.has(r.value))
          .map((r) => ({ value: `role:${r.value}`, label: roleTitles[r.value] ?? r.label, hint: r.hint }))
      : [];
    return { offices, roles };
  }, [positions, canAppoint, canGrantRoles, roleTitles, member]);

  const selected = choice || options.offices[0]?.value || options.roles[0]?.value || (canGrantRoles ? NEW_OFFICE : '');
  const kind = selected === NEW_OFFICE ? 'new' : selected.startsWith('office:') ? 'office' : 'role';
  const role = kind === 'role' ? (selected.split(':')[1] as GrantableRole) : null;
  const hint =
    kind === 'new'
      ? 'A seat of your own: Hash Cash, Beer Meister, Hash Haberdasher — whatever this kennel calls it.'
      : [...options.offices, ...options.roles].find((o) => o.value === selected)?.hint;

  function close(next: boolean) {
    if (busy) return;
    setOpen(next);
    if (!next) {
      setChoice('');
      setTitle('');
      setMismanagement(true);
      setError(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (kind === 'new' && trimmed.length < 2) {
      setError('Give the office a name of at least 2 characters.');
      return;
    }

    setBusy(true);
    try {
      if (kind === 'new') {
        // Defining the seat and filling it are two API calls because they are
        // two different powers (D32); the dialog just does them in order.
        const created = await api.post<{ data: { items: OfficerPosition[] } }>(
          `/kennels/${encodeURIComponent(slug)}/positions`,
          { title: trimmed, permissions: [], isMismanagement: mismanagement },
        );
        const position = created.data.data.items.find((p) => p.title === trimmed);
        if (!position) throw new Error('The office was created but could not be found to fill it');
        await api.post(`/positions/${position.id}/appointments`, { userId: member.member.id });
        toast.success(`${name} is ${trimmed}.`);
      } else if (kind === 'office') {
        await api.post(`/positions/${selected.split(':')[1]}/appointments`, { userId: member.member.id });
        toast.success(`${name} is set.`);
      } else if (role) {
        await api.post(`/kennels/${encodeURIComponent(slug)}/roles`, {
          userId: member.member.id,
          role,
          // Empty means "call it what the platform calls it".
          title: trimmed || null,
        });
        toast.success(`${name} is ${trimmed || roleLabel[role]}.`);
      }
      await onDone();
      close(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not assign that'));
    } finally {
      setBusy(false);
    }
  }

  if (!canAppoint && !canGrantRoles) return null;
  if (options.offices.length === 0 && options.roles.length === 0 && !canGrantRoles) return null;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="member-assign">
          Give a job
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`What does ${name} do for the kennel?`}
        description="An office is a seat this kennel defines and can name however it likes. A role carries authority across HCP — you can still call it whatever your kennel calls it."
      >
        <form onSubmit={submit} className="space-y-4" data-testid="assign-job-dialog" noValidate>
          <Field label="Job" htmlFor={`${id}-choice`} hint={hint}>
            <Select
              id={`${id}-choice`}
              value={selected}
              onChange={(event) => {
                setChoice(event.target.value);
                setTitle('');
                setError(null);
              }}
              data-testid="assign-job-choice"
            >
              {options.offices.length > 0 && (
                <optgroup label="Offices of this kennel">
                  {options.offices.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {options.roles.length > 0 && (
                <optgroup label="Standing roles">
                  {options.roles.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {canGrantRoles && (
                <optgroup label="Something else">
                  <option value={NEW_OFFICE}>New office…</option>
                </optgroup>
              )}
            </Select>
          </Field>

          {kind === 'new' && (
            <>
              <Field label="What this kennel calls it" htmlFor={`${id}-title`} error={error ?? undefined}>
                <Input
                  id={`${id}-title`}
                  value={title}
                  placeholder="Hash Flash"
                  maxLength={80}
                  autoFocus
                  aria-invalid={error ? true : undefined}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    if (error) setError(null);
                  }}
                  data-testid="assign-job-title"
                />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={mismanagement}
                  onChange={(event) => setMismanagement(event.target.checked)}
                  data-testid="assign-job-mismanagement"
                />
                <span>
                  Part of the mismanagement
                  <span className="block text-muted-foreground">
                    Mismanagement offices are what a kennel needs four of to be verified.
                  </span>
                </span>
              </label>
              <p className="text-sm text-muted-foreground">
                The office starts with no permissions. Add them on the offices screen once it exists.
              </p>
            </>
          )}

          {kind === 'role' && role && (
            <Field
              label="What this kennel calls it (optional)"
              htmlFor={`${id}-role-title`}
              hint={`Leave it empty to use “${roleLabel[role]}”. The authority is the same either way.`}
            >
              <Input
                id={`${id}-role-title`}
                value={title}
                placeholder={roleTitles[role] ?? roleLabel[role]}
                maxLength={60}
                onChange={(event) => setTitle(event.target.value)}
                data-testid="assign-role-title"
              />
            </Field>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => close(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} data-testid="assign-job-submit">
              {busy ? 'Assigning…' : 'Assign'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
