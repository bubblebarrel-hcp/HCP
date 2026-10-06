'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { humanize } from '@/lib/utils';

export type FilterField =
  | { name: string; label: string; type: 'search'; placeholder?: string }
  | { name: string; label: string; type: 'select'; options: readonly string[] | { value: string; label: string }[] }
  | { name: string; label: string; type: 'date' };

export type FilterValues = Record<string, string>;

// Search commits on submit; selects and dates apply as they change. All of it is
// sent to the API: nothing is filtered client-side.
export function FilterBar({
  fields,
  values,
  onChange,
  testId = 'filters',
}: {
  fields: FilterField[];
  values: FilterValues;
  onChange: (next: FilterValues) => void;
  testId?: string;
}) {
  const [draft, setDraft] = useState<FilterValues>({});
  const active = Object.values(values).some(Boolean);

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      role="search"
      data-testid={testId}
      onSubmit={(e) => {
        e.preventDefault();
        const next = { ...values };
        for (const f of fields) if (f.type === 'search' && draft[f.name] !== undefined) next[f.name] = draft[f.name].trim();
        onChange(next);
      }}
    >
      {fields.map((f) => {
        const id = `${testId}-${f.name}`;
        return (
          <div key={f.name} className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{f.label}</label>
            {f.type === 'search' ? (
              <Input
                id={id}
                className="w-64"
                placeholder={f.placeholder}
                value={draft[f.name] ?? values[f.name] ?? ''}
                onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })}
              />
            ) : f.type === 'select' ? (
              <Select id={id} className="w-44" value={values[f.name] ?? ''} onChange={(e) => onChange({ ...values, [f.name]: e.target.value })}>
                <option value="">All</option>
                {f.options.map((o) => {
                  const opt = typeof o === 'string' ? { value: o, label: humanize(o) } : o;
                  return <option key={opt.value} value={opt.value}>{opt.label}</option>;
                })}
              </Select>
            ) : (
              <Input id={id} type="date" className="w-40" value={values[f.name] ?? ''} onChange={(e) => onChange({ ...values, [f.name]: e.target.value })} />
            )}
          </div>
        );
      })}
      {fields.some((f) => f.type === 'search') && <Button type="submit" variant="outline">Search</Button>}
      {active && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setDraft({});
            onChange({});
          }}
        >
          Clear
        </Button>
      )}
    </form>
  );
}
