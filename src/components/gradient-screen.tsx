import { type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { T } from '@/constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function GradientScreen({ children, style }: Props) {
  return (
    <LinearGradient
      colors={[T.bgGradientStart, T.bgGradientEnd]}
      style={[s.container, style]}
    >
      {children}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
});
