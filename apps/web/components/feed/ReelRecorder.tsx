'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, RefreshCw, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_UPLOAD_BYTES, fileSize } from '@/lib/media';

// Recording a reel on the device (D47). A reel is a thing that happens — at the
// Circle, at a beer check, holding a mug at home — so the camera belongs next
// to the file picker rather than behind it.
//
// Everything here is the browser's own MediaRecorder. Nothing is uploaded until
// the hasher keeps the take: the recording lives in memory, and the composer
// receives an ordinary File, indistinguishable from a picked one.

// Long enough for a beer face, short enough to stay under the upload cap.
const MAX_SECONDS = 30;

// MediaRecorder hands back "video/webm;codecs=vp9,opus"; the API takes the type
// without its codecs, so the container is what we keep.
function containerOf(mimeType: string) {
  const base = mimeType.split(';')[0].trim();
  return base === 'video/x-matroska' ? 'video/webm' : base;
}

// Safari records mp4, everyone else webm. Asking in this order means each
// browser gets the container it is happiest muxing.
function pickMimeType() {
  const candidates = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  if (typeof MediaRecorder === 'undefined') return null;
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export function ReelRecorder({
  onRecorded,
  onCancel,
}: {
  onRecorded: (file: File) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // One place closes the camera, because leaving it open leaves the light on.
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function open() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot reach a camera. Choose a video file instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // Portrait-ish, because a reel is watched on a phone.
          video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setError(null);
      } catch (err) {
        const name = (err as DOMException)?.name;
        setError(
          name === 'NotAllowedError'
            ? 'The camera was not allowed. Allow it in your browser, or choose a video file instead.'
            : name === 'NotFoundError'
              ? 'No camera found on this device. Choose a video file instead.'
              : 'Could not open the camera. Choose a video file instead.',
        );
      }
    }

    void open();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facing, stopStream]);

  // The clock, and the cap that stops a reel becoming a documentary.
  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS) recorderRef.current?.stop();
    }, 250);
    return () => clearInterval(tick);
  }, [recording]);

  function start() {
    const stream = streamRef.current;
    const mimeType = pickMimeType();
    if (!stream || !mimeType) {
      setError('This browser cannot record video. Choose a video file instead.');
      return;
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const container = containerOf(mimeType);
      const blob = new Blob(chunksRef.current, { type: container });
      chunksRef.current = [];
      setRecording(false);

      if (blob.size === 0) {
        setError('That take came out empty. Try again.');
        return;
      }
      if (blob.size > MAX_UPLOAD_BYTES) {
        setError(`That take is ${fileSize(blob.size)}, over the 25MB limit. Try a shorter one.`);
        return;
      }

      const extension = container === 'video/mp4' ? 'mp4' : 'webm';
      // A File, not a Blob: from here on it travels the same road as a video
      // picked from the device.
      onRecorded(new File([blob], `reel-${Date.now()}.${extension}`, { type: container }));
    };

    recorder.start();
    recorderRef.current = recorder;
    setSeconds(0);
    setRecording(true);
  }

  const left = MAX_SECONDS - seconds;

  return (
    <div className="space-y-3" data-testid="reel-recorder">
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          // The front camera is a mirror to the person using it; the back one
          // is not, and flipping it would be a lie about which way is which.
          className="max-h-72 w-full object-contain"
          style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined}
        />
        {recording && (
          <span
            className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white"
            data-testid="reel-recording"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" aria-hidden />
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
            <span className="font-normal text-white/70">· {left}s left</span>
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <Button type="button" variant="destructive" onClick={() => recorderRef.current?.stop()} data-testid="reel-stop">
            <Square className="h-4 w-4" aria-hidden />
            Stop
          </Button>
        ) : (
          <Button type="button" onClick={start} disabled={Boolean(error)} data-testid="reel-record">
            <Circle className="h-4 w-4 fill-current" aria-hidden />
            Record
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => setFacing((current) => (current === 'user' ? 'environment' : 'user'))}
          disabled={recording || Boolean(error)}
          title="Switch camera"
          data-testid="reel-flip"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Flip
        </Button>
        <Button type="button" variant="ghost" className="ml-auto" onClick={onCancel} disabled={recording}>
          <X className="h-4 w-4" aria-hidden />
          Cancel
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Up to {MAX_SECONDS} seconds. Nothing leaves this device until you post it.
      </p>
    </div>
  );
}
