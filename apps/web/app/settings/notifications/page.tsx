'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, Mail, MoonStar, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { notificationCategoryHint, notificationCategoryLabel } from '@/lib/notifications';
import type { DeliveryChannel, DigestFrequency, NotificationCategory, NotificationPreferences } from '@/lib/types';
import { bleedCard, cn, formatDate } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// Every channel a hasher can be reached on (Annex 08P, D12). Each column says
// what it actually does right now rather than offering a switch that leads
// nowhere: in-app always works, email needs a provider, push needs a device.
const COLUMNS: { channel: DeliveryChannel; label: string; short: string }[] = [
  { channel: 'IN_APP', label: 'In the app', short: 'App' },
  { channel: 'PUSH', label: 'Push', short: 'Push' },
  { channel: 'EMAIL', label: 'Email', short: 'Email' },
];

// FR-NOT-007. What a hasher can ask for their email and push in a category.
const DIGEST_OPTIONS: { value: DigestFrequency; label: string }[] = [
  { value: 'IMMEDIATE', label: 'Straight away' },
  { value: 'HOURLY', label: 'A digest every hour' },
  { value: 'MORNING', label: 'A digest every morning (8am)' },
  { value: 'EVENING', label: 'A digest every evening (6pm)' },
  { value: 'WEEKLY', label: 'A digest every Monday morning' },
];

const platformLabel: Record<string, string> = { IOS: 'iPhone or iPad', ANDROID: 'Android phone', WEB: 'Browser' };

