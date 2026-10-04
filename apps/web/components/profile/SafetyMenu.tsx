'use client';

import { useEffect, useState } from 'react';
import { BellOff, ShieldBan } from 'lucide-react';
import { toast } from 'sonner';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import type { BlockKind, HasherProfile } from '@/lib/types';
import api, { errorMessage } from '@/services/api';

// Block and mute on somebody else's page (D60). The page is served from a shared
// cache with no session, so where the viewer stands is asked for here, with theirs.
export function SafetyMenu({ hasherId, name }: { hasherId: string; name: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<BlockKind | null>(null);
  const [known, setKnown] = useState(false);

  useEffect(() => {
    if (!user || user.id === hasherId) return;
    let alive = true;
    api
      .get<{ data: { hasher: HasherProfile & { myBlock?: BlockKind | null } } }>(`/hashers/${hasherId}`)
      .then((res) => {
        if (!alive) return;
        setState(res.data.data.hasher.myBlock ?? null);
        setKnown(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user, hasherId]);

  if (!user || user.id === hasherId || !known) return null;

  async function set(kind: BlockKind, on: boolean) {
    try {
      await api[on ? 'put' : 'delete'](`/hashers/${hasherId}/${kind === 'BLOCK' ? 'block' : 'mute'}`);
      setState(on ? kind : null);
      toast.success(
        on
          ? kind === 'BLOCK'
            ? `${name} is blocked.`
            : `${name} is muted.`
          : kind === 'BLOCK'
            ? `${name} is unblocked.`
            : `${name} is unmuted.`,
      );
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2" data-testid="safety-menu">
      {state === 'BLOCK' ? (
        <Button type="button" variant="outline" size="sm" onClick={() => void set('BLOCK', false)} data-testid="unblock">
          <ShieldBan className="h-4 w-4" aria-hidden /> Unblock
        </Button>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void set('MUTE', state !== 'MUTE')}
            data-testid="mute-toggle"
          >
            <BellOff className="h-4 w-4" aria-hidden /> {state === 'MUTE' ? 'Unmute' : 'Mute'}
          </Button>
          <ActionDialog
            title={`Block ${name}?`}
            description="They will not be able to see your posts, reels or photos, follow you, or notify you, and you will not see theirs. Any follow between you ends. They are not told."
            confirmLabel="Block"
            destructive
            onConfirm={() => set('BLOCK', true)}
            trigger={
              <Button type="button" variant="outline" size="sm" data-testid="block-open">
                <ShieldBan className="h-4 w-4" aria-hidden /> Block
              </Button>
            }
          />
        </>
      )}
    </div>
  );
}
