import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { BadgeCheck, CalendarDays, Clock, MapPin, Users } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { JoinKennelButton } from '@/components/membership/join-kennel-button';
import { Branding } from '@/components/profile/branding';
import { RunCard } from '@/components/runs/run-card';
import { FollowButton } from '@/components/social/follow-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { verificationLabels } from '@/lib/format';
import type { KennelDetail, Page, RunSummary } from '@/lib/types';

// A kennel, as the web app lays it out on a phone (app/kennels/[slug]/page.tsx):
// cover, picture, name and the follow / join buttons, a row of sections, then
// Intro, Mismanagement, About and Upcoming runs. Following is not joining (D50):
// no membership, no vote, no authority.

export default function KennelDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useAuth();
  const [kennel, setKennel] = useState<KennelDetail | null>(null);
  const [runs, setRuns] = useState<Page<RunSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;
    api<{ kennel: KennelDetail }>(`/kennels/${encodeURIComponent(slug)}`)
      .then((data) => alive && (setKennel(data.kennel), setError(null)))
      .catch((err) => alive && setError(errorMessage(err, 'Kennel not found')));
    api<Page<RunSummary>>(`/kennels/${encodeURIComponent(slug)}/runs?scope=upcoming&limit=3`)
      .then((data) => alive && setRuns(data))
      .catch(() => alive && setRuns(null));
    return () => {
      alive = false;
    };
  }, [slug, user, round]);

  if (error) {
    return (
      <ThemedView type="canvas" style={styles.screen}>
        <View style={styles.safe}>
          <View style={styles.page}>
            <Card style={styles.notFound}>
              <ThemedText style={styles.semibold}>{error}</ThemedText>
              <Button variant="outline" style={styles.back} onPress={() => router.replace('/kennels')}>
                Back to kennels
              </Button>
            </Card>
          </View>
        </View>
      </ThemedView>
    );
  }

  if (!kennel) {
    return (
      <ThemedView type="canvas" style={styles.screen}>
        <View style={styles.safe}>
          <View style={styles.page}>
            <Skeleton height={384} />
          </View>
        </View>
      </ThemedView>
    );
  }

  const verified = kennel.verificationLevel !== 'PENDING';
  const icon = theme.textSecondary;

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.primary}
              onRefresh={() => {
                setRefreshing(true);
                setRound((n) => n + 1);
                setTimeout(() => setRefreshing(false), 600);
              }}
            />
          }>
          {/* Page header, Facebook Page style: cover, picture, name, action, tabs */}
          <View style={[styles.top, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <Branding
              name={kennel.shortName}
              color={kennel.primaryColor}
              avatarUrl={kennel.logoUrl}
              bannerUrl={kennel.bannerUrl}
              bannerPosition={kennel.bannerPosition}
              edit={{ kind: 'kennel', id: kennel.id, slug: kennel.slug, shortName: kennel.shortName }}
              onChanged={() => setRound((n) => n + 1)}>
              <View style={styles.nameBlock}>
                <ThemedText accessibilityRole="header" testID="kennel-name" style={styles.h1}>{kennel.name}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.sub}>
                  {kennel.activeMemberCount} {kennel.activeMemberCount === 1 ? 'member' : 'members'}
                  {kennel.followerCount > 0 && ` · ${kennel.followerCount} ${kennel.followerCount === 1 ? 'follower' : 'followers'}`}
                  {' '}· {kennel.city}, {kennel.country}
                </ThemedText>
                {verified && (
                  <View style={styles.verified}>
                    <BadgeCheck size={16} color={theme.primaryStrong} />
                    <ThemedText style={[styles.verifiedText, { color: theme.primaryStrong }]}>
                      {verificationLabels[kennel.verificationLevel]}
                    </ThemedText>
                  </View>
                )}
              </View>
              <View style={styles.actions}>
                {/* Following is not joining (D50): no membership, no vote, no
                    authority, just this kennel's runs in your feed. */}
                <FollowButton kind="kennel" target={kennel.slug} initialFollowers={kennel.followerCount} showCount={false} />
                <JoinKennelButton slug={kennel.slug} shortName={kennel.shortName} />
              </View>
            </Branding>

            <View accessibilityRole="tablist" style={[styles.tabs, { borderTopColor: theme.border }]}>
              <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={styles.tab}>
                <ThemedText style={[styles.tabText, { color: theme.primaryStrong }]}>About</ThemedText>
                <View style={[styles.tabBar, { backgroundColor: theme.primary }]} />
              </View>
              <Pressable
                accessibilityRole="tab"
                testID="kennel-tab-runs"
                onPress={() => router.push(`/kennels/${kennel.slug}/runs` as never)}
                style={styles.tab}>
                <ThemedText style={[styles.tabText, { color: theme.textSecondary }]}>Runs</ThemedText>
              </Pressable>
              <View accessibilityState={{ disabled: true }} style={styles.tab}>
                <ThemedText style={[styles.tabText, { color: theme.textSecondary, opacity: 0.6 }]}>Trail reports</ThemedText>
              </View>
              <View accessibilityState={{ disabled: true }} style={styles.tab}>
                <ThemedText style={[styles.tabText, { color: theme.textSecondary, opacity: 0.6 }]}>Photos</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.grid}>
            <Card>
              <CardHeader style={styles.headerTight}>
                <CardTitle>Intro</CardTitle>
              </CardHeader>
              <CardContent style={styles.introBody}>
                {kennel.motto ? <ThemedText style={styles.motto}>“{kennel.motto}”</ThemedText> : null}
                <View style={styles.facts}>
                  <View style={styles.fact}>
                    <MapPin size={20} color={icon} />
                    <ThemedText style={styles.factText}>
                      {kennel.city}, {kennel.stateProvince}, {kennel.country}
                    </ThemedText>
                  </View>
                  <View style={styles.fact}>
                    <CalendarDays size={20} color={icon} />
                    <ThemedText style={styles.factText}>Runs on {kennel.meetingDay ?? 'varying days'}</ThemedText>
                  </View>
                  <View style={styles.fact}>
                    <Users size={20} color={icon} />
                    <ThemedText style={styles.factText}>
                      {kennel.activeMemberCount} active {kennel.activeMemberCount === 1 ? 'member' : 'members'}
                    </ThemedText>
                  </View>
                  <View style={styles.fact}>
                    <Clock size={20} color={icon} />
                    <ThemedText style={styles.factText}>{kennel.timeZone}</ThemedText>
                  </View>
                </View>
              </CardContent>
            </Card>

            <Card>
              <CardHeader style={styles.headerTight}>
                <CardTitle>Mismanagement</CardTitle>
              </CardHeader>
              <CardContent>
                {kennel.officers.length === 0 ? (
                  <ThemedText themeColor="textSecondary" style={styles.sm}>No officers listed yet.</ThemedText>
                ) : (
                  <View testID="officer-list" style={styles.officers}>
                    {kennel.officers.map((o) => (
                      <View key={o.title} style={styles.officer}>
                        <Avatar name={o.name} size={36} src={o.avatarUrl} />
                        <View style={styles.officerText}>
                          <ThemedText numberOfLines={1} style={styles.officerName}>{o.name}</ThemedText>
                          <ThemedText themeColor="textSecondary" style={styles.sm}>{o.title}</ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader style={styles.headerTight}>
                <CardTitle>About the kennel</CardTitle>
              </CardHeader>
              <CardContent style={styles.aboutBody}>
                <ThemedText style={styles.description}>{kennel.description}</ThemedText>
                {kennel.landingMessage ? (
                  <View style={[styles.landing, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.sm}>{kennel.landingMessage}</ThemedText>
                  </View>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <View testID="kennel-upcoming-runs">
                <CardHeader style={[styles.headerTight, styles.runsHeader]}>
                  <CardTitle>Upcoming runs</CardTitle>
                  <Pressable accessibilityRole="link" onPress={() => router.push(`/kennels/${kennel.slug}/runs` as never)}>
                    <ThemedText style={[styles.link, { color: theme.primaryStrong }]}>All runs</ThemedText>
                  </Pressable>
                </CardHeader>
                <CardContent>
                  {runs && runs.items.length > 0 ? (
                    <View style={styles.runList}>
                      {runs.items.map((run) => (
                        <RunCard key={run.id} run={run} variant="row" showKennel={false} />
                      ))}
                    </View>
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.sm}>
                      No public runs scheduled. Members may see more on the runs page.
                    </ThemedText>
                  )}
                </CardContent>
              </View>
            </Card>
          </View>
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16 },
  scroll: { paddingBottom: 32 },
  notFound: { padding: 32, alignItems: 'center' },
  semibold: { fontWeight: '600' },
  back: { marginTop: 16 },
  top: { borderBottomWidth: 1 },
  nameBlock: { alignItems: 'center' },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6, textAlign: 'center' },
  sub: { marginTop: 4, fontSize: 16, lineHeight: 24, fontWeight: '400', textAlign: 'center' },
  verified: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  actions: { width: '100%', alignItems: 'center', gap: 8 },
  tabs: { flexDirection: 'row', borderTopWidth: 1, paddingHorizontal: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 14, minHeight: 44, justifyContent: 'center' },
  tabText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  tabBar: { position: 'absolute', left: 8, right: 8, bottom: 0, height: 3, borderRadius: 999 },
  grid: { paddingVertical: 16, gap: 16 },
  headerTight: { paddingBottom: 12 },
  introBody: { gap: 12 },
  motto: { textAlign: 'center', fontSize: 15, lineHeight: 22, fontStyle: 'italic', fontWeight: '400' },
  facts: { gap: 12 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  factText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  officers: { gap: 12 },
  officer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  officerText: { flex: 1, minWidth: 0 },
  officerName: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  aboutBody: { gap: 16 },
  description: { fontSize: 16, lineHeight: 26, fontWeight: '400' },
  landing: { borderRadius: 8, padding: 16 },
  runsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  link: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  runList: { gap: 12 },
});
