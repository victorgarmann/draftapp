import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { getMyGroups, type GroupDetail } from '@/services/group.service';
import {
  getMySquad,
  getSquadWithPoints,
  validateLineup,
  setStartingLineup,
  getPlayerOwnerInGroup,
  ensureLineupSnapshots,
  type SquadPlayer,
  type SquadPlayerWithPoints,
} from '@/services/draft.service';
import {
  getMyTokens,
  useToken,
  getGroupSquadPlayers,
  seedStartingTokens,
  TOKEN_META,
  type Token,
  type TokenType,
  type GroupSquadPlayer,
} from '@/services/prediction.service';
import { getNextMatchday, isLineupLocked, getPlayerRatings, type PlayerRating } from '@/services/rating.service';
import { PlayerDetailSheet } from '@/components/player-detail-sheet';
import { FormationField, type SpotLayout } from '@/components/formation-field';
import { JerseyIcon } from '@/components/jersey-icon';
import { TokenCoin } from '@/components/token-coin';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, R } from '@/constants/theme';
import { GradientScreen } from '@/components/gradient-screen';
import { GlassCard } from '@/components/glass-card';
import type { Player, Position } from '@/types/models';

const DEF_POS: Position[] = ['CB', 'RB', 'LB'];
const MID_POS: Position[] = ['CM'];
const ATT_POS: Position[] = ['W', 'ST'];

