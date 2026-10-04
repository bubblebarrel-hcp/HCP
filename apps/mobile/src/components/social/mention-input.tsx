import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputProps,
  type TextInputSelectionChangeEventData,
  type TextStyle,
} from 'react-native';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { mentionQueryAt } from '@/lib/entities';

// A text box that offers hashers when you type "@" (D59). It is a plain TextInput
// in every other respect: the words stay a string and the API reads the mentions
// out of them, so the picker only saves typing a username by hand. People you
// follow come first, and an empty "@" offers just them.

interface Suggestion {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'style'> & {
  value: string;
  onChangeText: (next: string) => void;
  style?: StyleProp<TextStyle>;
  // Where the list goes: above for a box at the bottom of the screen.
  suggestionsAbove?: boolean;
};

export function MentionInput({ value, onChangeText, style, suggestionsAbove = false, onSelectionChange, ...rest }: Props) {
  const theme = useTheme();
  const caret = useRef(value.length);
  const [trigger, setTrigger] = useState<{ start: number; query: string } | null>(null);
  const [items, setItems] = useState<Suggestion[]>([]);

  const query = trigger?.query;
  const start = trigger?.start;
  useEffect(() => {
    // Nothing is shown without a trigger, so there is nothing to clear here.
    if (query === undefined) return;
    let cancelled = false;
    // A short pause, so typing "@pothole" is one request and not eight.
    const timer = setTimeout(async () => {
      try {
        const data = await api<{ items: Suggestion[] }>(`/mentions/suggest?q=${encodeURIComponent(query)}&limit=5`);
        if (!cancelled) setItems(data.items);
      } catch {
        if (!cancelled) setItems([]);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, start]);

  function choose(item: Suggestion) {
    if (!trigger) return;
    const insert = `@${item.username} `;
    onChangeText(value.slice(0, trigger.start) + insert + value.slice(caret.current));
    caret.current = trigger.start + insert.length;
    setTrigger(null);
    setItems([]);
  }

  const list =
    trigger && items.length > 0 ? (
      <View style={[styles.list, { backgroundColor: theme.card, borderColor: theme.border }]} accessibilityLabel="Hashers to mention">
        {items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`Mention ${item.name}`}
            onPress={() => choose(item)}
            style={styles.item}>
            <Avatar name={item.name} src={item.avatarUrl} size={28} />
            <ThemedText type="smallBold" numberOfLines={1} style={styles.itemName}>
              {item.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">@{item.username}</ThemedText>
          </Pressable>
        ))}
      </View>
    ) : null;

  return (
    <View style={styles.wrap}>
      {suggestionsAbove && list}
      <TextInput
        {...rest}
        value={value}
        style={style}
        onChangeText={(next) => {
          onChangeText(next);
          // The caret is at the end of what was just typed, until the selection
          // event says otherwise.
          if (caret.current >= value.length || caret.current > next.length) caret.current = next.length;
          setTrigger(mentionQueryAt(next, caret.current));
        }}
        onSelectionChange={(event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
          caret.current = event.nativeEvent.selection.end;
          setTrigger(mentionQueryAt(value, caret.current));
          onSelectionChange?.(event);
        }}
      />
      {!suggestionsAbove && list}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { borderWidth: 1, borderRadius: Spacing.two, padding: Spacing.one, marginVertical: Spacing.one },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.two },
  itemName: { flex: 1 },
});
