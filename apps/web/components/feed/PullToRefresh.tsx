'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClinkSpinner, type ClinkState } from '@/components/feed/ClinkSpinner';

// Drag the feed down and the mugs come together; let go past the line and they
// clink while it reloads (D46).
//
// Home is a Server Component behind ISR (D35, D42), so refreshing is
// `router.refresh()` — the server re-renders the feed and React swaps it in.
// The rail listens for the same event and re-asks for itself.

// How far the finger travels for a full pull, and how far past it counts.
const THRESHOLD = 76;
const MAX = 132;
// Past the top of the page, a drag is a scroll and none of our business.
const START_SLOP = 6;
// Dragging feels heavy at the end, like every native list.
const resist = (distance: number) => MAX * (1 - Math.exp(-distance / MAX));

export const FEED_REFRESH_EVENT = 'hcp:feed-refresh';

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [distance, setDistance] = useState(0);
  // The same number the handlers read: a state updater must not be where the
  // refresh is kicked off, because React is free to call one twice.
  const travelledRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  // Whether a finger is down, as state rather than a ref: the render reads it.
  const [dragging, setDragging] = useState(false);
  // Null when no drag is in flight; otherwise where the finger went down.
  const origin = useRef<number | null>(null);
  const pointer = useRef<number | null>(null);

  const show = useCallback((value: number) => {
    travelledRef.current = value;
    setDistance(value);
  }, []);

  const finish = useCallback(async () => {
    setRefreshing(true);
    // Everything that lives on the page and fetches for itself — the reels
    // rail — can listen for this rather than being wired through props.
    window.dispatchEvent(new CustomEvent(FEED_REFRESH_EVENT));
    router.refresh();
    // The router gives no completion signal, so the clink runs for a beat
    // rather than for an unknown length of time. Long enough to read as an
    // answer, short enough not to be in the way.
    await new Promise((resolve) => setTimeout(resolve, 900));
    setRefreshing(false);
    travelledRef.current = 0;
    setDistance(0);
  }, [router]);

  useEffect(() => {
    function down(event: PointerEvent) {
      // Only from the very top, only with the primary button, and never while
      // a refresh is already running.
      if (refreshing || window.scrollY > START_SLOP || event.button !== 0) return;
      origin.current = event.clientY;
      pointer.current = event.pointerId;
      setDragging(true);
    }

    function move(event: PointerEvent) {
      if (origin.current === null || event.pointerId !== pointer.current) return;
      const travelled = event.clientY - origin.current;
      if (travelled <= 0) {
        // Dragging back up hands the page its scroll back.
        show(0);
        if (travelled < -START_SLOP) {
          origin.current = null;
          setDragging(false);
        }
        return;
      }
      // A touch drag that is really a scroll should not be hijacked.
      if (window.scrollY > START_SLOP) {
        origin.current = null;
        setDragging(false);
        show(0);
        return;
      }
      show(resist(travelled));
      if (event.cancelable && travelled > START_SLOP) event.preventDefault();
    }

    function up() {
      if (origin.current === null) return;
      origin.current = null;
      pointer.current = null;
      setDragging(false);
      if (travelledRef.current >= THRESHOLD) {
        show(THRESHOLD);
        void finish();
      } else {
        show(0);
      }
    }

    // Passive false on move, or the browser scrolls the page out from under
    // the drag before preventDefault can say otherwise.
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [finish, refreshing, show]);

  const progress = Math.min(1, distance / THRESHOLD);
  const state: ClinkState = refreshing
    ? 'refreshing'
    : progress >= 1
      ? 'armed'
      : distance > 0
        ? 'pulling'
        : 'idle';

  return (
    <div className="relative" data-testid="pull-to-refresh">
      {/* The mugs live above the feed and are revealed by the drag rather than
          pushed down by it, so the feed itself never reflows. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center overflow-hidden"
        style={{ height: refreshing ? 72 : distance }}
        aria-hidden={state === 'idle'}
      >
        <div className="pt-2">
          <ClinkSpinner state={state} progress={progress} />
        </div>
      </div>

      <div
        style={{
          transform: `translateY(${refreshing ? 72 : distance}px)`,
          // No easing while a finger is down: the feed should track the drag.
          transition: dragging ? undefined : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
