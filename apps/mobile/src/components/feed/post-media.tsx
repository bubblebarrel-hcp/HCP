import { useState } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Play } from 'lucide-react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PostPhoto } from '@/lib/types';

// The pictures and the clip on a post, edge to edge under its words (web
// components/feed/PostMedia.tsx). One item fills the width; several tile two to a
// row, and a clip takes a whole row so its controls stay usable.
//
// A clip in a feed is its poster frame with a play button, and only becomes a
// player when it is tapped: a feed of live players would load every clip on the
// page, and Android shows a black rectangle for one that has not started.

function Clip({ item, width, height }: { item: PostPhoto; width: number; height: number }) {
  const [started, setStarted] = useState(false);
  const theme = useTheme();

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

export function PostMedia({ items, tallest = 576 }: { items: PostPhoto[]; tallest?: number }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  if (items.length === 0) return null;

  const content = Math.min(width, MaxContentWidth);
  const many = items.length > 1;
  const tile = (content - 2) / 2;

  return (
    <View style={many ? styles.grid : undefined} testID="post-media">
      {items.map((item) => {
        if (item.kind === 'VIDEO') {
          // A phone-shaped clip would run off the screen at full width, so it is
          // held to a 4:5 frame and letterboxed inside it.
          return <Clip key={item.id} item={item} width={content} height={Math.min(Math.round(content * 1.25), tallest)} />;
        }
        return (
          <Image
            key={item.id}
            source={{ uri: item.url }}
            style={[
              { backgroundColor: theme.backgroundElement },
              many ? { width: tile, height: tile } : { width: content, height: Math.min(content * 1.1, tallest) },
            ]}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  play: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', opacity: 0.92 },
});
