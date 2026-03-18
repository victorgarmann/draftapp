// Real CL data seeding — replaces mock players + fixtures with live API data
// Uses football-data.org free API (10 req/min limit)

import { supabase } from '@/lib/supabase';
import {
  fetchAllCLSquads,
  fetchCLMatches,
  mapFDPosition,
  type FDMatch,
} from './football-data.service';
import type { TokenType } from './prediction.service';

// ── CL stage → app matchday number mapping ───────────────────────────────────
// football-data.org "stage" field values for CL

const STAGE_TO_MATCHDAY: Record<string, number[]> = {
  // League phase MD1-8
  'LEAGUE_PHASE':         [], // handled separately via matchday field
  // Knockout
  'LAST_16':              [9, 10],   // R16 leg 1 & 2
  'QUARTER_FINALS':       [11, 12],
  'SEMI_FINALS':          [13, 14],
  'FINAL':                [15],
};

// Token rewards cycle per matchday fixture slot (3 per matchday)
const TOKEN_CYCLE: TokenType[] = ['nullify', 'double_points', 'bench_boost'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pick the most "interesting" matches from a set — prefer big clubs. */
const BIG_CLUBS = new Set([
  'Real Madrid CF', 'FC Barcelona', 'Manchester City FC', 'Arsenal FC',
  'Liverpool FC', 'Chelsea FC', 'Bayern München', 'Borussia Dortmund',
  'Bayer 04 Leverkusen', 'FC Internazionale Milano', 'AC Milan',
  'Juventus FC', 'Club Atlético de Madrid', 'Paris Saint-Germain FC',
  'PSG',
]);

function pickTop3(matches: FDMatch[]): FDMatch[] {
  const scored = matches.map((m) => ({
    m,
    score:
      (BIG_CLUBS.has(m.homeTeam.name) ? 1 : 0) +
      (BIG_CLUBS.has(m.awayTeam.name) ? 1 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((x) => x.m);
}

// ── Player seeding ────────────────────────────────────────────────────────────

export async function seedRealPlayers(
  apiKey: string,
  onProgress: (msg: string) => void,
): Promise<{ count: number }> {
  const teams = await fetchAllCLSquads(apiKey, onProgress);

  const rows: Array<{
    fotmob_id: string;
    name: string;
    team_name: string;
    position: string;
    is_available: boolean;
    is_mock: boolean;
  }> = [];

  for (const team of teams) {
    for (const player of team.squad ?? []) {
      if (!player.position) continue;
      const position = mapFDPosition(player.position);
      rows.push({
        fotmob_id: `fd_${player.id}`,
        name: player.name,
        team_name: team.name,
        position,
        is_available: true,
        is_mock: false,
      });
    }
  }

  onProgress(`Inserting ${rows.length} players into database…`);

  // Clear old mock players, upsert real ones
  await supabase.from('players').delete().eq('is_mock', true);

  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase
      .from('players')
      .upsert(chunk, { onConflict: 'fotmob_id' });
    if (error) throw error;
  }

  onProgress(`✓ ${rows.length} players seeded.`);
  return { count: rows.length };
}

// ── Fixture seeding ───────────────────────────────────────────────────────────

export async function seedRealFixtures(
  apiKey: string,
  onProgress: (msg: string) => void,
): Promise<{ count: number }> {
  onProgress('Fetching CL match schedule…');
  const matches = await fetchCLMatches(apiKey);
  onProgress(`Found ${matches.length} matches. Processing…`);

  // Group league-phase matches by matchday field
  const leagueByMd: Record<number, FDMatch[]> = {};
  // Group knockout matches by stage
  const knockoutByStage: Record<string, FDMatch[]> = {};

  for (const m of matches) {
    if (m.stage === 'LEAGUE_STAGE' && m.matchday !== null) {
      if (!leagueByMd[m.matchday]) leagueByMd[m.matchday] = [];
      leagueByMd[m.matchday].push(m);
    } else if (m.stage in STAGE_TO_MATCHDAY) {
      if (!knockoutByStage[m.stage]) knockoutByStage[m.stage] = [];
      knockoutByStage[m.stage].push(m);
    }
  }

  const fixtureRows: Array<{
    matchday: number;
    home_team: string;
    away_team: string;
    match_date: string;
    token_reward: TokenType;
    home_score_actual: number | null;
    away_score_actual: number | null;
  }> = [];

  // League phase: pick 3 per matchday (MDs 1-8)
  for (const [md, mdMatches] of Object.entries(leagueByMd)) {
    const top3 = pickTop3(mdMatches);
    top3.forEach((m, i) => {
      fixtureRows.push({
        matchday: Number(md),
        home_team: m.homeTeam.name,
        away_team: m.awayTeam.name,
        match_date: m.utcDate,
        token_reward: TOKEN_CYCLE[i],
        home_score_actual: m.score?.fullTime?.home ?? null,
        away_score_actual: m.score?.fullTime?.away ?? null,
      });
    });
  }

  // Knockout: assign matchday numbers, pick 3 per leg
  for (const [stage, stageMatches] of Object.entries(knockoutByStage)) {
    const mdNums = STAGE_TO_MATCHDAY[stage];
    if (!mdNums?.length) continue;

    // Split legs by date (earlier half = leg 1, later = leg 2)
    const sorted = [...stageMatches].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
    );
    const half = Math.ceil(sorted.length / 2);
    const legs = [sorted.slice(0, half), sorted.slice(half)];

    legs.forEach((leg, legIdx) => {
      const mdNum = mdNums[legIdx];
      if (mdNum === undefined || leg.length === 0) return;
      pickTop3(leg).forEach((m, i) => {
        fixtureRows.push({
          matchday: mdNum,
          home_team: m.homeTeam.name,
          away_team: m.awayTeam.name,
          match_date: m.utcDate,
          token_reward: TOKEN_CYCLE[i],
          home_score_actual: m.score?.fullTime?.home ?? null,
          away_score_actual: m.score?.fullTime?.away ?? null,
        });
      });
    });
  }

  // Wipe old fixtures and insert new
  await supabase.from('matchday_fixtures').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await supabase.from('matchday_fixtures').insert(fixtureRows);
  if (error) throw error;

  onProgress(`✓ ${fixtureRows.length} prediction fixtures seeded.`);
  return { count: fixtureRows.length };
}

// ── Combined entry point ──────────────────────────────────────────────────────

export async function seedAllRealData(
  apiKey: string,
  onProgress: (msg: string) => void,
): Promise<void> {
  onProgress('Starting real CL data seed…');

  const [playerResult, fixtureResult] = await Promise.allSettled([
    // Fixtures first (fast)
    seedRealFixtures(apiKey, onProgress),
    // Players second (slow — needs rate-limited API calls)
    seedRealPlayers(apiKey, onProgress),
  ]);

  if (fixtureResult.status === 'rejected') {
    throw new Error(`Fixture seeding failed: ${fixtureResult.reason}`);
  }
  if (playerResult.status === 'rejected') {
    throw new Error(`Player seeding failed: ${playerResult.reason}`);
  }

  onProgress('🎉 All real CL data seeded successfully!');
}

/** True if the DB already contains real (non-mock) player data. */
export async function isRealDataSeeded(): Promise<boolean> {
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('is_mock', false);
  return (count ?? 0) > 0;
}
