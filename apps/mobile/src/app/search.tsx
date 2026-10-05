import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BookOpen, Camera, Footprints, Hash, MapPin, Users, type LucideIcon } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { KennelCard } from '@/components/kennel-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Input } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { brandColor, formatDate, formatRunDate } from '@/lib/format';
import type { SearchResults } from '@/lib/types';

// Search, as the web app lays it out on a phone (app/search/page.tsx): a header
// card with the box and the result count, then one bleed card per kind of hit.

function Section({ title, icon: Icon, count, children }: { title: string; icon: LucideIcon; count: number; children: React.ReactNode }) {
  const theme = useTheme();
  if (count === 0) return null;
  return (
    <Card style={styles.section}>
      <View style={styles.sectionTitle}>
        <Icon size={16} color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>{title.toUpperCase()}</ThemedText>
      </View>
      <View style={styles.hits}>{children}</View>
    </Card>
  );
}

function Hit({
  onPress,
  title,
  subtitle,
  avatarName,
  avatarColor,
}: {
  onPress: () => void;
  title: string;
  subtitle?: string;
  avatarName: string;
  avatarColor?: string | null;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      testID="search-hit"
      onPress={onPress}
      style={({ pressed }) => [styles.hit, pressed && { backgroundColor: theme.backgroundElement }]}>
      <Avatar name={avatarName} size={36} color={brandColor(avatarColor)} />
      <View style={styles.hitText}>
        <ThemedText numberOfLines={1} style={styles.hitTitle}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.hitSub}>{subtitle}</ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [draft, setDraft] = useState(params.q ?? '');
  const [query, setQuery] = useState((params.q ?? '').trim());
  const [data, setData] = useState<SearchResults | null>(null);

  useEffect(() => {
    if (!query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      return;
    }
    let alive = true;
    api<SearchResults>(`/search?q=${encodeURIComponent(query)}&limit=8`)
      .then((result) => alive && setData(result))
      .catch(() => alive && setData({ query, kennels: [], runs: [], reports: [], hashers: [], capsules: [], tags: [], total: 0 }));
    return () => {
      alive = false;
    };
  }, [query]);

  function submit() {
    setData(null);
    setQuery(draft.trim());
  }

  const dashed = [styles.dashed, { backgroundColor: theme.card, borderColor: theme.border }];

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Card style={styles.intro}>
            <ThemedText accessibilityRole="header" style={styles.h1}>Search</ThemedText>
            <View style={styles.form}>
              <Input
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={submit}
                returnKeyType="search"
                placeholder="Kennels, runs, reports, hashers, #tags…"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search Shiggy Trails"
                testID="search-input"
                style={styles.input}
              />
              <Button onPress={submit}>Search</Button>
            </View>
            {query && data ? (
              <ThemedText themeColor="textSecondary" style={styles.total} testID="search-total">
                {data.total} {data.total === 1 ? 'result' : 'results'} for “{data.query}”
              </ThemedText>
            ) : null}
          </Card>

          {!query ? (
            <View style={dashed}>
              <ThemedText themeColor="textSecondary" style={styles.dashedText}>
                Search across kennels, runs, trail reports, hashers and Run Capsules.
              </ThemedText>
            </View>
          ) : data && data.total === 0 ? (
            <View style={dashed} testID="search-empty">
              <ThemedText themeColor="textSecondary" style={styles.dashedText}>Nothing matches “{query}” yet.</ThemedText>
            </View>
          ) : data ? (
            <>
              {data.kennels.length > 0 && (
                <Card style={styles.section}>
                  <View style={styles.sectionTitle}>
                    <MapPin size={16} color={theme.textSecondary} />
                    <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>KENNELS</ThemedText>
                  </View>
                  <View style={styles.kennels}>
                    {data.kennels.map((k) => (
                      <KennelCard key={k.id} kennel={k} />
                    ))}
                  </View>
                </Card>
              )}

              <Section title="Hashtags" icon={Hash} count={data.tags.length}>
                {data.tags.map((t) => (
                  <Hit
                    key={t.tag}
                    onPress={() => router.push(`/tags/${encodeURIComponent(t.tag)}`)}
                    title={`#${t.tag}`}
                    subtitle={`${t.count} ${t.count === 1 ? 'use' : 'uses'}`}
                    avatarName="#"
                  />
                ))}
              </Section>

              <Section title="Runs" icon={Footprints} count={data.runs.length}>
                {data.runs.map((r) => (
                  <Hit
                    key={r.id}
                    onPress={() => router.push(`/run/${r.id}`)}
                    title={`#${r.runNumber} · ${r.title}`}
                    subtitle={`${r.kennel.shortName} · ${formatRunDate(r.startsAt, r.timeZone)}`}
                    avatarName={r.kennel.shortName}
                    avatarColor={r.kennel.primaryColor}
                  />
                ))}
              </Section>

              <Section title="Trail reports" icon={BookOpen} count={data.reports.length}>
                {data.reports.map((r) => (
                  <Hit
                    key={r.id}
                    onPress={() => router.push(`/trail-reports/${r.id}` as never)}
                    title={r.title}
                    subtitle={`${r.run.kennel.shortName} · Run #${r.run.runNumber} · ${formatDate(r.publishedAt)}`}
                    avatarName={r.run.kennel.shortName}
                    avatarColor={r.run.kennel.primaryColor}
                  />
                ))}
              </Section>

              <Section title="Hashers" icon={Users} count={data.hashers.length}>
                {data.hashers.map((h) => (
                  <Hit
                    key={h.id}
                    onPress={() => router.push(`/hashers/${h.id}`)}
                    title={h.name}
                    subtitle={[h.username && `@${h.username}`, h.homeKennel?.shortName].filter(Boolean).join(' · ') || undefined}
                    avatarName={h.name}
                  />
                ))}
              </Section>

              <Section title="Run Capsules" icon={Camera} count={data.capsules.length}>
                {data.capsules.map((c) => (
                  <Hit
                    key={c.id}
                    onPress={() => router.push(`/capsules/${c.id}` as never)}
                    title={`#${c.run.runNumber} · ${c.run.title}`}
                    subtitle={c.summary ?? `${c.run.kennel.shortName} · ${formatDate(c.run.startsAt)}`}
                    avatarName={c.run.kennel.shortName}
                    avatarColor={c.run.kennel.primaryColor}
                  />
                ))}
              </Section>
            </>
          ) : null}
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  intro: { padding: 20 },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  form: { marginTop: 12, flexDirection: 'row', gap: 8 },
  input: { flex: 1 },
  total: { marginTop: 12, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  dashed: { borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', padding: 40, alignItems: 'center' },
  dashedText: { textAlign: 'center', fontSize: 16, lineHeight: 24, fontWeight: '400' },
  section: { padding: 16 },
  sectionTitle: { marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 0.7 },
  hits: { gap: 8 },
  kennels: { gap: 12 },
  hit: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 6 },
  hitText: { flex: 1, minWidth: 0 },
  hitTitle: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  hitSub: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
});
