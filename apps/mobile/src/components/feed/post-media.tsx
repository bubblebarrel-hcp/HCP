import { useEffect, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Play, Volume2, VolumeX } from 'lucide-react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import { ThemedText } from '@/components/themed-text';
import { PhotoViewer } from '@/components/ui/photo-viewer';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDevicePrefs } from '@/lib/device-prefs';
import { pickVideoSource } from '@/lib/video-quality';
import type { PostPhoto } from '@/lib/types';

// The pictures and the clip on a post, edge to edge under its words (web
// components/feed/PostMedia.tsx). One item fills the width. Several are a
// carousel: a row of full-width slides you swipe through, one at a time, with a
// counter and dots. Every slide gets the same 4:5 frame with the item fitted
// inside it, so the post does not change height as you swipe and nothing is cropped.
//
// A clip in a feed is its poster frame with a play button, and only becomes a
// player when it is tapped: a feed of live players would load every clip on the
// page, and Android shows a black rectangle for one that has not started.

function Clip({
  item,
  width,
  height,
  active = true,
}: {
  item: PostPhoto;
  width: number;
  height: number;
  // False once the carousel has moved off this slide: it goes back to its poster,
  // which stops it, so two never play over each other.
  active?: boolean;
}) {
  const [prefs] = useDevicePrefs();
  const theme = useTheme();
  // Autoplay opens the clip, silent, as soon as it is on screen; data saver
  // and a slide that is off screen always wait for a tap.
  const [started, setStarted] = useState(prefs.autoplay && !prefs.dataSaver);

  useEffect(() => {
    if (!active) setStarted(false);
  }, [active]);

  if (!started) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Play video"
        testID="post-video"
        onPress={() => setStarted(true)}
        style={{ width, height, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : null}
        <View style={[styles.play, { backgroundColor: theme.primary }]}>
          <Play size={26} color={theme.onPrimary} fill={theme.onPrimary} />
        </View>
      </Pressable>
    );
  }
  return <ClipPlayer url={pickVideoSource(item.url, item.renditions, prefs.quality, prefs.dataSaver)} width={width} height={height} muted={prefs.startMuted || prefs.autoplay} />;
}

function ClipPlayer({ url, width, height, muted: startMuted }: { url: string; width: number; height: number; muted: boolean }) {
  const [muted, setMuted] = useState(startMuted);
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.muted = startMuted;
    p.play();
  });

  // Android's native controls have no mute button, so there is one of ours on
  // the corner of every clip.
  const toggle = () => {
    // expo-video players are mutated by design; the hook rule cannot know that.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = !muted;
    setMuted(!muted);
  };

  return (
    <View style={{ width, height }}>
      <VideoView
        player={player}
        style={{ width, height, backgroundColor: '#000' }}
        contentFit="contain"
        nativeControls
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture
        accessibilityLabel="Post video"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
        accessibilityState={{ selected: muted }}
        testID="post-video-mute"
        onPress={toggle}
        hitSlop={8}
        style={styles.mute}>
        {muted ? <VolumeX size={18} color="#fff" /> : <Volume2 size={18} color="#fff" />}
      </Pressable>
    </View>
  );
}

// Tapping a picture opens it full screen (PhotoViewer), which pages through every
// item of the post, clips included.
function useViewer(items: PostPhoto[]) {
  const [open, setOpen] = useState<number | null>(null);
  return {
    show: (item: PostPhoto) => setOpen(Math.max(0, items.indexOf(item))),
    viewer: (
      <PhotoViewer
        photos={items.map((p) => ({ url: p.url, kind: p.kind === 'VIDEO' ? 'VIDEO' : undefined, poster: p.thumbnailUrl ?? undefined }))}
        index={open ?? 0}
        visible={open !== null}
        onClose={() => setOpen(null)}
      />
    ),
  };
}

function Carousel({ items, width, height }: { items: PostPhoto[]; width: number; height: number }) {
  const [index, setIndex] = useState(0);
  const { show, viewer } = useViewer(items);

  const onEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={{ width, height, backgroundColor: '#000' }} testID="post-carousel">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
        // Swiping the row must not also scroll the feed it sits in.
        nestedScrollEnabled
        decelerationRate="fast">
        {items.map((item, i) =>
          item.kind === 'VIDEO' ? (
            <Clip key={item.id} item={item} width={width} height={height} active={i === index} />
          ) : (
            <Pressable
              key={item.id}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Picture ${i + 1} of ${items.length}, open full screen`}
              testID="post-photo"
              onPress={() => show(item)}>
              <Image
                source={{ uri: item.url }}
                style={{ width, height, backgroundColor: '#000' }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </Pressable>
          ),
        )}
      </ScrollView>
      {viewer}

      <View style={styles.counter} pointerEvents="none">
        <ThemedText style={styles.counterText} testID="post-carousel-count">
          {index + 1} / {items.length}
        </ThemedText>
      </View>

      <View style={styles.dots} pointerEvents="none">
        {items.map((item, i) => (
          <View
            key={item.id}
            style={[styles.dot, { backgroundColor: i === index ? '#fff' : 'rgba(255,255,255,0.5)' }]}
          />
        ))}
      </View>
    </View>
  );
}

export function PostMedia({ items, tallest = 576 }: { items: PostPhoto[]; tallest?: number }) {
  const { width: screen } = useWindowDimensions();
  if (items.length === 0) return null;

  const width = Math.min(screen, MaxContentWidth);

  if (items.length > 1) {
    return <Carousel items={items} width={width} height={Math.min(Math.round(width * 1.25), tallest)} />;
  }

  const [item] = items;
  // A phone-shaped clip would run off the screen at full width, so it is held to
  // a 4:5 frame and letterboxed inside it.
  if (item.kind === 'VIDEO') {
    return (
      <View testID="post-media">
        <Clip item={item} width={width} height={Math.min(Math.round(width * 1.25), tallest)} />
      </View>
    );
  }
  return <SinglePhoto item={item} width={width} height={Math.min(width * 1.1, tallest)} />;
}

function SinglePhoto({ item, width, height }: { item: PostPhoto; width: number; height: number }) {
  const theme = useTheme();
  const { show, viewer } = useViewer([item]);
  return (
    <View testID="post-media">
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel="Open photo full screen"
        testID="post-photo"
        onPress={() => show(item)}>
        <Image
          source={{ uri: item.url }}
          style={{ backgroundColor: theme.backgroundElement, width, height }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      </Pressable>
      {viewer}
    </View>
  );
}

const styles = StyleSheet.create({
  mute: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  play: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', opacity: 0.92 },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  counterText: { color: '#fff', fontSize: 12, lineHeight: 18, fontWeight: '500' },
  dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
