'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { createSticker, type Sticker } from '@/lib/messages';
import { errorMessage } from '@/services/api';

// Make a sticker from a picture (D73): crop it square, add a few words if you like,
// and it lands in your tray as a 512 px WebP with rounded corners and a see-through
// background, the way WhatsApp's do. The picture never leaves the browser until you
// press Make sticker, and what is uploaded is the finished sticker, not the original.

const SIZE = 512;
const SHOWN = 288;
const LIMIT = 500 * 1024;

export function StickerMaker({ trigger, onCreated }: { trigger: React.ReactNode; onCreated: (sticker: Sticker) => void }) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [text, setText] = useState('');
  const [light, setLight] = useState(true);
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const reset = () => {
    setImage((previous) => {
      previous?.close();
      return null;
    });
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setText('');
  };

  // Where the picture sits: it always covers the square, and the pan is kept
  // inside what is left over so there is never an empty edge.
  const place = useCallback(
    (bitmap: ImageBitmap, z: number, p: { x: number; y: number }) => {
      const scale = Math.max(SIZE / bitmap.width, SIZE / bitmap.height) * z;
      const w = bitmap.width * scale;
      const h = bitmap.height * scale;
      const maxX = (w - SIZE) / 2;
      const maxY = (h - SIZE) / 2;
      const x = Math.min(maxX, Math.max(-maxX, p.x));
      const y = Math.min(maxY, Math.max(-maxY, p.y));
      return { w, h, x: (SIZE - w) / 2 + x, y: (SIZE - h) / 2 + y, clampedX: x, clampedY: y };
    },
    [],
  );

  const draw = useCallback(
    (target: HTMLCanvasElement) => {
      const ctx = target.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, SIZE, SIZE);
      if (!image) return;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(0, 0, SIZE, SIZE, 72);
      ctx.clip();
      const at = place(image, zoom, pan);
      ctx.drawImage(image, at.x, at.y, at.w, at.h);
      ctx.restore();
      const words = text.trim();
      if (words) {
        ctx.font = '800 64px system-ui, -apple-system, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 14;
        ctx.strokeStyle = light ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
        ctx.fillStyle = light ? '#ffffff' : '#111111';
        let size = 64;
        while (ctx.measureText(words).width > SIZE - 56 && size > 24) {
          size -= 4;
          ctx.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
        }
        ctx.strokeText(words, SIZE / 2, SIZE - 44, SIZE - 40);
        ctx.fillText(words, SIZE / 2, SIZE - 44, SIZE - 40);
      }
    },
    [image, zoom, pan, text, light, place],
  );

  useEffect(() => {
    if (canvas.current) draw(canvas.current);
  }, [draw, open]);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      reset();
      setImage(bitmap);
    } catch {
      toast.error('That picture could not be opened. Try a JPEG, PNG or WebP.');
    }
  }

  async function toBlob(): Promise<Blob | null> {
    const source = canvas.current;
    if (!source) return null;
    const encode = (type: string, quality?: number) => new Promise<Blob | null>((resolve) => source.toBlob(resolve, type, quality));
    for (const quality of [0.92, 0.8, 0.6]) {
      const webp = await encode('image/webp', quality);
      if (webp && webp.type === 'image/webp' && webp.size <= LIMIT) return webp;
    }
    const png = await encode('image/png');
    return png && png.size <= LIMIT ? png : null;
  }

  async function make() {
    if (!image || busy) return;
    setBusy(true);
    try {
      const blob = await toBlob();
      if (!blob) {
        toast.error('That sticker came out too big. Zoom in or use a simpler picture.');
        return;
      }
      const sticker = await createSticker(blob, { width: SIZE, height: SIZE });
      toast.success('Sticker made. It is in your tray.');
      onCreated(sticker);
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not make that sticker'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {open && (
        <DialogContent title="Make a sticker" description="Pick a picture, drag it into place, and add a few words if you like.">
          <div className="space-y-4" data-testid="sticker-maker">
            {!image ? (
              <label className="grid h-72 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border text-center text-sm text-muted-foreground hover:bg-muted/40">
                <span className="flex flex-col items-center gap-2">
                  <ImagePlus className="h-8 w-8" aria-hidden />
                  Choose a picture
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => void pick(e.target.files?.[0])}
                  data-testid="sticker-file"
                />
              </label>
            ) : (
              <>
                <div
                  className="mx-auto touch-none rounded-xl bg-[repeating-conic-gradient(#8881_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
                  style={{ width: SHOWN, height: SHOWN }}
                >
                  <canvas
                    ref={canvas}
                    width={SIZE}
                    height={SIZE}
                    style={{ width: SHOWN, height: SHOWN, cursor: 'grab' }}
                    aria-label="Sticker preview. Drag to move the picture."
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
                    }}
                    onPointerMove={(e) => {
                      if (!drag.current || !image) return;
                      const ratio = SIZE / SHOWN;
                      const next = {
                        x: drag.current.px + (e.clientX - drag.current.x) * ratio,
                        y: drag.current.py + (e.clientY - drag.current.y) * ratio,
                      };
                      const at = place(image, zoom, next);
                      setPan({ x: at.clampedX, y: at.clampedY });
                    }}
                    onPointerUp={() => {
                      drag.current = null;
                    }}
                    data-testid="sticker-canvas"
                  />
                </div>
                <label className="block text-sm">
                  <span className="text-muted-foreground">Zoom</span>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="mt-1 w-full accent-primary"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <input
                    value={text}
                    maxLength={40}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Words on the sticker (optional)"
                    aria-label="Words on the sticker"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => setLight((v) => !v)} aria-pressed={light}>
                    {light ? 'White' : 'Black'}
                  </Button>
                </div>
              </>
            )}
            <div className="flex justify-between gap-2">
              {image ? (
                <Button type="button" variant="ghost" onClick={reset}>
                  Pick another
                </Button>
              ) : (
                <span />
              )}
              <Button type="button" onClick={() => void make()} disabled={!image || busy} data-testid="sticker-make">
                {busy ? 'Making…' : 'Make sticker'}
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
