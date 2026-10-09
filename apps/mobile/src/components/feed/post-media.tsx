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
import { Play } from 'lucide-react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const [started, setStarted] = useState(false);
  const theme = useTheme();

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
  return <ClipPlayer url={item.url} width={width} height={height} />;
}

function ClipPlayer({ url, width, height }: { url: string; width: number; height: number }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ width, height, backgroundColor: '#000' }}
      contentFit="contain"
      nativeControls
      fullscreenOptions={{ enable: true }}
      allowsPictureInPicture
      accessibilityLabel="Post video"
    />
  );
}

function Carousel({ items, width, height }: { items: PostPhoto[]; width: number; height: number }) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);

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
            <Image
              key={item.id}
              source={{ uri: item.url }}
              style={{ width, height, backgroundColor: '#000' }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessibilityLabel={`Picture ${i + 1} of ${items.length}`}
            />
          ),
        )}
      </ScrollView>

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
  const theme = useTheme();
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
  return (
    <View testID="post-media">
      <Image
        source={{ uri: item.url }}
        style={{ backgroundColor: theme.backgroundElement, width, height: Math.min(width * 1.1, tallest) }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
