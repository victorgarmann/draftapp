// Rating service — mock match ratings, score calculation, matchday schedule

import { supabase } from '@/lib/supabase';

// ── Matchday schedule ─────────────────────────────────────────────────────────

export interface MatchdayInfo {
  matchday: number;
  label: string;
  date: string;      // YYYY-MM-DD (first match day)
  deadline: string;  // ISO 8601 — lineup must be saved before this
}

export const MATCHDAY_SCHEDULE: MatchdayInfo[] = [
  // ── Group Stage ──────────────────────────────────────────────
  { matchday: 1, label: 'Group Stage — Round 1', date: '2026-06-11', deadline: '2026-06-10T12:00:00Z' },
  { matchday: 2, label: 'Group Stage — Round 2', date: '2026-06-17', deadline: '2026-06-16T12:00:00Z' },
  { matchday: 3, label: 'Group Stage — Round 3', date: '2026-06-23', deadline: '2026-06-22T12:00:00Z' },
  // ── Knockout rounds ─────────────────────────────────────────
  { matchday: 4, label: 'Round of 32',           date: '2026-07-01', deadline: '2026-06-30T12:00:00Z' },
  { matchday: 5, label: 'Round of 16',           date: '2026-07-08', deadline: '2026-07-07T12:00:00Z' },
  { matchday: 6, label: 'Quarter-finals',        date: '2026-07-14', deadline: '2026-07-13T12:00:00Z' },
  { matchday: 7, label: 'Semi-finals',           date: '2026-07-18', deadline: '2026-07-17T12:00:00Z' },
  { matchday: 8, label: 'Final',                 date: '2026-07-26', deadline: '2026-07-25T12:00:00Z' },
];

/** The next matchday whose date hasn't passed yet, or null if the season is over. */
export function getNextMatchday(): MatchdayInfo | null {
  const now = new Date();
  return MATCHDAY_SCHEDULE.find((md) => new Date(md.date) >= now) ?? null;
}

/** True if the lineup deadline for the next matchday has already passed. */
export function isLineupLocked(): boolean {
  const next = getNextMatchday();
  if (!next) return false;
  return new Date() >= new Date(next.deadline);
}

// ── FotMob season stats (used to anchor mock ratings) ────────────────────────
// WC 2026 FotMob competition/season IDs TBD — update once tournament begins.

const FOTMOB_STATS_URL = '';

interface FotmobPlayerAvg {
  avgRating: number;    // real season average FotMob rating
  matchesPlayed: number;
}

let _fotmobStatsCache: Map<string, FotmobPlayerAvg> | null = null;

async function fetchFotmobSeasonStats(): Promise<Map<string, FotmobPlayerAvg>> {
  if (_fotmobStatsCache) return _fotmobStatsCache;
  if (!FOTMOB_STATS_URL) { _fotmobStatsCache = new Map(); return _fotmobStatsCache; }
  try {
    const res = await fetch(FOTMOB_STATS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const map = new Map<string, FotmobPlayerAvg>();
    for (const entry of (data?.TopLists?.[0]?.StatList ?? [])) {
      if (!entry.ParticiantId) continue;
      map.set(String(entry.ParticiantId), {
        avgRating: entry.StatValue,
        matchesPlayed: entry.MatchesPlayed,
      });
    }
    _fotmobStatsCache = map;
    return map;
  } catch {
    // Fall back to pure hash-based approach if FotMob data is unavailable
    _fotmobStatsCache = new Map();
    return _fotmobStatsCache;
  }
}

// ── Deterministic pseudo-random ───────────────────────────────────────────────

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return (Math.abs(h) % 1000000) / 1000000;
}

/**
 * Generate a mock rating for one player on one matchday.
 *
 * When fotmobAvg is provided (real FotMob season data), the rating is
 * centered on the player's actual average — Mbappé will score ~8.7,
 * a squad player ~6.5, etc.  Without it the function falls back to the
 * original league-average distribution.
 *
 * Uses a triangular noise distribution (two hashes subtracted) so ratings
 * cluster around the mean rather than spreading uniformly.
 */
