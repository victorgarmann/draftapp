import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { joinGroup } from '@/services/group.service';
import { T } from '@/constants/theme';
import { GradientScreen } from '@/components/gradient-screen';

export default function JoinGroupScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, isLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      // Not logged in — redirect to login, then come back
      router.replace({ pathname: '/(auth)/login' });
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('Invalid invite link.');
      return;
    }

    joinGroup({ inviteCode: code, userId: user.uid })
      .then((group) => {
        router.replace({ pathname: '/group/[id]', params: { id: group.id } });
      })
      .catch((e: any) => {
        const msg: string = e?.message ?? '';
        if (msg.includes('already in this group')) {
          // Already a member — just navigate there
          // We need to find the group id; re-fetch by invite code via error path isn't ideal,
          // so just show a friendly message and send them home.
          setStatus('error');
          setErrorMessage('You are already in this group.');
        } else {
          setStatus('error');
          setErrorMessage(msg || 'Failed to join group. Please try again.');
        }
      });
  }, [isLoading, user, code]);

  return (
    <GradientScreen>
      <View style={styles.container}>
        {status === 'loading' ? (
          <>
            <ActivityIndicator size="large" color={T.accent} />
            <Text style={styles.text}>Joining group…</Text>
          </>
        ) : (
          <>
            <Text style={styles.error}>{errorMessage}</Text>
            <Text style={styles.link} onPress={() => router.replace('/(tabs)/home')}>
              Go to Home
            </Text>
          </>
        )}
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: { color: T.textSecondary, fontSize: 16, fontFamily: 'Fredoka_500Medium' },
  error: { color: T.error, fontSize: 16, fontFamily: 'Fredoka_500Medium', textAlign: 'center', paddingHorizontal: 32 },
  link: { color: T.accent, fontSize: 15, fontFamily: 'Fredoka_600SemiBold' },
});
