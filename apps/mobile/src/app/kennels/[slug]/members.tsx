import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { InvitationsPanel } from '@/components/membership/invitations-panel';
import { MemberCard } from '@/components/membership/member-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import type { KennelMember, MembershipStatus, MembershipViewer, OfficerPosition, Page, PositionsResponse } from '@/lib/types';

// The kennel's roll, as the web lays it out (app/kennels/[slug]/members/page.tsx): a
// header card with the way back and a search, the invitations panel, the status tabs,
// then a card per member with the decisions the viewer may make.
const tabs: { status: MembershipStatus; label: string; empty: string }[] = [
  { status: 'PENDING_REVIEW', label: 'Requests', empty: 'No requests waiting.' },
  { status: 'ACTIVE', label: 'Members', empty: 'No active members yet.' },
  { status: 'SUSPENDED', label: 'Suspended', empty: 'Nobody is suspended.' },
  { status: 'REJECTED', label: 'Not approved', empty: 'No declined requests.' },
  { status: 'WITHDRAWN', label: 'Withdrawn', empty: 'No requests have been withdrawn.' },
  { status: 'RESIGNED', label: 'Left', empty: 'Nobody has left the kennel.' },
  { status: 'REMOVED', label: 'Removed', empty: 'Nobody has been removed.' },
];

const PAGE_SIZE = 20;

