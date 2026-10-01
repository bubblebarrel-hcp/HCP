'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MAX_UPLOAD_BYTES, fileSize, uploadPhoto } from '@/lib/media';
import api, { errorMessage } from '@/services/api';

// The picture and banner on a hasher's public page (D56): public identity, so
// separate from the private biodata form it sits above.
//
// Each is an ordinary media asset linked to the hasher themself, uploaded
// straight to storage (D28), and then pointed at by id. The API takes the id and
// resolves the URL, so the only picture a profile can show is one its owner
// uploaded for it.

type Slot = 'avatar' | 'banner';

const FIELD: Record<Slot, 'avatarMediaId' | 'bannerMediaId'> = { avatar: 'avatarMediaId', banner: 'bannerMediaId' };
const NOUN: Record<Slot, string> = { avatar: 'profile picture', banner: 'banner' };

// Formats a browser can actually draw. HEIC is accepted for run photos but is
// a broken square in most browsers, so it is not offered here (the API refuses it too).
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';

export function ProfileImages() {
  const { user, refreshUser } = useAuth();
  const [busy, setBusy] = useState<Slot | null>(null);
  const inputs = { avatar: useRef<HTMLInputElement>(null), banner: useRef<HTMLInputElement>(null) };

  if (!user) return null;
  const pictures: Record<Slot, string | null> = { avatar: user.avatarUrl, banner: user.bannerUrl };

  async function change(slot: Slot, file: File) {
    if (!user) return;
    if (!ACCEPT.split(',').includes(file.type)) {
      toast.error('Use a JPEG, PNG, WebP or AVIF picture.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`That file is ${fileSize(file.size)}. Pictures must be ${fileSize(MAX_UPLOAD_BYTES)} or smaller.`);
      return;
    }
    setBusy(slot);
    try {
      const media = await uploadPhoto(file, { type: 'PROFILE', id: user.id });
      await api.patch('/me/profile-images', { [FIELD[slot]]: media.id });
      await refreshUser();
      toast.success(`Your ${NOUN[slot]} is updated.`);
    } catch (err) {
      toast.error(errorMessage(err, `Could not update your ${NOUN[slot]}`));
    } finally {
      setBusy(null);
      // Choosing the same file again should still fire a change.
      if (inputs[slot].current) inputs[slot].current.value = '';
    }
  }

  async function remove(slot: Slot) {
    setBusy(slot);
    try {
      await api.patch('/me/profile-images', { [FIELD[slot]]: null });
      await refreshUser();
      toast.success(`Your ${NOUN[slot]} is removed.`);
    } catch (err) {
      toast.error(errorMessage(err, `Could not remove your ${NOUN[slot]}`));
    } finally {
      setBusy(null);
    }
  }

  const picker = (slot: Slot) => (
    <input
      ref={inputs[slot]}
      type="file"
      accept={ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-label={`Choose a ${NOUN[slot]}`}
      data-testid={`profile-${slot}-input`}
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void change(slot, file);
      }}
    />
  );

  return (
    <Card data-testid="profile-images">
      <CardHeader>
        <CardTitle>Picture and banner</CardTitle>
        <CardDescription>
          What people see on your public page, next to your name in the feed and on your comments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl border border-border">
          <div
            className="relative h-28 w-full bg-primary sm:h-40"
            style={
              pictures.banner
                ? undefined
                : { background: 'linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 45%, black))' }
            }
          >
            {pictures.banner && (
              // Storage is an arbitrary host, so next/image would need every
              // deployment's domain configured up front.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pictures.banner}
                alt=""
                className="h-full w-full object-cover"
                data-testid="profile-banner-preview"
              />
            )}
            {busy === 'banner' && (
              <span className="absolute inset-0 grid place-items-center bg-background/60" aria-live="polite">
                <Loader2 className="h-6 w-6 animate-spin" aria-label="Uploading" />
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-4">
            <div className="-mt-10 flex items-end gap-3 sm:-mt-12">
              <div className="relative">
                <Avatar name={user.displayName} size="xl" src={pictures.avatar} />
                {busy === 'avatar' && (
                  <span className="absolute inset-0 grid place-items-center rounded-full bg-background/60">
                    <Loader2 className="h-6 w-6 animate-spin" aria-label="Uploading" />
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-3">
              {picker('avatar')}
              {picker('banner')}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => inputs.avatar.current?.click()}
                data-testid="profile-avatar-change"
              >
                <Camera className="h-4 w-4" aria-hidden /> {pictures.avatar ? 'Change picture' : 'Add a picture'}
              </Button>
              {pictures.avatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => remove('avatar')}
                  data-testid="profile-avatar-remove"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Remove
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => inputs.banner.current?.click()}
                data-testid="profile-banner-change"
              >
                <Camera className="h-4 w-4" aria-hidden /> {pictures.banner ? 'Change banner' : 'Add a banner'}
              </Button>
              {pictures.banner && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => remove('banner')}
                  data-testid="profile-banner-remove"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Remove
                </Button>
              )}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          JPEG, PNG, WebP or AVIF, up to {fileSize(MAX_UPLOAD_BYTES)}. A wide picture, about three times as wide as
          it is tall, suits the banner best.
        </p>
      </CardContent>
    </Card>
  );
}
