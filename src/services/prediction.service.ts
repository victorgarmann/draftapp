// Prediction & Token service — match predictions, token earn/use, effects

import { supabase } from '@/lib/supabase';
import { CLUBS } from '@/constants/clubs';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TokenType = 'nullify' | 'double_points' | 'bench_boost';

export const TOKEN_META: Record<TokenType, { icon: string; label: string; color: string; description: string }> = {
  nullify: {
    icon: '🚫',
    label: 'Nullify',
    color: '#e74c3c',
    description: "Target any opponent's starting player — they score 0 pts this matchday.",
  },
  double_points: {
    icon: '⚡',
    label: 'Double Points',
    color: '#f39c12',
    description: "Pick one of your own players — their points are doubled this matchday.",
  },
  bench_boost: {
    icon: '💪',
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
  // ── MD1 (Group Stage — Round 1, Jun 2026) ────────────────────────────────
  { matchday: 1, homeTeam: 'United States', awayTeam: 'Brazil',  matchDate: '2026-06-11T18:00:00Z', tokenReward: 'nullify' },
  { matchday: 1, homeTeam: 'France',    awayTeam: 'Argentina',  matchDate: '2026-06-12T21:00:00Z', tokenReward: 'double_points' },
  { matchday: 1, homeTeam: 'Spain',     awayTeam: 'Germany',    matchDate: '2026-06-13T21:00:00Z', tokenReward: 'bench_boost' },
  // ── MD2 (Group Stage — Round 2, Jun 2026) ────────────────────────────────
  { matchday: 2, homeTeam: 'England',   awayTeam: 'Morocco',    matchDate: '2026-06-17T18:00:00Z', tokenReward: 'nullify' },
  { matchday: 2, homeTeam: 'Portugal',  awayTeam: 'Japan',      matchDate: '2026-06-18T21:00:00Z', tokenReward: 'double_points' },
  { matchday: 2, homeTeam: 'Mexico',    awayTeam: 'Colombia',   matchDate: '2026-06-19T21:00:00Z', tokenReward: 'bench_boost' },
  // ── MD3 (Group Stage — Round 3, Jun 2026) ────────────────────────────────
  { matchday: 3, homeTeam: 'Brazil',    awayTeam: 'France',     matchDate: '2026-06-23T21:00:00Z', tokenReward: 'nullify' },
  { matchday: 3, homeTeam: 'Argentina', awayTeam: 'Germany',    matchDate: '2026-06-23T21:00:00Z', tokenReward: 'double_points' },
  { matchday: 3, homeTeam: 'Canada',    awayTeam: 'Spain',      matchDate: '2026-06-24T18:00:00Z', tokenReward: 'bench_boost' },
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
