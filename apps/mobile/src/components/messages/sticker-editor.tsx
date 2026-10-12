import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { Bold, Italic, Plus, Trash2, Type } from 'lucide-react-native';

import { ColorPalette } from '@/components/messages/color-palette';
import { type ArtFont, type ArtStyle, FONTS, STYLES, type TextLayerData, WordArt } from '@/components/messages/word-art';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/web-ui';
import { useTheme } from '@/hooks/use-theme';

// Make a sticker from a picture (D73), the phone's counterpart of the web's
// StickerMaker. Drag and pinch the picture into a rounded square. Add as many pieces
// of text as you like: each one drags, pinches to resize and twists to any angle,
// and has its own colour, font and style (outline, bubble, neon, 3D, banner...). What
// is captured is the finished sticker, 512 px with see-through corners; the picture
// never leaves the phone until it is sent to your tray.

const SHOWN = 300;
const SIZE = 512;
// The web bakes in a 72/512 corner; this is the same proportion at the size shown.
const RADIUS = (72 / 512) * SHOWN;
const MAX_ZOOM = 4;
const MAX_LAYERS = 6;

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(max, Math.max(min, value));
};

let counter = 0;
const newLayer = (text: string): TextLayerData => ({
  id: `t${Date.now().toString(36)}${counter++}`,
  text,
  color: '#ffffff',
  style: 'classic',
  font: 'sans',
  bold: true,
  italic: false,
  upper: false,
});

