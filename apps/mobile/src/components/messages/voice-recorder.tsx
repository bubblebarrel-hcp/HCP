import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Mic, Send, Square, Trash2 } from 'lucide-react-native';

import { VoicePlayer } from '@/components/messages/voice-player';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { clockTime, MAX_VOICE_SECONDS } from '@/lib/messages';

// Record a voice note (D73): it starts at once, a tap stops it, you can listen
// back, then send it or bin it. Nothing is uploaded until you send, and the
// microphone is released as soon as it stops. Capped at five minutes, as the
// server is. Voice is mono and light (a minute is about a quarter of a megabyte),
// because it is speech, not music.

const SPEECH = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  sampleRate: 22050,
  bitRate: 32000,
};

export function VoiceRecorder({
  onSend,
  onCancel,
  busy,
}: {
  onSend: (uri: string, durationSec: number) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const theme = useTheme();
  const recorder = useAudioRecorder(SPEECH);
  const [phase, setPhase] = useState<'recording' | 'review'>('recording');
  const [seconds, setSeconds] = useState(0);
  const [take, setTake] = useState<{ uri: string; durationSec: number } | null>(null);
  const startedAt = useRef(0);
  const finished = useRef(false);

  async function stop() {
    if (finished.current) return;
    finished.current = true;
    const durationSec = (Date.now() - startedAt.current) / 1000;
    try {
      await recorder.stop();
    } catch {
      // Already stopped.
    }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    const uri = recorder.uri;
    if (!uri || durationSec < 0.7) {
      Alert.alert('That was too short', 'Hold on a little longer.');
      onCancel();
      return;
    }
    setTake({ uri, durationSec });
    setPhase('review');
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone is off', 'Allow the microphone for Shiggy Trails in your settings to record a voice message.');
        onCancel();
        return;
      }
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (!alive) return;
        startedAt.current = Date.now();
        recorder.record();
      } catch {
        Alert.alert('Could not start recording', 'Try again in a moment.');
        onCancel();
      }
    })();
    return () => {
      alive = false;
      if (!finished.current) {
        finished.current = true;
        void recorder.stop().catch(() => undefined);
        void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      }
    };
    // Starts once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => {
      if (!startedAt.current) return;
      const elapsed = (Date.now() - startedAt.current) / 1000;
      setSeconds(elapsed);
      if (elapsed >= MAX_VOICE_SECONDS) void stop();
    }, 250);
    return () => clearInterval(timer);
    // `stop` closes over nothing that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === 'review' && take) {
    return (
      <View style={[styles.bar, { borderTopColor: theme.border }]} testID="voice-review">
        <Pressable accessibilityRole="button" accessibilityLabel="Discard recording" testID="voice-discard" onPress={onCancel} hitSlop={8}>
          <Trash2 size={22} color={theme.textSecondary} />
        </Pressable>
        <View style={styles.player}>
          <VoicePlayer uri={take.uri} durationSec={take.durationSec} color={theme.text} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send voice message"
          testID="voice-send"
          disabled={busy}
          onPress={() => onSend(take.uri, take.durationSec)}
          style={[styles.round, { backgroundColor: theme.primary, opacity: busy ? 0.6 : 1 }]}>
          <Send size={18} color={theme.onPrimary} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.bar, { borderTopColor: theme.border }]} testID="voice-recording">
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel recording" testID="voice-cancel" onPress={onCancel} hitSlop={8}>
        <Trash2 size={22} color={theme.textSecondary} />
      </Pressable>
      <View style={styles.live}>
        <View style={[styles.dot, { backgroundColor: theme.danger }]} />
        <Mic size={18} color={theme.textSecondary} />
        <ThemedText style={styles.time}>{clockTime(seconds)}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Recording
        </ThemedText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Stop recording"
        testID="voice-stop"
        onPress={() => void stop()}
        style={[styles.round, { backgroundColor: theme.primary }]}>
        <Square size={16} color={theme.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: 1 },
  live: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  player: { flex: 1, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  time: { fontSize: 15, lineHeight: 20 },
  hint: { fontSize: 12, lineHeight: 16 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
