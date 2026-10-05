import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar } from '@/components/feed/avatar';
import { Icon } from '@/components/icon';
import { EngagementBar } from '@/components/social/engagement-bar';
import { LinkPreviewCard } from '@/components/social/link-preview-card';
import { PollCard } from '@/components/social/poll-card';
import { RichText } from '@/components/social/rich-text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WEB_URL } from '@/lib/api';
import { brandColor, formatDate } from '@/lib/format';
import type { FeedEntry, FeedItem, SubjectSegment } from '@/lib/types';

// One card in the community feed (D42): a run announcement, a trail report, a
// photo, a hasher's post, or a reshare of any of those. Mirrors
// apps/web/components/feed/FeedCard.tsx's Body switch and engagement-target
// mapping so the two clients agree on what a like on a feed card means.

function Attribution({
  name,
  authorId,
  kennel,
  at,
  iconName,
}: {
  name: string | null;
  authorId?: string | null;
  kennel: FeedItem['kennel'];
  at: string;
  iconName: Parameters<typeof Icon>[0]['name'];
}) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={styles.attribution}>
      <Avatar name={name ?? kennel?.shortName ?? 'Hash'} size={36} color={brandColor(kennel?.primaryColor)} />
      <View style={styles.attributionText}>
        <View style={styles.nameRow}>
          <Pressable disabled={!authorId} accessibilityRole={authorId ? 'link' : undefined} onPress={() => authorId && router.push(`/hashers/${authorId}`)}>
            <ThemedText type="smallBold" numberOfLines={1}>{name ?? 'A hasher'}</ThemedText>
          </Pressable>
          {kennel ? (
            <Pressable accessibilityRole="link" onPress={() => router.push(`/kennels/${kennel.slug}`)}>
              <ThemedText type="small" style={{ color: theme.primaryStrong }}> · {kennel.shortName}</ThemedText>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <Icon name={iconName} size={13} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">{formatDate(at)}</ThemedText>
        </View>
      </View>
    </View>
  );
}

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
      return { segment: 'runs', id: item.id, authorId: null };
    case 'POST':
      return { segment: 'posts', id: item.id, authorId: item.authorId };
    case 'RESHARE':
      return { segment: item.subjectSegment, id: item.subjectId, authorId: null };
  }
}

const subjectWords: Record<string, string> = {
  REEL: 'Reel',
  POST: 'Post',
  TRAIL_REPORT: 'Trail report',
  MEDIA_ASSET: 'Photo',
  RUN: 'Run',
  RUN_CAPSULE: 'Run Capsule',
};

