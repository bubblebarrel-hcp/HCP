'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SquarePen, Search } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { NewMessageDialog } from '@/components/messages/NewMessageDialog';
import { useAuth } from '@/context/AuthContext';
import { plainText } from '@/lib/chat-format';
import {
  listConversations,
  MESSAGES_CHANGED,
  shortTime,
  unreadCounts,
  type Box,
  type ConversationSummary,
} from '@/lib/messages';
import { isRealtimeConnected, useRealtimeEvent } from '@/lib/realtime';
import { cn } from '@/lib/utils';

// Direct messages (D71), laid out as a two-pane inbox: the conversation list on
// the left, whatever is open on the right. From md up both are on screen at
// once and the list stays put as you move between conversations; on a phone
// there is one pane at a time, the list at /messages and the thread at
// /messages/:id.
//
// The list lives here, not in a page, so opening a conversation does not reload
// it, and so the thread can say "I read that" and have the dots follow.

const POLL_MS = 15_000;

function preview(c: ConversationSummary) {
  const m = c.lastMessage;
  if (!m) return 'No messages yet';
  // The server builds the line: the words for text, a label for the rest ("Photo", "Sticker").
  const words = m.status === 'SENT' ? plainText(m.preview) : m.preview;
  return `${m.mine ? 'You: ' : ''}${words}`;
}

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [box, setBox] = useState<Box>('inbox');
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [counts, setCounts] = useState({ unread: 0, requests: 0 });
  const [search, setSearch] = useState('');
  const [nudge, setNudge] = useState(0);

  const atRoot = pathname === '/messages';
  const openId = pathname.startsWith('/messages/') ? pathname.split('/')[2] : null;

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  // Anything the socket says about a conversation (D72), a reconnect, or the
  // thread reporting a read, reloads the list.
  useRealtimeEvent(['dm:message', 'dm:message-updated', 'dm:conversation', 'dm:read', 'dm:refresh', 'resync'], () =>
    setNudge((n) => n + 1),
  );
  useEffect(() => {
    const bump = () => setNudge((n) => n + 1);
    window.addEventListener(MESSAGES_CHANGED, bump);
    return () => window.removeEventListener(MESSAGES_CHANGED, bump);
  }, []);

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
      } catch {
        if (alive) setItems((current) => current ?? []);
      }
    };
    void tick();
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!isRealtimeConnected() || ++count % 4 === 0) void tick();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [user, box, nudge]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !items) return items;
    return items.filter((c) => (c.other?.displayName ?? 'deleted hasher').toLowerCase().includes(q));
  }, [items, search]);

  const tab = (active: boolean) =>
    cn(
      'flex-1 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
      active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
    );

  return (
    <div
      className="mx-auto flex h-[calc(100dvh-8.5rem)] w-full max-w-7xl overflow-hidden bg-card md:h-[calc(100dvh-5rem)] md:border-x md:border-border"
      data-testid="messages-shell"
    >
      <aside
        className={cn(
          'min-h-0 w-full shrink-0 flex-col border-border md:flex md:w-[24rem] md:border-r',
          atRoot ? 'flex' : 'hidden',
        )}
        data-testid="messages-list-pane"
      >
        <div className="flex items-center justify-between px-5 pb-1 pt-5">
          <h1 className="text-xl font-bold">Messages</h1>
          <NewMessageDialog
            trigger={
              <button
                type="button"
                aria-label="New message"
                data-testid="new-message-open"
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
              >
                <SquarePen className="h-6 w-6" aria-hidden />
              </button>
            }
          />
        </div>

        <div role="tablist" className="flex border-b border-border">
          <button type="button" role="tab" aria-selected={box === 'inbox'} className={tab(box === 'inbox')} onClick={() => { setItems(null); setBox('inbox'); }} data-testid="tab-inbox">
            Messages
            {counts.unread > 0 && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" aria-label={`${counts.unread} unread`} />}
          </button>
          <button type="button" role="tab" aria-selected={box === 'requests'} className={tab(box === 'requests')} onClick={() => { setItems(null); setBox('requests'); }} data-testid="tab-requests">
            Requests
            {counts.requests > 0 && <span className="ml-1.5 text-primary-strong">({counts.requests})</span>}
          </button>
        </div>

        <div className="px-4 py-3">
          <label className="flex items-center gap-3 rounded-full bg-muted px-4 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              aria-label="Search your conversations"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              data-testid="conversation-search"
            />
          </label>
        </div>

        {box === 'requests' && (
          <p className="px-5 pb-2 text-xs text-muted-foreground">
            People you do not follow and share no kennel with start here. Nothing tells them you have seen it until you accept.
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {shown === null ? (
            <div className="space-y-3 p-4" aria-busy>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-14 w-14 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground" data-testid="messages-empty">
              {search
                ? 'No conversations match.'
                : box === 'inbox'
                  ? 'No conversations yet. Use the pencil to start one.'
                  : 'No message requests.'}
            </p>
          ) : (
            <ul data-testid="conversation-list">
              {shown.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/messages/${c.id}`}
                    data-testid="conversation-item"
                    aria-current={c.id === openId ? 'page' : undefined}
                    className={cn('flex items-center gap-3 px-5 py-2.5 hover:bg-muted', c.id === openId && 'bg-muted')}
                  >
                    <Avatar name={c.other?.displayName ?? 'Hasher'} src={c.other?.avatarUrl} position={c.other?.avatarPosition} size="lg" />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[15px]', c.unreadCount > 0 ? 'font-semibold' : 'font-normal')}>
                        {c.other?.displayName ?? 'Deleted hasher'}
                      </span>
                      <span className={cn('block truncate text-sm', c.unreadCount > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                        {c.status === 'REQUESTED' && !c.isRequest ? 'Waiting for them · ' : ''}
                        {c.unreadCount > 1 ? `${c.unreadCount} new messages` : preview(c)}
                        <span className="font-normal text-muted-foreground"> · {shortTime(c.lastMessageAt)}</span>
                      </span>
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" data-testid="conversation-unread" aria-label="Unread" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className={cn('min-h-0 min-w-0 flex-1 flex-col md:flex', atRoot ? 'hidden' : 'flex')} data-testid="messages-main-pane">
        {children}
      </section>
    </div>
  );
}
