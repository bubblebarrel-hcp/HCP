'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Flag, ShieldBan, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { AudiencePicker } from '@/components/profile/AudiencePicker';
import { PasswordConfirmDialog } from '@/components/profile/PasswordConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Audience } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

// Privacy and account (D57): who sees what a hasher makes, stepping away for a
// while, and leaving for good.

export default function PrivacyPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [level, setLevel] = useState<Audience>('PUBLIC');
  const [pending, setPending] = useState(0);
  const [saving, setSaving] = useState(false);
  // Whether a milestone may appear in the feed as a card (D60).
  const [milestones, setMilestones] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  // The session already carries the setting; the number waiting is its own read.
  // Both are applied in the promise callback rather than synchronously.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    api
      .get<{ data: { profileVisibility: Audience; pendingRequests: number; shareMilestones: boolean } }>('/me/privacy')
      .then((res) => {
        if (!alive) return;
        setMilestones(res.data.data.shareMilestones);
        setLevel(res.data.data.profileVisibility);
        setPending(res.data.data.pendingRequests);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user]);

  async function change(next: Audience) {
    const before = level;
    setLevel(next);
    setSaving(true);
    try {
      const res = await api.patch<{ data: { profileVisibility: Audience; pendingRequests: number } }>(
        '/me/privacy',
        { profileVisibility: next },
      );
      setPending(res.data.data.pendingRequests);
      await refreshUser();
      toast.success(
        next === 'PUBLIC'
          ? 'Your profile is public.'
          : next === 'FOLLOWERS'
            ? 'Your profile is locked. People now have to ask to follow you.'
            : 'Your profile is just for you.',
      );
    } catch (err) {
      setLevel(before);
      toast.error(errorMessage(err, 'Could not change your privacy'));
    } finally {
      setSaving(false);
    }
  }

  async function changeMilestones(next: boolean) {
    setMilestones(next);
    try {
      await api.patch('/me/privacy', { shareMilestones: next });
      toast.success(next ? 'Your milestones can show in the feed.' : 'Your milestones stay off the feed.');
    } catch (err) {
      setMilestones(!next);
      toast.error(errorMessage(err, 'Could not save that'));
    }
  }

  async function deactivate(password: string) {
    try {
      await api.post('/me/deactivate', { password });
    } catch (err) {
      throw new Error(errorMessage(err, 'Could not deactivate your account'));
    }
    toast.success('Your account is deactivated. Sign in any time to bring it back.');
    await logout();
    router.push('/');
  }

  async function deleteAccount(password: string) {
    try {
      await api.post('/me/delete', { password, confirm: 'DELETE' });
    } catch (err) {
      throw new Error(errorMessage(err, 'Could not delete your account'));
    }
    toast.success('Your account is deleted.');
    await logout();
    router.push('/');
  }

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12" aria-busy>
        <div className="h-96 animate-pulse rounded-xl bg-card" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <Link
        href="/account"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to account
      </Link>

      <Card data-testid="privacy-visibility">
        <CardHeader>
          <CardTitle className="text-2xl">Who can see what I make</CardTitle>
          <CardDescription>
            This covers your photos, posts and reels. Each reel can be narrower than this, never wider. Your name,
            picture and bio stay visible so people can find you and ask to follow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AudiencePicker kind="profile" value={level} onChange={(next) => void change(next)} disabled={saving} />
          {level !== 'PUBLIC' && pending > 0 && (
            <p className="text-sm text-muted-foreground">
              {pending} {pending === 1 ? 'person is' : 'people are'} waiting for your yes. Making your profile public
              lets them all in.
            </p>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/account/follow-requests" data-testid="to-follow-requests">
              <UserCheck className="h-4 w-4" aria-hidden />
              Follow requests{pending > 0 ? ` (${pending})` : ''}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="privacy-milestones">
        <CardHeader>
          <CardTitle>Milestones in the feed</CardTitle>
          <CardDescription>
            When you pass 10, 50 or 100 runs, the people who can see your profile may get a card for it. Turning it
            off only removes the card: the milestone stays on your Hash Passport.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={milestones}
              onChange={(event) => void changeMilestones(event.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]"
              data-testid="milestones-toggle"
            />
            Show my milestones as cards in the feed
          </label>
        </CardContent>
      </Card>

      <Card data-testid="privacy-safety">
        <CardHeader>
          <CardTitle>Blocking and tags</CardTitle>
          <CardDescription>
            Who you have blocked or muted, and photo tags waiting for your yes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/account/blocked" data-testid="to-blocked">
              <ShieldBan className="h-4 w-4" aria-hidden />
              Blocked and muted
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/account/photo-tags" data-testid="to-photo-tags">
              <Camera className="h-4 w-4" aria-hidden />
              Photo tags
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/account/reports" data-testid="to-my-reports">
              <Flag className="h-4 w-4" aria-hidden />
              My reports
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="privacy-deactivate">
        <CardHeader>
          <CardTitle>Step away for a while</CardTitle>
          <CardDescription>
            Deactivating takes your profile, photos, posts and reels off Shiggy Trails and signs you out. Kennel records that
            name you stay as they are. Nothing is removed: sign in again and everything is back.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordConfirmDialog
            trigger={
              <Button variant="outline" data-testid="deactivate-open">
                Deactivate my account
              </Button>
            }
            title="Deactivate your account?"
            description="Your profile, photos, posts and reels disappear and you are signed out. Signing in again brings everything back."
            confirmLabel="Deactivate"
            onConfirm={deactivate}
          />
        </CardContent>
      </Card>

      <Card className="border-destructive/40" data-testid="privacy-delete">
        <CardHeader>
          <CardTitle>Delete my account</CardTitle>
          <CardDescription>
            This cannot be undone. Your name, handle, picture, details, login, follows, posts, reels and their photos
            are removed. Runs you attended, trail reports and Run Capsules that mention you stay, because they are a
            kennel&apos;s record, and show you as &ldquo;Deleted hasher&rdquo;. If you hold an office in a kennel,
            resign it first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordConfirmDialog
            trigger={
              <Button variant="destructive" data-testid="delete-open">
                Delete my account
              </Button>
            }
            title="Delete your account for good?"
            description="Everything described on the page is removed and you cannot get it back."
            confirmLabel="Delete my account"
            typeWord="DELETE"
            onConfirm={deleteAccount}
          />
        </CardContent>
      </Card>
    </div>
  );
}