function RunAnnouncement({ item }: { item: Extract<FeedItem, { kind: 'RUN' }> }) {
  const theme = useTheme();
  const router = useRouter();
  const heading = item.runNumber ? `Run #${item.runNumber}` : 'Next run';
  const venue = [item.meetingPointName, item.meetingAddress].filter(Boolean).join(', ');
  return (
    <>
      <View style={styles.padded}>
        <Attribution name={item.kennel?.shortName ?? 'A kennel'} kennel={item.kennel} at={item.at} iconName={{ ios: 'megaphone', android: 'campaign', web: 'campaign' }} />
      </View>
      {item.posterUrl ? <Image source={{ uri: item.posterUrl }} style={styles.wideImage} /> : null}
      <View style={[styles.padded, { gap: Spacing.two }]}>
        <View style={styles.row}>
          <ThemedText type="small" style={{ color: theme.primaryStrong, textTransform: 'uppercase' }}>{heading}</ThemedText>
          {item.happeningNow && (
            <View style={[styles.liveChip, { backgroundColor: theme.accent }]}>
              <ThemedText type="small" style={styles.liveChipText}>On trail now</ThemedText>
            </View>
          )}
        </View>
        <ThemedText type="subtitle">{item.title}</ThemedText>
        {item.theme ? <ThemedText themeColor="textSecondary" style={{ fontStyle: 'italic' }}>{item.theme}</ThemedText> : null}
        <ThemedText themeColor="textSecondary">{venue || `${item.city}, ${item.country}`}</ThemedText>
        {item.hares.length > 0 && (
          <ThemedText themeColor="textSecondary">{item.hares.length === 1 ? 'Hare: ' : 'Hares: '}{item.hares.join(', ')}</ThemedText>
        )}
        {item.description ? <ThemedText>{item.description}</ThemedText> : null}
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/run/${item.id}`)}
            style={[styles.cta, { backgroundColor: theme.primary }]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              {item.happeningNow ? 'On On — catch them up' : 'On On — I’m coming'}
            </ThemedText>
          </Pressable>
          {item.goingCount > 0 && (
            <ThemedText type="small" themeColor="textSecondary">{item.goingCount} {item.goingCount === 1 ? 'hasher is' : 'hashers are'} coming</ThemedText>
          )}
        </View>
      </View>
    </>
  );
}

function Reshare({ item }: { item: Extract<FeedItem, { kind: 'RESHARE' }> }) {
  const theme = useTheme();
  const router = useRouter();
  const original = item.original;

  // What has a screen of its own opens there; the rest (a report, a capsule)
  // still reads on the web.
  function openOriginal() {
    if (!original) return;
    if (original.type === 'POST') router.push(`/posts/${original.id}`);
    else if (original.type === 'REEL') router.push(`/reels/${original.id}`);
    else if (original.type === 'RUN') router.push(`/run/${original.id}`);
    else Linking.openURL(`${WEB_URL}${original.href}`);
  }
  return (
    <View style={styles.padded}>
      <Attribution name={item.sharer.name} authorId={item.sharer.id} kennel={null} at={item.at} iconName={{ ios: 'arrow.2.squarepath', android: 'repeat', web: 'repeat' }} />
      {item.commentary ? <ThemedText style={{ marginTop: Spacing.two }}>{item.commentary}</ThemedText> : null}
      {original ? (
        <Pressable
          accessibilityRole="link"
          onPress={openOriginal}
          style={[styles.quoteCard, { borderColor: theme.border }]}>
          {original.imageUrl ? <Image source={{ uri: original.imageUrl }} style={styles.quoteImage} /> : null}
          <View style={styles.quotePad}>
            <ThemedText type="small" themeColor="textSecondary" style={{ textTransform: 'uppercase' }}>
              {subjectWords[original.type] ?? 'Post'}{original.author ? ` by ${original.author}` : ''}
            </ThemedText>
            <ThemedText type="smallBold">{original.title}</ThemedText>
            {original.excerpt ? <ThemedText type="small" themeColor="textSecondary">{original.excerpt}</ThemedText> : null}
          </View>
        </Pressable>
      ) : (
        <View style={[styles.quoteCard, styles.quotePad, { borderColor: theme.border, borderStyle: 'dashed' }]}>
          <ThemedText themeColor="textSecondary">The original is no longer available.</ThemedText>
        </View>
      )}
    </View>
  );
}

function HasherPostCard({ item }: { item: Extract<FeedItem, { kind: 'POST' }> }) {
  const router = useRouter();
  const many = item.photos.length > 1;
  return (
    <>
      <View style={styles.padded}>
        <Attribution name={item.author} authorId={item.authorId} kennel={item.kennel} at={item.at} iconName={{ ios: 'bubble.left', android: 'chat_bubble', web: 'chat_bubble' }} />
        <Pressable accessibilityRole="link" accessibilityLabel="Open this post" onPress={() => router.push(`/posts/${item.id}`)}>
          <RichText text={item.body} style={{ marginTop: Spacing.two }} />
          {item.edited ? <ThemedText type="small" themeColor="textSecondary">edited</ThemedText> : null}
        </Pressable>
        {item.poll ? <PollCard postId={item.id} initial={item.poll} /> : null}
        {item.linkPreview ? <LinkPreviewCard preview={item.linkPreview} /> : null}
      </View>
      {item.photos.length > 0 && (
        <View style={many ? styles.photoGrid : undefined}>
          {item.photos.map((p) => (
            <Image key={p.id} source={{ uri: p.url }} style={many ? styles.gridImage : styles.wideImage} />
          ))}
        </View>
      )}
      {item.run && (
        <Pressable accessibilityRole="link" onPress={() => router.push(`/run/${item.run!.id}`)} style={styles.runLink}>
          <ThemedText type="smallBold">Run #{item.run.runNumber ?? '—'}{item.run.title ? ` · ${item.run.title}` : ''}</ThemedText>
        </Pressable>
      )}
    </>
  );
}

function ReportCard({ item }: { item: Extract<FeedItem, { kind: 'REPORT' }> }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={styles.padded}>
      <Attribution name={item.author} authorId={item.authorId} kennel={item.kennel} at={item.at} iconName={{ ios: 'book', android: 'menu_book', web: 'menu_book' }} />
      <ThemedText type="subtitle" style={{ marginTop: Spacing.two }}>{item.title}</ThemedText>
      {item.run ? (
        <ThemedText themeColor="textSecondary">Run #{item.run.runNumber ?? '—'}{item.run.title ? ` · ${item.run.title}` : ''}</ThemedText>
      ) : null}
      {item.excerpt ? <ThemedText style={{ marginTop: Spacing.one }}>{item.excerpt}</ThemedText> : null}
      <Pressable accessibilityRole="link" onPress={() => router.push(`/trail-reports/${item.id}` as never)} style={styles.readMore}>
        <ThemedText type="smallBold" style={{ color: theme.primaryStrong }}>Read the trail report →</ThemedText>
      </Pressable>
    </View>
  );
}

function PhotoCard({ item }: { item: Extract<FeedItem, { kind: 'PHOTO' }> }) {
  return (
    <>
      <View style={styles.padded}>
        <Attribution name={item.author} authorId={item.authorId} kennel={item.kennel} at={item.at} iconName={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }} />
        {item.caption ? <ThemedText style={{ marginTop: Spacing.two }}>{item.caption}</ThemedText> : null}
      </View>
      <Image source={{ uri: item.url }} style={styles.wideImage} />
    </>
  );
}

// A hasher passing 10, 50, 100 runs (D60). News, so there is no bar under it.
function MilestoneCard({ item }: { item: Extract<FeedItem, { kind: 'MILESTONE' }> }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.padded, styles.row]}>
      <View style={[styles.trophy, { backgroundColor: theme.accent }]}>
        <ThemedText style={styles.trophyText}>🏆</ThemedText>
      </View>
      <View style={styles.milestoneText}>
        <ThemedText>
          <ThemedText type="smallBold" onPress={() => router.push(`/hashers/${item.hasher.id}`)}>{item.hasher.name}</ThemedText>
          {' '}has run <ThemedText type="smallBold">{item.threshold} trails</ThemedText>. On On!
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {item.run ? `Run #${item.run.runNumber ?? '—'}${item.run.title ? ` · ${item.run.title}` : ''} · ` : ''}
          {formatDate(item.at)}
        </ThemedText>
      </View>
    </View>
  );
}