export default function KennelMembersScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [viewer, setViewer] = useState<MembershipViewer | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [status, setStatus] = useState<MembershipStatus>('PENDING_REVIEW');
  const [pageNum, setPageNum] = useState(1);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [list, setList] = useState<Page<KennelMember> | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  // The offices this kennel has defined, so a member can be given one without leaving the
  // roll. Stays empty for a viewer who may not appoint.
  const [positions, setPositions] = useState<OfficerPosition[]>([]);
  const [roleTitles, setRoleTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  const loadViewer = useCallback(async () => {
    try {
      setViewer(await api<MembershipViewer>(`/kennels/${encodeURIComponent(slug)}/membership`));
      setViewerError(null);
    } catch (err) {
      setViewerError(errorMessage(err, 'Could not load this kennel'));
    }
  }, [slug]);

  const canReview = viewer?.permissions.includes('membership.review') ?? false;
  const canAppoint = viewer?.permissions.includes('officer.appoint') ?? false;

  const loadList = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status, page: String(pageNum), limit: String(PAGE_SIZE), ...(query ? { q: query } : {}) });
      setList(await api<Page<KennelMember>>(`/kennels/${encodeURIComponent(slug)}/members?${params}`));
      setListError(null);
    } catch (err) {
      setListError(errorMessage(err, 'Could not load members'));
    }
  }, [slug, status, pageNum, query]);

  const loadPositions = useCallback(async () => {
    if (!canAppoint) return;
    try {
      const data = await api<PositionsResponse>(`/kennels/${encodeURIComponent(slug)}/positions`);
      setPositions(data.items);
      setRoleTitles(data.roleTitles ?? {});
    } catch {
      // No offices offered rather than a broken page: the roll still works.
      setPositions([]);
    }
  }, [slug, canAppoint]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadViewer();
  }, [user, loadViewer]);

  useEffect(() => {
    if (!user || !canReview) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadList();
  }, [user, canReview, loadList]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPositions();
  }, [loadPositions]);

  const refresh = useCallback(async () => {
    await Promise.all([loadList(), loadViewer(), loadPositions()]);
  }, [loadList, loadViewer, loadPositions]);

  const shell = (children: React.ReactNode) => (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </ThemedView>
  );

  if (loading || !user || (!viewer && !viewerError)) return shell(<Skeleton height={192} />);

  if (viewerError || !viewer) {
    return shell(
      <Card style={styles.forbidden}>
        <ThemedText style={styles.bold}>{viewerError}</ThemedText>
        <Button variant="outline" style={styles.mt16} onPress={() => router.replace('/kennels')}>Back to kennels</Button>
      </Card>,
    );
  }

  if (!canReview) {
    return shell(
      <Card style={styles.forbidden}>
        <View testID="members-forbidden" style={styles.center}>
          <ThemedText style={styles.bold}>You don’t manage members of {viewer.kennel.shortName}.</ThemedText>
          <ThemedText themeColor="textSecondary" style={[styles.sm, styles.centerText, styles.mt4]}>
            Member management is for officers the kennel has given that permission.
          </ThemedText>
          <Button variant="outline" style={styles.mt16} onPress={() => router.replace(`/kennels/${slug}`)}>
            Back to {viewer.kennel.shortName}
          </Button>
        </View>
      </Card>,
    );
  }

  const permissions = new Set(viewer.permissions);
  const tab = tabs.find((t) => t.status === status) ?? tabs[0];
  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.limit)) : 1;

  function search() {
    setPageNum(1);
    setList(null);
    setQuery(draft.trim());
  }

  return shell(
    <>
      <Card style={styles.head}>
        <Pressable accessibilityRole="link" onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={16} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.sm}>{viewer.kennel.name}</ThemedText>
        </Pressable>
        <ThemedText accessibilityRole="header" style={styles.h1}>Members</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.lead}>
          Review requests and look after the pack. Every decision is recorded.
        </ThemedText>
        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel="Search members"
            placeholder="Hash handle or first name"
            placeholderTextColor={theme.textSecondary}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={search}
            returnKeyType="search"
            autoCorrect={false}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          />
          <Button variant="outline" onPress={search}>Search</Button>
        </View>
      </Card>

      <InvitationsPanel slug={slug} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel="Member lists"
        style={[styles.tabs, { backgroundColor: theme.card, borderColor: theme.border }]}
        contentContainerStyle={styles.tabsContent}>
        {tabs.map((t) => {
          const active = t.status === status;
          return (
            <Pressable
              key={t.status}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`members-tab-${t.status}`}
              onPress={() => {
                if (active) return;
                setStatus(t.status);
                setPageNum(1);
                setList(null);
              }}
              style={styles.tab}>
              <View style={styles.tabLabelRow}>
                <ThemedText style={[styles.tabText, { color: active ? theme.primaryStrong : theme.textSecondary }]}>{t.label}</ThemedText>
                {t.status === 'PENDING_REVIEW' && viewer.pendingCount > 0 ? (
                  <View style={[styles.pill, { backgroundColor: theme.primary }]}>
                    <ThemedText style={[styles.pillText, { color: theme.onPrimary }]}>{viewer.pendingCount}</ThemedText>
                  </View>
                ) : null}
              </View>
              {active ? <View style={[styles.underline, { backgroundColor: theme.primary }]} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {listError ? (
        <Card style={styles.forbidden}>
          <ThemedText style={styles.bold}>{listError}</ThemedText>
          <Button variant="outline" style={styles.mt16} onPress={() => void loadList()}>Try again</Button>
        </Card>
      ) : !list ? (
        <View style={styles.listGap}>
          <Skeleton height={128} />
          <Skeleton height={128} />
        </View>
      ) : list.items.length === 0 ? (
        <View testID="members-empty" style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {query ? `Nobody matches “${query}”.` : tab.empty}
          </ThemedText>
        </View>
      ) : (
        <View testID="members-list" style={styles.listGap}>
          {list.items.map((m) => (
            <MemberCard
              key={m.id}
              membership={m}
              viewerId={user.id}
              permissions={permissions}
              positions={positions}
              roleTitles={roleTitles}
              slug={slug}
              onChanged={refresh}
            />
          ))}
        </View>
      )}

      {list && totalPages > 1 && (
        <View style={styles.pager} accessibilityLabel="Pagination">
          <Button variant="outline" disabled={pageNum <= 1} onPress={() => setPageNum((p) => p - 1)}>Previous</Button>
          <ThemedText themeColor="textSecondary" style={styles.sm}>Page {pageNum} of {totalPages}</ThemedText>
          <Button variant="outline" disabled={pageNum >= totalPages} onPress={() => setPageNum((p) => p + 1)}>Next</Button>
        </View>
      )}
    </>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  forbidden: { padding: 32, alignItems: 'center' },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  bold: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  mt4: { marginTop: 4 },
  mt16: { marginTop: 16 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  head: { padding: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  h1: { marginTop: 8, fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  lead: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  searchRow: { marginTop: 16, flexDirection: 'row', gap: 8 },
  input: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, fontSize: 14 },
  tabs: { flexGrow: 0, borderTopWidth: 1, borderBottomWidth: 1 },
  tabsContent: { paddingHorizontal: 8 },
  tab: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  underline: { position: 'absolute', left: 8, right: 8, bottom: 0, height: 3, borderRadius: 2 },
  listGap: { gap: 12 },
  empty: { borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center', fontSize: 16, lineHeight: 24, fontWeight: '400' },
  pager: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
