'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { PostPoll } from '@/lib/types';
import { cn } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

// A poll on a post (D60): "Where's the on-after?". One answer each, changeable
// until it closes. Results appear once you have answered, once it is over, or
// when it is yours, so a poll nobody has answered cannot be answered by looking.

function remaining(closesAt: string) {
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return 'Closed';
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 48) return `${Math.floor(hours / 24)} days left`;
  if (hours >= 1) return `${hours} h left`;
  return `${Math.max(1, Math.ceil(ms / 60_000))} min left`;
}

export function PollCard({ postId, initial }: { postId: string; initial: PostPoll }) {
  const { user } = useAuth();
  const [poll, setPoll] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const results = poll.closed || poll.myVote !== null || poll.options.some((o) => o.votes !== null);

  const vote = async (optionId: string) => {
    if (busy || poll.closed || optionId === poll.myVote) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ data: { poll: PostPoll } }>(`/posts/${postId}/poll/vote`, { optionId });
      setPoll(res.data.data.poll);
    } catch (err) {
      setError(errorMessage(err, 'Your vote did not go through.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2" data-testid="poll">
      <ul className="space-y-2">
        {poll.options.map((option) => {
          const mine = poll.myVote === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => vote(option.id)}
                disabled={busy || poll.closed || !user}
                aria-pressed={mine}
                title={!user ? 'Sign in to vote' : undefined}
                className={cn(
                  'relative w-full overflow-hidden rounded-lg border border-border px-3 py-2 text-left text-sm',
                  'hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent',
                  mine && 'border-primary',
                )}
                data-testid="poll-option"
              >
                {results && option.share !== null && (
                  <span
                    aria-hidden
                    className={cn('absolute inset-y-0 left-0', mine ? 'bg-primary/25' : 'bg-muted')}
                    style={{ width: `${option.share}%` }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  {mine && <Check className="h-4 w-4 shrink-0 text-primary-strong" aria-hidden />}
                  <span className="min-w-0 flex-1 break-words">{option.text}</span>
                  {results && option.share !== null && (
                    <span className="shrink-0 tabular-nums text-muted-foreground">{option.share}%</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        {results && `${poll.totalVotes} ${poll.totalVotes === 1 ? 'vote' : 'votes'} · `}
        {remaining(poll.closesAt)}
        {!user && ' · Sign in to vote'}
      </p>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
