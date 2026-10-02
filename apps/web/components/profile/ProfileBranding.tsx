'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Check, Loader2, Move, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { Button } from '@/components/ui/button';
import { KEY_STEP, clamp, formatPosition, parsePosition } from '@/lib/banner';
import { MAX_UPLOAD_BYTES, fileSize, uploadPhoto } from '@/lib/media';
import { brandColor, cn, coverBackground } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// The top of a hasher's page: banner, picture and, for the hasher themself, the
// controls that change them (D56). This is KennelBranding (D37) for a person, so
// the two feel the same: edited in place on the page rather than on a form, the
// banner dragged into position, removal behind a confirmation.
//
// It differs from a kennel's in one way, on purpose. A kennel stores the picture's
// URL; a hasher's pictures are sent as media ids, and the API resolves the URL
// (profile.service#setProfileImages), so a profile can only ever show a picture
// its owner uploaded for it.

type Slot = 'avatar' | 'banner';

const FIELD: Record<Slot, 'avatarMediaId' | 'bannerMediaId'> = { avatar: 'avatarMediaId', banner: 'bannerMediaId' };
const NOUN: Record<Slot, string> = { avatar: 'picture', banner: 'banner' };

// Formats a browser can actually draw. HEIC is accepted for run photos but is
// a broken square in most browsers, so it is not offered here (the API refuses it too).
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';