function formationLabel(starters: SquadPlayer[]) {
  const def = starters.filter((p) => DEF_POS.includes(p.playerPosition)).length;
  const mid = starters.filter((p) => MID_POS.includes(p.playerPosition)).length;
  const att = starters.filter((p) => ATT_POS.includes(p.playerPosition)).length;
  return `${def}-${mid}-${att}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MyTeamScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupDetail[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupDetail | null>(null);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [squadWithPoints, setSquadWithPoints] = useState<SquadPlayerWithPoints[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [opponentPlayers, setOpponentPlayers] = useState<GroupSquadPlayer[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingSquad, setLoadingSquad] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'squad' | 'points' | 'tokens'>('squad');

  // Player detail sheet state
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [detailRatings, setDetailRatings] = useState<PlayerRating[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOwner, setDetailOwner] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Drag state
  const dragPlayerRef = useRef<SquadPlayer | null>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const dropTargetIdRef = useRef<string | null>(null);
  const [dragPlayer, setDragPlayer] = useState<SquadPlayer | null>(null);
  const [ghostVisible, setGhostVisible] = useState(false);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const ghostXY = useRef(new Animated.ValueXY()).current;
  const spotLayouts = useRef(new Map<string, SpotLayout>()).current;
  const containerRef = useRef<View>(null);
  const containerOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!user) return;
    getMyGroups(user.uid).then((g) => {
      setGroups(g);
      if (g.length > 0) setSelectedGroup(g[0]);
    }).finally(() => setLoadingGroups(false));
  }, [user]);

  const loadSquad = useCallback(async () => {
    if (!user || !selectedGroup) return;
    setLoadingSquad(true);
    try {
      await seedStartingTokens(user.uid, selectedGroup.id);
      // Ensure past matchdays have lineup snapshots (lazy carryover for users who haven't changed lineup)
      await ensureLineupSnapshots(selectedGroup.id, user.uid);
      const [s, sp, tk, opp] = await Promise.all([
        getMySquad(selectedGroup.id, user.uid),
        getSquadWithPoints(selectedGroup.id, user.uid),
        getMyTokens(user.uid, selectedGroup.id),
        getGroupSquadPlayers(selectedGroup.id, user.uid),
      ]);
      setSquad(s);
      setSquadWithPoints(sp);
      setTokens(tk);
      setOpponentPlayers(opp);
    } finally {
      setLoadingSquad(false);
    }
  }, [user, selectedGroup]);

  useEffect(() => { loadSquad(); }, [loadSquad]);

  // Derived
  const starters = editing
    ? squad.filter((p) => pendingIds.has(p.playerId))
    : squad.filter((p) => p.isStarting);
  const bench = editing
    ? squad.filter((p) => !pendingIds.has(p.playerId))
    : squad.filter((p) => !p.isStarting);

  const isDirty = editing && JSON.stringify([...pendingIds].sort()) !==
    JSON.stringify(squad.filter(p => p.isStarting).map(p => p.playerId).sort());

  useEffect(() => { pendingIdsRef.current = pendingIds; }, [pendingIds]);

  async function openPlayerDetail(p: SquadPlayer) {
    const player: Player = {
      id: p.playerId,
      fotmobId: null,
      name: p.playerName,
      teamName: p.playerTeam,
      position: p.playerPosition,
      imageUrl: null,
      isAvailable: true,
    };
    setDetailPlayer(player);
    setDetailRatings([]);
    setDetailOwner(null);
    setDetailLoading(true);
    try {
      const [ratings, owner] = await Promise.all([
        getPlayerRatings(p.playerId),
        selectedGroup ? getPlayerOwnerInGroup(selectedGroup.id, p.playerId) : Promise.resolve(null),
      ]);
      setDetailRatings(ratings);
      setDetailOwner(owner);
    } catch {
      // retain last-known state
    } finally {
      setDetailLoading(false);
    }
  }

  function startEdit() {
    setPendingIds(new Set(squad.filter((p) => p.isStarting).map((p) => p.playerId)));
    setSelected(null);
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSelected(null);
    setError(null);
  }

  function handleTap(playerId: string) {
    if (!editing) return;
    setError(null);

    if (selected === null) {
      setSelected(playerId);
      return;
    }
    if (selected === playerId) {
      setSelected(null);
      return;
    }

    const aIsStarting = pendingIds.has(selected);
    const bIsStarting = pendingIds.has(playerId);

    if (aIsStarting === bIsStarting) {
      setSelected(playerId);
      return;
    }

    const newIds = new Set(pendingIds);
    if (aIsStarting) {
      newIds.delete(selected);
      newIds.add(playerId);
    } else {
      newIds.delete(playerId);
      newIds.add(selected);
    }

    const newStarters = squad.filter((p) => newIds.has(p.playerId));
    const err = validateLineup(newStarters);
    if (err) {
      setError(err);
      setSelected(null);
      return;
    }

    setPendingIds(newIds);
    setSelected(null);
  }

  async function saveLineup() {
    const err = validateLineup(starters);
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      await setStartingLineup({
        groupId: selectedGroup!.id,
        userId: user!.uid,
        startingPlayerIds: [...pendingIds],
      });
      await loadSquad();
      setEditing(false);
    } catch (e: any) {
      setError(e.message ?? 'Failed to save lineup.');
    } finally {
      setSaving(false);
    }
  }

  function handleDragStart(player: SquadPlayer, pageX: number, pageY: number) {
    dragPlayerRef.current = player;
    setDragPlayer(player);
    setGhostVisible(true);
    ghostXY.setValue({
      x: pageX - containerOffset.current.x - 35,
      y: pageY - containerOffset.current.y - 35,
    });
  }

  function handleDragMove(pageX: number, pageY: number) {
    ghostXY.setValue({
      x: pageX - containerOffset.current.x - 35,
      y: pageY - containerOffset.current.y - 35,
    });
    let found: string | null = null;
    for (const [pid, layout] of spotLayouts) {
      if (
        pageX >= layout.x && pageX <= layout.x + layout.width &&
        pageY >= layout.y && pageY <= layout.y + layout.height
      ) {
        found = pid;
        break;
      }
    }
    if (found !== dropTargetIdRef.current) {
      dropTargetIdRef.current = found;
      setDropTargetId(found);
    }
  }

  function handleDragEnd(pageX: number, pageY: number) {
    let targetId: string | null = null;
    for (const [pid, layout] of spotLayouts) {
      if (
        pageX >= layout.x && pageX <= layout.x + layout.width &&
        pageY >= layout.y && pageY <= layout.y + layout.height
      ) {
        targetId = pid;
        break;
      }
    }
    const player = dragPlayerRef.current;
    if (player && targetId) {
      const draggingBench = !pendingIdsRef.current.has(player.playerId);
      const targetIsStarter = pendingIdsRef.current.has(targetId);
      if (draggingBench && targetIsStarter) {
        const newIds = new Set(pendingIdsRef.current);
        newIds.delete(targetId);
        newIds.add(player.playerId);
        const newStarters = squad.filter((p) => newIds.has(p.playerId));
        const err = validateLineup(newStarters);
        if (err) {
          setError(err);
        } else {
          setError(null);
          setPendingIds(newIds);
        }
      }
    }
    dragPlayerRef.current = null;
    dropTargetIdRef.current = null;
    setDragPlayer(null);
    setGhostVisible(false);
    setDropTargetId(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingGroups) return <GradientScreen><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={T.accent} /></View></GradientScreen>;

  if (groups.length === 0) {
    return (
      <GradientScreen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySubtitle}>Create or join a group to get started.</Text>
        </View>
      </GradientScreen>
    );
  }

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onLayout={() => containerRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
        containerOffset.current = { x: pageX, y: pageY };
      })}
    >
      <GradientScreen>
      {/* Combined deadline + token header — scroll-pinned */}
      {(() => {
        const next = getNextMatchday();
        const locked = isLineupLocked();
        const diffMs = next ? new Date(next.deadline).getTime() - Date.now() : 0;
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const deadlineText = !next
          ? 'Season complete'
          : locked
            ? `MD${next.matchday} in progress — lineup locked`
            : hours < 24
              ? `Deadline in ${hours}h — save your lineup!`
              : `MD${next.matchday} deadline: ${new Date(next.deadline).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;

        return (
          <View style={[styles.pinnedHeader, { paddingTop: insets.top + 10 }]}>
            <View style={styles.pinnedDeadline}>
              <Ionicons
                name={locked ? 'lock-closed' : (next && hours < 24) ? 'warning-outline' : 'time-outline'}
                size={12}
                color={locked ? T.success : (next && hours < 24) ? T.warning : T.accent}
              />
              <Text style={styles.pinnedDeadlineText} numberOfLines={1}>{deadlineText}</Text>
            </View>
            <View style={styles.pinnedTokens}>
              {(['nullify', 'double_points', 'bench_boost'] as TokenType[]).map((type) => {
                const available = tokens.filter((t) => t.tokenType === type && t.usedMatchday === null).length;
                return (
                  <TouchableOpacity key={type} onPress={() => setActiveTab('tokens')} activeOpacity={0.8}>
                    <TokenCoin type={type} size={32} count={available} dimmed={available === 0} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })()}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} scrollEnabled={!dragPlayer}>
      {/* Group picker */}
      <TouchableOpacity style={styles.groupPicker} onPress={() => setPickerOpen(true)}>
        <View style={styles.groupPickerLeft}>
          {selectedGroup && <View style={[styles.groupColorDot, { backgroundColor: selectedGroup.color }]} />}
          <View>
            <Text style={styles.groupPickerLabel}>Group</Text>
            <Text style={styles.groupPickerName}>{selectedGroup?.name ?? '—'}</Text>
          </View>
        </View>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'squad' && styles.tabItemActive]}
          onPress={() => { setActiveTab('squad'); cancelEdit(); }}
        >
          <Text style={[styles.tabText, activeTab === 'squad' && styles.tabTextActive]}>Squad</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'points' && styles.tabItemActive]}
          onPress={() => { setActiveTab('points'); cancelEdit(); }}
        >
          <Text style={[styles.tabText, activeTab === 'points' && styles.tabTextActive]}>Points</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'tokens' && styles.tabItemActive]}
          onPress={() => { setActiveTab('tokens'); cancelEdit(); }}
        >
          <Text style={[styles.tabText, activeTab === 'tokens' && styles.tabTextActive]}>
            Tokens{tokens.filter(t => t.usedMatchday === null).length > 0
              ? ` (${tokens.filter(t => t.usedMatchday === null).length})`
              : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {loadingSquad ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={T.accent} /></View>
      ) : squad.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.emptyTitle}>No squad yet</Text>
          <Text style={styles.emptySubtitle}>
            {selectedGroup?.draftStatus === 'pending'
              ? "The draft hasn't started yet."
              : 'Your squad will appear here after the draft.'}
          </Text>
        </View>
      ) : activeTab === 'squad' ? (
        <SquadTab
          squad={squad}
          starters={starters}
          bench={bench}
          editing={editing}
          selected={selected}
          isDirty={isDirty}
          saving={saving}
          error={error}
          scrollEnabled={!dragPlayer}
          dropTargetId={dropTargetId}
          onTap={handleTap}
          onOpenDetail={openPlayerDetail}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onSave={saveLineup}
          onSpotMeasured={(pid, layout) => { spotLayouts.set(pid, layout); }}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        />
      ) : activeTab === 'points' ? (
        <PointsTab squadWithPoints={squadWithPoints} />
      ) : (
        <TokensTab
          tokens={tokens}
          mySquad={squad}
          opponentPlayers={opponentPlayers}
          groupId={selectedGroup!.id}
          onRefresh={loadSquad}
        />
      )}

      </ScrollView>
      </GradientScreen>

      {/* Ghost overlay */}
      {ghostVisible && dragPlayer && (
        <Animated.View style={[styles.ghost, ghostXY.getLayout()]} pointerEvents="none">
          <Text style={styles.ghostPos}>{dragPlayer.playerPosition}</Text>
          <Text style={styles.ghostName}>{dragPlayer.playerName.split(' ').slice(-1)[0]}</Text>
        </Animated.View>
      )}

      {/* Player detail sheet */}
      <PlayerDetailSheet
        player={detailPlayer}
        ratings={detailRatings}
        loading={detailLoading}
        ownerUsername={detailOwner}
        onClose={() => setDetailPlayer(null)}
      />

      {/* Group picker modal */}
      <Modal visible={pickerOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Group</Text>
            <FlatList
              data={groups}
              keyExtractor={(g) => g.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setSelectedGroup(item); setPickerOpen(false); setEditing(false); }}
                >
                  <View style={styles.modalItemLeft}>
                    <View style={[styles.groupColorDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.modalItemText, item.id === selectedGroup?.id && { color: item.color, fontFamily: 'Fredoka_600SemiBold' }]}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={styles.modalItemStatus}>
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
    </View>
  );
}

