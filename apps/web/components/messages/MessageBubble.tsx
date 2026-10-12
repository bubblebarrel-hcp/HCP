'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, ChevronLeft, ChevronRight, Flag, Pause, Pencil, Play } from 'lucide-react';
import { ReportDialog } from '@/components/social/ReportDialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FormattedText } from '@/lib/chat-format';
import { clockTime, type DirectMessage, type MessageAttachment, type Receipt } from '@/lib/messages';
import { cn } from '@/lib/utils';

// One message in the thread (D71, D73): words with their marks, pictures and clips
// in a grid, a sticker on its own, or a voice note with a player. Mine sit on the
// right in the brand colour and carry their ticks; theirs sit on the left.

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function ReceiptTicks({ receipt }: { receipt: Receipt }) {
  if (receipt === 'SENT') {
    return <Check className="h-3.5 w-3.5" aria-label="Sent" data-testid="receipt-sent" />;
  }
  return (
    <CheckCheck
      className={cn('h-3.5 w-3.5', receipt === 'SEEN' && 'text-primary-strong')}
      aria-label={receipt === 'SEEN' ? 'Seen' : 'Delivered'}
      data-testid={receipt === 'SEEN' ? 'receipt-seen' : 'receipt-delivered'}
    />
  );
}

function VoicePlayer({ file }: { file: MessageAttachment }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  // MediaRecorder's WebM has no length of its own; the one the sender measured wins.
  const total = file.durationSec ?? 0;

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const tick = () => setAt(el.currentTime);
    const end = () => {
      setPlaying(false);
      setAt(0);
    };
    el.addEventListener('timeupdate', tick);
    el.addEventListener('ended', end);
    el.addEventListener('pause', () => setPlaying(false));
    el.addEventListener('play', () => setPlaying(true));
    return () => {
      el.removeEventListener('timeupdate', tick);
      el.removeEventListener('ended', end);
    };
  }, []);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  }

  return (
    <div className="flex w-56 items-center gap-3" data-testid="voice-message">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground/10 hover:bg-foreground/20"
      >
        {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={total || 1}
          step={0.1}
          value={Math.min(at, total || 1)}
          onChange={(e) => {
            const el = audio.current;
            if (el) el.currentTime = Number(e.target.value);
            setAt(Number(e.target.value));
          }}
          aria-label="Position in the voice message"
          className="h-1 w-full accent-current"
        />
        <div className="mt-0.5 text-xs tabular-nums opacity-80">{clockTime(playing || at > 0 ? at : total)}</div>
      </div>
      {file.url && <audio ref={audio} src={file.url} preload="metadata" className="hidden" />}
    </div>
  );
}

function Picture({ file, onOpen, fill }: { file: MessageAttachment; onOpen: () => void; fill?: boolean }) {
  if (!file.url) return <div className="aspect-square bg-muted" />;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('relative block overflow-hidden bg-black/10', fill ? 'aspect-square' : '')}
      aria-label={file.kind === 'VIDEO' ? 'Open video' : 'Open picture'}
      data-testid="message-media"
    >
      {file.kind === 'VIDEO' ? (
        <>
          <video src={file.url} preload="metadata" muted playsInline className={cn('block bg-black', fill ? 'h-full w-full object-cover' : 'max-h-72 w-full object-cover')} />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white">
              <Play className="h-5 w-5" aria-hidden />
            </span>
          </span>
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.url} alt="" loading="lazy" className={cn('block', fill ? 'h-full w-full object-cover' : 'max-h-72 w-full object-cover')} />
      )}
    </button>
  );
}

