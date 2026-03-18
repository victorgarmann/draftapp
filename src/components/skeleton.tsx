import { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { T } from '@/constants/theme';

function useShimmer() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return opacity;
}

export function SkeletonBox({ style }: { style?: ViewStyle }) {
  const opacity = useShimmer();
  return (
    <Animated.View
      style={[{ backgroundColor: T.surface2, borderRadius: 16 }, style, { opacity }]}
    />
  );
}

export function SkeletonText({ style }: { style?: ViewStyle }) {
  const opacity = useShimmer();
  return (
    <Animated.View
      style={[{ backgroundColor: T.surface2, borderRadius: 12, height: 14 }, style, { opacity }]}
    />
  );
}
