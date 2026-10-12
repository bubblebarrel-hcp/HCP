import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';

// Make a sticker from a picture (D73), the phone's counterpart of the web's
// StickerMaker: drag and pinch the picture into a rounded square, add a few words
// if you like, and what is captured is the finished sticker, 512 px with
// see-through corners. The picture never leaves the phone until it is sent to your
// tray.

const SHOWN = 300;
const SIZE = 512;
// The web bakes in a 72/512 corner; this is the same proportion at the size shown.
const RADIUS = (72 / 512) * SHOWN;
const MAX_ZOOM = 4;

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(max, Math.max(min, value));
};

export function StickerEditor({
  picture,
  onCancel,
  onDone,
}: {
  // The chosen picture, with the size the picker measured. Null keeps it closed.
  picture: { uri: string; width: number; height: number } | null;
  onCancel: () => void;
  // The finished sticker, a file on the phone.
  onDone: (uri: string) => Promise<void> | void;
}) {
  const theme = useTheme();
  const canvas = useRef<View>(null);
  const [text, setText] = useState('');
  const [light, setLight] = useState(true);
  const [busy, setBusy] = useState(false);

  // The picture is first laid to cover the square; the gestures move it from there.
  const cover = picture ? Math.max(SHOWN / picture.width, SHOWN / picture.height) : 1;
  const w = picture ? picture.width * cover : SHOWN;
  const h = picture ? picture.height * cover : SHOWN;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  // Never leave an empty edge: the picture always covers the square.
  const keepInside = () => {
    'worklet';
    const maxX = Math.max(0, (w * scale.value - SHOWN) / 2);
    const maxY = Math.max(0, (h * scale.value - SHOWN) / 2);
    x.value = clamp(x.value, -maxX, maxX);
    y.value = clamp(y.value, -maxY, maxY);
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    })
    .onUpdate((e) => {
      x.value = savedX.value + e.translationX;
      y.value = savedY.value + e.translationY;
      keepInside();
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 1, MAX_ZOOM);
      keepInside();
    });

  const moved = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  function reset() {
    // `.set()` rather than `.value =`: the React Compiler rules out writing to a
    // shared value from ordinary component code, and this is that.
    scale.set(1);
    x.set(0);
    y.set(0);
    setText('');
  }

  function leave() {
    if (busy) return;
    reset();
    onCancel();
  }

  async function make() {
    if (busy || !canvas.current) return;
    setBusy(true);
    try {
      // A transparent background is what keeps the rounded corners see-through.
      const uri = await captureRef(canvas, { format: 'png', quality: 1, result: 'tmpfile', width: SIZE, height: SIZE });
      await onDone(uri);
      reset();
    } catch (err) {
      Alert.alert('Could not make that sticker', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  const words = text.trim();
  const fill = light ? '#ffffff' : '#111111';
  const edge = light ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
  // React Native has no text outline, so the words are drawn four times in the edge
  // colour, nudged a little each way, with the real ones on top.
  const outline = [
    { left: -2, top: 0 },
    { left: 2, top: 0 },
    { left: 0, top: -2 },
    { left: 0, top: 2 },
  ];

  return (
    <Modal visible={picture !== null} animationType="slide" onRequestClose={leave} statusBarTranslucent>
      <GestureHandlerRootView style={[styles.screen, { backgroundColor: theme.background }]}>
        <ThemedText style={styles.title}>Make a sticker</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Drag to move the picture and pinch to zoom.
        </ThemedText>

        <View style={[styles.checker, { backgroundColor: theme.backgroundElement, borderRadius: RADIUS }]}>
          {/* Everything inside this view is what gets captured. */}
          <View ref={canvas} collapsable={false} style={[styles.canvas, { borderRadius: RADIUS }]} testID="sticker-canvas">
            <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
              <View style={styles.fill}>
                {picture && (
                  <Animated.View style={[{ width: w, height: h }, moved]}>
                    <Image source={{ uri: picture.uri }} style={{ width: w, height: h }} resizeMode="cover" accessibilityIgnoresInvertColors />
                  </Animated.View>
                )}
              </View>
            </GestureDetector>
            {words ? (
              <View style={styles.words} pointerEvents="none">
                {outline.map((o, i) => (
                  <ThemedText key={i} numberOfLines={1} adjustsFontSizeToFit style={[styles.text, styles.ghost, { color: edge, ...o }]}>
                    {words}
                  </ThemedText>
                ))}
                <ThemedText numberOfLines={1} adjustsFontSizeToFit style={[styles.text, { color: fill }]}>
                  {words}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.row}>
          <TextInput
            value={text}
            maxLength={40}
            onChangeText={setText}
            placeholder="Words on the sticker (optional)"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Words on the sticker"
            testID="sticker-words"
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: light }}
            testID="sticker-colour"
            onPress={() => setLight((v) => !v)}
            style={[styles.colour, { borderColor: theme.border }]}>
            <View style={[styles.swatch, { backgroundColor: fill, borderColor: theme.border }]} />
            <ThemedText style={styles.small}>{light ? 'White' : 'Black'}</ThemedText>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Button variant="ghost" onPress={leave} disabled={busy} testID="sticker-cancel">
            Cancel
          </Button>
          <Button onPress={() => void make()} disabled={busy} testID="sticker-make">
            {busy ? <ActivityIndicator size="small" color={theme.onPrimary} /> : 'Make sticker'}
          </Button>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 18, marginTop: -8 },
  checker: { width: SHOWN, height: SHOWN, overflow: 'hidden' },
  canvas: { width: SHOWN, height: SHOWN, overflow: 'hidden', backgroundColor: 'transparent' },
  fill: { width: SHOWN, height: SHOWN, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  words: { position: 'absolute', left: 16, right: 16, bottom: 20, alignItems: 'center', justifyContent: 'center', height: 44 },
  text: { fontSize: 34, lineHeight: 42, fontWeight: '900', textAlign: 'center', width: '100%' },
  ghost: { position: 'absolute' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, width: SHOWN },
  input: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  colour: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1 },
  small: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
});
