// Player data service — abstraction layer for FotMob data
// Prototype: serves mock player data and ratings
// Production: swaps in real FotMob API data

import { supabase } from '@/lib/supabase';
import type { Player, Position } from '@/types/models';
import { MOCK_PLAYERS } from '@/data/mock-players';

// ── Row mapper ────────────────────────────────────────────────────────────────

function rowToPlayer(row: any): Player {
  return {
    id: row.id,
    fotmobId: row.fotmob_id,
    name: row.name,
    teamName: row.team_name,
    position: row.position as Position,
    imageUrl: row.image_url,
    isAvailable: row.is_available,
  };
}

// ── Seeding ───────────────────────────────────────────────────────────────────

/**
 * Insert mock CL players into Supabase. Safe to call multiple times — uses
 * upsert on fotmob_id so it won't duplicate players.
 */
export async function seedPlayers(): Promise<void> {
  const rows = MOCK_PLAYERS.map((p) => ({
    fotmob_id: `mock_${p.name.toLowerCase().replace(/\s+/g, '_')}`,
    name: p.name,
    team_name: p.teamName,
    position: p.position,
    is_available: true,
  }));

  const { error } = await supabase
    .from('players')
    .upsert(rows, { onConflict: 'fotmob_id' });

  if (error) throw error;
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Fetch all players from Supabase. */
export async function getAllPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('team_name')
    .order('name');

  if (error) throw error;
  return data.map(rowToPlayer);
}

/**
 * Fetch players that haven't been drafted in a specific group yet.
 * Used to populate the player pool during a live draft.
 * Pass draftRound (default 1) to scope availability to the current draft round.
 */
export async function getAvailablePlayers(groupId: string, draftRound = 1): Promise<Player[]> {
  // Get IDs of players already drafted in this group for the current round
  const { data: picked, error: pickError } = await supabase
    .from('draft_picks')
    .select('player_id')
    .eq('group_id', groupId)
    .eq('draft_round', draftRound);

  if (pickError) throw pickError;

  const pickedIds = new Set(picked.map((r: any) => r.player_id as string));

  // Fetch all players using pagination (Supabase caps at 1000 rows per request)
  const allRows: any[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('is_available', true)
      .order('position')
      .order('name')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    allRows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return allRows
    .filter((r) => !pickedIds.has(r.id))
    .map(rowToPlayer);
}

/** Fetch all players at a given position. */
export async function getPlayersByPosition(position: Position): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('position', position)
    .order('name');

  if (error) throw error;
  return data.map(rowToPlayer);
}

/** Search players by name or team (case-insensitive). */
export async function searchPlayers(query: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .or(`name.ilike.%${query}%,team_name.ilike.%${query}%`)
    .order('name')
    .limit(30);

  if (error) throw error;
  return data.map(rowToPlayer);
}

/** Fetch a single player by ID. */
export async function getPlayer(id: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return rowToPlayer(data);
}

/** Check whether players have been seeded into Supabase yet. */
export async function isSeeded(): Promise<boolean> {
  const { count, error } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return (count ?? 0) > 0;
}
