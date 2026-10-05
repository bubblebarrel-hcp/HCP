import { Pressable, StyleSheet, View } from 'react-native';
import { Globe, Lock, Users } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { Audience } from '@/lib/types';

// Who sees something a hasher made (D57), as the web draws it
// (components/profile/AudiencePicker.tsx): everybody, the people they have let
// follow them, or only themself. Three bordered rows with an icon, the name and
// what it means; the chosen one is ringed in orange.

const ICON = { PUBLIC: Globe, FOLLOWERS: Users, ONLY_ME: Lock } as const;

const LABEL: Record<Audience, string> = { PUBLIC: 'Public', FOLLOWERS: 'Followers', ONLY_ME: 'Only me' };

const HINT: Record<Audience, string> = {
  PUBLIC: 'Anyone on Shiggy Trails, signed in or not, can see your photos, posts and reels.',
  FOLLOWERS: 'Your profile is locked. People ask to follow you, and only the ones you approve see your photos, posts and reels.',
  ONLY_ME: 'Nobody sees them but you, and nobody can follow you.',
};

export function AudiencePicker({
  value,
  onChange,
  disabled,
}: {
  value: Audience;
  onChange: (next: Audience) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const options: Audience[] = ['PUBLIC', 'FOLLOWERS', 'ONLY_ME'];

  return (
    <View accessibilityRole="radiogroup" style={styles.group} testID="audience-profile">
      {options.map((option) => {
        const Icon = ICON[option];
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            testID={`audience-${option.toLowerCase()}`}
            onPress={() => onChange(option)}
            style={[
              styles.option,
              {
                borderColor: selected ? theme.primary : theme.border,
                backgroundColor: selected ? theme.primary + '0d' : 'transparent',
                opacity: disabled ? 0.6 : 1,
              },
            ]}>
            <Icon size={16} color={selected ? theme.primaryStrong : theme.textSecondary} style={styles.icon} />
            <View style={styles.text}>
              <ThemedText style={styles.label}>{LABEL[option]}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.hint}>{HINT[option]}</ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 8, padding: 12 },
  icon: { marginTop: 2 },
  text: { flex: 1, minWidth: 0 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  hint: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
});
