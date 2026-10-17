'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, CheckCheck, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Copy, Flag, Forward, Pause, Pencil, Pin, PinOff, Play, Reply } from 'lucide-react';
import { toast } from 'sonner';
import { ReportDialog } from '@/components/social/ReportDialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FormattedText } from '@/lib/chat-format';
import { clockTime, copyableText, type DirectMessage, type MessageAttachment, type Receipt, type ReplyQuote } from '@/lib/messages';
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

// The quote above a reply. Tapping it takes you to the message it answers.
function Quote({ quote, mine, onJump }: { quote: ReplyQuote; mine: boolean; onJump: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onJump(quote.id)}
      className={cn(
        'mb-1.5 block w-full rounded-lg border-l-4 px-2 py-1 text-left text-xs',
        mine ? 'border-primary-foreground/60 bg-primary-foreground/15' : 'border-primary bg-background/60',
      )}
      data-testid="message-quote"
    >
      <span className="block font-semibold">{quote.mine ? 'You' : 'Them'}</span>
      <span className="line-clamp-2 break-words opacity-90">{quote.preview || 'Message'}</span>
    </button>
  );
}

// Everything you can do to one message, behind the chevron. A small popover of our
// own: it closes on a click elsewhere, on Escape, and when an item is chosen.
const MENU_WIDTH = 176;
const EDGE = 8;

function ActionMenu({ items }: { items: { key: string; label: string; icon: React.ReactNode; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Placed from the chevron, then kept inside the screen: a long bubble pushes the
  // chevron to an edge, and a menu anchored to a fixed side would run off the other.
  // It opens below the chevron, or above it when there is no room underneath.
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const place = () => {
      const r = trigger.current!.getBoundingClientRect();
      const height = menu.current?.offsetHeight ?? items.length * 40 + 8;
      const left = Math.min(Math.max(r.left + r.width / 2 - MENU_WIDTH / 2, EDGE), window.innerWidth - MENU_WIDTH - EDGE);
      const below = r.bottom + 4;
      const top = below + height > window.innerHeight - EDGE ? Math.max(EDGE, r.top - height - 4) : below;
      setAt({ left, top });
    };
    place();
    // Anything that moves the chevron closes the menu rather than leave it floating.
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    document.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    // Sits in the bubble's top corner, over a small pill so it stays readable on any
    // bubble, picture or sticker. It fades in when the bubble is hovered or focused;
    // a touch screen has no hover, so it stays faintly visible there.
    <div ref={box} className="absolute right-1 top-1 z-10 whitespace-normal font-normal not-italic">
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setAt(null);
          setOpen((o) => !o);
        }}
        aria-label="Message actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'grid h-6 w-6 place-items-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur-sm hover:bg-background focus-visible:opacity-100 group-hover/bubble:opacity-100',
          open ? 'opacity-100' : 'opacity-0 pointer-coarse:opacity-60',
        )}
        data-testid="message-menu"
      >
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          style={{ position: 'fixed', width: MENU_WIDTH, left: at?.left ?? 0, top: at?.top ?? 0, visibility: at ? 'visible' : 'hidden' }}
          className="z-50 rounded-lg border border-border bg-card p-1 text-sm text-card-foreground shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-muted"
              data-testid={`message-${item.key}`}
            >
              <span className="text-muted-foreground">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SWIPE_TO_REPLY = 56;

