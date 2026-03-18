#!/usr/bin/env node
// Seed realistic mock match ratings for all CL players.
// Ratings are centered on each player's real FotMob season average so
// stars (Mbappé ~8.7) consistently outscore squad players (~6.5).
//
// Run from project root: node scripts/seed-mock-ratings.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env ─────────────────────────────────────────────────────────────────

const envLines = readFileSync(resolve(__dirname, '..', '.env'), 'utf8').split('\n');
for (const line of envLines) {
  const [key, ...rest] = line.split('=');
  if (key?.trim() && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Matchday schedule (must match rating.service.ts) ─────────────────────────

const MATCHDAY_SCHEDULE = [
  { matchday: 1,  date: '2025-09-17' },
  { matchday: 2,  date: '2025-10-01' },
  { matchday: 3,  date: '2025-10-22' },
  { matchday: 4,  date: '2025-11-05' },
  { matchday: 5,  date: '2025-11-26' },
  { matchday: 6,  date: '2025-12-10' },
  { matchday: 7,  date: '2026-01-21' },
  { matchday: 8,  date: '2026-01-29' },
  { matchday: 9,  date: '2026-03-04' },
  { matchday: 10, date: '2026-03-11' },
  { matchday: 11, date: '2026-04-08' },
  { matchday: 12, date: '2026-04-15' },
  { matchday: 13, date: '2026-04-29' },
  { matchday: 14, date: '2026-05-06' },
  { matchday: 15, date: '2026-05-30' },
];

const PAST_MATCHDAYS = MATCHDAY_SCHEDULE.filter(md => new Date(md.date) < new Date());

// ── Deterministic hash ────────────────────────────────────────────────────────

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return (Math.abs(h) % 1000000) / 1000000;
}

// ── Rating generator ──────────────────────────────────────────────────────────

function mockRatingForPlayer(playerId, matchday, fotmobAvg, totalMatchdays) {
  const r1 = hash(`${playerId}-${matchday}-play`);

  const matchesPlayed = fotmobAvg?.matchesPlayed ?? Math.round(totalMatchdays * 0.45);
  const playRate = Math.min(0.97, Math.max(0.05, matchesPlayed / totalMatchdays));

  if (r1 > playRate) return { fotmob_rating: null, did_not_play: true };

  // Triangular noise: (h1 - h2) ∈ [-1, 1], peaks at 0
  const h1 = hash(`${playerId}-${matchday}-noise-a`);
  const h2 = hash(`${playerId}-${matchday}-noise-b`);
  const noise = h1 - h2;

  const avg = fotmobAvg?.avgRating ?? 6.75;
  const scale = avg >= 7.5 ? 0.85 : avg >= 6.8 ? 0.70 : 0.55;
  const rating = Math.max(4.5, Math.min(10.0, avg + noise * scale));

  return { fotmob_rating: Math.round(rating * 10) / 10, did_not_play: false };
}

// ── Fetch FotMob season averages ──────────────────────────────────────────────

async function fetchFotmobStats() {
  console.log('Fetching FotMob season averages...');
  try {
    const res = await fetch('https://data.fotmob.com/stats/42/season/28184/rating.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const map = new Map();
    for (const entry of (data?.TopLists?.[0]?.StatList ?? [])) {
      if (!entry.ParticiantId) continue;
      map.set(String(entry.ParticiantId), {
        avgRating: entry.StatValue,
        matchesPlayed: entry.MatchesPlayed,
      });
    }
    console.log(`✓ Got real averages for ${map.size} players\n`);
    return map;
  } catch (e) {
    console.warn(`FotMob fetch failed (${e.message}) — using fallback distribution\n`);
    return new Map();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('ChampDraft — mock ratings seeder\n');

  if (PAST_MATCHDAYS.length === 0) {
    console.log('No past matchdays yet — nothing to seed.');
    process.exit(0);
  }

  console.log(`Seeding matchdays: ${PAST_MATCHDAYS.map(m => `MD${m.matchday}`).join(', ')}\n`);

  const fotmobStats = await fetchFotmobStats();

  // Fetch all players with their FotMob IDs (paginate — Supabase caps at 1000/request)
  const players = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error: pErr } = await supabase
      .from('players')
      .select('id, fotmob_id, name')
      .eq('is_available', true)
      .range(from, from + PAGE - 1);
    if (pErr) { console.error('Failed to fetch players:', pErr.message); process.exit(1); }
    players.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`Building ratings for ${players.length} players × ${PAST_MATCHDAYS.length} matchdays...`);

  const totalMatchdays = PAST_MATCHDAYS.length;
  const rows = [];

  for (const player of players) {
    const avg = player.fotmob_id ? fotmobStats.get(String(player.fotmob_id)) : undefined;
    for (const { matchday, date } of PAST_MATCHDAYS) {
      const { fotmob_rating, did_not_play } = mockRatingForPlayer(
        player.id, matchday, avg, totalMatchdays,
      );
      rows.push({
        player_id: player.id,
        matchday,
        match_date: date,
        fotmob_rating,
        did_not_play,
        is_mock: true,
      });
    }
  }

  const played = rows.filter(r => r.fotmob_rating !== null).length;
  const dnp    = rows.length - played;
  const avgRating = played > 0
    ? (rows.reduce((s, r) => s + (r.fotmob_rating ?? 0), 0) / played).toFixed(2)
    : '—';
  console.log(`  ${rows.length} rows total — ${played} played, ${dnp} DNP, avg rating ${avgRating}\n`);

  console.log('Upserting into Supabase...');
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase
      .from('match_ratings')
      .upsert(rows.slice(i, i + 200), { onConflict: 'player_id,matchday' });
    if (error) { console.error('Upsert failed:', error.message); process.exit(1); }
    process.stdout.write(`  ${Math.min(i + 200, rows.length)}/${rows.length}\r`);
  }

  console.log(`\n✓ Done! ${rows.length} mock ratings seeded.`);
  console.log('  Run this script again after each matchday to add new ratings.');
})();
