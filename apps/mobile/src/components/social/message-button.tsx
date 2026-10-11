import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { canMessage, type CanMessage } from '@/lib/messages';
import { useRouter } from 'expo-router';

// "Message" on somebody else's page (D71), as the web button does it
// (components/social/MessageButton.tsx). Blocked either way, or unknown, shows
// nothing at all: a block does not announce itself (D60).
export function MessageButton({ hasherId }: { hasherId: string }) {
  const router = useRouter();
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
      <Button variant="outline" size="sm" disabled testID="message-closed">
        Messages closed
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      testID="message-hasher"
      onPress={() => router.push(can.conversationId ? `/messages/${can.conversationId}` : `/messages/new?to=${hasherId}`)}>
      Message
    </Button>
  );
}
