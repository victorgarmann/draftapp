import { type ReactNode } from 'react';
import { View, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { T, R } from '@/constants/theme';

type Props = {
  children: ReactNode;
  variant?: 'standard' | 'bright';
  style?: StyleProp<ViewStyle>;
};

export function GlassCard({ children, variant = 'standard', style }: Props) {
  const bg = variant === 'bright' ? T.surface2 : T.surface;
  const border = variant === 'bright' ? T.glassBorderStrong : T.glassBorder;

  return (
    <View style={[s.card, { backgroundColor: bg, borderColor: border }, style]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: R.card,
    borderWidth: 1,
    padding: 14,
  },
});
