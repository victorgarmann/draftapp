-- Migration 001: Switch from Supabase Auth to Firebase Auth
-- Firebase UIDs are 28-char strings, not UUIDs. This migration changes
-- all user-ID columns from uuid (referencing auth.users) to text.

-- ============================================
-- 1. Drop the auto-create-profile trigger (fires on Supabase auth.users inserts)
-- ============================================
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- ============================================
-- 2. Drop existing RLS policies that reference auth.uid()
-- ============================================
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Authenticated users can create groups" on public.groups;
drop policy if exists "Group members can view group" on public.groups;
drop policy if exists "Group members can view fellow members" on public.group_members;
drop policy if exists "Players are viewable by authenticated users" on public.players;
drop policy if exists "Match ratings are viewable by authenticated users" on public.match_ratings;

-- ============================================
-- 3. Drop foreign keys that reference profiles(id)
-- ============================================
alter table public.trades drop constraint if exists trades_proposer_id_fkey;
alter table public.trades drop constraint if exists trades_recipient_id_fkey;
alter table public.draft_picks drop constraint if exists draft_picks_user_id_fkey;
alter table public.group_members drop constraint if exists group_members_user_id_fkey;
alter table public.groups drop constraint if exists groups_creator_id_fkey;

-- ============================================
-- 4. Drop profiles primary key (which references auth.users)
-- ============================================
alter table public.profiles drop constraint profiles_pkey;
alter table public.profiles alter column id drop default;

-- ============================================
-- 5. Change column types from uuid to text
-- ============================================
alter table public.profiles alter column id type text using id::text;
alter table public.groups alter column creator_id type text using creator_id::text;
alter table public.group_members alter column user_id type text using user_id::text;
alter table public.draft_picks alter column user_id type text using user_id::text;
alter table public.trades alter column proposer_id type text using proposer_id::text;
alter table public.trades alter column recipient_id type text using recipient_id::text;

-- ============================================
-- 6. Re-add primary key and foreign keys (now text-based)
-- ============================================
alter table public.profiles add primary key (id);
alter table public.groups
  add constraint groups_creator_id_fkey foreign key (creator_id) references public.profiles(id);
alter table public.group_members
  add constraint group_members_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.draft_picks
  add constraint draft_picks_user_id_fkey foreign key (user_id) references public.profiles(id);
alter table public.trades
  add constraint trades_proposer_id_fkey foreign key (proposer_id) references public.profiles(id);
alter table public.trades
  add constraint trades_recipient_id_fkey foreign key (recipient_id) references public.profiles(id);

-- ============================================
-- 7. Re-create RLS policies (prototype: open access, no auth.uid())
-- ============================================

-- Profiles: anyone can read, insert, and update (prototype)
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);
-- (this policy already exists from the original schema — skip if it errors)

create policy "Anyone can insert a profile" on public.profiles
  for insert with check (true);

create policy "Anyone can update a profile" on public.profiles
  for update using (true);

-- Players: readable by everyone (prototype)
create policy "Players are viewable by everyone" on public.players
  for select using (true);

-- Groups: readable and creatable by everyone (prototype)
create policy "Groups are viewable by everyone" on public.groups
  for select using (true);

create policy "Anyone can create groups" on public.groups
  for insert with check (true);

-- Group members: viewable by everyone (prototype)
create policy "Group members are viewable by everyone" on public.group_members
  for select using (true);

-- Match ratings: viewable by everyone (prototype)
create policy "Match ratings are viewable by everyone" on public.match_ratings
  for select using (true);
