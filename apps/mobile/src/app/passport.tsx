import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Award, Footprints, Globe2, MapPin, Pin, RefreshCw, Ruler, Share2, Trash2, Users, type LucideIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Select } from '@/components/ui/select';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { WEB_URL, api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { HashPassport, IdentityTimelineEntry } from '@/lib/types';

// The Hash Passport, as the web lays it out on a phone (app/passport/page.tsx and
// components/passport/PassportView.tsx): the header with five stat tiles, Stamps,
// Milestones, "Where you have hashed", then your memories, the share link and
// your timeline. The share link opens the system share sheet; the web's QR code
// and clipboard button have no native twin yet.

const memoryKindLabel: Record<string, string> = {
  FAVORITE_TRAIL: 'Favourite trail',
  FAVORITE_BEER_STOP: 'Favourite beer stop',
  FAVORITE_PHOTO: 'Favourite photo',
  NOTE: 'Note',
};

const timelineTypeLabel: Record<string, string> = {
  AWARD: 'Stamp',
  MILESTONE: 'Milestone',
  MEMBERSHIP: 'Membership',
  ROLE: 'Role',
  TRUST_LEVEL: 'Trust level',
  HASH_NAME: 'Hash name',
};

function formatKm(metres: number) {
  if (!metres) return '0 km';
  return `${(metres / 1000).toFixed(metres >= 10_000 ? 0 : 1)} km`;
}

function placeLabel(place: { country: string; stateProvince: string | null; city: string | null }) {
  return [place.city, place.stateProvince, place.country].filter(Boolean).join(', ');
}

function AddMemoryDialog({ onSaved }: { onSaved: (passport: HashPassport) => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const blank = { kind: 'NOTE', title: '', note: '' };
  const [values, setValues] = useState(blank);

  async function save() {
    if (values.title.trim().length < 2) return;
    setBusy(true);
    try {
      const data = await api<{ passport: HashPassport }>('/me/passport/memories', { method: 'POST', body: values });
      onSaved(data.passport);
      setValues(blank);
      setOpen(false);
    } catch (err) {
      Alert.alert('Could not pin that', errorMessage(err, 'Could not pin that'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" testID="add-memory" onPress={() => setOpen(true)}>
        <Pin size={16} color={theme.onPrimary} />
        <ThemedText style={[styles.buttonLabel, { color: theme.onPrimary }]}>Pin a memory</ThemedText>
      </Button>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => !busy && setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && setOpen(false)} accessibilityLabel="Close" />
          <View style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText accessibilityRole="header" style={styles.dialogTitle}>Pin a memory</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.sm}>Your own note on the passport. Only you see these.</ThemedText>
            <View style={styles.dialogFields}>
              <Field label="Kind">
                <Select
                  value={values.kind}
                  onChange={(kind) => setValues((v) => ({ ...v, kind }))}
                  options={Object.entries(memoryKindLabel).map(([value, label]) => ({ value, label }))}
                />
              </Field>
              <Field label="Title">
                <Input value={values.title} placeholder="The full moon run that went sideways" onChangeText={(title) => setValues((v) => ({ ...v, title }))} />
              </Field>
              <Field label="Note (optional)">
                <Input value={values.note} multiline style={styles.note} onChangeText={(note) => setValues((v) => ({ ...v, note }))} />
              </Field>
            </View>
            <View style={styles.dialogFooter}>
              <Button variant="outline" disabled={busy} onPress={() => setOpen(false)}>Cancel</Button>
              <Button disabled={busy} testID="add-memory-submit" onPress={() => void save()}>{busy ? 'Saving…' : 'Pin it'}</Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function PassportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [passport, setPassport] = useState<HashPassport | null>(null);
  const [timeline, setTimeline] = useState<IdentityTimelineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/account');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    Promise.all([
      api<{ passport: HashPassport }>('/me/passport'),
      api<{ items: IdentityTimelineEntry[] }>('/me/passport/timeline'),
    ])
      .then(([passportData, timelineData]) => {
        if (!alive) return;
        setPassport(passportData.passport);
        setTimeline(timelineData.items);
      })
      .catch((err) => alive && setError(errorMessage(err, 'Could not load your passport')));
    return () => {
      alive = false;
    };
  }, [user]);

  const shell = (children: React.ReactNode) => (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page}>{children}</ScrollView>
      </View>
    </ThemedView>
  );

  if (!user || (!passport && !error)) return shell(<Skeleton height={384} />);
  if (error || !passport) return shell(<Card style={styles.errorCard}><ThemedText>{error}</ThemedText></Card>);

  const shareUrl = passport.shareToken ? `${WEB_URL}/passport/shared/${passport.shareToken}` : null;

  const stats: { label: string; value: string; icon: LucideIcon }[] = [
    { label: 'Runs attended', value: String(passport.runsAttended), icon: Footprints },
    { label: 'Trails laid', value: String(passport.trailsLaid), icon: Award },
    { label: 'Countries hashed', value: String(passport.countriesHashed), icon: Globe2 },
    { label: 'Kennels', value: String(passport.kennelsJoined), icon: Users },
    { label: 'Distance', value: formatKm(passport.distanceMeters), icon: Ruler },
  ];

  const byCountry = passport.places.reduce<Record<string, typeof passport.places>>((acc, place) => {
    (acc[place.country] ??= []).push(place);
    return acc;
  }, {});

  return shell(
    <>
      <Card style={styles.header} >
        <View testID="passport-header" style={styles.headerRow}>
          <Avatar name={passport.hasher.displayName} size={56} />
          <View style={styles.headerText}>
            <ThemedText style={[styles.eyebrow, { color: theme.primaryStrong }]}>HASH PASSPORT</ThemedText>
            <ThemedText accessibilityRole="header" testID="passport-name" style={styles.h1}>{passport.hasher.displayName}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.sm}>Hashing since {formatDate(passport.hasher.hashingSince)}</ThemedText>
          </View>
        </View>
        <View testID="passport-stats" style={styles.stats}>
          {stats.map(({ label, value, icon: Icon }) => (
            <View key={label} style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
              <Icon size={20} color={theme.textSecondary} />
              <ThemedText style={styles.statValue}>{value}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.xs}>{label}</ThemedText>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <View testID="passport-stamps">
          <CardHeader style={styles.tight}>
            <CardTitle>Stamps</CardTitle>
          </CardHeader>
          <CardContent>
            {passport.stamps.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.sm}>Your first stamp arrives when you check in to a run.</ThemedText>
            ) : (
              <View style={styles.stamps}>
                {passport.stamps.map((stamp) => (
                  <View key={stamp.id} style={[styles.stamp, { borderColor: theme.accent + '66', backgroundColor: theme.accent + '1a' }]}>
                    <ThemedText style={[styles.stampLabel, { color: theme.accentStrong }]}>{stamp.label}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.xs}>{formatDate(stamp.awardedAt)}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </View>
      </Card>

      <Card>
        <View testID="passport-milestones">
          <CardHeader style={styles.tight}>
            <CardTitle>Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            {passport.milestones.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                The first milestone is 10 runs. {passport.runsAttended} so far.
              </ThemedText>
            ) : (
              <View style={styles.list}>
                {passport.milestones.map((milestone) => (
                  <View key={milestone.id} style={styles.between}>
                    <ThemedText style={[styles.sm, styles.semibold]}>{milestone.threshold} runs</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.sm}>{formatDate(milestone.reachedAt)}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </View>
      </Card>

      <Card>
        <View testID="passport-places">
          <CardHeader style={styles.tight}>
            <CardTitle>Where you have hashed</CardTitle>
          </CardHeader>
          <CardContent>
            {passport.places.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.sm}>Nowhere yet. That changes on your first run.</ThemedText>
            ) : (
              <View style={styles.countries}>
                {Object.entries(byCountry).map(([country, places]) => (
                  <View key={country}>
                    <View style={styles.countryRow}>
                      <Globe2 size={16} color={theme.primaryStrong} />
                      <ThemedText style={styles.semibold16}>{country}</ThemedText>
                      <Badge>{String(places.length)}</Badge>
                    </View>
                    <View style={styles.places}>
                      {places.map((place) => (
                        <View key={place.id} style={styles.placeRow}>
                          <MapPin size={14} color={theme.textSecondary} />
                          <ThemedText themeColor="textSecondary" style={[styles.sm, styles.flex]}>
                            {placeLabel(place)} · first visit {formatDate(place.firstVisitedAt)}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </View>
      </Card>

      <Card>
        <View testID="passport-memories">
          <CardHeader style={[styles.tight, styles.headerBetween]}>
            <CardTitle>Your memories</CardTitle>
            <AddMemoryDialog onSaved={setPassport} />
          </CardHeader>
          <CardContent>
            {passport.memories.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.sm}>
                Pin a favourite trail, a beer stop or anything you want to keep. Only you see these.
              </ThemedText>
            ) : (
              passport.memories.map((memory, index) => (
                <View
                  key={memory.id}
                  style={[
                    styles.memory,
                    index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                    index === 0 && { paddingTop: 0 },
                    index === passport.memories.length - 1 && { paddingBottom: 0 },
                  ]}>
                  <View style={styles.flex}>
                    <ThemedText style={styles.medium}>{memory.title}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.sm}>
                      {memoryKindLabel[memory.kind] ?? memory.kind} · {formatDate(memory.pinnedAt)}
                    </ThemedText>
                    {memory.note ? <ThemedText style={[styles.sm, styles.noteText]}>{memory.note}</ThemedText> : null}
                  </View>
                  <Button
                    variant="ghost"
                    size="sm"
                    accessibilityLabel={`Remove ${memory.title}`}
                    onPress={async () => {
                      try {
                        const data = await api<{ passport: HashPassport }>(`/me/passport/memories/${memory.id}`, { method: 'DELETE' });
                        setPassport(data.passport);
                      } catch (err) {
                        Alert.alert('Could not remove that', errorMessage(err, 'Could not remove that'));
                      }
                    }}>
                    <Trash2 size={16} color={theme.text} />
                  </Button>
                </View>
              ))
            )}
          </CardContent>
        </View>
      </Card>

      <Card>
        <View testID="passport-share">
          <CardHeader style={styles.tight}>
            <CardTitle>Share your passport</CardTitle>
          </CardHeader>
          <CardContent style={styles.shareBody}>
            <ThemedText themeColor="textSecondary" style={styles.sm}>
              Anyone with this link sees your stamps, milestones and places, under your hash name. Your pinned memories stay
              private. Rotate the link and the old one stops working.
            </ThemedText>
            {shareUrl && (
              <View style={styles.shareActions}>
                <Input readOnly editable={false} value={shareUrl} accessibilityLabel="Share link" testID="share-url" />
                <View style={styles.wrapRow}>
                  <Button variant="outline" onPress={() => void Share.share({ url: shareUrl, message: shareUrl })}>
                    <Share2 size={16} color={theme.text} />
                    <ThemedText style={styles.buttonLabel}>Share</ThemedText>
                  </Button>
                  <Button
                    variant="ghost"
                    testID="rotate-share"
                    onPress={async () => {
                      try {
                        const data = await api<{ shareToken: string }>('/me/passport/share/rotate', { method: 'POST' });
                        setPassport({ ...passport, shareToken: data.shareToken });
                      } catch (err) {
                        Alert.alert('Could not rotate the link', errorMessage(err, 'Could not rotate the link'));
                      }
                    }}>
                    <RefreshCw size={16} color={theme.text} />
                    <ThemedText style={styles.buttonLabel}>New link</ThemedText>
                  </Button>
                </View>
              </View>
            )}
          </CardContent>
        </View>
      </Card>

      {timeline.length > 0 && (
        <Card>
          <View testID="passport-timeline">
            <CardHeader style={styles.tight}>
              <CardTitle>Your timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <View style={[styles.timeline, { borderLeftColor: theme.border }]}>
                {timeline.map((entry) => (
                  <ThemedText key={entry.id} style={styles.sm}>
                    <ThemedText style={[styles.sm, styles.semibold]}>{entry.title}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.sm}>
                      {' · '}
                      {timelineTypeLabel[entry.type] ?? entry.type} · {formatDate(entry.occurredAt)}
                    </ThemedText>
                  </ThemedText>
                ))}
              </View>
            </CardContent>
          </View>
        </Card>
      )}
    </>,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  page: { paddingVertical: 16, paddingBottom: 32, gap: 16 },
  errorCard: { padding: 32, alignItems: 'center' },
  flex: { flex: 1 },
  header: { padding: 20 },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 2.8 },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  semibold: { fontWeight: '600' },
  semibold16: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  medium: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  stats: { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexBasis: '47%', flexGrow: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  statValue: { marginTop: 4, fontSize: 20, lineHeight: 28, fontWeight: '700' },
  tight: { paddingBottom: 12 },
  headerBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stamp: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  stampLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  list: { gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  countries: { gap: 12 },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  places: { marginTop: 4, gap: 4, paddingLeft: 24 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memory: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  noteText: { marginTop: 4 },
  shareBody: { gap: 12 },
  shareActions: { gap: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  buttonLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  timeline: { borderLeftWidth: 2, paddingLeft: 16, gap: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: { width: '100%', maxWidth: 448, borderWidth: 1, borderRadius: 12, padding: 24, gap: 6 },
  dialogTitle: { fontSize: 18, lineHeight: 22, fontWeight: '600' },
  dialogFields: { marginTop: 12, gap: 16 },
  note: { minHeight: 72, textAlignVertical: 'top', paddingTop: 10 },
  dialogFooter: { marginTop: 16, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