// ── Squad tab ─────────────────────────────────────────────────────────────────

function SquadTab({
  squad, starters, bench, editing, selected, isDirty, saving, error,
  scrollEnabled, dropTargetId, onTap, onOpenDetail, onStartEdit, onCancelEdit, onSave,
  onSpotMeasured, onDragStart, onDragMove, onDragEnd,
}: {
  squad: SquadPlayer[];
  starters: SquadPlayer[];
  bench: SquadPlayer[];
  editing: boolean;
  selected: string | null;
  isDirty: boolean;
  saving: boolean;
  error: string | null;
  scrollEnabled: boolean;
  dropTargetId: string | null;
  onTap: (id: string) => void;
  onOpenDetail: (p: SquadPlayer) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onSpotMeasured: (pid: string, layout: SpotLayout) => void;
  onDragStart: (player: SquadPlayer, pageX: number, pageY: number) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDragEnd: (pageX: number, pageY: number) => void;
}) {
  function handleFormationPress(id: string) {
    if (editing) { onTap(id); return; }
    const p = starters.find((s) => s.playerId === id);
    if (p) onOpenDetail(p);
  }

  return (
    <View>
      <Text style={styles.formationLabel}>
        {starters.length === 11 ? formationLabel(starters) : `${starters.length}/11 selected`}
      </Text>

      <FormationField
        starters={starters}
        editing={editing}
        selectedId={selected}
        dropTargetId={dropTargetId}
        onPlayerPress={handleFormationPress}
        onSpotMeasured={onSpotMeasured}
      />

      <View style={styles.benchSection}>
        <Text style={styles.benchLabel}>BENCH</Text>
        <GlassCard style={styles.benchRow}>
          {bench.map((p) => (
            <DraggableBenchSpot
              key={p.playerId}
              player={p}
              selected={selected === p.playerId}
              editing={editing}
              onPress={() => editing ? onTap(p.playerId) : onOpenDetail(p)}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
            />
          ))}
          {bench.length === 0 && (
            <Text style={styles.benchEmpty}>All players in starting XI</Text>
          )}
        </GlassCard>
      </View>

      {editing && (
        <Text style={styles.hint}>
          {selected ? 'Now tap a player to swap positions' : 'Tap a player or drag bench players to swap'}
        </Text>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.actions}>
        {editing ? (
          <>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancelEdit}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (!isDirty || saving) && styles.saveBtnDisabled]}
              onPress={onSave}
              disabled={!isDirty || saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Save Lineup</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.editBtn} onPress={onStartEdit}>
            <Text style={styles.editBtnText}>Choose Starting 11</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Points tab ────────────────────────────────────────────────────────────────

const POS_ORDER: Record<string, number> = { GK: 0, CB: 1, RB: 1, LB: 1, CM: 2, W: 3, ST: 3 };

function PointsTab({ squadWithPoints }: { squadWithPoints: SquadPlayerWithPoints[] }) {
  const sorted = [...squadWithPoints].sort((a, b) => {
    const posDiff = (POS_ORDER[a.playerPosition] ?? 9) - (POS_ORDER[b.playerPosition] ?? 9);
    if (posDiff !== 0) return posDiff;
    return b.totalPoints - a.totalPoints;
  });

  const totalPoints = sorted.reduce((sum, p) => sum + (p.isStarting ? p.totalPoints : 0), 0);

  return (
    <View>
      <GlassCard style={styles.totalRow}>
        <Text style={styles.totalLabel}>Starting XI Total</Text>
        <Text style={styles.totalPoints}>{totalPoints} pts</Text>
      </GlassCard>

      {sorted.map((p) => (
        <GlassCard key={p.playerId} style={[styles.playerRow, !p.isStarting && styles.playerRowBench]}>
          <View style={styles.playerRowLeft}>
            <View style={styles.posTag}>
              <Text style={styles.posTagText}>{p.playerPosition}</Text>
            </View>
            <View>
              <Text style={styles.playerRowName}>{p.playerName}</Text>
              <Text style={styles.playerRowTeam}>{p.playerTeam}</Text>
            </View>
          </View>
          <View style={styles.playerRowRight}>
            {!p.isStarting && <Text style={styles.benchBadge}>BENCH</Text>}
            <Text style={[styles.playerRowPoints, p.totalPoints === 0 && styles.playerRowPointsZero]}>
              {p.totalPoints > 0 ? `+${p.totalPoints}` : p.totalPoints} pts
            </Text>
          </View>
        </GlassCard>
      ))}
      <Text style={styles.fotmobCredit}>Ratings powered by FotMob</Text>
    </View>
  );
}

// ── Tokens tab ────────────────────────────────────────────────────────────────

function TokensTab({
  tokens, mySquad, opponentPlayers, groupId, onRefresh,
}: {
  tokens: Token[];
  mySquad: SquadPlayer[];
  opponentPlayers: GroupSquadPlayer[];
  groupId: string;
  onRefresh: () => void;
}) {
  const nextMd = getNextMatchday();
  const locked = isLineupLocked();
  const available = tokens.filter((t) => t.usedMatchday === null);
  const used = tokens.filter((t) => t.usedMatchday !== null);

  const [usingToken, setUsingToken] = useState<Token | null>(null);
  const [targetPlayer, setTargetPlayer] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function confirmUse() {
    if (!usingToken || !nextMd) return;
    if ((usingToken.tokenType === 'nullify' || usingToken.tokenType === 'double_points') && !targetPlayer) {
      Alert.alert('Select a player', 'You must pick a target player for this token.');
      return;
    }
    setSaving(true);
    try {
      await useToken({
        tokenId: usingToken.id,
        usedMatchday: nextMd.matchday,
        targetPlayerId: targetPlayer ?? undefined,
      });
      setUsingToken(null);
      setTargetPlayer(null);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  const canUseTokens = locked && !!nextMd;

  // Player lists for each token type
  const nullifyTargets = opponentPlayers.filter((p) => p.isStarting);
  const doubleTargets  = mySquad.filter((p) => p.isStarting);
  const benchPlayers   = mySquad.filter((p) => !p.isStarting);

  // Group nullify targets by opponent username
  const nullifyByOpponent: { owner: string; players: GroupSquadPlayer[] }[] = [];
  for (const p of nullifyTargets) {
    const g = nullifyByOpponent.find((x) => x.owner === p.ownerUsername);
    if (g) g.players.push(p);
    else nullifyByOpponent.push({ owner: p.ownerUsername, players: [p] });
  }

  function getTargetName(pid: string): string {
    const all = [...nullifyTargets, ...doubleTargets];
    const p = all.find((x) => x.playerId === pid);
    return p ? p.playerName.split(' ').slice(-1)[0] : '—';
  }

  function formatDeadlineTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function PlayerRow({ p, selectable = true }: { p: { playerId: string; playerName: string; playerTeam: string; playerPosition: string }; selectable?: boolean }) {
    return (
      <TouchableOpacity
        style={[styles.playerPickItem, selectable && targetPlayer === p.playerId && styles.playerPickItemSelected]}
        onPress={selectable ? () => setTargetPlayer(p.playerId) : undefined}
        disabled={!selectable}
        activeOpacity={selectable ? 0.7 : 1}
      >
        <JerseyIcon teamName={p.playerTeam} isGK={p.playerPosition === 'GK'} size={28} />
        <View style={{ flex: 1 }}>
          <Text style={styles.playerPickName}>{p.playerName}</Text>
          <Text style={styles.playerPickTeam}>{p.playerTeam}</Text>
        </View>
        <View style={styles.posBadge}>
          <Text style={styles.posBadgeText}>{p.playerPosition}</Text>
        </View>
        {selectable && targetPlayer === p.playerId && <Ionicons name="checkmark" size={18} color={T.accent} />}
      </TouchableOpacity>
    );
  }

  return (
    <View>
      {/* Status banner */}
      <View style={[styles.deadlineBanner, canUseTokens ? styles.deadlineBannerActive : styles.deadlineBannerWaiting]}>
        <Ionicons name={canUseTokens ? 'flash' : 'hourglass-outline'} size={22} color={canUseTokens ? '#f39c12' : T.textMuted} />
        <View style={{ flex: 1 }}>
          {canUseTokens ? (
            <>
              <Text style={styles.deadlineBannerTitle}>Token window open</Text>
              <Text style={styles.deadlineBannerSub}>MD{nextMd!.matchday} · {nextMd!.label}</Text>
            </>
          ) : nextMd ? (
            <>
              <Text style={styles.deadlineBannerTitle}>Tokens available after lineup deadline</Text>
              <Text style={styles.deadlineBannerSub}>Window opens: {formatDeadlineTime(nextMd.deadline)}</Text>
            </>
          ) : (
            <Text style={styles.deadlineBannerTitle}>No upcoming matchday</Text>
          )}
        </View>
      </View>

      {/* Available tokens */}
      <Text style={styles.tokenSectionLabel}>AVAILABLE</Text>
      {available.length === 0 ? (
        <View style={styles.noTokensBox}>
          <Text style={styles.noTokensText}>No tokens yet</Text>
          <Text style={styles.noTokensSub}>Predict match scores correctly to earn tokens.</Text>
          <TouchableOpacity style={[styles.fixturesLink, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => router.push('/fixtures')}>
            <Text style={styles.fixturesLinkText}>Go to Fixtures</Text>
            <Ionicons name="chevron-forward" size={14} color={T.accent} />
          </TouchableOpacity>
        </View>
      ) : (
        available.map((token) => (
          <TouchableOpacity
            key={token.id}
            style={[styles.tokenCard, canUseTokens && { borderColor: TOKEN_META[token.tokenType].color }]}
            onPress={canUseTokens ? () => { setUsingToken(token); setTargetPlayer(null); } : undefined}
            activeOpacity={canUseTokens ? 0.75 : 1}
          >
            <TokenCoin type={token.tokenType} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={styles.tokenCardTitle}>{TOKEN_META[token.tokenType].label}</Text>
              <Text style={styles.tokenCardDesc}>{TOKEN_META[token.tokenType].description}</Text>
              <Text style={styles.tokenCardEarned}>
                {token.earnedMatchday === 0 ? 'Starting bonus' : `Earned MD${token.earnedMatchday}`}
              </Text>
            </View>
            {canUseTokens && (
              <Text style={[styles.tokenCardChevron, { color: TOKEN_META[token.tokenType].color }]}>›</Text>
            )}
          </TouchableOpacity>
        ))
      )}

      {/* Used tokens */}
      {used.length > 0 && (
        <>
          <Text style={[styles.tokenSectionLabel, { marginTop: 20 }]}>USED</Text>
          {used.map((token) => (
            <View key={token.id} style={[styles.tokenCard, styles.tokenCardUsed]}>
              <TokenCoin type={token.tokenType} size={52} dimmed />
              <View style={{ flex: 1 }}>
                <Text style={[styles.tokenCardTitle, { opacity: 0.5 }]}>{TOKEN_META[token.tokenType].label}</Text>
                <Text style={styles.tokenCardEarned}>Used MD{token.usedMatchday}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* ── Nullify full-screen picker (standings-style) ── */}
      <Modal
        visible={usingToken?.tokenType === 'nullify'}
        animationType="slide"
        onRequestClose={() => { setUsingToken(null); setTargetPlayer(null); }}
      >
        <View style={styles.nullifyScreen}>
          {/* Header */}
          <View style={styles.nullifyHeader}>
            <TouchableOpacity onPress={() => { setUsingToken(null); setTargetPlayer(null); }} style={styles.nullifyCloseBtn}>
              <Ionicons name="close" size={20} color={T.textMuted} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.nullifyTitle}>🚫 Nullify</Text>
              <Text style={styles.nullifySubtitle}>
                {nextMd ? `MD${nextMd.matchday} · ${nextMd.label}` : ''}
              </Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <Text style={styles.nullifyInstruction}>Tap a starting player to nullify their points this matchday</Text>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
            {nullifyByOpponent.length === 0 ? (
              <Text style={styles.nullifyEmpty}>No opponent starters found. Opponents may not have saved a lineup yet.</Text>
            ) : nullifyByOpponent.map(({ owner, players }) => (
              <View key={owner} style={styles.nullifyOpponentSection}>
                {/* Opponent header row */}
                <View style={styles.nullifyOpponentHeader}>
                  <View style={styles.nullifyOpponentAvatar}>
                    <Text style={styles.nullifyOpponentAvatarText}>{owner.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.nullifyOpponentName}>{owner}</Text>
                </View>
                {/* Their starting players */}
                {players.map((p) => (
                  <TouchableOpacity
                    key={p.playerId}
                    style={[styles.nullifyPlayerRow, targetPlayer === p.playerId && styles.nullifyPlayerRowSelected]}
                    onPress={() => setTargetPlayer(p.playerId === targetPlayer ? null : p.playerId)}
                    activeOpacity={0.7}
                  >
                    <JerseyIcon teamName={p.playerTeam} isGK={p.playerPosition === 'GK'} size={32} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.nullifyPlayerName}>{p.playerName}</Text>
                      <Text style={styles.nullifyPlayerTeam}>{p.playerTeam}</Text>
                    </View>
                    <View style={styles.posBadge}>
                      <Text style={styles.posBadgeText}>{p.playerPosition}</Text>
                    </View>
                    {targetPlayer === p.playerId && (
                      <Ionicons name="checkmark" size={18} color="#e74c3c" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>

          {/* Sticky confirm bar */}
          {targetPlayer && (
            <View style={styles.nullifyConfirmBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nullifyConfirmName}>Nullify {getTargetName(targetPlayer)}</Text>
                <Text style={styles.nullifyConfirmMd}>{nextMd ? `MD${nextMd.matchday} · ${nextMd.label}` : ''}</Text>
              </View>
              <TouchableOpacity
                style={[styles.nullifyConfirmBtn, saving && styles.saveBtnDisabled]}
                onPress={confirmUse}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.nullifyConfirmBtnText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Double Points / Bench Boost bottom-sheet modal ── */}
      <Modal
        visible={!!usingToken && usingToken.tokenType !== 'nullify'}
        transparent
        animationType="slide"
        onRequestClose={() => { setUsingToken(null); setTargetPlayer(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.useModalSheet}>
            {/* Header */}
            <View style={styles.useModalHeader}>
              {usingToken && <TokenCoin type={usingToken.tokenType} size={44} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.useModalTitle}>
                  {usingToken ? TOKEN_META[usingToken.tokenType].label : ''}
                </Text>
                <Text style={styles.useModalMd}>
                  {nextMd ? `MD${nextMd.matchday} · ${nextMd.label}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setUsingToken(null); setTargetPlayer(null); }} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={T.textMuted} />
              </TouchableOpacity>
            </View>

            {usingToken?.tokenType === 'bench_boost' ? (
              <>
                <Text style={styles.useModalPickLabel}>Your bench will also score this matchday:</Text>
                <View style={styles.playerPickList}>
                  {benchPlayers.length === 0
                    ? <Text style={styles.playerPickEmpty}>No bench players in squad yet.</Text>
                    : benchPlayers.map((p) => <PlayerRow key={p.playerId} p={p} selectable={false} />)
                  }
                </View>
              </>
            ) : usingToken?.tokenType === 'double_points' ? (
              <>
                <Text style={styles.useModalPickLabel}>Pick one of your starters to double:</Text>
                <ScrollView style={styles.playerPickList} nestedScrollEnabled>
                  {doubleTargets.length === 0
                    ? <Text style={styles.playerPickEmpty}>No starters found. Save your lineup first.</Text>
                    : doubleTargets.map((p) => <PlayerRow key={p.playerId} p={p} />)
                  }
                </ScrollView>
              </>
            ) : null}

            {usingToken && (targetPlayer || usingToken.tokenType === 'bench_boost') && (
              <View style={styles.confirmSummary}>
                <Text style={styles.confirmText}>
                  {TOKEN_META[usingToken.tokenType].icon}{' '}
                  <Text style={{ fontFamily: 'Fredoka_700Bold' }}>{TOKEN_META[usingToken.tokenType].label}</Text>
                  {targetPlayer ? ` → ${getTargetName(targetPlayer)}` : ' → all bench players'}
                </Text>
                <Text style={styles.confirmMd}>
                  {nextMd ? `MD${nextMd.matchday} · ${nextMd.label}` : ''}
                </Text>
              </View>
            )}

            <View style={styles.useModalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setUsingToken(null); setTargetPlayer(null); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={confirmUse}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function benchPosLabel(pos: Position): string {
  if (pos === 'GK') return 'GK';
  if (DEF_POS.includes(pos)) return 'Defender';
  if (MID_POS.includes(pos)) return 'Midfielder';
  return 'Attacker';
}

// ── Bench spot ────────────────────────────────────────────────────────────────

function BenchSpot({ player, selected, onPress }: {
  player: SquadPlayer;
  selected: boolean;
  editing: boolean;
  onPress: () => void;
}) {
  const lastName = player.playerName.split(' ').slice(-1)[0];
  return (
    <TouchableOpacity style={styles.playerWrap} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.benchPosLabel}>{benchPosLabel(player.playerPosition)}</Text>
      <View style={[styles.jerseyWrap, selected && styles.jerseyWrapSelected]}>
        <JerseyIcon teamName={player.playerTeam} isGK={player.playerPosition === 'GK'} size={52} />
      </View>
      <Text style={styles.playerName} numberOfLines={1}>{lastName}</Text>
    </TouchableOpacity>
  );
}

// ── DraggableBenchSpot ────────────────────────────────────────────────────────

function DraggableBenchSpot({
  player, selected, editing, onPress, onDragStart, onDragMove, onDragEnd,
}: {
  player: SquadPlayer;
  selected: boolean;
  editing: boolean;
  onPress: () => void;
  onDragStart: (player: SquadPlayer, pageX: number, pageY: number) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDragEnd: (pageX: number, pageY: number) => void;
}) {
  const editingRef = useRef(editing);
  useEffect(() => { editingRef.current = editing; }, [editing]);

  const playerRef = useRef(player);
  useEffect(() => { playerRef.current = player; }, [player]);

  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  const onPressRef = useRef(onPress);
  useEffect(() => { onDragStartRef.current = onDragStart; }, [onDragStart]);
  useEffect(() => { onDragMoveRef.current = onDragMove; }, [onDragMove]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);
  useEffect(() => { onPressRef.current = onPress; }, [onPress]);

  const startPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editingRef.current,
      onPanResponderGrant: (evt) => {
        startPos.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
        isDragging.current = false;
      },
      onPanResponderMove: (evt) => {
        if (!editingRef.current) return;
        const { pageX, pageY } = evt.nativeEvent;
        if (!isDragging.current) {
          const dx = Math.abs(pageX - startPos.current.x);
          const dy = Math.abs(pageY - startPos.current.y);
          if (dx > 8 || dy > 8) {
            isDragging.current = true;
            onDragStartRef.current(playerRef.current, pageX, pageY);
          }
        }
        if (isDragging.current) {
          onDragMoveRef.current(pageX, pageY);
        }
      },
      onPanResponderRelease: (evt) => {
        if (isDragging.current) {
          onDragEndRef.current(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        } else {
          onPressRef.current();
        }
        isDragging.current = false;
      },
      onPanResponderTerminate: (evt) => {
        if (isDragging.current) {
          onDragEndRef.current(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        }
        isDragging.current = false;
      },
    })
  ).current;

  const lastName = player.playerName.split(' ').slice(-1)[0];

  return (
    <View style={styles.playerWrap} {...panResponder.panHandlers}>
      <TouchableOpacity
        onPress={onPress}
        disabled={editing}
        activeOpacity={0.7}
        style={{ alignItems: 'center', width: '100%' }}
      >
        <Text style={styles.benchPosLabel}>{benchPosLabel(player.playerPosition)}</Text>
        <View style={[styles.jerseyWrap, selected && styles.jerseyWrapSelected]}>
          <JerseyIcon teamName={player.playerTeam} isGK={player.playerPosition === 'GK'} size={52} />
        </View>
        <Text style={styles.playerName} numberOfLines={1}>{lastName}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  squadTabContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  emptyTitle: { fontSize: 17, fontFamily: 'Fredoka_700Bold', color: T.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, fontFamily: 'Fredoka_500Medium', color: T.textSecondary, textAlign: 'center', paddingHorizontal: 32 },

  groupPicker: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: T.surface, margin: 16, marginBottom: 0, borderRadius: R.card,
    padding: 16, borderWidth: 1, borderColor: T.glassBorder,
  },
  groupPickerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupColorDot: { width: 12, height: 12, borderRadius: 6 },
  groupPickerLabel: { fontSize: 11, fontFamily: 'Fredoka_400Regular', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  groupPickerName: { fontSize: 16, fontFamily: 'Fredoka_700Bold', color: T.text },
  chevron: { fontSize: 18, fontFamily: 'Fredoka_500Medium', color: T.textSecondary },

  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: T.surface, borderRadius: R.chip, padding: 4,
    borderWidth: 1, borderColor: T.glassBorder,
  },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: R.chip },
  tabItemActive: { backgroundColor: T.accent },
  tabText: { fontSize: 14, fontFamily: 'Fredoka_600SemiBold', color: T.textMuted },
  tabTextActive: { color: '#fff', fontFamily: 'Fredoka_700Bold' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },

  formationLabel: {
    textAlign: 'center', fontSize: 13, fontFamily: 'Fredoka_600SemiBold',
    color: T.textSecondary, marginBottom: 8, letterSpacing: 1,
  },

  benchSection: { marginTop: 16 },
  benchLabel: { fontSize: 11, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  benchRow: {
    flexDirection: 'row', justifyContent: 'space-evenly',
    paddingVertical: 16,
    minHeight: 88, alignItems: 'center',
  },
  benchEmpty: { fontSize: 13, fontFamily: 'Fredoka_400Regular', color: T.textMuted },

  hint: { textAlign: 'center', fontSize: 13, fontFamily: 'Fredoka_500Medium', color: T.accent, marginTop: 12 },
  errorText: { textAlign: 'center', fontFamily: 'Fredoka_500Medium', color: T.error, fontSize: 13, marginTop: 8 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  editBtn: {
    flex: 1, backgroundColor: T.surface, borderRadius: R.button,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(45,212,191,0.4)',
  },
  editBtnText: { color: T.accent, fontSize: 15, fontFamily: 'Fredoka_600SemiBold' },
  cancelBtn: {
    flex: 1, backgroundColor: T.surface, borderRadius: R.button,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: T.glassBorder,
  },
  cancelBtnText: { color: T.textSecondary, fontSize: 15, fontFamily: 'Fredoka_600SemiBold' },
  saveBtn: { flex: 2, backgroundColor: T.accent, borderRadius: R.button, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Fredoka_700Bold' },

  playerWrap: { alignItems: 'center', width: 70 },
  jerseyWrap: { marginBottom: 5, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  jerseyWrapSelected: { borderColor: T.accent },
  benchPosLabel: { fontSize: 9, fontFamily: 'Fredoka_700Bold', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  playerName: { fontSize: 11, fontFamily: 'Fredoka_500Medium', color: T.text, textAlign: 'center' },

  // Points tab
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: { fontSize: 14, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary },
  totalPoints: { fontSize: 22, fontFamily: 'Fredoka_700Bold', color: T.accent },

  playerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  playerRowBench: { opacity: 0.6 },
  playerRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  posTag: {
    backgroundColor: T.surface2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: T.glassBorder, minWidth: 38, alignItems: 'center',
  },
  posTagText: { fontSize: 11, fontFamily: 'Fredoka_700Bold', color: T.textSecondary },
  playerRowName: { fontSize: 14, fontFamily: 'Fredoka_600SemiBold', color: T.text },
  playerRowTeam: { fontSize: 12, fontFamily: 'Fredoka_400Regular', color: T.textMuted, marginTop: 1 },
  playerRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  benchBadge: { fontSize: 10, fontFamily: 'Fredoka_700Bold', color: T.textMuted, letterSpacing: 0.5 },
  playerRowPoints: { fontSize: 16, fontFamily: 'Fredoka_700Bold', color: T.accent, minWidth: 52, textAlign: 'right' },
  playerRowPointsZero: { color: T.textMuted },
  fotmobCredit: { fontSize: 10, fontFamily: 'Fredoka_400Regular', color: T.textSecondary, textAlign: 'center', marginTop: 16, marginBottom: 4 },

  // Pinned header (deadline + tokens)
  pinnedHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: T.glassBorder,
    backgroundColor: T.bgGradientStart,
  },
  pinnedDeadline: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  pinnedDeadlineText: { fontSize: 12, fontFamily: 'Fredoka_500Medium', color: T.textSecondary, flexShrink: 1 },
  pinnedTokens: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  // Tokens tab
  tokenSectionLabel: { fontSize: 11, fontFamily: 'Fredoka_700Bold', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  deadlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: R.card, padding: 14, marginBottom: 16,
    borderWidth: 1,
  },
  deadlineBannerActive: { backgroundColor: 'rgba(243,156,18,0.1)', borderColor: '#f39c12' },
  deadlineBannerWaiting: { backgroundColor: T.surface, borderColor: T.glassBorder },
  deadlineBannerTitle: { fontSize: 14, fontFamily: 'Fredoka_700Bold', color: T.text },
  deadlineBannerSub: { fontSize: 12, fontFamily: 'Fredoka_400Regular', color: T.textSecondary, marginTop: 2 },

  noTokensBox: {
    backgroundColor: T.surface, borderRadius: R.card, borderWidth: 1, borderColor: T.glassBorder,
    padding: 24, alignItems: 'center', gap: 6,
  },
  noTokensText: { fontSize: 15, fontFamily: 'Fredoka_600SemiBold', color: T.text },
  noTokensSub: { fontSize: 13, fontFamily: 'Fredoka_500Medium', color: T.textSecondary, textAlign: 'center' },
  fixturesLink: { marginTop: 8 },
  fixturesLinkText: { fontSize: 14, fontFamily: 'Fredoka_600SemiBold', color: T.accent },

  tokenCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.surface, borderRadius: R.card, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: T.glassBorder,
    borderLeftWidth: 4,
  },
  tokenCardUsed: { opacity: 0.5 },
  tokenIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  tokenCardTitle: { fontSize: 14, fontFamily: 'Fredoka_700Bold', color: T.text },
  tokenCardDesc: { fontSize: 12, fontFamily: 'Fredoka_500Medium', color: T.textSecondary, marginTop: 2, lineHeight: 16 },
  tokenCardEarned: { fontSize: 11, fontFamily: 'Fredoka_400Regular', color: T.textMuted, marginTop: 4 },
  tokenCardChevron: { fontSize: 24, marginLeft: 4 },

  // Nullify full-screen picker
  nullifyScreen: { flex: 1, backgroundColor: T.bg },
  nullifyHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: T.glassBorder,
  },
  nullifyCloseBtn: { width: 44, alignItems: 'flex-start' },
  nullifyTitle: { fontSize: 18, fontFamily: 'Fredoka_700Bold', color: T.text },
  nullifySubtitle: { fontSize: 12, fontFamily: 'Fredoka_400Regular', color: T.textSecondary, marginTop: 2 },
  nullifyInstruction: {
    fontSize: 13, fontFamily: 'Fredoka_500Medium', color: T.textSecondary, textAlign: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: T.glassBorder,
  },
  nullifyEmpty: { fontSize: 13, fontFamily: 'Fredoka_400Regular', color: T.textMuted, textAlign: 'center', padding: 32 },
  nullifyOpponentSection: { paddingHorizontal: 16, marginTop: 8 },
  nullifyOpponentHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12,
  },
  nullifyOpponentAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: T.accent, justifyContent: 'center', alignItems: 'center',
  },
  nullifyOpponentAvatarText: { fontSize: 14, fontFamily: 'Fredoka_700Bold', color: '#fff' },
  nullifyOpponentName: { fontSize: 15, fontFamily: 'Fredoka_700Bold', color: T.text },
  nullifyPlayerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 10,
    borderRadius: R.card, marginBottom: 4,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.glassBorder,
  },
  nullifyPlayerRowSelected: {
    borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.08)',
  },
  nullifyPlayerName: { fontSize: 14, fontFamily: 'Fredoka_600SemiBold', color: T.text },
  nullifyPlayerTeam: { fontSize: 11, fontFamily: 'Fredoka_400Regular', color: T.textMuted, marginTop: 1 },
  nullifyConfirmBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.glassBorder,
    paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 32, gap: 12,
  },
  nullifyConfirmName: { fontSize: 15, fontFamily: 'Fredoka_700Bold', color: T.text },
  nullifyConfirmMd: { fontSize: 12, fontFamily: 'Fredoka_400Regular', color: T.textSecondary, marginTop: 2 },
  nullifyConfirmBtn: {
    backgroundColor: '#e74c3c', borderRadius: R.button,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  nullifyConfirmBtnText: { fontSize: 14, fontFamily: 'Fredoka_700Bold', color: '#fff' },

  useModalSheet: {
    backgroundColor: T.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '80%',
  },
  useModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  useModalTitle: { fontSize: 17, fontFamily: 'Fredoka_700Bold', color: T.text },
  useModalMd: { fontSize: 12, fontFamily: 'Fredoka_400Regular', color: T.textSecondary, marginTop: 2 },
  useModalPickLabel: { fontSize: 11, fontFamily: 'Fredoka_700Bold', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  playerPickList: { maxHeight: 240, marginBottom: 12 },
  playerPickItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.glassBorder,
  },
  playerPickItemSelected: { backgroundColor: 'rgba(20,184,166,0.12)', borderRadius: 6 },
  playerPickName: { fontSize: 14, fontFamily: 'Fredoka_600SemiBold', color: T.text },
  playerPickTeam: { fontSize: 11, fontFamily: 'Fredoka_400Regular', color: T.textMuted, marginTop: 1 },
  playerPickEmpty: { fontSize: 13, fontFamily: 'Fredoka_400Regular', color: T.textMuted, paddingVertical: 12, textAlign: 'center' },
  posBadge: {
    backgroundColor: T.surface2, borderRadius: R.chip, paddingHorizontal: 6, paddingVertical: 2,
  },
  posBadgeText: { fontSize: 10, fontFamily: 'Fredoka_700Bold', color: T.textSecondary },
  opponentHeader: {
    fontSize: 11, fontFamily: 'Fredoka_700Bold', color: T.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingTop: 12, paddingBottom: 4,
  },
  confirmSummary: {
    backgroundColor: T.surface2, borderRadius: R.card, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: T.glassBorder,
  },
  confirmText: { fontSize: 14, fontFamily: 'Fredoka_500Medium', color: T.text },
  confirmMd: { fontSize: 12, fontFamily: 'Fredoka_400Regular', color: T.textSecondary, marginTop: 4 },
  useModalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: T.bg, borderTopLeftRadius: R.card, borderTopRightRadius: R.card, padding: 20, maxHeight: '60%' },
  modalTitle: { fontSize: 16, fontFamily: 'Fredoka_700Bold', color: T.text, marginBottom: 16 },
  modalItem:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.glassBorder },
  modalItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalItemText: { fontSize: 15, fontFamily: 'Fredoka_500Medium', color: T.text },
  modalItemStatus: { fontSize: 12, fontFamily: 'Fredoka_400Regular', color: T.textSecondary },

  ghost: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: T.accent,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    elevation: 10,
    opacity: 0.9,
  },
  ghostPos: { fontSize: 11, fontFamily: 'Fredoka_700Bold', color: '#fff' },
  ghostName: { fontSize: 12, fontFamily: 'Fredoka_600SemiBold', color: '#fff' },
  dragHint: { fontSize: 10, fontFamily: 'Fredoka_400Regular', color: T.textMuted, marginTop: 1 },
});
