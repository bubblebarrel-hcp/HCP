import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { BlockKind } from '@/lib/types';

// Block and mute on somebody else's page (D60). A block works both ways and ends
// any follow; a mute is quiet and one-way. Neither tells the other person.
export function SafetyMenu({
  hasherId,
  name,
  initial,
  onBlocked,
}: {
  hasherId: string;
  name: string;
  initial: BlockKind | null;
  onBlocked?: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const [state, setState] = useState<BlockKind | null>(initial);
  const [busy, setBusy] = useState(false);

  async function set(kind: BlockKind, on: boolean) {
    setBusy(true);
    try {
      await api(`/hashers/${hasherId}/${kind === 'BLOCK' ? 'block' : 'mute'}`, { method: on ? 'PUT' : 'DELETE' });
      setState(on ? kind : null);
      if (on && kind === 'BLOCK') onBlocked?.();
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'Try again.'));
    } finally {
      setBusy(false);
    }
  }

  const button = [styles.button, { borderColor: theme.border }];

  function confirmBlock() {
    Alert.alert(
      `Block ${name}?`,
      'They will not be able to see your posts, reels or photos, follow you, or notify you, and you will not see theirs. Any follow between you ends. They are not told.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => void set('BLOCK', true) },
      ],
    );
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/report/[type]/[id]', params: { type: 'USER', id: hasherId } })}
        style={button}>
        <ThemedText type="smallBold">Report</ThemedText>
      </Pressable>
      {state === 'BLOCK' ? (
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void set('BLOCK', false)} style={button}>
          <ThemedText type="smallBold">Unblock</ThemedText>
        </Pressable>
      ) : (
        <>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void set('MUTE', state !== 'MUTE')} style={button}>
            <ThemedText type="smallBold">{state === 'MUTE' ? 'Unmute' : 'Mute'}</ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={confirmBlock} style={button}>
            <ThemedText type="smallBold" style={{ color: theme.danger }}>Block</ThemedText>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  button: { minHeight: 40, paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: Spacing.two, justifyContent: 'center' },
});
