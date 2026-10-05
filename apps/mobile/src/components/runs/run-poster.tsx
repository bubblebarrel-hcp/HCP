import { useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { Camera, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ActionDialog } from '@/components/ui/action-dialog';
import { Button, Card } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { MAX_UPLOAD_BYTES, fileSize, uploadAssetFull } from '@/lib/media';

// The flyer for a run (D43), as the web has it (components/runs/RunPoster.tsx). Kennels
// already make one for WhatsApp; this is where it lives so the feed can carry it, and so
// it sits beside the run's own details rather than instead of them. The picture is an
// ordinary run photo (D28) whose URL is written to `Run.posterUrl`, the same shape
// kennel branding uses (D37).
export function RunPoster({
  runId,
  posterUrl,
  canManage,
  onChanged,
}: {
  runId: string;
  posterUrl: string | null;
  canManage: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);

  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.9 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize !== undefined && asset.fileSize > MAX_UPLOAD_BYTES) {
      Alert.alert(`That flyer is ${fileSize(asset.fileSize)}. Flyers must be 25MB or smaller.`);
      return;
    }
    setBusy(true);
    try {
      const media = await uploadAssetFull(asset, { type: 'RUN', id: runId }, Date.now(), 'Run flyer');
      if (!media.url) throw new Error('Storage did not return an address for that picture');
      await api(`/runs/${runId}`, { method: 'PATCH', body: { posterUrl: media.url } });
      Alert.alert('Flyer added. It will show on the feed.');
      await onChanged();
    } catch (err) {
      Alert.alert('Could not add that flyer', errorMessage(err, 'Could not add that flyer'));
    } finally {
      setBusy(false);
    }
  }

  if (!posterUrl && !canManage) return null;

  return (
    <Card style={styles.card}>
      <View testID="run-poster">
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            accessibilityLabel="Flyer for this run"
            onLoad={(e) => {
              const { width, height } = e.nativeEvent.source;
              if (width && height) setRatio(width / height);
            }}
            // w-full object-contain, capped at 40rem like the web's max-h-[40rem]
            style={[styles.image, { backgroundColor: theme.backgroundElement, aspectRatio: ratio ?? 1 }]}
            resizeMode="contain"
          />
        ) : null}
        {canManage ? (
          <View style={styles.actions}>
            <Button variant="outline" disabled={busy} busy={busy} testID="run-poster-edit" onPress={() => void pick()}>
              <Camera size={16} color={theme.text} />
              <ThemedText style={styles.buttonText}>{posterUrl ? 'Change the flyer' : 'Add the flyer'}</ThemedText>
            </Button>
            {posterUrl ? (
              <ActionDialog
                title="Remove the flyer?"
                description="The run keeps its details and still appears on the feed — just without the picture."
                confirmLabel="Remove it"
                destructive
                onConfirm={async () => {
                  try {
                    await api(`/runs/${runId}`, { method: 'PATCH', body: { posterUrl: null } });
                    await onChanged();
                  } catch (err) {
                    Alert.alert('Could not remove the flyer', errorMessage(err, 'Could not remove the flyer'));
                    throw err;
                  }
                }}
                trigger={(open) => (
                  <Button variant="ghost" testID="run-poster-remove" onPress={open}>
                    <Trash2 size={16} color={theme.danger} />
                    <ThemedText style={[styles.buttonText, { color: theme.danger }]}>Remove</ThemedText>
                  </Button>
                )}
              />
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                The picture your kennel posts to WhatsApp. The run’s own details do the talking without it.
              </ThemedText>
            )}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  image: { width: '100%', maxHeight: 640 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 16 },
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
});
