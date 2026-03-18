// Draft service — snake draft engine, pick validation, draft state management

import { supabase } from '@/lib/supabase';
import type { Position, SquadSlot, DraftStatus } from '@/types/models';
import { isLineupLocked, MATCHDAY_SCHEDULE } from '@/services/rating.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DraftMember {
  userId: string;
  username: string;
  draftPosition: number;
  groupMemberId: string;
}

export interface DraftState {
  groupId: string;
  status: DraftStatus;
  currentPickNumber: number; // next pick to be made (1-indexed)
  currentRound: number;
  currentPickerUserId: string | null;
  totalPicks: number; // memberCount × 15
  members: DraftMember[];
  currentDraftRound: number; // 1 = league phase, 2 = Round of 16, etc.
}

export interface DraftPickRecord {
  id: string;
  round: number;
  pickNumber: number;
  userId: string;
  username: string;
  playerId: string;
  playerName: string;
  playerTeam: string;
  playerPosition: Position;
  pickedAt: string;
}

// ── Snake draft helpers ───────────────────────────────────────────────────────

function getCurrentPicker(members: DraftMember[], overallPickNumber: number): string | null {
  if (!members.length) return null;
  const memberCount = members.length;
  const round = Math.ceil(overallPickNumber / memberCount);
  const pickWithinRound = overallPickNumber - (round - 1) * memberCount;
  const draftPosition =
    round % 2 === 1 ? pickWithinRound : memberCount - pickWithinRound + 1;
  return members.find((m) => m.draftPosition === draftPosition)?.userId ?? null;
}

// Squad: 2 GK, 5 DEF, 5 MID, 3 ATT = 15 total
// Default lineup (4-4-2): GK1, DEF1-4, MID1-4, ATT1-2 start; rest bench
const SLOT_PRIORITY: Record<Position, SquadSlot[]> = {
  GK: ['GK1', 'GK2'],
  CB: ['DEF1', 'DEF2', 'DEF3', 'DEF4', 'DEF5'],
  RB: ['DEF1', 'DEF2', 'DEF3', 'DEF4', 'DEF5'],
  LB: ['DEF1', 'DEF2', 'DEF3', 'DEF4', 'DEF5'],
  CM: ['MID1', 'MID2', 'MID3', 'MID4', 'MID5'],
  W:  ['ATT1', 'ATT2', 'ATT3'],
  ST: ['ATT1', 'ATT2', 'ATT3'],
};

// Slots that are starting in the default 4-4-2
const DEFAULT_STARTING = new Set<SquadSlot>(['GK1', 'DEF1', 'DEF2', 'DEF3', 'DEF4', 'MID1', 'MID2', 'MID3', 'MID4', 'ATT1', 'ATT2']);

