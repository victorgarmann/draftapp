import { Link, Stack } from 'expo-router';
import { Text, StyleSheet } from 'react-native';
import { GradientScreen } from '@/components/gradient-screen';
import { T } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <GradientScreen style={styles.container}>
        <Text style={styles.title}>Page not found</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home</Text>
        </Link>
      </GradientScreen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 20, fontFamily: 'Fredoka_700Bold', color: T.text, marginBottom: 16 },
  link: { marginTop: 8 },
  linkText: { fontSize: 16, color: T.accentLight, fontFamily: 'Fredoka_500Medium' },
});