export function ProfileBranding({
  hasherId,
  name,
  color,
  avatarUrl,
  bannerUrl,
  bannerPosition,
  bannerClassName = 'h-40 sm:h-64',
  children,
}: {
  hasherId: string;
  name: string;
  color?: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: string | null;
  // Pages differ in how much banner they want; the controls follow it.
  bannerClassName?: string;
  children: React.ReactNode;
}) {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  // What this editor has changed since the page was rendered, so a new picture
  // stays on screen without waiting for the public page to regenerate. Absent
  // means "whatever the page said", which is why it is not seeded from the props.
  const [edited, setEdited] = useState<Partial<Record<Slot, string | null>>>({});
  const [editedPosition, setEditedPosition] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState<Slot | null>(null);
  // Non-null while the banner is being dragged into place: the point being
  // worked on, kept apart from the saved one so Cancel is a real cancel.
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);
  const [savingPosition, setSavingPosition] = useState(false);
  const inputs = { avatar: useRef<HTMLInputElement>(null), banner: useRef<HTMLInputElement>(null) };
  const bannerRef = useRef<HTMLDivElement>(null);
  const grab = useRef<{ pointerId: number; startX: number; startY: number; from: { x: number; y: number } } | null>(
    null,
  );

  // Your own page only. The API checks it again on every write; this is just
  // whether to offer the controls, and signing out takes them away at once.
  const canManage = user?.id === hasherId;
  const pictures = {
    avatar: edited.avatar !== undefined ? edited.avatar : avatarUrl,
    banner: edited.banner !== undefined ? edited.banner : bannerUrl,
  };
  const savedPosition = parsePosition(editedPosition !== undefined ? editedPosition : bannerPosition);
  // What is on screen: the drag in progress, or what is saved.
  const shown = dragging ?? savedPosition;
  const repositioning = dragging !== null;

  async function save(slot: Slot, mediaId: string | null, url: string | null) {
    await api.patch('/me/profile-images', { [FIELD[slot]]: mediaId });
    setEdited((current) => ({ ...current, [slot]: url }));
    // A different picture is cropped differently, so a new banner starts centred
    // rather than inheriting a position chosen for the one before it (the API
    // resets it the same way).
    if (slot === 'banner') setEditedPosition(null);
    // The page may be a Server Component and the header and left nav read the
    // session, so refresh both for the editor's own view to agree straight away.
    await refreshUser();
    router.refresh();
  }

  // ─── Repositioning the banner ───

  const nudge = useCallback((dx: number, dy: number) => {
    setDragging((current) => (current ? { x: clamp(current.x + dx), y: clamp(current.y + dy) } : current));
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    event.preventDefault();
    grab.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, from: dragging };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const held = grab.current;
    if (!held || held.pointerId !== event.pointerId) return;
    const box = bannerRef.current?.getBoundingClientRect();
    if (!box) return;
    // Dragging down should bring the top of the picture into view, which means
    // moving the crop up: the position moves against the pointer. A drag across
    // the whole strip covers the whole picture, which keeps the far edges
    // reachable however tall the original is.
    setDragging({
      x: clamp(held.from.x - ((event.clientX - held.startX) / box.width) * 100),
      y: clamp(held.from.y - ((event.clientY - held.startY) / box.height) * 100),
    });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (grab.current?.pointerId !== event.pointerId) return;
    grab.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!dragging) return;
    const steps: Record<string, [number, number]> = {
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
    };
    const step = steps[event.key];
    if (step) {
      event.preventDefault();
      nudge(step[0], step[1]);
      return;
    }
    if (event.key === 'Escape') setDragging(null);
    if (event.key === 'Enter') void savePosition();
  }

  async function savePosition() {
    if (!dragging) return;
    const value = formatPosition(dragging);
    setSavingPosition(true);
    try {
      await api.patch('/me/profile-images', { bannerPosition: value });
      setEditedPosition(value);
      setDragging(null);
      await refreshUser();
      router.refresh();
      toast.success('Banner position saved.');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the banner position'));
    } finally {
      setSavingPosition(false);
    }
  }

  async function onFile(slot: Slot, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) {
      toast.error('Use a JPEG, PNG, WebP or AVIF picture.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`${file.name} is ${fileSize(file.size)}. Pictures must be ${fileSize(MAX_UPLOAD_BYTES)} or smaller.`);
      return;
    }

    setBusy(slot);
    try {
      const media = await uploadPhoto(file, { type: 'PROFILE', id: hasherId });
      if (!media.url) throw new Error('Storage did not return an address for that picture');
      await save(slot, media.id, media.url);
      toast.success(`Your ${NOUN[slot]} is updated.`);
    } catch (err) {
      toast.error(errorMessage(err, `Could not update your ${NOUN[slot]}`));
    } finally {
      setBusy(null);
    }
  }

  const picker = (slot: Slot) => (
    <input
      ref={inputs[slot]}
      type="file"
      accept={ACCEPT}
      onChange={(event) => void onFile(slot, event)}
      className="sr-only"
      // The visible button opens this; announcing it twice only adds noise.
      tabIndex={-1}
      aria-hidden
      data-testid={`profile-${slot}-input`}
    />
  );

  const remove = (slot: Slot) => (
    <ActionDialog
      trigger={
        <Button
          type="button"
          variant="secondary"
          size={slot === 'avatar' ? 'icon' : 'sm'}
          className={slot === 'avatar' ? 'h-8 w-8 rounded-full shadow-md' : 'shadow-md'}
          data-testid={`profile-${slot}-remove`}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          {slot === 'banner' ? (
            <span className="sr-only sm:not-sr-only">Remove banner</span>
          ) : (
            <span className="sr-only">Remove picture</span>
          )}
        </Button>
      }
      title={`Remove your ${NOUN[slot]}?`}
      description="Your page goes back to the default. You can upload another whenever you like."
      confirmLabel={`Remove ${NOUN[slot]}`}
      destructive
      onConfirm={async () => {
        try {
          await save(slot, null, null);
          toast.success(`Your ${NOUN[slot]} is removed.`);
        } catch (err) {
          toast.error(errorMessage(err, `Could not remove your ${NOUN[slot]}`));
          throw err;
        }
      }}
    />
  );

  return (
    <div>
      <div className="relative">
        <div
          ref={bannerRef}
          aria-hidden={!pictures.banner && !repositioning}
          role={repositioning ? 'application' : pictures.banner ? 'img' : undefined}
          aria-label={
            repositioning
              ? 'Drag to choose what the banner shows, or use the arrow keys'
              : pictures.banner
                ? `${name} banner`
                : undefined
          }
          tabIndex={repositioning ? 0 : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className={cn(
            'bg-cover',
            bannerClassName,
            repositioning && 'cursor-grab touch-none ring-2 ring-inset ring-primary active:cursor-grabbing',
          )}
          style={
            pictures.banner
              ? {
                  backgroundImage: `url(${JSON.stringify(pictures.banner)})`,
                  backgroundPosition: formatPosition(shown),
                }
              : { background: coverBackground(color) }
          }
          data-testid="profile-banner"
          data-banner-position={formatPosition(shown)}
        />
        {canManage && (
          /* On a phone the avatar overlaps the bottom of the banner and would
             cover a control sitting there, so they move to the top instead. */
          <div className="absolute right-3 top-3 flex gap-2 sm:bottom-4 sm:right-4 sm:top-auto">
            {repositioning ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shadow-md"
                  onClick={() => setDragging(null)}
                  disabled={savingPosition}
                  data-testid="profile-banner-reposition-cancel"
                >
                  <X className="h-4 w-4" aria-hidden />
                  <span className="sr-only sm:not-sr-only">Cancel</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="shadow-md"
                  onClick={() => void savePosition()}
                  disabled={savingPosition}
                  data-testid="profile-banner-reposition-save"
                >
                  {savingPosition ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  <span className="sr-only sm:not-sr-only">Save position</span>
                </Button>
              </>
            ) : (
              <>
                {picker('banner')}
                {pictures.banner && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shadow-md"
                    disabled={busy !== null}
                    onClick={() => {
                      setDragging(savedPosition);
                      // Focus follows the handle so the arrow keys work without a click.
                      requestAnimationFrame(() => bannerRef.current?.focus());
                    }}
                    data-testid="profile-banner-reposition"
                  >
                    <Move className="h-4 w-4" aria-hidden />
                    <span className="sr-only sm:not-sr-only">Reposition</span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shadow-md"
                  disabled={busy !== null}
                  onClick={() => inputs.banner.current?.click()}
                  data-testid="profile-banner-edit"
                >
                  {busy === 'banner' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Camera className="h-4 w-4" aria-hidden />
                  )}
                  {/* On a phone the avatar sits over the middle of the banner, so the
                      controls beside it shrink to their icons rather than being clipped.
                      The label is still there for a screen reader. */}
                  <span className="sr-only sm:not-sr-only">{pictures.banner ? 'Change banner' : 'Add a banner'}</span>
                </Button>
                {pictures.banner && remove('banner')}
              </>
            )}
          </div>
        )}
        {repositioning && (
          <p
            /* Below the controls on a phone, where neither they nor the avatar
               overlapping the bottom edge can clip it. */
            className="pointer-events-none absolute inset-x-3 top-16 mx-auto w-fit max-w-full rounded-2xl bg-background/90 px-3 py-1.5 text-center text-sm font-medium shadow-md sm:inset-x-0 sm:top-4 sm:rounded-full"
            data-testid="profile-banner-reposition-hint"
          >
            Drag the banner to choose what shows. Arrow keys nudge it.
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 px-4 pb-4 sm:flex-row sm:items-end sm:gap-5 lg:px-8">
        <div className="relative -mt-16 sm:-mt-12">
          <Avatar name={name} size="xl" color={brandColor(color)} src={pictures.avatar} />
          {canManage && (
            <>
              {picker('avatar')}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute bottom-1 right-1 h-9 w-9 rounded-full shadow-md"
                disabled={busy !== null}
                onClick={() => inputs.avatar.current?.click()}
                title={pictures.avatar ? 'Change picture' : 'Add a picture'}
                data-testid="profile-avatar-edit"
              >
                {busy === 'avatar' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Camera className="h-4 w-4" aria-hidden />
                )}
                <span className="sr-only">{pictures.avatar ? 'Change picture' : 'Add a picture'}</span>
              </Button>
              {pictures.avatar && <div className="absolute bottom-1 left-1">{remove('avatar')}</div>}
            </>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
