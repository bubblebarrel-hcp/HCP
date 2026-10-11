'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Bookmark, ChevronRight, Lock, ShieldBan, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { FeedLayout } from '@/components/layout/FeedLayout';
import { LeftNav } from '@/components/layout/LeftNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useDevicePrefs, type DevicePrefs } from '@/lib/device-prefs';
import { QUALITY_OPTIONS } from '@/lib/video-quality';
import { bleedCard, cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// Everything a hasher can tune about the app, in one place. Where a setting
// already has a page of its own (notifications, privacy) this links to it
// rather than copying it; what is left is how this device plays media, the
// theme, and the password.

const links = [
  { href: '/settings/notifications', icon: Bell, label: 'Notifications', hint: 'What reaches you, where, and when' },
  { href: '/account/privacy', icon: Lock, label: 'Privacy and account', hint: 'Who sees your things, deactivate, delete your account' },
  { href: '/account/blocked', icon: ShieldBan, label: 'Blocked hashers', hint: 'People you have blocked' },
  { href: '/account/follow-requests', icon: UserCheck, label: 'Follow requests', hint: 'Who is waiting for you to approve them' },
  { href: '/saved', icon: Bookmark, label: 'Saved', hint: 'Everything you have bookmarked' },
];

function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        data-testid={testId}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          checked ? 'bg-primary' : 'bg-muted-foreground/40',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useDevicePrefs();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  const set = (patch: Partial<DevicePrefs>) => setPrefs(patch);

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (next !== again) {
      toast.error('The two new passwords are not the same.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/me/password', { currentPassword: current, newPassword: next });
      toast.success('Password changed. Sign in again with the new one.');
      await logout();
      router.push('/auth/login');
    } catch (error) {
      toast.error(errorMessage(error, 'That did not change your password.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <FeedLayout left={<LeftNav />}>
        <div className="h-72 animate-pulse rounded-xl bg-card" aria-busy />
      </FeedLayout>
    );
  }

  return (
    <FeedLayout left={<LeftNav />}>
      <h1 className="px-4 text-2xl font-semibold sm:px-0">Settings</h1>

      <div className="mt-4 space-y-4">
        <Card className={bleedCard}>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {links.map(({ href, icon: Icon, label, hint }) => (
              <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-sm text-muted-foreground">{hint}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className={bleedCard}>
          <CardHeader>
            <CardTitle>Display</CardTitle>
            <CardDescription>Follows your device unless you pick one.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card className={bleedCard}>
          <CardHeader>
            <CardTitle>Video and media</CardTitle>
            <CardDescription>Saved on this device only, so a phone and a laptop can differ.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Switch
              checked={prefs.autoplay && !prefs.dataSaver}
              disabled={prefs.dataSaver}
              onChange={(autoplay) => set({ autoplay })}
              label="Autoplay videos"
              hint="Clips play, without sound, as they scroll into view."
              testId="pref-autoplay"
            />
            <Switch
              checked={prefs.startMuted || prefs.autoplay}
              disabled={prefs.autoplay && !prefs.dataSaver}
              onChange={(startMuted) => set({ startMuted })}
              label="Start videos muted"
              hint="Autoplay is always silent. Turn this off to hear a clip the moment you press play."
              testId="pref-muted"
            />
            <div className="space-y-2">
              <p className="text-sm font-medium">Video quality</p>
              <p className="text-sm text-muted-foreground">
                Auto plays the small 360p copy on a slow or data-saving connection and 720p otherwise. Pick 1080p for the
                sharpest copy when a video has one. A video with no other sizes plays as it is.
              </p>
              <div role="group" aria-label="Video quality" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
                {QUALITY_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={prefs.quality === value}
                    onClick={() => set({ quality: value })}
                    data-testid={`pref-quality-${value}`}
                    className={cn(
                      'min-h-9 rounded-md px-2 text-sm font-medium transition-colors',
                      prefs.quality === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Switch
              checked={prefs.dataSaver}
              onChange={(dataSaver) => set({ dataSaver })}
              label="Data saver"
              hint="Loads a video only when you press play and turns autoplay off. Use it on a slow or metered connection."
              testId="pref-datasaver"
            />
          </CardContent>
        </Card>

        <Card className={bleedCard}>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Every device is signed out afterwards, this one included.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="max-w-sm space-y-3" data-testid="password-form">
              <Field label="Current password" htmlFor="pw-current">
                <Input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  required
                />
              </Field>
              <Field
                label="New password"
                htmlFor="pw-new"
                hint="Same rules as when you joined: at least 8 characters, with a letter and a number."
              >
                <Input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                  required
                />
              </Field>
              <Field label="New password again" htmlFor="pw-again">
                <Input
                  id="pw-again"
                  type="password"
                  autoComplete="new-password"
                  value={again}
                  onChange={(event) => setAgain(event.target.value)}
                  required
                />
              </Field>
              <Button type="submit" disabled={saving || !current || !next || !again}>
                Change password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </FeedLayout>
  );
}