function assignSlot(position: Position, takenSlots: Set<string>): SquadSlot {
  const available = SLOT_PRIORITY[position].find((s) => !takenSlots.has(s));
  if (!available) throw new Error(`No available slot for position ${position}.`);
  return available;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Draft actions ─────────────────────────────────────────────────────────────

export async function startDraft(groupId: string): Promise<void> {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('draft_order_mode, draft_status')
    .eq('id', groupId)
    .single();

  if (groupError) throw groupError;
  if (group.draft_status !== 'pending') return; // already started

  const { data: members, error: memberError } = await supabase
    .from('group_members')
    .select('id, user_id, draft_position')
    .eq('group_id', groupId);

  if (memberError) throw memberError;

  // For manual mode, skip assignment if positions are already set by the leader
  const alreadyOrdered =
    group.draft_order_mode === 'manual' &&
    members.every((m: any) => m.draft_position != null);

  if (!alreadyOrdered) {
    const positions = Array.from({ length: members.length }, (_, i) => i + 1);
    const assigned =
      group.draft_order_mode === 'random' ? shuffle(positions) : positions;

    for (let i = 0; i < members.length; i++) {
      const { error } = await supabase
        .from('group_members')
        .update({ draft_position: assigned[i] })
        .eq('id', members[i].id);
      if (error) throw error;
    }
  }

  const { error: updateError } = await supabase
    .from('groups')
    .update({ draft_status: 'in_progress', current_pick: 1, current_round: 1 })
    .eq('id', groupId);

  if (updateError) throw updateError;
}

export async function makePick(params: {
  groupId: string;
  userId: string;
  playerId: string;
  playerPosition: Position;
}): Promise<void> {
  const { groupId, userId, playerId, playerPosition } = params;

  // Load group state and members
  const [{ data: group, error: gErr }, { data: members, error: mErr }] =
    await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase
        .from('group_members')
        .select('id, user_id, draft_position')
        .eq('group_id', groupId),
    ]);

  if (gErr) throw gErr;
  if (mErr) throw mErr;
  if (group.draft_status !== 'in_progress') throw new Error('Draft is not in progress.');

  const draftMembers: DraftMember[] = members.map((m: any) => ({
    userId: m.user_id,
    username: '',
    draftPosition: m.draft_position,
    groupMemberId: m.id,
  }));

  const currentPicker = getCurrentPicker(draftMembers, group.current_pick);
  if (currentPicker !== userId) throw new Error("It's not your turn.");

  const currentDraftRound: number = group.current_draft_round ?? 1;

  // Check player not already drafted in this group in the current draft round
  const { data: alreadyPicked } = await supabase
    .from('draft_picks')
    .select('id')
    .eq('group_id', groupId)
    .eq('player_id', playerId)
    .eq('draft_round', currentDraftRound)
    .maybeSingle();

  if (alreadyPicked) throw new Error('Player already picked.');

  const memberCount = members.length;
  const overallPick = group.current_pick;
  const round = Math.ceil(overallPick / memberCount);
  const member = members.find((m: any) => m.user_id === userId);
  if (!member) throw new Error('Not a member of this group.');

  // Get taken slots + player IDs for this user (used for slot assignment and club cap)
  const { data: takenRows, error: slotErr } = await supabase
    .from('squads')
    .select('slot, player_id')
    .eq('group_member_id', member.id);

  if (slotErr) throw slotErr;
  const takenSlots = new Set(takenRows?.map((r: any) => r.slot) ?? []);

  // Club cap: max 2 players from the same club
  const { data: pickedPlayer } = await supabase
    .from('players')
    .select('team_name')
    .eq('id', playerId)
    .single();

  if (pickedPlayer) {
    const takenPlayerIds = takenRows?.map((r: any) => r.player_id).filter(Boolean) ?? [];
    if (takenPlayerIds.length > 0) {
      const { data: sameClub } = await supabase
        .from('players')
        .select('id')
        .in('id', takenPlayerIds)
        .eq('team_name', pickedPlayer.team_name);
      if ((sameClub?.length ?? 0) >= 2) {
        throw new Error(`Team cap: already have 2 players from ${pickedPlayer.team_name}.`);
      }
    }
  }
  const slot = assignSlot(playerPosition, takenSlots);

  // Clean up any orphaned pick for this pick number (from a previous failed attempt)
  await supabase
    .from('draft_picks')
    .delete()
    .eq('group_id', groupId)
    .eq('pick_number', overallPick);

  // Insert draft pick + squad entry
  const { error: pickError } = await supabase.from('draft_picks').insert({
    group_id: groupId,
    user_id: userId,
    player_id: playerId,
    round,
    pick_number: overallPick,
    draft_round: currentDraftRound,
  });
  if (pickError) throw pickError;

  const { error: squadError } = await supabase.from('squads').insert({
    group_member_id: member.id,
    player_id: playerId,
    slot,
    is_starting: DEFAULT_STARTING.has(slot),
    acquired_via: 'draft',
  });
  if (squadError) throw squadError;

  // Advance pick counter
  const nextPick = overallPick + 1;
  const totalPicks = memberCount * 15;
  const isComplete = nextPick > totalPicks;

  const { error: advanceError } = await supabase
    .from('groups')
    .update({
      current_pick: nextPick,
      current_round: Math.ceil(nextPick / memberCount),
      draft_status: isComplete ? 'completed' : 'in_progress',
    })
    .eq('id', groupId);

  if (advanceError) throw advanceError;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getDraftState(groupId: string): Promise<DraftState> {
  const [{ data: group, error: gErr }, { data: members, error: mErr }] =
    await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).single(),
      supabase
        .from('group_members')
        .select('id, user_id, draft_position, profiles(username)')
        .eq('group_id', groupId)
        .order('draft_position'),
    ]);

  if (gErr) throw gErr;
  if (mErr) throw mErr;

  const draftMembers: DraftMember[] = members.map((m: any) => ({
    userId: m.user_id,
    username: m.profiles?.username ?? 'Unknown',
    draftPosition: m.draft_position ?? 0,
    groupMemberId: m.id,
  }));

  const memberCount = draftMembers.length;
  const currentPick = group.current_pick ?? 1;
  const totalPicks = memberCount * 15;

  return {
    groupId,
    status: group.draft_status as DraftStatus,
    currentPickNumber: currentPick,
    currentRound: Math.ceil(currentPick / memberCount),
    currentPickerUserId: getCurrentPicker(draftMembers, currentPick),
    totalPicks,
    members: draftMembers,
    currentDraftRound: group.current_draft_round ?? 1,
  };
}

