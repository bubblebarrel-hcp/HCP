import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { hslToHex } from '@/components/messages/word-art';
import { useTheme } from '@/hooks/use-theme';

// A palette that opens from the colour button (D73): thirty ready colours, and under
// them a strip of every hue and a strip from dark to light, for any colour that is
// not there. Dragging along a strip picks as it goes.

export const SWATCHES = [
  '#ffffff', '#000000', '#f4511e', '#ff1744', '#ff4081', '#e040fb', '#7c4dff', '#3d5afe', '#2979ff', '#00b0ff',
  '#00e5ff', '#1de9b6', '#00e676', '#76ff03', '#c6ff00', '#ffea00', '#ffc400', '#ff9100', '#8d6e63', '#9e9e9e',
  '#d9a441', '#3f6b4f', '#ffcdd2', '#f8bbd0', '#d1c4e9', '#bbdefb', '#c8e6c9', '#fff9c4', '#ffe0b2', '#cfd8dc',
];

const WIDTH = 280;
const HEIGHT = 28;
const HUES = [0, 60, 120, 180, 240, 300, 360];

function Strip({ stops, at, onPick }: { stops: string[]; at: number; onPick: (fraction: number) => void }) {
  const theme = useTheme();
  // Runs on the JS thread: all it does is hand a number back.
  const drag = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => onPick(Math.max(0, Math.min(1, e.x / WIDTH))))
    .onUpdate((e) => onPick(Math.max(0, Math.min(1, e.x / WIDTH))));
  return (
    <GestureDetector gesture={drag}>
      <View style={[styles.strip, { borderColor: theme.border }]}>
        <Svg width={WIDTH} height={HEIGHT}>
          <Defs>
            <LinearGradient id="g" x1="0" y1="0" x2="1" y2="0">
              {stops.map((c, i) => (
                <Stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={WIDTH} height={HEIGHT} rx={14} fill="url(#g)" />
        </Svg>
        <View pointerEvents="none" style={[styles.thumb, { left: at * (WIDTH - 24) }]} />
      </View>
    </GestureDetector>
  );
}

export function ColorPalette({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const theme = useTheme();
  const [hue, setHue] = useState(20);
  const [light, setLight] = useState(0.5);

  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]} testID="color-palette">
      <View style={styles.grid}>
        {SWATCHES.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Colour ${c}`}
            accessibilityState={{ selected: value.toLowerCase() === c }}
            onPress={() => onChange(c)}
            style={[styles.swatch, { backgroundColor: c, borderColor: value.toLowerCase() === c ? theme.primary : theme.border, borderWidth: value.toLowerCase() === c ? 3 : 1 }]}
          />
        ))}
      </View>
      <Strip
        stops={HUES.map((h) => hslToHex(h, 100, 50))}
        at={hue / 360}
        onPick={(f) => {
          setHue(f * 360);
          onChange(hslToHex(f * 360, 100, light * 100));
        }}
      />
      <Strip
        stops={['#000000', hslToHex(hue, 100, 50), '#ffffff']}
        at={light}
        onPick={(f) => {
          setLight(f);
          onChange(hslToHex(hue, 100, f * 100));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 12, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: WIDTH, justifyContent: 'center' },
  swatch: { width: 22, height: 22, borderRadius: 11 },
  strip: { width: WIDTH, height: HEIGHT, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  thumb: { position: 'absolute', top: 2, width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: '#ffffff', backgroundColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, elevation: 3 },
});
