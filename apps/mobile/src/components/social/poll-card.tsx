import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { PostPoll } from '@/lib/types';

// A poll on a post (D60): "Where's the on-after?". One answer each, changeable
// until it closes. Results appear once you have answered, once it is over, or when
// it is yours, so a poll nobody has answered cannot be answered by looking.

function remaining(closesAt: string) {
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return 'Closed';
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 48) return `${Math.floor(hours / 24)} days left`;
  if (hours >= 1) return `${hours} h left`;
  return `${Math.max(1, Math.ceil(ms / 60_000))} min left`;
}

export function PollCard({ postId, initial }: { postId: string; initial: PostPoll }) {
  const theme = useTheme();
  const { user } = useAuth();
  const [poll, setPoll] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const results = poll.closed || poll.myVote !== null || poll.options.some((o) => o.votes !== null);

  async function vote(optionId: string) {
    if (busy || poll.closed || !user || optionId === poll.myVote) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ poll: PostPoll }>(`/posts/${postId}/poll/vote`, { method: 'POST', body: { optionId } });
      setPoll(data.poll);
    } catch (err) {
      setError(errorMessage(err, 'Your vote did not go through.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      {poll.options.map((option) => {
        const mine = poll.myVote === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: mine, disabled: poll.closed || !user }}
            accessibilityLabel={`${option.text}${option.share !== null ? `, ${option.share} percent` : ''}`}
            disabled={busy || poll.closed || !user}
            onPress={() => void vote(option.id)}
            style={[styles.option, { borderColor: mine ? theme.primary : theme.border }]}>
            {results && option.share !== null && (
              <View
                style={[
                  styles.bar,
                  { width: `${option.share}%`, backgroundColor: mine ? theme.primary : theme.backgroundElement, opacity: mine ? 0.3 : 1 },
                ]}
              />
            )}
            <View style={styles.optionRow}>
              <ThemedText style={styles.optionText}>{mine ? '✓ ' : ''}{option.text}</ThemedText>
              {results && option.share !== null && <ThemedText type="small" themeColor="textSecondary">{option.share}%</ThemedText>}
            </View>
          </Pressable>
        );
      })}
      <ThemedText type="small" themeColor="textSecondary">
        {results ? `${poll.totalVotes} ${poll.totalVotes === 1 ? 'vote' : 'votes'} · ` : ''}
        {remaining(poll.closesAt)}
        {!user ? ' · Log in to vote' : ''}
      </ThemedText>
      {error && <ThemedText type="small" style={{ color: theme.danger }}>{error}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two, marginTop: Spacing.two },
  option: { borderWidth: 1, borderRadius: Spacing.two, overflow: 'hidden', minHeight: 44, justifyContent: 'center' },
  bar: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  optionText: { flex: 1 },
});
