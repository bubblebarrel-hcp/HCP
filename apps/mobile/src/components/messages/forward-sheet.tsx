import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';
import { forwardMessages, listConversations, type ConversationSummary } from '@/lib/messages';

// Passing messages on (D71), as the web has it (components/messages/ForwardDialog.tsx).
// Only into conversations already open, because a forward is an ordinary send and
// meets the same rules. Up to five at a time.

const MAX_TARGETS = 5;

export function ForwardSheet({
  fromId,
  messageIds,
  onClose,
  onDone,
}: {
  fromId: string;
  // Empty means closed.
  messageIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const open = messageIds.length > 0;
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicked([]);
    setItems(null);
    listConversations('inbox', 1, 50)
      .then((page) => alive && setItems(page.items.filter((c) => c.id !== fromId && c.status === 'ACTIVE')))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [open, fromId]);

  const toggle = (id: string) =>
    setPicked((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length >= MAX_TARGETS ? current : [...current, id]));

  async function send() {
    if (!picked.length || busy) return;
    setBusy(true);
    try {
      const results = await forwardMessages(fromId, messageIds, picked);
      const failed = results.filter((r) => r.error);
      if (failed.length) Alert.alert('Not everything went', failed[0].error!.message);
      // Anything that went through closes the sheet; if all of it failed, stay and let them choose again.
      if (failed.length < results.length) onDone();
    } catch (err) {
      Alert.alert('Could not forward that', errorMessage(err, 'Try again'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.scrim}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]} testID="forward-dialog">
          <ThemedText style={styles.title}>{messageIds.length === 1 ? 'Forward message' : `Forward ${messageIds.length} messages`}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.small}>
            Pick up to {MAX_TARGETS} conversations.
          </ThemedText>
          {items === null ? (
            <ActivityIndicator style={styles.pad} color={theme.primary} />
          ) : items.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={[styles.small, styles.pad]}>
              You have no other open conversations to forward into.
            </ThemedText>
          ) : (
            <ScrollView style={styles.list}>
              {items.map((c) => {
                const name = c.other?.displayName ?? 'Deleted hasher';
                const on = picked.includes(c.id);
                return (
                  <Pressable key={c.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} testID="forward-target" onPress={() => toggle(c.id)} style={styles.row}>
                    <Avatar name={name} size={36} src={c.other?.avatarUrl} />
                    <ThemedText numberOfLines={1} style={styles.name}>
                      {name}
                    </ThemedText>
                    <View style={[styles.check, { borderColor: on ? theme.primary : theme.border, backgroundColor: on ? theme.primary : 'transparent' }]}>
                      {on && <Check size={14} color={theme.onPrimary} />}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <View style={styles.actions}>
            <Button variant="ghost" onPress={onClose}>
              Cancel
            </Button>
            <Button testID="forward-send" disabled={!picked.length || busy} onPress={() => void send()}>
              {busy ? 'Sending…' : `Send${picked.length ? ` (${picked.length})` : ''}`}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  fill: { flex: 1 },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, paddingBottom: 32, gap: 8, maxHeight: '75%' },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  small: { fontSize: 14, lineHeight: 20 },
  pad: { paddingVertical: 24 },
  list: { marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  name: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
