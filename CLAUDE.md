# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FotDraft — a FIFA World Cup 2026 fantasy draft mobile app. Friends create draft groups, snake-draft national team players into 15-player squads (4-3-3 + 4 bench), and earn points based on FotMob match ratings (rating - 6.0 = points). WC 2026: 48 nations, 8 matchdays (Group Stage R1-3, R32, R16, QF, SF, Final). See `DESCRIPTION.md` for full product spec.

## Tech Stack

- **App:** React Native (Expo SDK 54) with TypeScript, Expo Router (file-based routing)
- **Auth:** Firebase Auth (JS SDK v12+)
- **Database:** Supabase (PostgreSQL) with Row Level Security
- **Push notifications:** Firebase Cloud Messaging via expo-notifications
- **Ads:** Google AdMob (not yet integrated)

## Commands

```bash
npm start          # Start Expo dev server
npm run android    # Start on Android
npm run ios        # Start on iOS
npm run web        # Start web version
npm run lint       # Run ESLint
npx tsc --noEmit   # Type check without emitting
```

## Architecture

### Routing (`app/`)
Expo Router file-based routing. Route files contain only UI and navigation logic — no business logic.
- `app/(tabs)/` — 5 main tabs: home, draft, my-team, standings, profile
- `app/(auth)/` — login, register (unauthenticated screens)
- `app/group/` — group CRUD (create, join, [id] detail)
- `app/draft/` — live draft board ([id])

### Source (`src/`)
All non-route code lives here. The `@/` path alias maps to `src/`.
- `src/lib/` — Supabase and Firebase client initialization
- `src/services/` — business logic and data layer (auth, player, group, draft). The player service is the abstraction layer where mock data will be swapped for real FotMob data.
- `src/types/models.ts` — domain types (Player, Group, Squad, Trade, etc.)
- `src/constants/` — Formation (4-3-3 slots), Scoring (baseline 6.0), theme colors
- `src/config/env.ts` — centralized environment variable access
- `src/hooks/` — custom React hooks
- `src/components/` — reusable UI components

### Database (`supabase/schema.sql`)
PostgreSQL schema with core tables: profiles, players, groups, group_members, squads, draft_picks, match_ratings, wc_matches, matchday_fixtures, predictions, tokens. The `match_ratings.points` column is auto-computed (generated column). The `is_mock` flag distinguishes prototype mock data from real FotMob data. Run `ALTER TABLE public.cl_matches RENAME TO wc_matches;` once in Supabase if migrating from CL version.

## Key Conventions

- Environment variables use the `EXPO_PUBLIC_` prefix (required by Expo for client-side access)
- Supabase client uses AsyncStorage for session persistence with `detectSessionInUrl: false` (critical for React Native)
- Managed workflow (CNG) — `ios/` and `android/` directories are generated, not committed
- Squad slots are named: GK, CB1, CB2, RB, LB, CM1-3, ST, W1-2, BENCH_GK/DEF/MID/ATT
