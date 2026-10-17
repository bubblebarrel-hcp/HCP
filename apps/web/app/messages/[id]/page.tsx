'use client';

import { use, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BellOff, Bell, Copy, Forward, Pin, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Composer } from '@/components/messages/Composer';
import { ForwardDialog } from '@/components/messages/ForwardDialog';
import { MessageBubble } from '@/components/messages/MessageBubble';
import { Button } from '@/components/ui/button';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { useAuth } from '@/context/AuthContext';
import {
  acceptRequest,
  announceMessagesChanged,
  archiveConversation,
  copyableText,
  declineRequest,
  getConversation,
  getMessages,
  markConversationRead,
  pinMessage,
  setConversationActive,
  setConversationMuted,
  type ConversationDetail,
  type DirectMessage,
  type Receipt,
} from '@/lib/messages';
import { isRealtimeConnected, useRealtimeEvent } from '@/lib/realtime';
import { errorMessage } from '@/services/api';

// One conversation (D71, D73). The socket delivers what happens in it (D72); this
// page re-reads the newest page every few seconds as the net, merging by id, which
// also picks up an edit, a removal and the ticks on what I sent.

const POLL_MS = 4_000;

const byTime = (a: DirectMessage, b: DirectMessage) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

function merge(current: DirectMessage[], incoming: DirectMessage[]) {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort(byTime);
}

// A receipt only ever moves forward: a late, stale answer cannot take a "seen" back.
const RANK: Record<Receipt, number> = { SENT: 0, DELIVERED: 1, SEEN: 2 };

