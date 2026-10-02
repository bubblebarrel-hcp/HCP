import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Audience } from '@/lib/types';

// Who may see one post or reel (D57): everybody, the people the author has let
// follow them, or only the author. It can narrow the author's profile and never
// widen it. Shown to the author alone, on the screen for the thing itself.

const OPTIONS: { value: Audience; label: string; hint: string }[] = [
  { value: 'PUBLIC', label: 'Public', hint: 'Anyone can see it.' },
  { value: 'FOLLOWERS', label: 'Followers', hint: 'Only people who follow you.' },
  { value: 'ONLY_ME', label: 'Only me', hint: 'Only you.' },
];

export function AudienceChips({
  value,
  onChange,
  disabled,
  what,
}: {
  value: Audience;
  onChange: (next: Audience) => void;
  disabled?: boolean;
  // "post" or "reel", for the accessible label.
  what: string;
}) {
  const theme = useTheme();
  const current = OPTIONS.find((option) => option.value === value);
  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold" themeColor="textSecondary">Who can see this {what}</ThemedText>
      <View style={styles.row} accessibilityRole="radiogroup">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={`${option.label}. ${option.hint}`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[
                styles.chip,
                {
                  borderColor: selected ? theme.primary : theme.border,
                  backgroundColor: theme.card,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.primaryStrong : theme.textSecondary }}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {current && <ThemedText type="small" themeColor="textSecondary">{current.hint}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    minHeight: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
