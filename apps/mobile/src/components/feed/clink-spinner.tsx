import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { BeerMug } from '@/components/feed/beer-mug';
import { ThemedText } from '@/components/themed-text';

// Two mugs that clink (D46), the native twin of the web spinner. The gap closes
// with the pull, they strike when it is let go, and they keep striking while the
// feed loads. Nothing moves on its own before that.

export type ClinkState = 'idle' | 'pulling' | 'armed' | 'refreshing';

const SPREAD = 22;
const CYCLE = 1150;

const caption: Record<ClinkState, string> = {
  idle: '',
  pulling: 'Pull to refresh',
  armed: 'Let go for a clink',
  refreshing: 'On On…',
};

// One strike: apart, in, contact, recoil, and back. The numbers are the web
// keyframes in milliseconds, so the two platforms clink at the same tempo.
function strike(dir: number) {
  'worklet';
  return withRepeat(
    withSequence(
      withTiming(SPREAD * 0.55 * dir, { duration: CYCLE * 0.26, easing: Easing.bezier(0.34, 0, 0.2, 1) }),
      withTiming(SPREAD * 0.08 * dir, { duration: CYCLE * 0.06, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: CYCLE * 0.06, easing: Easing.in(Easing.quad) }),
      withTiming(SPREAD * 0.42 * dir, { duration: CYCLE * 0.18, easing: Easing.out(Easing.quad) }),
      withTiming(SPREAD * 0.55 * dir, { duration: CYCLE * 0.44, easing: Easing.inOut(Easing.quad) }),
    ),
    -1,
    false,
  );
}

function Mug({ side, pull, clinking }: { side: -1 | 1; pull: SharedValue<number>; clinking: boolean }) {
  const offset = useSharedValue(SPREAD * side);
  const slosh = useSharedValue(0);

  useEffect(() => {
    if (clinking) {
      offset.value = strike(side);
      slosh.value = withRepeat(
        withSequence(
          withTiming(0, { duration: CYCLE * 0.28 }),
          withTiming(1, { duration: CYCLE * 0.1, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: CYCLE * 0.62, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
      return;
    }
    cancelAnimation(offset);
    cancelAnimation(slosh);
    slosh.value = withTiming(0, { duration: 120 });
  }, [clinking, offset, side, slosh]);

  // While the finger is down the gap follows the pull; while clinking the
  // strike owns it.
  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: clinking ? offset.value : SPREAD * side * (1 - pull.value) }],
  }));
  // The lean: into the other mug as the pull closes, then the kick off it.
  const leanStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(clinking ? slosh.value : pull.value, [0, 1], [0, 7 * -side])}deg` },
      { translateY: interpolate(slosh.value, [0, 1], [0, -3]) },
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

export function ClinkSpinner({ state, pull }: { state: ClinkState; pull: SharedValue<number> }) {
  const clinking = state === 'refreshing';

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={caption[state] || 'Pull to refresh'}>
      <View style={styles.mugs}>
        <Mug side={-1} pull={pull} clinking={clinking} />
        <Mug side={1} pull={pull} clinking={clinking} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {caption[state]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2, paddingTop: 8 },
  mugs: { flexDirection: 'row', alignItems: 'flex-end' },
});
