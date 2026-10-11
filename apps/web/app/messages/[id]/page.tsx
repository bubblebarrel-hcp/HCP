'use client';

import { use, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BellOff, Bell, Flag, Send, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { ReportDialog } from '@/components/social/ReportDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { useAuth } from '@/context/AuthContext';
import {
  acceptRequest,
  announceMessagesChanged,
  archiveConversation,
  clientKey,
  declineRequest,
  getConversation,
  getMessages,
  markConversationRead,
  MAX_MESSAGE,
  sendMessage,
  setConversationMuted,
  unsendMessage,
  type ConversationDetail,
  type DirectMessage,
} from '@/lib/messages';
import { isRealtimeConnected, useRealtimeEvent } from '@/lib/realtime';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/api';

// One conversation (D71). Refreshed every few seconds while it is open: there is
// no socket, so the newest page is re-read and merged by id, which also picks up
// a message the other person unsent.

const POLL_MS = 4_000;

const byTime = (a: DirectMessage, b: DirectMessage) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

function merge(current: DirectMessage[], incoming: DirectMessage[]) {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort(byTime);
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const key = useRef(clientKey());
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

  // Pushed by the socket (D72). A message for this conversation is merged and,
  // if it is theirs and the tab is in view, read. Anything else about it, or a
  // reconnect, re-reads the conversation.
  useRealtimeEvent(['dm:message'], (e: { conversationId: string; message: DirectMessage }) => {
    if (e.conversationId !== id) return;
    setMessages((current) => merge(current, [e.message]));
    if (!e.message.mine && document.visibilityState === 'visible') {
      markConversationRead(id)
        .then(() => announceMessagesChanged())
        .catch(() => undefined);
    }
  });
  useRealtimeEvent(['dm:message-updated'], (e: { conversationId: string; message: DirectMessage }) => {
    if (e.conversationId === id) setMessages((current) => merge(current, [e.message]));
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
      if (alive && items?.some((m) => !m.mine)) {
        markConversationRead(id)
          .then(() => announceMessagesChanged())
          .catch(() => undefined);
      }
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
  }, [user, id, refresh]);

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

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const sent = await sendMessage(id, text, key.current);
      key.current = clientKey();
      stick.current = true;
      setDraft('');
      setMessages((current) => merge(current, [sent.message]));
      setDetail((d) => (d ? { ...d, status: sent.status, isRequest: false } : d));
      announceMessagesChanged();
      void refresh();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send that'));
    } finally {
      setSending(false);
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

  async function unsend(message: DirectMessage) {
    try {
      await unsendMessage(message.id);
      setMessages((current) => current.map((m) => (m.id === message.id ? { ...m, body: null, status: 'DELETED' } : m)));
    } catch (err) {
      toast.error(errorMessage(err, 'Could not unsend that'));
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
          <div key={m.id} className={cn('flex flex-col', m.mine ? 'items-end' : 'items-start')} data-testid="message">
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
                m.status !== 'SENT'
                  ? 'border border-dashed border-border italic text-muted-foreground'
                  : m.mine
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted',
              )}
            >
              {m.status === 'SENT' ? m.body : m.status === 'DELETED' ? (m.mine ? 'You unsent this message' : 'This message was unsent') : 'Removed by moderators'}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <time dateTime={m.createdAt}>{clock(m.createdAt)}</time>
              {m.status === 'SENT' && m.mine && (
                <ActionDialog
                  title="Unsend this message?"
                  description="It disappears for both of you. They may already have read it."
                  confirmLabel="Unsend"
                  destructive
                  onConfirm={() => unsend(m)}
                  trigger={
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" data-testid="message-unsend">
                      <Undo2 className="h-3 w-3" aria-hidden /> Unsend
                    </button>
                  }
                />
              )}
              {m.status === 'SENT' && !m.mine && (
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
          </div>
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
      ) : detail.canReply ? (
        <div className="flex items-end gap-2 border-t border-border pt-3">
          <Textarea
            value={draft}
            maxLength={MAX_MESSAGE}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Write a message"
            aria-label="Message"
            className="max-h-32 min-h-10 flex-1 resize-none"
            data-testid="message-input"
          />
          <Button type="button" onClick={() => void send()} disabled={!draft.trim() || sending} aria-label="Send" data-testid="message-send">
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground" data-testid="cannot-reply">
          {detail.status === 'REQUESTED'
            ? 'Waiting for them to accept. You can send more once they do.'
            : other?.deleted
              ? 'This hasher has deleted their account.'
              : 'You cannot reply to this conversation.'}
        </p>
      )}
    </div>
  );
}
