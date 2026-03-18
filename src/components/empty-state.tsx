import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T, R } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon: IoniconName;
  iconColor?: string;
  title: string;
  subtitle: string;
  cta?: { label: string; onPress: () => void };
};

export function EmptyState({ icon, iconColor = T.textMuted, title, subtitle, cta }: Props) {
  return (
    <View style={s.container}>
      <Ionicons name={icon} size={48} color={iconColor} style={s.icon} />
      <Text style={s.title}>{title}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>
      {cta && (
        <TouchableOpacity style={s.cta} onPress={cta.onPress}>
          <Text style={s.ctaText}>{cta.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  icon: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: T.text, marginBottom: 6, textAlign: 'center', fontFamily: 'Fredoka_700Bold' },
  subtitle: { fontSize: 14, color: T.textSecondary, textAlign: 'center', lineHeight: 20, fontFamily: 'Fredoka_500Medium' },
  cta: {
    marginTop: 20, backgroundColor: T.accent, borderRadius: R.button,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: 'Fredoka_600SemiBold' },
});
