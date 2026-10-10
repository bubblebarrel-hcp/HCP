'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { MAX_POST_BODY, archivePost, updatePost } from '@/lib/posts';
import { errorMessage } from '@/services/api';

// What an author can do to their own post: change the words, or delete it.
//
// Deleting is the API's archive (Ch.22): the post leaves every list and its own
// page, and the row stays, as with a reel. An edit is marked "edited" for readers.
// Only the words change; the pictures, poll and audience are set elsewhere.
//
// Rendered on feed cards and the post page, both Server Components, so it works out
// whose post it is from the signed-in user rather than being told. The API checks
// again: nobody else can edit or archive it.
export function PostActions({
  id,
  authorId,
  body,
  threadCount = 0,
  isPart = false,
  onOwnPage = false,
}: {
  id: string;
  authorId: string | null;
  body: string;
  // Posts after this one in its thread; deleting the first deletes them all.
  threadCount?: number;
  // A later post in a thread: it has no page of its own to leave.
  isPart?: boolean;
  // The post's own page: deleting it sends the author home.
  onOwnPage?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);
  const [text, setText] = useState(body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menu]);

  if (!user || !authorId || user.id !== authorId) return null;

  const open = (which: 'edit' | 'delete') => {
    setMenu(false);
    setError(null);
    setText(body);
    setDialog(which);
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updatePost(id, text);
      setDialog(null);
      toast.success('Post updated');
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, 'Could not save your changes'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await archivePost(id);
      setDialog(null);
      toast.success('Post deleted');
      // The cached page can outlive the post for a moment, so take the card away
      // now rather than waiting for the refresh to catch up.
      const card = root.current?.closest<HTMLElement>('[data-post-card]');
      if (card) card.style.display = 'none';
      if (onOwnPage && !isPart) router.replace('/');
      else router.refresh();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete this post'));
    } finally {
      setBusy(false);
    }
  }

  const changed = text.trim() !== body.trim();

  return (
    <div ref={root} className="absolute right-2 top-2 z-10">
      <button
        type="button"
        onClick={() => setMenu((v) => !v)}
        aria-label="Post actions"
        aria-haspopup="menu"
        aria-expanded={menu}
        data-testid="post-actions"
        className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {menu && (
        <div role="menu" className="absolute right-0 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
          <button
            type="button"
            role="menuitem"
            onClick={() => open('edit')}
            data-testid="post-edit"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
          >
            <Pencil className="h-4 w-4" aria-hidden /> Edit post
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => open('delete')}
            data-testid="post-delete"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-destructive hover:bg-muted"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Delete post
          </button>
        </div>
      )}

      <Dialog open={dialog === 'edit'} onOpenChange={(next) => !next && !busy && setDialog(null)}>
        <DialogContent title="Edit post" description="Only the words change. People will see that it was edited.">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_POST_BODY}
            rows={7}
            aria-label="Post text"
            data-testid="post-edit-text"
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-[15px] leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {text.length} / {MAX_POST_BODY}
          </p>
          {error && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={busy || !changed} data-testid="post-edit-save">
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'delete'} onOpenChange={(next) => !next && !busy && setDialog(null)}>
        <DialogContent
          title="Delete this post?"
          description={
            threadCount > 0
              ? `This deletes the whole thread: this post and the ${threadCount} after it. Likes and comments go with it.`
              : 'It disappears for everyone, along with its likes and comments.'
          }
        >
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={busy}>
              Keep it
            </Button>
            <Button type="button" variant="destructive" onClick={() => void remove()} disabled={busy} data-testid="post-delete-confirm">
              {busy ? 'Deleting…' : 'Delete post'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
