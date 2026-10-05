import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// The web's `flex min-h-11 items-center gap-3 text-sm` label around a 20px checkbox
// that takes the primary colour (accent-primary).
export function CheckRow({ label, checked, onChange, testID }: { label: string; checked: boolean; onChange: (next: boolean) => void; testID?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      testID={testID}
      onPress={() => onChange(!checked)}
      style={styles.row}>
      <View style={[styles.box, { borderColor: checked ? theme.primary : theme.border, backgroundColor: checked ? theme.primary : 'transparent' }]}>
        {checked ? <Check size={14} color={theme.onPrimary} strokeWidth={3} /> : null}
      </View>
      <ThemedText style={styles.text}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '400' },
});
