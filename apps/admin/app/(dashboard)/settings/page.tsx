'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import api, { errorMessage } from '@/services/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ReasonDialog } from '@/components/ui/reason-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import type { PlatformSettingRow } from '@/lib/types';
import { formatDate } from '@/lib/utils';

// Only keys the API reads are listed, so every row here changes real behaviour.
// A change is recorded in the audit log with who made it and the old value.

function SettingRow({ setting, onSaved }: { setting: PlatformSettingRow; onSaved: (s: PlatformSettingRow) => void }) {
  const [draft, setDraft] = useState(String(setting.value));
  const parsed = Number(draft);
  const valid = draft.trim() !== '' && Number.isInteger(parsed) && parsed >= 0 && parsed <= 3650;
  const dirty = valid && parsed !== setting.value;
  const id = `setting-${setting.key}`;

  async function save(reason: string) {
    try {
      const res = await api.patch<{ data: { setting: PlatformSettingRow } }>(`/admin/settings/${setting.key}`, {
        value: parsed,
        ...(reason ? { reason } : {}),
      });
      onSaved(res.data.data.setting);
      toast.success('Setting saved');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the setting'));
      throw err;
    }
  }

  return (
    <li className="flex flex-wrap items-end justify-between gap-4 py-4" data-testid="setting-row">
      <div className="min-w-0 max-w-xl">
        <label htmlFor={id} className="font-mono text-sm font-medium">{setting.key}</label>
        <p className="text-sm text-muted-foreground">{setting.description}</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          Default {setting.defaultValue}
          {setting.overridden ? <StatusBadge value="Overridden" tone="warn" /> : null}
          {setting.updatedAt ? <span>· changed {formatDate(setting.updatedAt)}</span> : null}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={3650}
          className="w-24"
          value={draft}
          aria-invalid={!valid}
          onChange={(e) => setDraft(e.target.value)}
        />
        <ReasonDialog
          title={`Change ${setting.key}?`}
          description={`From ${setting.value} to ${parsed}. This takes effect immediately for everyone.`}
          confirmLabel="Save"
          required={false}
          onConfirm={save}
          trigger={<Button disabled={!dirty} data-testid="setting-save">Save</Button>}
        />
        {draft !== String(setting.value) && (
          <Button variant="ghost" onClick={() => setDraft(String(setting.value))}>Reset</Button>
        )}
      </div>
    </li>
  );
}

export default function SettingsPage() {
  const [items, setItems] = useState<PlatformSettingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ data: { items: PlatformSettingRow[] } }>('/admin/settings');
      setItems(res.data.data.items);
    } catch (err) {
      setError(errorMessage(err, 'Could not load settings'));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: the loader sets state as it starts
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Platform-wide values. Kennel rules such as D10 read them live, so a change applies at once." />
      <Card>
        <CardContent className="pt-6">
          {error ? (
            <div className="py-6 text-center">
              <p className="text-destructive" role="alert">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={load}>Try again</Button>
            </div>
          ) : !items ? (
            <div className="space-y-4" aria-busy>
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded bg-muted" />)}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((s) => (
                <SettingRow key={s.key} setting={s} onSaved={(next) => setItems((cur) => cur?.map((x) => (x.key === next.key ? next : x)) ?? cur)} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