export async function getDraftPicks(groupId: string): Promise<DraftPickRecord[]> {
  const { data, error } = await supabase
    .from('draft_picks')
    .select(`
      id, round, pick_number, user_id, picked_at,
      profiles ( username ),
      players ( name, team_name, position )
    `)
    .eq('group_id', groupId)
    .order('pick_number');

  if (error) throw error;

  return data.map((row: any) => ({
    id: row.id,
    round: row.round,
    pickNumber: row.pick_number,
    userId: row.user_id,
    username: row.profiles?.username ?? 'Unknown',
    playerId: row.players?.id ?? '',
    playerName: row.players?.name ?? '',
    playerTeam: row.players?.team_name ?? '',
    playerPosition: row.players?.position as Position,
    pickedAt: row.picked_at,
  }));
}

export interface SquadPlayer {
  slot: SquadSlot;
  playerId: string;
  playerName: string;
  playerTeam: string;
  playerPosition: Position;
  isStarting: boolean;
}

export async function getMySquad(groupId: string, userId: string): Promise<SquadPlayer[]> {
  const { data: member, error: memberError } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (memberError || !member) return [];

  const { data, error } = await supabase
    .from('squads')
    .select('slot, is_starting, players ( id, name, team_name, position )')
    .eq('group_member_id', member.id);

  if (error) throw error;

  return data.map((row: any) => ({
    slot: row.slot as SquadSlot,
    playerId: row.players?.id ?? '',
    playerName: row.players?.name ?? '',
    playerTeam: row.players?.team_name ?? '',
    playerPosition: row.players?.position as Position,
    isStarting: row.is_starting,
  }));
}

export interface SquadPlayerWithPoints extends SquadPlayer {
  totalPoints: number;
}

export async function getSquadWithPoints(
  groupId: string,
  userId: string
): Promise<SquadPlayerWithPoints[]> {
  const squad = await getMySquad(groupId, userId);
  if (!squad.length) return [];

  const playerIds = squad.map((p) => p.playerId);

  const { data: ratings, error } = await supabase
    .from('match_ratings')
    .select('player_id, points')
    .in('player_id', playerIds);

  if (error) throw error;

  const pointsMap: Record<string, number> = {};
  for (const r of ratings as any[]) {
    pointsMap[r.player_id] = (pointsMap[r.player_id] ?? 0) + (r.points ?? 0);
  }

  return squad.map((p) => ({ ...p, totalPoints: pointsMap[p.playerId] ?? 0 }));
}

// ── Lineup management ─────────────────────────────────────────────────────────

export function validateLineup(starters: SquadPlayer[]): string | null {
  if (starters.length !== 11) return `Need exactly 11 starters (currently ${starters.length})`;
  const gk  = starters.filter((p) => p.playerPosition === 'GK').length;
  const def = starters.filter((p) => ['CB', 'RB', 'LB'].includes(p.playerPosition)).length;
  const mid = starters.filter((p) => p.playerPosition === 'CM').length;
  const att = starters.filter((p) => ['W', 'ST'].includes(p.playerPosition)).length;
  if (gk !== 1)          return 'Must have exactly 1 GK';
  if (def < 3 || def > 5) return `Defenders must be 3–5 (currently ${def})`;
  if (mid < 2 || mid > 5) return `Midfielders must be 2–5 (currently ${mid})`;
  if (att < 1 || att > 3) return `Attackers must be 1–3 (currently ${att})`;
  return null;
}

export async function setStartingLineup(params: {
  groupId: string;
  userId: string;
  startingPlayerIds: string[];
}): Promise<void> {
  const { groupId, userId, startingPlayerIds } = params;

  const { data: member, error: memberError } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (memberError || !member) throw new Error('Not a member of this group.');

  if (isLineupLocked()) {
    throw new Error('Lineup is locked — the deadline for the next matchday has passed.');
  }

  // Before changing the lineup, snapshot the current XI for any past matchdays
  // that don't have a snapshot yet. This preserves historical accuracy.
  await _snapshotPastMatchdays(member.id);

  // Set all to bench, then set starters
  const { error: e1 } = await supabase
    .from('squads')
    .update({ is_starting: false })
    .eq('group_member_id', member.id);
  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from('squads')
    .update({ is_starting: true })
    .eq('group_member_id', member.id)
    .in('player_id', startingPlayerIds);
  if (e2) throw e2;
}

// ── Lineup snapshots ──────────────────────────────────────────────────────────