function Viewer({ files, index, onChange, onClose }: { files: MessageAttachment[]; index: number | null; onChange: (i: number) => void; onClose: () => void }) {
  const file = index === null ? null : files[index];
  return (
    <Dialog open={index !== null} onOpenChange={(open) => !open && onClose()}>
      {file && (
        <DialogContent title={file.kind === 'VIDEO' ? 'Video' : 'Picture'} className="max-w-3xl">
          <div className="relative flex items-center justify-center" data-testid="media-viewer">
            {files.length > 1 && index! > 0 && (
              <button type="button" onClick={() => onChange(index! - 1)} aria-label="Previous" className="absolute left-0 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white">
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
            )}
            {file.kind === 'VIDEO' ? (
              <video key={file.id} src={file.url ?? undefined} controls autoPlay playsInline className="max-h-[70vh] w-full rounded-lg bg-black" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={file.id} src={file.url ?? undefined} alt="" className="max-h-[70vh] max-w-full rounded-lg object-contain" />
            )}
            {files.length > 1 && index! < files.length - 1 && (
              <button type="button" onClick={() => onChange(index! + 1)} aria-label="Next" className="absolute right-0 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white">
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function MessageBubble({
  message: m,
  now,
  onEdit,
}: {
  message: DirectMessage;
  // The clock, ticking once a second while an edit window is open.
  now: number;
  onEdit: (message: DirectMessage) => void;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  const live = m.status === 'SENT';
  const canEdit = live && m.mine && m.editableUntil !== null && new Date(m.editableUntil).getTime() > now;
  const media = m.attachments.filter((a) => a.kind !== 'AUDIO');
  const voice = m.attachments.find((a) => a.kind === 'AUDIO');

  let content: React.ReactNode;
  let bare = false;
  if (!live) {
    content = m.status === 'DELETED' ? 'This message was deleted' : 'Removed by moderators';
  } else if (m.kind === 'STICKER' && m.sticker?.url) {
    bare = true;
    // eslint-disable-next-line @next/next/no-img-element
    content = <img src={m.sticker.url} alt="Sticker" className="h-36 w-36 object-contain" data-testid="message-sticker" />;
  } else if (m.kind === 'VOICE' && voice) {
    content = <VoicePlayer file={voice} />;
  } else if (m.kind === 'MEDIA') {
    const cols = media.length === 1 ? 'grid-cols-1' : 'grid-cols-2';
    content = (
      <div className="space-y-2">
        <div className={cn('-mx-3 -mt-2 grid gap-0.5 overflow-hidden rounded-t-2xl', cols, m.body ? '' : '-mb-2 rounded-b-2xl')} style={{ width: media.length === 1 ? 'min(18rem, 70vw)' : 'min(18rem, 70vw)' }}>
          {media.map((file, i) => (
            <Picture key={file.id} file={file} fill={media.length > 1} onOpen={() => setViewing(i)} />
          ))}
        </div>
        {m.body && <p className="whitespace-pre-wrap break-words pt-1">{<FormattedText text={m.body} />}</p>}
      </div>
    );
  } else {
    content = <FormattedText text={m.body ?? ''} />;
  }

  return (
    <div className={cn('flex flex-col', m.mine ? 'items-end' : 'items-start')} data-testid="message" data-kind={m.kind}>
      <div
        className={cn(
          'max-w-[85%] break-words text-sm',
          !live
            ? 'rounded-2xl border border-dashed border-border px-3 py-2 italic text-muted-foreground'
            : bare
              ? ''
              : cn('whitespace-pre-wrap rounded-2xl px-3 py-2', m.mine ? 'bg-primary text-primary-foreground' : 'bg-muted'),
        )}
        data-testid="message-bubble"
      >
        {content}
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
        <time dateTime={m.createdAt}>{clock(m.createdAt)}</time>
        {live && m.editedAt && <span data-testid="message-edited">Edited</span>}
        {canEdit && (
          <button type="button" onClick={() => onEdit(m)} className="inline-flex items-center gap-1 hover:text-foreground" data-testid="message-edit">
            <Pencil className="h-3 w-3" aria-hidden /> Edit
          </button>
        )}
        {live && m.mine && m.receipt && <ReceiptTicks receipt={m.receipt} />}
        {live && !m.mine && (
          <ReportDialog
            targetType="DIRECT_MESSAGE"
            targetId={m.id}
            trigger={
              <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" data-testid="message-report">
                <Flag className="h-3 w-3" aria-hidden /> Report
              </button>
            }
          />
        )}
      </div>
      <Viewer files={media} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
    </div>
  );
}
