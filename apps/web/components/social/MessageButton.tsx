'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { canMessage, type CanMessage } from '@/lib/messages';

// "Message" on somebody else's page (D71). The page is served from a shared
// cache with no session, so whether this viewer may write to them is asked for
// here. Blocked either way, or unknown, shows nothing at all: a block does not
// announce itself (D60).
export function MessageButton({ hasherId }: { hasherId: string }) {
  const { user } = useAuth();
  const [can, setCan] = useState<CanMessage | null>(null);

  useEffect(() => {
    if (!user || user.id === hasherId) return;
    let alive = true;
    canMessage(hasherId)
      .then((c) => alive && setCan(c))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user, hasherId]);

  if (!user || user.id === hasherId || !can) return null;
  if (can.reason === 'NOT_FOUND' || can.reason === 'UNAVAILABLE' || can.reason === 'SELF') return null;

  if (!can.allowed) {
    return (
      <Button type="button" variant="outline" size="sm" disabled title="Not taking new messages" data-testid="message-closed">
        <MessageCircle className="h-4 w-4" aria-hidden /> Messages closed
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link
        href={can.conversationId ? `/messages/${can.conversationId}` : `/messages/new?to=${hasherId}`}
        data-testid="message-hasher"
      >
        <MessageCircle className="h-4 w-4" aria-hidden /> Message
      </Link>
    </Button>
  );
}
