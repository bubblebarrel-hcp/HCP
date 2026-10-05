import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// The web's <select> (components/ui/input.tsx Select): an input-shaped box showing
// the chosen option with a chevron; the list opens in a sheet.
export function Select({
  value,
  onChange,
  options,
  testID,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  testID?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        accessibilityRole="combobox"
        testID={testID}
        onPress={() => setOpen(true)}
        style={[styles.box, { borderColor: theme.border, backgroundColor: theme.background }]}>
        <ThemedText style={styles.value}>{current?.label ?? ''}</ThemedText>
        <ChevronDown size={16} color={theme.textSecondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ScrollView>
              {options.map((option, index) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="menuitem"
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={[styles.option, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                  <ThemedText style={styles.value}>{option.label}</ThemedText>
                  {option.value === value && <Check size={16} color={theme.primaryStrong} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  box: { minHeight: 40, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { maxHeight: '70%', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  option: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
