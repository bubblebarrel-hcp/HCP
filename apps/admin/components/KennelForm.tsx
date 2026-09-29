'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import api, { errorMessage } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { emptyKennel, kennelSchema, kennelToForm, toKennelPayload, type KennelFormValues } from '@/lib/schemas';
import {
  KENNEL_STATUSES,
  KENNEL_VISIBILITIES,
  ORG_TYPES,
  RUN_VISIBILITIES,
  VERIFICATION_LEVELS,
  type AdminKennel,
} from '@/lib/types';
import { humanize } from '@/lib/utils';

export function KennelForm({ kennel, onSaved }: { kennel?: AdminKennel; onSaved?: (k: AdminKennel) => void }) {
  const router = useRouter();
  const isEdit = Boolean(kennel);
  const { register, handleSubmit, formState } = useForm<KennelFormValues>({
    resolver: zodResolver(kennelSchema),
    defaultValues: kennel ? kennelToForm(kennel) : emptyKennel,
  });
  const e = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload = toKennelPayload(values);
      if (kennel) {
        const res = await api.patch<{ data: { kennel: AdminKennel } }>(`/admin/kennels/${kennel.id}`, payload);
        toast.success('Kennel saved');
        onSaved?.(res.data.data.kennel);
      } else {
        const res = await api.post<{ data: { kennel: AdminKennel } }>('/admin/kennels', payload);
        toast.success('Kennel created');
        router.push(`/kennels/${res.data.data.kennel.id}`);
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the kennel'));
    }
  });

  const text = (name: keyof KennelFormValues, label: string, hint?: string) => (
    <Field label={label} htmlFor={name} error={e[name]?.message} hint={hint}>
      <Input id={name} aria-invalid={!!e[name]} data-testid={`kennel-${name}`} {...register(name)} />
    </Field>
  );

  const select = (name: keyof KennelFormValues, label: string, options: readonly string[], hint?: React.ReactNode) => (
    <Field label={label} htmlFor={name} error={e[name]?.message} hint={hint}>
      <Select id={name} data-testid={`kennel-${name}`} {...register(name)}>
        {options.map((o) => (
          <option key={o} value={o}>{humanize(o)}</option>
        ))}
      </Select>
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate data-testid="kennel-form">
      <section className="grid gap-4 sm:grid-cols-2">
        {text('name', 'Name')}
        {text('shortName', 'Short name', 'e.g. Abuja H3')}
        {select('orgType', 'Organization type', ORG_TYPES)}
        {text('meetingDay', 'Meeting day')}
        <div className="sm:col-span-2">
          <Field label="Description" htmlFor="description" error={e.description?.message}>
            <Textarea id="description" rows={4} aria-invalid={!!e.description} data-testid="kennel-description" {...register('description')} />
          </Field>
        </div>
        {text('motto', 'Motto')}
      </section>

      <section className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
        {text('country', 'Country')}
        {text('stateProvince', 'State / province')}
        {text('city', 'City')}
        {text('timeZone', 'Time zone', 'IANA name, e.g. Africa/Lagos')}
        {text('latitude', 'Latitude')}
        {text('longitude', 'Longitude')}
        {text('logoUrl', 'Logo URL')}
        {text('bannerUrl', 'Banner URL')}
      </section>

      <section className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
        {select('status', 'Status', KENNEL_STATUSES)}
        {select(
          'verificationLevel',
          'Verification level',
          VERIFICATION_LEVELS,
          kennel?.activeMismanagementCount !== undefined
            ? `${kennel.activeMismanagementCount} active mismanagement member(s). At least 4 are needed to verify.`
            : 'New kennels start unverified: verification needs 4+ active mismanagement members.',
        )}
        {select('visibility', 'Kennel visibility', KENNEL_VISIBILITIES)}
        {select('defaultRunVisibility', 'Default run privacy', RUN_VISIBILITIES, 'Runs hosted by this kennel inherit this.')}
      </section>

      <div className="flex justify-end gap-2 border-t border-border pt-6">
        <Button type="button" variant="outline" onClick={() => router.push('/kennels')}>
          Cancel
        </Button>
        <Button type="submit" disabled={formState.isSubmitting} data-testid="kennel-submit">
          {formState.isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create kennel'}
        </Button>
      </div>
    </form>
  );
}
