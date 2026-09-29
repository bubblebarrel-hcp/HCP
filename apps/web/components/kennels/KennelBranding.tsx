'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Check, Loader2, Move, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { Button } from '@/components/ui/button';
import { ACCEPTED_IMAGES, MAX_UPLOAD_BYTES, fileSize, uploadPhoto } from '@/lib/media';
import type { ViewerMembership } from '@/lib/types';
import { brandColor, cn, coverBackground } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// The top of a kennel page: banner, logo and, for its own admins, the controls
// that change them (D37). The pictures are rendered server-side like the rest of
// the page, so a visitor with no JavaScript still sees them; only the editing
// affordances need the browser.
//
// Both pictures are ordinary media assets linked to the kennel, then written to
// the kennel's `bannerUrl` / `logoUrl` through the same `kennel.manage` settings
// route the settings screen uses.

type Slot = 'banner' | 'logo';

const FIELD: Record<Slot, 'bannerUrl' | 'logoUrl'> = { banner: 'bannerUrl', logo: 'logoUrl' };
const LABEL: Record<Slot, string> = { banner: 'Banner', logo: 'Logo' };

// The banner is cropped to a wide strip, so a picture that is not already that
// shape has more of itself than fits. Where that crop sits is `bannerPosition`,
// a CSS background-position pair the admin drags into place; null is centred.
const CENTRED = { x: 50, y: 50 };
const KEY_STEP = 2;

function parsePosition(value: string | null) {
  const match = /^(\d{1,3}(?:\.\d+)?)% (\d{1,3}(?:\.\d+)?)%$/.exec(value ?? '');
  if (!match) return CENTRED;
  return { x: clamp(Number(match[1])), y: clamp(Number(match[2])) };
}

function clamp(n: number) {
  return Math.min(100, Math.max(0, n));
}

function formatPosition(point: { x: number; y: number }) {
  return `${Math.round(point.x)}% ${Math.round(point.y)}%`;
}

