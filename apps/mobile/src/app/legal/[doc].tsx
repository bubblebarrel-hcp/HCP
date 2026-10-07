import { useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';
import { LEGAL_DOCS, LEGAL_EFFECTIVE_DATE } from '@/lib/legal';
import { setLegalAccepted, useLegalConsent } from '@/lib/legal-consent';

// How close to the bottom (px) counts as having reached the end.
const END_TOLERANCE = 24;

// The sign-up reader: the whole document, and an accept button that stays
// disabled until it has been scrolled to the end.
export default function LegalReaderScreen() {
  const { doc: slug } = useLocalSearchParams<{ doc: string }>();
  const doc = slug === 'privacy' ? LEGAL_DOCS.privacy : LEGAL_DOCS.terms;
  const theme = useTheme();
  const router = useRouter();
  const consent = useLegalConsent();
  const already = consent[doc.slug];
  const [reachedEnd, setReachedEnd] = useState(false);
  const canAccept = already || reachedEnd;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - END_TOLERANCE) setReachedEnd(true);
  }

  function accept() {
    setLegalAccepted(doc.slug, true);
    router.back();
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        testID={`legal-scroll-${doc.slug}`}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={64}
        // A document shorter than the screen never fires a scroll: treat it as read.
        onContentSizeChange={(_, h) => {
          if (h < 400) setReachedEnd(true);
        }}>
        <ThemedText style={styles.title}>{doc.title}</ThemedText>
        <ThemedText style={[styles.small, { color: theme.textSecondary }]}>Effective {LEGAL_EFFECTIVE_DATE}</ThemedText>
        <ThemedText style={styles.summary}>{doc.summary}</ThemedText>
        {doc.sections.map((section, i) => (
          <View key={section.id} style={styles.section}>
            <ThemedText style={styles.heading}>
              {i + 1}. {section.heading}
            </ThemedText>
            {section.body.map((block, j) =>
              typeof block === 'string' ? (
                <ThemedText key={j} style={styles.p}>
                  {block}
                </ThemedText>
              ) : (
                <View key={j} style={styles.list}>
                  {block.list.map((item, k) => (
                    <ThemedText key={k} style={styles.p}>
                      {'•'} {item}
                    </ThemedText>
                  ))}
                </View>
              ),
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
        {!canAccept ? <ThemedText style={[styles.small, styles.hint, { color: theme.textSecondary }]}>Scroll to the end to accept</ThemedText> : null}
        <Button size="lg" disabled={!canAccept} onPress={already ? () => router.back() : accept} testID={`legal-accept-${doc.slug}`}>
          {already ? 'Accepted' : 'I have read and accept'}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 8 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  small: { fontSize: 12, lineHeight: 16 },
  summary: { fontSize: 15, lineHeight: 22, fontWeight: '500', marginTop: 4 },
  section: { marginTop: 18, gap: 8 },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  p: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  list: { gap: 6, paddingLeft: 8 },
  footer: { padding: 16, borderTopWidth: 1, gap: 8 },
  hint: { textAlign: 'center' },
});
