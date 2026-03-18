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
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { signInWithGoogle } from '@/services/auth.service';
import { T, R } from '@/constants/theme';
import { ChampDraftLogo } from '@/components/champdraft-logo';
import { GradientScreen } from '@/components/gradient-screen';
import { GlassCard } from '@/components/glass-card';

function getErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  async function handleLogin() {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await signIn({ email: email.trim(), password });
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(getErrorMessage(e.code ?? ''));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/(tabs)/home');
    } catch (e: any) {
      if (e.code !== 'SIGN_IN_CANCELLED') {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <GradientScreen>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <View style={styles.logoWrap}>
            <ChampDraftLogo size="lg" />
          </View>

          <GlassCard variant="bright" style={styles.card}>
            <Text style={styles.subtitle}>Sign in to continue</Text>

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
              placeholder="Password"
              placeholderTextColor={T.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.divider}>or</Text>

            <TouchableOpacity
              style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
              onPress={handleGoogleLogin}
              disabled={googleLoading || loading}
            >
              {googleLoading ? (
                <ActivityIndicator color={T.text} />
              ) : (
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.link}>
                Don&apos;t have an account?{' '}
                <Text style={styles.linkBold}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </KeyboardAvoidingView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
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
  divider: {
    textAlign: 'center',
    color: T.textMuted,
    fontSize: 14,
    marginBottom: 16,
    fontFamily: 'Fredoka_500Medium',
  },
  googleButton: {
    borderWidth: 1,
    borderColor: T.glassBorderStrong,
    borderRadius: R.button,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: T.surface2,
  },
  googleButtonText: {
    color: T.text,
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