export function KennelBranding({
  kennelId,
  slug,
  shortName,
  primaryColor,
  logoUrl,
  bannerUrl,
  bannerPosition,
  children,
}: {
  kennelId: string;
  slug: string;
  shortName: string;
  primaryColor: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: string | null;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [permitted, setPermitted] = useState(false);
  // What this editor has changed since the server rendered the page, so a new
  // picture stays on screen without waiting for the public page to regenerate.
  // Absent means "whatever the server said", which is why it is not seeded from
  // the props: seeding would go stale the moment they changed.
  const [edited, setEdited] = useState<Partial<Record<Slot, string | null>>>({});
  const [editedPosition, setEditedPosition] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState<Slot | null>(null);
  // Non-null while the banner is being dragged into place: the point being
  // worked on, kept apart from the saved one so Cancel is a real cancel.
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);
  const [savingPosition, setSavingPosition] = useState(false);
  const inputs = { banner: useRef<HTMLInputElement>(null), logo: useRef<HTMLInputElement>(null) };
  const bannerRef = useRef<HTMLDivElement>(null);
  const grab = useRef<{ pointerId: number; startX: number; startY: number; from: { x: number; y: number } } | null>(
    null,
  );

  // Signing out takes the controls away without waiting for another answer.
  const canManage = Boolean(user) && permitted;
  const pictures = {
    banner: edited.banner !== undefined ? edited.banner : bannerUrl,
    logo: edited.logo !== undefined ? edited.logo : logoUrl,
  };
  const savedPosition = parsePosition(editedPosition !== undefined ? editedPosition : bannerPosition);
  // What is on screen: the drag in progress, or what is saved.
  const shown = dragging ?? savedPosition;
  const repositioning = dragging !== null;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ data: ViewerMembership }>(`/kennels/${encodeURIComponent(slug)}/membership`)
      .then((res) => {
        if (!cancelled) setPermitted(res.data.data.permissions.includes('kennel.manage'));
      })
      // No answer means no controls: the API decides, this only reflects it.
      .catch(() => {
        if (!cancelled) setPermitted(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, slug]);

  async function save(slot: Slot, url: string | null) {
    // A different picture is cropped differently, so a new banner starts centred
    // rather than inheriting a position chosen for the one before it.
    const position = slot === 'banner' ? { bannerPosition: null } : {};
    await api.patch(`/kennels/${encodeURIComponent(slug)}/settings`, { [FIELD[slot]]: url, ...position });
    setEdited((current) => ({ ...current, [slot]: url }));
    if (slot === 'banner') setEditedPosition(null);
    // The kennel page is a Server Component; the API evicts it too (D35), but
    // this is what makes the editor's own view agree straight away.
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
      await api.patch(`/kennels/${encodeURIComponent(slug)}/settings`, { bannerPosition: value });
      setEditedPosition(value);
      setDragging(null);
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
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`${file.name} is ${fileSize(file.size)}. Pictures must be 25MB or smaller.`);
      return;
    }

    setBusy(slot);
    try {
      const media = await uploadPhoto(file, { type: 'KENNEL', id: kennelId }, `${shortName} ${slot}`);
      if (!media.url) throw new Error('Storage did not return an address for that picture');
      await save(slot, media.url);
      toast.success(`${LABEL[slot]} updated.`);
    } catch (err) {
      toast.error(errorMessage(err, `Could not update the ${slot}`));
    } finally {
      setBusy(null);
    }
  }

  const picker = (slot: Slot) => (
    <input
      ref={inputs[slot]}
      type="file"
      accept={ACCEPTED_IMAGES}
      onChange={(event) => void onFile(slot, event)}
      className="sr-only"
      // The visible button opens this; announcing it twice only adds noise.
      tabIndex={-1}
      aria-hidden
      data-testid={`kennel-${slot}-input`}
    />
  );

  const remove = (slot: Slot) => (
    <ActionDialog
      trigger={
        <Button
          type="button"
          variant="secondary"
          size={slot === 'logo' ? 'icon' : 'sm'}
          className={slot === 'logo' ? 'h-8 w-8 rounded-full shadow-md' : 'shadow-md'}
          data-testid={`kennel-${slot}-remove`}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          {slot === 'banner' ? (
            <span className="sr-only sm:not-sr-only">Remove banner</span>
          ) : (
            <span className="sr-only">Remove logo</span>
          )}
        </Button>
      }
      title={`Remove the ${slot}?`}
      description={`${shortName} goes back to its brand colour. You can upload another whenever you like.`}
      confirmLabel={`Remove ${slot}`}
      destructive
      onConfirm={async () => {
        try {
          await save(slot, null);
          toast.success(`${LABEL[slot]} removed.`);
        } catch (err) {
          toast.error(errorMessage(err, `Could not remove the ${slot}`));
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
                ? `${shortName} banner`
                : undefined
          }
          tabIndex={repositioning ? 0 : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className={cn(
            'h-48 bg-cover sm:h-80',
            repositioning && 'cursor-grab touch-none ring-2 ring-inset ring-primary active:cursor-grabbing',
          )}
          style={
            pictures.banner
              ? {
                  backgroundImage: `url(${JSON.stringify(pictures.banner)})`,
                  backgroundPosition: formatPosition(shown),
                }
              : { background: coverBackground(primaryColor) }
          }
          data-testid="kennel-banner"
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
                  data-testid="kennel-banner-reposition-cancel"
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
                  data-testid="kennel-banner-reposition-save"
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
                    data-testid="kennel-banner-reposition"
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
                  data-testid="kennel-banner-edit"
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
            data-testid="kennel-banner-reposition-hint"
          >
            Drag the banner to choose what shows. Arrow keys nudge it.
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 px-4 pb-4 sm:flex-row sm:items-end sm:gap-5 lg:px-8">
        <div className="relative -mt-16 sm:-mt-12">
          <Avatar name={shortName} size="xl" color={brandColor(primaryColor)} src={pictures.logo} />
          {canManage && (
            <>
              {picker('logo')}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute bottom-1 right-1 h-9 w-9 rounded-full shadow-md"
                disabled={busy !== null}
                onClick={() => inputs.logo.current?.click()}
                title={pictures.logo ? 'Change logo' : 'Add a logo'}
                data-testid="kennel-logo-edit"
              >
                {busy === 'logo' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Camera className="h-4 w-4" aria-hidden />
                )}
                <span className="sr-only">{pictures.logo ? 'Change logo' : 'Add a logo'}</span>
              </Button>
              {pictures.logo && <div className="absolute bottom-1 left-1">{remove('logo')}</div>}
            </>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
