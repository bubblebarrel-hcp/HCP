'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import {
  announceMessagesChanged,
  listConversations,
  shortTime,
  unreadCounts,
  type Box,
  type ConversationSummary,
} from '@/lib/messages';
import { isRealtimeConnected, useRealtimeEvent } from '@/lib/realtime';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/api';

// Direct messages (D71). Two lists: people you know, and requests from people
// you do not, which stay out of the inbox until you say yes.

const POLL_MS = 15_000;

function preview(c: ConversationSummary) {
  const m = c.lastMessage;
  if (!m) return 'No messages yet';
  const words = m.status === 'SENT' ? m.body : m.status === 'DELETED' ? 'Message deleted' : 'Removed by moderators';
  return `${m.mine ? 'You: ' : ''}${words ?? ''}`;
}

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [box, setBox] = useState<Box>('inbox');
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [counts, setCounts] = useState({ unread: 0, requests: 0 });

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  // Anything the socket says about a conversation (or a reconnect) reloads the list.
  const [nudge, setNudge] = useState(0);
  useRealtimeEvent(['dm:message', 'dm:message-updated', 'dm:conversation', 'dm:read', 'dm:refresh', 'resync'], () => setNudge((n) => n + 1));

  useEffect(() => {
    if (!user) return;
    let alive = true;
    let count = 0;
    const tick = async () => {
      try {
        const [page, c] = await Promise.all([listConversations(box), unreadCounts()]);
        if (!alive) return;
        setItems(page.items);
        setCounts(c);
      } catch (err) {
        if (!alive) return;
        setItems((current) => current ?? []);
        toast.error(errorMessage(err, 'Could not load your messages'));
      }
    };
    void tick();
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!isRealtimeConnected() || ++count % 4 === 0) void tick();
    }, POLL_MS);
    const onShow = () => announceMessagesChanged();
    window.addEventListener('focus', onShow);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', onShow);
    };
  }, [user, box, nudge]);

  function pick(next: Box) {
    if (next === box) return;
    setItems(null);
    setBox(next);
  }

  const tab = (active: boolean) =>
    cn(
      'flex-1 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
      active ? 'border-primary text-primary-strong' : 'border-transparent text-muted-foreground hover:text-foreground',
    );

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8" data-testid="messages-page">
      <h1 className="text-2xl font-bold">Messages</h1>

      <div role="tablist" className="flex border-b border-border">
        <button type="button" role="tab" aria-selected={box === 'inbox'} className={tab(box === 'inbox')} onClick={() => pick('inbox')} data-testid="tab-inbox">
          Messages
          {counts.unread > 0 && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{counts.unread}</span>}
        </button>
        <button type="button" role="tab" aria-selected={box === 'requests'} className={tab(box === 'requests')} onClick={() => pick('requests')} data-testid="tab-requests">
          Requests
          {counts.requests > 0 && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{counts.requests}</span>}
        </button>
      </div>

      {box === 'requests' && (
        <p className="text-sm text-muted-foreground">
          People you do not follow and share no kennel with start here. Nothing tells them you have seen it until you accept.
        </p>
      )}

      {items === null ? (
        <div className="space-y-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground" data-testid="messages-empty">
          {box === 'inbox'
            ? 'No conversations yet. Open a hasher’s page and choose Message to start one.'
            : 'No message requests.'}
        </Card>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card" data-testid="conversation-list">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                data-testid="conversation-item"
                className={cn('flex items-center gap-3 p-3 hover:bg-muted', c.unreadCount > 0 && 'bg-primary/5')}
              >
                <Avatar name={c.other?.displayName ?? 'Hasher'} src={c.other?.avatarUrl} position={c.other?.avatarPosition} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn('truncate', c.unreadCount > 0 ? 'font-semibold' : 'font-medium')}>
                      {c.other?.displayName ?? 'Deleted hasher'}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{shortTime(c.lastMessageAt)}</span>
                  </span>
                  <span className={cn('block truncate text-sm', c.unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                    {c.status === 'REQUESTED' && !c.isRequest ? 'Waiting for them · ' : ''}
                    {preview(c)}
                  </span>
                </span>
                {c.unreadCount > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground" data-testid="conversation-unread">
                    {c.unreadCount}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
