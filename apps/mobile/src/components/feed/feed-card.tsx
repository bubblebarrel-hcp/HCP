import { Image, Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  Beer,
  BookOpen,
  CalendarDays,
  Camera,
  MapPin,
  Megaphone,
  MessageSquare,
  Rabbit,
  Repeat2,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { EngagementBar } from '@/components/social/engagement-bar';
import { LinkPreviewCard } from '@/components/social/link-preview-card';
import { PollCard } from '@/components/social/poll-card';
import { RichText } from '@/components/social/rich-text';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/web-ui';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WEB_URL } from '@/lib/api';
import { brandColor, formatDate } from '@/lib/format';
import { formatRunWhen } from '@/lib/runs';
import type { FeedEntry, FeedItem, SubjectSegment } from '@/lib/types';

// One thing in the community feed (D42), laid out card for card as the web draws it
// (components/feed/FeedCard.tsx): a run being announced, a trail report, a photo, a
// hasher's post, a milestone, or a reshare of any of those, each edge to edge with
// a line above and below, and the engagement bar under it.

function Attribution({
  name,
  authorId,
  avatarUrl,
  kennel,
  at,
  icon: Icon,
}: {
  name: string | null;
  // When we know who they are, the name is a link to them: that is where the
  // Follow button lives (D50).
  authorId?: string | null;
  avatarUrl?: string | null;
  kennel: FeedItem['kennel'];
  at: string;
  icon: LucideIcon;
}) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={styles.attribution}>
      <Avatar name={name ?? kennel?.shortName ?? 'Hash'} size={36} src={avatarUrl ?? null} color={brandColor(kennel?.primaryColor)} />
      <View style={styles.attributionText}>
        <ThemedText style={styles.sm}>
          {authorId && name ? (
            <ThemedText style={[styles.sm, styles.medium]} onPress={() => router.push(`/hashers/${authorId}`)}>
              {name}
            </ThemedText>
          ) : (
            <ThemedText style={[styles.sm, styles.medium]}>{name ?? 'A hasher'}</ThemedText>
          )}
          {kennel ? (
            <>
              {' · '}
              <ThemedText style={[styles.sm, { color: theme.primaryStrong }]} onPress={() => router.push(`/kennels/${kennel.slug}`)}>
                {kennel.shortName}
              </ThemedText>
            </>
          ) : null}
        </ThemedText>
        <View style={styles.when}>
          <Icon size={14} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.sm}>{formatDate(at)}</ThemedText>
        </View>
      </View>
    </View>
  );
}

