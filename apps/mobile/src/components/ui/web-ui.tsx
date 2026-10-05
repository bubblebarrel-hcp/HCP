import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The web app's phone-width primitives (apps/web/components/ui/*), so a native
// screen is built from the same pieces the same page is built from there.
// Tailwind sizes are in px: p-3 = 12, p-5 = 20, p-6 = 24, gap-1.5 = 6, space-y-4 = 16.

/** `Card className={bleedCard}`: edge to edge on a phone, a line above and below. */
export function Card({ children, style, bleed = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; bleed?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        { backgroundColor: theme.card, borderColor: theme.border },
        bleed ? styles.bleed : styles.rounded,
        style,
      ]}>
      {children}
    </View>
  );
}

/** CardHeader: flex-col gap-1.5 p-6. */
export function CardHeader({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.header, style]}>{children}</View>;
}

/** CardTitle: text-lg font-semibold leading-tight. */
export function CardTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <ThemedText accessibilityRole="header" style={[styles.title, style]}>
      {children}
    </ThemedText>
  );
}

/** CardDescription: text-sm text-muted-foreground. */
export function CardDescription({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <ThemedText themeColor="textSecondary" style={[styles.description, style]}>
      {children}
    </ThemedText>
  );
}

/** CardContent: p-6 pt-0. */
export function CardContent({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.content, style]}>{children}</View>;
}

/** Badge: rounded-full border px-2.5 py-0.5 text-xs font-medium. */
export function Badge({
  children,
  tone = 'plain',
  style,
}: {
  children: React.ReactNode;
  tone?: 'plain' | 'primary' | 'accent' | 'muted' | 'soft-primary' | 'soft-accent' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  // The /10 fill and /30 border the web uses for soft tones (hex alpha: 1a = 10%, 4d = 30%).
  const soft = (hex: string) => ({ fill: hex + '1a', border: hex + '4d' });
  const tint =
    tone === 'soft-primary' ? { ...soft(theme.primary), ink: theme.primaryStrong }
    : tone === 'soft-accent' ? { ...soft(theme.accent), ink: theme.accentStrong }
    : tone === 'danger' ? { ...soft(theme.danger), ink: theme.danger }
    : null;
  const fill = tint ? tint.fill : tone === 'primary' ? theme.primary : tone === 'accent' ? theme.accent : undefined;
  const ink = tint ? tint.ink : tone === 'primary' || tone === 'accent' ? '#171717' : tone === 'muted' ? theme.textSecondary : theme.text;
  return (
    <View style={[styles.badge, { borderColor: tint ? tint.border : theme.border, backgroundColor: fill }, style]}>
      <ThemedText style={[styles.badgeText, { color: ink }]}>{children}</ThemedText>
    </View>
  );
}

type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';

/** Button: h-10 px-4 rounded-md text-sm font-semibold (size sm: h-9 px-3). */
export function Button({
  children,
  onPress,
  variant = 'default',
  size = 'default',
  disabled,
  busy,
  style,
  accessibilityLabel,
  testID,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'default' | 'sm' | 'lg';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const theme = useTheme();
  const fills: Record<ButtonVariant, ViewStyle> = {
    default: { backgroundColor: theme.primary },
    secondary: { backgroundColor: theme.backgroundSelected },
    outline: { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
    ghost: {},
    destructive: { backgroundColor: theme.danger },
  };
  const ink = variant === 'default' ? theme.onPrimary : variant === 'destructive' ? '#ffffff' : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled || busy) }}
      testID={testID}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        size === 'lg' && styles.buttonLg,
        fills[variant],
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={ink} />
      ) : typeof children === 'string' ? (
        <ThemedText style={[styles.buttonText, size === 'lg' && { fontSize: 16 }, { color: ink }]}>{children}</ThemedText>
      ) : (
        children
      )}
    </Pressable>
  );
}

/**
 * FeedLayout on a phone: one column, py-4, blocks 16 apart, running edge to
 * edge. `wide` pages (grids, detail) are the same on a phone, so it has no switch.
 */
export function Page({
  children,
  scroll = true,
  gap = 16,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  gap?: number;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="canvas" style={styles.screen}>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.canvas }]} edges={[]}>
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.page, { gap }]} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

/** Label + control + error: the shape every form field on the web has (components/ui/label.tsx Field). */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
      {error ? (
        <ThemedText accessibilityRole="alert" style={[styles.hint, { color: theme.danger }]}>{error}</ThemedText>
      ) : hint ? (
        <ThemedText themeColor="textSecondary" style={styles.hint}>{hint}</ThemedText>
      ) : null}
    </View>
  );
}

/** Input: h-10 rounded-md border bg-background px-3 text-sm. */
export function Input({ style, ...props }: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }, style]}
    />
  );
}

/**
 * The shell of the web's account sub-pages (privacy, blocked, follow requests...):
 * `mx-auto max-w-3xl space-y-6 px-4 py-12`, with a "Back to ..." link above the
 * first card.
 */
export function Subpage({
  back,
  onBack,
  children,
}: {
  back?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.subpage} keyboardShouldPersistTaps="handled">
          {back && onBack ? (
            <Pressable accessibilityRole="link" onPress={onBack} style={styles.backLink}>
              <ThemedText themeColor="textSecondary" style={styles.backText}>← {back}</ThemedText>
            </Pressable>
          ) : null}
          {children}
        </ScrollView>
      </View>
    </ThemedView>
  );
}

/** The pulsing placeholder block web shows while a page loads (h-48 bg-card). */
export function Skeleton({ height = 192 }: { height?: number }) {
  const theme = useTheme();
  return <View accessibilityElementsHidden style={{ height, backgroundColor: theme.card }} />;
}

const styles = StyleSheet.create({
  subpage: { width: '100%', maxWidth: 768, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 48, gap: 24 },
  backLink: { minHeight: 24, justifyContent: 'center' },
  backText: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  field: { gap: 6 },
  label: { fontSize: 14, lineHeight: 14, fontWeight: '500' },
  hint: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  input: { minHeight: 40, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, fontSize: 14 },
  bleed: { borderTopWidth: 1, borderBottomWidth: 1, borderRadius: 0 },
  rounded: { borderWidth: 1, borderRadius: 12 },
  header: { gap: 6, padding: 24 },
  title: { fontSize: 18, lineHeight: 22, fontWeight: '600' },
  description: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  content: { padding: 24, paddingTop: 0 },
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  button: { minHeight: 40, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonSm: { minHeight: 36, paddingHorizontal: 12, paddingVertical: 0 },
  buttonLg: { minHeight: 44, paddingHorizontal: 24 },
  buttonText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32 },
});
