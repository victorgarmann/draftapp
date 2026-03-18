// Group service — create, join, manage draft groups

import { supabase } from '@/lib/supabase';
import type { DraftOrderMode, DraftStatus } from '@/types/models';
import { isSeeded, seedPlayers } from './player.service';
import { seedStartingTokens } from './prediction.service';

// ── Extended types ────────────────────────────────────────────────────────────

export interface GroupDetail {
  id: string;
  name: string;
  creatorId: string;
  inviteCode: string;
  maxMembers: number;
  draftDate: string | null;
  draftStatus: DraftStatus;
  draftOrderMode: DraftOrderMode;
  memberCount: number;
  currentDraftRound: number;
  color: string;
  tokensEnabled: boolean;
}

export interface MemberWithProfile {
  id: string;
  groupId: string;
  userId: string;
  draftPosition: number | null;
  totalPoints: number;
  username: string;
  displayName: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  // Avoid ambiguous chars (0/O, 1/I/L)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

function rowToGroup(row: any, memberCount = 0): GroupDetail {
  return {
    id: row.id,
    name: row.name,
    creatorId: row.creator_id,
    inviteCode: row.invite_code,
    maxMembers: row.max_members,
    draftDate: row.draft_date,
    draftStatus: row.draft_status as DraftStatus,
    draftOrderMode: row.draft_order_mode as DraftOrderMode,
    memberCount,
    currentDraftRound: row.current_draft_round ?? 1,
    color: row.color ?? '#3B82F6',
    tokensEnabled: row.tokens_enabled ?? true,
  };
}

// ── Group CRUD ────────────────────────────────────────────────────────────────

export async function updateGroupSettings(
  groupId: string,
  settings: { color?: string; tokensEnabled?: boolean; draftOrderMode?: DraftOrderMode; draftDate?: string | null },
): Promise<void> {
  const update: Record<string, any> = {};
  if (settings.color !== undefined) update.color = settings.color;
  if (settings.tokensEnabled !== undefined) update.tokens_enabled = settings.tokensEnabled;
  if (settings.draftOrderMode !== undefined) update.draft_order_mode = settings.draftOrderMode;
  if (settings.draftDate !== undefined) update.draft_date = settings.draftDate;
  const { error } = await supabase.from('groups').update(update).eq('id', groupId);
  if (error) throw error;
}

export async function setManualDraftOrder(
  groupId: string,
  orderedUserIds: string[],
): Promise<void> {
  // orderedUserIds[0] = picks first (position 1), last = picks last
  for (let i = 0; i < orderedUserIds.length; i++) {
    const { error } = await supabase
      .from('group_members')
      .update({ draft_position: i + 1 })
      .eq('group_id', groupId)
      .eq('user_id', orderedUserIds[i]);
    if (error) throw error;
  }
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function createGroup(params: {
  name: string;
  maxMembers: number;
  draftOrderMode: DraftOrderMode;
  creatorId: string;
  color: string;
}): Promise<GroupDetail> {
  // Ensure players are seeded before any group can draft
  if (!(await isSeeded())) {
    await seedPlayers();
  }

  const inviteCode = generateInviteCode();

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name: params.name.trim(),
      creator_id: params.creatorId,
      invite_code: inviteCode,
      max_members: params.maxMembers,
      draft_order_mode: params.draftOrderMode,
      color: params.color,
    })
    .select()
    .single();

  if (groupError) throw groupError;

  // Add creator as first member
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: params.creatorId });

  if (memberError) throw memberError;

  await seedStartingTokens(params.creatorId, group.id);

  return rowToGroup(group, 1);
}

export async function joinGroup(params: {
  inviteCode: string;
  userId: string;
}): Promise<GroupDetail> {
  const code = params.inviteCode.trim().toUpperCase();

  // Find the group
  const { data: group, error: findError } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', code)
    .single();

  if (findError || !group) {
    throw new Error('Group not found. Check the invite code and try again.');
  }

  // Get current member count
  const { count, error: countError } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', group.id);

  if (countError) throw countError;

  if ((count ?? 0) >= group.max_members) {
    throw new Error('This group is full.');
  }

  // Check not already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', params.userId)
    .single();

  if (existing) {
    throw new Error('You are already in this group.');
  }

  const { error: joinError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: params.userId });

  if (joinError) throw joinError;

  await seedStartingTokens(params.userId, group.id);

  return rowToGroup(group, (count ?? 0) + 1);
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getMyGroups(userId: string): Promise<GroupDetail[]> {
  const { data: memberships, error } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (error) throw error;
  if (!memberships.length) return [];

  const groupIds = memberships.map((m: any) => m.group_id);

  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds)
    .order('created_at', { ascending: false });

  if (groupsError) throw groupsError;

  // Get member counts for all groups in one query
  const { data: allMembers, error: memberError } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);

  if (memberError) throw memberError;

  const countMap: Record<string, number> = {};
  for (const m of allMembers) {
    countMap[m.group_id] = (countMap[m.group_id] ?? 0) + 1;
  }

  return groups.map((g: any) => rowToGroup(g, countMap[g.id] ?? 0));
}

/** Returns the user's rank (1-based) and total_points in each of their groups. */
export async function getMyGroupRanks(
  userId: string,
  groupIds: string[],
): Promise<Record<string, { rank: number; points: number }>> {
  if (!groupIds.length) return {};
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, user_id, total_points')
    .in('group_id', groupIds);
  if (error) throw error;

  const result: Record<string, { rank: number; points: number }> = {};
  for (const gid of groupIds) {
    const members = (data as any[])
      .filter((m) => m.group_id === gid)
      .sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0));
    const idx = members.findIndex((m) => m.user_id === userId);
    if (idx >= 0) result[gid] = { rank: idx + 1, points: members[idx].total_points ?? 0 };
  }
  return result;
}

export async function getGroup(id: string): Promise<GroupDetail | null> {
  const { data: group, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  const { count } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id);

  return rowToGroup(group, count ?? 0);
}

export async function getGroupMembers(groupId: string): Promise<MemberWithProfile[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      id, group_id, user_id, draft_position, total_points, joined_at,
      profiles ( username, display_name )
    `)
    .eq('group_id', groupId)
    .order('joined_at');

  if (error) throw error;

  return data.map((row: any) => ({
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    draftPosition: row.draft_position,
    totalPoints: row.total_points,
    username: row.profiles?.username ?? 'Unknown',
    displayName: row.profiles?.display_name ?? null,
  }));
}
