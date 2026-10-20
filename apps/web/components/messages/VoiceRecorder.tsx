'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Send, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { clockTime, MAX_VOICE_SECONDS } from '@/lib/messages';

// Record a voice note (D73): press to start, press to stop, listen back, send or
// bin it. Nothing is uploaded until you press send, and the microphone is released
// the moment recording stops. Capped at five minutes, as the server is.

// The first one the browser can make. MP4/AAC leads because it plays everywhere,
// the phone app included; MediaRecorder's WebM has no length or seek table and
// Android's player can cut it short. Firefox has no MP4 and falls back to WebM.
const TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

function pickType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export function voiceSupported() {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && pickType() !== null;
}

type Phase = 'recording' | 'review';

export function VoiceRecorder({
  onSend,
  onCancel,
  busy,
}: {
  onSend: (blob: Blob, durationSec: number) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [phase, setPhase] = useState<Phase>('recording');
  const [seconds, setSeconds] = useState(0);
  const [take, setTake] = useState<{ blob: Blob; url: string; durationSec: number } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelled = useRef(false);

  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const stop = useCallback(() => {
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  }, []);

  useEffect(() => {
    cancelled.current = false;
    let alive = true;
    (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!alive) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        const type = pickType();
        const rec = new MediaRecorder(media, type ? { mimeType: type } : undefined);
        recorder.current = rec;
        chunks.current = [];
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.current.push(e.data);
        };
        rec.onstop = () => {
          const durationSec = (Date.now() - startedAt.current) / 1000;
          release();
          if (cancelled.current) return;
          const blob = new Blob(chunks.current, { type: rec.mimeType || type || 'audio/webm' });
          if (blob.size === 0 || durationSec < 0.7) {
            toast.error('That was too short. Hold on a little longer.');
            onCancel();
            return;
          }
          setTake({ blob, url: URL.createObjectURL(blob), durationSec });
          setPhase('review');
        };
        startedAt.current = Date.now();
        rec.start(250);
        timer.current = setInterval(() => {
          const elapsed = (Date.now() - startedAt.current) / 1000;
          setSeconds(elapsed);
          if (elapsed >= MAX_VOICE_SECONDS) stop();
        }, 200);
      } catch {
        toast.error('Allow the microphone to record a voice message.');
        onCancel();
      }
    })();
    return () => {
      alive = false;
      cancelled.current = true;
      stop();
      release();
    };
    // Starts once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const url = take?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [take]);

  if (phase === 'review' && take) {
    return (
      <div className="flex items-center gap-2 border-t border-border pt-3" data-testid="voice-review">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} aria-label="Discard recording" data-testid="voice-discard">
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
        <audio src={take.url} controls className="h-10 min-w-0 flex-1" />
        <span className="text-xs tabular-nums text-muted-foreground">{clockTime(take.durationSec)}</span>
        <Button type="button" onClick={() => onSend(take.blob, take.durationSec)} disabled={busy} aria-label="Send voice message" data-testid="voice-send">
          <Send className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-t border-border pt-3" data-testid="voice-recording">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} aria-label="Cancel recording" data-testid="voice-cancel">
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
      <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" aria-hidden />
        <Mic className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="tabular-nums" aria-live="off">
          {clockTime(seconds)}
        </span>
        <span className="text-xs text-muted-foreground">Recording</span>
      </span>
      <Button type="button" onClick={stop} aria-label="Stop recording" data-testid="voice-stop">
        <Square className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
