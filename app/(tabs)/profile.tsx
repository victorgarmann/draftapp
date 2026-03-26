import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { getProfileStats, type ProfileStats } from '@/services/profile.service';
import { Avatar } from '@/components/avatar';
import { T, R } from '@/constants/theme';
import { GradientScreen } from '@/components/gradient-screen';
import { GlassCard } from '@/components/glass-card';

export default function ProfileScreen() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const [signingOut,    setSigningOut]    = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername,     setNewUsername]     = useState('');
  const [savingUsername,  setSavingUsername]  = useState(false);
  const [stats,         setStats]         = useState<ProfileStats | null>(null);
  const [statsLoading,  setStatsLoading]  = useState(true);

  useEffect(() => {
    if (!user) return;
    getProfileStats(user.uid)
      .then(setStats)
      .finally(() => setStatsLoading(false));
  }, [user]);

  async function handleSaveUsername() {
    const trimmed = newUsername.trim();
    if (trimmed.length < 3) {
      Alert.alert('Username too short', 'Username must be at least 3 characters.');
      return;
    }
    setSavingUsername(true);
    try {
      await updateProfile(trimmed);
      setEditingUsername(false);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update username.');
    } finally {
      setSavingUsername(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch {
      setSigningOut(false);
    }
  }

  const winRate = stats && stats.predictionsTotal > 0
    ? Math.round((stats.predictionsCorrect / stats.predictionsTotal) * 100)
    : null;

  return (
    <GradientScreen>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={{ marginBottom: 14 }}>
            <Avatar
              username={profile?.username ?? user?.email ?? '?'}
              size={84}
              variant="accent"
              border
            />
          </View>
          <Text style={styles.username}>{profile?.username ?? '—'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatTile
            label="Total Points"
            value={statsLoading ? '…' : String(stats?.totalPoints ?? 0)}
            accent
          />
          <StatTile
            label="Groups Played"
            value={statsLoading ? '…' : String(stats?.groupCount ?? 0)}
          />
          <StatTile
            label="Prediction Accuracy"
            value={statsLoading ? '…' : winRate !== null ? `${winRate}%` : '—'}
          />
          <StatTile
            label="Tokens Earned"
            value={statsLoading ? '…' : String(stats?.tokensEarned ?? 0)}
          />
        </View>

        {/* Account */}
        <SectionLabel>Account</SectionLabel>
        <GlassCard style={styles.card}>
          {editingUsername ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={newUsername}
                onChangeText={setNewUsername}
                autoFocus
                autoCapitalize="none"
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={handleSaveUsername}
              />
              <TouchableOpacity onPress={handleSaveUsername} disabled={savingUsername} style={styles.editAction}>
                {savingUsername
                  ? <ActivityIndicator size="small" color={T.accent} />
                  : <Text style={styles.editSave}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingUsername(false)} style={styles.editAction}>
                <Text style={styles.editCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.row}
              onPress={() => { setNewUsername(profile?.username ?? ''); setEditingUsername(true); }}
            >
              <Text style={styles.rowLabel}>Username</Text>
              <View style={styles.rowRight}>
                <Text style={styles.rowValue}>{profile?.username ?? '—'}</Text>
                <Text style={styles.editHint}>Edit</Text>
              </View>
            </TouchableOpacity>
          )}
          <Divider />
          <Row label="Email"        value={user?.email ?? '—'} />
          <Divider />
          <Row label="Member since" value={profile ? formatDate(profile.createdAt) : '—'} />
        </GlassCard>

        {/* Sign out */}
        <TouchableOpacity
          style={[styles.signOutBtn, signingOut && styles.signOutBtnDisabled]}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut
            ? <ActivityIndicator color={T.error} />
            : <Text style={styles.signOutText}>Sign Out</Text>}
        </TouchableOpacity>
      </ScrollView>
    </GradientScreen>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <View style={[styles.statTile, accent && styles.statTileAccent]}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
      <Text style={[styles.statLabel, accent && styles.statLabelAccent]}>{label}</Text>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content:   { paddingBottom: 40 },

  avatarSection: { alignItems: 'center', paddingTop: 40, paddingBottom: 28 },
  username:   { fontSize: 22, fontFamily: 'Fredoka_700Bold', color: T.text, marginBottom: 4 },
  email:      { fontSize: 14, color: T.textSecondary, fontFamily: 'Fredoka_500Medium' },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 10, marginBottom: 28,
  },
  statTile: {
    flex: 1, width: '48%',
    backgroundColor: T.surface, borderRadius: R.card,
    paddingVertical: 16, paddingHorizontal: 12,
    alignItems: 'center', gap: 2,
    borderWidth: 1, borderColor: T.glassBorder,
  },
  statTileAccent: { backgroundColor: T.accent, borderColor: T.accentDark },
  statValue:      { fontSize: 24, fontFamily: 'Fredoka_700Bold', color: T.text },
  statValueAccent:{ color: '#fff' },
  statSub:        { fontSize: 10, color: T.textMuted, marginTop: -2, fontFamily: 'Fredoka_500Medium' },
  statLabel:      { fontSize: 10, color: T.textSecondary, fontFamily: 'Fredoka_500Medium', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  statLabelAccent:{ color: 'rgba(255,255,255,0.75)' },

  sectionTitle: {
    fontSize: 11, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary,
    paddingHorizontal: 20, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  card: {
    marginHorizontal: 16, marginBottom: 24,
    overflow: 'hidden', padding: 0,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  rowLabel: { fontSize: 14, color: T.textSecondary, fontFamily: 'Fredoka_500Medium' },
  rowValue: {
    fontSize: 14, color: T.text, fontFamily: 'Fredoka_500Medium',
    flexShrink: 1, textAlign: 'right', marginLeft: 16,
  },
  divider: { height: 1, backgroundColor: T.glassBorder, marginLeft: 16 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editHint: { fontSize: 13, color: T.accent, fontFamily: 'Fredoka_500Medium' },
  editRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  editInput: {
    flex: 1, fontSize: 15, color: T.text, fontFamily: 'Fredoka_500Medium',
    borderWidth: 1, borderColor: T.accent, borderRadius: R.button,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: T.surface2,
  },
  editAction: { paddingHorizontal: 4 },
  editSave: { color: T.accent, fontFamily: 'Fredoka_700Bold', fontSize: 14 },
  editCancel: { color: T.textMuted, fontSize: 14, fontFamily: 'Fredoka_500Medium' },

  signOutBtn: {
    marginHorizontal: 16, borderRadius: R.button,
    borderWidth: 1, borderColor: T.error,
    paddingVertical: 15, alignItems: 'center',
  },
  signOutBtnDisabled: { opacity: 0.5 },
  signOutText: { fontSize: 15, fontFamily: 'Fredoka_600SemiBold', color: T.error },
});
