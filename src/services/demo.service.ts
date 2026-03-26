// src/services/demo.service.ts
// Demo data seeding — for pitch demo only. Not user-facing.

import { createClient } from '@supabase/supabase-js';
import env from '@/config/env';
import { supabase } from '@/lib/supabase';
import { MATCHDAY_SCHEDULE, seedMockRatings } from '@/services/rating.service';
import { ensureLineupSnapshots } from '@/services/draft.service';
import { calculateGroupScores } from '@/services/rating.service';

// Admin client bypasses RLS — used ONLY for fake profile creation + demo seeding
const adminSupabase = createClient(env.supabase.url, env.supabase.serviceRoleKey);

// Fixed UUIDs for fake demo profiles — never change these
export const DEMO_FAKE_USERS = [
  { id: '00000000-0000-0000-0000-000000000001', username: 'ErikHansen',  display_name: 'Erik Hansen' },
  { id: '00000000-0000-0000-0000-000000000002', username: 'SofiaBerg',   display_name: 'Sofia Berg'  },
  { id: '00000000-0000-0000-0000-000000000003', username: 'LucasMelo',   display_name: 'Lucas Melo'  },
];

const DEMO_MAIN_GROUP_ID  = '00000000-demo-0000-0000-000000000001';
const DEMO_DRAFT_GROUP_ID = '00000000-demo-0000-0000-000000000002';

// Slot names for a 15-player squad
const GK_SLOTS  = ['GK1', 'GK2'];
const DEF_SLOTS = ['DEF1', 'DEF2', 'DEF3', 'DEF4', 'DEF5'];
const MID_SLOTS = ['MID1', 'MID2', 'MID3', 'MID4', 'MID5'];
const ATT_SLOTS = ['ATT1', 'ATT2', 'ATT3'];
const STARTING_SLOTS = new Set(['GK1', 'DEF1', 'DEF2', 'DEF3', 'DEF4', 'MID1', 'MID2', 'MID3', 'ATT1', 'ATT2', 'ATT3']);

type PositionGroup = 'GK' | 'DEF' | 'MID' | 'ATT';