function applyReceipt(messages: DirectMessage[], at: { deliveredAt: string | null; seenAt: string | null }) {
  return messages.map((m) => {
    if (!m.mine || !m.receipt || m.status !== 'SENT') return m;
    const next: Receipt =
      at.seenAt && m.createdAt <= at.seenAt ? 'SEEN' : at.deliveredAt && m.createdAt <= at.deliveredAt ? 'DELIVERED' : m.receipt;
    return RANK[next] > RANK[m.receipt] ? { ...m, receipt: next } : m;
  });
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [editing, setEditing] = useState<DirectMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);
  // Non-null while choosing messages to copy or forward.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [forwardIds, setForwardIds] = useState<string[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [pinAt, setPinAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const endRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastCount = useRef(0);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  const refresh = useCallback(async () => {
    try {
      const [d, page] = await Promise.all([getConversation(id), getMessages(id)]);
      setDetail(d);
      setMessages((current) => merge(current, page.items));
      setHasMore((was) => (lastCount.current === 0 ? page.hasMore : was));
      lastCount.current = 1;
      return page.items;
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) setMissing(true);
      return null;
    }
  }, [id]);

  const markRead = useCallback(() => {
    markConversationRead(id)
      .then(() => announceMessagesChanged())
      .catch(() => undefined);
  }, [id]);

  // Pushed by the socket (D72). A message for this conversation is merged and,
  // if it is theirs and the tab is in view, read. Anything else about it, or a
  // reconnect, re-reads the conversation.
  useRealtimeEvent(['dm:message'], (e: { conversationId: string; message: DirectMessage }) => {
    if (e.conversationId !== id) return;
    setMessages((current) => merge(current, [e.message]));
    if (!e.message.mine && document.visibilityState === 'visible') markRead();
  });
  useRealtimeEvent(['dm:message-updated'], (e: { conversationId: string; message: DirectMessage }) => {
    if (e.conversationId !== id) return;
    setMessages((current) => merge(current, [e.message]));
    // Someone removed the message I was editing.
    setEditing((open) => (open?.id === e.message.id && e.message.status !== 'SENT' ? null : open));
  });
  // The other person's device received, or read, what I sent (D73).
  useRealtimeEvent(['dm:receipt'], (e: { conversationId: string; deliveredAt: string | null; seenAt: string | null }) => {
    if (e.conversationId === id) setMessages((current) => applyReceipt(current, e));
  });
  useRealtimeEvent(['dm:conversation', 'dm:refresh', 'resync'], (e?: { conversationId?: string }) => {
    if (!e?.conversationId || e.conversationId === id) void refresh();
  });

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const tick = async () => {
      if (!alive || document.visibilityState !== 'visible') return;
      const items = await refresh();
      // Anything from them that I have now seen is read.
      if (alive && items?.some((m) => !m.mine)) markRead();
    };
    void tick();
    // The socket delivers; this is the net, quick only while it is down.
    let count = 0;
    const timer = setInterval(() => {
      if (!isRealtimeConnected() || ++count % 15 === 0) void tick();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user, id, refresh, markRead]);

  // While this page is in view the conversation is "open": its new messages count on
  // the Messages icon and stay out of the bell. A heartbeat, because the socket only
  // listens; it lapses on its own if the tab dies.
  useEffect(() => {
    if (!user) return;
    const say = (on: boolean) => void setConversationActive(id, on).catch(() => undefined);
    const beat = () => say(document.visibilityState === 'visible');
    beat();
    const timer = setInterval(beat, 15_000);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
      say(false);
    };
  }, [user, id]);

  // The edit window shuts by itself: a clock ticks only while a message of mine
  // can still be edited, so a quiet page does no work.
  const anyEditable = messages.some((m) => m.editableUntil && new Date(m.editableUntil).getTime() > now);
  useEffect(() => {
    if (!anyEditable) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [anyEditable]);
  // An edit that ran out while open stops being an edit.
  useEffect(() => {
    if (editing?.editableUntil && new Date(editing.editableUntil).getTime() <= now) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditing(null);
      toast.message('The two minutes for editing that message are up.');
    }
  }, [now, editing]);

  // Stay at the bottom as new words arrive, unless they scrolled up to read.
  useLayoutEffect(() => {
    if (stick.current) endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function older() {
    const oldest = messages[0];
    if (!oldest) return;
    try {
      const page = await getMessages(id, { before: oldest.id });
      stick.current = false;
      setMessages((current) => merge(current, page.items));
      setHasMore(page.hasMore);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load earlier messages'));
    }
  }

  // Takes the view to a message, loading earlier pages until it turns up.
  async function jumpTo(messageId: string) {
    const show = () => {
      const el = document.querySelector(`[data-message-id="${messageId}"]`);
      if (!el) return false;
      stick.current = false;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setFlashId(messageId);
      setTimeout(() => setFlashId((now) => (now === messageId ? null : now)), 1600);
      return true;
    };
    if (show()) return;
    let before = messages[0]?.id;
    for (let i = 0; before && i < 8; i++) {
      try {
        const page = await getMessages(id, { before });
        setMessages((current) => merge(current, page.items));
        setHasMore(page.hasMore);
        if (page.items.some((m) => m.id === messageId)) {
          requestAnimationFrame(() => requestAnimationFrame(() => void show()));
          return;
        }
        if (!page.hasMore || page.items.length === 0) break;
        before = page.items[page.items.length - 1].id;
      } catch {
        break;
      }
    }
    toast.message('That message is further back than we could load.');
  }

  async function togglePin(m: DirectMessage) {
    try {
      const next = await pinMessage(m.id, !m.pinnedAt);
      setMessages((current) => merge(current, [next]));
      toast.success(next.pinnedAt ? 'Pinned' : 'Unpinned');
      void refresh();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not pin that'));
    }
  }

  function toggleSelected(m: DirectMessage) {
    setSelected((current) => {
      const next = new Set(current ?? []);
      if (next.has(m.id)) next.delete(m.id);
      else next.add(m.id);
      return next;
    });
  }

  const chosen = messages.filter((m) => selected?.has(m.id) && m.status === 'SENT');
  async function copyChosen() {
    const text = chosen.map(copyableText).filter(Boolean).join('\n');
    if (!text) {
      toast.message('Nothing to copy in those: only words can be copied.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
      setSelected(null);
    } catch {
      toast.error('Could not copy that');
    }
  }

  async function answer(accept: boolean) {
    try {
      if (accept) {
        await acceptRequest(id);
        toast.success('Accepted. You can reply now.');
        await refresh();
      } else {
        await declineRequest(id);
        toast.success('Declined. They are not told.');
        router.push('/messages');
      }
      announceMessagesChanged();
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
    }
  }

  async function toggleMute() {
    if (!detail) return;
    const next = !detail.muted;
    try {
      await setConversationMuted(id, next);
      setDetail({ ...detail, muted: next });
      toast.success(next ? 'Muted. You will not be notified.' : 'Unmuted.');
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
    }
  }

  async function archive() {
    try {
      await archiveConversation(id);
      announceMessagesChanged();
      router.push('/messages');
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
    }
  }

  if (missing) {
    return (
      <div className="space-y-4 px-4 py-12">
        <Link href="/messages" className="inline-flex items-center gap-1 md:hidden text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Messages
        </Link>
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground" data-testid="conversation-missing">
          This conversation is not available.
        </p>
      </div>
    );
  }

  if (loading || !user || !detail) {
    return (
      <div className="px-4 py-8" aria-busy>
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const other = detail.other;
  const name = other?.displayName ?? 'Deleted hasher';

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3" data-testid="conversation">
      <header className="flex items-center gap-3 border-b border-border pb-3">
        <Link href="/messages" aria-label="Back to messages" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted md:hidden">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        {other && !other.deleted ? (
          <Link href={`/hashers/${other.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar name={name} src={other.avatarUrl} position={other.avatarPosition} />
            <span className="truncate font-semibold" data-testid="conversation-name">
              {name}
            </span>
          </Link>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar name={name} />
            <span className="truncate font-semibold">{name}</span>
          </span>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => void toggleMute()} aria-label={detail.muted ? 'Unmute' : 'Mute'} data-testid="conversation-mute">
          {detail.muted ? <BellOff className="h-4 w-4" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
        </Button>
        <ActionDialog
          title="Remove from your list?"
          description="It leaves your list until something new arrives. The other person keeps their copy."
          confirmLabel="Remove"
          onConfirm={archive}
          trigger={
            <Button type="button" variant="ghost" size="sm" data-testid="conversation-archive">
              Remove
            </Button>
          }
        />
      </header>

      {detail.pins.length > 0 && (
        <button
          type="button"
          onClick={() => {
            const pin = detail.pins[pinAt % detail.pins.length];
            setPinAt((n) => n + 1);
            void jumpTo(pin.id);
          }}
          className="flex items-center gap-2 border-b border-border bg-muted/50 px-1 py-2 text-left text-sm hover:bg-muted"
          data-testid="pinned-bar"
        >
          <Pin className="h-4 w-4 shrink-0 text-primary-strong" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">Pinned{detail.pins.length > 1 ? ` · ${(pinAt % detail.pins.length) + 1} of ${detail.pins.length}` : ''}</span>{' '}
            <span className="text-muted-foreground">{detail.pins[pinAt % detail.pins.length].preview}</span>
          </span>
        </button>
      )}

      <div
        className="flex-1 space-y-2 overflow-y-auto py-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        data-testid="message-list"
      >
        {hasMore && (
          <div className="text-center">
            <Button type="button" variant="ghost" size="sm" onClick={() => void older()}>
              Earlier messages
            </Button>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            now={now}
            onEdit={(message) => {
              setReplyingTo(null);
              setEditing(message);
            }}
            onReply={(message) => {
              setEditing(null);
              setReplyingTo(message);
            }}
            onForward={(message) => setForwardIds([message.id])}
            onPin={(message) => void togglePin(message)}
            onSelect={(message) => setSelected(new Set([message.id]))}
            onJump={(mid) => void jumpTo(mid)}
            canReply={detail.canReply && !detail.isRequest}
            canPin={detail.status === 'ACTIVE' && !detail.isRequest}
            selecting={selected !== null}
            selected={selected?.has(m.id) ?? false}
            onToggle={toggleSelected}
            flash={flashId === m.id}
          />
        ))}
        <div ref={endRef} />
      </div>

      {detail.isRequest ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4" data-testid="request-banner">
          <p className="text-sm">
            <span className="font-semibold">{name}</span> is not someone you follow or share a kennel with. They cannot send
            more until you accept. Declining does not tell them.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void answer(true)} data-testid="request-accept">
              Accept
            </Button>
            <Button type="button" variant="outline" onClick={() => void answer(false)} data-testid="request-decline">
              Decline
            </Button>
            {other && !other.deleted && (
              <Button asChild variant="ghost">
                <Link href={`/hashers/${other.id}`}>View profile to block or report</Link>
              </Button>
            )}
          </div>
        </div>
      ) : selected !== null ? (
        <div className="flex items-center gap-2 border-t border-border pt-3" data-testid="selection-bar">
          <button type="button" onClick={() => setSelected(null)} aria-label="Stop selecting" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <X className="h-5 w-5" aria-hidden />
          </button>
          <span className="flex-1 text-sm font-medium" data-testid="selection-count">
            {chosen.length} selected
          </span>
          <Button type="button" variant="outline" size="sm" disabled={chosen.length === 0} onClick={() => void copyChosen()} data-testid="selection-copy">
            <Copy className="mr-1.5 h-4 w-4" aria-hidden /> Copy
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={chosen.length === 0}
            onClick={() => {
              setForwardIds(chosen.map((m) => m.id));
            }}
            data-testid="selection-forward"
          >
            <Forward className="mr-1.5 h-4 w-4" aria-hidden /> Forward
          </Button>
        </div>
      ) : detail.canReply ? (
        <Composer
          conversationId={id}
          canShareFiles={detail.canShareFiles}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          onSent={({ message, status }) => {
            setReplyingTo(null);
            stick.current = true;
            setMessages((current) => merge(current, [message]));
            setDetail((d) => (d ? { ...d, status, isRequest: false } : d));
            announceMessagesChanged();
            void refresh();
          }}
          onEdited={(message) => setMessages((current) => merge(current, [message]))}
        />
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground" data-testid="cannot-reply">
          {detail.status === 'REQUESTED'
            ? 'Waiting for them to accept. You can send more once they do.'
            : other?.deleted
              ? 'This hasher has deleted their account.'
              : 'You cannot reply to this conversation.'}
        </p>
      )}

      <ForwardDialog
        fromId={id}
        messageIds={forwardIds}
        onClose={() => setForwardIds([])}
        onDone={() => {
          setForwardIds([]);
          setSelected(null);
          announceMessagesChanged();
        }}
      />
    </div>
  );
}
