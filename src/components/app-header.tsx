import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { T } from '@/constants/theme';

interface AppHeaderProps {
  title?: string;
  onBack?: () => void;
}

export function AppHeader({ title, onBack }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <TouchableOpacity onPress={onBack ?? (() => router.back())} style={styles.backBtn} activeOpacity={0.7}>
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>
      {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 10,
    gap: 4,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backText: {
    color: T.text,
    fontSize: 16,
    fontFamily: 'Fredoka_600SemiBold',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Fredoka_600SemiBold',
    color: T.text,
  },
});
