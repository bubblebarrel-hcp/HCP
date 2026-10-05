import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Archive, BookOpen, Camera, Footprints, GalleryHorizontal, ListTree, Music, Rows3, Trophy, Users, type LucideIcon } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Select } from '@/components/ui/select';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Segmented, Skeleton } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, errorMessage } from '@/lib/api';
import { brandColor, formatDate, formatRunDate } from '@/lib/format';
import type { CapsuleStatus, CapsuleTimelineEntry, RunCapsule, SupplementalType } from '@/lib/types';

// The Run Capsule, as the web lays it out on a phone
// (app/capsules/[id]/CapsuleDetailPage.tsx): the record of one run, assembled
// automatically and frozen once published. The hero card, the Explorer (timeline,
// story cards, gallery, article), the Circle, publication controls, completeness,
// who was there, what was added later, and more from the kennel.

const capsuleStatusLabel: Record<CapsuleStatus, string> = {
  PLANNED: 'Planned',
  PREPARING: 'Preparing',
  LIVE: 'Live',
  DRAFT: 'Gathering',
  PENDING_PUBLICATION: 'Ready to publish',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
  LEGACY: 'Legacy',
};

const supplementTypeLabel: Record<SupplementalType, string> = {
  PHOTO: 'Photo',
  SCANNED_NEWSLETTER: 'Scanned newsletter',
  INTERVIEW: 'Interview',
  REFLECTION: 'Reflection',
  DOCUMENT: 'Document',
  OTHER: 'Other',
};

const SUPPLEMENT_TYPES: SupplementalType[] = ['REFLECTION', 'PHOTO', 'SCANNED_NEWSLETTER', 'INTERVIEW', 'DOCUMENT', 'OTHER'];

type Mode = 'timeline' | 'cards' | 'gallery' | 'article';
type Media = RunCapsule['media'][number];

const KIND_GROUP: Record<CapsuleTimelineEntry['kind'], string> = {
  RUN: 'On trail',
  STORY: 'Moments',
  AWARD: 'Circle',
  REPORT: 'The report',
  ATTENDANCE: 'Arriving',
};

// Up to three media items whose upload time sits closest to this entry's own moment.
// A soft signal, not a hard link: media has no capture timestamp, only an upload time.
function nearestMedia(entry: CapsuleTimelineEntry, media: Media[], take = 3) {
  const at = new Date(entry.at).getTime();
  return [...media]
    .map((m) => ({ m, gap: Math.abs(new Date(m.createdAt).getTime() - at) }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, take)
    .map(({ m }) => m);
}

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  const theme = useTheme();
  if (!value) return null;
  return (
    <View style={styles.stat}>
      <Icon size={16} color={theme.textSecondary} />
      <ThemedText style={styles.sm}>
        <ThemedText style={[styles.sm, styles.semibold]}>{value}</ThemedText> {label}
      </ThemedText>
    </View>
  );
}

function Thumb({ media, size }: { media: Media; size: number }) {
  const theme = useTheme();
  const src = media.thumbnailUrl ?? media.url;
  if (!src) return null;
  return (
    <Image
      source={{ uri: src }}
      accessibilityLabel={media.caption ?? ''}
      style={{ width: size, height: size, borderRadius: 6, backgroundColor: theme.backgroundElement }}
      resizeMode="cover"
    />
  );
}

function kindColor(kind: CapsuleTimelineEntry['kind'], theme: ReturnType<typeof useTheme>) {
  if (kind === 'REPORT') return theme.primaryStrong;
  if (kind === 'AWARD') return theme.accentStrong;
  if (kind === 'STORY') return theme.text;
  return theme.textSecondary;
}

