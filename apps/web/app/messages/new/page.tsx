'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { announceMessagesChanged, canMessage, clientKey, MAX_MESSAGE, startConversation } from '@/lib/messages';
import type { HasherProfile } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

// The first message to somebody (D71). If a conversation already exists this
// goes straight to it. If they do not follow you and share no kennel with you,
// it is sent as a request, and you can send one message until they accept.

function NewInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const to = useSearchParams().get('to') ?? '';
  const [name, setName] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  // One key per attempt, so a double tap or a retry is one message.
  const key = useRef(clientKey());

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !to) return;
    let alive = true;
    canMessage(to)
      .then(async (can) => {
        if (!alive) return;
        if (can.conversationId) return router.replace(`/messages/${can.conversationId}`);
        if (!can.allowed) {
          setBlocked(can.reason === 'CLOSED' ? 'This hasher is not taking new messages.' : 'You cannot message this hasher.');
          return;
        }
        const res = await api.get<{ data: { hasher: HasherProfile } }>(`/hashers/${to}`);
        if (alive) setName(res.data.data.hasher.name);
      })
      .catch(() => alive && setBlocked('You cannot message this hasher.'));
    return () => {
      alive = false;
    };
  }, [user, to, router]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const sent = await startConversation(to, text, key.current);
      announceMessagesChanged();
      if (sent.status === 'REQUESTED') toast.success('Sent as a request. They will see it when they open their requests.');
      router.replace(`/messages/${sent.conversationId}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send that'));
      setSending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 overflow-y-auto px-4 py-8" data-testid="new-message">
      <Link href="/messages" className="inline-flex items-center gap-1 text-sm md:hidden text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Messages
      </Link>
      {blocked ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground" data-testid="new-message-blocked">
          {blocked}
        </p>
      ) : !name ? (
        <div className="h-40 animate-pulse rounded-xl bg-card" aria-busy />
      ) : (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <Avatar name={name} />
            <div>
              <p className="text-sm text-muted-foreground">New message to</p>
              <p className="font-semibold">{name}</p>
            </div>
          </div>
          <Textarea
            autoFocus
            value={body}
            maxLength={MAX_MESSAGE}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message"
            aria-label="Message"
            data-testid="new-message-body"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {body.length}/{MAX_MESSAGE}
            </span>
            <Button type="button" onClick={() => void send()} disabled={!body.trim() || sending} data-testid="new-message-send">
              <Send className="h-4 w-4" aria-hidden /> {sending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewMessagePage() {
  return (
    <Suspense fallback={<div className="mx-auto h-40 w-full max-w-2xl animate-pulse rounded-xl bg-muted" aria-busy />}>
      <NewInner />
    </Suspense>
  );
}