interface SeedPlayer {
  id: string;
  team_name: string;
  position: string;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function seedDemoData(currentUserId: string): Promise<void> {
  await seedFakeProfiles();
  await seedMainGroup(currentUserId);
  await seedQuickDraftGroup(currentUserId);
}

// ── Fake profiles ─────────────────────────────────────────────────────────────

async function seedFakeProfiles(): Promise<void> {
  for (const user of DEMO_FAKE_USERS) {
    const { error } = await adminSupabase
      .from('profiles')
      .upsert({
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    if (error) throw new Error(`Failed to upsert profile ${user.username}: ${error.message}`);
  }
}

// ── Player fetching ───────────────────────────────────────────────────────────

async function fetchPlayersByGroup(): Promise<Record<PositionGroup, SeedPlayer[]>> {
  const { data, error } = await supabase
    .from('players')
    .select('id, team_name, position')
    .eq('is_available', true)
    .limit(1000);
  if (error) throw new Error(`Failed to fetch players: ${error.message}`);

  const gk  = (data ?? []).filter((p) => p.position === 'GK');
  const def = (data ?? []).filter((p) => ['CB', 'RB', 'LB'].includes(p.position));
  const mid = (data ?? []).filter((p) => p.position === 'CM');
  const att = (data ?? []).filter((p) => ['W', 'ST'].includes(p.position));

  return { GK: gk as SeedPlayer[], DEF: def as SeedPlayer[], MID: mid as SeedPlayer[], ATT: att as SeedPlayer[] };
}

// ── Deterministic shuffle ─────────────────────────────────────────────────────

function shuffleDeterministic<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.abs((seed * 1234567 + i * 9876543) % (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Squad assignment ──────────────────────────────────────────────────────────

function assignSquad(
  players: Record<PositionGroup, SeedPlayer[]>,
  alreadyDrafted: Set<string>,
  userIndex: number,
): Array<{ playerId: string; slotName: string; teamName: string }> {
  const teamCount: Record<string, number> = {};
  const result: Array<{ playerId: string; slotName: string; teamName: string }> = [];

  const needs: Array<{ group: PositionGroup; slots: string[] }> = [
    { group: 'GK',  slots: GK_SLOTS  },
    { group: 'DEF', slots: DEF_SLOTS },
    { group: 'MID', slots: MID_SLOTS },
    { group: 'ATT', slots: ATT_SLOTS },
  ];

  for (const { group, slots } of needs) {
    const pool = shuffleDeterministic(players[group], userIndex * 17 + group.charCodeAt(0))
      .filter((p) => !alreadyDrafted.has(p.id));
    let added = 0;
    for (const p of pool) {
      if (added >= slots.length) break;
      const tc = teamCount[p.team_name] ?? 0;
      if (tc >= 2) continue;
      teamCount[p.team_name] = (teamCount[p.team_name] ?? 0) + 1;
      alreadyDrafted.add(p.id);
      result.push({ playerId: p.id, slotName: slots[added], teamName: p.team_name });
      added++;
    }
    if (added < slots.length) throw new Error(`Not enough ${group} players available for user ${userIndex}`);
  }

  return result;
}

// ── Main demo group ───────────────────────────────────────────────────────────

async function seedMainGroup(currentUserId: string): Promise<void> {
  // 1. Upsert the group
  const { error: gErr } = await adminSupabase
    .from('groups')
    .upsert({
      id: DEMO_MAIN_GROUP_ID,
      name: 'WC Fantasy 2026',
      creator_id: currentUserId,
      invite_code: 'DEMO01',
      max_members: 8,
      draft_status: 'completed',
      current_draft_round: 1,
      tokens_enabled: true,
      draft_order_mode: 'random',
      color: '#14B8A6',
    }, { onConflict: 'id' });
  if (gErr) throw new Error(`Group upsert failed: ${gErr.message}`);

  const allMemberIds = [currentUserId, ...DEMO_FAKE_USERS.map((u) => u.id)];

  // 2. Clean up existing data for this group
  await adminSupabase.from('draft_picks').delete().eq('group_id', DEMO_MAIN_GROUP_ID);
  await adminSupabase.from('tokens').delete().eq('group_id', DEMO_MAIN_GROUP_ID);
  await adminSupabase.from('predictions').delete().eq('group_id', DEMO_MAIN_GROUP_ID);
  for (const uid of allMemberIds) {
    await adminSupabase.from('squads').delete().eq('group_id', DEMO_MAIN_GROUP_ID).eq('user_id', uid);
  }

  // 3. Upsert group members
  const memberRows = allMemberIds.map((uid, i) => ({
    group_id: DEMO_MAIN_GROUP_ID,
    user_id: uid,
    draft_position: i + 1,
    total_points: 0,
  }));
  const { error: mErr } = await adminSupabase
    .from('group_members')
    .upsert(memberRows, { onConflict: 'group_id,user_id' });
  if (mErr) throw new Error(`Members upsert failed: ${mErr.message}`);

  // 4. Assign and insert squads
  const players = await fetchPlayersByGroup();
  const alreadyDrafted = new Set<string>();

  for (let i = 0; i < allMemberIds.length; i++) {
    const squad = assignSquad(players, alreadyDrafted, i);
    const squadRows = squad.map((p) => ({
      group_id: DEMO_MAIN_GROUP_ID,
      user_id: allMemberIds[i],
      player_id: p.playerId,
      slot_name: p.slotName,
      is_starting: STARTING_SLOTS.has(p.slotName),
      acquired_via: 'draft',
    }));
    const { error: sErr } = await adminSupabase.from('squads').insert(squadRows);
    if (sErr) throw new Error(`Squad insert failed for user ${i}: ${sErr.message}`);
  }

  // 5. Seed mock ratings for all past matchdays (idempotent)
  await seedMockRatings();

  // 6. Ensure lineup snapshots exist
  for (const uid of allMemberIds) {
    await ensureLineupSnapshots(DEMO_MAIN_GROUP_ID, uid);
  }

  // 7. Seed predictions for MD1–3
  const { data: fixtureData } = await supabase
    .from('matchday_fixtures')
    .select('id, matchday, token_reward_type')
    .in('matchday', [1, 2, 3]);

  const fixtures = fixtureData ?? [];

  for (let ui = 0; ui < allMemberIds.length; ui++) {
    const uid = allMemberIds[ui];
    for (const fixture of fixtures) {
      // Deterministic correct/wrong based on user+fixture
      const correct = ((ui + fixture.matchday) % 3) === 0;
      await adminSupabase.from('predictions').upsert({
        user_id: uid,
        group_id: DEMO_MAIN_GROUP_ID,
        fixture_id: fixture.id,
        matchday: fixture.matchday,
        predicted_home: correct ? 1 : 2,
        predicted_away: correct ? 0 : 1,
        is_correct: correct,
      }, { onConflict: 'user_id,fixture_id' });

      if (correct && fixture.token_reward_type) {
        await adminSupabase.from('tokens').insert({
          user_id: uid,
          group_id: DEMO_MAIN_GROUP_ID,
          token_type: fixture.token_reward_type,
          earned_matchday: fixture.matchday,
          status: 'earned',
        });
      }
    }
  }

  // 8. Mark 1 token for current user as 'used'
  const { data: earnedTokens } = await adminSupabase
    .from('tokens')
    .select('id')
    .eq('user_id', currentUserId)
    .eq('group_id', DEMO_MAIN_GROUP_ID)
    .eq('status', 'earned')
    .limit(1);
  if (earnedTokens && earnedTokens.length > 0) {
    await adminSupabase.from('tokens').update({ status: 'used', used_matchday: 1 }).eq('id', earnedTokens[0].id);
  }

  // 9. Calculate group scores
  await calculateGroupScores(DEMO_MAIN_GROUP_ID);
}

// ── Quick draft group ─────────────────────────────────────────────────────────

async function seedQuickDraftGroup(currentUserId: string): Promise<void> {
  const fakeUserId = DEMO_FAKE_USERS[0].id;

  // 1. Upsert the group
  const { error: gErr } = await adminSupabase
    .from('groups')
    .upsert({
      id: DEMO_DRAFT_GROUP_ID,
      name: 'Quick Draft',
      creator_id: currentUserId,
      invite_code: 'DEMO02',
      max_members: 4,
      draft_status: 'in_progress',
      current_draft_round: 1,
      current_pick_number: 1,
      tokens_enabled: true,
      draft_order_mode: 'random',
      color: '#8B5CF6',
    }, { onConflict: 'id' });
  if (gErr) throw new Error(`Quick Draft group upsert failed: ${gErr.message}`);

  // 2. Upsert members
  await adminSupabase.from('group_members').upsert([
    { group_id: DEMO_DRAFT_GROUP_ID, user_id: currentUserId, draft_position: 1, total_points: 0 },
    { group_id: DEMO_DRAFT_GROUP_ID, user_id: fakeUserId,    draft_position: 2, total_points: 0 },
  ], { onConflict: 'group_id,user_id' });

  // 3. Clean existing picks
  await adminSupabase.from('draft_picks').delete().eq('group_id', DEMO_DRAFT_GROUP_ID);

  // 4. Pre-insert fake member's picks for even pick numbers (2, 4, 6, 8, 10, 12, 14)
  const { data: available } = await supabase
    .from('players')
    .select('id, team_name, position')
    .eq('is_available', true)
    .limit(200);

  const fakePicks: Array<{
    group_id: string;
    user_id: string;
    player_id: string;
    pick_number: number;
    draft_round: number;
  }> = [];
  const teamCount: Record<string, number> = {};
  let fakePickCount = 0;

  for (const player of (available ?? [])) {
    if (fakePickCount >= 7) break;
    const tc = teamCount[player.team_name] ?? 0;
    if (tc >= 2) continue;
    teamCount[player.team_name] = tc + 1;
    fakePicks.push({
      group_id: DEMO_DRAFT_GROUP_ID,
      user_id: fakeUserId,
      player_id: player.id,
      pick_number: (fakePickCount + 1) * 2,
      draft_round: 1,
    });
    fakePickCount++;
  }

  if (fakePicks.length > 0) {
    const { error: dpErr } = await adminSupabase.from('draft_picks').insert(fakePicks);
    if (dpErr) throw new Error(`Draft picks insert failed: ${dpErr.message}`);
  }
}
