import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { T } from '@/constants/theme';

// Thick arc forming the "C" — center (50,50), r=34, 80° gap on the right
const ARC = 'M 76.05,28.15 A 34,34 0 1 0 76.05,71.85';

// Small star at the center of the C — R=7, r=3
const STAR =
  '50.00,43.00 51.76,47.57 56.66,47.84 52.85,50.93 54.11,55.66 ' +
  '50.00,53.00 45.89,55.66 47.15,50.93 43.34,47.84 48.24,47.57';

interface Props {
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { badge: 56,  title: 15, gap: 8  },
  md: { badge: 80,  title: 21, gap: 10 },
  lg: { badge: 104, title: 28, gap: 14 },
};

export function ChampDraftLogo({ size = 'lg' }: Props) {
  const s = SIZES[size];
  return (
    <View style={styles.wrapper}>
      <Svg width={s.badge} height={s.badge} viewBox="0 0 100 100">
        {/* C arc */}
        <Path
          d={ARC}
          fill="none"
          stroke={T.accent}
          strokeWidth="13"
          strokeLinecap="round"
        />
        {/* Star at center */}
        <Polygon points={STAR} fill="white" />
      </Svg>

      <Text style={[styles.title, { fontSize: s.title, marginTop: s.gap }]}>
        FotDraft
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  title: {
    color: T.text,
    fontFamily: 'Fredoka_700Bold',
    letterSpacing: 1,
  },
});
