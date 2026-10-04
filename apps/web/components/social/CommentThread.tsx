'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { MentionTextarea } from '@/components/social/MentionTextarea';
import { RichText } from '@/components/social/RichText';
import { AfterReport } from '@/components/social/AfterReport';
import { ReportDialog } from '@/components/social/ReportDialog';
import { useAuth } from '@/context/AuthContext';
import {
  addComment,
  deleteComment,
  editComment,
  listComments,
  listReplies,
  removeComment,
  setLiked,
} from '@/lib/social';
import type { CommentThreadItem, ContentComment, SubjectSegment } from '@/lib/types';
import { errorMessage } from '@/services/api';
import { cn, formatDate } from '@/lib/utils';

// The conversation under a piece of content (D50). Two levels: comments, and
// replies to them. A reply to a reply lands under the same root, which the API
// enforces — so this never has to recurse.
//
// A withdrawn or removed comment keeps its place so the replies under it are
// not orphaned, and says so rather than saying nothing.

interface Props {
  segment: SubjectSegment;
  id: string;
  onCountChange?: (comments: number) => void;
}

function Composer({
  placeholder,
  submitLabel,
  initial = '',
  busy,
  onSubmit,
  onCancel,
  autoFocus,
}: {
  placeholder: string;
  submitLabel: string;
  initial?: string;
  busy: boolean;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState(initial);
  const ready = body.trim().length > 0;

  return (
    <div className="flex-1">
      <MentionTextarea
        value={body}
        onValueChange={setBody}
        rows={2}
        maxLength={2000}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-md border border-border bg-background p-2 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="comment-input"
        onKeyDown={(event) => {
          // Enter sends, Shift+Enter is a new line — what a comment box does
          // everywhere else a hasher types one.
          if (event.key === 'Enter' && !event.shiftKey && ready && !busy) {
            event.preventDefault();
            onSubmit(body.trim());
            setBody('');
          }
        }}
      />
      <div className="mt-1 flex gap-2">
        <Button
          size="sm"
          disabled={!ready || busy}
          data-testid="comment-submit"
          onClick={() => {
            onSubmit(body.trim());
            setBody('');
          }}
        >
          {submitLabel}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function Gone({ status }: { status: ContentComment['status'] }) {
  return (
    <p className="text-sm italic text-muted-foreground">
      {status === 'REMOVED' ? 'A moderator took this comment down.' : 'This comment was withdrawn.'}
    </p>
  );
}

function CommentRow({
  comment,
  canModerate,
  onReply,
  onChanged,
  onRemoved,
  depth = 0,
}: {
  comment: ContentComment;
  canModerate: boolean;
  onReply?: () => void;
  onChanged: (next: ContentComment) => void;
  onRemoved: (id: string) => void;
  depth?: number;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gone = comment.status !== 'VISIBLE';

  const toggleLike = async () => {
    const next = !comment.liked;
    onChanged({ ...comment, liked: next, likes: comment.likes + (next ? 1 : -1) });
    try {
      await setLiked('comments', comment.id, next);
    } catch {
      onChanged(comment);
    }
  };

  const withdraw = async () => {
    setBusy(true);
    try {
      await deleteComment(comment.id);
      onChanged({ ...comment, status: 'DELETED', body: null, author: null });
      onRemoved(comment.id);
    } catch (err) {
      setError(errorMessage(err, 'Could not withdraw that.'));
    } finally {
      setBusy(false);
    }
  };

  const takeDown = async (reason: string) => {
    setBusy(true);
    try {
      await removeComment(comment.id, reason);
      onChanged({ ...comment, status: 'REMOVED', body: null, author: null });
      onRemoved(comment.id);
    } catch (err) {
      setError(errorMessage(err, 'Could not take that down.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('flex gap-2', depth > 0 && 'ml-10')} data-testid="comment">
      <Avatar name={comment.author?.name ?? 'Hash'} size="sm" src={comment.author?.avatarUrl ?? null} />
      <div className="min-w-0 flex-1">
        {gone ? (
          <Gone status={comment.status} />
        ) : editing ? (
          <Composer
            placeholder="Say something."
            submitLabel="Save"
            initial={comment.body ?? ''}
            busy={busy}
            autoFocus
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              setBusy(true);
              try {
                onChanged(await editComment(comment.id, body));
                setEditing(false);
              } catch (err) {
                setError(errorMessage(err, 'Could not save that.'));
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : (
          <>
            <div className="rounded-2xl bg-muted px-3 py-2">
              <p className="text-sm font-medium">
                {comment.author ? (
                  <Link href={`/hashers/${comment.author.id}`} className="hover:underline">
                    {comment.author.name}
                  </Link>
                ) : (
                  'A hasher'
                )}
              </p>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                <RichText text={comment.body ?? ''} />
              </p>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 px-3 text-xs text-muted-foreground">
              <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
              {comment.editedAt && <span>edited</span>}
              {user && (
                <button
                  type="button"
                  onClick={toggleLike}
                  className={cn('inline-flex items-center gap-1 hover:underline', comment.liked && 'text-primary-strong font-medium')}
                  aria-pressed={comment.liked}
                  data-testid="comment-like"
                >
                  <Heart className={cn('h-3 w-3', comment.liked && 'fill-current')} aria-hidden />
                  {comment.likes > 0 ? comment.likes : 'Like'}
                </button>
              )}
              {onReply && user && (
                <button type="button" onClick={onReply} className="hover:underline" data-testid="comment-reply">
                  Reply
                </button>
              )}
              {comment.isMine && (
                <>
                  <button type="button" onClick={() => setEditing(true)} className="hover:underline">
                    Edit
                  </button>
                  <ActionDialog
                    title="Withdraw this comment?"
                    description="The words go; its place in the thread stays, so the replies under it are not orphaned. This cannot be undone."
                    confirmLabel="Withdraw"
                    destructive
                    onConfirm={withdraw}
                    trigger={
                      <button type="button" disabled={busy} className="hover:underline">
                        Withdraw
                      </button>
                    }
                  />
                </>
              )}
              {user && !comment.isMine && comment.author && (
                <ReportDialog
                  targetType="COMMENT"
                  targetId={comment.id}
                  afterSend={<AfterReport userId={comment.author.id} />}
                  trigger={
                    <button type="button" className="hover:underline" data-testid="comment-report">
                      Report
                    </button>
                  }
                />
              )}
              {canModerate && !comment.isMine && (
                <ActionDialog
                  title="Take this comment down?"
                  description="A moderator&apos;s removal is written to the audit log with the reason. The row stays; the words go."
                  confirmLabel="Take it down"
                  destructive
                  text={{ label: "Reason", required: true, hint: "Written to the audit log." }}
                  onConfirm={(values) => takeDown(values.text)}
                  trigger={
                    <button type="button" disabled={busy} className="text-destructive hover:underline">
                      Take down
                    </button>
                  }
                />
              )}
            </div>
          </>
        )}
        {error && <p className="mt-1 px-3 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

export function CommentThread({ segment, id, onCountChange }: Props) {
  const { user } = useAuth();
  const [roots, setRoots] = useState<CommentThreadItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (which: number) => {
      setLoading(true);
      try {
        const data = await listComments(segment, id, which);
        setRoots((current) => (which === 1 ? data.items : [...current, ...data.items]));
        setTotal(data.total);
      } catch (err) {
        setError(errorMessage(err, 'Could not load the conversation.'));
      } finally {
        setLoading(false);
      }
    },
    [segment, id],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  // Whether this reader may take a comment down is a property of the subject,
  // not of any one comment, so it is asked once.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    import('@/lib/social')
      .then((m) => m.getEngagement(segment, id))
      .then((detail) => {
        if (alive) setCanModerate(detail.canModerate);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [segment, id, user]);

  const replaceComment = (next: ContentComment) => {
    setRoots((current) =>
      current.map((root) =>
        root.id === next.id
          ? { ...root, ...next }
          : { ...root, replies: root.replies.map((reply) => (reply.id === next.id ? { ...reply, ...next } : reply)) },
      ),
    );
  };

  const post = async (body: string, parentId: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const comment = await addComment(segment, id, body, parentId);
      if (parentId) {
        setRoots((current) =>
          current.map((root) =>
            root.id === parentId
              ? { ...root, replies: [...root.replies, comment], replyCount: root.replyCount + 1 }
              : root,
          ),
        );
        setReplyingTo(null);
      } else {
        setRoots((current) => [...current, { ...comment, replies: [] }]);
      }
      setTotal((count) => count + 1);
      onCountChange?.(total + 1);
    } catch (err) {
      setError(errorMessage(err, 'Could not post that.'));
    } finally {
      setBusy(false);
    }
  };

  const expandReplies = async (rootId: string) => {
    try {
      const data = await listReplies(rootId);
      setRoots((current) => current.map((root) => (root.id === rootId ? { ...root, replies: data.items } : root)));
    } catch (err) {
      setError(errorMessage(err, 'Could not load the replies.'));
    }
  };

  return (
    <div className="border-t border-border px-4 py-3" data-testid="comment-thread">
      {loading && roots.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading the conversation…
        </p>
      ) : roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody has said anything yet.</p>
      ) : (
        <div className="space-y-4">
          {roots.map((root) => (
            <div key={root.id} className="space-y-2">
              <CommentRow
                comment={root}
                canModerate={canModerate}
                onReply={() => setReplyingTo(replyingTo === root.id ? null : root.id)}
                onChanged={replaceComment}
                onRemoved={() => {
                  setTotal((count) => Math.max(0, count - 1));
                  onCountChange?.(Math.max(0, total - 1));
                }}
              />
              {root.replies.map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={reply}
                  canModerate={canModerate}
                  depth={1}
                  onChanged={replaceComment}
                  onRemoved={() => {
                    setTotal((count) => Math.max(0, count - 1));
                    onCountChange?.(Math.max(0, total - 1));
                  }}
                />
              ))}
              {root.replyCount > root.replies.length && (
                <button
                  type="button"
                  onClick={() => expandReplies(root.id)}
                  className="ml-10 text-sm text-primary-strong hover:underline"
                >
                  Show all {root.replyCount} replies
                </button>
              )}
              {replyingTo === root.id && (
                <div className="ml-10 flex gap-2">
                  <Composer
                    placeholder={`Reply to ${root.author?.name ?? 'this'}…`}
                    submitLabel="Reply"
                    busy={busy}
                    autoFocus
                    onCancel={() => setReplyingTo(null)}
                    onSubmit={(body) => post(body, root.id)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {roots.length < total && (
        <button
          type="button"
          onClick={() => {
            const next = page + 1;
            setPage(next);
            void load(next);
          }}
          className="mt-3 text-sm text-primary-strong hover:underline"
        >
          More comments
        </button>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {user ? (
        <div className="mt-4 flex gap-2">
          <Avatar name={user.displayName} size="sm" src={user.avatarUrl} />
          <Composer placeholder="Say something." submitLabel="Comment" busy={busy} onSubmit={(body) => post(body, null)} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-primary-strong hover:underline">
            Sign in
          </Link>{' '}
          to join the conversation.
        </p>
      )}
    </div>
  );
}
