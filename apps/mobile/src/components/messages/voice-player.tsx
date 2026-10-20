import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { clockTime } from '@/lib/messages';

// A voice note in a conversation (D73): play and pause, a bar that shows how far
// it has got, and the time. The length the sender measured wins over the player's
// own, which can be zero until the file has loaded.
export function VoicePlayer({ uri, durationSec, color }: { uri: string; durationSec: number | null; color: string }) {
  // A signed address changes every time the conversation is read again, and a new
  // source stops the player mid-note. Keep the first one; if it has gone stale
  // (it lasts 15 minutes) the note fails to start and a remount picks up a fresh one.
  const [source] = useState(uri);
  const player = useAudioPlayer({ uri: source });
  const status = useAudioPlayerStatus(player);
  const total = durationSec ?? (status.duration > 0 ? status.duration : 0);
  const fraction = total > 0 ? Math.min(1, status.currentTime / total) : 0;
  const shown = status.playing || status.currentTime > 0 ? status.currentTime : total;

  function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    // Played to the end: start again from the top.
    if (status.didJustFinish || (total > 0 && status.currentTime >= total - 0.1)) void player.seekTo(0);
    player.play();
  }

  return (
    <View style={styles.row} testID="voice-message">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'}
        onPress={toggle}
        style={[styles.button, { backgroundColor: 'rgba(127,127,127,0.25)' }]}>
        {status.playing ? <Pause size={16} color={color} /> : <Play size={16} color={color} />}
      </Pressable>
      <View style={styles.main}>
        <View style={[styles.track, { backgroundColor: 'rgba(127,127,127,0.3)' }]}>
          <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
        </View>
        <ThemedText style={[styles.time, { color }]}>{clockTime(shown)}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 220 },
  button: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, gap: 4 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  time: { fontSize: 12, lineHeight: 16, opacity: 0.85 },
});
