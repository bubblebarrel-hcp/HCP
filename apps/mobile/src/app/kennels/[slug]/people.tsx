import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { HasherRow } from '@/components/profile/follow-lists';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { listKennelFollowers, listKennelRoster } from '@/lib/social';
import type { FollowerRow, Page } from '@/lib/types';

// Who is in a kennel and who follows it, as the web lays it out
// (app/kennels/[slug]/people/page.tsx). Members see the roll of members; anyone
// sees the followers, because following is interest and not belonging (D50).
// Handles and pictures only (D11). The API decides who may see the roll: a
// non-member's request comes back 403 and this screen shows the lock.

type Tab = 'members' | 'followers';

interface List {
  rows: FollowerRow[];
  total: number;
  page: number;
}

const fromPage = (p: Page<FollowerRow>): List => ({ rows: p.items, total: p.total, page: p.page });
const empty: List = { rows: [], total: 0, page: 1 };

export default function KennelPeopleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [picked, setPicked] = useState<Tab | null>(null);
  // `null` is still loading, `'locked'` is a 403: the viewer is not a member.
  const [members, setMembers] = useState<List | 'locked' | null>(null);
  const [followers, setFollowers] = useState<List | null>(null);
  const [more, setMore] = useState<Tab | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    listKennelFollowers(slug)
      .then((p) => alive && setFollowers(fromPage(p)))
      .catch(() => alive && setFollowers(empty));
    // Signed out there is no roll to ask for: `membersState` below shows the lock.
    if (user) {
      listKennelRoster(slug)
        .then((p) => alive && setMembers(fromPage(p)))
        .catch((err) => alive && setMembers(err instanceof ApiError && err.code === 'FORBIDDEN' ? 'locked' : empty));
    }
    return () => {
      alive = false;
    };
  }, [slug, user, authLoading]);

  const loadMore = useCallback(
    async (which: Tab) => {
      const current = which === 'members' ? members : followers;
      if (!current || current === 'locked') return;
      setMore(which);
      try {
        const next = await (which === 'members' ? listKennelRoster : listKennelFollowers)(slug, current.page + 1);
        const merged = { rows: [...current.rows, ...next.items], total: next.total, page: next.page };
        if (which === 'members') setMembers(merged);
        else setFollowers(merged);
      } catch {
        // Leave the rows already shown; pressing again retries.
      } finally {
        setMore(null);
      }
    },
    [slug, members, followers],
  );

  // Members land on the roll; everybody else on the followers.
  const membersState = !authLoading && !user ? 'locked' : members;
  const isMember = membersState !== null && membersState !== 'locked';
  const tab: Tab = picked ?? (isMember ? 'members' : 'followers');
  const active = tab === 'members' ? membersState : followers;
  const count = (list: List | 'locked' | null) => (list && list !== 'locked' ? `${list.total} ` : '');

  const tabButton = (which: Tab, label: string, list: List | 'locked' | null) => (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: tab === which }}
      testID={`people-tab-${which}`}
      onPress={() => setPicked(which)}
      style={[styles.tab, { borderBottomColor: tab === which ? theme.primary : 'transparent' }]}>
      <ThemedText
        style={[styles.tabText, { color: tab === which ? theme.primaryStrong : theme.textSecondary }]}>
        {count(list)}{label}
      </ThemedText>
    </Pressable>
  );

  return (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page}>
          <Card style={styles.intro}>
            <Pressable accessibilityRole="link" onPress={() => router.back()} style={styles.backLink}>
              <ArrowLeft size={16} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.backText}>Back to kennel</ThemedText>
            </Pressable>
            <ThemedText accessibilityRole="header" style={styles.h1}>People</ThemedText>
          </Card>

          <Card style={styles.box}>
            <View testID="kennel-people" accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: theme.border }]}>
              {tabButton('members', 'Members', membersState)}
              {tabButton('followers', 'Followers', followers)}
            </View>

            {active === null ? (
              <ThemedText themeColor="textSecondary" style={styles.message}>Loading…</ThemedText>
            ) : active === 'locked' ? (
              <View style={styles.locked} testID="members-locked">
                <Lock size={20} color={theme.textSecondary} />
                <View style={styles.lockedText}>
                  <ThemedText style={styles.lockedTitle}>Only members can see who belongs to this kennel.</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.sm}>
                    {user ? 'Ask to join from the kennel page.' : 'Sign in, and join the kennel, to see its members.'}
                  </ThemedText>
                </View>
              </View>
            ) : active.rows.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.message} testID="people-empty">
                {tab === 'members' ? 'No active members yet.' : 'Nobody follows this kennel yet.'}
              </ThemedText>
            ) : (
              <View testID={`people-${tab}`}>
                {active.rows.map((hasher, index) => (
                  <View
                    key={hasher.id}
                    style={index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }}>
                    <HasherRow hasher={hasher} />
                  </View>
                ))}
                {active.rows.length < active.total && (
                  <View style={[styles.more, { borderTopColor: theme.border }]}>
                    <Button variant="outline" size="sm" disabled={more === tab} onPress={() => loadMore(tab)}>
                      {more === tab ? 'Loading…' : 'Show more'}
                    </Button>
                  </View>
                )}
              </View>
            )}
          </Card>
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
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  h1: { marginTop: 8, fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  box: { overflow: 'hidden' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, paddingHorizontal: 16, paddingVertical: 12 },
  tabText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  message: { padding: 16, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  locked: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 24 },
  lockedText: { flex: 1 },
  lockedTitle: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  sm: { marginTop: 4, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  more: { alignItems: 'center', borderTopWidth: 1, padding: 12 },
});
