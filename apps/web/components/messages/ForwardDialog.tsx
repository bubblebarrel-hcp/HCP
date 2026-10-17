'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { forwardMessages, listConversations, type ConversationSummary } from '@/lib/messages';
import { errorMessage } from '@/services/api';

// Passing messages on (D71). Only to conversations already open, because a forward is
// an ordinary send and meets the same rules: nobody is reached who could not be
// written to. Up to five at a time.

const MAX_TARGETS = 5;

export function ForwardDialog({
  fromId,
  messageIds,
  onClose,
  onDone,
}: {
  fromId: string;
  // Empty means closed.
  messageIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const open = messageIds.length > 0;
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicked([]);
    setItems(null);
    listConversations('inbox', 1, 50)
      .then((page) => alive && setItems(page.items.filter((c) => c.id !== fromId && c.status === 'ACTIVE')))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [open, fromId]);

  function toggle(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length >= MAX_TARGETS ? current : [...current, id]));
  }

  async function send() {
    if (!picked.length || busy) return;
    setBusy(true);
    try {
      const results = await forwardMessages(fromId, messageIds, picked);
      const failed = results.filter((r) => r.error);
      if (failed.length === 0) toast.success(results.length === 1 ? 'Forwarded' : `Forwarded to ${results.length} conversations`);
      else toast.error(failed[0].error!.message);
      // Anything that went through closes the dialog; if all of it failed, stay and let them choose again.
      if (failed.length < results.length) onDone();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not forward that'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {open && (
        <DialogContent title={messageIds.length === 1 ? 'Forward message' : `Forward ${messageIds.length} messages`} description={`Pick up to ${MAX_TARGETS} conversations.`}>
          <div className="space-y-4" data-testid="forward-dialog">
            {items === null ? (
              <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy />
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">You have no other open conversations to forward into.</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {items.map((c) => {
                  const name = c.other?.displayName ?? 'Deleted hasher';
                  return (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                        <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4" data-testid="forward-target" />
                        <Avatar name={name} src={c.other?.avatarUrl} position={c.other?.avatarPosition} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void send()} disabled={!picked.length || busy} data-testid="forward-send">
                {busy ? 'Sending…' : `Send${picked.length ? ` (${picked.length})` : ''}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
