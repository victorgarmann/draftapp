#!/usr/bin/env node
// Seed real WC 2026 players + fixtures into Supabase.
// Run from the project root: node scripts/seed-cl-data.mjs
// Reads credentials from .env automatically.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env manually (no dotenv dependency needed) ─────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
const envLines = readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const SUPABASE_URL    = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY    = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const FD_API_KEY      = process.env.EXPO_PUBLIC_FOOTBALL_DATA_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env vars'); process.exit(1); }
if (!FD_API_KEY)                    { console.error('Missing EXPO_PUBLIC_FOOTBALL_DATA_KEY in .env'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── football-data.org helpers ────────────────────────────────────────────────

const BASE             = 'https://api.football-data.org/v4';
const WC_COMPETITION   = 2000;  // FIFA World Cup
const WC_SEASON        = 2026;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fdGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-Auth-Token': FD_API_KEY } });
  if (res.status === 429) throw new Error('Rate limit hit — wait a minute and retry.');
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${path}`);
  return res.json();
}

// ── Position mapper ───────────────────────────────────────────────────────────

function mapPosition(fdPos) {
  switch (fdPos) {
    case 'Goalkeeper':                    return 'GK';
    case 'Centre-Back':                   return 'CB';
    case 'Left-Back': case 'Left Wing Back':  return 'LB';
    case 'Right-Back': case 'Right Wing Back': return 'RB';
    case 'Defensive Midfield':
    case 'Central Midfield':
    case 'Attacking Midfield':            return 'CM';
    case 'Left Midfield': case 'Left Winger':  return 'W';
    case 'Right Midfield': case 'Right Winger': return 'W';
    case 'Second Striker': case 'Centre-Forward': return 'ST';
    case 'Defence':                       return 'CB';
    case 'Midfield':                      return 'CM';
    case 'Offence':                       return 'ST';
    default:                              return 'CM';
  }
}

// ── Stage → matchday mapping ──────────────────────────────────────────────────

const STAGE_TO_MDS = {
  GROUP_STAGE:    [1, 2, 3],
  LAST_32:        [4],
  LAST_16:        [5],
  QUARTER_FINALS: [6],
  SEMI_FINALS:    [7],
  FINAL:          [8],
};

const TOKEN_CYCLE = ['nullify', 'double_points', 'bench_boost'];

const BIG_NATIONS = new Set([
  'Brazil', 'France', 'Germany', 'Argentina', 'Spain', 'England',
  'Portugal', 'Netherlands', 'Italy', 'Croatia', 'Morocco', 'USA',
]);

function pickTop3(matches) {
  return matches
    .map(m => ({
      m,
      score: (BIG_NATIONS.has(m.homeTeam.name) ? 1 : 0) + (BIG_NATIONS.has(m.awayTeam.name) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.m);
}

// ── Seed fixtures ─────────────────────────────────────────────────────────────

async function seedFixtures() {
  console.log('Fetching WC 2026 match schedule…');
  const { matches } = await fdGet(`/competitions/${WC_COMPETITION}/matches?season=${WC_SEASON}`);
  console.log(`Found ${matches.length} matches.`);

  const groupByRound = {};
  const knockoutByStage = {};

  for (const m of matches) {
    if (m.stage === 'GROUP_STAGE' && m.matchday !== null) {
      if (!groupByRound[m.matchday]) groupByRound[m.matchday] = [];
      groupByRound[m.matchday].push(m);
    } else if (STAGE_TO_MDS[m.stage]) {
      if (!knockoutByStage[m.stage]) knockoutByStage[m.stage] = [];
      knockoutByStage[m.stage].push(m);
    }
  }

  // ── All matches (for calendar) ──────────────────────────────────────────────

  const allMatchRows = [];

  function toMatchRow(m, matchday, stage) {
    const home = m.homeTeam?.name;
    const away = m.awayTeam?.name;
    if (!home || !away) return null;
    return {
      matchday,
      stage,
      home_team: home,
      away_team: away,
      match_date: m.utcDate,
      home_score: m.score?.fullTime?.home ?? null,
      away_score: m.score?.fullTime?.away ?? null,
      status: m.status ?? null,
    };
  }

  const STAGE_LABELS = {
    GROUP_STAGE: 'Group Stage', LAST_32: 'Round of 32', LAST_16: 'Round of 16',
    QUARTER_FINALS: 'Quarter-finals', SEMI_FINALS: 'Semi-finals', FINAL: 'Final',
  };

  for (const [round, roundMatches] of Object.entries(groupByRound)) {
    const mdNum = [1, 2, 3][Number(round) - 1] ?? Number(round);
    for (const m of roundMatches) {
      const row = toMatchRow(m, mdNum, 'Group Stage');
      if (row) allMatchRows.push(row);
    }
  }

  for (const [stage, stageMatches] of Object.entries(knockoutByStage)) {
    const mdNums = STAGE_TO_MDS[stage];
    const sorted = [...stageMatches].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    // For single-matchday stages (LAST_32, LAST_16, QF, SF, FINAL) all go to mdNums[0]
    if (mdNums.length === 1) {
      for (const m of sorted) {
        const row = toMatchRow(m, mdNums[0], STAGE_LABELS[stage] ?? stage);
        if (row) allMatchRows.push(row);
      }
    } else {
      const half = Math.ceil(sorted.length / 2);
      [sorted.slice(0, half), sorted.slice(half)].forEach((leg, legIdx) => {
        const mdNum = mdNums[legIdx];
        if (!mdNum) return;
        for (const m of leg) {
          const row = toMatchRow(m, mdNum, STAGE_LABELS[stage] ?? stage);
          if (row) allMatchRows.push(row);
        }
      });
    }
  }

  console.log(`Saving ${allMatchRows.length} matches to wc_matches…`);
  await supabase.from('wc_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  for (let i = 0; i < allMatchRows.length; i += 100) {
    const { error } = await supabase.from('wc_matches').insert(allMatchRows.slice(i, i + 100));
    if (error) throw error;
  }
  console.log(`✓ ${allMatchRows.length} matches in wc_matches.`);

  // ── Prediction fixtures (top 3 per matchday) ────────────────────────────────

  const predRows = [];

  function toPredRow(m, matchday, tokenIdx) {
    const home = m.homeTeam?.name;
    const away = m.awayTeam?.name;
    if (!home || !away) return null;
    return {
      matchday,
      home_team: home,
      away_team: away,
      match_date: m.utcDate,
      token_reward: TOKEN_CYCLE[tokenIdx],
      home_score_actual: m.score?.fullTime?.home ?? null,
      away_score_actual: m.score?.fullTime?.away ?? null,
    };
  }

  for (const [round, roundMatches] of Object.entries(groupByRound)) {
    const mdNum = [1, 2, 3][Number(round) - 1] ?? Number(round);
    pickTop3(roundMatches).forEach((m, i) => {
      const row = toPredRow(m, mdNum, i);
      if (row) predRows.push(row);
    });
  }

  for (const [stage, stageMatches] of Object.entries(knockoutByStage)) {
    const mdNums = STAGE_TO_MDS[stage];
    const sorted = [...stageMatches].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    if (mdNums.length === 1) {
      pickTop3(sorted).forEach((m, i) => {
        const row = toPredRow(m, mdNums[0], i);
        if (row) predRows.push(row);
      });
    } else {
      const half = Math.ceil(sorted.length / 2);
      [sorted.slice(0, half), sorted.slice(half)].forEach((leg, legIdx) => {
        const mdNum = mdNums[legIdx];
        if (!mdNum || leg.length === 0) return;
        pickTop3(leg).forEach((m, i) => {
          const row = toPredRow(m, mdNum, i);
          if (row) predRows.push(row);
        });
      });
    }
  }

  console.log(`Wiping old prediction fixtures and inserting ${predRows.length} new ones…`);
  await supabase.from('matchday_fixtures').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await supabase.from('matchday_fixtures').insert(predRows);
  if (error) throw error;
  console.log(`✓ ${predRows.length} prediction fixtures seeded.`);
}

// ── Seed players ──────────────────────────────────────────────────────────────

async function seedPlayers() {
  console.log('Fetching WC 2026 team list…');
  const { teams } = await fdGet(`/competitions/${WC_COMPETITION}/teams?season=${WC_SEASON}`);
  console.log(`Found ${teams.length} teams. Fetching squads (6.5 s between requests)…`);

  const playerRows = [];

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    process.stdout.write(`  [${i + 1}/${teams.length}] ${team.name} … `);
    try {
      const full = await fdGet(`/teams/${team.id}`);
      for (const p of full.squad ?? []) {
        playerRows.push({
          fotmob_id: `fd_${p.id}`,
          name: p.name,
          team_name: team.name,
          team_fotmob_id: String(team.id ?? ''),
          position: mapPosition(p.position ?? ''),
          is_available: true,
        });
      }
      console.log(`${full.squad?.length ?? 0} players`);
    } catch (e) {
      console.log(`SKIPPED (${e.message})`);
    }
    if (i < teams.length - 1) await sleep(6500);
  }

  console.log(`\nSeeding ${playerRows.length} real players…`);
  // Clear existing players then insert real ones
  await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  for (let i = 0; i < playerRows.length; i += 200) {
    const { error } = await supabase
      .from('players')
      .upsert(playerRows.slice(i, i + 200), { onConflict: 'fotmob_id' });
    if (error) throw error;
  }
  console.log(`✓ ${playerRows.length} players seeded.`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const mode = process.argv[2]; // 'fixtures', 'players', or undefined (both)

(async () => {
  try {
    if (!mode || mode === 'fixtures') await seedFixtures();
    if (!mode || mode === 'players')  await seedPlayers();
    console.log('\nDone!');
  } catch (e) {
    console.error('\nFailed:', e.message);
    process.exit(1);
  }
})();
