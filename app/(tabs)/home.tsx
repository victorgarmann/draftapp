import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { getMyGroups, getMyGroupRanks, type GroupDetail } from '@/services/group.service';
import { getNextMatchday, isLineupLocked } from '@/services/rating.service';
import { Avatar } from '@/components/avatar';
import { SkeletonBox, SkeletonText } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { GradientScreen } from '@/components/gradient-screen';
import { GlassCard } from '@/components/glass-card';
import { T, R, buttonShadow } from '@/constants/theme';

function rankColor(rank: number): string {
  if (rank === 1) return T.gold;
  if (rank === 2) return T.silver;
  if (rank === 3) return T.bronze;
  return T.textSecondary;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatLineupDeadline(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Deadline passed';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h until lineup deadline`;
  if (hours > 0) return `${hours}h ${mins}m until lineup deadline`;
  return `${mins}m until lineup deadline`;
}

function formatDraftCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Draft time reached — start when ready';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `Draft in ${days}d ${hours}h`;
  if (hours > 0) return `Draft in ${hours}h ${mins}m`;
  return `Draft in ${mins}m`;
}

function formatDraftDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<GroupDetail[]>([]);
  const [ranks, setRanks] = useState<Record<string, { rank: number; points: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const nextMd = getNextMatchday();
  const locked = isLineupLocked();

  const username = profile?.displayName ?? profile?.username ?? 'Coach';

  const load = useCallback(async () => {
    if (!user) return;
    const data = await getMyGroups(user.uid);
    setGroups(data);
    const completedIds = data.filter((g) => g.draftStatus === 'completed').map((g) => g.id);
    if (completedIds.length) {
      const r = await getMyGroupRanks(user.uid, completedIds);
      setRanks(r);
    }
  }, [user]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <GradientScreen>
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{greeting()},</Text>
            <Text style={s.username}>{username}</Text>
          </View>
          <Avatar username={username} size={40} variant="accent" onPress={() => router.push('/(tabs)/profile')} />
        </View>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <SkeletonBox style={{ height: 72, borderRadius: 14 }} />
          <SkeletonBox style={{ height: 130, borderRadius: 14, marginTop: 2 }} />
          <SkeletonText style={{ width: 80, height: 10, marginTop: 6 }} />
          <SkeletonBox style={{ height: 80, borderRadius: 14 }} />
          <SkeletonBox style={{ height: 80, borderRadius: 14 }} />
        </ScrollView>
      </GradientScreen>
    );
  }

  const totalPoints = Object.values(ranks).reduce((sum, r) => sum + r.points, 0);
  const activeGroups = groups.filter((g) => g.draftStatus === 'completed');
  const bestRank = activeGroups.length
    ? Math.min(...activeGroups.map((g) => ranks[g.id]?.rank ?? 99))
    : null;

  return (
    <GradientScreen>
      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{greeting()},</Text>
          <Text style={s.username}>{username}</Text>
        </View>
        <Avatar username={username} size={40} variant="accent" onPress={() => router.push('/(tabs)/profile')} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stats summary (only when in active groups) ── */}
        {activeGroups.length > 0 && (
          <GlassCard style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statValue}>{totalPoints}</Text>
              <Text style={s.statLabel}>Total pts</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={[s.statValue, bestRank ? { color: rankColor(bestRank) } : undefined]}>
                {bestRank ? `#${bestRank}` : '—'}
              </Text>
              <Text style={s.statLabel}>Best rank</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statValue}>{activeGroups.length}</Text>
              <Text style={s.statLabel}>Active groups</Text>
            </View>
          </GlassCard>
        )}

        {/* ── Matchday banner ── */}
        {nextMd ? (
          <GlassCard variant="bright" style={s.matchdayCard}>
            <View style={s.matchdayTop}>
              <View style={s.mdBadge}>
                <Text style={s.mdBadgeText}>MD{nextMd.matchday}</Text>
              </View>
              <Text style={s.matchdayLabel}>{nextMd.label}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={locked ? 'lock-closed' : 'time-outline'}
                size={13}
                color={locked ? T.success : T.accent}
              />
              <Text style={[s.matchdayDeadline, locked && s.matchdayLocked]}>
                {locked ? 'Lineup locked — token window open' : formatLineupDeadline(nextMd.deadline)}
              </Text>
            </View>
          </GlassCard>
        ) : (
          <View style={s.seasonOver}>
            <Text style={s.seasonOverText}>Season complete</Text>
          </View>
        )}

        {/* ── Groups ── */}
        <Text style={s.sectionLabel}>My Groups</Text>

        {groups.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No groups yet"
            subtitle="Create or join a group to start playing."
            cta={{ label: 'Create Group', onPress: () => router.push('/group/create') }}
          />
        ) : (
          groups.map((item) => {
            const ri = ranks[item.id];
            const accent = item.color;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(`/group/${item.id}`)}
                activeOpacity={0.75}
              >
                <GlassCard style={[s.card, { borderLeftColor: accent, borderLeftWidth: 4 }]}>
                  {/* Top row: name + member count */}
                  <View style={s.cardTop}>
                    <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.cardMembers}>{item.memberCount}/{item.maxMembers}</Text>
                  </View>

                  {/* Rank + points for active groups */}
                  {item.draftStatus === 'completed' && ri && (
                    <View style={s.cardRankRow}>
                      <View style={[s.rankBadge, { backgroundColor: accent + '22' }]}>
                        <Text style={[s.rankBadgeText, { color: accent }]}>
                          #{ri.rank}
                        </Text>
                      </View>
                      <Text style={[s.cardPoints, { color: accent }]}>{ri.points} pts</Text>
                    </View>
                  )}

                  {/* Draft countdown for scheduled pending groups */}
                  {item.draftStatus === 'pending' && item.draftDate && (
                    <View style={s.draftCountdownRow}>
                      <Text style={[s.draftCountdownTime, { color: accent }]}>
                        {formatDraftCountdown(item.draftDate)}
                      </Text>
                      <Text style={s.draftCountdownDate}>{formatDraftDate(item.draftDate)}</Text>
                    </View>
                  )}

                  {/* Bottom: status + action */}
                  <View style={s.cardBottom}>
                    <Text style={[s.cardStatus, { color: item.draftStatus === 'completed' ? T.success : item.draftStatus === 'in_progress' ? accent : T.textSecondary }]}>
                      {item.draftStatus === 'pending' ? 'Waiting for draft'
                        : item.draftStatus === 'in_progress' ? 'Draft in progress'
                        : 'Season active'}
                    </Text>
                    {item.draftStatus === 'in_progress' && (
                      <TouchableOpacity
                        style={[s.cardActionBtn, { borderColor: accent + '55' }]}
                        onPress={(e) => { e.stopPropagation?.(); router.push(`/draft/${item.id}`); }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={[s.cardActionText, { color: accent }]}>Draft Board</Text>
                          <Ionicons name="chevron-forward" size={12} color={accent} />
                        </View>
                      </TouchableOpacity>
                    )}
                    {item.draftStatus === 'completed' && (
                      <TouchableOpacity
                        style={[s.cardActionBtn, { borderColor: accent + '55' }]}
                        onPress={(e) => { e.stopPropagation?.(); router.push('/(tabs)/standings'); }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={[s.cardActionText, { color: accent }]}>Standings</Text>
                          <Ionicons name="chevron-forward" size={12} color={accent} />
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                </GlassCard>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ── Footer actions ── */}
      <View style={s.footer}>
        <TouchableOpacity style={s.btnPrimary} onPress={() => router.push('/group/create')}>
          <Text style={s.btnPrimaryText}>Create Group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSecondary} onPress={() => router.push('/group/join')}>
          <Text style={s.btnSecondaryText}>Join Group</Text>
        </TouchableOpacity>
      </View>
    </GradientScreen>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
  },
  greeting: { fontSize: 13, color: T.textSecondary, fontFamily: 'Fredoka_500Medium' },
  username: { fontSize: 24, fontWeight: '800', color: T.text, marginTop: 2, fontFamily: 'Fredoka_700Bold' },

  scroll: { padding: 16, gap: 10, paddingBottom: 24 },

  statsRow: {
    flexDirection: 'row',
    borderRadius: R.card,
    paddingVertical: 16, marginBottom: 2,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 22, fontWeight: '900', color: T.text, fontFamily: 'Fredoka_700Bold' },
  statLabel: { fontSize: 10, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Fredoka_500Medium' },
  statDivider: { width: 1, backgroundColor: T.border },

  matchdayCard: {
    borderRadius: R.card, padding: 16,
    borderLeftWidth: 4, borderLeftColor: T.accentLight, gap: 10,
  },
  matchdayTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mdBadge: {
    backgroundColor: T.accent, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  mdBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, fontFamily: 'Fredoka_700Bold' },
  matchdayLabel: { fontSize: 15, fontWeight: '700', color: T.text, fontFamily: 'Fredoka_700Bold' },
  matchdayDeadline: { fontSize: 13, color: T.accent, fontWeight: '500', fontFamily: 'Fredoka_500Medium' },
  matchdayLocked: { color: T.success },
  seasonOver: { padding: 16, alignItems: 'center' },
  seasonOverText: { color: T.textSecondary, fontSize: 14, fontFamily: 'Fredoka_500Medium' },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: T.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 6,
    fontFamily: 'Fredoka_700Bold',
  },

  card: {
    borderRadius: R.card, padding: 16,
    gap: 8,
    overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { flex: 1, fontSize: 17, fontWeight: '700', color: T.text, fontFamily: 'Fredoka_700Bold' },
  cardMembers: { fontSize: 13, color: T.textSecondary, marginLeft: 8, fontFamily: 'Fredoka_500Medium' },
  cardRankRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankBadge: { borderRadius: R.chip, paddingHorizontal: 8, paddingVertical: 4 },
  rankBadgeText: { fontSize: 14, fontWeight: '800', fontFamily: 'Fredoka_700Bold' },
  cardPoints: { fontSize: 20, fontWeight: '800', fontFamily: 'Fredoka_700Bold' },
  draftCountdownRow: { gap: 1 },
  draftCountdownTime: { fontSize: 14, fontWeight: '700', fontFamily: 'Fredoka_700Bold' },
  draftCountdownDate: { fontSize: 12, color: T.textSecondary, fontFamily: 'Fredoka_500Medium' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardStatus: { fontSize: 13, fontWeight: '500', fontFamily: 'Fredoka_500Medium' },
  cardActionBtn: {
    backgroundColor: T.surface2, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1,
  },
  cardActionText: { fontSize: 12, fontWeight: '700', fontFamily: 'Fredoka_600SemiBold' },

  footer: {
    flexDirection: 'row', padding: 16, gap: 12,
  },
  btnPrimary: {
    flex: 1, backgroundColor: T.accent, borderRadius: R.button, paddingVertical: 14, alignItems: 'center',
    ...buttonShadow,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: 'Fredoka_600SemiBold' },
  btnSecondary: {
    flex: 1, borderRadius: R.button, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.4)',
  },
  btnSecondaryText: { color: T.accent, fontWeight: '700', fontSize: 15, fontFamily: 'Fredoka_600SemiBold' },
});
