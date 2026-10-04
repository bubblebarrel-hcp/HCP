'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Settings2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { LocationPicker } from '@/components/map/LocationPicker';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import type { KennelSettings } from '@/lib/types';
import { bleedCard, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// A kennel's own admins run it from here (D34). Standing and verification are
// deliberately absent: they are the platform's to set, and the API strips them
// even if they arrive. Mirrors kennelSettingsSchema in
// apps/api/src/validators/kennel.validator.ts. Change both together.
const text = (label: string, max: number) => z.string().trim().min(1, `${label} is required`).max(max);
const optional = (max: number) => z.string().trim().max(max);
// Kept as strings in the form and converted on save, so an empty field means
// "no coordinates" rather than 0 — the same shape the admin app uses.
const coordinate = (label: string, bound: number) =>
  z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (!Number.isNaN(Number(v)) && Math.abs(Number(v)) <= bound),
      `${label} must be a number between -${bound} and ${bound}`,
    );

// Empty means "use the platform default" — the field never sends 0.
const dayCount = (label: string, min: number) =>
  z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= 180),
      `${label} must be a whole number of days`,
    );

// Both or neither: a single coordinate cannot put a pin anywhere.
function toCoordinates(values: Pick<Values, 'latitude' | 'longitude'>) {
  const latitude = values.latitude === '' ? null : Number(values.latitude);
  const longitude = values.longitude === '' ? null : Number(values.longitude);
  return latitude === null || longitude === null ? { latitude: null, longitude: null } : { latitude, longitude };
}

// Same #rgb/#rrggbb shape lib/utils.ts#brandColor expects, so whatever is
// saved here is actually usable everywhere a kennel's colour shows up.
const hexColor = () =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v), 'Enter a hex colour, e.g. #F4511E');

const schema = z.object({
  name: text('Name', 120),
  shortName: text('Short name', 40),
  description: text('Description', 4000),
  motto: optional(200),
  meetingDay: optional(40),
  landingMessage: optional(2000),
  primaryColor: hexColor(),
  secondaryColor: hexColor(),
  country: text('Country', 80),
  stateProvince: text('State or province', 80),
  city: text('City', 80),
  timeZone: text('Time zone', 60),
  latitude: coordinate('Latitude', 90),
  longitude: coordinate('Longitude', 180),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'HIDDEN']),
  defaultRunVisibility: z.enum(['PUBLIC', 'MEMBERS_ONLY', 'INVITE_ONLY']),
  downDownsEnabled: z.boolean(),
  hareNudgeSoonDays: dayCount('Soon', 1),
  hareNudgeUrgentDays: dayCount('Urgent', 0),
});
type Values = z.infer<typeof schema>;

// The fallback coverBackground()/brandColor() use when a kennel has none of
// its own (D24) — shown as the swatch's starting point, never saved unless
// the admin actually picks something.
const DEFAULT_PRIMARY = '#F4511E';
const DEFAULT_SECONDARY = '#171717';

const KENNEL_VISIBILITY = [
  { value: 'PUBLIC', label: 'Public', hint: 'Listed in the directory and on the map.' },
  { value: 'UNLISTED', label: 'Unlisted', hint: 'Reachable by link, but not listed.' },
  { value: 'HIDDEN', label: 'Hidden', hint: 'Members only. Nobody else can find it.' },
];

const RUN_VISIBILITY = [
  { value: 'PUBLIC', label: 'Public', hint: 'Anyone can see the run and ask to come.' },
  { value: 'MEMBERS_ONLY', label: 'Members only', hint: 'Only your members see it.' },
  { value: 'INVITE_ONLY', label: 'Invite only', hint: 'Only hashers you invite see it.' },
];

