import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation, router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import {
  getDraftState,
  getDraftPicks,
  getMySquad,
  makePick,
  subscribeToDraft,
  type DraftState,
  type DraftPickRecord,
  type SquadPlayer,
} from '@/services/draft.service';
import { getAvailablePlayers } from '@/services/player.service';
import { getPlayerRatings, type PlayerRating } from '@/services/rating.service';
import { PlayerDetailSheet } from '@/components/player-detail-sheet';
import { GradientScreen } from '@/components/gradient-screen';
import { getActiveWCTeams } from '@/services/prediction.service';
import { notifyYourDraftTurn } from '@/services/notification.service';
import { FormationField } from '@/components/formation-field';
import { CLUBS, CONFEDERATIONS, getClub, findClub, type Confederation } from '@/constants/clubs';
import type { Player, Position } from '@/types/models';
import { T, R } from '@/constants/theme';

// ── Constants ─────────────────────────────────────────────────────────────────

type Tab = 'players' | 'squad' | 'order';
type PosGroup = 'All' | 'GK' | 'DEF' | 'MID' | 'ATT';

const POS_GROUPS: PosGroup[] = ['All', 'GK', 'DEF', 'MID', 'ATT'];
const DEF_POS: Position[] = ['CB', 'RB', 'LB'];
const MID_POS: Position[] = ['CM'];
const ATT_POS: Position[] = ['W', 'ST'];
const ALL_POSITIONS: Position[] = ['GK', 'CB', 'RB', 'LB', 'CM', 'W', 'ST'];

function posGroupOf(pos: Position): PosGroup {
  if (pos === 'GK') return 'GK';
  if (DEF_POS.includes(pos)) return 'DEF';
  if (MID_POS.includes(pos)) return 'MID';
  return 'ATT';
}

