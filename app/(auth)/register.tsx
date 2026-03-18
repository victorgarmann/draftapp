import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { T, R } from '@/constants/theme';
import { ChampDraftLogo } from '@/components/champdraft-logo';
import { GradientScreen } from '@/components/gradient-screen';
import { GlassCard } from '@/components/glass-card';

function getErrorMessage(e: any): string {
  const code: string = e?.code ?? '';
  if (code.startsWith('auth/')) {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/invalid-email':
        return 'Invalid email address.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
  return e?.message ?? 'Something went wrong. Please try again.';
}

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = username.trim().length >= 3 && email.trim().length > 0 && password.length >= 6;
  const canSubmit = isValid && !loading;

  async function handleRegister() {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await signUp({ email: email.trim(), password, username: username.trim() });
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <GradientScreen>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <ChampDraftLogo size="md" />
          </View>

          <GlassCard variant="bright" style={styles.card}>
            <Text style={styles.subtitle}>Create your account</Text>

            <TextInput
              style={styles.input}
              placeholder="Username (min. 3 characters)"
              placeholderTextColor={T.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoComplete="username-new"
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={T.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder="Password (min. 6 characters)"
              placeholderTextColor={T.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password-new"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.link}>
                Already have an account?{' '}
                <Text style={styles.linkBold}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 24 },
  card: { paddingHorizontal: 24, paddingVertical: 28 },
  subtitle: {
    fontSize: 16,
    color: T.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'Fredoka_500Medium',
  },
  input: {
    borderWidth: 1,
    borderColor: T.glassBorderStrong,
    borderRadius: R.button,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 14,
    backgroundColor: T.surface2,
    color: T.text,
    fontFamily: 'Fredoka_500Medium',
  },
  error: {
    color: T.error,
    marginBottom: 14,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Fredoka_500Medium',
  },
  button: {
    backgroundColor: T.accent,
    borderRadius: R.button,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Fredoka_600SemiBold',
  },
  link: {
    textAlign: 'center',
    color: T.textSecondary,
    fontSize: 14,
    fontFamily: 'Fredoka_500Medium',
  },
  linkBold: {
    color: T.accent,
    fontFamily: 'Fredoka_600SemiBold',
  },
});
