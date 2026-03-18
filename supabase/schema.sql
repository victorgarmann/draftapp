-- FotDraft Database Schema
-- Run this in the Supabase SQL editor to set up the database.
-- Uses Firebase Auth (not Supabase Auth) — profile IDs are Firebase UIDs (text, not uuid).

-- ── WC 2026 migration (run once in Supabase SQL editor) ──────────────────────
-- ALTER TABLE public.cl_matches RENAME TO wc_matches;
-- (RLS policies carry over automatically on rename in Postgres)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES
-- ============================================
create table public.profiles (
  id text primary key,  -- Firebase UID (e.g. "wi0p1HmJDugw3n7cYwEWrvdEwfo1")
  username text unique not null,
  display_name text,
  avatar_url text,
  fcm_token text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- PLAYERS (Champions League players)
-- ============================================
create table public.players (
  id uuid primary key default uuid_generate_v4(),
  fotmob_id text unique,
  name text not null,
  team_name text not null,
  team_fotmob_id text,
  position text not null
    check (position in ('GK', 'CB', 'RB', 'LB', 'CM', 'W', 'ST')),
  image_url text,
  is_available boolean default true not null,
  created_at timestamptz default now() not null
);

-- ============================================
-- GROUPS (draft groups)
-- ============================================
create table public.groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  creator_id text not null references public.profiles(id),
  invite_code text unique not null,
  max_members int not null default 8
    check (max_members between 2 and 20),
  draft_date timestamptz,
  draft_status text not null default 'pending'
    check (draft_status in ('pending', 'in_progress', 'completed')),
  draft_order_mode text not null default 'random'
    check (draft_order_mode in ('random', 'manual')),
  current_round int default 0,
  current_pick int default 0,
  current_draft_round int default 1 not null,  -- 1 = league phase, 2 = Round of 16, etc.
  trading_window_open boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- GROUP_MEMBERS (users in groups)
-- ============================================
create table public.group_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  draft_position int,
  total_points numeric(10,2) default 0 not null,
  joined_at timestamptz default now() not null,
  unique(group_id, user_id)
);

-- ============================================
-- SQUADS (15-player roster per user per group)
-- ============================================
create table public.squads (
  id uuid primary key default uuid_generate_v4(),
  group_member_id uuid not null references public.group_members(id) on delete cascade,
  player_id uuid not null references public.players(id),
  slot text not null
    check (slot in (
      'GK','CB1','CB2','RB','LB','CM1','CM2','CM3','ST','W1','W2',
      'BENCH_GK','BENCH_DEF','BENCH_MID','BENCH_ATT'
    )),
  is_starting boolean default false not null,
  acquired_via text not null default 'draft'
    check (acquired_via in ('draft', 'trade', 'supplementary_draft')),
  created_at timestamptz default now() not null,
  unique(group_member_id, player_id),
  unique(group_member_id, slot)
);

-- ============================================
-- DRAFT_PICKS (draft history)
-- ============================================
create table public.draft_picks (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id text not null references public.profiles(id),
  player_id uuid not null references public.players(id),
  round int not null,
  pick_number int not null,
  draft_round int not null default 1,  -- which draft cycle (1 = league phase, 2 = Round of 16)
  picked_at timestamptz default now() not null,
  unique(group_id, player_id, draft_round),  -- same player can be drafted in different rounds
  unique(group_id, pick_number, draft_round)
);

-- ============================================
-- MATCH_RATINGS (player performance per match)
-- ============================================
create table public.match_ratings (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid not null references public.players(id),
  matchday int not null,
  match_date date not null,
  opponent_team text,
  fotmob_rating numeric(3,1),
  points numeric(4,1) generated always as (
    case
      when fotmob_rating is not null then fotmob_rating - 6.0
      else 0
    end
  ) stored,
  minutes_played int default 0,
  did_not_play boolean default false,
  is_mock boolean default true not null,
  created_at timestamptz default now() not null,
  unique(player_id, matchday)
);

-- ============================================
-- TRADES (trade proposals)
-- ============================================
create table public.trades (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.groups(id) on delete cascade,
  proposer_id text not null references public.profiles(id),
  recipient_id text not null references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  proposer_player_ids uuid[] not null,
  recipient_player_ids uuid[] not null,
  proposed_at timestamptz default now() not null,
  resolved_at timestamptz,
  check (proposer_id != recipient_id)
);

