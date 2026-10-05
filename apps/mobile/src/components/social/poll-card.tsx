import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { PostPoll } from '@/lib/types';

// A poll on a post (D60): "Where's the on-after?". One answer each, changeable
// until it closes. Results appear once you have answered, once it is over, or when
// it is yours, so a poll nobody has answered cannot be answered by looking. Drawn
// as the web does (components/social/PollCard.tsx).

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
    <View style={styles.wrap} testID="poll">
      <View style={styles.options}>
        {poll.options.map((option) => {
          const mine = poll.myVote === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: mine, disabled: poll.closed || !user }}
              accessibilityLabel={`${option.text}${option.share !== null ? `, ${option.share} percent` : ''}`}
              disabled={busy || poll.closed || !user}
              testID="poll-option"
              onPress={() => void vote(option.id)}
              style={[styles.option, { borderColor: mine ? theme.primary : theme.border }]}>
              {results && option.share !== null && (
                <View
                  style={[styles.bar, { width: `${option.share}%`, backgroundColor: mine ? theme.primary + '40' : theme.backgroundElement }]}
                />
              )}
              <View style={styles.optionRow}>
                {mine && <Check size={16} color={theme.primaryStrong} />}
                <ThemedText style={styles.optionText}>{option.text}</ThemedText>
                {results && option.share !== null && (
                  <ThemedText themeColor="textSecondary" style={styles.share}>{option.share}%</ThemedText>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <ThemedText themeColor="textSecondary" style={styles.xs}>
        {results ? `${poll.totalVotes} ${poll.totalVotes === 1 ? 'vote' : 'votes'} · ` : ''}
        {remaining(poll.closesAt)}
        {!user ? ' · Sign in to vote' : ''}
      </ThemedText>
      {error ? <ThemedText accessibilityRole="alert" style={[styles.xs, { color: theme.danger }]}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // mt-3 space-y-2
  wrap: { marginTop: 12, gap: 8 },
  options: { gap: 8 },
  // rounded-lg border px-3 py-2 text-sm
  option: { borderWidth: 1, borderRadius: 8, overflow: 'hidden', minHeight: 40, justifyContent: 'center' },
  bar: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  optionText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  share: { fontSize: 14, lineHeight: 20, fontWeight: '400', fontVariant: ['tabular-nums'] },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
});