export default function NotificationSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [quiet, setQuiet] = useState({ start: '', end: '' });
  const [savingQuiet, setSavingQuiet] = useState(false);
  const [timeZone, setTimeZoneInput] = useState('');
  const [savingTimeZone, setSavingTimeZone] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ data: NotificationPreferences }>('/me/notification-preferences')
      .then((res) => {
        if (cancelled) return;
        setPrefs(res.data.data);
        setQuiet({
          start: res.data.data.push.quietHours?.start ?? '',
          end: res.data.data.push.quietHours?.end ?? '',
        });
        setTimeZoneInput(res.data.data.timeZone ?? '');
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load your notification settings'));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function toggle(category: NotificationCategory, channel: DeliveryChannel, enabled: boolean) {
    setSaving(`${category}:${channel}`);
    try {
      const res = await api.put<{ data: NotificationPreferences }>('/me/notification-preferences', {
        preferences: [{ category, channel, enabled }],
      });
      setPrefs(res.data.data);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save that'));
    } finally {
      setSaving(null);
    }
  }

  async function changeDigest(category: NotificationCategory, frequency: DigestFrequency) {
    setSaving(`${category}:digest`);
    try {
      const res = await api.put<{ data: NotificationPreferences }>('/me/notification-preferences/digest', {
        category,
        frequency,
      });
      setPrefs(res.data.data);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save that'));
    } finally {
      setSaving(null);
    }
  }

  async function saveQuietHours(clear = false) {
    setSavingQuiet(true);
    try {
      const body = clear ? { quietHours: null } : { quietHours: { start: quiet.start, end: quiet.end } };
      await api.put('/me/notification-preferences/quiet-hours', body);
      const res = await api.get<{ data: NotificationPreferences }>('/me/notification-preferences');
      setPrefs(res.data.data);
      setQuiet({
        start: res.data.data.push.quietHours?.start ?? '',
        end: res.data.data.push.quietHours?.end ?? '',
      });
      toast.success(clear ? 'Quiet hours cleared.' : 'Quiet hours saved.');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save your quiet hours'));
    } finally {
      setSavingQuiet(false);
    }
  }

  async function saveTimeZone(value: string) {
    setSavingTimeZone(true);
    try {
      await api.put('/me/timezone', { timeZone: value });
      setTimeZoneInput(value);
      const res = await api.get<{ data: NotificationPreferences }>('/me/notification-preferences');
      setPrefs(res.data.data);
      toast.success('Time zone saved.');
    } catch (err) {
      toast.error(errorMessage(err, 'Not a recognised time zone'));
    } finally {
      setSavingTimeZone(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <FeedLayout left={<LeftNav />} wide>
      {children}
    </FeedLayout>
  );

  if (!user || (!prefs && !error)) return shell(<div className="h-96 animate-pulse bg-card sm:rounded-xl" aria-busy />);
  if (error || !prefs) return shell(<Card className={cn(bleedCard, 'p-8 text-center')}>{error}</Card>);

  const live = prefs.channels;

  return shell(
    <div className="space-y-4">
      <Card className={cn(bleedCard, 'p-5')}>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="mt-1 text-muted-foreground">
          Choose what reaches you, and how. Safety notices always come through.
        </p>
      </Card>

      {/* ─── What each channel can do right now ─── */}
      <Card className={bleedCard} data-testid="channel-status">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Your channels</CardTitle>
          <CardDescription>A switch below only does something if its channel can reach you.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <p className="flex items-center gap-2 font-medium">
              <BellRing className="h-4 w-4" aria-hidden />
              In the app
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Always on. Everything lands here first.</p>
          </div>

          <div className="rounded-lg border border-border p-3" data-testid="push-status">
            <p className="flex items-center gap-2 font-medium">
              <Smartphone className="h-4 w-4" aria-hidden />
              Push
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {!prefs.push.enabledPlatformWide
                ? 'Switched off for Shiggy Trails right now.'
                : prefs.push.devices.length === 0
                  ? 'No device yet. Open the Shiggy Trails app on your phone and allow notifications.'
                  : `${prefs.push.devices.length} device${prefs.push.devices.length === 1 ? '' : 's'} registered.`}
            </p>
            {prefs.push.devices.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {prefs.push.devices.map((d) => (
                  <li key={d.id}>
                    {platformLabel[d.platform] ?? d.platform} · last seen {formatDate(d.lastSeenAt)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="flex items-center gap-2 font-medium">
              <Mail className="h-4 w-4" aria-hidden />
              Email
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {live.email ? `Sent to ${user.email}.` : 'No email provider is connected, so nothing is sent.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Quiet hours (FR-NOT-006) ─── */}
      <Card className={bleedCard} data-testid="quiet-hours">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MoonStar className="h-4 w-4" aria-hidden />
            Quiet hours
          </CardTitle>
          <CardDescription>
            Hours when your phone should stay quiet. Only push is held back — everything still waits for you in the
            app, and anything critical still comes through.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border p-3" data-testid="time-zone">
            <p className="font-medium">Time zone</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {prefs.timeZone
                ? `Quiet hours are worked out for ${prefs.timeZone}.`
                : 'Not set yet, so quiet hours are worked out for UTC — probably not where you are.'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                value={timeZone}
                onChange={(e) => setTimeZoneInput(e.target.value)}
                placeholder="e.g. Africa/Lagos"
                className="w-56"
                data-testid="time-zone-input"
              />
              <Button
                size="sm"
                onClick={() => void saveTimeZone(timeZone)}
                disabled={savingTimeZone || !timeZone.trim()}
                data-testid="save-time-zone"
              >
                {savingTimeZone ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void saveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
                disabled={savingTimeZone}
                data-testid="detect-time-zone"
              >
                Use this device&rsquo;s time zone
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Field label="From" htmlFor="quiet-start">
              <Input
                id="quiet-start"
                type="time"
                value={quiet.start}
                onChange={(e) => setQuiet((q) => ({ ...q, start: e.target.value }))}
                className="w-36"
              />
            </Field>
            <Field label="Until" htmlFor="quiet-end">
              <Input
                id="quiet-end"
                type="time"
                value={quiet.end}
                onChange={(e) => setQuiet((q) => ({ ...q, end: e.target.value }))}
                className="w-36"
              />
            </Field>
            <Button
              onClick={() => void saveQuietHours(false)}
              disabled={savingQuiet || !quiet.start || !quiet.end}
              data-testid="save-quiet-hours"
            >
              {savingQuiet ? 'Saving…' : 'Save'}
            </Button>
            {prefs.push.quietHours && (
              <Button variant="outline" onClick={() => void saveQuietHours(true)} disabled={savingQuiet}>
                Clear
              </Button>
            )}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {prefs.push.quietHours
              ? `Quiet between ${prefs.push.quietHours.start} and ${prefs.push.quietHours.end}, in your own time zone.`
              : 'No quiet hours set, so push can arrive at any time.'}
          </p>
        </CardContent>
      </Card>

      {/* ─── Per category, per channel ─── */}
      <Card className={bleedCard} data-testid="notification-preferences">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">What you hear about</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden grid-cols-[1fr_auto] gap-4 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Category</span>
            <span className="grid w-48 grid-cols-3 text-center">
              {COLUMNS.map((c) => (
                <span key={c.channel}>{c.short}</span>
              ))}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {prefs.categories.map((row) => (
              <li key={row.category} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{notificationCategoryLabel[row.category]}</p>
                  <p className="text-sm text-muted-foreground">{notificationCategoryHint[row.category]}</p>
                  {row.digestable && (
                    <label className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Email and push:</span>
                      <Select
                        value={row.digest}
                        disabled={saving === `${row.category}:digest`}
                        onChange={(e) => void changeDigest(row.category, e.target.value as DigestFrequency)}
                        className="h-9 w-auto min-w-52"
                        data-testid={`digest-${row.category}`}
                        aria-label={`${notificationCategoryLabel[row.category]}: how often to email and push`}
                      >
                        {DIGEST_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                  )}
                </div>
                <div className="grid w-48 grid-cols-3">
                  {COLUMNS.map((c) => {
                    const on = c.channel === 'IN_APP' ? row.inApp : c.channel === 'PUSH' ? row.push : row.email;
                    // Safety in-app is never switchable (BR-NOT-007), and a
                    // channel that cannot reach this hasher is shown but inert.
                    const locked = row.locked && c.channel === 'IN_APP';
                    const reachable = c.channel === 'IN_APP' ? true : c.channel === 'PUSH' ? live.push : live.email;
                    const id = `${row.category}:${c.channel}`;
                    return (
                      <label key={c.channel} className="flex min-h-11 items-center justify-center">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-primary disabled:opacity-40"
                          checked={on}
                          disabled={locked || !reachable || saving === id}
                          onChange={(e) => void toggle(row.category, c.channel, e.target.checked)}
                          data-testid={`pref-${row.category}-${c.channel}`}
                          aria-label={`${notificationCategoryLabel[row.category]} by ${c.label}`}
                        />
                      </label>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Safety notifications in the app cannot be switched off. A greyed switch means that channel cannot reach
            you yet. A digest gathers the email and push for a category into one message; the app still shows each
            notice as it happens. Anything urgent, and anything about a run or a trail at a time, is always sent
            straight away.
          </p>
        </CardContent>
      </Card>
    </div>,
  );
}