-- ============================================
-- INDEXES
-- ============================================
create index idx_group_members_group on public.group_members(group_id);
create index idx_group_members_user on public.group_members(user_id);
create index idx_squads_group_member on public.squads(group_member_id);
create index idx_squads_player on public.squads(player_id);
create index idx_draft_picks_group on public.draft_picks(group_id);
create index idx_match_ratings_player on public.match_ratings(player_id);
create index idx_match_ratings_matchday on public.match_ratings(matchday);
create index idx_trades_group on public.trades(group_id);
create index idx_trades_status on public.trades(status);
create index idx_groups_invite_code on public.groups(invite_code);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.squads enable row level security;
alter table public.draft_picks enable row level security;
alter table public.match_ratings enable row level security;
alter table public.trades enable row level security;

-- Profiles: viewable by everyone, open insert (Firebase manages auth — no Supabase session)
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);
create policy "Anyone can insert a profile" on public.profiles
  for insert with check (true);
create policy "Anyone can update a profile" on public.profiles
  for update using (true);

-- Players: readable by all, writable by all (reference data managed by the app)
create policy "Players are viewable by everyone" on public.players
  for select using (true);
create policy "Anyone can insert players" on public.players
  for insert with check (true);
create policy "Anyone can update players" on public.players
  for update using (true);
create policy "Anyone can delete players" on public.players
  for delete using (true);

-- Groups: viewable by members, creatable by anyone (Firebase auth enforced app-side)
create policy "Group members can view group" on public.groups
  for select using (true);
create policy "Anyone can create groups" on public.groups
  for insert with check (true);
create policy "Anyone can update groups" on public.groups
  for update using (true);

-- Group members: viewable by all, insertable by all
create policy "Anyone can view group members" on public.group_members
  for select using (true);
create policy "Anyone can join groups" on public.group_members
  for insert with check (true);

-- Squads
create policy "Anyone can view squads" on public.squads
  for select using (true);
create policy "Anyone can manage squads" on public.squads
  for all using (true);

-- Draft picks
create policy "Anyone can view draft picks" on public.draft_picks
  for select using (true);
create policy "Anyone can insert draft picks" on public.draft_picks
  for insert with check (true);

-- Match ratings: readable by all
create policy "Match ratings are viewable by everyone" on public.match_ratings
  for select using (true);

-- Trades
create policy "Anyone can view trades" on public.trades
  for select using (true);
create policy "Anyone can manage trades" on public.trades
  for all using (true);

-- ============================================
-- TRIGGERS
-- ============================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger on_group_updated
  before update on public.groups
  for each row execute function public.handle_updated_at();

-- ============================================
-- MIGRATIONS (run in Supabase SQL editor)
-- ============================================

-- Round of 16 / second draft support (added after initial schema)
-- alter table public.groups
--   add column if not exists current_draft_round int default 1 not null;

-- alter table public.draft_picks
--   add column if not exists draft_round int default 1 not null;

-- Drop old unique constraints that don't include draft_round, then recreate:
-- alter table public.draft_picks drop constraint if exists draft_picks_group_id_player_id_key;
-- alter table public.draft_picks drop constraint if exists draft_picks_group_id_pick_number_key;
-- alter table public.draft_picks
--   add constraint draft_picks_group_player_round_key unique (group_id, player_id, draft_round);
-- alter table public.draft_picks
--   add constraint draft_picks_group_pick_round_key unique (group_id, pick_number, draft_round);

-- Lineup snapshots — locks in each user's starting XI per matchday so
-- historical scores aren't affected by later lineup changes.
-- Run in Supabase SQL editor:
--
-- create table if not exists public.lineup_snapshots (
--   id uuid primary key default uuid_generate_v4(),
--   group_member_id uuid not null references public.group_members(id) on delete cascade,
--   matchday int not null,
--   starting_player_ids uuid[] not null,
--   created_at timestamptz default now() not null,
--   unique(group_member_id, matchday)
-- );
-- alter table public.lineup_snapshots enable row level security;
-- create policy "Anyone can read lineup snapshots"
--   on public.lineup_snapshots for select using (true);
-- create policy "Anyone can insert lineup snapshots"
--   on public.lineup_snapshots for insert with check (true);
