import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { EMOJI_GROUPS } from '@/lib/emoji';

// Emoji for the message box (D73). Opens above the keyboard-less composer so it
// never covers the words being replied to; the phone's own emoji keyboard still
// works in the box as ever.
export function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const theme = useTheme();
  const [group, setGroup] = useState(EMOJI_GROUPS[0].id);
  const shown = EMOJI_GROUPS.find((g) => g.id === group)?.emoji ?? [];

  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]} testID="emoji-panel">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
        {EMOJI_GROUPS.map((g) => (
          <Pressable
            key={g.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: group === g.id }}
            accessibilityLabel={g.label}
            onPress={() => setGroup(g.id)}
            style={[styles.tab, group === g.id && { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.tabIcon}>{g.icon}</ThemedText>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView style={styles.grid} contentContainerStyle={styles.gridInner} keyboardShouldPersistTaps="handled">
        {shown.map((emoji, i) => (
          <Pressable key={`${emoji}-${i}`} accessibilityRole="button" accessibilityLabel={emoji} testID="emoji" onPress={() => onPick(emoji)} style={styles.cell}>
            <ThemedText style={styles.emoji}>{emoji}</ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderTopWidth: 1, paddingVertical: 6 },
  tabs: { gap: 4, paddingHorizontal: 8 },
  tab: { width: 40, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 20, lineHeight: 26 },
  grid: { maxHeight: 190 },
  gridInner: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4, paddingTop: 4 },
  cell: { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 26, lineHeight: 34 },
});
