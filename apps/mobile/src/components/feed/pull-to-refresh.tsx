/* eslint-disable react-hooks/immutability --
   Reanimated's whole API is assigning to `.value` on a shared value, and a
   shared value is a handle into the UI thread rather than React state. The
   compiler's immutability rule reads those assignments as mutating a hook
   argument; there is no way to drive a gesture without them. */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ClinkSpinner, type ClinkState } from '@/components/feed/clink-spinner';

// Drag the list down and the mugs come together; let go past the line and they
// clink while it reloads (D46). The native twin of the web gesture.
//
// RefreshControl cannot host anything but the platform spinner, so this is a
// pan gesture of our own. It only takes over at the very top of the list —
// anywhere else the list keeps its scroll, which is what `atTop` is for.

const THRESHOLD = 76;
const MAX = 132;
// The drag gets heavier the further it goes, like every native list.
const resist = (distance: number) => MAX * (1 - Math.exp(-distance / MAX));

export function PullToRefresh({
  atTop,
  onRefresh,
  children,
}: {
  // The list tells us whether it is scrolled to the top; a pull anywhere else
  // is a scroll and none of our business.
  atTop: boolean;
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}) {
  const distance = useSharedValue(0);
  const pull = useSharedValue(0);
  const [state, setState] = useState<ClinkState>('idle');

  const begin = useCallback(async () => {
    setState('refreshing');
    distance.value = withTiming(THRESHOLD, { duration: 160 });
    pull.value = 1;
    try {
      await onRefresh();
    } finally {
      setState('idle');
      distance.value = withTiming(0, { duration: 260 });
      pull.value = withTiming(0, { duration: 260 });
    }
  }, [distance, onRefresh, pull]);

  const pan = Gesture.Pan()
    .enabled(atTop)
    // A vertical drag only; sideways belongs to whatever is beneath.
    .activeOffsetY(8)
    .failOffsetX([-12, 12])
    .onUpdate((event) => {
      if (state === 'refreshing' || event.translationY <= 0) return;
      const travelled = resist(event.translationY);
      distance.value = travelled;
      pull.value = Math.min(1, travelled / THRESHOLD);
      runOnJS(setState)(travelled >= THRESHOLD ? 'armed' : 'pulling');
    })
    .onEnd(() => {
      if (state === 'refreshing') return;
      if (distance.value >= THRESHOLD) {
        runOnJS(begin)();
        return;
      }
      distance.value = withTiming(0, { duration: 240 });
      pull.value = withTiming(0, { duration: 240 });
      runOnJS(setState)('idle');
    });

  // The mugs are revealed by the drag rather than pushed down by it, so the
  // list itself never reflows.
  const revealStyle = useAnimatedStyle(() => ({ height: distance.value, overflow: 'hidden' }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: distance.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.flex}>
        <Animated.View style={[styles.reveal, revealStyle]} pointerEvents="none">
          <ClinkSpinner state={state} pull={pull} />
        </Animated.View>
        <Animated.View style={[styles.flex, contentStyle]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  reveal: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', zIndex: 10 },
});