/**
 * Internal helper: creates lineup snapshots for all completed matchdays that
 * don't have one yet, using the member's current is_starting flags.
 * Uses ignoreDuplicates so an existing snapshot is never overwritten.
 */
async function _snapshotPastMatchdays(groupMemberId: string): Promise<void> {
  const now = new Date();
  const pastMatchdays = MATCHDAY_SCHEDULE
    .filter((md) => new Date(md.date) < now)
    .map((md) => md.matchday);
  if (!pastMatchdays.length) return;

  const { data: existing } = await supabase
    .from('lineup_snapshots')
    .select('matchday')
    .eq('group_member_id', groupMemberId)
    .in('matchday', pastMatchdays);

  const alreadySnapped = new Set((existing ?? []).map((r: any) => r.matchday));
  const toSnap = pastMatchdays.filter((md) => !alreadySnapped.has(md));
  if (!toSnap.length) return;

  const { data: squadRows } = await supabase
    .from('squads')
    .select('player_id, is_starting')
    .eq('group_member_id', groupMemberId);

  const startingIds = (squadRows ?? [])
    .filter((r: any) => r.is_starting)
    .map((r: any) => r.player_id);

  const rows = toSnap.map((matchday) => ({
    group_member_id: groupMemberId,
    matchday,
    starting_player_ids: startingIds,
  }));

  await supabase
    .from('lineup_snapshots')
    .upsert(rows, { onConflict: 'group_member_id,matchday', ignoreDuplicates: true });
}

/**
 * Ensures lineup snapshots exist for all completed matchdays.
 * Call this when a user opens their squad view — it handles carryover for
 * users who never explicitly update their lineup.
 */
export async function ensureLineupSnapshots(groupId: string, userId: string): Promise<void> {
  const { data: member } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();
  if (!member) return;
  await _snapshotPastMatchdays(member.id);
}

// ── Real-time subscription ────────────────────────────────────────────────────

/** Returns the username of the player's owner within a group, or null if undrafted. */
export async function getPlayerOwnerInGroup(groupId: string, playerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('squads')
    .select('group_members!inner(group_id, profiles!inner(username))')
    .eq('player_id', playerId)
    .eq('group_members.group_id', groupId)
    .maybeSingle();

  if (error || !data) return null;
  return (data as any).group_members?.profiles?.username ?? null;
}

/**
 * Start a second draft (Round of 16) for a group.
 * - Clears all squads and tokens for group members
 * - Re-seeds starting tokens
 * - Sets pick order: reverse standings (best record picks last)
 * - Resets draft state to in_progress with current_draft_round = 2
 */
export async function startSecondDraft(groupId: string): Promise<void> {
  const { seedStartingTokens } = await import('@/services/prediction.service');

  // Fetch all members with their points
  const { data: members, error: memberErr } = await supabase
    .from('group_members')
    .select('id, user_id, total_points')
    .eq('group_id', groupId)
    .order('total_points', { ascending: false });

  if (memberErr) throw memberErr;
  if (!members?.length) throw new Error('No members in group.');

  // Delete all squad entries for this group's members
  const memberIds = members.map((m: any) => m.id);
  const { error: squadErr } = await supabase
    .from('squads')
    .delete()
    .in('group_member_id', memberIds);
  if (squadErr) throw squadErr;

  // Delete all tokens for this group
  const { error: tokenErr } = await supabase
    .from('tokens')
    .delete()
    .eq('group_id', groupId);
  if (tokenErr) throw tokenErr;

  // Re-seed tokens and assign reversed draft positions (best record = last pick)
  const memberCount = members.length;
  for (let i = 0; i < memberCount; i++) {
    const member = members[i];
    // members is sorted desc by points, so index 0 = best → picks last
    const draftPosition = memberCount - i;
    const { error: posErr } = await supabase
      .from('group_members')
      .update({ draft_position: draftPosition })
      .eq('id', member.id);
    if (posErr) throw posErr;

    await seedStartingTokens(member.user_id, groupId);
  }

  // Reset group draft state
  const { error: groupErr } = await supabase
    .from('groups')
    .update({
      current_draft_round: 2,
      current_pick: 1,
      current_round: 1,
      draft_status: 'in_progress',
    })
    .eq('id', groupId);

  if (groupErr) throw groupErr;
}

export function subscribeToDraft(groupId: string, onUpdate: () => void): () => void {
  const channel = supabase
    .channel(`draft:${groupId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'draft_picks', filter: `group_id=eq.${groupId}` },
      // Delay slightly so groups.current_pick update (which follows the insert) has time to commit
      () => setTimeout(onUpdate, 600)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` },
      onUpdate
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
