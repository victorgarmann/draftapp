// Prediction & Token service — match predictions, token earn/use, effects

import { supabase } from '@/lib/supabase';
import { CLUBS } from '@/constants/clubs';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TokenType = 'nullify' | 'double_points' | 'bench_boost';

export const TOKEN_META: Record<TokenType, { icon: string; label: string; color: string; description: string }> = {
  nullify: {
    icon: '✕',
    label: 'Nullify',
    color: '#e74c3c',
    description: "Target any opponent's starting player — they score 0 pts this matchday.",
  },
  double_points: {
    icon: '×2',
    label: 'Double Points',
    color: '#f39c12',
    description: "Pick one of your own players — their points are doubled this matchday.",
  },
  bench_boost: {
    icon: '▲',
    label: 'Bench Boost',
    color: '#27ae60',
    description: 'All four of your bench players also earn points this matchday.',
  },
};

export interface MatchdayFixture {
  id: string;
  matchday: number;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  tokenReward: TokenType;
  homeScoreActual: number | null;
  awayScoreActual: number | null;
  isResolved: boolean;
}

export interface Prediction {
  id: string;
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  isCorrect: boolean | null;
}

export interface Token {
  id: string;
  tokenType: TokenType;
  earnedMatchday: number;
  usedMatchday: number | null;
  targetPlayerId: string | null;
}

// ── Mock fixture seed data ────────────────────────────────────────────────────
// 3 fixtures per matchday, each rewarding a different token type on correct prediction.
// Past matchdays include actual scores for resolution.

