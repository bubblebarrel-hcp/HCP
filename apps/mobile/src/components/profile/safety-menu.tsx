import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { BellOff, Flag, ShieldBan } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ActionDialog } from '@/components/ui/action-dialog';
import { Button } from '@/components/ui/web-ui';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { BlockKind, HasherProfile } from '@/lib/types';

// Block and mute on somebody else's page (D60), as the web has it
// (components/profile/SafetyMenu.tsx): Report, then Mute and Block, or Unblock.
// A block works both ways and ends any follow; a mute is quiet and one-way.
// Neither tells the other person. Where the viewer stands is asked for here.
export function SafetyMenu({ hasherId, name }: { hasherId: string; name: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [state, setState] = useState<BlockKind | null>(null);
  const [known, setKnown] = useState(false);

  useEffect(() => {
    if (!user || user.id === hasherId) return;
    let alive = true;
    api<{ hasher: HasherProfile }>(`/hashers/${hasherId}`)
      .then((data) => {
        if (!alive) return;
        setState(data.hasher.myBlock ?? null);
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
      await api(`/hashers/${hasherId}/${kind === 'BLOCK' ? 'block' : 'mute'}`, { method: on ? 'PUT' : 'DELETE' });
      setState(on ? kind : null);
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
      throw err;
    }
  }

  return (
    <View style={styles.row} testID="safety-menu">
      <Button
        variant="outline"
        size="sm"
        testID="report-hasher"
        onPress={() => router.push({ pathname: '/report/[type]/[id]', params: { type: 'USER', id: hasherId } })}>
        <Flag size={16} color={theme.text} />
        <ThemedText style={styles.label}>Report</ThemedText>
      </Button>
      {state === 'BLOCK' ? (
        <Button variant="outline" size="sm" testID="unblock" onPress={() => void set('BLOCK', false).catch(() => undefined)}>
          <ShieldBan size={16} color={theme.text} />
          <ThemedText style={styles.label}>Unblock</ThemedText>
        </Button>
      ) : (
        <>
          <Button variant="outline" size="sm" testID="mute-toggle" onPress={() => void set('MUTE', state !== 'MUTE').catch(() => undefined)}>
            <BellOff size={16} color={theme.text} />
            <ThemedText style={styles.label}>{state === 'MUTE' ? 'Unmute' : 'Mute'}</ThemedText>
          </Button>
          <ActionDialog
            title={`Block ${name}?`}
            description="They will not be able to see your posts, reels or photos, follow you, or notify you, and you will not see theirs. Any follow between you ends. They are not told."
            confirmLabel="Block"
            destructive
            onConfirm={() => set('BLOCK', true)}
            trigger={(open) => (
              <Button variant="outline" size="sm" testID="block-open" onPress={open}>
                <ShieldBan size={16} color={theme.text} />
                <ThemedText style={styles.label}>Block</ThemedText>
              </Button>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // mt-3 flex flex-wrap gap-2
  row: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
