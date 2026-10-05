import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// The web's <input type="date"> and <input type="datetime-local">: an input-shaped box
// that shows the chosen value and opens the system picker. The value is the same text
// the web form holds ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm", the run's own wall clock),
// so it goes to the API untouched.
const pad = (n: number) => String(n).padStart(2, '0');

function parse(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
}

function format(date: Date, withTime: boolean) {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return withTime ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}

function show(value: string, withTime: boolean) {
  if (!value) return withTime ? 'Choose date and time' : 'Choose a date';
  const d = parse(value);
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return withTime ? `${day}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}

export function DateField({
  value,
  onChange,
  withTime = false,
  maximumDate,
  testID,
}: {
  value: string;
  onChange: (next: string) => void;
  withTime?: boolean;
  maximumDate?: Date;
  testID?: string;
}) {
  const theme = useTheme();
  // Android shows one dialog per step (date, then time); iOS shows both inline.
  const [step, setStep] = useState<'closed' | 'date' | 'time'>('closed');
  const current = parse(value);

  function change(event: DateTimePickerEvent, picked?: Date) {
    if (event.type === 'dismissed' || !picked) {
      setStep('closed');
      return;
    }
    if (Platform.OS === 'android') {
      if (step === 'date' && withTime) {
        const next = new Date(current);
        next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
        onChange(format(next, true));
        setStep('time');
        return;
      }
      if (step === 'time') {
        const next = new Date(current);
        next.setHours(picked.getHours(), picked.getMinutes());
        onChange(format(next, true));
      } else {
        onChange(format(picked, withTime));
      }
      setStep('closed');
      return;
    }
    onChange(format(picked, withTime));
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        testID={testID}
        onPress={() => setStep(step === 'closed' ? 'date' : 'closed')}
        style={[styles.box, { borderColor: theme.border, backgroundColor: theme.background }]}>
        <ThemedText style={[styles.text, !value && { color: theme.textSecondary }]}>{show(value, withTime)}</ThemedText>
        <CalendarDays size={16} color={theme.textSecondary} />
      </Pressable>
      {step !== 'closed' && (
        <DateTimePicker
          value={current}
          mode={Platform.OS === 'android' ? (step === 'time' ? 'time' : 'date') : withTime ? 'datetime' : 'date'}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={maximumDate}
          onChange={change}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // h-10 rounded-md border px-3 text-sm
  box: { minHeight: 40, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
});
