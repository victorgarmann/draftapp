// football-data.org API client (v4)
// Free key at https://www.football-data.org/client/register
// Rate limit: 10 requests / minute on free tier

import type { Position } from '@/types/models';

const BASE = 'https://api.football-data.org/v4';
const CL_COMPETITION_ID = 2001;  // UEFA Champions League
const CL_SEASON = 2025;          // 2025/26 season

// ── Types returned by the API ─────────────────────────────────────────────────

export interface FDSquadPlayer {
  id: number;
  name: string;
  position: string | null;  // e.g. "Centre-Back", "Left Winger", "Goalkeeper"
  dateOfBirth?: string;
  nationality?: string;
  shirtNumber?: number | null;
}

export interface FDTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;          // 3-letter abbreviation e.g. "MCI"
  crest: string;        // crest image URL
  squad: FDSquadPlayer[];
}

export interface FDMatch {
  id: number;
  matchday: number | null;
  stage: string;        // "GROUP_STAGE", "LAST_16", "QUARTER_FINALS", etc.
  utcDate: string;      // ISO date string
  status: string;       // "FINISHED", "SCHEDULED", "IN_PLAY", etc.
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score: {
    fullTime: { home: number | null; away: number | null };
  };
}

// ── Position mapper ───────────────────────────────────────────────────────────

export function mapFDPosition(fdPosition: string | null): Position {
  switch (fdPosition) {
    case 'Goalkeeper':                    return 'GK';
    case 'Centre-Back':                   return 'CB';
    case 'Left-Back':
    case 'Left Wing Back':                return 'LB';
    case 'Right-Back':
    case 'Right Wing Back':               return 'RB';
    case 'Defensive Midfield':
    case 'Central Midfield':
    case 'Attacking Midfield':            return 'CM';
    case 'Left Midfield':
    case 'Left Winger':                   return 'W';
    case 'Right Midfield':
    case 'Right Winger':                  return 'W';
    case 'Second Striker':
    case 'Centre-Forward':                return 'ST';
    // Generic fallbacks
    case 'Defence':                       return 'CB';
    case 'Midfield':                      return 'CM';
    case 'Offence':                       return 'ST';
    default:                              return 'CM';
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function get<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': apiKey },
  });
  if (res.status === 429) throw new Error('Rate limit hit — please wait a minute and try again.');
  if (!res.ok) throw new Error(`football-data.org error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ── Public API functions ──────────────────────────────────────────────────────

/** Fetch all teams in the CL 2024/25 season (returns team list WITHOUT squads). */
export async function fetchCLTeams(apiKey: string): Promise<FDTeam[]> {
  const data = await get<{ teams: FDTeam[] }>(
    `/competitions/${CL_COMPETITION_ID}/teams?season=${CL_SEASON}`,
    apiKey,
  );
  return data.teams ?? [];
}

/**
 * Fetch full team details including squad for one team.
 * Call with delays between requests to respect the 10 req/min free-tier limit.
 */
export async function fetchTeamWithSquad(apiKey: string, teamId: number): Promise<FDTeam> {
  return get<FDTeam>(`/teams/${teamId}`, apiKey);
}

/** Fetch all CL 2024/25 match fixtures. */
export async function fetchCLMatches(apiKey: string): Promise<FDMatch[]> {
  const data = await get<{ matches: FDMatch[] }>(
    `/competitions/${CL_COMPETITION_ID}/matches?season=${CL_SEASON}`,
    apiKey,
  );
  return data.matches ?? [];
}

/**
 * Fetch all 36 CL teams WITH their squads, respecting the rate limit.
 * Calls onProgress with status messages. Takes ~4 min on the free tier.
 */
export async function fetchAllCLSquads(
  apiKey: string,
  onProgress: (msg: string) => void,
): Promise<FDTeam[]> {
  onProgress('Fetching CL team list…');
  const teams = await fetchCLTeams(apiKey);
  onProgress(`Found ${teams.length} teams. Fetching squads (this takes ~4 min on free tier)…`);

  const result: FDTeam[] = [];

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    onProgress(`Squad ${i + 1}/${teams.length}: ${team.name}`);

    try {
      const full = await fetchTeamWithSquad(apiKey, team.id);
      result.push(full);
    } catch (e: any) {
      onProgress(`⚠ Skipped ${team.name}: ${e.message}`);
      result.push({ ...team, squad: [] }); // push with empty squad so we don't lose the team
    }

    // Free tier: 10 req/min. We already used 1 for the team list,
    // so allow 1 req every 6.5 s to be safe.
    if (i < teams.length - 1) {
      await sleep(6500);
    }
  }

  return result;
}