export function FeedCard({ item }: { item: FeedEntry }) {
  const theme = useTheme();
  const target = engagementTarget(item);
  if (!target) {
    return (
      <ThemedView type="card" style={[styles.card, { borderColor: theme.border }]}>
        {item.kind === 'MILESTONE' ? <MilestoneCard item={item} /> : null}
      </ThemedView>
    );
  }
  return (
    <ThemedView type="card" style={[styles.card, { borderColor: theme.border }]}>
      {item.kind === 'RUN' ? <RunAnnouncement item={item} /> : null}
      {item.kind === 'RESHARE' ? <Reshare item={item} /> : null}
      {item.kind === 'POST' ? <HasherPostCard item={item} /> : null}
      {item.kind === 'REPORT' ? <ReportCard item={item} /> : null}
      {item.kind === 'PHOTO' ? <PhotoCard item={item} /> : null}
      <EngagementBar segment={target.segment} id={target.id} initial={item.engagement} authorId={target.authorId} showViews={item.kind !== 'RUN'} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderTopWidth: 1, borderBottomWidth: 1, borderRadius: 0, overflow: 'hidden' },
  padded: { padding: Spacing.three },
  attribution: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  attributionText: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  wideImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#0000000a' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridImage: { width: '50%', aspectRatio: 1, backgroundColor: '#0000000a' },
  liveChip: { borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  liveChipText: { color: '#171717' },
  cta: { minHeight: 40, paddingHorizontal: Spacing.three, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  quoteCard: { borderWidth: 1, borderRadius: 12, marginTop: Spacing.two, overflow: 'hidden' },
  quoteImage: { width: '100%', aspectRatio: 16 / 9 },
  quotePad: { padding: Spacing.three, gap: 2 },
  runLink: { padding: Spacing.three, paddingTop: 0 },
  readMore: { marginTop: Spacing.two, minHeight: 32 },
  trophy: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  trophyText: { fontSize: 24, lineHeight: 30 },
  milestoneText: { flex: 1, minWidth: 0, gap: 2 },
});
