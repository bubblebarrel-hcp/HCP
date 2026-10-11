import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BeerMug } from '@/components/feed/beer-mug';
import { ThemedText } from '@/components/themed-text';

// Two mugs that clink (D46), the native twin of the web spinner: the loading
// spinner. They keep striking for as long as it is mounted.

const SPREAD = 22;
const CYCLE = 1150;

function Mug({ side }: { side: -1 | 1 }) {
  // Phase 0..1 over one clink; everything below is derived from it so the two
  // mugs and the slosh can never drift apart.
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(withTiming(1, { duration: CYCLE, easing: Easing.linear }), -1, false);
    return () => {
      phase.value = 0;
    };
  }, [phase]);

  // apart, in, contact, recoil, and back — the web keyframes in milliseconds.
  const wrapStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          side *
          SPREAD *
          interpolate(phase.value, [0, 0.26, 0.32, 0.38, 0.56, 1], [0.55, 0.08, 0, 0.42, 0.55, 0.55]),
      },
    ],
  }));
  const leanStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(phase.value, [0, 0.28, 0.38, 1], [0, 0, 7, 0]) * -side}deg` },
      { translateY: interpolate(phase.value, [0, 0.28, 0.38, 1], [0, 0, -3, 0]) },
    ],
  }));

  return (
    <Animated.View style={wrapStyle}>
      <Animated.View style={leanStyle}>
        <BeerMug size={44} mirrored={side === 1} />
      </Animated.View>
    </Animated.View>
  );
}

export function ClinkSpinner({ label = 'On On…' }: { label?: string }) {
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={label || 'Loading'}>
      <View style={styles.mugs}>
        <Mug side={-1} />
        <Mug side={1} />
      </View>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2, paddingTop: 8 },
  mugs: { flexDirection: 'row', alignItems: 'flex-end' },
});
