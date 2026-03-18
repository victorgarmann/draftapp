import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  ScrollView,
  Clipboard,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import {
  getGroup,
  getGroupMembers,
  updateGroupSettings,
  leaveGroup,
  setManualDraftOrder,
  type GroupDetail,
  type MemberWithProfile,
} from '@/services/group.service';
import { startDraft, startSecondDraft } from '@/services/draft.service';

const GROUP_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#EF4444',
  '#F59E0B', '#EC4899', '#14B8A6', '#6366F1',
];
import { T, R } from '@/constants/theme';
import { GradientScreen } from '@/components/gradient-screen';
import { GlassCard } from '@/components/glass-card';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const navigation = useNavigation();

  const [group,    setGroup]    = useState<GroupDetail | null>(null);
  const [members,  setMembers]  = useState<MemberWithProfile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [starting, setStarting] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [leaving,        setLeaving]        = useState(false);
  const [draftOrder,     setDraftOrder]     = useState<MemberWithProfile[]>([]);
  const [savingOrder,    setSavingOrder]    = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickedDate,     setPickedDate]     = useState<Date>(new Date());

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [g, m] = await Promise.all([getGroup(id), getGroupMembers(id)]);
      setGroup(g);
      // Sort: by points (desc) if draft done, else by draft position
      const sorted = g?.draftStatus === 'completed'
        ? [...m].sort((a, b) => b.totalPoints - a.totalPoints)
        : [...m].sort((a, b) => (a.draftPosition ?? 99) - (b.draftPosition ?? 99));
      setMembers(sorted);
      // Seed draft order editor for manual+pending groups
      if (g?.draftOrderMode === 'manual' && g?.draftStatus === 'pending') {
        const ordered = [...m].sort((a, b) => (a.draftPosition ?? 99) - (b.draftPosition ?? 99));
        setDraftOrder(ordered);
      }
      setError(null);
      navigation.getParent()?.setOptions({ title: g?.name ?? 'Group' });
    } catch (e: any) {
      setError(e.message ?? 'Failed to load group.');
    }
  }, [id]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  // Real-time: reload when members join/leave or group settings change
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`group-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, load]);

  async function shareInviteCode() {
    if (!group) return;
    await Share.share({
      message: `Join my FotDraft group "${group.name}"!\n\nTap to join: fotdraft://join/${group.inviteCode}\n\nOr enter code: ${group.inviteCode}`,
    });
  }

  function copyInviteCode() {
    if (!group) return;
    Clipboard.setString(group.inviteCode);
    Alert.alert('Copied!', `Invite code ${group.inviteCode} copied to clipboard.`);
  }

  if (loading) {
    return <GradientScreen><View style={s.center}><ActivityIndicator size="large" color={T.accent} /></View></GradientScreen>;
  }

  if (error || !group) {
    return (
      <GradientScreen>
        <View style={s.center}>
          <Text style={s.errorText}>{error ?? 'Group not found.'}</Text>
        </View>
      </GradientScreen>
    );
  }

  const accent = group.color;

  async function handleColorChange(c: string) {
    setGroup((g) => g ? { ...g, color: c } : g);
    await updateGroupSettings(group.id, { color: c });
  }

  async function handleTokensToggle() {
    const next = !group.tokensEnabled;
    setGroup((g) => g ? { ...g, tokensEnabled: next } : g);
    await updateGroupSettings(group.id, { tokensEnabled: next });
  }

  async function handleDraftOrderModeToggle() {
    const next = group.draftOrderMode === 'manual' ? 'random' : 'manual';
    setGroup((g) => g ? { ...g, draftOrderMode: next } : g);
    if (next === 'manual') {
      setDraftOrder([...members]);
    } else {
      setDraftOrder([]);
    }
    await updateGroupSettings(group.id, { draftOrderMode: next });
  }

  async function handleScheduleDraft(date: Date) {
    setGroup((g) => g ? { ...g, draftDate: date.toISOString() } : g);
    await updateGroupSettings(group.id, { draftDate: date.toISOString() });
  }

  async function handleClearDraftDate() {
    setGroup((g) => g ? { ...g, draftDate: null } : g);
    await updateGroupSettings(group.id, { draftDate: null });
  }

  function moveMember(index: number, dir: -1 | 1) {
    const next = [...draftOrder];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setDraftOrder(next);
  }

  async function handleSaveOrder() {
    setSavingOrder(true);
    try {
      await setManualDraftOrder(group.id, draftOrder.map((m) => m.userId));
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save order.');
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleLeave() {
    if (!user) return;
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              await leaveGroup(group.id, user.uid);
              router.replace('/(tabs)/home');
            } catch (e: any) {
              setError(e.message ?? 'Failed to leave group.');
              setLeaving(false);
            }
          },
        },
      ],
    );
  }

  const isCreator      = user?.uid === group.creatorId;
  const canStartDraft  = isCreator && group.draftStatus === 'pending' && group.memberCount >= 1;
  const draftDone      = group.draftStatus === 'completed';
  const draftLive      = group.draftStatus === 'in_progress';
  const canStartRound2 = isCreator && draftDone && group.currentDraftRound === 1;

  const statusColor = draftDone ? T.success : draftLive ? T.warning : T.textSecondary;
  const statusLabel = draftDone ? 'Draft Complete' : draftLive ? 'Drafting Now' : 'Waiting to Draft';

  const leader = draftDone ? members[0] : null;

  return (
    <GradientScreen>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Status banner */}
        <GlassCard style={[s.statusBanner, { borderColor: statusColor + '44' }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
          <Text style={s.statusMeta}>
            {group.memberCount}/{group.maxMembers} members
            {' · '}
            {group.draftOrderMode === 'random' ? 'Random order' : 'Manual order'}
          </Text>
        </GlassCard>

        {/* Draft countdown */}
        {group.draftStatus === 'pending' && group.draftDate && (
          <GlassCard style={[s.countdownCard, { borderColor: accent + '44' }]}>
            <Text style={[s.countdownLabel, { color: accent }]}>Draft scheduled</Text>
            <Text style={s.countdownDate}>{formatDraftDate(group.draftDate)}</Text>
            <Text style={[s.countdownRemaining, { color: accent }]}>{formatCountdown(group.draftDate)}</Text>
          </GlassCard>
        )}

        {/* Leader card (when draft complete) */}
        {leader && leader.totalPoints > 0 && (
          <View style={[s.leaderCard, { backgroundColor: accent }]}>
            <Text style={s.leaderLabel}>LEADING</Text>
            <View style={s.leaderAvatar}>
              <Text style={s.leaderAvatarText}>{leader.username.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={s.leaderName}>{leader.username}</Text>
            <Text style={s.leaderPts}>{leader.totalPoints} pts</Text>
          </View>
        )}

        {/* Invite code */}
        <GlassCard variant="bright" style={s.codeCard}>
          <View style={s.codeLeft}>
            <Text style={s.codeLabel}>Invite Code</Text>
            <Text style={s.code}>{group.inviteCode}</Text>
          </View>
          <View style={s.codeBtns}>
            <TouchableOpacity style={s.codeBtn} onPress={copyInviteCode}>
              <Text style={s.codeBtnText}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.codeBtn, { backgroundColor: accent, borderColor: accent }]} onPress={shareInviteCode}>
              <Text style={[s.codeBtnText, { color: '#fff' }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Members */}
        <Text style={s.sectionTitle}>
          {draftDone ? 'Standings' : 'Members'}
        </Text>

        {members.map((item, index) => {
          const rank  = draftDone ? index + 1 : null;
          const isMe  = item.userId === user?.uid;
          const isTop = rank === 1;
          return (
            <GlassCard
              key={item.id}
              style={[
                s.memberRow,
                isMe && { borderColor: accent },
                isTop && s.memberRowTop,
              ]}
            >
              {/* Rank or draft position */}
              {rank !== null ? (
                <View style={[s.posBubble, isTop && s.posBubbleTop]}>
                  <Text style={[s.posBubbleText, isTop && s.posBubbleTextTop]}>
                    {rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : rank}
                  </Text>
                </View>
              ) : item.draftPosition ? (
                <View style={s.posBubble}>
                  <Text style={s.posBubbleText}>#{item.draftPosition}</Text>
                </View>
              ) : (
                <View style={[s.posBubble, { backgroundColor: T.surface2 }]}>
                  <Text style={s.posBubbleText}>—</Text>
                </View>
              )}

              <View style={s.memberAvatar}>
                <Text style={[s.memberAvatarText, { color: accent }]}>{item.username.charAt(0).toUpperCase()}</Text>
              </View>

              <View style={s.memberInfo}>
                <Text style={s.memberName} numberOfLines={1}>
                  {item.username}
                  {isMe ? '  (you)' : ''}
                  {item.userId === group.creatorId ? '  👑' : ''}
                </Text>
                {item.displayName && (
                  <Text style={s.memberDisplay} numberOfLines={1}>{item.displayName}</Text>
                )}
              </View>

              {draftDone && (
                <Text style={s.memberPts}>{item.totalPoints}</Text>
              )}
            </GlassCard>
          );
        })}

        {/* View standings link */}
        {draftDone && (
          <TouchableOpacity style={s.standingsLink} onPress={() => router.push('/(tabs)/standings')}>
            <Text style={s.standingsLinkText}>View full standings →</Text>
          </TouchableOpacity>
        )}

        {/* Manual draft order editor */}
        {isCreator && group.draftOrderMode === 'manual' && group.draftStatus === 'pending' && draftOrder.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Draft Order</Text>
            <GlassCard style={s.orderCard}>
              <Text style={s.orderHint}>Pick order — first in list picks first.</Text>
              {draftOrder.map((member, index) => (
                <View key={member.id} style={s.orderRow}>
                  <View style={[s.orderPos, { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
                    <Text style={[s.orderPosText, { color: accent }]}>#{index + 1}</Text>
                  </View>
                  <View style={s.memberAvatar}>
                    <Text style={[s.memberAvatarText, { color: accent }]}>{member.username.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={s.orderName} numberOfLines={1}>{member.username}</Text>
                  <View style={s.orderBtns}>
                    <TouchableOpacity
                      style={[s.orderBtn, index === 0 && s.orderBtnDisabled]}
                      onPress={() => moveMember(index, -1)}
                      disabled={index === 0}
                    >
                      <Text style={s.orderBtnText}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.orderBtn, index === draftOrder.length - 1 && s.orderBtnDisabled]}
                      onPress={() => moveMember(index, 1)}
                      disabled={index === draftOrder.length - 1}
                    >
                      <Text style={s.orderBtnText}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity
                style={[s.saveOrderBtn, { backgroundColor: accent }, savingOrder && s.fabDisabled]}
                onPress={handleSaveOrder}
                disabled={savingOrder}
              >
                {savingOrder
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.saveOrderBtnText}>Save Order</Text>}
              </TouchableOpacity>
            </GlassCard>
          </>
        )}

        {/* Creator settings */}
        {isCreator && (
          <>
            <Text style={s.sectionTitle}>Group Settings</Text>
            <GlassCard style={s.settingsCard}>
              <Text style={s.settingsLabel}>Color</Text>
              <View style={s.colorRow}>
                {GROUP_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[s.colorSwatch, { backgroundColor: c }, group.color === c && s.colorSwatchActive]}
                    onPress={() => handleColorChange(c)}
                  />
                ))}
              </View>
              <View style={s.settingsDivider} />
              <TouchableOpacity style={s.settingsRow} onPress={handleTokensToggle}>
                <View>
                  <Text style={s.settingsRowLabel}>Tokens</Text>
                  <Text style={s.settingsRowSub}>Nullify, Double Points, Bench Boost</Text>
                </View>
                <View style={[s.toggle, group.tokensEnabled && { backgroundColor: accent }]}>
                  <View style={[s.toggleThumb, group.tokensEnabled && s.toggleThumbOn]} />
                </View>
              </TouchableOpacity>
              {group.draftStatus === 'pending' && (
                <>
                  <View style={s.settingsDivider} />
                  <TouchableOpacity style={s.settingsRow} onPress={handleDraftOrderModeToggle}>
                    <View>
                      <Text style={s.settingsRowLabel}>Manual Draft Order</Text>
                      <Text style={s.settingsRowSub}>Set pick order yourself before drafting</Text>
                    </View>
                    <View style={[s.toggle, group.draftOrderMode === 'manual' && { backgroundColor: accent }]}>
                      <View style={[s.toggleThumb, group.draftOrderMode === 'manual' && s.toggleThumbOn]} />
                    </View>
                  </TouchableOpacity>
                  <View style={s.settingsDivider} />
                  <View style={s.settingsRow}>
                    <View>
                      <Text style={s.settingsRowLabel}>Schedule Draft</Text>
                      <Text style={s.settingsRowSub}>
                        {group.draftDate ? formatDraftDate(group.draftDate) : 'No date set'}
                      </Text>
                    </View>
                    <View style={s.scheduleBtns}>
                      {group.draftDate && (
                        <TouchableOpacity onPress={handleClearDraftDate} style={s.scheduleBtn}>
                          <Text style={s.scheduleBtnClear}>Clear</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => { setPickedDate(group.draftDate ? new Date(group.draftDate) : new Date()); setShowDatePicker(true); }}
                        style={[s.scheduleBtn, s.scheduleBtnSet, { backgroundColor: accent }]}
                      >
                        <Text style={s.scheduleBtnSetText}>Set</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </GlassCard>
          </>
        )}

        {/* Leave group (non-creator only) */}
        {!isCreator && (
          <TouchableOpacity
            style={[s.leaveBtn, leaving && s.leaveBtnDisabled]}
            onPress={handleLeave}
            disabled={leaving}
          >
            {leaving
              ? <ActivityIndicator color={T.error} />
              : <Text style={s.leaveBtnText}>Leave Group</Text>}
          </TouchableOpacity>
        )}

        {error && <Text style={s.errorInline}>{error}</Text>}

        {/* Bottom padding for absolute button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating action button */}
      {(draftLive || canStartDraft || canStartRound2) && (
        <View style={s.fabWrap} >
          {canStartRound2 && (
            <TouchableOpacity
              style={[s.fab, { backgroundColor: accent, shadowColor: accent }, starting && s.fabDisabled]}
              disabled={starting}
              onPress={() => {
                Alert.alert(
                  'Start Round of 16 Draft?',
                  'This will reset all squads and tokens. Pick order is reversed standings (leader picks last). This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Start Draft',
                      style: 'destructive',
                      onPress: async () => {
                        setStarting(true);
                        setError(null);
                        try {
                          await startSecondDraft(group.id);
                          router.push(`/draft/${group.id}`);
                        } catch (e: any) {
                          setError(e.message ?? 'Failed to start Round of 16 draft.');
                          setStarting(false);
                        }
                      },
                    },
                  ]
                );
              }}
            >
              {starting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.fabText}>Start Round of 16 Draft</Text>}
            </TouchableOpacity>
          )}
          {draftLive && (
            <TouchableOpacity
              style={[s.fab, { backgroundColor: accent, shadowColor: accent }]}
              onPress={() => router.push(`/draft/${group.id}`)}
            >
              <Text style={s.fabText}>Go to Draft Board</Text>
            </TouchableOpacity>
          )}
          {canStartDraft && (
            <TouchableOpacity
              style={[s.fab, { backgroundColor: accent, shadowColor: accent }, starting && s.fabDisabled]}
              disabled={starting}
              onPress={async () => {
                setStarting(true);
                setError(null);
                try {
                  await startDraft(group.id);
                  router.push(`/draft/${group.id}`);
                } catch (e: any) {
                  setError(e.message ?? 'Failed to start draft.');
                  setStarting(false);
                }
              }}
            >
              {starting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.fabText}>Start Draft</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Date picker */}
      {showDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="slide">
            <View style={s.pickerOverlay}>
              <View style={s.pickerSheet}>
                <DateTimePicker
                  value={pickedDate}
                  mode="date"
                  display="spinner"
                  minimumDate={new Date()}
                  onChange={(_, d) => d && setPickedDate(d)}
                  themeVariant="dark"
                />
                <View style={s.pickerActions}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={s.pickerBtn}>
                    <Text style={s.pickerBtnCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setShowDatePicker(false); setShowTimePicker(true); }}
                    style={[s.pickerBtn, { backgroundColor: accent }]}
                  >
                    <Text style={s.pickerBtnConfirm}>Next: Time →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={pickedDate}
            mode="date"
            minimumDate={new Date()}
            onChange={(_, d) => {
              setShowDatePicker(false);
              if (d) { setPickedDate(d); setShowTimePicker(true); }
            }}
          />
        )
      )}

      {/* Time picker */}
      {showTimePicker && (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="slide">
            <View style={s.pickerOverlay}>
              <View style={s.pickerSheet}>
                <DateTimePicker
                  value={pickedDate}
                  mode="time"
                  display="spinner"
                  onChange={(_, d) => d && setPickedDate(d)}
                  themeVariant="dark"
                />
                <View style={s.pickerActions}>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)} style={s.pickerBtn}>
                    <Text style={s.pickerBtnCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setShowTimePicker(false); handleScheduleDraft(pickedDate); }}
                    style={[s.pickerBtn, { backgroundColor: accent }]}
                  >
                    <Text style={s.pickerBtnConfirm}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={pickedDate}
            mode="time"
            onChange={(_, d) => {
              setShowTimePicker(false);
              if (d) handleScheduleDraft(d);
            }}
          />
        )
      )}
    </GradientScreen>
  );
}

function formatDraftDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Draft time reached';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `In ${days}d ${hours}h`;
  if (hours > 0) return `In ${hours}h ${mins}m`;
  return `In ${mins}m`;
}

const s = StyleSheet.create({
  scroll:    { padding: 16, paddingBottom: 40 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:   { color: T.error, fontSize: 15, fontFamily: 'Fredoka_500Medium' },
  errorInline: { color: T.error, textAlign: 'center', padding: 12, fontSize: 14, fontFamily: 'Fredoka_500Medium', marginTop: 8 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, marginBottom: 16,
  },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: 'Fredoka_700Bold' },
  statusMeta: { flex: 1, fontSize: 12, color: T.textSecondary, fontFamily: 'Fredoka_500Medium', textAlign: 'right' },

  leaderCard: {
    borderRadius: R.card, padding: 20,
    alignItems: 'center', gap: 4, marginBottom: 16,
  },
  leaderLabel:      { fontSize: 10, fontFamily: 'Fredoka_700Bold', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1 },
  leaderAvatar:     { width: 52, height: 52, borderRadius: 26, backgroundColor: T.accentDark, justifyContent: 'center', alignItems: 'center', marginVertical: 6 },
  leaderAvatarText: { fontSize: 22, fontFamily: 'Fredoka_700Bold', color: '#fff' },
  leaderName:       { fontSize: 20, fontFamily: 'Fredoka_700Bold', color: '#fff' },
  leaderPts:        { fontSize: 15, color: 'rgba(255,255,255,0.8)', fontFamily: 'Fredoka_600SemiBold' },

  codeCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24,
  },
  codeLeft:   {},
  codeLabel:  { fontSize: 10, color: T.textSecondary, fontFamily: 'Fredoka_500Medium', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  code:       { fontSize: 28, fontFamily: 'Fredoka_700Bold', letterSpacing: 6, color: T.text },
  codeBtns:   { flexDirection: 'row', gap: 8 },
  codeBtn:    {
    borderWidth: 1, borderColor: T.glassBorderStrong, borderRadius: R.chip,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  codeBtnText:  { fontSize: 13, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary },

  sectionTitle: {
    fontSize: 11, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, marginBottom: 8,
  },
  memberRowTop: { borderColor: '#f59e0b' },

  posBubble: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: T.surface2, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: T.glassBorder,
  },
  posBubbleTop:     { backgroundColor: '#f59e0b22', borderColor: '#f59e0b' },
  posBubbleText:    { fontSize: 13, fontFamily: 'Fredoka_700Bold', color: T.textSecondary },
  posBubbleTextTop: { color: '#f59e0b' },

  memberAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: T.surface2, justifyContent: 'center', alignItems: 'center',
  },
  memberAvatarText: { fontSize: 16, fontFamily: 'Fredoka_700Bold' },
  memberInfo:       { flex: 1 },
  memberName:       { fontSize: 15, color: T.text, fontFamily: 'Fredoka_600SemiBold' },
  memberDisplay:    { fontSize: 12, color: T.textSecondary, fontFamily: 'Fredoka_500Medium', marginTop: 1 },
  memberPts:        { fontSize: 17, fontFamily: 'Fredoka_700Bold', color: T.text },

  standingsLink: {
    alignItems: 'center', paddingVertical: 14,
    marginTop: 4, marginBottom: 8,
  },
  standingsLinkText: { fontSize: 14, color: T.accent, fontFamily: 'Fredoka_600SemiBold' },

  orderCard: {
    gap: 10, marginBottom: 16,
  },
  orderHint: { fontSize: 12, color: T.textSecondary, fontFamily: 'Fredoka_500Medium', marginBottom: 4 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderPos: {
    width: 36, height: 36, borderRadius: R.chip,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },
  orderPosText: { fontSize: 12, fontFamily: 'Fredoka_700Bold' },
  orderName: { flex: 1, fontSize: 15, color: T.text, fontFamily: 'Fredoka_500Medium' },
  orderBtns: { flexDirection: 'row', gap: 6 },
  orderBtn: {
    width: 32, height: 32, borderRadius: R.chip,
    backgroundColor: T.surface2, borderWidth: 1, borderColor: T.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  orderBtnDisabled: { opacity: 0.3 },
  orderBtnText: { fontSize: 11, color: T.text, fontFamily: 'Fredoka_700Bold' },
  saveOrderBtn: {
    borderRadius: R.button, paddingVertical: 12,
    alignItems: 'center', marginTop: 4,
  },
  saveOrderBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Fredoka_700Bold' },

  countdownCard: {
    marginBottom: 16, gap: 4,
  },
  countdownLabel: { fontSize: 10, fontFamily: 'Fredoka_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  countdownDate: { fontSize: 16, fontFamily: 'Fredoka_700Bold', color: T.text },
  countdownRemaining: { fontSize: 13, fontFamily: 'Fredoka_600SemiBold' },

  scheduleBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  scheduleBtn: { borderRadius: R.chip, paddingHorizontal: 12, paddingVertical: 6 },
  scheduleBtnClear: { fontSize: 13, color: T.textMuted, fontFamily: 'Fredoka_600SemiBold' },
  scheduleBtnSet: {},
  scheduleBtnSetText: { fontSize: 13, color: '#fff', fontFamily: 'Fredoka_700Bold' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: T.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  pickerActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  pickerBtn: { flex: 1, borderRadius: R.button, paddingVertical: 13, alignItems: 'center' },
  pickerBtnCancel: { color: T.textSecondary, fontFamily: 'Fredoka_600SemiBold', fontSize: 15 },
  pickerBtnConfirm: { color: '#fff', fontFamily: 'Fredoka_700Bold', fontSize: 15 },

  settingsCard: {
    gap: 12, marginBottom: 16,
  },
  settingsLabel: { fontSize: 11, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  colorRow: { flexDirection: 'row', gap: 12 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchActive: { borderWidth: 3, borderColor: '#fff' },
  settingsDivider: { height: 1, backgroundColor: T.glassBorder },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsRowLabel: { fontSize: 15, color: T.text, fontFamily: 'Fredoka_600SemiBold' },
  settingsRowSub: { fontSize: 12, color: T.textSecondary, fontFamily: 'Fredoka_500Medium', marginTop: 2 },
  toggle: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: T.glassBorder, justifyContent: 'center', padding: 3,
  },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },

  leaveBtn: {
    marginBottom: 16, borderRadius: R.button,
    borderWidth: 1, borderColor: T.error,
    paddingVertical: 15, alignItems: 'center',
  },
  leaveBtnDisabled: { opacity: 0.5 },
  leaveBtnText: { fontSize: 15, fontFamily: 'Fredoka_600SemiBold', color: T.error },

  fabWrap: { position: 'absolute', bottom: 24, left: 16, right: 16 },
  fab: {
    borderRadius: R.button,
    paddingVertical: 17, alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  fabDisabled: { opacity: 0.6 },
  fabText:     { color: '#fff', fontSize: 16, fontFamily: 'Fredoka_700Bold' },
});
