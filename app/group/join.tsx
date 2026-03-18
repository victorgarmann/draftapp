import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { joinGroup } from '@/services/group.service';
import { T, R } from '@/constants/theme';
import { GradientScreen } from '@/components/gradient-screen';
import { GlassCard } from '@/components/glass-card';

export default function JoinGroupScreen() {
  const navigation = useNavigation();
  useEffect(() => { navigation.getParent()?.setOptions({ title: 'Join Group' }); }, []);
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = code.trim().length === 6 && !loading;

  async function handleJoin() {
    if (!canSubmit || !user) return;
    setError(null);
    setLoading(true);
    try {
      const group = await joinGroup({ inviteCode: code, userId: user.uid });
      router.replace(`/group/${group.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Failed to join group.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <GradientScreen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Invite code</Text>
          <GlassCard variant="bright" style={styles.codeCard}>
            <TextInput
              style={styles.codeInput}
              placeholder="ABC123"
              placeholderTextColor={T.textMuted}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={handleJoin}
            />
          </GlassCard>
          <Text style={styles.hint}>Enter the 6-character code shared by the group creator.</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleJoin}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Join Group</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  closeBtn: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  closeBtnText: { fontSize: 20, color: T.textSecondary },
  label: { fontSize: 13, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  codeCard: { padding: 8 },
  codeInput: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 28,
    fontFamily: 'Fredoka_700Bold',
    letterSpacing: 8,
    textAlign: 'center',
    color: T.text,
  },
  hint: { fontSize: 13, color: T.textMuted, fontFamily: 'Fredoka_500Medium', marginTop: 10, textAlign: 'center' },
  error: { color: T.error, marginTop: 16, fontSize: 14, fontFamily: 'Fredoka_500Medium', textAlign: 'center' },
  button: {
    backgroundColor: T.accent,
    borderRadius: R.button,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: 'Fredoka_600SemiBold' },
});
