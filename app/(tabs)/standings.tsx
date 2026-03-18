import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/auth-context';
import { getMyGroups, type GroupDetail } from '@/services/group.service';
import {
  seedMockRatings,
  calculateGroupScores,
  getGroupMatchdayBreakdown,
  MATCHDAY_SCHEDULE,
  type MemberMatchdayBreakdown,
} from '@/services/rating.service';
import { autoResolvePastMatchdays, getMyTokens, TOKEN_META, type Token } from '@/services/prediction.service';
import { getMySquad, type SquadPlayer } from '@/services/draft.service';
import { FormationField } from '@/components/formation-field';
import { Avatar } from '@/components/avatar';
import { SkeletonBox } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { GradientScreen } from '@/components/gradient-screen';
import { GlassCard } from '@/components/glass-card';
import { T, R, heroShadow } from '@/constants/theme';

type SubTab = 'overall' | 'matchday';

function rankColor(rank: number): string {
  if (rank === 1) return T.gold;
  if (rank === 2) return T.silver;
  if (rank === 3) return T.bronze;
  return T.textSecondary;
}

const PAST_MDS = MATCHDAY_SCHEDULE.filter((md) => new Date(md.date) < new Date());

export default function StandingsScreen() {
  const { user } = useAuth();
  const [groups,         setGroups]         = useState<GroupDetail[]>([]);
  const [selectedGroup,  setSelectedGroup]  = useState<GroupDetail | null>(null);
  const [breakdown,      setBreakdown]      = useState<MemberMatchdayBreakdown[]>([]);
  const [loadingGroups,  setLoadingGroups]  = useState(true);
  const [loadingData,    setLoadingData]    = useState(false);
  const [pickerOpen,     setPickerOpen]     = useState(false);
  const [calculating,    setCalculating]    = useState(false);
  const [subTab,         setSubTab]         = useState<SubTab>('overall');
  const [selectedMd,     setSelectedMd]     = useState<number>(PAST_MDS[PAST_MDS.length - 1]?.matchday ?? 1);
  const [memberDetail,   setMemberDetail]   = useState<{ userId: string; username: string } | null>(null);
  const [detailSquad,    setDetailSquad]    = useState<SquadPlayer[]>([]);
  const [detailTokens,   setDetailTokens]   = useState<Token[]>([]);
  const [detailLoading,  setDetailLoading]  = useState(false);

  useEffect(() => {
    if (!user) return;
    getMyGroups(user.uid)
      .then((g) => {
        setGroups(g);
        if (g.length > 0) setSelectedGroup(g[0]);
      })
      .finally(() => setLoadingGroups(false));
  }, [user]);

  const loadData = useCallback(async () => {
    if (!selectedGroup) return;
    setLoadingData(true);
    try {
      const rows = await getGroupMatchdayBreakdown(selectedGroup.id);
      setBreakdown([...rows].sort((a, b) => b.totalPoints - a.totalPoints));
    } finally {
      setLoadingData(false);
    }
  }, [selectedGroup]);

  useEffect(() => { loadData(); }, [loadData]);

  async function refreshScores() {
    if (!selectedGroup) return;
    setCalculating(true);
    try {
      await seedMockRatings();
      await autoResolvePastMatchdays();
      await calculateGroupScores(selectedGroup.id);
      await loadData();
    } finally {
      setCalculating(false);
    }
  }

  async function openMemberDetail(userId: string, username: string) {
    setMemberDetail({ userId, username });
    setDetailLoading(true);
    setDetailSquad([]);
    setDetailTokens([]);
    try {
      const [squad, tokens] = await Promise.all([
        getMySquad(selectedGroup!.id, userId),
        getMyTokens(userId, selectedGroup!.id),
      ]);
      setDetailSquad(squad);
      setDetailTokens(tokens);
    } finally {
      setDetailLoading(false);
    }
  }

  // For "By Matchday" tab — sort members by that MD's points
  const mdRows = [...breakdown].sort(
    (a, b) => (b.byMatchday[selectedMd] ?? 0) - (a.byMatchday[selectedMd] ?? 0),
  );

  if (loadingGroups) {
    return (
      <GradientScreen>
        <SkeletonBox style={{ height: 68, borderRadius: 12, margin: 16 }} />
        <View style={{ paddingHorizontal: 16, gap: 6 }}>
          <SkeletonBox style={{ height: 80, borderRadius: 12 }} />
          {[1, 2, 3].map((i) => (
            <SkeletonBox key={i} style={{ height: 62, borderRadius: 12 }} />
          ))}
        </View>
      </GradientScreen>
    );
  }

  if (groups.length === 0) {
    return (
      <GradientScreen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <EmptyState
          icon="podium-outline"
          title="No groups yet"
          subtitle="Create or join a group to see standings."
        />
      </GradientScreen>
    );
  }

  const leader = breakdown[0];

  return (
    <GradientScreen>
      {/* Group picker */}
      <TouchableOpacity onPress={() => setPickerOpen(true)}>
        <GlassCard style={s.groupPicker}>
          <View style={s.groupPickerLeft}>
            {selectedGroup && <View style={[s.groupColorDot, { backgroundColor: selectedGroup.color }]} />}
            <View>
              <Text style={s.groupPickerLabel}>Group</Text>
              <Text style={s.groupPickerName}>{selectedGroup?.name ?? '—'}</Text>
            </View>
          </View>
          <Text style={s.chevron}>▾</Text>
        </GlassCard>
      </TouchableOpacity>

      {/* Sub-tabs */}
      <View style={s.subTabRow}>
        <TouchableOpacity
          style={[s.subTab, subTab === 'overall' && s.subTabActive]}
          onPress={() => setSubTab('overall')}
        >
          <Text style={[s.subTabText, subTab === 'overall' && s.subTabTextActive]}>Overall</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.subTab, subTab === 'matchday' && s.subTabActive]}
          onPress={() => setSubTab('matchday')}
        >
          <Text style={[s.subTabText, subTab === 'matchday' && s.subTabTextActive]}>By Matchday</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.refreshBtn, calculating && s.refreshBtnDisabled]}
          onPress={refreshScores}
          disabled={calculating}
        >
          {calculating
            ? <ActivityIndicator size="small" color={T.accent} />
            : <Ionicons name="refresh" size={18} color={T.accent} />}
        </TouchableOpacity>
      </View>

      {loadingData ? (
        <View style={{ padding: 16, gap: 6 }}>
          <SkeletonBox style={{ height: 80, borderRadius: 12 }} />
          {[1, 2, 3].map((i) => (
            <SkeletonBox key={i} style={{ height: 62, borderRadius: 12 }} />
          ))}
        </View>
      ) : subTab === 'overall' ? (
        /* ── Overall tab ── */
        <FlatList
          data={breakdown}
          keyExtractor={(m) => m.userId}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            leader && leader.totalPoints > 0 ? (
              <LinearGradient colors={[T.accent, T.accentDark]} style={s.leaderCard}>
                <Text style={{ fontSize: 30 }}>🏆</Text>
                <Text style={s.leaderLabel}>LEADING</Text>
                <Text style={s.leaderName}>{leader.username}</Text>
                <View style={s.coinBadge}>
                  <Text style={s.coinText}>{leader.totalPoints} pts</Text>
                </View>
              </LinearGradient>
            ) : null
          }
          renderItem={({ item, index }) => {
            const rank = index + 1;
            const isMe = item.userId === user?.uid;
            return (
              <TouchableOpacity
                onPress={() => openMemberDetail(item.userId, item.username)}
                activeOpacity={0.8}
              >
                <GlassCard style={[s.row, isMe && s.rowMe]}>
                  <View style={s.rankWrap}>
                    <Text style={[s.rank, { color: rankColor(rank) }]}>{rank}</Text>
                  </View>
                  <Avatar username={item.username} size={36} variant="surface" />
                  <Text style={s.name} numberOfLines={1}>
                    {item.username}{isMe ? '  (you)' : ''}
                  </Text>
                  <View style={s.coinBadge}>
                    <Text style={s.coinText}>{item.totalPoints}</Text>
                  </View>
                  <Text style={s.expandChev}>›</Text>
                </GlassCard>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={<Text style={s.fotmobCredit}>Ratings powered by FotMob</Text>}
        />
      ) : (
        /* ── By Matchday tab ── */
        <View style={{ flex: 1 }}>
          {/* MD selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.mdSelector}
          >
            {PAST_MDS.map((md) => (
              <TouchableOpacity
                key={md.matchday}
                style={[s.mdSelectorChip, selectedMd === md.matchday && s.mdSelectorChipActive]}
                onPress={() => setSelectedMd(md.matchday)}
              >
                <Text style={[s.mdSelectorText, selectedMd === md.matchday && s.mdSelectorTextActive]}>
                  MD{md.matchday}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {PAST_MDS.length === 0 ? (
            <GradientScreen style={{ justifyContent: 'center', alignItems: 'center' }}>
              <Text style={s.emptySubtitle}>No matchdays played yet.</Text>
            </GradientScreen>
          ) : (
            <FlatList
              data={mdRows}
              keyExtractor={(m) => m.userId}
              contentContainerStyle={s.list}
              ListHeaderComponent={
                <Text style={s.mdTabTitle}>
                  {MATCHDAY_SCHEDULE.find((m) => m.matchday === selectedMd)?.label ?? `Matchday ${selectedMd}`}
                </Text>
              }
              renderItem={({ item, index }) => {
                const rank  = index + 1;
                const isMe  = item.userId === user?.uid;
                const mdPts = item.byMatchday[selectedMd] ?? 0;
                return (
                  <TouchableOpacity
                    onPress={() => openMemberDetail(item.userId, item.username)}
                    activeOpacity={0.8}
                  >
                    <GlassCard style={[s.row, isMe && s.rowMe]}>
                      <View style={s.rankWrap}>
                        <Text style={[s.rank, { color: rankColor(rank) }]}>{rank}</Text>
                      </View>
                      <Avatar username={item.username} size={36} variant="surface" />
                      <Text style={s.name} numberOfLines={1}>
                        {item.username}{isMe ? '  (you)' : ''}
                      </Text>
                      <View style={s.coinBadge}>
                        <Text style={[s.coinText, mdPts === 0 && s.pointsMuted]}>{mdPts}</Text>
                      </View>
                      <Text style={s.expandChev}>›</Text>
                    </GlassCard>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Member detail modal */}
      <Modal visible={!!memberDetail} transparent animationType="slide" onRequestClose={() => setMemberDetail(null)}>
        <View style={s.detailOverlay}>
          <View style={s.detailSheet}>
            {/* Header */}
            <View style={s.detailHeader}>
              <Avatar username={memberDetail?.username ?? '?'} size={44} variant="accent" />
              <View style={{ flex: 1 }}>
                <Text style={s.detailName}>{memberDetail?.username}</Text>
                <Text style={s.detailPts}>
                  {breakdown.find((m) => m.userId === memberDetail?.userId)?.totalPoints ?? 0} pts total
                </Text>
              </View>
              <TouchableOpacity onPress={() => setMemberDetail(null)} style={s.detailClose}>
                <Ionicons name="close" size={20} color={T.textMuted} />
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <View style={s.detailCenter}>
                <ActivityIndicator size="large" color={T.accent} />
              </View>
            ) : (
              <ScrollView contentContainerStyle={s.detailScroll} showsVerticalScrollIndicator={false}>
                {/* Formation */}
                <Text style={s.detailSectionTitle}>Starting XI</Text>
                {detailSquad.filter((p) => p.isStarting).length > 0 ? (
                  <FormationField starters={detailSquad.filter((p) => p.isStarting)} />
                ) : (
                  <Text style={s.detailEmpty}>No lineup saved yet.</Text>
                )}

                {/* Tokens */}
                <Text style={s.detailSectionTitle}>Tokens</Text>
                {detailTokens.length === 0 ? (
                  <Text style={s.detailEmpty}>No tokens yet.</Text>
                ) : (
                  <View style={s.tokenList}>
                    {detailTokens.map((t) => {
                      const meta = TOKEN_META[t.tokenType];
                      return (
                        <View key={t.id} style={[s.tokenCard, { borderLeftColor: meta.color }]}>
                          <Text style={s.tokenIcon}>{meta.icon}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={s.tokenLabel}>{meta.label}</Text>
                            <Text style={s.tokenSub}>Earned MD{t.earnedMatchday}</Text>
                          </View>
                          {t.usedMatchday != null ? (
                            <View style={s.tokenUsedBadge}>
                              <Text style={s.tokenUsedText}>Used MD{t.usedMatchday}</Text>
                            </View>
                          ) : (
                            <View style={s.tokenAvailBadge}>
                              <Text style={s.tokenAvailText}>Available</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Matchday breakdown */}
                {(() => {
                  const bd = breakdown.find((m) => m.userId === memberDetail?.userId);
                  const entries = Object.entries(bd?.byMatchday ?? {}).sort(([a], [b]) => Number(a) - Number(b));
                  if (entries.length === 0) return null;
                  return (
                    <>
                      <Text style={s.detailSectionTitle}>Points by Matchday</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.mdBreakdownRow}>
                        {entries.map(([md, pts]) => (
                          <View key={md} style={s.mdChip}>
                            <Text style={s.mdChipLabel}>MD{md}</Text>
                            <Text style={s.mdChipPts}>{(pts as number) > 0 ? `+${pts}` : pts}</Text>
                          </View>
                        ))}
                      </ScrollView>
                    </>
                  );
                })()}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Group picker modal */}
      <Modal visible={pickerOpen} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Select Group</Text>
            <FlatList
              data={groups}
              keyExtractor={(g) => g.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.modalItem}
                  onPress={() => { setSelectedGroup(item); setPickerOpen(false); }}
                >
                  <View style={s.modalItemLeft}>
                    <View style={[s.groupColorDot, { backgroundColor: item.color }]} />
                    <Text style={[s.modalItemText, item.id === selectedGroup?.id && { color: item.color, fontWeight: '600' }]}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={s.modalItemStatus}>
                    {item.draftStatus === 'pending' ? 'Pending'
                      : item.draftStatus === 'in_progress' ? 'Drafting'
                      : 'Completed'}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </GradientScreen>
  );
}

const s = StyleSheet.create({
  emptySubtitle: { fontSize: 14, color: T.textSecondary, textAlign: 'center', paddingHorizontal: 32, fontFamily: 'Fredoka_500Medium' },

  groupPicker: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    margin: 16, padding: 16,
  },
  groupPickerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupColorDot: { width: 12, height: 12, borderRadius: 6 },
  groupPickerLabel: { fontSize: 11, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2, fontFamily: 'Fredoka_500Medium' },
  groupPickerName:  { fontSize: 16, fontWeight: '700', color: T.text, fontFamily: 'Fredoka_700Bold' },
  chevron: { fontSize: 18, color: T.textSecondary },

  subTabRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 8, gap: 8,
  },
  subTab: {
    flex: 1, paddingVertical: 9, borderRadius: R.chip, alignItems: 'center',
    backgroundColor: T.surface,
  },
  subTabActive:    { backgroundColor: T.accent },
  subTabText:      { fontSize: 13, fontFamily: 'Fredoka_600SemiBold', color: T.textMuted },
  subTabTextActive:{ color: '#fff', fontFamily: 'Fredoka_700Bold' },
  refreshBtn: {
    width: 40, height: 40, borderRadius: R.chip, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.surface,
  },
  refreshBtnDisabled: { opacity: 0.5 },

  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 6 },

  leaderCard: {
    borderRadius: R.leader,
    padding: 20, alignItems: 'center', marginBottom: 6,
    ...heroShadow,
  },
  leaderLabel:  { fontSize: 11, fontFamily: 'Fredoka_600SemiBold', color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  leaderName:   { fontSize: 22, fontFamily: 'Fredoka_700Bold', color: '#fff', marginBottom: 2 },

  coinBadge: { backgroundColor: T.coinBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 },
  coinText:  { color: T.coinText, fontWeight: '700', fontFamily: 'Fredoka_700Bold', fontSize: 14 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: R.card, padding: 12, gap: 10,
  },
  rowMe: { borderColor: 'rgba(45,212,191,0.3)' },
  rankWrap: { width: 28, alignItems: 'center' },
  rank:  { fontSize: 22, fontFamily: 'Fredoka_700Bold', color: T.textSecondary },
  name:       { flex: 1, fontSize: 15, color: T.text, fontFamily: 'Fredoka_500Medium' },
  pointsMuted:{ color: T.textMuted },
  expandChev: { fontSize: 12, color: T.textMuted },

  // Matchday breakdown chips (used in detail modal)
  mdBreakdownRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  mdChip: {
    alignItems: 'center', backgroundColor: T.surface2,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, gap: 2,
    borderWidth: 1, borderColor: T.glassBorder, minWidth: 48,
  },
  mdChipLabel: { fontSize: 9, fontFamily: 'Fredoka_700Bold', color: T.textMuted, textTransform: 'uppercase' },
  mdChipPts:   { fontSize: 14, fontFamily: 'Fredoka_700Bold', color: T.success },
  fotmobCredit: { fontSize: 10, color: T.textMuted, textAlign: 'center', marginTop: 16, marginBottom: 8, fontFamily: 'Fredoka_500Medium' },

  // By Matchday tab
  mdSelector: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  mdSelectorChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: T.surface,
  },
  mdSelectorChipActive: { backgroundColor: T.accent },
  mdSelectorText:       { fontSize: 13, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary },
  mdSelectorTextActive: { color: '#fff', fontFamily: 'Fredoka_600SemiBold' },
  mdTabTitle: {
    fontSize: 13, fontFamily: 'Fredoka_700Bold', color: T.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8,
  },

  // Member detail modal
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  detailSheet: {
    backgroundColor: T.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '92%', paddingTop: 20,
  },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: T.glassBorder,
  },
  detailName:  { fontSize: 17, fontFamily: 'Fredoka_700Bold', color: T.text },
  detailPts:   { fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: 'Fredoka_500Medium' },
  detailClose: { padding: 8 },
  detailCenter: { height: 200, justifyContent: 'center', alignItems: 'center' },
  detailScroll: { padding: 20, paddingBottom: 40, gap: 8 },
  detailSectionTitle: {
    fontSize: 11, fontFamily: 'Fredoka_700Bold', color: T.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 8,
  },
  detailEmpty: { fontSize: 13, color: T.textMuted, paddingVertical: 8, fontFamily: 'Fredoka_500Medium' },

  // Tokens
  tokenList: { gap: 8 },
  tokenCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: T.surface, borderRadius: R.card, padding: 12,
    borderWidth: 1, borderColor: T.glassBorder, borderLeftWidth: 4,
  },
  tokenIcon:  { fontSize: 22 },
  tokenLabel: { fontSize: 14, fontFamily: 'Fredoka_600SemiBold', color: T.text },
  tokenSub:   { fontSize: 11, color: T.textMuted, marginTop: 2, fontFamily: 'Fredoka_500Medium' },
  tokenUsedBadge: {
    backgroundColor: T.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: T.glassBorder,
  },
  tokenUsedText: { fontSize: 11, fontFamily: 'Fredoka_600SemiBold', color: T.textMuted },
  tokenAvailBadge: {
    backgroundColor: 'rgba(61,133,247,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  tokenAvailText: { fontSize: 11, fontFamily: 'Fredoka_600SemiBold', color: T.accent },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: T.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '60%' },
  modalTitle:   { fontSize: 16, fontFamily: 'Fredoka_700Bold', color: T.text, marginBottom: 16 },
  modalItem:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.glassBorder },
  modalItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalItemText:   { fontSize: 15, color: T.text, fontFamily: 'Fredoka_500Medium' },
  modalItemStatus: { fontSize: 12, color: T.textSecondary, fontFamily: 'Fredoka_500Medium' },
});