// A run being announced (D43): the flyer, then the run number, title, theme, when,
// where, who is haring, hash cash and what is coming after, in that order.
function RunAnnouncement({ item }: { item: Extract<FeedItem, { kind: 'RUN' }> }) {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const heading = item.runNumber ? `Run #${item.runNumber}` : 'Next run';
  const venue = [item.meetingPointName, item.meetingAddress].filter(Boolean).join(', ');
  const content = Math.min(width, MaxContentWidth);
  const facts: { icon: LucideIcon; text: string }[] = [
    { icon: CalendarDays, text: formatRunWhen(item.startsAt, item.timeZone) },
    { icon: MapPin, text: venue || `${item.city}, ${item.country}` },
    ...(item.hares.length > 0 ? [{ icon: Rabbit, text: `${item.hares.length === 1 ? 'Hare: ' : 'Hares: '}${item.hares.join(', ')}` }] : []),
    ...(item.hashCash ? [{ icon: Beer, text: item.hashCash }] : []),
  ];

  return (
    <View testID="feed-run">
      <View style={styles.headPad}>
        <Attribution name={item.kennel?.shortName ?? 'A kennel'} kennel={item.kennel} at={item.at} icon={Megaphone} />
      </View>

      {item.posterUrl ? (
        <Image
          source={{ uri: item.posterUrl }}
          accessibilityLabel={`Flyer for ${heading}${item.theme ? `, ${item.theme}` : ''}`}
          style={{ width: content, height: Math.min(content * 1.25, 576), backgroundColor: theme.backgroundElement }}
          resizeMode="contain"
        />
      ) : null}

      <View style={styles.runBody}>
        <View>
          <View style={styles.headingRow}>
            <ThemedText style={[styles.eyebrow, { color: theme.primaryStrong }]}>{heading.toUpperCase()}</ThemedText>
            {item.happeningNow && (
              <View style={[styles.live, { backgroundColor: theme.accent }]} testID="feed-run-live">
                <ThemedText style={styles.liveText}>On trail now</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={styles.runTitle}>{item.title}</ThemedText>
          {item.theme ? <ThemedText themeColor="textSecondary" style={styles.theme}>{item.theme}</ThemedText> : null}
        </View>

        <View style={styles.facts}>
          {facts.map(({ icon: Icon, text }, index) => (
            <View key={index} style={styles.fact}>
              <Icon size={16} color={theme.textSecondary} style={styles.factIcon} />
              <ThemedText style={styles.factText}>{text}</ThemedText>
            </View>
          ))}
        </View>

        {item.description ? <ThemedText style={styles.body}>{item.description}</ThemedText> : null}

        <View style={styles.ctaRow}>
          <Pressable
            accessibilityRole="button"
            testID="feed-run-cta"
            onPress={() => router.push(`/run/${item.id}`)}
            style={({ pressed }) => [styles.cta, { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 }]}>
            <ThemedText style={[styles.ctaText, { color: theme.onPrimary }]}>
              {item.happeningNow ? 'On On — catch them up' : 'On On — I’m coming'}
            </ThemedText>
          </Pressable>
          {item.goingCount > 0 && (
            <ThemedText themeColor="textSecondary" style={styles.sm}>
              {item.goingCount} {item.goingCount === 1 ? 'hasher is' : 'hashers are'} coming
            </ThemedText>
          )}
        </View>
      </View>
    </View>
  );
}

const subjectWords: Record<string, string> = {
  REEL: 'Reel',
  POST: 'Post',
  TRAIL_REPORT: 'Trail report',
  MEDIA_ASSET: 'Photo',
  RUN: 'Run',
  RUN_CAPSULE: 'Run Capsule',
};

// Somebody passing on somebody else's post (D50). The outer card is the sharer's:
// their picture, their words. The quote inside keeps its own attribution, so it is
// never unclear whose work it was.
function Reshare({ item }: { item: Extract<FeedItem, { kind: 'RESHARE' }> }) {
  const theme = useTheme();
  const router = useRouter();
  const original = item.original;

  // What has a screen of its own opens there.
  function openOriginal() {
    if (!original) return;
    if (original.type === 'POST') router.push(`/posts/${original.id}`);
    else if (original.type === 'REEL') router.push(`/reels/${original.id}`);
    else if (original.type === 'RUN') router.push(`/run/${original.id}`);
    else if (original.type === 'TRAIL_REPORT') router.push(`/trail-reports/${original.id}` as never);
    else if (original.type === 'RUN_CAPSULE') router.push(`/capsules/${original.id}` as never);
    else void Linking.openURL(`${WEB_URL}${original.href}`);
  }

  return (
    <View style={styles.pad} testID="feed-reshare">
      <View style={styles.attribution}>
        <Avatar name={item.sharer.name} size={36} src={item.sharer.avatarUrl} />
        <View style={styles.attributionText}>
          <ThemedText style={[styles.sm, styles.medium]} onPress={() => router.push(`/hashers/${item.sharer.id}`)}>
            {item.sharer.name}
          </ThemedText>
          <View style={styles.when}>
            <Repeat2 size={14} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.sm}>reshared · {formatDate(item.at)}</ThemedText>
          </View>
        </View>
      </View>

      {item.commentary ? <ThemedText style={[styles.body, styles.mt12]}>{item.commentary}</ThemedText> : null}

      {original ? (
        <Pressable
          accessibilityRole="link"
          onPress={openOriginal}
          style={({ pressed }) => [styles.quote, { borderColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
          {original.imageUrl ? (
            <Image source={{ uri: original.imageUrl }} style={[styles.quoteImage, { backgroundColor: theme.backgroundElement }]} resizeMode="cover" />
          ) : null}
          <View style={styles.quotePad}>
            <ThemedText themeColor="textSecondary" style={styles.quoteType}>
              {`${subjectWords[original.type] ?? 'Post'}${original.author ? ` by ${original.author}` : ''}${original.kennel ? ` · ${original.kennel.shortName}` : ''}`.toUpperCase()}
            </ThemedText>
            <ThemedText style={styles.quoteTitle}>{original.title}</ThemedText>
            {original.excerpt ? <ThemedText themeColor="textSecondary" style={[styles.sm, styles.mt4]}>{original.excerpt}</ThemedText> : null}
          </View>
        </Pressable>
      ) : (
        <View style={[styles.quote, styles.quotePad, styles.dashedQuote, { borderColor: theme.border }]}>
          <ThemedText themeColor="textSecondary" style={styles.sm}>The original is no longer available.</ThemedText>
        </View>
      )}
    </View>
  );
}

// A hasher's own words (D51): words first, photos under them, the opposite of a reel.
function HasherPostCard({ item }: { item: Extract<FeedItem, { kind: 'POST' }> }) {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const content = Math.min(width, MaxContentWidth);
  // One photo fills the width; several tile. Four is the composer's cap.
  const many = item.photos.length > 1;
  const tile = (content - 2) / 2;

  return (
    <View testID="feed-post">
      <View style={styles.headPad}>
        <Attribution
          name={item.author}
          authorId={item.authorId}
          avatarUrl={(item as { authorAvatarUrl?: string | null }).authorAvatarUrl}
          kennel={item.kennel}
          at={item.at}
          icon={MessageSquare}
        />
        <Pressable accessibilityRole="link" accessibilityLabel="Open this post" onPress={() => router.push(`/posts/${item.id}`)}>
          <RichText text={item.body} style={[styles.body, styles.mt8]} testID="feed-post-body" />
        </Pressable>
        {item.edited ? <ThemedText themeColor="textSecondary" style={[styles.xs, styles.mt4]}>edited</ThemedText> : null}
        {item.poll ? <PollCard postId={item.id} initial={item.poll} /> : null}
        {item.linkPreview ? <LinkPreviewCard preview={item.linkPreview} /> : null}
      </View>

      {item.photos.length > 0 && (
        <View style={many ? styles.photoGrid : undefined}>
          {item.photos.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: photo.url }}
              style={[
                { backgroundColor: theme.backgroundElement },
                many ? { width: tile, height: tile } : { width: content, height: Math.min(content * 1.1, 576) },
              ]}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ))}
        </View>
      )}

      {item.run && (
        <Pressable accessibilityRole="link" onPress={() => router.push(`/run/${item.run!.id}`)} style={styles.runLink}>
          <ThemedText style={[styles.sm, styles.medium, { color: theme.primaryStrong }]}>
            Run #{item.run.runNumber ?? '—'}
            {item.run.title ? ` · ${item.run.title}` : ''}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

function ReportCard({ item }: { item: Extract<FeedItem, { kind: 'REPORT' }> }) {
  const theme = useTheme();
  const router = useRouter();
  const open = () => router.push(`/trail-reports/${item.id}` as never);
  return (
    <View style={styles.pad} testID="feed-report">
      <Attribution name={item.author} authorId={item.authorId} kennel={item.kennel} at={item.at} icon={BookOpen} />
      <Pressable accessibilityRole="link" onPress={open} style={styles.mt12}>
        <ThemedText style={styles.reportTitle}>{item.title}</ThemedText>
      </Pressable>
      {item.run ? (
        <ThemedText themeColor="textSecondary" style={styles.sm}>
          Run #{item.run.runNumber ?? '—'}
          {item.run.title ? ` · ${item.run.title}` : ''}
        </ThemedText>
      ) : null}
      {item.excerpt ? <ThemedText style={[styles.body, styles.mt8]}>{item.excerpt}</ThemedText> : null}
      <Pressable accessibilityRole="link" onPress={open} style={styles.mt12}>
        <ThemedText style={[styles.sm, styles.medium, { color: theme.primaryStrong }]}>Read the trail report</ThemedText>
      </Pressable>
    </View>
  );
}

function PhotoCard({ item }: { item: Extract<FeedItem, { kind: 'PHOTO' }> }) {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const content = Math.min(width, MaxContentWidth);
  return (
    <View testID="feed-photo">
      <View style={styles.headPad}>
        <Attribution
          name={item.author}
          authorId={item.authorId}
          avatarUrl={(item as { authorAvatarUrl?: string | null }).authorAvatarUrl}
          kennel={item.kennel}
          at={item.at}
          icon={Camera}
        />
        {item.caption ? <ThemedText style={[styles.body, styles.mt8]}>{item.caption}</ThemedText> : null}
      </View>
      <Image
        source={{ uri: item.url }}
        accessibilityLabel={item.caption ?? `Photo by ${item.author ?? 'a hasher'}`}
        style={{ width: content, height: Math.min(content * 1.1, 576), backgroundColor: theme.backgroundElement }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      {item.run && (
        <Pressable accessibilityRole="link" onPress={() => router.push(`/run/${item.run!.id}`)} style={styles.runLink}>
          <ThemedText style={[styles.sm, styles.medium, { color: theme.primaryStrong }]}>
            Run #{item.run.runNumber ?? '—'}
            {item.run.title ? ` · ${item.run.title}` : ''}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

// A hasher passing 10, 50, 100 runs (D60). News, not a thing to like, so there is
// no bar under it.
function MilestoneCard({ item }: { item: Extract<FeedItem, { kind: 'MILESTONE' }> }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={styles.milestone} testID="feed-milestone">
      <View style={[styles.trophy, { backgroundColor: theme.accent }]}>
        <Trophy size={28} color="#171717" />
      </View>
      <View style={styles.milestoneText}>
        <ThemedText style={styles.body}>
          <ThemedText style={[styles.body, styles.semibold]} onPress={() => router.push(`/hashers/${item.hasher.id}`)}>
            {item.hasher.name}
          </ThemedText>{' '}
          has run <ThemedText style={[styles.body, styles.semibold]}>{item.threshold} trails</ThemedText>. On On!
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={[styles.sm, styles.mt2]}>
          {item.run ? (
            <>
              <ThemedText style={[styles.sm, { color: theme.primaryStrong }]} onPress={() => router.push(`/run/${item.run!.id}`)}>
                Run #{item.run.runNumber ?? '—'}
                {item.run.title ? ` · ${item.run.title}` : ''}
              </ThemedText>
              {' · '}
            </>
          ) : null}
          {formatDate(item.at)}
        </ThemedText>
      </View>
      <Avatar
        name={item.hasher.name}
        size={40}
        src={item.hasher.avatarUrl}
        color={brandColor(item.kennel?.primaryColor)}
      />
    </View>
  );
}

// Which subject the bar under a card acts on. A reshare's bar acts on what it
// quotes, because a like belongs to whoever made the thing.
function engagementTarget(item: FeedEntry): { segment: SubjectSegment; id: string; authorId: string | null } | null {
  switch (item.kind) {
    // News, not a thing to like (D60).
    case 'MILESTONE':
      return null;
    case 'REPORT':
      return { segment: 'reports', id: item.id, authorId: item.authorId };
    case 'PHOTO':
      return { segment: 'photos', id: item.id, authorId: item.authorId };
    case 'RUN':
      // A run belongs to the kennel, not to a person, so anybody may reshare it.
      return { segment: 'runs', id: item.id, authorId: null };
    case 'POST':
      return { segment: 'posts', id: item.id, authorId: item.authorId };
    case 'RESHARE':
      return { segment: item.subjectSegment, id: item.subjectId, authorId: null };
  }
}

function Body({ item }: { item: FeedItem }) {
  if (item.kind === 'RUN') return <RunAnnouncement item={item} />;
  if (item.kind === 'RESHARE') return <Reshare item={item} />;
  if (item.kind === 'POST') return <HasherPostCard item={item} />;
  if (item.kind === 'MILESTONE') return <MilestoneCard item={item} />;
  if (item.kind === 'REPORT') return <ReportCard item={item} />;
  return <PhotoCard item={item} />;
}

// The card, and under it what people have done to it (D50).
export function FeedCard({ item }: { item: FeedEntry }) {
  const target = engagementTarget(item);
  return (
    <Card style={styles.overflow}>
      <Body item={item} />
      {target ? (
        <EngagementBar
          segment={target.segment}
          id={target.id}
          initial={item.engagement}
          authorId={target.authorId}
          // A run announcement is a flyer; "seen by" is not what it is for.
          showViews={item.kind !== 'RUN'}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  overflow: { overflow: 'hidden' },
  pad: { padding: 16 },
  // p-4 pb-3
  headPad: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  attribution: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  attributionText: { flex: 1, minWidth: 0 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sm: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  xs: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 24, fontWeight: '400' },
  mt2: { marginTop: 2 },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  // space-y-3 p-4
  runBody: { padding: 16, gap: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.6 },
  live: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  liveText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#171717' },
  runTitle: { fontSize: 18, lineHeight: 23, fontWeight: '600' },
  theme: { fontSize: 15, lineHeight: 22, fontStyle: 'italic', fontWeight: '400' },
  facts: { gap: 8 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  factIcon: { marginTop: 3 },
  factText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  cta: { height: 40, paddingHorizontal: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  quote: { marginTop: 12, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  dashedQuote: { borderStyle: 'dashed' },
  quoteImage: { width: '100%', height: 288 },
  quotePad: { padding: 12 },
  quoteType: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.6 },
  quoteTitle: { marginTop: 2, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  runLink: { paddingHorizontal: 16, paddingVertical: 12 },
  reportTitle: { fontSize: 18, lineHeight: 23, fontWeight: '600' },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  trophy: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  milestoneText: { flex: 1, minWidth: 0 },
});
