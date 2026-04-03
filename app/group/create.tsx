import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { createGroup } from '@/services/group.service';
import type { DraftOrderMode } from '@/types/models';
import { T, R } from '@/constants/theme';
import { GradientScreen } from '@/components/gradient-screen';
import { GlassCard } from '@/components/glass-card';
import { AppHeader } from '@/components/app-header';

const GROUP_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#EF4444',
  '#F59E0B', '#EC4899', '#14B8A6', '#6366F1',
];

export default function CreateGroupScreen() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const [draftOrderMode, setDraftOrderMode] = useState<DraftOrderMode>('random');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length >= 2 && !loading;

  async function handleCreate() {
    if (!canSubmit || !user) return;
    setError(null);
    setLoading(true);
    try {
      const group = await createGroup({
        name,
        maxMembers: 12,
        draftOrderMode,
        creatorId: user.uid,
        color,
      });
      router.replace(`/group/${group.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Failed to create group.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <GradientScreen>
      <AppHeader />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Group name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. World Cup Draft 2026"
            placeholderTextColor={T.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={40}
            returnKeyType="done"
          />

          <Text style={styles.label}>Group color</Text>
          <GlassCard style={styles.colorCard}>
            <View style={styles.colorRow}>
              {GROUP_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchActive]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>
          </GlassCard>

          <Text style={styles.label}>Draft order</Text>
          <View style={styles.optionRow}>
            {(['random', 'manual'] as DraftOrderMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.modeChip, draftOrderMode === mode && styles.optionChipActive]}
                onPress={() => setDraftOrderMode(mode)}
              >
                <Text style={[styles.optionChipText, draftOrderMode === mode && styles.optionChipTextActive]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>
            {draftOrderMode === 'random'
              ? 'Pick order will be randomised when the draft starts.'
              : 'You set the pick order manually before the draft.'}
          </Text>

          {error && <Text style={styles.error}>{error}</Text>}
          {loading && (
            <Text style={styles.hint}>Seeding players if needed — this may take a moment...</Text>
          )}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Group</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inner: { padding: 24 },
  label: { fontSize: 13, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary, marginBottom: 10, marginTop: 24, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    borderWidth: 1,
    borderColor: T.glassBorderStrong,
    borderRadius: R.button,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Fredoka_500Medium',
    backgroundColor: T.surface2,
    color: T.text,
  },
  colorCard: { padding: 14 },
  colorRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  colorSwatch: { width: 36, height: 36, borderRadius: 18 },
  colorSwatchActive: { borderWidth: 3, borderColor: '#fff' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: R.button,
    borderWidth: 1,
    borderColor: T.glassBorder,
    backgroundColor: T.surface,
  },
  optionChipActive: { backgroundColor: T.accent, borderColor: T.accent },
  optionChipText: { fontSize: 15, color: T.textSecondary, fontFamily: 'Fredoka_500Medium' },
  optionChipTextActive: { color: '#fff', fontFamily: 'Fredoka_600SemiBold' },
  hint: { fontSize: 13, color: T.textMuted, fontFamily: 'Fredoka_500Medium', marginTop: 8, lineHeight: 18 },
  error: { color: T.error, marginTop: 16, fontSize: 14, fontFamily: 'Fredoka_500Medium' },
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
