import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import {
  getAllFixtures,
  getAllWCMatches,
  seedMatchdayFixtures,
  getMyPredictions,
  savePrediction,
  resolvePredictions,
  autoResolvePastMatchdays,
  TOKEN_META,
  type MatchdayFixture,
  type WCMatch,
  type Prediction,
  type TokenType,
} from '@/services/prediction.service';
import { MATCHDAY_SCHEDULE, getNextMatchday } from '@/services/rating.service';
import { TokenCoin } from '@/components/token-coin';
import { Ionicons } from '@expo/vector-icons';
import { T, R } from '@/constants/theme';
import { GradientScreen } from '@/components/gradient-screen';
import { GlassCard } from '@/components/glass-card';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


function formatDeadline(isoString: string): string {
  const d = new Date(isoString);
  const diffMs = d.getTime() - Date.now();
  const pad = (n: number) => String(n).padStart(2, '0');
  const days  = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  if (diffMs < 0)  return `${dateStr} ${timeStr} — passed`;
  if (days > 0)    return `${dateStr} ${timeStr} · ${days}d ${hours}h left`;
  if (hours > 0)   return `${dateStr} ${timeStr} · ${hours}h left`;
  return `${dateStr} ${timeStr} · < 1h left`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function FixturesScreen() {
  const { user } = useAuth();
  const [fixtures,    setFixtures]    = useState<MatchdayFixture[]>([]);
  const [allMatches,  setAllMatches]  = useState<WCMatch[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [seeding,     setSeeding]     = useState(false);
  const [innerTab,    setInnerTab]    = useState<'predict' | 'calendar'>('predict');

  // Predict tab state
  const [selectedMd,  setSelectedMd]  = useState<number | null>(null);
  const [draftScores, setDraftScores] = useState<Record<string, { home: string; away: string }>>({});
  const [saving,      setSaving]      = useState<string | null>(null);

  const now = new Date();

  const load = useCallback(async () => {
    if (!user) return;
    try {
      let [fx, preds, clMatches] = await Promise.all([
        getAllFixtures(),
        getMyPredictions(user.uid),
        getAllWCMatches(),
      ]);

      // Auto-seed fixtures on first run
      if (fx.length === 0) {
        await seedMatchdayFixtures();
        fx = await getAllFixtures();
      }

      // Auto-resolve all past matchdays (idempotent)
      await autoResolvePastMatchdays();
      // Re-fetch predictions — some may now be marked correct/incorrect
      preds = await getMyPredictions(user.uid);

      setFixtures(fx);
      setPredictions(preds);
      setAllMatches(clMatches);

      // Pre-fill draft inputs from saved predictions
      const drafts: Record<string, { home: string; away: string }> = {};
      for (const p of preds) drafts[p.fixtureId] = { home: String(p.homeScore), away: String(p.awayScore) };
      setDraftScores(drafts);

      // Default selected matchday = next upcoming
      const next = getNextMatchday();
      if (next) setSelectedMd((prev) => prev ?? next.matchday);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleSeed() {
    setSeeding(true);
    try { await seedMatchdayFixtures(); await load(); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSeeding(false); }
  }

  async function handleSavePrediction(fixture: MatchdayFixture) {
    if (!user) return;
    const draft = draftScores[fixture.id];
    const home  = parseInt(draft?.home ?? '');
    const away  = parseInt(draft?.away ?? '');
    if (isNaN(home) || isNaN(away)) { Alert.alert('Invalid score', 'Enter a number for both scores.'); return; }
    setSaving(fixture.id);
    try { await savePrediction(user.uid, fixture.id, home, away); await load(); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(null); }
  }

  async function handleResolve(matchday: number) {
    try { await resolvePredictions(matchday); await load(); Alert.alert('Done', `MD${matchday} resolved — tokens awarded!`); }
    catch (e: any) { Alert.alert('Error', e.message); }
  }

  if (loading) return <GradientScreen><View style={s.center}><ActivityIndicator size="large" color={T.accent} /></View></GradientScreen>;

  if (fixtures.length === 0) {
    return (
      <GradientScreen>
        <View style={s.center}>
          <Text style={s.emptyTitle}>No fixtures yet</Text>
          <TouchableOpacity style={s.seedBtn} onPress={handleSeed} disabled={seeding}>
            {seeding ? <ActivityIndicator color="#fff" /> : <Text style={s.seedBtnText}>Seed Fixtures</Text>}
          </TouchableOpacity>
        </View>
      </GradientScreen>
    );
  }

  const predMap = new Map(predictions.map((p) => [p.fixtureId, p]));
  const byMatchday = new Map<number, MatchdayFixture[]>();
  for (const f of fixtures) {
    if (!byMatchday.has(f.matchday)) byMatchday.set(f.matchday, []);
    byMatchday.get(f.matchday)!.push(f);
  }

  const insets = useSafeAreaInsets();
  const upcomingMds = MATCHDAY_SCHEDULE.filter((md) => new Date(md.date) >= now);
  const pastMds     = MATCHDAY_SCHEDULE.filter((md) => new Date(md.date) < now).reverse();

  return (
    <GradientScreen>
      {/* Inner tab bar */}
      <View style={[s.tabBar, { marginTop: insets.top + 12 }]}>
        <TouchableOpacity style={[s.tabItem, innerTab === 'predict'  && s.tabActive]} onPress={() => setInnerTab('predict')}>
          <Text style={[s.tabText, innerTab === 'predict'  && s.tabTextActive]}>Predict</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabItem, innerTab === 'calendar' && s.tabActive]} onPress={() => setInnerTab('calendar')}>
          <Text style={[s.tabText, innerTab === 'calendar' && s.tabTextActive]}>Calendar</Text>
        </TouchableOpacity>
      </View>

      {innerTab === 'predict'
        ? <PredictTab
            upcomingMds={upcomingMds}
            pastMds={pastMds}
            byMatchday={byMatchday}
            predMap={predMap}
            selectedMd={selectedMd}
            draftScores={draftScores}
            saving={saving}
            onSelectMd={setSelectedMd}
            onChangeHome={(id, v) => setDraftScores((prev) => ({ ...prev, [id]: { ...prev[id], home: v } }))}
            onChangeAway={(id, v) => setDraftScores((prev) => ({ ...prev, [id]: { ...prev[id], away: v } }))}
            onSave={handleSavePrediction}
            onResolve={handleResolve}
          />
        : <CalendarTab upcomingMds={upcomingMds} pastMds={pastMds} allMatches={allMatches} onResolve={handleResolve} />
      }
    </GradientScreen>
  );
}

// ── Predict tab ───────────────────────────────────────────────────────────────

function PredictTab({
  upcomingMds, pastMds, byMatchday, predMap, selectedMd, draftScores, saving,
  onSelectMd, onChangeHome, onChangeAway, onSave, onResolve,
}: {
  upcomingMds: typeof MATCHDAY_SCHEDULE;
  pastMds: typeof MATCHDAY_SCHEDULE;
  byMatchday: Map<number, MatchdayFixture[]>;
  predMap: Map<string, Prediction>;
  selectedMd: number | null;
  draftScores: Record<string, { home: string; away: string }>;
  saving: string | null;
  onSelectMd: (md: number) => void;
  onChangeHome: (id: string, v: string) => void;
  onChangeAway: (id: string, v: string) => void;
  onSave: (f: MatchdayFixture) => void;
  onResolve: (md: number) => void;
}) {
  const [tokenGuideOpen, setTokenGuideOpen] = useState(false);
  const allMds = [...upcomingMds, ...pastMds.slice(0, 3)].sort((a, b) => b.matchday - a.matchday);
  const activeMdInfo = MATCHDAY_SCHEDULE.find((md) => md.matchday === selectedMd);
  const activeFixtures = selectedMd ? (byMatchday.get(selectedMd) ?? []) : [];
  const deadlinePassed = activeMdInfo ? new Date() >= new Date(activeMdInfo.deadline) : false;
  const isPast = activeMdInfo ? new Date(activeMdInfo.date) < new Date() : false;

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      {/* Token guide — collapsible */}
      <TouchableOpacity style={s.tokenGuideToggle} onPress={() => setTokenGuideOpen((v) => !v)} activeOpacity={0.7}>
        <Text style={s.tokenGuideToggleText}>How tokens work {tokenGuideOpen ? '▴' : '▾'}</Text>
      </TouchableOpacity>
      {tokenGuideOpen && (
        <GlassCard style={s.tokenGuide}>
          {(Object.keys(TOKEN_META) as TokenType[]).map((type) => {
            const meta = TOKEN_META[type];
            return (
              <View key={type} style={s.tokenGuideRow}>
                <TokenCoin type={type} size={52} />
                <View style={s.tokenGuideText}>
                  <Text style={[s.tokenGuideLabel, { color: meta.color }]}>{meta.label}</Text>
                  <Text style={s.tokenGuideDesc}>{meta.description}</Text>
                </View>
              </View>
            );
          })}
        </GlassCard>
      )}

      {/* Matchday selector */}
      <Text style={s.sectionLabel}>SELECT MATCHDAY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mdChipScroll} contentContainerStyle={s.mdChipRow}>
        {allMds.map((md) => {
          const isSelected = md.matchday === selectedMd;
          const isUpcoming = new Date(md.date) >= new Date();
          return (
            <TouchableOpacity
              key={md.matchday}
              style={[s.mdChip, isSelected && s.mdChipActive, !isUpcoming && s.mdChipPast]}
              onPress={() => onSelectMd(md.matchday)}
            >
              <Text style={[s.mdChipText, isSelected && s.mdChipTextActive]}>MD{md.matchday}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Selected matchday info */}
      {activeMdInfo && (
        <GlassCard style={[s.mdInfoCard, isPast && s.mdInfoCardPast]}>
          <Text style={s.mdInfoLabel}>{activeMdInfo.label}</Text>
          <Text style={s.mdInfoDate}>
            {new Date(activeMdInfo.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          {!isPast && (
            <View style={[s.deadlineRow, deadlinePassed && s.deadlineRowPassed]}>
              <Ionicons
                name={deadlinePassed ? 'lock-closed' : 'time-outline'}
                size={16}
                color={deadlinePassed ? T.error : T.accent}
              />
              <Text style={[s.deadlineText, deadlinePassed && s.deadlineTextPassed]}>
                {deadlinePassed ? 'Predictions closed' : `Predict before: ${formatDeadline(activeMdInfo.deadline)}`}
              </Text>
            </View>
          )}
        </GlassCard>
      )}

      {/* Fixtures + prediction inputs */}
      <Text style={s.sectionLabel}>MATCHES TO PREDICT</Text>
      {activeFixtures.length === 0 ? (
        <Text style={s.noData}>No fixtures for this matchday.</Text>
      ) : (
        activeFixtures.map((f) => {
          const meta  = TOKEN_META[f.tokenReward];
          const pred  = predMap.get(f.id);
          const draft = draftScores[f.id] ?? { home: '', away: '' };
          const canPredict = !deadlinePassed && !isPast && !f.isResolved;
          return (
            <GlassCard key={f.id} style={s.matchCard}>
              {/* Token reward header */}
              <View style={[s.matchTokenHeader, { backgroundColor: meta.color + '18', borderBottomColor: meta.color + '44' }]}>
                <TokenCoin type={f.tokenReward} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.matchTokenLabel, { color: meta.color }]}>
                    Correct prediction earns: <Text style={{ fontFamily: 'Fredoka_700Bold' }}>{meta.label}</Text>
                  </Text>
                </View>
              </View>

              {/* Teams + score */}
              <View style={s.matchBody}>
                <Text style={s.teamHome} numberOfLines={2}>{f.homeTeam}</Text>

                {canPredict ? (
                  <View style={s.scoreInputs}>
                    <TextInput
                      style={s.scoreInput}
                      value={draft.home}
                      onChangeText={(v) => onChangeHome(f.id, v)}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="0"
                      placeholderTextColor={T.textMuted}
                    />
                    <Text style={s.scoreSep}>–</Text>
                    <TextInput
                      style={s.scoreInput}
                      value={draft.away}
                      onChangeText={(v) => onChangeAway(f.id, v)}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="0"
                      placeholderTextColor={T.textMuted}
                    />
                  </View>
                ) : f.isResolved ? (
                  <View style={s.resultBlock}>
                    <Text style={s.resultScore}>{f.homeScoreActual} – {f.awayScoreActual}</Text>
                    <Text style={s.resultFinal}>FT</Text>
                  </View>
                ) : pred ? (
                  <View style={s.savedBlock}>
                    <Text style={s.savedScore}>{pred.homeScore} – {pred.awayScore}</Text>
                    <Text style={s.savedLabel}>saved</Text>
                  </View>
                ) : (
                  <Text style={s.noScore}>–</Text>
                )}

                <Text style={s.teamAway} numberOfLines={2}>{f.awayTeam}</Text>
              </View>

              {/* Prediction outcome (past) */}
              {pred && (
                <View style={s.predOutcome}>
                  {pred.isCorrect === true  && <Text style={s.predCorrect}>{meta.icon} Correct! {meta.label} token earned</Text>}
                  {pred.isCorrect === false && <Text style={s.predWrong}>Your prediction: {pred.homeScore}–{pred.awayScore} · Wrong</Text>}
                  {pred.isCorrect === null  && !canPredict && <Text style={s.predPending}>Your prediction: {pred.homeScore}–{pred.awayScore} · Pending</Text>}
                  {pred.isCorrect === null  && canPredict  && <Text style={s.predSaved}>Your prediction: {pred.homeScore}–{pred.awayScore}</Text>}
                </View>
              )}

              {/* Save / Resolve buttons */}
              {canPredict && (
                <TouchableOpacity
                  style={[s.predictBtn, { backgroundColor: meta.color }, saving === f.id && s.predictBtnDisabled]}
                  onPress={() => onSave(f)}
                  disabled={saving === f.id}
                >
                  {saving === f.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.predictBtnText}>{pred ? 'Update prediction' : 'Save prediction'}</Text>}
                </TouchableOpacity>
              )}
            </GlassCard>
          );
        })
      )}

      {/* Resolve button for past unresolved matchdays */}
      {isPast && activeMdInfo && activeFixtures.length > 0 && !activeFixtures.every((f) => f.isResolved) && (
        <TouchableOpacity style={s.resolveBtn} onPress={() => onResolve(activeMdInfo.matchday)}>
          <Text style={s.resolveBtnText}>Resolve MD{activeMdInfo.matchday} & Award Tokens</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ── Calendar tab ──────────────────────────────────────────────────────────────

function CalendarTab({
  upcomingMds, pastMds, allMatches, onResolve,
}: {
  upcomingMds: typeof MATCHDAY_SCHEDULE;
  pastMds: typeof MATCHDAY_SCHEDULE;
  allMatches: WCMatch[];
  onResolve: (md: number) => void;
}) {
  const [showPast, setShowPast] = useState(false);
  const displayed = showPast ? pastMds : upcomingMds;

  // Group all WC matches by matchday
  const byMatchday = new Map<number, WCMatch[]>();
  for (const m of allMatches) {
    if (!byMatchday.has(m.matchday)) byMatchday.set(m.matchday, []);
    byMatchday.get(m.matchday)!.push(m);
  }

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      {/* Toggle */}
      <View style={s.calToggle}>
        <TouchableOpacity style={[s.calToggleBtn, !showPast && s.calToggleBtnActive]} onPress={() => setShowPast(false)}>
          <Text style={[s.calToggleText, !showPast && s.calToggleTextActive]}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.calToggleBtn, showPast && s.calToggleBtnActive]} onPress={() => setShowPast(true)}>
          <Text style={[s.calToggleText, showPast && s.calToggleTextActive]}>Past</Text>
        </TouchableOpacity>
      </View>

      {displayed.length === 0 && (
        <Text style={s.noData}>{showPast ? 'No past matchdays.' : 'No upcoming matchdays.'}</Text>
      )}

      {displayed.map((md) => {
        const mdMatches = byMatchday.get(md.matchday) ?? [];
        const deadlinePassed = new Date() >= new Date(md.deadline);
        const isPast = new Date(md.date) < new Date();
        const hasResults = mdMatches.some((m) => m.homeScore !== null);
        return (
          <GlassCard key={md.matchday} style={s.calCard}>
            {/* Header */}
            <View style={s.calCardHeader}>
              <View style={[s.calMdBadge, isPast ? s.calMdBadgePast : s.calMdBadgeUpcoming]}>
                <Text style={[s.calMdBadgeText, isPast ? s.calMdBadgeTextPast : s.calMdBadgeTextUpcoming]}>MD{md.matchday}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.calCardLabel}>{md.label}</Text>
                <Text style={s.calCardDate}>
                  {new Date(md.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </View>
              {!isPast && (
                <View style={[s.calBadge, deadlinePassed ? s.calBadgeLocked : s.calBadgeOpen, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                  {deadlinePassed
                    ? <Ionicons name="lock-closed" size={11} color={T.error} />
                    : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.success }} />}
                  <Text style={s.calBadgeText}>{deadlinePassed ? 'Locked' : 'Open'}</Text>
                </View>
              )}
              {isPast && hasResults && (
                <TouchableOpacity style={s.smallResolveBtn} onPress={() => onResolve(md.matchday)}>
                  <Text style={s.smallResolveBtnText}>Resolve</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Deadline row */}
            {!isPast && (
              <View style={[s.calDeadlineRow, deadlinePassed && s.calDeadlineRowPassed]}>
                <Ionicons
                  name={deadlinePassed ? 'lock-closed' : 'time-outline'}
                  size={16}
                  color={deadlinePassed ? T.error : T.accent}
                />
                <View>
                  <Text style={s.calDeadlineLabel}>Lineup deadline</Text>
                  <Text style={[s.calDeadlineValue, deadlinePassed && s.calDeadlineValuePassed]}>
                    {formatDeadline(md.deadline)}
                  </Text>
                </View>
              </View>
            )}

            {/* All matches for this matchday */}
            {mdMatches.length === 0 ? (
              <Text style={[s.noData, { paddingHorizontal: 14, paddingVertical: 12 }]}>Fixtures TBA</Text>
            ) : (
              mdMatches.map((m) => {
                const isFinished = m.homeScore !== null && m.awayScore !== null;
                const d = new Date(m.matchDate);
                const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                const timeStr = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
                return (
                  <View key={m.id} style={s.calMatchRow}>
                    <Text style={s.calMatchDate}>{dateStr}</Text>
                    <Text style={s.calMatchTeams} numberOfLines={1}>
                      {m.homeTeam} vs {m.awayTeam}
                    </Text>
                    {isFinished ? (
                      <Text style={s.calMatchResult}>{m.homeScore}–{m.awayScore}</Text>
                    ) : (
                      <Text style={s.calMatchTime}>{timeStr}</Text>
                    )}
                  </View>
                );
              })
            )}
          </GlassCard>
        );
      })}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  emptyTitle: { fontSize: 16, color: T.text, fontFamily: 'Fredoka_500Medium' },
  seedBtn:    { backgroundColor: T.accent, borderRadius: R.button, paddingHorizontal: 24, paddingVertical: 12 },
  seedBtnText:{ color: '#fff', fontFamily: 'Fredoka_600SemiBold', fontSize: 15 },

  tabBar: {
    flexDirection: 'row', margin: 16, marginBottom: 0,
    backgroundColor: T.surface, borderRadius: R.chip, padding: 4,
    borderWidth: 1, borderColor: T.glassBorder,
  },
  tabItem:       { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: R.chip - 2 },
  tabActive:     { backgroundColor: T.accent },
  tabText:       { fontSize: 14, fontFamily: 'Fredoka_500Medium', color: T.textSecondary },
  tabTextActive: { color: '#fff', fontFamily: 'Fredoka_600SemiBold' },

  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  sectionLabel: { fontSize: 11, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4, marginBottom: 4 },
  noData: { fontSize: 13, color: T.textMuted, fontFamily: 'Fredoka_500Medium', fontStyle: 'italic', paddingVertical: 8 },

  // Token guide
  tokenGuideToggle: {
    marginHorizontal: 16, marginBottom: 10, paddingVertical: 6,
  },
  tokenGuideToggleText: {
    fontSize: 13, fontFamily: 'Fredoka_500Medium', color: T.textSecondary,
  },
  tokenGuide: { overflow: 'hidden', padding: 0 },
  tokenGuideRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14,
    borderBottomWidth: 1, borderBottomColor: T.glassBorder,
  },
  tokenGuideText: { flex: 1 },
  tokenGuideLabel: { fontSize: 14, fontFamily: 'Fredoka_700Bold' },
  tokenGuideDesc:  { fontSize: 12, color: T.textSecondary, fontFamily: 'Fredoka_500Medium', marginTop: 3, lineHeight: 17 },

  // Matchday selector chips
  mdChipScroll: { marginBottom: 4 },
  mdChipRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  mdChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.chip,
    borderWidth: 1, borderColor: T.glassBorder, backgroundColor: T.surface,
  },
  mdChipActive: { backgroundColor: T.accent, borderColor: T.accent },
  mdChipPast:   { opacity: 0.6 },
  mdChipText:     { fontSize: 13, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary },
  mdChipTextActive: { color: '#fff' },

  // Selected matchday info
  mdInfoCard: { gap: 4 },
  mdInfoCardPast: { opacity: 0.7 },
  mdInfoLabel: { fontSize: 14, fontFamily: 'Fredoka_700Bold', color: T.text },
  mdInfoDate:  { fontSize: 12, color: T.textSecondary, fontFamily: 'Fredoka_500Medium' },
  deadlineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    backgroundColor: 'rgba(61,133,247,0.08)', borderRadius: R.chip, padding: 8,
  },
  deadlineRowPassed: { backgroundColor: 'rgba(231,76,60,0.08)' },
  deadlineText:       { fontSize: 12, color: T.accent, fontFamily: 'Fredoka_500Medium', flex: 1 },
  deadlineTextPassed: { color: T.error },

  // Match card
  matchCard: { overflow: 'hidden', padding: 0 },
  matchTokenHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  matchTokenLabel: { fontSize: 12, fontFamily: 'Fredoka_500Medium' },
  matchBody: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 16, gap: 8,
  },
  teamHome: { flex: 1, fontSize: 14, fontFamily: 'Fredoka_700Bold', color: T.text, textAlign: 'right' },
  teamAway: { flex: 1, fontSize: 14, fontFamily: 'Fredoka_700Bold', color: T.text },
  scoreInputs: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  scoreInput: {
    width: 44, height: 44, borderWidth: 1, borderColor: T.glassBorderStrong,
    borderRadius: R.chip, textAlign: 'center', fontSize: 20, fontFamily: 'Fredoka_700Bold',
    color: T.text, backgroundColor: T.surface2,
  },
  scoreSep: { fontSize: 20, color: T.textMuted, fontFamily: 'Fredoka_700Bold' },
  resultBlock: { alignItems: 'center', paddingHorizontal: 10 },
  resultScore: { fontSize: 20, fontFamily: 'Fredoka_700Bold', color: T.text },
  resultFinal: { fontSize: 10, color: T.textMuted, marginTop: 2, fontFamily: 'Fredoka_500Medium' },
  savedBlock:  { alignItems: 'center', paddingHorizontal: 10 },
  savedScore:  { fontSize: 18, fontFamily: 'Fredoka_700Bold', color: T.accent },
  savedLabel:  { fontSize: 10, color: T.textMuted, marginTop: 2, fontFamily: 'Fredoka_500Medium' },
  noScore:     { fontSize: 18, color: T.textMuted, fontFamily: 'Fredoka_700Bold', paddingHorizontal: 16 },

  predOutcome: { paddingHorizontal: 14, paddingBottom: 10 },
  predCorrect: { fontSize: 12, fontFamily: 'Fredoka_700Bold', color: T.success },
  predWrong:   { fontSize: 12, color: T.error, fontFamily: 'Fredoka_500Medium' },
  predPending: { fontSize: 12, color: T.textMuted, fontFamily: 'Fredoka_500Medium' },
  predSaved:   { fontSize: 12, color: T.textSecondary, fontFamily: 'Fredoka_500Medium' },

  predictBtn: { margin: 12, marginTop: 4, borderRadius: R.button, paddingVertical: 12, alignItems: 'center' },
  predictBtnDisabled: { opacity: 0.5 },
  predictBtnText: { color: '#fff', fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },

  resolveBtn: {
    backgroundColor: T.surface, borderRadius: R.button, borderWidth: 1, borderColor: 'rgba(45,212,191,0.4)',
    paddingVertical: 14, alignItems: 'center',
  },
  resolveBtnText: { color: T.accent, fontFamily: 'Fredoka_600SemiBold', fontSize: 14 },

  // Calendar tab
  calToggle: {
    flexDirection: 'row', backgroundColor: T.surface, borderRadius: R.chip, padding: 4,
    borderWidth: 1, borderColor: T.glassBorder,
  },
  calToggleBtn:       { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: R.chip - 2 },
  calToggleBtnActive: { backgroundColor: T.accent },
  calToggleText:       { fontSize: 14, fontFamily: 'Fredoka_500Medium', color: T.textSecondary },
  calToggleTextActive: { color: '#fff', fontFamily: 'Fredoka_600SemiBold' },

  calCard: { overflow: 'hidden', padding: 0 },
  calCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderBottomWidth: 1, borderBottomColor: T.glassBorder,
  },
  calMdBadge:             { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  calMdBadgeUpcoming:     { backgroundColor: T.accent },
  calMdBadgePast:         { backgroundColor: T.surface2 },
  calMdBadgeText:         { fontSize: 13, fontFamily: 'Fredoka_700Bold' },
  calMdBadgeTextUpcoming: { color: '#fff' },
  calMdBadgeTextPast:     { color: T.textSecondary },
  calCardLabel: { fontSize: 14, fontFamily: 'Fredoka_700Bold', color: T.text },
  calCardDate:  { fontSize: 12, color: T.textSecondary, marginTop: 2, fontFamily: 'Fredoka_500Medium' },
  calBadge:     { borderRadius: R.chip, paddingHorizontal: 10, paddingVertical: 4 },
  calBadgeOpen:   { backgroundColor: 'rgba(34,197,94,0.15)' },
  calBadgeLocked: { backgroundColor: 'rgba(231,76,60,0.15)' },
  calBadgeText:   { fontSize: 11, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary },
  smallResolveBtn: {
    backgroundColor: T.surface2, borderRadius: R.chip, borderWidth: 1, borderColor: T.glassBorderStrong,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  smallResolveBtnText: { fontSize: 12, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary },

  calDeadlineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(61,133,247,0.06)',
    borderBottomWidth: 1, borderBottomColor: T.glassBorder,
  },
  calDeadlineRowPassed: { backgroundColor: 'rgba(231,76,60,0.06)' },
  calDeadlineLabel: { fontSize: 11, fontFamily: 'Fredoka_600SemiBold', color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  calDeadlineValue:       { fontSize: 13, color: T.accent, fontFamily: 'Fredoka_500Medium', marginTop: 1 },
  calDeadlineValuePassed: { color: T.error },

  calMatchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 9,
    borderTopWidth: 1, borderTopColor: T.glassBorder,
  },
  calMatchDate:   { fontSize: 11, color: T.textMuted, width: 46, flexShrink: 0, fontFamily: 'Fredoka_500Medium' },
  calMatchTeams:  { flex: 1, fontSize: 13, color: T.text, fontFamily: 'Fredoka_500Medium' },
  calMatchResult: { fontSize: 13, fontFamily: 'Fredoka_700Bold', color: T.success },
  calMatchTime:   { fontSize: 12, color: T.textMuted, minWidth: 40, textAlign: 'right', fontFamily: 'Fredoka_500Medium' },
});