function toForm(s: KennelSettings): Values {
  return {
    name: s.name,
    shortName: s.shortName,
    description: s.description ?? '',
    motto: s.motto ?? '',
    meetingDay: s.meetingDay ?? '',
    landingMessage: s.landingMessage ?? '',
    primaryColor: s.primaryColor ?? '',
    secondaryColor: s.secondaryColor ?? '',
    country: s.country,
    stateProvince: s.stateProvince,
    city: s.city,
    timeZone: s.timeZone,
    latitude: s.latitude === null ? '' : String(s.latitude),
    longitude: s.longitude === null ? '' : String(s.longitude),
    visibility: s.visibility,
    defaultRunVisibility: s.defaultRunVisibility,
    downDownsEnabled: s.downDownsEnabled,
    hareNudgeSoonDays: s.hareNudgeSoonDays === null ? '' : String(s.hareNudgeSoonDays),
    hareNudgeUrgentDays: s.hareNudgeUrgentDays === null ? '' : String(s.hareNudgeUrgentDays),
  };
}

export default function KennelSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { loading } = useAuth();
  const [settings, setSettings] = useState<KennelSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState, setValue, watch } = useForm<Values>({ resolver: zodResolver(schema) });
  // The picker and the two fields are the same value seen twice.
  const point = toCoordinates({ latitude: watch('latitude') ?? '', longitude: watch('longitude') ?? '' });
  const setPoint = useCallback(
    (next: { latitude: number; longitude: number }) => {
      setValue('latitude', String(next.latitude), { shouldValidate: true, shouldDirty: true });
      setValue('longitude', String(next.longitude), { shouldValidate: true, shouldDirty: true });
    },
    [setValue],
  );
  const e = formState.errors;

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    api
      .get<{ data: KennelSettings }>(`/kennels/${slug}/settings`)
      .then((res) => {
        if (cancelled) return;
        setSettings(res.data.data);
        reset(toForm(res.data.data));
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'You cannot manage this kennel.'));
      });
    return () => {
      cancelled = true;
    };
  }, [slug, loading, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      // Empty optional text means "clear it", which the API stores as null.
      const res = await api.patch<{ data: { kennel: KennelSettings } }>(`/kennels/${slug}/settings`, {
        ...values,
        ...toCoordinates(values),
        motto: values.motto || null,
        meetingDay: values.meetingDay || null,
        landingMessage: values.landingMessage || null,
        primaryColor: values.primaryColor || null,
        secondaryColor: values.secondaryColor || null,
        hareNudgeSoonDays: values.hareNudgeSoonDays === '' ? null : Number(values.hareNudgeSoonDays),
        hareNudgeUrgentDays: values.hareNudgeUrgentDays === '' ? null : Number(values.hareNudgeUrgentDays),
      });
      toast.success('Saved. Public pages can take a minute to catch up.');
      // The slug never changes, so a rename keeps this page's address.
      setSettings((prev) => (prev ? { ...prev, ...res.data.data } : prev));
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save those settings'));
    } finally {
      setSaving(false);
    }
  });

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />} wide>
      {children}
    </FeedLayout>
  );

  if (error) {
    return shell(
      <Card className={cn(bleedCard, 'p-8 text-center')} data-testid="settings-denied">
        <p className="font-semibold">{error}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/kennels/${slug}`}>Back to the kennel</Link>
        </Button>
      </Card>,
    );
  }
  if (!settings) return shell(<div className="h-96 animate-pulse bg-card sm:rounded-xl" aria-busy />);

  const pending = settings.status === 'PENDING_VERIFICATION';
  const short = (name: keyof Values, label: string, hint?: string) => (
    <Field label={label} htmlFor={name} error={e[name]?.message} hint={hint}>
      <Input id={name} aria-invalid={!!e[name]} {...register(name)} />
    </Field>
  );

  return shell(
    <div className="space-y-4">
      <Card className={bleedCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" aria-hidden />
            Kennel settings
          </CardTitle>
          <CardDescription>
            How {settings.shortName} introduces itself and who can see it. Standing and verification are set by the
            platform, not from here.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* ─── Standing: read-only, because it is not the kennel's to grant itself ─── */}
      <Card className={bleedCard} data-testid="settings-standing">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Standing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <Badge>{settings.status.replace(/_/g, ' ').toLowerCase()}</Badge>
            <span className="text-muted-foreground">
              Verification: {settings.verificationLevel.replace(/_/g, ' ').toLowerCase()}
            </span>
          </p>
          {pending && (
            <p className="text-muted-foreground" data-testid="settings-mismanagement">
              {settings.mismanagementCount} of {settings.mismanagementNeeded} mismanagement offices filled.{' '}
              {settings.mismanagementCount >= settings.mismanagementNeeded ? (
                <>The platform reviews it from here.</>
              ) : (
                <Link href={`/kennels/${slug}/officers`} className="text-primary-strong underline">
                  Appoint officers
                </Link>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Card className={bleedCard} data-testid="settings-identity">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Identity</CardTitle>
            <CardDescription>The web address stays {slug} even if the name changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {short('name', 'Name')}
            {short('shortName', 'Short name')}
            <Field label="Description" htmlFor="description" error={e.description?.message}>
              <Textarea id="description" rows={4} aria-invalid={!!e.description} {...register('description')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {short('motto', 'Motto (optional)')}
              {short('meetingDay', 'Usual run day (optional)')}
            </div>
            <Field
              label="Welcome message (optional)"
              htmlFor="landingMessage"
              hint="What a visitor reads before deciding to come out."
            >
              <Textarea id="landingMessage" rows={3} {...register('landingMessage')} />
            </Field>
          </CardContent>
        </Card>

        <Card className={bleedCard} data-testid="settings-colours">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Brand colours</CardTitle>
            <CardDescription>Shown on your kennel page, cards and avatars. Leave blank for Shiggy Trails&rsquo; defaults.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {(['primaryColor', 'secondaryColor'] as const).map((name) => {
              const label = name === 'primaryColor' ? 'Primary colour' : 'Secondary colour';
              const fallback = name === 'primaryColor' ? DEFAULT_PRIMARY : DEFAULT_SECONDARY;
              const value = watch(name);
              const swatch = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : fallback;
              return (
                <Field key={name} label={label} htmlFor={name} error={e[name]?.message}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`${label} picker`}
                      value={swatch}
                      onChange={(ev) => setValue(name, ev.target.value.toUpperCase(), { shouldValidate: true, shouldDirty: true })}
                      className="h-10 w-12 shrink-0 rounded-md border border-input bg-background p-1"
                      data-testid={`settings-${name}-picker`}
                    />
                    <Input
                      id={name}
                      placeholder={fallback}
                      aria-invalid={!!e[name]}
                      {...register(name)}
                    />
                  </div>
                </Field>
              );
            })}
          </CardContent>
        </Card>

        <Card className={bleedCard} data-testid="settings-place">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Where you hash</CardTitle>
            <CardDescription>This is what puts your pin on the map.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {short('country', 'Country')}
              {short('stateProvince', 'State or province')}
              {short('city', 'City')}
              {short('timeZone', 'Time zone', 'e.g. Africa/Lagos')}
            </div>
            {/* Without coordinates a kennel is listed but never pinned (D38). */}
            <div className="space-y-3" data-testid="settings-coordinates">
              <p className="text-sm text-muted-foreground">
                {point.latitude === null
                  ? 'No pin yet, so ' + settings.shortName + ' is listed but does not appear on the world map.'
                  : 'Drag the pin or tap the map to move it.'}
              </p>
              <LocationPicker latitude={point.latitude} longitude={point.longitude} onChange={setPoint} />
              <div className="grid gap-4 sm:grid-cols-2">
                {short('latitude', 'Latitude')}
                {short('longitude', 'Longitude')}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={bleedCard} data-testid="settings-privacy">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Who can see what</CardTitle>
            <CardDescription>
              Run privacy is the hosting kennel&rsquo;s call (D3). This is the default every new run starts from;
              hares cannot change it without a delegation.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Kennel visibility" htmlFor="visibility">
              <Select id="visibility" {...register('visibility')}>
                {KENNEL_VISIBILITY.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} — {o.hint}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Default run visibility" htmlFor="defaultRunVisibility">
              <Select id="defaultRunVisibility" {...register('defaultRunVisibility')}>
                {RUN_VISIBILITY.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} — {o.hint}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card className={bleedCard} data-testid="settings-circle">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Circle</CardTitle>
            <CardDescription>FR-CIRCLE-006: down-downs are on by default; some kennels choose not to run them.</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                data-testid="settings-down-downs"
                {...register('downDownsEnabled')}
              />
              Allow down-downs to be recorded at the Circle
            </label>
          </CardContent>
        </Card>

        <Card className={bleedCard} data-testid="settings-hare-nudges">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Hare nudges</CardTitle>
            <CardDescription>
              When Shiggy Trails speaks up about a run with nobody haring it yet (D45). Leave blank to use the platform default
              — currently {settings.hareNudgeDefaults.soonDays} and {settings.hareNudgeDefaults.urgentDays} days.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nudge the officers (days before)"
              htmlFor="hareNudgeSoonDays"
              error={e.hareNudgeSoonDays?.message}
              hint={`Platform default: ${settings.hareNudgeDefaults.soonDays}`}
            >
              <Input
                id="hareNudgeSoonDays"
                inputMode="numeric"
                placeholder={String(settings.hareNudgeDefaults.soonDays)}
                aria-invalid={!!e.hareNudgeSoonDays}
                {...register('hareNudgeSoonDays')}
              />
            </Field>
            <Field
              label="Ask the whole kennel (days before)"
              htmlFor="hareNudgeUrgentDays"
              error={e.hareNudgeUrgentDays?.message}
              hint={`Platform default: ${settings.hareNudgeDefaults.urgentDays}`}
            >
              <Input
                id="hareNudgeUrgentDays"
                inputMode="numeric"
                placeholder={String(settings.hareNudgeDefaults.urgentDays)}
                aria-invalid={!!e.hareNudgeUrgentDays}
                {...register('hareNudgeUrgentDays')}
              />
            </Field>
          </CardContent>
        </Card>

        <div className="flex gap-2 px-4 sm:px-0">
          <Button type="submit" disabled={saving} data-testid="settings-save">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Button type="button" variant="outline" onClick={() => reset(toForm(settings))} disabled={saving}>
            Undo changes
          </Button>
        </div>
      </form>

      {/* ─── Second thoughts (D34) ─── */}
      {settings.viewer.isFounder && pending && (
        <Card className={cn(bleedCard, 'border-destructive/40')} data-testid="settings-abandon">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
              Second thoughts
            </CardTitle>
            <CardDescription>
              {settings.viewer.canAbandon
                ? 'You started this kennel and nobody else has joined, so you can still close it yourself. It is archived rather than deleted, and you are free to start another.'
                : 'Other hashers have joined. A kennel with members is archived by the platform, not abandoned — ask staff if it should close.'}
            </CardDescription>
          </CardHeader>
          {settings.viewer.canAbandon && (
            <CardContent>
              <ActionDialog
                trigger={
                  <Button variant="destructive" data-testid="abandon-trigger">
                    Abandon this kennel
                  </Button>
                }
                title={`Abandon ${settings.name}?`}
                description="It leaves the directory and the map straight away. The record is kept, archived, for the audit trail."
                confirmLabel="Abandon it"
                destructive
                text={{ label: 'Reason', required: true, placeholder: 'Started it by mistake' }}
                onConfirm={async ({ text: reason }) => {
                  try {
                    await api.post(`/kennels/${slug}/abandon`, { reason });
                    toast.success('Closed. You can start another whenever you are ready.');
                    router.push('/kennels');
                  } catch (err) {
                    toast.error(errorMessage(err, 'Could not abandon this kennel'));
                    throw err;
                  }
                }}
              />
            </CardContent>
          )}
        </Card>
      )}
    </div>,
  );
}