function lastName(name: string) {
  const parts = name.split(' ');
  return parts[parts.length - 1];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LiveDraftScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const navigation = useNavigation();

  const [draftState,   setDraftState]   = useState<DraftState | null>(null);
  const [players,      setPlayers]      = useState<Player[]>([]);
  const [picks,        setPicks]        = useState<DraftPickRecord[]>([]);
  const [squad,        setSquad]        = useState<SquadPlayer[]>([]);
  const [activeTeams,  setActiveTeams]  = useState<Set<string>>(new Set());
  const [loading,      setLoading]      = useState(true);
  const [picking,    setPicking]    = useState(false);
  const [pickError,  setPickError]  = useState<string | null>(null);
  const [selected,   setSelected]   = useState<Player | null>(null);
  const [activeTab,  setActiveTab]  = useState<Tab>('players');
  const [orderSection, setOrderSection] = useState<'order' | 'picks'>('order');

  // Filter state
  const [search,        setSearch]        = useState('');
  const [posGroup,      setPosGroup]      = useState<PosGroup>('All');
  const [selectedClub,  setSelectedClub]  = useState<string | null>(null);
  const [filterOpen,    setFilterOpen]    = useState(false);
  const [filterLeagues, setFilterLeagues] = useState<Set<Confederation>>(new Set());
  const [filterPos,     setFilterPos]     = useState<Set<Position>>(new Set());

  // Player detail modal
  const [previewPlayer,  setPreviewPlayer]  = useState<Player | null>(null);
  const [playerRatings,  setPlayerRatings]  = useState<PlayerRating[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  const activeFilterCount = filterLeagues.size + filterPos.size;

  const loadAll = useCallback(async () => {
    if (!groupId || !user) return;
    const state = await getDraftState(groupId);
    const draftRound = state.currentDraftRound ?? 1;
    const [availablePlayers, draftPicks, mySquad, teams] = await Promise.all([
      getAvailablePlayers(groupId, draftRound),
      getDraftPicks(groupId),
      getMySquad(groupId, user.uid),
      getActiveWCTeams(),
    ]);
    setDraftState(state);
    setPlayers(availablePlayers);
    setPicks(draftPicks);
    setSquad(mySquad);
    setActiveTeams(teams);
  }, [groupId, user]);

  useEffect(() => {
    navigation.getParent()?.setOptions({
      title: 'Draft Board',
      headerRight: () => (
        <TouchableOpacity onPress={() => router.replace('/(tabs)/home')} style={{ marginRight: 4 }}>
          <Text style={{ color: T.accent, fontSize: 15, fontFamily: 'Fredoka_600SemiBold' }}>Home</Text>
        </TouchableOpacity>
      ),
    });
    loadAll().finally(() => setLoading(false));
    const unsubscribe = subscribeToDraft(groupId!, loadAll);
    return unsubscribe;
  }, [groupId, loadAll]);

  // Polling fallback: re-sync every 2s while draft is in progress
  useEffect(() => {
    if (draftState?.status !== 'in_progress') return;
    const interval = setInterval(loadAll, 2000);
    return () => clearInterval(interval);
  }, [draftState?.status, loadAll]);

  const isMyTurn = draftState?.currentPickerUserId === user?.uid && draftState?.status === 'in_progress';

  // Fire a local notification when the pick transitions to the current user
  const prevPickerRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const current = draftState?.currentPickerUserId ?? null;
    if (
      prevPickerRef.current !== undefined &&
      prevPickerRef.current !== user?.uid &&
      current === user?.uid &&
      draftState?.status === 'in_progress'
    ) {
      notifyYourDraftTurn();
    }
    prevPickerRef.current = current;
  }, [draftState?.currentPickerUserId, draftState?.status]);

  // Only show players from teams still in the competition (falls back to all if data unavailable)
  const activePlayers = useMemo(() =>
    activeTeams.size > 0 ? players.filter((p) => activeTeams.has(p.teamName)) : players,
  [players, activeTeams]);

  // Only clubs represented in the available player pool — includes unrecognized teams as stubs
  const availableClubs = useMemo(() => {
    const seen = new Set<string>();
    const unknown: typeof CLUBS = [];
    for (const p of activePlayers) {
      const club = findClub(p.teamName);
      const key = club?.name ?? p.teamName;
      if (!seen.has(key)) {
        seen.add(key);
        if (!club) {
          const shortName = p.teamName
            .replace(/^(FC |FK |AC |AS |SC |SK |BSC |GNK |SL |SS )/i, '')
            .substring(0, 3)
            .toUpperCase();
          unknown.push({ name: p.teamName, shortName, confederation: 'OFC', fdId: 0, logoUrl: '' });
        }
      }
    }
    return [...CLUBS.filter((c) => seen.has(c.name)), ...unknown];
  }, [activePlayers]);

  const filteredPlayers = useMemo(() => {
    return activePlayers.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.teamName.toLowerCase().includes(q)) return false;
      }
      if (selectedClub) {
        const clubName = findClub(p.teamName)?.name ?? p.teamName;
        if (clubName !== selectedClub) return false;
      }
      if (posGroup !== 'All' && posGroupOf(p.position) !== posGroup) return false;
      if (filterPos.size > 0 && !filterPos.has(p.position)) return false;
      if (filterLeagues.size > 0) {
        const club = findClub(p.teamName);
        if (!club || !filterLeagues.has(club.confederation)) return false;
      }
      return true;
    });
  }, [activePlayers, search, selectedClub, posGroup, filterPos, filterLeagues]);

  const picksByRound = useMemo(() => {
    const rounds: Record<number, DraftPickRecord[]> = {};
    for (const pick of picks) {
      if (!rounds[pick.round]) rounds[pick.round] = [];
      rounds[pick.round].push(pick);
    }
    return Object.entries(rounds)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([round, roundPicks]) => ({ round: Number(round), picks: roundPicks }));
  }, [picks]);

  const squadRows = useMemo(() => ({
    gk:    squad.filter((p) => p.playerPosition === 'GK' && p.isStarting),
    def:   squad.filter((p) => DEF_POS.includes(p.playerPosition) && p.isStarting),
    mid:   squad.filter((p) => MID_POS.includes(p.playerPosition) && p.isStarting),
    att:   squad.filter((p) => ATT_POS.includes(p.playerPosition) && p.isStarting),
    bench: squad.filter((p) => !p.isStarting),
  }), [squad]);

  async function confirmPick() {
    if (!selected || !isMyTurn || !groupId || !user) return;
    setPicking(true);
    setPickError(null);
    try {
      await makePick({ groupId, userId: user.uid, playerId: selected.id, playerPosition: selected.position });
      setSelected(null);
      await loadAll();
      setActiveTab('order');
    } catch (e: any) {
      setPickError(e.message ?? 'Failed to make pick.');
    } finally {
      setPicking(false);
    }
  }

  function toggleLeague(league: Confederation) {
    setFilterLeagues((prev) => {
      const next = new Set(prev);
      next.has(league) ? next.delete(league) : next.add(league);
      return next;
    });
  }

  function togglePos(pos: Position) {
    setFilterPos((prev) => {
      const next = new Set(prev);
      next.has(pos) ? next.delete(pos) : next.add(pos);
      return next;
    });
  }

  function clearFilters() {
    setFilterLeagues(new Set());
    setFilterPos(new Set());
    setPosGroup('All');
    setSelectedClub(null);
    setSearch('');
  }

  async function openPlayerDetail(player: Player) {
    setPreviewPlayer(player);
    setRatingsLoading(true);
    setPlayerRatings([]);
    try {
      const ratings = await getPlayerRatings(player.id);
      setPlayerRatings(ratings);
    } catch {
      setPlayerRatings([]);
    } finally {
      setRatingsLoading(false);
    }
  }

  if (loading) return <GradientScreen style={s.center}><ActivityIndicator size="large" color={T.accent} /></GradientScreen>;
  if (!draftState) return <GradientScreen style={s.center}><Text style={s.errorText}>Failed to load draft.</Text></GradientScreen>;

  const currentPicker = draftState.members.find((m) => m.userId === draftState.currentPickerUserId);

  return (
    <GradientScreen>
      {/* Status banner */}
      {draftState.status === 'completed' ? (
        <View style={[s.banner, { backgroundColor: T.success }]}>
          <Text style={s.bannerTitle}>Draft complete!</Text>
        </View>
      ) : isMyTurn ? (
        <LinearGradient colors={[T.accent, T.accentDark]} style={s.banner}>
          <Text style={s.bannerTitle}>Your pick!</Text>
          <Text style={s.bannerSub}>
            Pick {draftState.currentPickNumber} of {draftState.totalPicks} · Round {draftState.currentRound}
          </Text>
        </LinearGradient>
      ) : (
        <View style={[s.banner, { backgroundColor: T.surface2 }]}>
          <Text style={s.bannerTitle}>
            {`${currentPicker?.username ?? '...'}'s turn`}
          </Text>
          <Text style={s.bannerSub}>
            Pick {draftState.currentPickNumber} of {draftState.totalPicks} · Round {draftState.currentRound}
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabs}>
        {(['players', 'squad', 'order'] as Tab[]).map((tab) => (
          <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === 'players' ? `Players (${players.length})`
                : tab === 'squad' ? `My Squad (${squad.length}/15)`
                : `Order & Picks`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Players tab ───────────────────────────────────────── */}
      {activeTab === 'players' && (
        <View style={{ flex: 1 }}>
          <FlatList
            data={filteredPlayers}
            keyExtractor={(p) => p.id}
            contentContainerStyle={s.list}
            ListEmptyComponent={<Text style={s.emptyText}>No players found.</Text>}
            ListHeaderComponent={
              <>
                {/* Search + filter button */}
                <View style={s.searchRow}>
                  <TextInput
                    style={s.searchInput}
                    placeholder="Search players or clubs..."
                    placeholderTextColor={T.textMuted}
                    value={search}
                    onChangeText={setSearch}
                  />
                  <TouchableOpacity style={s.filterBtn} onPress={() => setFilterOpen(true)}>
                    <Text style={s.filterBtnText}>Filters</Text>
                    {activeFilterCount > 0 && (
                      <View style={s.filterBadge}><Text style={s.filterBadgeText}>{activeFilterCount}</Text></View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Position group chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.posChips}>
                  {POS_GROUPS.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[s.posChip, posGroup === g && s.posChipActive]}
                      onPress={() => setPosGroup(g)}
                    >
                      <Text style={[s.posChipText, posGroup === g && s.posChipTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Club logo grid — hidden while searching */}
                {!search && <View style={s.clubGrid}>
                  {availableClubs.map((club) => {
                    const active = selectedClub === club.name;
                    return (
                      <TouchableOpacity
                        key={club.name}
                        style={[s.clubBtn, active && s.clubBtnActive]}
                        onPress={() => setSelectedClub(active ? null : club.name)}
                        activeOpacity={0.7}
                      >
                        <View style={[s.clubCircle, active && s.clubCircleActive]}>
                          <ClubLogo url={club.logoUrl} shortName={club.shortName} size={54} />
                        </View>
                        <Text style={[s.clubShort, active && s.clubShortActive]} numberOfLines={1}>
                          {club.shortName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>}

                {/* Result count */}
                <View style={s.resultRow}>
                  <Text style={s.resultCount}>
                    {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}
                    {selectedClub ? ` · ${selectedClub}` : ''}
                  </Text>
                  {(activeFilterCount > 0 || selectedClub || search || posGroup !== 'All') && (
                    <TouchableOpacity onPress={clearFilters}>
                      <Text style={s.clearFilters}>Clear all</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            }
            renderItem={({ item }) => {
              const col = T.positions[item.position];
              const isSelected = selected?.id === item.id;
              return (
                <TouchableOpacity
                  style={[s.playerCard, isMyTurn && s.playerCardPickable, isSelected && s.playerCardSelected]}
                  onPress={() => {
                    if (isMyTurn) { setSelected(isSelected ? null : item); }
                    else { openPlayerDetail(item); }
                  }}
                  onLongPress={() => openPlayerDetail(item)}
                  activeOpacity={0.7}
                >
                  <ClubLogo url={findClub(item.teamName)?.logoUrl} shortName={findClub(item.teamName)?.shortName ?? '?'} size={34} />
                  <View style={[s.posBadge, { backgroundColor: col + '28' }]}>
                    <Text style={[s.posBadgeText, { color: col }]}>{item.position}</Text>
                  </View>
                  <View style={s.playerInfo}>
                    <Text style={s.playerName}>{item.name}</Text>
                    <Text style={s.playerTeam}>{item.teamName}</Text>
                  </View>
                  {isSelected && <Text style={s.selectedMark}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />

          {pickError && <Text style={s.pickError}>{pickError}</Text>}
          {selected && (
            <View style={s.confirmBar}>
              <ClubLogo url={findClub(selected.teamName)?.logoUrl} shortName={findClub(selected.teamName)?.shortName ?? '?'} size={36} />
              <View style={s.confirmInfo}>
                <Text style={s.confirmName}>{selected.name}</Text>
                <Text style={s.confirmSub}>{selected.position} · {selected.teamName}</Text>
              </View>
              <TouchableOpacity style={[s.confirmBtn, picking && s.confirmBtnDisabled]} onPress={confirmPick} disabled={picking}>
                {picking ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.confirmBtnText}>Draft</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── My Squad tab ─────────────────────────────────────── */}
      {activeTab === 'squad' && (
        <ScrollView contentContainerStyle={s.squadScroll}>
          <Text style={s.sectionLabel}>
            {squad.filter(p => p.isStarting).length < 11
              ? `${squad.length}/15 drafted`
              : `Starting XI · ${squadRows.def.length}-${squadRows.mid.length}-${squadRows.att.length}`}
          </Text>
          <FormationField starters={squad.filter((p) => p.isStarting)} showEmptySlots={squad.filter((p) => p.isStarting).length < 11} />
          {squadRows.bench.length > 0 && (
            <>
              <Text style={s.sectionLabel}>Bench</Text>
              <View style={s.benchRow}>
                {squadRows.bench.map((p) => {
                  const col = T.positions[p.playerPosition];
                  return (
                    <View key={p.playerId} style={s.slotWrapper}>
                      <View style={[s.slotCircle, { borderColor: col, backgroundColor: col + '28' }]}>
                        <Text style={[s.slotName, { color: col }]} numberOfLines={1}>{lastName(p.playerName)}</Text>
                      </View>
                      <Text style={s.slotTeam} numberOfLines={1}>{p.playerTeam}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── Order & Picks tab ────────────────────────────────── */}
      {activeTab === 'order' && (
        <ScrollView contentContainerStyle={s.list}>
          {/* Sub-tabs */}
          <View style={s.orderSubTabs}>
            <TouchableOpacity
              style={[s.orderSubTab, orderSection === 'order' && s.orderSubTabActive]}
              onPress={() => setOrderSection('order')}
            >
              <Text style={[s.orderSubTabText, orderSection === 'order' && s.orderSubTabTextActive]}>Draft Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.orderSubTab, orderSection === 'picks' && s.orderSubTabActive]}
              onPress={() => setOrderSection('picks')}
            >
              <Text style={[s.orderSubTabText, orderSection === 'picks' && s.orderSubTabTextActive]}>
                Pick Log ({picks.length})
              </Text>
            </TouchableOpacity>
          </View>

          {orderSection === 'order' && (
            <>
              <Text style={s.sectionLabel}>SNAKE DRAFT ORDER</Text>
              {draftState.members.length === 0 ? (
                <Text style={s.emptyText}>No members yet.</Text>
              ) : (
                [...draftState.members]
                  .sort((a, b) => a.draftPosition - b.draftPosition)
                  .map((m) => {
                    const isCurrent = draftState.currentPickerUserId === m.userId && draftState.status === 'in_progress';
                    const isMe = m.userId === user?.uid;
                    const myPicks = picks.filter((p) => p.userId === m.userId).length;
                    const remaining = Math.floor(draftState.totalPicks / draftState.members.length) - myPicks;
                    return (
                      <View key={m.userId} style={[s.orderCard, isCurrent && s.orderCardActive]}>
                        <View style={[s.orderPosBubble, isCurrent && s.orderPosBubbleActive]}>
                          <Text style={[s.orderPosNum, isCurrent && s.orderPosNumActive]}>
                            {m.draftPosition}
                          </Text>
                        </View>
                        <View style={s.orderInfo}>
                          <Text style={s.orderName}>
                            {m.username}{isMe ? '  (you)' : ''}
                          </Text>
                          <Text style={s.orderMeta}>
                            {myPicks} picked · {remaining > 0 ? `${remaining} remaining` : 'done'}
                          </Text>
                        </View>
                        {isCurrent && (
                          <View style={s.orderPickingBadge}>
                            <Text style={s.orderPickingText}>Picking…</Text>
                          </View>
                        )}
                      </View>
                    );
                  })
              )}

              {/* Snake order preview */}
              {draftState.members.length > 0 && (
                <>
                  <Text style={[s.sectionLabel, { marginTop: 20 }]}>ROUND PREVIEW</Text>
                  <View style={s.snakeGrid}>
                    {Array.from({ length: Math.min(draftState.members.length * 2, 8) }, (_, roundIdx) => {
                      const round = roundIdx + 1;
                      const forward = round % 2 === 1;
                      const sorted = [...draftState.members].sort((a, b) => a.draftPosition - b.draftPosition);
                      const order = forward ? sorted : [...sorted].reverse();
                      return (
                        <View key={round} style={s.snakeRound}>
                          <Text style={s.snakeRoundLabel}>R{round}</Text>
                          {order.map((m, i) => {
                            const pickNum = (round - 1) * draftState.members.length + i + 1;
                            const isMe = m.userId === user?.uid;
                            const isDone = pickNum < draftState.currentPickNumber;
                            return (
                              <View
                                key={m.userId}
                                style={[
                                  s.snakeCell,
                                  isMe && s.snakeCellMe,
                                  isDone && s.snakeCellDone,
                                ]}
                              >
                                <Text style={[s.snakeCellText, isMe && s.snakeCellTextMe, isDone && s.snakeCellTextDone]}>
                                  {pickNum}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          )}

          {orderSection === 'picks' && (
            <>
              {picksByRound.length === 0 ? (
                <Text style={s.emptyText}>No picks yet.</Text>
              ) : (
                picksByRound.map((item) => (
                  <View key={item.round} style={s.roundSection}>
                    <Text style={s.roundTitle}>Round {item.round}</Text>
                    {item.picks.map((pick) => {
                      const col = T.positions[pick.playerPosition];
                      return (
                        <View key={pick.id} style={s.pickRow}>
                          <Text style={s.pickNumber}>#{pick.pickNumber}</Text>
                          <ClubLogo url={findClub(pick.playerTeam)?.logoUrl} shortName={findClub(pick.playerTeam)?.shortName ?? '?'} size={28} />
                          <View style={[s.posBadge, { backgroundColor: col + '28' }]}>
                            <Text style={[s.posBadgeText, { color: col }]}>{pick.playerPosition}</Text>
                          </View>
                          <View style={s.playerInfo}>
                            <Text style={s.playerName}>{pick.playerName}</Text>
                            <Text style={s.playerTeam}>{pick.playerTeam}</Text>
                          </View>
                          <Text style={s.pickUser}>{pick.username}</Text>
                        </View>
                      );
                    })}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Player detail sheet ───────────────────────────────── */}
      <PlayerDetailSheet
        player={previewPlayer}
        ratings={playerRatings}
        loading={ratingsLoading}
        onClose={() => setPreviewPlayer(null)}
      />

      {/* ── Filter sheet ─────────────────────────────────────── */}
      <Modal visible={filterOpen} transparent animationType="slide">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setFilterOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={s.filterSheet}>
            <View style={s.filterSheetHandle} />
            <Text style={s.filterSheetTitle}>Filters</Text>

            <Text style={s.filterSectionLabel}>POSITION</Text>
            <View style={s.filterChipRow}>
              {ALL_POSITIONS.map((pos) => {
                const active = filterPos.has(pos);
                const col = T.positions[pos];
                return (
                  <TouchableOpacity
                    key={pos}
                    style={[s.filterChip, active && { backgroundColor: col, borderColor: col }]}
                    onPress={() => togglePos(pos)}
                  >
                    <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{pos}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.filterSectionLabel}>CONFEDERATION</Text>
            <View style={s.filterChipRow}>
              {CONFEDERATIONS.map((league) => {
                const active = filterLeagues.has(league);
                return (
                  <TouchableOpacity
                    key={league}
                    style={[s.filterChip, s.filterChipWide, active && s.filterChipActiveBlue]}
                    onPress={() => toggleLeague(league)}
                  >
                    <Text style={[s.filterChipText, active && s.filterChipTextActive]}>{league}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.filterActions}>
              <TouchableOpacity style={s.filterClearBtn} onPress={() => { setFilterLeagues(new Set()); setFilterPos(new Set()); }}>
                <Text style={s.filterClearBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.filterApplyBtn} onPress={() => setFilterOpen(false)}>
                <Text style={s.filterApplyBtnText}>
                  Show {filteredPlayers.length} players
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </GradientScreen>
  );
}

// ── Club logo component ───────────────────────────────────────────────────────

function ClubLogo({ url, shortName, size = 40 }: { url?: string; shortName: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const radius = size / 2;
  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: T.surface2, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: size * 0.28, fontFamily: 'Fredoka_700Bold', color: T.textSecondary }}>{shortName}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  center:    { justifyContent: 'center', alignItems: 'center' },
  errorText: { color: T.error, fontSize: 15, fontFamily: 'Fredoka_500Medium' },

  banner:      { padding: 14, paddingTop: 18 },
  bannerTitle: { color: '#fff', fontSize: 16, fontFamily: 'Fredoka_700Bold' },
  bannerSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2, fontFamily: 'Fredoka_500Medium' },

  tabs:         { flexDirection: 'row', backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.glassBorder },
  tab:          { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: T.accent },
  tabText:      { fontSize: 12, color: T.textSecondary, fontFamily: 'Fredoka_500Medium' },
  tabTextActive:{ color: T.accent, fontFamily: 'Fredoka_700Bold' },

  // Search + filter bar
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: T.surface,
    borderBottomWidth: 1, borderBottomColor: T.glassBorder,
  },
  searchInput: {
    flex: 1, backgroundColor: T.surface2, borderRadius: R.chip,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14,
    color: T.text, borderWidth: 1, borderColor: T.glassBorder,
    fontFamily: 'Fredoka_500Medium',
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.surface2, borderRadius: R.chip, borderWidth: 1, borderColor: T.glassBorder,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  filterBtnText: { fontSize: 13, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary },
  filterBadge: { backgroundColor: T.accent, borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  filterBadgeText: { fontSize: 10, fontFamily: 'Fredoka_700Bold', color: '#fff' },

  // Position group chips
  posChips: { paddingHorizontal: 10, paddingVertical: 8, gap: 6, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.glassBorder },
  posChip:          { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.glassBorder },
  posChipActive:    { backgroundColor: T.accent, borderColor: T.accent },
  posChipText:      { fontSize: 12, fontFamily: 'Fredoka_700Bold', color: T.textSecondary },
  posChipTextActive:{ color: '#fff' },

  // Club grid — 4 columns
  clubGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 8, paddingVertical: 12,
    backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.glassBorder,
    justifyContent: 'space-evenly', gap: 4,
  },
  clubBtn: { width: '22%', alignItems: 'center', paddingVertical: 6, borderRadius: R.card, gap: 5 },
  clubBtnActive: { backgroundColor: T.accent + '22' },
  clubCircle: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    padding: 5, borderWidth: 1.5, borderColor: T.glassBorder,
  },
  clubCircleActive: { borderColor: T.accent, borderWidth: 2.5 },
  clubShort:       { fontSize: 10, fontFamily: 'Fredoka_700Bold', color: T.textSecondary },
  clubShortActive: { color: T.accent },

  // Result row
  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
  },
  resultCount:  { fontSize: 12, color: T.textMuted, fontFamily: 'Fredoka_500Medium' },
  clearFilters: { fontSize: 12, color: T.accent, fontFamily: 'Fredoka_600SemiBold' },

  // Player list
  list: { padding: 10, gap: 6 },
  playerCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface,
    borderRadius: R.card, padding: 10, gap: 10, borderWidth: 1, borderColor: T.glassBorder,
  },
  playerCardPickable: { borderColor: T.glassBorder },
  playerCardSelected: { borderColor: T.accent, backgroundColor: T.accent + '18' },
  posBadge:     { borderRadius: R.chip, paddingHorizontal: 7, paddingVertical: 3, minWidth: 36, alignItems: 'center' },
  posBadgeText: { fontSize: 11, fontFamily: 'Fredoka_700Bold' },
  playerInfo:   { flex: 1 },
  playerName:   { fontSize: 14, fontFamily: 'Fredoka_600SemiBold', color: T.text },
  playerTeam:   { fontSize: 12, color: T.textSecondary, marginTop: 1, fontFamily: 'Fredoka_500Medium' },
  selectedMark: { fontSize: 16, color: T.accent, fontFamily: 'Fredoka_700Bold' },
  emptyText:    { textAlign: 'center', color: T.textMuted, padding: 40, fontSize: 14, fontFamily: 'Fredoka_500Medium' },

  // Confirm bar
  confirmBar: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12,
    backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.glassBorder,
  },
  confirmInfo:      { flex: 1 },
  confirmName:      { fontSize: 15, fontFamily: 'Fredoka_700Bold', color: T.text },
  confirmSub:       { fontSize: 12, color: T.textSecondary, marginTop: 1, fontFamily: 'Fredoka_500Medium' },
  pickError:        { backgroundColor: T.error + '22', color: T.error, fontSize: 13, padding: 10, textAlign: 'center', fontFamily: 'Fredoka_500Medium' },
  confirmBtn:       { backgroundColor: T.accent, borderRadius: R.button, paddingHorizontal: 20, paddingVertical: 12 },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText:   { color: '#fff', fontFamily: 'Fredoka_600SemiBold', fontSize: 15 },

  // Squad tab
  squadScroll:  { padding: 16, gap: 16 },
  sectionLabel: { fontSize: 11, fontFamily: 'Fredoka_700Bold', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  benchRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: T.surface, borderRadius: R.card, padding: 16,
    borderWidth: 1, borderColor: T.glassBorder,
  },
  slotWrapper: { alignItems: 'center', width: 68 },
  slotCircle:  { width: 60, height: 60, borderRadius: 30, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  slotName:    { fontSize: 11, fontFamily: 'Fredoka_700Bold', textAlign: 'center', paddingHorizontal: 2 },
  slotTeam:    { fontSize: 9, color: T.textSecondary, marginTop: 4, textAlign: 'center', fontFamily: 'Fredoka_500Medium' },

  // Board tab
  roundSection: { gap: 5 },
  roundTitle:   { fontSize: 10, fontFamily: 'Fredoka_700Bold', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface,
    borderRadius: R.card, padding: 10, gap: 8, borderWidth: 1, borderColor: T.glassBorder,
    opacity: 0.5,
  },
  pickNumber: { fontSize: 11, color: T.textMuted, width: 26, textAlign: 'right', fontFamily: 'Fredoka_500Medium' },
  pickUser:   { fontSize: 11, color: T.textSecondary, fontFamily: 'Fredoka_500Medium' },

  // Player detail modal (unused stubs kept for compatibility)
  detailSheet: {
    backgroundColor: T.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40, maxHeight: '85%',
  },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  detailClubCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: T.glassBorder, padding: 5,
  },
  detailHeaderInfo: { flex: 1 },
  detailName:      { fontSize: 17, fontFamily: 'Fredoka_700Bold', color: T.text },
  detailTeam:      { fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: 'Fredoka_500Medium' },
  detailPosBadge:  { borderRadius: R.chip, paddingHorizontal: 10, paddingVertical: 5 },
  detailPosText:   { fontSize: 13, fontFamily: 'Fredoka_700Bold' },
  detailStats: {
    flexDirection: 'row', backgroundColor: T.surface2, borderRadius: R.card,
    padding: 16, marginBottom: 20, borderWidth: 1, borderColor: T.glassBorder,
  },
  detailStat:      { flex: 1, alignItems: 'center' },
  detailStatVal:   { fontSize: 22, fontFamily: 'Fredoka_700Bold', color: T.text },
  detailStatLabel: { fontSize: 10, color: T.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Fredoka_500Medium' },
  detailStatDivider: { width: 1, backgroundColor: T.glassBorder, marginVertical: 2 },
  detailSectionLabel: { fontSize: 10, fontFamily: 'Fredoka_700Bold', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  detailEmpty:     { fontSize: 13, color: T.textMuted, textAlign: 'center', paddingVertical: 20, fontFamily: 'Fredoka_500Medium' },
  detailRatingList:{ maxHeight: 280 },
  ratingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.glassBorder,
  },
  ratingMdBadge:  { backgroundColor: T.accent + '22', borderRadius: R.chip, paddingHorizontal: 7, paddingVertical: 3, minWidth: 36, alignItems: 'center' },
  ratingMdText:   { fontSize: 11, fontFamily: 'Fredoka_700Bold', color: T.accent },
  ratingMdLabel:  { flex: 1, fontSize: 12, color: T.textSecondary, fontFamily: 'Fredoka_500Medium' },
  ratingRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingScore:    { fontSize: 15, fontFamily: 'Fredoka_700Bold', color: T.text },
  ratingPts:      { fontSize: 13, fontFamily: 'Fredoka_600SemiBold', color: T.success, minWidth: 44, textAlign: 'right' },
  ratingDnp:      { fontSize: 12, color: T.textMuted, fontStyle: 'italic', fontFamily: 'Fredoka_500Medium' },
  detailDraftBtn: { backgroundColor: T.accent, borderRadius: R.button, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  detailDraftBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Fredoka_600SemiBold' },

  // Order & Picks tab
  orderSubTabs: {
    flexDirection: 'row', backgroundColor: T.surface2,
    borderRadius: R.card, padding: 3, marginBottom: 16,
  },
  orderSubTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: R.chip },
  orderSubTabActive: { backgroundColor: T.surface },
  orderSubTabText: { fontSize: 13, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary },
  orderSubTabTextActive: { color: T.text, fontFamily: 'Fredoka_700Bold' },

  orderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.surface, borderRadius: R.card, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: T.glassBorder,
  },
  orderCardActive: { borderColor: T.accent, backgroundColor: T.accent + '14' },
  orderPosBubble: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: T.surface2, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: T.glassBorder,
  },
  orderPosBubbleActive: { backgroundColor: T.accent, borderColor: T.accent },
  orderPosNum:       { fontSize: 15, fontFamily: 'Fredoka_700Bold', color: T.textSecondary },
  orderPosNumActive: { color: '#fff' },
  orderInfo:       { flex: 1 },
  orderName:       { fontSize: 14, fontFamily: 'Fredoka_700Bold', color: T.text },
  orderMeta:       { fontSize: 12, color: T.textSecondary, marginTop: 2, fontFamily: 'Fredoka_500Medium' },
  orderPickingBadge: {
    backgroundColor: T.accent, borderRadius: R.chip, paddingHorizontal: 8, paddingVertical: 4,
  },
  orderPickingText: { fontSize: 11, fontFamily: 'Fredoka_700Bold', color: '#fff' },

  // Snake grid
  snakeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  snakeRound: {
    backgroundColor: T.surface, borderRadius: R.card, padding: 8,
    alignItems: 'center', gap: 4, borderWidth: 1, borderColor: T.glassBorder,
    minWidth: 44,
  },
  snakeRoundLabel: { fontSize: 9, fontFamily: 'Fredoka_700Bold', color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  snakeCell: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: T.surface2, justifyContent: 'center', alignItems: 'center',
  },
  snakeCellMe:   { backgroundColor: T.accent + '30', borderWidth: 1, borderColor: T.accent },
  snakeCellDone: { opacity: 0.35 },
  snakeCellText: { fontSize: 11, fontFamily: 'Fredoka_700Bold', color: T.textSecondary },
  snakeCellTextMe:   { color: T.accent },
  snakeCellTextDone: { color: T.textMuted },

  // Filter modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  filterSheet: {
    backgroundColor: T.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  filterSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.glassBorder, alignSelf: 'center', marginBottom: 16 },
  filterSheetTitle:  { fontSize: 18, fontFamily: 'Fredoka_700Bold', color: T.text, marginBottom: 16 },
  filterSectionLabel:{ fontSize: 11, fontFamily: 'Fredoka_700Bold', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 12 },
  filterChipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: T.surface, borderWidth: 1, borderColor: T.glassBorder },
  filterChipWide:    { paddingHorizontal: 14 },
  filterChipActiveBlue: { backgroundColor: T.accent, borderColor: T.accent },
  filterChipText:    { fontSize: 13, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary },
  filterChipTextActive: { color: '#fff' },
  filterActions:    { flexDirection: 'row', gap: 10, marginTop: 24 },
  filterClearBtn:   { flex: 1, borderRadius: R.button, borderWidth: 1, borderColor: T.glassBorder, paddingVertical: 13, alignItems: 'center' },
  filterClearBtnText: { fontSize: 14, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary },
  filterApplyBtn:   { flex: 2, backgroundColor: T.accent, borderRadius: R.button, paddingVertical: 13, alignItems: 'center' },
  filterApplyBtnText: { fontSize: 14, fontFamily: 'Fredoka_700Bold', color: '#fff' },
});