const MOCK_FIXTURES: {
  matchday: number;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  tokenReward: TokenType;
  homeScoreActual?: number;
  awayScoreActual?: number;
}[] = [
  // ── MD1 (Group Stage — Round 1, Jun 11–16 2026) ──────────────────────────
  { matchday: 1, homeTeam: 'United States', awayTeam: 'Bolivia',   matchDate: '2026-06-12T21:00:00Z', tokenReward: 'nullify' },
  { matchday: 1, homeTeam: 'Germany',       awayTeam: 'Australia', matchDate: '2026-06-13T18:00:00Z', tokenReward: 'double_points' },
  { matchday: 1, homeTeam: 'Brazil',        awayTeam: 'Nigeria',   matchDate: '2026-06-15T21:00:00Z', tokenReward: 'bench_boost' },
  // ── MD2 (Group Stage — Round 2, Jun 17–22 2026) ──────────────────────────
  { matchday: 2, homeTeam: 'France',    awayTeam: 'Uruguay',   matchDate: '2026-06-17T21:00:00Z', tokenReward: 'nullify' },
  { matchday: 2, homeTeam: 'Spain',     awayTeam: 'Morocco',   matchDate: '2026-06-19T18:00:00Z', tokenReward: 'double_points' },
  { matchday: 2, homeTeam: 'England',   awayTeam: 'Colombia',  matchDate: '2026-06-20T21:00:00Z', tokenReward: 'bench_boost' },
  // ── MD3 (Group Stage — Round 3, Jun 23–26 2026) ──────────────────────────
  { matchday: 3, homeTeam: 'Argentina', awayTeam: 'Ecuador',   matchDate: '2026-06-25T21:00:00Z', tokenReward: 'nullify' },
  { matchday: 3, homeTeam: 'Portugal',  awayTeam: 'Belgium',   matchDate: '2026-06-25T21:00:00Z', tokenReward: 'double_points' },
  { matchday: 3, homeTeam: 'Netherlands', awayTeam: 'Poland',  matchDate: '2026-06-26T18:00:00Z', tokenReward: 'bench_boost' },
  // ── MD4 (Round of 32, Jul 2026) ──────────────────────────────────────────
  { matchday: 4, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-01T18:00:00Z', tokenReward: 'nullify' },
  { matchday: 4, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-01T21:00:00Z', tokenReward: 'double_points' },
  { matchday: 4, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-02T18:00:00Z', tokenReward: 'bench_boost' },
  // ── MD5 (Round of 16, Jul 2026) ──────────────────────────────────────────
  { matchday: 5, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-08T18:00:00Z', tokenReward: 'nullify' },
  { matchday: 5, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-08T21:00:00Z', tokenReward: 'double_points' },
  { matchday: 5, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-09T18:00:00Z', tokenReward: 'bench_boost' },
  // ── MD6 (Quarter-finals, Jul 2026) ───────────────────────────────────────
  { matchday: 6, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-14T18:00:00Z', tokenReward: 'nullify' },
  { matchday: 6, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-14T21:00:00Z', tokenReward: 'double_points' },
  { matchday: 6, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-15T18:00:00Z', tokenReward: 'bench_boost' },
  // ── MD7 (Semi-finals, Jul 2026) ──────────────────────────────────────────
  { matchday: 7, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-18T21:00:00Z', tokenReward: 'nullify' },
  { matchday: 7, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-19T21:00:00Z', tokenReward: 'double_points' },
  { matchday: 7, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-19T21:00:00Z', tokenReward: 'bench_boost' },
  // ── MD8 (Final, Jul 2026) ────────────────────────────────────────────────
  { matchday: 8, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-26T21:00:00Z', tokenReward: 'nullify' },
  { matchday: 8, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-26T21:00:00Z', tokenReward: 'double_points' },
  { matchday: 8, homeTeam: 'TBD', awayTeam: 'TBD', matchDate: '2026-07-26T21:00:00Z', tokenReward: 'bench_boost' },
];

// ── Seed ─────────────────────────────────────────────────────────────────────

export async function seedMatchdayFixtures(): Promise<void> {
  // Delete all existing mock fixtures first so stale records are replaced
  await supabase
    .from('matchday_fixtures')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  const rows = MOCK_FIXTURES.map((f) => ({
    matchday: f.matchday,
    home_team: f.homeTeam,
    away_team: f.awayTeam,
    match_date: f.matchDate,
    token_reward: f.tokenReward,
    home_score_actual: f.homeScoreActual ?? null,
    away_score_actual: f.awayScoreActual ?? null,
  }));

  const { error } = await supabase.from('matchday_fixtures').insert(rows);
  if (error) throw error;
}

// ── WC match seed data ────────────────────────────────────────────────────────

export async function seedWCMatches(): Promise<void> {
  // 12 groups × 4 teams — team names must match CLUBS registry (players.team_name)
  const GROUPS: Array<{ name: string; teams: [string, string, string, string] }> = [
    { name: 'A', teams: ['United States', 'Germany',     'Senegal',      'Ecuador']    },
    { name: 'B', teams: ['Mexico',        'France',      'Morocco',      'Japan']      },
    { name: 'C', teams: ['Canada',        'England',     'Ivory Coast',  'South Korea'] },
    { name: 'D', teams: ['Brazil',        'Portugal',    'Algeria',      'Australia']  },
    { name: 'E', teams: ['Argentina',     'Spain',       'Egypt',        'Saudi Arabia'] },
    { name: 'F', teams: ['Colombia',      'Netherlands', 'Nigeria',      'Iran']       },
    { name: 'G', teams: ['Uruguay',       'Belgium',     'South Africa', 'Qatar']      },
    { name: 'H', teams: ['Paraguay',      'Croatia',     'Cape Verde',   'Uzbekistan'] },
    { name: 'I', teams: ['Switzerland',   'Panama',      'Tunisia',      'New Zealand'] },
    { name: 'J', teams: ['Austria',       'Haiti',       'Jordan',       'TBD']        },
    { name: 'K', teams: ['Norway',        'Curaçao',     'TBD',          'TBD']        },
    { name: 'L', teams: ['Scotland',      'TBD',         'TBD',          'TBD']        },
  ];

  // 2 groups share each day across the 6-day round window
  const R1: Record<string, string> = { A:'2026-06-11',B:'2026-06-11',C:'2026-06-12',D:'2026-06-12',E:'2026-06-13',F:'2026-06-13',G:'2026-06-14',H:'2026-06-14',I:'2026-06-15',J:'2026-06-15',K:'2026-06-16',L:'2026-06-16' };
  const R2: Record<string, string> = { A:'2026-06-17',B:'2026-06-17',C:'2026-06-18',D:'2026-06-18',E:'2026-06-19',F:'2026-06-19',G:'2026-06-20',H:'2026-06-20',I:'2026-06-21',J:'2026-06-21',K:'2026-06-22',L:'2026-06-22' };
  // Round 3 — matches within same group are simultaneous
  const R3: Record<string, string> = { A:'2026-06-23',B:'2026-06-23',C:'2026-06-23',D:'2026-06-24',E:'2026-06-24',F:'2026-06-24',G:'2026-06-25',H:'2026-06-25',I:'2026-06-25',J:'2026-06-26',K:'2026-06-26',L:'2026-06-26' };

  const rows: any[] = [];

  for (const { name: g, teams: [t1, t2, t3, t4] } of GROUPS) {
    // Round 1: t1 vs t2, t3 vs t4
    rows.push({ matchday: 1, stage: `Group ${g}`, home_team: t1, away_team: t2, match_date: `${R1[g]}T18:00:00Z`, status: 'SCHEDULED' });
    rows.push({ matchday: 1, stage: `Group ${g}`, home_team: t3, away_team: t4, match_date: `${R1[g]}T21:00:00Z`, status: 'SCHEDULED' });
    // Round 2: t1 vs t3, t2 vs t4
    rows.push({ matchday: 2, stage: `Group ${g}`, home_team: t1, away_team: t3, match_date: `${R2[g]}T18:00:00Z`, status: 'SCHEDULED' });
    rows.push({ matchday: 2, stage: `Group ${g}`, home_team: t2, away_team: t4, match_date: `${R2[g]}T21:00:00Z`, status: 'SCHEDULED' });
    // Round 3: t1 vs t4, t2 vs t3 (simultaneous — same kickoff time)
    rows.push({ matchday: 3, stage: `Group ${g}`, home_team: t1, away_team: t4, match_date: `${R3[g]}T21:00:00Z`, status: 'SCHEDULED' });
    rows.push({ matchday: 3, stage: `Group ${g}`, home_team: t2, away_team: t3, match_date: `${R3[g]}T21:00:00Z`, status: 'SCHEDULED' });
  }

  // Knockout rounds (opponents TBD until group stage resolves)
  const KNOCKOUTS: Array<{ matchday: number; stage: string; dates: string[] }> = [
    { matchday: 4, stage: 'Round of 32',  dates: ['2026-07-01','2026-07-01','2026-07-02','2026-07-02','2026-07-03','2026-07-03','2026-07-04','2026-07-04','2026-07-01','2026-07-01','2026-07-02','2026-07-02','2026-07-03','2026-07-03','2026-07-04','2026-07-04'] },
    { matchday: 5, stage: 'Round of 16',  dates: ['2026-07-07','2026-07-07','2026-07-08','2026-07-08','2026-07-09','2026-07-09','2026-07-09','2026-07-09'] },
    { matchday: 6, stage: 'Quarter-final',dates: ['2026-07-14','2026-07-14','2026-07-15','2026-07-15'] },
    { matchday: 7, stage: 'Semi-final',   dates: ['2026-07-18','2026-07-19'] },
    { matchday: 8, stage: 'Final',        dates: ['2026-07-26'] },
  ];

  for (const { matchday, stage, dates } of KNOCKOUTS) {
    dates.forEach((date, i) => {
      rows.push({ matchday, stage, home_team: 'TBD', away_team: 'TBD', match_date: `${date}T${i % 2 === 0 ? '18' : '21'}:00:00Z`, status: 'SCHEDULED' });
    });
  }

  await supabase.from('wc_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await supabase.from('wc_matches').insert(rows);
  if (error) throw error;
}

// ── All WC matches (calendar) ─────────────────────────────────────────────────

export interface WCMatch {
  id: string;
  matchday: number;
  stage: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string | null;
}

/**
 * Returns the set of FotMob team names that still have upcoming matches.
 * Uses the CLUBS registry to translate football-data.org names (stored in
 * wc_matches) to FotMob names (stored in players.team_name).
 * Falls back to an empty set (= no filtering) on any error.
 */
export async function getActiveWCTeams(): Promise<Set<string>> {
  const { data: matches, error } = await supabase
    .from('wc_matches')
    .select('home_team, away_team')
    .gt('match_date', new Date().toISOString());
  if (error || !matches?.length) return new Set();

  // Build fd-name → fotmob-name lookup from CLUBS registry
  const fdToFotmob = new Map<string, string>();
  for (const club of CLUBS) {
    fdToFotmob.set(club.name, club.fotmobName ?? club.name);
  }

  const result = new Set<string>();
  for (const row of matches) {
    const home = fdToFotmob.get(row.home_team);
    const away = fdToFotmob.get(row.away_team);
    if (home) result.add(home);
    if (away) result.add(away);
  }
  return result;
}

export async function getAllWCMatches(): Promise<WCMatch[]> {
  const { data, error } = await supabase
    .from('wc_matches')
    .select('*')
    .order('matchday')
    .order('match_date');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    matchday: r.matchday,
    stage: r.stage,
    homeTeam: r.home_team,
    awayTeam: r.away_team,
    matchDate: r.match_date,
    homeScore: r.home_score,
    awayScore: r.away_score,
    status: r.status,
  }));
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getAllFixtures(): Promise<MatchdayFixture[]> {
  const { data, error } = await supabase
    .from('matchday_fixtures')
    .select('*')
    .order('matchday')
    .order('match_date');
  if (error) throw error;

  return data.map(mapFixture);
}

export async function getFixturesForMatchday(matchday: number): Promise<MatchdayFixture[]> {
  const { data, error } = await supabase
    .from('matchday_fixtures')
    .select('*')
    .eq('matchday', matchday)
    .order('match_date');
  if (error) throw error;

  return data.map(mapFixture);
}

function mapFixture(row: any): MatchdayFixture {
  return {
    id: row.id,
    matchday: row.matchday,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    matchDate: row.match_date,
    tokenReward: row.token_reward as TokenType,
    homeScoreActual: row.home_score_actual,
    awayScoreActual: row.away_score_actual,
    isResolved: row.home_score_actual !== null && row.away_score_actual !== null,
  };
}

// ── Predictions ───────────────────────────────────────────────────────────────

export async function savePrediction(
  userId: string,
  fixtureId: string,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  const { error } = await supabase
    .from('predictions')
    .upsert({ user_id: userId, fixture_id: fixtureId, home_score: homeScore, away_score: awayScore },
      { onConflict: 'user_id,fixture_id' });
  if (error) throw error;
}

export async function getMyPredictions(userId: string): Promise<Prediction[]> {
  const { data, error } = await supabase
    .from('predictions')
    .select('id, fixture_id, home_score, away_score, is_correct')
    .eq('user_id', userId);
  if (error) throw error;

  return data.map((r: any) => ({
    id: r.id,
    fixtureId: r.fixture_id,
    homeScore: r.home_score,
    awayScore: r.away_score,
    isCorrect: r.is_correct,
  }));
}

// ── Resolve predictions & award tokens ───────────────────────────────────────
// Called after a matchday's actual scores are known.
// For the prototype the actual scores are seeded in MOCK_FIXTURES.

export async function resolvePredictions(matchday: number): Promise<void> {
  // Fetch fixtures for this matchday
  const { data: fixtures, error: fErr } = await supabase
    .from('matchday_fixtures')
    .select('id, home_score_actual, away_score_actual, token_reward')
    .eq('matchday', matchday);
  if (fErr) throw fErr;

  const resolved = fixtures.filter(
    (f: any) => f.home_score_actual !== null && f.away_score_actual !== null,
  );
  if (!resolved.length) throw new Error('No actual scores set for this matchday yet.');

  // Fetch all predictions for these fixtures
  const fixtureIds = resolved.map((f: any) => f.id);
  const { data: preds, error: pErr } = await supabase
    .from('predictions')
    .select('id, user_id, fixture_id, home_score, away_score')
    .in('fixture_id', fixtureIds)
    .is('is_correct', null); // only unresolved
  if (pErr) throw pErr;

  // Mark correct/incorrect
  const correctByUser: Record<string, TokenType[]> = {};
  for (const pred of preds as any[]) {
    const fixture = resolved.find((f: any) => f.id === pred.fixture_id);
    if (!fixture) continue;
    const correct =
      pred.home_score === fixture.home_score_actual &&
      pred.away_score === fixture.away_score_actual;

    await supabase
      .from('predictions')
      .update({ is_correct: correct })
      .eq('id', pred.id);

    if (correct) {
      if (!correctByUser[pred.user_id]) correctByUser[pred.user_id] = [];
      correctByUser[pred.user_id].push(fixture.token_reward as TokenType);
    }
  }

  // Award tokens: one token per correct prediction, per group the user belongs to
  for (const [userId, tokenTypes] of Object.entries(correctByUser)) {
    const { data: memberGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    for (const { group_id } of (memberGroups ?? []) as any[]) {
      for (const tokenType of tokenTypes) {
        await supabase.from('tokens').insert({
          user_id: userId,
          group_id,
          token_type: tokenType,
          earned_matchday: matchday,
        });
      }
    }
  }
}

// ── Tokens ────────────────────────────────────────────────────────────────────

export async function getMyTokens(userId: string, groupId: string): Promise<Token[]> {
  const { data, error } = await supabase
    .from('tokens')
    .select('id, token_type, earned_matchday, used_matchday, target_player_id')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .order('earned_matchday');
  if (error) throw error;

  return data.map((r: any) => ({
    id: r.id,
    tokenType: r.token_type as TokenType,
    earnedMatchday: r.earned_matchday,
    usedMatchday: r.used_matchday,
    targetPlayerId: r.target_player_id,
  }));
}

export async function useToken(params: {
  tokenId: string;
  usedMatchday: number;
  targetPlayerId?: string;
}): Promise<void> {
  const { tokenId, usedMatchday, targetPlayerId } = params;

  // Ensure it hasn't been used yet
  const { data: token, error: fetchErr } = await supabase
    .from('tokens')
    .select('used_matchday')
    .eq('id', tokenId)
    .single();
  if (fetchErr) throw fetchErr;
  if (token.used_matchday !== null) throw new Error('This token has already been used.');

  const { error } = await supabase
    .from('tokens')
    .update({ used_matchday: usedMatchday, target_player_id: targetPlayerId ?? null })
    .eq('id', tokenId);
  if (error) throw error;
}

// Award one of each token type as a starting bonus (idempotent — skips if already awarded)
export async function seedStartingTokens(userId: string, groupId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('tokens')
    .select('id')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .limit(1);

  if (existing && existing.length > 0) return; // already has tokens

  const { error } = await supabase.from('tokens').insert(
    (['nullify', 'double_points', 'bench_boost'] as TokenType[]).map((token_type) => ({
      user_id: userId,
      group_id: groupId,
      token_type,
      earned_matchday: 0, // 0 = starting bonus
    })),
  );
  if (error) throw error;
}

// ── Auto-resolve all past matchdays (idempotent) ──────────────────────────────
// Resolves any unresolved predictions for past matchdays that have actual scores.
// Safe to call on every app load — already-resolved predictions are skipped.

export async function autoResolvePastMatchdays(): Promise<void> {
  const { data: fixtures } = await supabase
    .from('matchday_fixtures')
    .select('matchday')
    .not('home_score_actual', 'is', null)
    .not('away_score_actual', 'is', null);

  if (!fixtures?.length) return;

  const matchdays = [...new Set((fixtures as any[]).map((f) => f.matchday as number))];

  for (const matchday of matchdays) {
    try { await resolvePredictions(matchday); } catch { /* no predictions or already resolved */ }
  }
}

// Get all players in a group's squads (for token targeting)
export interface GroupSquadPlayer {
  playerId: string;
  playerName: string;
  playerTeam: string;
  playerPosition: string;
  ownerUserId: string;
  ownerUsername: string;
  isStarting: boolean;
}

export async function getGroupSquadPlayers(
  groupId: string,
  excludeUserId: string,
): Promise<GroupSquadPlayer[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      user_id,
      profiles ( username ),
      squads ( player_id, is_starting, players ( name, team_name, position ) )
    `)
    .eq('group_id', groupId)
    .neq('user_id', excludeUserId);
  if (error) throw error;

  const result: GroupSquadPlayer[] = [];
  for (const member of data as any[]) {
    for (const sq of member.squads ?? []) {
      result.push({
        playerId: sq.player_id,
        playerName: sq.players?.name ?? '',
        playerTeam: sq.players?.team_name ?? '',
        playerPosition: sq.players?.position ?? '',
        ownerUserId: member.user_id,
        ownerUsername: member.profiles?.username ?? 'Unknown',
        isStarting: sq.is_starting,
      });
    }
  }
  return result;
}
