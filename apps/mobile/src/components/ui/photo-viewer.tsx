import { useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';

// A picture or clip filling the screen (posts, profile pictures, kennel logos, run
// and profile photos). Pinch or double-tap to zoom a picture, drag to look around once
// zoomed, swipe sideways (or tap the arrows) between the items of a post, tap the
// cross (or the system back) to leave. A clip plays with the native controls and cannot be zoomed.
//
// A photo may carry a caption and one action ("Open post"), for a viewer reached from
// somewhere that is not the thing's own page, such as a profile's photo grid.

const MAX_ZOOM = 4;

export type ViewerPhoto = {
  url: string;
  label?: string;
  kind?: 'VIDEO';
  poster?: string;
  caption?: string | null;
  action?: { label: string; onPress: () => void };
};

function ZoomableImage({
  uri,
  label,
  width,
  height,
  onZoomed,
}: {
  uri: string;
  label?: string;
  width: number;
  height: number;
  onZoomed: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  // The pan is only switched on while zoomed. A pan that is merely idle at 1x still
  // claims the touch, and the carousel behind it never sees the swipe.
  const [isZoomed, setIsZoomed] = useState(false);
  const zoomChanged = (zoomed: boolean) => {
    setIsZoomed(zoomed);
    onZoomed(zoomed);
  };

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    x.value = withTiming(0);
    y.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        reset();
        runOnJS(zoomChanged)(false);
      } else {
        savedScale.value = scale.value;
        runOnJS(zoomChanged)(true);
      }
    });

  // Only while zoomed: at 1x a drag belongs to the carousel behind it.
  const pan = Gesture.Pan()
    .enabled(isZoomed)
    .minPointers(1)
    .onUpdate((e) => {
      if (savedScale.value <= 1) return;
      const maxX = (width * (scale.value - 1)) / 2;
      const maxY = (height * (scale.value - 1)) / 2;
      x.value = Math.min(maxX, Math.max(-maxX, savedX.value + e.translationX));
      y.value = Math.min(maxY, Math.max(-maxY, savedY.value + e.translationY));
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        reset();
        runOnJS(zoomChanged)(false);
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
        runOnJS(zoomChanged)(true);
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <Animated.View style={[{ width, height }, style]}>
        <Image
          source={{ uri }}
          style={{ width, height }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessibilityLabel={label ?? 'Photo'}
        />
      </Animated.View>
    </GestureDetector>
  );
}

function ViewerClip({ url, width, height }: { url: string; width: number; height: number }) {
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
      allowsPictureInPicture
      accessibilityLabel="Video"
    />
  );
}

export function PhotoViewer({
  photos,
  index = 0,
  visible,
  onClose,
}: {
  photos: ViewerPhoto[];
  // The item to open on.
  index?: number;
  visible: boolean;
  onClose: () => void;
}) {
  if (photos.length === 0) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Mounted only while open, so every opening starts unzoomed on `index`. */}
      {visible && <ViewerBody photos={photos} index={Math.min(index, photos.length - 1)} onClose={onClose} />}
    </Modal>
  );
}

function ViewerBody({ photos, index, onClose }: { photos: ViewerPhoto[]; index: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  // (Fresh state per opening: this component only exists while the viewer is open.)
  const [current, setCurrent] = useState(index);
  // While a picture is zoomed, a sideways drag moves the picture, not the page.
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    // The scroller mounts with the modal; wait a frame for it.
    const t = setTimeout(() => scroller.current?.scrollTo({ x: index * width, animated: false }), 0);
    return () => clearTimeout(t);
  }, [index, width]);

  const onEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrent(Math.round(event.nativeEvent.contentOffset.x / width));
    setZoomed(false);
  };

  const shown = photos[current];

  const go = (to: number) => {
    if (to < 0 || to >= photos.length) return;
    scroller.current?.scrollTo({ x: to * width, animated: true });
    // A programmatic scroll does not reliably report its end on Android.
    setCurrent(to);
    setZoomed(false);
  };

  return (
    // A Modal is its own native root, so gestures need a root of their own in it.
    <GestureHandlerRootView style={styles.root} testID="photo-viewer">
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed && photos.length > 1}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
        decelerationRate="fast">
        {photos.map((photo, i) =>
          photo.kind === 'VIDEO' ? (
            // Only the clip on screen is a player; the rest are posters, so paging does
            // not start several at once or hold them all in memory.
            i === current ? (
              <ViewerClip key={`${i}-${photo.url}`} url={photo.url} width={width} height={height} />
            ) : (
              <View key={`${i}-${photo.url}`} style={{ width, height, backgroundColor: '#000' }}>
                {photo.poster ? (
                  <Image source={{ uri: photo.poster }} style={{ width, height }} resizeMode="contain" accessibilityIgnoresInvertColors />
                ) : null}
              </View>
            )
          ) : (
            // Keyed by position as well as address: the same picture twice must not share zoom.
            <ZoomableImage
              key={`${i}-${photo.url}`}
              uri={photo.url}
              label={photo.label}
              width={width}
              height={height}
              onZoomed={setZoomed}
            />
          ),
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close photo"
        testID="photo-viewer-close"
        onPress={onClose}
        hitSlop={12}
        style={[styles.close, { top: insets.top + 12 }]}>
        <X size={22} color="#fff" />
      </Pressable>

      {photos.length > 1 && (
        <View style={[styles.counter, { top: insets.top + 16 }]} pointerEvents="none">
          <ThemedText style={styles.counterText}>
            {current + 1} / {photos.length}
          </ThemedText>
        </View>
      )}

      {photos.length > 1 && current > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous"
          testID="photo-viewer-prev"
          onPress={() => go(current - 1)}
          hitSlop={8}
          style={[styles.arrow, { left: 8, top: height / 2 - 20 }]}>
          <ChevronLeft size={24} color="#fff" />
        </Pressable>
      )}
      {photos.length > 1 && current < photos.length - 1 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next"
          testID="photo-viewer-next"
          onPress={() => go(current + 1)}
          hitSlop={8}
          style={[styles.arrow, { right: 8, top: height / 2 - 20 }]}>
          <ChevronRight size={24} color="#fff" />
        </Pressable>
      )}

      {(shown.caption || shown.action) && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {shown.caption ? <ThemedText style={styles.caption}>{shown.caption}</ThemedText> : null}
          {shown.action ? (
            <Pressable
              accessibilityRole="link"
              testID="photo-viewer-action"
              onPress={() => {
                // Leave first, so the page it opens is not behind the viewer.
                onClose();
                shown.action?.onPress();
              }}>
              <ThemedText style={styles.action}>{shown.action.label}</ThemedText>
            </Pressable>
          ) : null}
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  close: {
    position: 'absolute',
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  arrow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  counter: {
    position: 'absolute',
    left: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  counterText: { color: '#fff', fontSize: 12, lineHeight: 18, fontWeight: '500' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  caption: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '400' },
  action: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '600', textDecorationLine: 'underline' },
});