function mockRatingForPlayer(
  playerId: string,
  matchday: number,
  fotmobAvg?: FotmobPlayerAvg,
  totalMatchdays = 8,
): { fotmob_rating: number | null; did_not_play: boolean } {
  const r1 = hash(`${playerId}-${matchday}-play`);

  // Play rate: derived from real matchesPlayed / total matchdays for this phase.
  // Clamped so even stars can occasionally sit out and fringe players can appear.
  const matchesPlayed = fotmobAvg?.matchesPlayed ?? Math.round(totalMatchdays * 0.45);
  const playRate = Math.min(0.97, Math.max(0.05, matchesPlayed / totalMatchdays));

  if (r1 > playRate) return { fotmob_rating: null, did_not_play: true };

  // Triangular noise: (h1 - h2) ∈ [-1, 1], peaks at 0 — realistic match-to-match variance
  const h1 = hash(`${playerId}-${matchday}-noise-a`);
  const h2 = hash(`${playerId}-${matchday}-noise-b`);
  const noise = h1 - h2;

  const avg = fotmobAvg?.avgRating ?? 6.75;
  // Better players carry more variance (can have exceptional or poor games)
  const scale = avg >= 7.5 ? 0.85 : avg >= 6.8 ? 0.70 : 0.55;
  const rating = Math.max(4.5, Math.min(10.0, avg + noise * scale));

  return { fotmob_rating: Math.round(rating * 10) / 10, did_not_play: false };
}

// ── Seed mock ratings (past matchdays only) ───────────────────────────────────

const PAST_MATCHDAYS = MATCHDAY_SCHEDULE.filter((md) => new Date(md.date) < new Date());

