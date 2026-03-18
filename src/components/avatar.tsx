import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '@/constants/theme';

const GRADIENT_PAIRS: [string, string][] = [
  ['#2DD4BF', '#5EEAD4'], // teal
  ['#FB7185', '#F43F5E'], // coral
  ['#F59E0B', '#FBBF24'], // amber
  ['#A78BFA', '#8B5CF6'], // violet
  ['#60A5FA', '#3B82F6'], // blue
  ['#F472B6', '#EC4899'], // rose
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

type Props = {
  username: string;
  size?: number;
  variant?: 'accent' | 'surface';
  border?: boolean;
  onPress?: () => void;
  style?: object;
};

export function Avatar({ username, size = 40, variant = 'accent', border = false, onPress, style }: Props) {
  const letter = (username[0] ?? '?').toUpperCase();
  const pair = GRADIENT_PAIRS[hashCode(username) % GRADIENT_PAIRS.length];

  const borderStyle = border ? { borderWidth: 3, borderColor: T.accentDark } : {};

  const inner = variant === 'accent' ? (
    <LinearGradient
      colors={pair}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          justifyContent: 'center' as const,
          alignItems: 'center' as const,
        },
        borderStyle,
        style,
      ]}
    >
      <Text style={{ color: T.bg, fontFamily: 'Fredoka_700Bold', fontSize: size * 0.4 }}>{letter}</Text>
    </LinearGradient>
  ) : (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: T.surface2,
          justifyContent: 'center' as const,
          alignItems: 'center' as const,
        },
        borderStyle,
        style,
      ]}
    >
      <Text style={{ color: T.accentLight, fontFamily: 'Fredoka_700Bold', fontSize: size * 0.4 }}>{letter}</Text>
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{inner}</TouchableOpacity>;
  }
  return inner;
}
