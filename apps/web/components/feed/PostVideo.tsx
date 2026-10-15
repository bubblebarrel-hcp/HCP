'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Volume2, VolumeX } from 'lucide-react';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { useDevicePrefs } from '@/lib/device-prefs';
import { pickVideoSource } from '@/lib/video-quality';
import type { VideoRendition } from '@/lib/types';
import { cn } from '@/lib/utils';

// A clip on a post. Still a plain <video controls> — the server renders it, so it
// plays before any script runs — with a mute button laid over the corner so the
// sound is one tap away in a feed, and the device settings (autoplay, start
// muted, data saver) applied once the page is live.
export function PostVideo({
  src: url,
  renditions,
  poster,
  className,
  style,
  expandable = false,
  onExpand,
}: {
  src: string;
  renditions?: VideoRendition[];
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  // Adds an expand button that opens the clip full screen. `onExpand` lets a
  // carousel open its own viewer over all its items; without it the clip opens alone.
  expandable?: boolean;
  onExpand?: () => void;
}) {
  const [viewing, setViewing] = useState(false);
  const [prefs] = useDevicePrefs();
  const src = pickVideoSource(url, renditions, prefs.quality, prefs.dataSaver);
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  // Once the viewer touches the mute button their choice stands over the setting.
  const chosen = useRef(false);

  useEffect(() => {
    if (!chosen.current) setMuted(prefs.startMuted || prefs.autoplay);
  }, [prefs.startMuted, prefs.autoplay]);

  // Scrolling into view plays it, scrolling away pauses it. Muted, because a
  // browser refuses sound the viewer has not asked for.
  useEffect(() => {
    const el = ref.current;
    if (!el || !prefs.autoplay || prefs.dataSaver) return;
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) void el.play().catch(() => undefined);
        else el.pause();
      },
      { threshold: [0, 0.6] },
    );
    seen.observe(el);
    return () => seen.disconnect();
  }, [prefs.autoplay, prefs.dataSaver]);

  const expand = () => {
    // The inline player stops: two copies of one clip must not play over each other.
    ref.current?.pause();
    if (onExpand) onExpand();
    else setViewing(true);
  };

  const toggle = () => {
    chosen.current = true;
    setMuted((current) => !current);
  };

  return (
    <div className="relative grid h-full w-full place-items-center">
      <video
        ref={ref}
        src={src}
        poster={poster}
        controls
        playsInline
        loop={prefs.autoplay && !prefs.dataSaver}
        muted={muted}
        preload={prefs.dataSaver ? 'none' : 'metadata'}
        style={style}
        className={className}
        data-testid="post-video"
        onVolumeChange={(event) => {
          // The native control's own mute button and slider stay in step.
          const next = event.currentTarget.muted;
          if (next !== muted) {
            chosen.current = true;
            setMuted(next);
          }
        }}
      />
      {expandable && (
        <button
          type="button"
          onClick={expand}
          aria-label="Open video full screen"
          data-testid="post-video-expand"
          className={cn(
            'absolute left-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white',
            'hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
          )}
        >
          <Maximize2 className="h-4 w-4" aria-hidden />
        </button>
      )}
      {expandable && !onExpand && (
        <PhotoViewer photos={[{ url: src, kind: 'VIDEO', poster, label: 'Video' }]} open={viewing} onOpenChange={setViewing} />
      )}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={muted}
        aria-label={muted ? 'Unmute video' : 'Mute video'}
        data-testid="post-video-mute"
        className={cn(
          'absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white',
          'hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        )}
      >
        {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