function Explorer({ capsule }: { capsule: RunCapsule }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('timeline');
  const [selected, setSelected] = useState<number | null>(null);
  const entries = capsule.timeline;
  const inner = Math.min(width, MaxContentWidth) - 48;
  const thumb3 = Math.floor((inner - 16) / 3);

  const groups = useMemo(() => {
    if (entries.length === 0 || capsule.media.length === 0) return [] as { label: string; items: Media[] }[];
    const buckets = new Map<string, Media[]>();
    for (const m of capsule.media) {
      const at = new Date(m.createdAt).getTime();
      let closest = entries[0];
      let best = Infinity;
      for (const entry of entries) {
        const gap = Math.abs(new Date(entry.at).getTime() - at);
        if (gap < best) {
          best = gap;
          closest = entry;
        }
      }
      const label = KIND_GROUP[closest.kind];
      buckets.set(label, [...(buckets.get(label) ?? []), m]);
    }
    return [...buckets.entries()].map(([label, items]) => ({ label, items }));
  }, [entries, capsule.media]);

  const active = selected != null && selected >= 0 ? entries[selected] : null;
  const activeMedia = active ? nearestMedia(active, capsule.media) : [];
  const story = entries.filter((e) => e.kind === 'STORY' || e.kind === 'AWARD');

  return (
    <Card>
      <View testID="capsule-explorer">
        <CardHeader style={styles.tight}>
          <CardTitle>What happened</CardTitle>
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            testIDPrefix="capsule-mode"
            options={[
              { value: 'timeline', label: 'Timeline', icon: <ListTree size={14} color={theme.text} /> },
              { value: 'cards', label: 'Cards', icon: <Rows3 size={14} color={theme.text} /> },
              { value: 'gallery', label: 'Gallery', icon: <GalleryHorizontal size={14} color={theme.text} /> },
              { value: 'article', label: 'Article', icon: <BookOpen size={14} color={theme.text} /> },
            ]}
          />
        </CardHeader>
        <CardContent>
          {mode === 'timeline' && (
            <View style={styles.stack}>
              <View style={[styles.timeline, { borderLeftColor: theme.border }]}>
                {entries.map((entry, i) => (
                  <Pressable
                    key={`${entry.at}-${i}`}
                    testID="capsule-timeline-entry"
                    onPress={() => setSelected(selected === i ? -1 : i)}
                    style={[styles.entry, selected === i && { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.sm}>
                      <ThemedText style={[styles.sm, styles.medium, { color: kindColor(entry.kind, theme) }]}>{entry.label}</ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.sm}>{' · '}{formatDate(entry.at)}</ThemedText>
                    </ThemedText>
                    {entry.detail && entry.kind !== 'STORY' ? (
                      <ThemedText themeColor="textSecondary" style={styles.sm}>“{entry.detail}”</ThemedText>
                    ) : null}
                  </Pressable>
                ))}
                {entries.length === 0 && <ThemedText themeColor="textSecondary" style={styles.sm}>Nothing recorded for this run.</ThemedText>}
              </View>
              <View testID="capsule-timeline-synced" style={styles.gap8}>
                {active ? (
                  activeMedia.length > 0 ? (
                    <>
                      <ThemedText themeColor="textSecondary" style={styles.xs}>Photos from around this moment</ThemedText>
                      <View style={styles.thumbs}>
                        {activeMedia.map((m) => (
                          <Thumb key={m.id} media={m} size={64} />
                        ))}
                      </View>
                    </>
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.xs}>No photos land near this moment.</ThemedText>
                  )
                ) : (
                  <ThemedText themeColor="textSecondary" style={styles.xs}>Select an entry to see what else was happening then.</ThemedText>
                )}
              </View>
            </View>
          )}

          {mode === 'cards' &&
            (entries.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.sm}>Nothing recorded for this run.</ThemedText>
            ) : (
              <View style={styles.stack}>
                {entries.map((entry, i) => {
                  const near = nearestMedia(entry, capsule.media, 1)[0];
                  return (
                    <Card key={`${entry.at}-${i}`} bleed={false} style={styles.storyCard}>
                      <View testID="capsule-story-card">
                        {near ? <Thumb media={near} size={inner} /> : null}
                        <View style={styles.cardPad}>
                          <ThemedText style={[styles.sm, styles.medium, { color: kindColor(entry.kind, theme) }]}>{entry.label}</ThemedText>
                          <ThemedText themeColor="textSecondary" style={styles.xs}>{formatDate(entry.at)}</ThemedText>
                          {entry.detail && entry.kind !== 'STORY' ? (
                            <ThemedText themeColor="textSecondary" style={[styles.sm, styles.mt4]}>“{entry.detail}”</ThemedText>
                          ) : null}
                        </View>
                      </View>
                    </Card>
                  );
                })}
              </View>
            ))}

          {mode === 'gallery' &&
            (capsule.media.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.sm}>No photographs yet.</ThemedText>
            ) : groups.length === 0 ? (
              <View style={styles.thumbs}>
                {capsule.media.map((m) => (
                  <Thumb key={m.id} media={m} size={thumb3} />
                ))}
              </View>
            ) : (
              <View style={styles.stack}>
                {groups.map((g) => (
                  <View key={g.label}>
                    <ThemedText themeColor="textSecondary" style={styles.groupLabel}>{g.label.toUpperCase()}</ThemedText>
                    <View style={styles.thumbs}>
                      {g.items.map((m) => (
                        <Thumb key={m.id} media={m} size={thumb3} />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ))}

          {mode === 'article' && (
            <View style={styles.stack}>
              {capsule.summary ? <ThemedText style={[styles.body, styles.medium]}>{capsule.summary}</ThemedText> : null}
              {story.length === 0 ? (
                <ThemedText themeColor="textSecondary" style={styles.body}>
                  No written account of this run beyond what was recorded automatically.
                </ThemedText>
              ) : (
                story.map((entry, i) => (
                  <ThemedText key={`${entry.at}-${i}`} style={styles.body}>{entry.detail ?? entry.label}</ThemedText>
                ))
              )}
            </View>
          )}
        </CardContent>
      </View>
    </Card>
  );
}

function Person({ name, userId }: { name: string; userId: string | null }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole={userId ? 'link' : undefined}
      disabled={!userId}
      onPress={() => userId && router.push(`/hashers/${userId}`)}
      style={styles.person}>
      <Avatar name={name} size={36} />
      <ThemedText style={[styles.sm, userId ? styles.medium : null]}>{name}</ThemedText>
    </Pressable>
  );
}

type PeopleTab = 'hares' | 'scribe' | 'visitors' | 'members';

function ParticipantExplorer({ capsule }: { capsule: RunCapsule }) {
  const hasParticipants = capsule.participants !== null;
  const visitors = capsule.participants?.filter((p) => p.isVisitor) ?? [];
  const members = capsule.participants?.filter((p) => !p.isVisitor) ?? [];
  const [tab, setTab] = useState<PeopleTab>('hares');

  const options: { value: PeopleTab; label: string; badge: number }[] = [
    { value: 'hares', label: 'Hares', badge: capsule.hero.hares.length },
    { value: 'scribe', label: 'Scribe', badge: capsule.hero.scribe ? 1 : 0 },
    ...(hasParticipants
      ? [
          { value: 'visitors' as const, label: 'Visitors', badge: visitors.length },
          { value: 'members' as const, label: 'Members', badge: members.length },
        ]
      : []),
  ];

  return (
    <Card>
      <View testID="capsule-participant-explorer">
        <CardHeader style={styles.tight}>
          <CardTitle>Who was there</CardTitle>
        </CardHeader>
        <CardContent style={styles.stack}>
          <Segmented<PeopleTab> value={tab} onChange={setTab} options={options} testIDPrefix="participant-tab" />
          {tab === 'hares' && (
            <View>
              {capsule.hero.hares.map((h) => (
                <Person key={h.userId} name={h.isLead ? `${h.name} (lead)` : h.name} userId={h.userId} />
              ))}
              {capsule.hero.hares.length === 0 && <ThemedText themeColor="textSecondary" style={styles.sm}>No hare recorded.</ThemedText>}
            </View>
          )}
          {tab === 'scribe' && (
            <View>
              {capsule.hero.scribe ? (
                <Person name={capsule.hero.scribe} userId={capsule.hero.scribeId} />
              ) : (
                <ThemedText themeColor="textSecondary" style={styles.sm}>No scribe recorded.</ThemedText>
              )}
            </View>
          )}
          {tab === 'visitors' && (
            <View>
              {visitors.map((p) => <Person key={p.id} name={p.name} userId={p.userId} />)}
              {visitors.length === 0 && <ThemedText themeColor="textSecondary" style={styles.sm}>No visitors checked in.</ThemedText>}
            </View>
          )}
          {tab === 'members' && (
            <View>
              {members.map((p) => <Person key={p.id} name={p.name} userId={p.userId} />)}
              {members.length === 0 && <ThemedText themeColor="textSecondary" style={styles.sm}>No members checked in.</ThemedText>}
            </View>
          )}
        </CardContent>
      </View>
    </Card>
  );
}

export default function CapsuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { loading } = useAuth();
  const [capsule, setCapsule] = useState<RunCapsule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [supplement, setSupplement] = useState<{ type: SupplementalType; title: string; description: string }>({
    type: 'REFLECTION',
    title: '',
    description: '',
  });

  useEffect(() => {
    if (loading) return;
    let alive = true;
    api<{ capsule: RunCapsule }>(`/capsules/${id}`)
      .then((data) => {
        if (!alive) return;
        setCapsule(data.capsule);
        setError(null);
      })
      .catch((err) => alive && setError(errorMessage(err, 'Run Capsule not found')));
    return () => {
      alive = false;
    };
  }, [id, loading]);

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const data = await api<{ capsule: RunCapsule }>(`/capsules/${id}/actions/${action}`, { method: 'POST', body: payload });
      setCapsule(data.capsule);
      setReason('');
    } catch (err) {
      Alert.alert('That did not work', errorMessage(err, 'That did not work'));
    } finally {
      setBusy(false);
    }
  }

  async function contribute() {
    setBusy(true);
    try {
      const data = await api<{ capsule: RunCapsule }>(`/capsules/${id}/supplements`, {
        method: 'POST',
        body: { type: supplement.type, title: supplement.title, description: supplement.description || null },
      });
      setCapsule(data.capsule);
      setSupplement({ type: 'REFLECTION', title: '', description: '' });
    } catch (err) {
      Alert.alert('Could not add it', errorMessage(err, 'Could not add it'));
    } finally {
      setBusy(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <ThemedView type="canvas" style={styles.screen}>
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </ThemedView>
  );

  if (error) {
    return shell(
      <Card style={styles.notFound}>
        <ThemedText testID="capsule-not-found" style={styles.semibold16}>{error}</ThemedText>
        <ThemedText themeColor="textSecondary" style={[styles.sm, styles.center]}>A capsule is as visible as the run it preserves.</ThemedText>
        <Button variant="outline" style={styles.mt16} onPress={() => router.replace('/runs')}>Back to runs</Button>
      </Card>,
    );
  }
  if (!capsule) return shell(<Skeleton height={384} />);

  const { hero } = capsule;
  const tone =
    capsule.status === 'PUBLISHED' ? ('primary' as const) : capsule.status === 'PENDING_PUBLICATION' ? ('accent' as const) : capsule.status === 'ARCHIVED' || capsule.status === 'LEGACY' ? ('muted' as const) : ('plain' as const);

  return shell(
    <>
      <Card style={styles.overflow}>
        <View testID="capsule-page" style={styles.hero}>
          <View style={styles.wrapRow}>
            <Badge tone={tone}>{capsuleStatusLabel[capsule.status]}</Badge>
            {capsule.isLegacyImport && <Badge>Legacy</Badge>}
            <Pressable accessibilityRole="link" onPress={() => router.push(`/kennels/${hero.kennel.slug}`)} style={styles.kennel}>
              <Avatar name={hero.kennel.shortName} size={36} color={brandColor(hero.kennel.primaryColor)} />
              <ThemedText style={[styles.sm, styles.medium]}>{hero.kennel.name}</ThemedText>
            </Pressable>
          </View>
          <ThemedText accessibilityRole="header" testID="capsule-title" style={styles.h1}>#{hero.runNumber} · {hero.title}</ThemedText>
          {hero.theme ? <ThemedText style={styles.theme}>{hero.theme}</ThemedText> : null}
          <ThemedText themeColor="textSecondary" style={[styles.sm, styles.mt8]}>
            {formatRunDate(hero.startsAt, hero.timeZone)}
            {hero.place ? ` · ${hero.place}` : ''}
            {hero.leadHare ? ` · Hare: ${hero.leadHare}` : ''}
            {hero.scribe ? ` · Scribe: ${hero.scribe}` : ''}
          </ThemedText>
          {capsule.summary ? <ThemedText testID="capsule-summary" style={[styles.summary, styles.mt12]}>{capsule.summary}</ThemedText> : null}

          <View style={styles.stats}>
            <Stat icon={Users} value={capsule.stats.attended} label="on the run" />
            <Stat icon={Footprints} value={capsule.stats.hares} label="hares" />
            <Stat icon={Camera} value={capsule.stats.photos} label="photos" />
            <Stat icon={Trophy} value={capsule.stats.awards} label="down-downs" />
            <Stat icon={Music} value={capsule.stats.songs} label="songs" />
          </View>

          {capsule.report && (
            <Button variant="outline" style={[styles.start, styles.mt16]} testID="capsule-report-link" onPress={() => router.push(`/trail-reports/${capsule.report!.id}` as never)}>
              <BookOpen size={16} color={theme.text} />
              <ThemedText style={styles.buttonLabel}>Read the Trail Report</ThemedText>
            </Button>
          )}
        </View>
      </Card>

      <Explorer capsule={capsule} />

      {capsule.circle && (
        <Card>
          <View testID="capsule-circle">
            <CardHeader style={styles.tight}>
              <CardTitle>Circle</CardTitle>
            </CardHeader>
            <CardContent style={styles.stack}>
              {capsule.circle.awards.length > 0 && (
                <View style={styles.gap8}>
                  {capsule.circle.awards.map((a) => (
                    <View key={a.id}>
                      <View style={styles.wrapRow}>
                        <ThemedText style={styles.sm}>
                          <ThemedText style={[styles.sm, styles.medium]}>{a.title}</ThemedText>
                          {a.recipientName ? ` — ${a.recipientName}` : ''}
                        </ThemedText>
                        {a.isDownDown && <Badge>Down-down</Badge>}
                      </View>
                      {a.reason ? <ThemedText themeColor="textSecondary" style={styles.sm}>{a.reason}</ThemedText> : null}
                    </View>
                  ))}
                </View>
              )}
              {capsule.circle.songs.length > 0 && <ThemedText style={styles.sm}>Songs: {capsule.circle.songs.join(', ')}</ThemedText>}
              {capsule.circle.announcements ? <ThemedText style={styles.sm}>{capsule.circle.announcements}</ThemedText> : null}
              {capsule.circle.awards.length === 0 && capsule.circle.songs.length === 0 && !capsule.circle.announcements && (
                <ThemedText themeColor="textSecondary" style={styles.sm}>No Circle record was kept.</ThemedText>
              )}
            </CardContent>
          </View>
        </Card>
      )}

      {(capsule.viewer.canPublish || capsule.viewer.canArchive || capsule.viewer.awaitingReport) && (
        <Card>
          <View testID="capsule-actions">
            <CardHeader style={styles.tight}>
              <CardTitle>Publication</CardTitle>
              <CardDescription>
                {capsule.viewer.awaitingReport
                  ? 'The capsule is built around the Trail Report. Publish that first.'
                  : 'Publishing makes this the kennel’s permanent record of the run.'}
              </CardDescription>
            </CardHeader>
            <CardContent style={styles.stack}>
              {capsule.viewer.canPublish && (
                <Button disabled={busy} testID="capsule-publish" style={styles.start} onPress={() => void act('publish')}>Publish the capsule</Button>
              )}
              {capsule.viewer.canArchive && (
                <View style={styles.gap8}>
                  <Field label="Why archive it">
                    <Input testID="capsule-archive-reason" value={reason} onChangeText={setReason} placeholder="Replaced by the anniversary edition" />
                  </Field>
                  <Button variant="outline" disabled={busy || reason.trim().length < 3} testID="capsule-archive" style={styles.start} onPress={() => void act('archive', { reason })}>
                    <Archive size={16} color={theme.text} />
                    <ThemedText style={styles.buttonLabel}>Archive</ThemedText>
                  </Button>
                </View>
              )}
            </CardContent>
          </View>
        </Card>
      )}

      {capsule.health && (
        <Card>
          <View testID="capsule-health">
            <CardHeader style={styles.tight}>
              <CardTitle>Completeness</CardTitle>
              <CardDescription>Advisory only. None of it blocks publication.</CardDescription>
            </CardHeader>
            <CardContent style={styles.gap4}>
              {capsule.health.missingReport && <ThemedText style={styles.sm}>No Trail Report yet.</ThemedText>}
              {capsule.health.missingCircle && <ThemedText style={styles.sm}>No Circle record.</ThemedText>}
              {capsule.health.noPhotos && <ThemedText style={styles.sm}>No photographs.</ThemedText>}
              {capsule.health.uncaptionedMedia > 0 && <ThemedText style={styles.sm}>{capsule.health.uncaptionedMedia} photos without captions.</ThemedText>}
              {!capsule.health.missingReport && !capsule.health.missingCircle && !capsule.health.noPhotos && capsule.health.uncaptionedMedia === 0 && (
                <ThemedText themeColor="textSecondary" style={styles.sm}>Nothing missing.</ThemedText>
              )}
            </CardContent>
          </View>
        </Card>
      )}

      <ParticipantExplorer capsule={capsule} />

      <Card>
        <View testID="capsule-supplements">
          <CardHeader style={styles.tight}>
            <CardTitle>Added later</CardTitle>
            <CardDescription>Kept apart from the record, always attributed.</CardDescription>
          </CardHeader>
          <CardContent style={styles.stack}>
            {capsule.supplements.length === 0 && (
              <ThemedText themeColor="textSecondary" style={styles.sm}>Nothing has been added since.</ThemedText>
            )}
            {capsule.supplements.map((s) => (
              <View key={s.id} style={[styles.supplement, { borderColor: theme.border }]}>
                <Badge>{supplementTypeLabel[s.type]}</Badge>
                <ThemedText style={[styles.sm, styles.medium, styles.mt4]}>{s.title}</ThemedText>
                {s.description ? <ThemedText themeColor="textSecondary" style={styles.sm}>{s.description}</ThemedText> : null}
                <ThemedText themeColor="textSecondary" style={[styles.xs, styles.mt4]}>{s.contributedBy} · {formatDate(s.addedAt)}</ThemedText>
              </View>
            ))}

            {capsule.viewer.canContribute && (
              <View style={[styles.contribute, { borderTopColor: theme.border }]}>
                <Field label="What are you adding">
                  <Select
                    testID="supplement-type"
                    value={supplement.type}
                    onChange={(value) => setSupplement((s) => ({ ...s, type: value as SupplementalType }))}
                    options={SUPPLEMENT_TYPES.map((t) => ({ value: t, label: supplementTypeLabel[t] }))}
                  />
                </Field>
                <Field label="Title">
                  <Input testID="supplement-title" value={supplement.title} onChangeText={(title) => setSupplement((s) => ({ ...s, title }))} placeholder="Ten years on" />
                </Field>
                <Input
                  testID="supplement-description"
                  accessibilityLabel="Description"
                  value={supplement.description}
                  onChangeText={(description) => setSupplement((s) => ({ ...s, description }))}
                  placeholder="I still remember the shiggy."
                  multiline
                  style={styles.textarea}
                />
                <Button disabled={busy || supplement.title.trim().length === 0} testID="supplement-add" style={styles.start} onPress={() => void contribute()}>
                  Add to the archive
                </Button>
              </View>
            )}
          </CardContent>
        </View>
      </Card>

      {capsule.related.length > 0 && (
        <Card>
          <View testID="capsule-related">
            <CardHeader style={styles.tight}>
              <CardTitle>More from this kennel</CardTitle>
            </CardHeader>
            <CardContent style={styles.gap8}>
              {capsule.related.map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="link"
                  testID="capsule-related-item"
                  onPress={() => router.push(`/capsules/${c.id}` as never)}
                  style={styles.related}>
                  <Avatar name={c.kennel.shortName} size={36} color={brandColor(c.kennel.primaryColor)} />
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1} style={[styles.sm, styles.medium]}>#{c.runNumber} · {c.title}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.xs}>
                      {c.kennel.shortName} · {formatDate(c.startsAt)}
                      {c.reason === 'SAME_HARE' ? ' · same hare' : ''}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
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
  overflow: { overflow: 'hidden' },
  flex: { flex: 1 },
  notFound: { padding: 32, alignItems: 'center', gap: 4 },
  center: { textAlign: 'center' },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  start: { alignSelf: 'flex-start' },
  tight: { paddingBottom: 12, gap: 12 },
  stack: { gap: 16 },
  gap4: { gap: 4 },
  gap8: { gap: 8 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  semibold16: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 24, fontWeight: '400' },
  buttonLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  hero: { padding: 20 },
  kennel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h1: { marginTop: 8, fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  theme: { marginTop: 4, fontSize: 16, lineHeight: 24, fontStyle: 'italic', fontWeight: '400' },
  summary: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  stats: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeline: { borderLeftWidth: 2, paddingLeft: 16, gap: 12 },
  entry: { borderRadius: 6, padding: 2 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupLabel: { marginBottom: 8, fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.6 },
  storyCard: { overflow: 'hidden' },
  cardPad: { padding: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6, minHeight: 44 },
  supplement: { borderWidth: 1, borderRadius: 8, padding: 12 },
  contribute: { gap: 8, borderTopWidth: 1, paddingTop: 12 },
  textarea: { minHeight: 72, textAlignVertical: 'top', paddingTop: 10 },
  related: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, minHeight: 52 },
});