export async function seedMockRatings(): Promise<void> {
  // Fetch all players with fotmob_id (paginate — Supabase caps at 1000/request)
  const players: any[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id, fotmob_id')
      .eq('is_available', true)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    players.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const fotmobStats = await fetchFotmobSeasonStats();
  const totalMatchdays = PAST_MATCHDAYS.length;

  const rows: any[] = [];
  for (const player of players as any[]) {
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

  for (let i = 0; i < rows.length; i += 200) {
    const { error: upsertError } = await supabase
      .from('match_ratings')
      .upsert(rows.slice(i, i + 200), { onConflict: 'player_id,matchday' });
    if (upsertError) throw upsertError;
  }
}

// ── Calculate group scores (applies token effects) ────────────────────────────

export async function calculateGroupScores(groupId: string): Promise<void> {
  const { data: groupRow } = await supabase
    .from('groups')
    .select('tokens_enabled')
    .eq('id', groupId)
    .single();
  const tokensEnabled = groupRow?.tokens_enabled ?? true;

  const { data: members, error: mErr } = await supabase
    .from('group_members')
    .select('id, user_id')
    .eq('group_id', groupId);
  if (mErr) throw mErr;

  // All nullify tokens used in this group (anyone targeting anyone's player)
  const nullifyTokens = tokensEnabled ? (await supabase
    .from('tokens')
    .select('target_player_id, used_matchday')
    .eq('group_id', groupId)
    .eq('token_type', 'nullify')
    .not('used_matchday', 'is', null)).data : [];

  for (const member of members) {
    const { data: squadRows, error: sErr } = await supabase
      .from('squads')
      .select('player_id, is_starting')
      .eq('group_member_id', member.id);
    if (sErr) throw sErr;
    if (!squadRows.length) continue;

    const currentStartingIds = new Set<string>(
      squadRows.filter((r: any) => r.is_starting).map((r: any) => r.player_id),
    );
    const allPlayerIds = squadRows.map((r: any) => r.player_id);

    // Lineup snapshots: per-matchday starting XI (overrides current is_starting for past matchdays)
    const { data: snapshots } = await supabase
      .from('lineup_snapshots')
      .select('matchday, starting_player_ids')
      .eq('group_member_id', member.id);
    const snapMap = new Map<number, Set<string>>();
    for (const snap of (snapshots ?? [])) {
      snapMap.set(snap.matchday, new Set(snap.starting_player_ids));
    }

    // Tokens this user has played in this group
    const myTokens = tokensEnabled ? (await supabase
      .from('tokens')
      .select('token_type, used_matchday, target_player_id')
      .eq('group_id', groupId)
      .eq('user_id', member.user_id)
      .not('used_matchday', 'is', null)).data : [];

    const { data: ratings, error: rErr } = await supabase
      .from('match_ratings')
      .select('player_id, matchday, points')
      .in('player_id', allPlayerIds);
    if (rErr) throw rErr;

    // Group by matchday
    const byMatchday = new Map<number, { player_id: string; points: number }[]>();
    for (const r of ratings as any[]) {
      if (!byMatchday.has(r.matchday)) byMatchday.set(r.matchday, []);
      byMatchday.get(r.matchday)!.push({ player_id: r.player_id, points: r.points ?? 0 });
    }

    let total = 0;
    for (const [matchday, mdRatings] of byMatchday) {
      // Use per-matchday snapshot if available, otherwise fall back to current lineup
      const startingIds = snapMap.get(matchday) ?? currentStartingIds;
      const hasBenchBoost = (myTokens ?? []).some(
        (t: any) => t.token_type === 'bench_boost' && t.used_matchday === matchday,
      );

      for (const { player_id, points: rawPts } of mdRatings) {
        if (!startingIds.has(player_id) && !hasBenchBoost) continue;

        let pts = rawPts;

        // Nullify: an opponent targeted this player this matchday
        const nullified = (nullifyTokens ?? []).some(
          (t: any) => t.target_player_id === player_id && t.used_matchday === matchday,
        );
        if (nullified) { pts = 0; }
        else {
          // Double points: this member doubled this player
          const doubled = (myTokens ?? []).some(
            (t: any) =>
              t.token_type === 'double_points' &&
              t.target_player_id === player_id &&
              t.used_matchday === matchday,
          );
          if (doubled) pts *= 2;
        }

        total += pts;
      }
    }

    await supabase
      .from('group_members')
      .update({ total_points: total })
      .eq('id', member.id);
  }
}

// ── Per-matchday breakdown for standings ──────────────────────────────────────

export interface MemberMatchdayBreakdown {
  userId: string;
  username: string;
  totalPoints: number;
  byMatchday: Record<number, number>; // matchday → pts (starting XI only, no token effects)
}

export async function getGroupMatchdayBreakdown(
  groupId: string,
): Promise<MemberMatchdayBreakdown[]> {
  const { data: members, error: mErr } = await supabase
    .from('group_members')
    .select('id, user_id, total_points, profiles(username)')
    .eq('group_id', groupId);
  if (mErr) throw mErr;
  if (!members?.length) return [];

  const memberIds = members.map((m: any) => m.id);

  // Fetch all squad players (starting + bench — needed for bench boost)
  const { data: squads, error: sErr } = await supabase
    .from('squads')
    .select('group_member_id, player_id, is_starting')
    .in('group_member_id', memberIds);
  if (sErr) throw sErr;

  const memberSquads: Record<string, { starting: Set<string>; all: string[] }> = {};
  for (const s of squads as any[]) {
    if (!memberSquads[s.group_member_id]) {
      memberSquads[s.group_member_id] = { starting: new Set(), all: [] };
    }
    memberSquads[s.group_member_id].all.push(s.player_id);
    if (s.is_starting) memberSquads[s.group_member_id].starting.add(s.player_id);
  }

  // Fetch per-matchday lineup snapshots for all members
  const { data: allSnapshots } = await supabase
    .from('lineup_snapshots')
    .select('group_member_id, matchday, starting_player_ids')
    .in('group_member_id', memberIds);
  // memberSnapshots: memberId → matchday → Set<playerId>
  const memberSnapshots: Record<string, Map<number, Set<string>>> = {};
  for (const snap of (allSnapshots ?? [])) {
    if (!memberSnapshots[snap.group_member_id]) {
      memberSnapshots[snap.group_member_id] = new Map();
    }
    memberSnapshots[snap.group_member_id].set(snap.matchday, new Set(snap.starting_player_ids));
  }

  const allPlayerIds = [...new Set((squads as any[]).map((s: any) => s.player_id))];
  let ratingRows: any[] = [];
  if (allPlayerIds.length) {
    const { data: ratings, error: rErr } = await supabase
      .from('match_ratings')
      .select('player_id, matchday, points')
      .in('player_id', allPlayerIds);
    if (rErr) throw rErr;
    ratingRows = ratings ?? [];
  }

  // playerId → matchday → points
  const rMap: Record<string, Record<number, number>> = {};
  for (const r of ratingRows) {
    if (!rMap[r.player_id]) rMap[r.player_id] = {};
    rMap[r.player_id][r.matchday] = r.points ?? 0;
  }

  // Fetch all used tokens in this group (apply same effects as calculateGroupScores)
  const { data: allTokens } = await supabase
    .from('tokens')
    .select('user_id, token_type, used_matchday, target_player_id')
    .eq('group_id', groupId)
    .not('used_matchday', 'is', null);

  const nullifyTokens = (allTokens ?? []).filter((t: any) => t.token_type === 'nullify');

  return members.map((m: any) => {
    const mSquad = memberSquads[m.id] ?? { starting: new Set<string>(), all: [] as string[] };
    const memberTokens = (allTokens ?? []).filter((t: any) => t.user_id === m.user_id);

    // Collect all matchdays this member has rating data for
    const allMatchdays = new Set<number>();
    for (const pid of mSquad.all) {
      for (const md of Object.keys(rMap[pid] ?? {})) allMatchdays.add(Number(md));
    }

    const byMatchday: Record<number, number> = {};
    for (const matchday of allMatchdays) {
      // Use per-matchday snapshot if available, otherwise fall back to current lineup
      const startingForMd = memberSnapshots[m.id]?.get(matchday) ?? mSquad.starting;
      const hasBenchBoost = memberTokens.some(
        (t: any) => t.token_type === 'bench_boost' && t.used_matchday === matchday,
      );
      let mdTotal = 0;
      for (const pid of mSquad.all) {
        if (!startingForMd.has(pid) && !hasBenchBoost) continue;
        let pts = rMap[pid]?.[matchday] ?? 0;
        const nullified = nullifyTokens.some(
          (t: any) => t.target_player_id === pid && t.used_matchday === matchday,
        );
        if (nullified) {
          pts = 0;
        } else {
          const doubled = memberTokens.some(
            (t: any) =>
              t.token_type === 'double_points' &&
              t.target_player_id === pid &&
              t.used_matchday === matchday,
          );
          if (doubled) pts *= 2;
        }
        mdTotal += pts;
      }
      if (mdTotal !== 0) byMatchday[matchday] = mdTotal;
    }

    return {
      userId: m.user_id,
      username: m.profiles?.username ?? 'Unknown',
      totalPoints: m.total_points ?? 0,
      byMatchday,
    };
  });
}

// ── Per-player rating history ─────────────────────────────────────────────────

export interface PlayerRating {
  matchday: number;
  matchDate: string;
  fotmobRating: number | null;
  points: number;
  didNotPlay: boolean;
}

export async function getPlayerRatings(playerId: string): Promise<PlayerRating[]> {
  const { data, error } = await supabase
    .from('match_ratings')
    .select('matchday, match_date, fotmob_rating, points, did_not_play')
    .eq('player_id', playerId)
    .order('matchday');
  if (error) throw error;

  return data.map((r: any) => ({
    matchday: r.matchday,
    matchDate: r.match_date,
    fotmobRating: r.fotmob_rating,
    points: r.points,
    didNotPlay: r.did_not_play,
  }));
}