// One piece of text, with the gestures that move it. Its own position, size and angle
// live here (they change sixty times a second and nothing else needs them).
function TextLayer({
  layer,
  startY,
  selected,
  showFrame,
  onSelect,
}: {
  layer: TextLayerData;
  startY: number;
  selected: boolean;
  showFrame: boolean;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const angle = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedAngle = useSharedValue(0);

  const pan = Gesture.Pan()
    .onBegin(() => {
      runOnJS(onSelect)(layer.id);
    })
    .onStart(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    })
    .onUpdate((e) => {
      x.value = savedX.value + e.translationX;
      y.value = savedY.value + e.translationY;
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 0.3, 6);
    });
  const twist = Gesture.Rotation()
    .onStart(() => {
      savedAngle.value = angle.value;
    })
    .onUpdate((e) => {
      angle.value = savedAngle.value + e.rotation;
    });

  const moved = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${angle.value}rad` }, { scale: scale.value }],
  }));

  return (
    // Only the words take touches: the picture underneath still moves from anywhere else.
    <View pointerEvents="box-none" style={[styles.layerRow, { top: startY }]}>
      <GestureDetector gesture={Gesture.Simultaneous(pan, pinch, twist)}>
        <Animated.View style={moved} testID="text-layer">
          <View style={selected && showFrame ? [styles.frame, { borderColor: theme.primary }] : styles.noFrame}>
            <WordArt layer={layer} />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

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
  const [layers, setLayers] = useState<TextLayerData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = layers.find((l) => l.id === selectedId) ?? null;

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
    .maxPointers(1)
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

  const movedPicture = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  function reset() {
    // `.set()` rather than `.value =`: the React Compiler rules out writing to a
    // shared value from ordinary component code, and this is that.
    scale.set(1);
    x.set(0);
    y.set(0);
    setLayers([]);
    setSelectedId(null);
    setPalette(false);
  }

  function leave() {
    if (busy) return;
    reset();
    onCancel();
  }

  function add() {
    if (layers.length >= MAX_LAYERS) {
      Alert.alert('That is plenty', `A sticker can have ${MAX_LAYERS} pieces of text.`);
      return;
    }
    const layer = newLayer('Your text');
    setLayers((current) => [...current, layer]);
    setSelectedId(layer.id);
  }

  function change(patch: Partial<TextLayerData>) {
    if (!selected) return;
    setLayers((current) => current.map((l) => (l.id === selected.id ? { ...l, ...patch } : l)));
  }

  function remove() {
    if (!selected) return;
    setLayers((current) => current.filter((l) => l.id !== selected.id));
    setSelectedId(null);
    setPalette(false);
  }

  async function make() {
    if (busy || !canvas.current) return;
    setBusy(true);
    // The frame that shows which text is selected is not part of the sticker.
    setCapturing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 80));
      // A transparent background is what keeps the rounded corners see-through.
      const uri = await captureRef(canvas, { format: 'png', quality: 1, result: 'tmpfile', width: SIZE, height: SIZE });
      await onDone(uri);
      reset();
    } catch (err) {
      Alert.alert('Could not make that sticker', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setCapturing(false);
      setBusy(false);
    }
  }

  const chip = (label: string, on: boolean, onPress: () => void, key: string, extra?: object) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.chip, { borderColor: on ? theme.primary : theme.border, backgroundColor: on ? theme.backgroundElement : 'transparent' }]}>
      <ThemedText style={[styles.chipText, on && { fontWeight: '700' }, extra]}>{label}</ThemedText>
    </Pressable>
  );

  const toggle = (on: boolean, label: string, onPress: () => void, children: React.ReactNode) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.tool, { borderColor: on ? theme.primary : theme.border, backgroundColor: on ? theme.backgroundElement : 'transparent' }]}>
      {children}
    </Pressable>
  );

  return (
    <Modal visible={picture !== null} animationType="slide" onRequestClose={leave} statusBarTranslucent>
      <GestureHandlerRootView style={[styles.screen, { backgroundColor: theme.background }]}>
        <ThemedText style={styles.title}>Make a sticker</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Drag the picture to move it, pinch to zoom. Drag text to move it, pinch to resize, twist to turn it.
        </ThemedText>

        <View style={[styles.checker, { backgroundColor: theme.backgroundElement, borderRadius: RADIUS }]}>
          {/* Everything inside this view is what gets captured. */}
          <View ref={canvas} collapsable={false} style={[styles.canvas, { borderRadius: RADIUS }]} testID="sticker-canvas">
            <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
              <View style={styles.fill}>
                {picture && (
                  <Animated.View style={[{ width: w, height: h }, movedPicture]}>
                    <Image source={{ uri: picture.uri }} style={{ width: w, height: h }} resizeMode="cover" accessibilityIgnoresInvertColors />
                  </Animated.View>
                )}
              </View>
            </GestureDetector>
            {layers.map((layer, i) => (
              <TextLayer
                key={layer.id}
                layer={layer}
                startY={SHOWN * 0.32 + (i % 4) * 46}
                selected={layer.id === selectedId}
                showFrame={!capturing}
                onSelect={setSelectedId}
              />
            ))}
          </View>
        </View>

        {/* The controls scroll; the sticker above does not, so dragging on it never scrolls the page. */}
        <ScrollView style={styles.controls} contentContainerStyle={styles.controlsInner} keyboardShouldPersistTaps="handled">
          <View style={styles.row}>
            <Pressable accessibilityRole="button" testID="sticker-add-text" onPress={add} style={[styles.add, { borderColor: theme.border }]}>
              <Plus size={16} color={theme.text} />
              <ThemedText style={styles.chipText}>Add text</ThemedText>
            </Pressable>
            {selected && (
              <Pressable accessibilityRole="button" accessibilityLabel="Delete this text" testID="sticker-delete-text" onPress={remove} style={styles.bin} hitSlop={8}>
                <Trash2 size={20} color={theme.danger} />
              </Pressable>
            )}
          </View>

          {selected ? (
            <>
              <TextInput
                value={selected.text}
                maxLength={30}
                onChangeText={(text) => change({ text: text.replace(/\n/g, ' ') })}
                placeholder="Your text"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Words on the sticker"
                testID="sticker-words"
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
              />

              <View style={styles.row}>
                {toggle(palette, 'Colour', () => setPalette((p) => !p), <View style={[styles.swatch, { backgroundColor: selected.color, borderColor: theme.border }]} />)}
                {toggle(selected.bold, 'Bold', () => change({ bold: !selected.bold }), <Bold size={18} color={theme.text} />)}
                {toggle(selected.italic, 'Italic', () => change({ italic: !selected.italic }), <Italic size={18} color={theme.text} />)}
                {toggle(selected.upper, 'Capitals', () => change({ upper: !selected.upper }), <Type size={18} color={theme.text} />)}
              </View>
              {palette && <ColorPalette value={selected.color} onChange={(color) => change({ color })} />}

              <ThemedText themeColor="textSecondary" style={styles.label}>
                Style
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {STYLES.map((s) => chip(s.label, selected.style === s.id, () => change({ style: s.id as ArtStyle }), s.id))}
              </ScrollView>
              <ThemedText themeColor="textSecondary" style={styles.label}>
                Font
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {FONTS.map((f) => chip(f.label, selected.font === f.id, () => change({ font: f.id as ArtFont }), f.id))}
              </ScrollView>
            </>
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              {layers.length ? 'Tap a piece of text on the sticker to change it.' : 'Press Add text to put words on the sticker.'}
            </ThemedText>
          )}
        </ScrollView>

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
  screen: { flex: 1, alignItems: 'center', paddingTop: 48, paddingHorizontal: 20, paddingBottom: 16, gap: 10 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  checker: { width: SHOWN, height: SHOWN, overflow: 'hidden' },
  canvas: { width: SHOWN, height: SHOWN, overflow: 'hidden', backgroundColor: 'transparent' },
  fill: { width: SHOWN, height: SHOWN, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  layerRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  frame: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 6 },
  noFrame: { borderWidth: 1.5, borderColor: 'transparent' },
  controls: { flex: 1, width: '100%' },
  controlsInner: { gap: 12, paddingBottom: 8, alignItems: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  bin: { marginLeft: 'auto', padding: 6 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
  tool: { width: 44, height: 40, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  chips: { gap: 8, paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
  chipText: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 12 },
});