export function MessageBubble({
  message: m,
  now,
  onEdit,
  onReply,
  onForward,
  onPin,
  onSelect,
  onJump,
  canReply,
  canPin,
  selecting,
  selected,
  onToggle,
  flash,
}: {
  message: DirectMessage;
  // The clock, ticking once a second while an edit window is open.
  now: number;
  onEdit: (message: DirectMessage) => void;
  onReply: (message: DirectMessage) => void;
  onForward: (message: DirectMessage) => void;
  onPin: (message: DirectMessage) => void;
  // Starts selecting with this message ticked.
  onSelect: (message: DirectMessage) => void;
  onJump: (id: string) => void;
  canReply: boolean;
  canPin: boolean;
  selecting: boolean;
  selected: boolean;
  onToggle: (message: DirectMessage) => void;
  flash: boolean;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  const [reporting, setReporting] = useState(false);
  const [dx, setDx] = useState(0);
  const swipe = useRef<{ x: number; y: number; active: boolean } | null>(null);
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

  const text = copyableText(m);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy that');
    }
  }

  // Everything but a removed message can be passed on or picked; the rest need a live conversation.
  const items = [
    ...(live && canReply ? [{ key: 'reply', label: 'Reply', icon: <Reply className="h-4 w-4" aria-hidden />, onClick: () => onReply(m) }] : []),
    ...(text ? [{ key: 'copy', label: 'Copy', icon: <Copy className="h-4 w-4" aria-hidden />, onClick: () => void copy() }] : []),
    ...(live ? [{ key: 'forward', label: 'Forward', icon: <Forward className="h-4 w-4" aria-hidden />, onClick: () => onForward(m) }] : []),
    ...(live && canPin
      ? [
          {
            key: 'pin',
            label: m.pinnedAt ? 'Unpin' : 'Pin',
            icon: m.pinnedAt ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />,
            onClick: () => onPin(m),
          },
        ]
      : []),
    { key: 'select', label: 'Select', icon: <CheckSquare className="h-4 w-4" aria-hidden />, onClick: () => onSelect(m) },
    ...(live && !m.mine ? [{ key: 'report', label: 'Report', icon: <Flag className="h-4 w-4" aria-hidden />, onClick: () => setReporting(true) }] : []),
  ];

  // Swipe to reply, on a touch screen: drag the message to the right and let go.
  // Vertical drags stay scrolling (touch-action: pan-y); a mouse uses the menu.
  const swipeable = live && canReply && !selecting;
  function down(e: React.PointerEvent) {
    if (!swipeable || e.pointerType !== 'touch') return;
    swipe.current = { x: e.clientX, y: e.clientY, active: false };
  }
  function move(e: React.PointerEvent) {
    const s = swipe.current;
    if (!s) return;
    const moveX = e.clientX - s.x;
    const moveY = e.clientY - s.y;
    if (!s.active) {
      if (Math.abs(moveY) > 12) swipe.current = null;
      else if (moveX > 12 && moveX > Math.abs(moveY) * 1.5) s.active = true;
      return;
    }
    setDx(Math.max(0, Math.min(moveX, 84)));
  }
  function up() {
    const s = swipe.current;
    swipe.current = null;
    if (s?.active && dx >= SWIPE_TO_REPLY) {
      navigator.vibrate?.(10);
      onReply(m);
    }
    setDx(0);
  }

  return (
    <div
      className={cn('group/row flex items-start gap-2 rounded-lg transition-colors', flash && 'bg-primary/15', selected && 'bg-primary/10')}
      onClick={selecting ? () => onToggle(m) : undefined}
      data-testid="message"
      data-kind={m.kind}
      data-message-id={m.id}
      data-selected={selected || undefined}
    >
      {selecting && (
        <span className="mt-2 grid h-5 w-5 shrink-0 place-items-center">
          <input type="checkbox" checked={selected} onChange={() => onToggle(m)} aria-label="Select message" className="h-4 w-4" data-testid="message-checkbox" />
        </span>
      )}
      <div
        className={cn('relative flex min-w-0 flex-1 flex-col touch-pan-y', m.mine ? 'items-end' : 'items-start')}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? undefined : 'transform 160ms ease-out' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {dx > 0 && (
          <span
            className="absolute -left-9 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-muted text-muted-foreground"
            style={{ opacity: Math.min(1, dx / SWIPE_TO_REPLY) }}
            aria-hidden
          >
            <Reply className="h-4 w-4" />
          </span>
        )}
        <div className="flex max-w-[85%]">
          <div
            className={cn(
              'group/bubble relative min-w-0 break-words text-sm',
              !live
                ? 'rounded-2xl border border-dashed border-border px-3 py-2 italic text-muted-foreground'
                : bare
                  ? ''
                  : cn(
                      'whitespace-pre-wrap rounded-2xl py-2 pl-3',
                      // Room for the chevron beside the words, so it never covers them.
                      m.kind === 'TEXT' && !selecting ? 'pr-8' : 'pr-3',
                      m.mine ? 'bg-primary text-primary-foreground' : 'bg-muted',
                    ),
            )}
            data-testid="message-bubble"
          >
            {live && m.forwarded && (
              <span className="mb-1 flex items-center gap-1 text-xs italic opacity-80" data-testid="message-forwarded">
                <Forward className="h-3 w-3" aria-hidden /> Forwarded
              </span>
            )}
            {live && m.replyTo && <Quote quote={m.replyTo} mine={m.mine} onJump={onJump} />}
            {content}
            {!selecting && <ActionMenu items={items} />}
          </div>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <time dateTime={m.createdAt}>{clock(m.createdAt)}</time>
          {live && m.pinnedAt && (
            <span className="inline-flex items-center gap-0.5" data-testid="message-pinned">
              <Pin className="h-3 w-3" aria-hidden /> Pinned
            </span>
          )}
          {live && m.editedAt && <span data-testid="message-edited">Edited</span>}
          {canEdit && !selecting && (
            <button type="button" onClick={() => onEdit(m)} className="inline-flex items-center gap-1 hover:text-foreground" data-testid="message-edit">
              <Pencil className="h-3 w-3" aria-hidden /> Edit
            </button>
          )}
          {live && m.mine && m.receipt && <ReceiptTicks receipt={m.receipt} />}
        </div>
      </div>
      {live && !m.mine && <ReportDialog targetType="DIRECT_MESSAGE" targetId={m.id} open={reporting} onOpenChange={setReporting} />}
      <Viewer files={media} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
    </div>
  );
}
