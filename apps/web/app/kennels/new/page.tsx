'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { LocationPicker } from '@/components/map/LocationPicker';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { bleedCard, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// FR-KENNEL-001 (D33). Mirrors foundKennelSchema in
// apps/api/src/validators/kennel.validator.ts. Change both together.
const required = (label: string, max = 80) => z.string().trim().min(1, `${label} is required`).max(max);

// Coordinates are kept as strings in the form and converted on submit, so an
// empty field means "none" rather than 0 — the same shape the admin app uses.
const coordinate = (label: string, bound: number) =>
  z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (v.trim() !== '' && !Number.isNaN(Number(v)) && Math.abs(Number(v)) <= bound),
      `${label} must be a number between -${bound} and ${bound}`,
    );

const schema = z.object({
  name: required('Name', 120),
  shortName: required('Short name', 40),
  country: required('Country'),
  stateProvince: required('State or province'),
  city: required('City'),
  timeZone: required('Time zone', 60),
  latitude: coordinate('Latitude', 90),
  longitude: coordinate('Longitude', 180),
  description: required('Description', 4000),
  motto: z.string().trim().max(200),
  meetingDay: z.string().trim().max(40),
});
type Values = z.infer<typeof schema>;

// Both or neither: a single coordinate cannot put a pin anywhere.
function toCoordinates(values: Values) {
  const latitude = values.latitude === '' ? null : Number(values.latitude);
  const longitude = values.longitude === '' ? null : Number(values.longitude);
  return latitude === null || longitude === null ? { latitude: null, longitude: null } : { latitude, longitude };
}

export default function NewKennelPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { register, handleSubmit, formState, setValue, watch } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { latitude: '', longitude: '' },
  });
  const [submitting, setSubmitting] = useState(false);
  const e = formState.errors;

  // The picker and the two fields are the same value seen twice.
  const point = toCoordinates({ latitude: watch('latitude') ?? '', longitude: watch('longitude') ?? '' } as Values);
  const setPoint = useCallback(
    (next: { latitude: number; longitude: number }) => {
      setValue('latitude', String(next.latitude), { shouldValidate: true });
      setValue('longitude', String(next.longitude), { shouldValidate: true });
    },
    [setValue],
  );

  // The browser knows where it is; no reason to make someone type it.
  useEffect(() => {
    try {
      setValue('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone ?? '');
    } catch {
      // Older engines: leave it blank and let them type it.
    }
  }, [setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const res = await api.post<{ data: { kennel: { slug: string } } }>('/kennels', {
        ...values,
        ...toCoordinates(values),
        motto: values.motto || null,
        meetingDay: values.meetingDay || null,
      });
      toast.success('Your kennel is on the map. On On!');
      router.push(`/kennels/${res.data.data.kennel.slug}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not start your kennel'));
      setSubmitting(false);
    }
  });

  const text = (name: keyof Values, label: string, hint?: string) => (
    <Field label={label} htmlFor={name} error={e[name]?.message} hint={hint}>
      <Input id={name} aria-invalid={!!e[name]} {...register(name)} />
    </Field>
  );

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />}>{children}</FeedLayout>
  );

  if (loading) return shell(<div className="h-96 animate-pulse bg-card sm:rounded-xl" aria-busy />);

  if (!user) {
    return shell(
      <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="found-signin">
        <p className="font-semibold">Log in to start a kennel</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A kennel needs someone accountable for it, so we need to know who you are.
        </p>
        <Button asChild className="mt-4">
          <Link href="/auth/login">Log in</Link>
        </Button>
      </Card>,
    );
  }

  return shell(
    <Card className={bleedCard} data-testid="found-kennel">
      <CardHeader>
        <CardTitle className="text-2xl">Start a kennel</CardTitle>
        <CardDescription>
          You will be its first member and its provisional admin. It stays unverified until four of your
          mismanagement hold office, which you can set up straight after.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {text('name', 'Name', 'The full name, e.g. Jos Hash House Harriers')}
          {text('shortName', 'Short name', 'What hashers actually call it, e.g. Jos H3')}
          <div className="grid gap-4 sm:grid-cols-2">
            {text('country', 'Country')}
            {text('stateProvince', 'State or province')}
            {text('city', 'City')}
            {text('timeZone', 'Time zone', 'e.g. Africa/Lagos')}
          </div>
          {/* A kennel with no coordinates is listed but never pinned, so this
              is asked for at founding rather than left to be noticed later (D38). */}
          <fieldset className="space-y-3" data-testid="found-location">
            <legend className="text-sm font-medium">Where on the map (optional)</legend>
            <p className="text-sm text-muted-foreground">
              Drop a pin where you meet and your kennel appears on the world map the day it goes live. You can change
              it later in kennel settings.
            </p>
            <LocationPicker latitude={point.latitude} longitude={point.longitude} onChange={setPoint} />
            <div className="grid gap-4 sm:grid-cols-2">
              {text('latitude', 'Latitude', 'e.g. 9.8965')}
              {text('longitude', 'Longitude', 'e.g. 8.8583')}
            </div>
          </fieldset>

          <Field label="Description" htmlFor="description" error={e.description?.message}>
            <Textarea id="description" rows={4} aria-invalid={!!e.description} {...register('description')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {text('motto', 'Motto (optional)', 'On On through the rocks')}
            {text('meetingDay', 'Usual run day (optional)', 'Saturday')}
          </div>
          <Button type="submit" disabled={submitting} data-testid="found-submit">
            {submitting ? 'Starting…' : 'Start the kennel'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Two kennels cannot share a name in the same city, and you can only have one awaiting verification at a
            time.
          </p>
        </form>
      </CardContent>
    </Card>,
  );
}
