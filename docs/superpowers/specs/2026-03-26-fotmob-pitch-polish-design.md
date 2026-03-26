# FotDraft — FotMob Pitch Polish Design

**Date:** 2026-03-26
**Goal:** Polish the app for a FotMob partnership pitch — live phone demo + slide deck, 3-week timeline.
**Scope:** No new features. Remove rough edges, tighten layout, prepare demo state.

---

## 1. Layout Consistency

### Spacing System (applied across all screens)
- Screen horizontal padding: 16px (already standard — enforce where missing)
- Between major sections: 20px
- Between cards within a section: 10px
- Card internal padding: 14px (GlassCard default)
- Section headers: 13px font, uppercase, T.textMuted color, 8px bottom margin

### Per-Screen Changes

**My Team**
- The Squad tab currently shows a deadline strip; the Tokens tab shows a separate deadline banner. Replace both with a single persistent header row rendered as a fixed `View` (scroll-pinned) — the first child of the screen's root View, before the tab bar and content area. Layout: deadline text on the left, token coins with count badges on the right. This row is always visible regardless of which tab is active or how far the user has scrolled.

**Fixtures — Predict tab**
- The current token guide is a single `GlassCard` (~fixtures.tsx lines 216–230) containing 3 `tokenGuideRow` entries built from `TOKEN_META`. Replace with a collapsible row. Collapsed default state: a single tappable text row reading "How tokens work ▾" styled in T.textSecondary. Tapping toggles a boolean to show/hide the 3 existing token type rows. Simple conditional render — no animation required.

**Group Detail — Creator Settings**
- Consolidate the color swatches, tokens toggle, and draft order toggle into a single `GlassCard` with a "Settings" section label. Each setting is a row: label on the left, control on the right. Preserve existing conditional: draft order toggle row only renders when `draftStatus === 'pending'`.

**Profile — Stats Grid**
- Reduce from 6 tiles to 4. The 4 tiles to keep: Total Points (`stats?.totalPoints`), Groups Played (`stats?.groupCount`, rename label from "Groups" to "Groups Played"), Prediction Accuracy (`stats?.winRate` percentage, rename label from "Win Rate" to "Prediction Accuracy"), Tokens Earned (`stats?.tokensEarned`). Remove the raw Predictions fraction tile and the Tokens Used tile.
- Update the `statTile` style (currently `minWidth: '28%'` at profile.tsx ~line 283) to `width: '48%'` to produce a 2×2 grid.

**Home, Draft tab, Standings, Draft Board**
- No changes needed.

---

## 2. Hide Incomplete / Dev-Facing Features

### Remove entirely from `profile.tsx`
The "Real CL Data" seeding block is a single JSX card plus supporting code. Remove all of the following together to avoid dangling imports and dead state:

- **Import** (line ~17): `import { seedAllRealData, isRealDataSeeded } from '@/services/real-data.service';`
- **State declarations** (lines ~32–33): `seeding`, `setSeedlog`, `realDataReady` state variables and their `useState` calls
- **Effect** (line ~41): `isRealDataSeeded().then(setRealDataReady)`
- **Handler** (lines ~43–59): `handleSeedRealData` function
- **JSX block** (lines ~181–217): the entire "Real CL Data" section card

After removal, run `npx tsc --noEmit` to confirm no compile errors.

### Remove notification calls
- In `app/_layout.tsx`: remove the `requestNotificationPermissions()` call (line ~31) and its import `import { requestNotificationPermissions } from '@/services/notification.service'` (line ~10).
- In `app/(tabs)/my-team.tsx`: remove the `scheduleDeadlineReminders(...)` call.

### Hide Second Draft button
- In `app/group/[id].tsx`: wrap only the `canStartRound2` branch (lines ~456–489) in `{false && (...)}`. The `canStartRound2` boolean variable declaration (line ~201) and the outer `fabWrap` conditional can remain unchanged — do not delete the variable or restructure the outer conditional.

### Trading UI
- No UI currently surfaces trading. No action required — confirmed.

---

## 3. FotMob Branding (Minimal)

Two touchpoints only:

- **Player Detail Sheet (`src/components/player-detail-sheet.tsx`):** Move the `fotmobCredit` text from its current position (bottom of the sheet, ~line 110) to directly below the stats View (~line 78, after avg/total rating row). Update the `fotmobCredit` stylesheet entry (~line 158) from `color: T.textMuted` to `color: T.textSecondary`.
- **My Team — Points tab (`app/(tabs)/my-team.tsx`):** Change the existing "Ratings powered by FotMob" credit text style at ~line 674 from `color: T.textMuted` to `color: T.textSecondary`. Update the stylesheet definition, not an inline override.

---

## 4. Demo Flow Preparation

### Seed Function Location
Create `src/services/demo.service.ts`. The Profile avatar long-press handler imports from this file. The function is named `seedDemoData`.

### Seed Function Access
Wrap the Profile screen avatar `View` in a `TouchableOpacity` with `onLongPress={() => handleDemoSeed()}` and `delayLongPress={3000}`. On trigger: `Alert.alert("Reset demo data?", "This will overwrite demo group data.", [{ text: "Cancel" }, { text: "Reset", onPress: seedDemoData }])`.

### RLS Handling for Fake Profiles
The `profiles` table has an RLS policy requiring `auth.uid() = id`. Directly inserting rows with hardcoded UUIDs from the presenter's authenticated session will be rejected.

**Solution:** The seed function must use the Supabase service-role key (not the anon key) to bypass RLS for fake profile creation. Add `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` to `.env` (not committed — add to `.gitignore` if not already). Add `serviceRoleKey: process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ?? ''` to `src/config/env.ts` alongside the existing env vars, and read it from there in `demo.service.ts` — consistent with how other env vars are accessed in the codebase. Create a second Supabase client inside `demo.service.ts` using this key. Use this admin client only for the seed function, never for user-facing calls.

### Seed Function — Idempotency
The function upserts (not inserts) all rows. Before re-seeding, delete existing `draft_picks`, `squads`, `match_ratings`, `predictions`, and `tokens` rows for the demo groups, then re-insert. This ensures a clean slate on repeated runs.

### Fake Profiles
3 rows inserted into `profiles` with fixed hardcoded UUIDs (e.g., `00000000-0000-0000-0000-000000000001` through `...0003`). Use the admin Supabase client. Display names: "Erik Hansen", "Sofia Berg", "Lucas Melo" (or similar realistic names). These profiles are never authenticated — display-only.

### Seeded State — "WC Fantasy 2026" Group
- 4 members: current authenticated user + 3 fake profiles
- `draft_status = 'completed'`, `current_draft_round = 1`
- Each member has a valid 15-player squad (GK×2, DEF×5, MID×5, ATT×3) with no national team cap violations
- 3 matchdays of ratings seeded using the existing `seedMockRatings` logic
- Standings have clear separation (~15–25pt gaps between members)
- Lineup snapshots must exist in the `squads` table for MD1–3. Call `ensureLineupSnapshots` (or equivalent) for each member for MD1, MD2, and MD3 so the Points tab shows a full breakdown per matchday.
- Predictions for MD1–3 per member with a mix of correct and wrong outcomes
- 1–2 tokens in `status = 'earned'` per member
- 1 token for the current user in `status = 'used'` so the Used badge state is visible in the Tokens tab

### Seeded State — "Quick Draft" Group
- 2 members: current user + 1 fake profile (`...0001`)
- `draft_status = 'pending'`
- The fake member is assigned pick position 2 (snake order). Their picks are pre-inserted into `draft_picks` for all even-numbered pick slots (2, 4, 6...). `current_pick_number` on the `groups` row is set to 1 so the live draft board opens with the presenter as the active picker on first load.
- The presenter plays their own picks live during the demo.

### Graceful Loading States
- All screens with data lists must retain their last-loaded state when a network request fails rather than resetting to empty. Ensure error paths set state to the previous valid value, not `[]` or `null`.
- Pull-to-refresh on failure: call `Alert.alert("Couldn't refresh", "Check your connection.")` and restore prior state. Consistent with existing error handling — no new toast library.
- Test all main screens on airplane mode before the meeting.

### Demo Walkthrough Document
Commit `docs/demo/walkthrough.md` with these sections:
1. **Pre-demo setup:** demo account credentials, steps to run `seedDemoData` (long-press avatar → confirm), how to verify seed completed (check groups appear on Home)
2. **Scripted flow (~2 minutes):**
   - Home: active group, standings, matchday countdown (5s)
   - Group Detail: members, invite code, draft status (10s)
   - My Team: formation field, Points tab with MD breakdown, Tokens tab with used token (15s)
   - Fixtures: predictions, Calendar view (10s)
   - Standings: leaderboard, tap member to see their squad (10s)
   - Navigate to "Quick Draft" group → start draft → show 4–5 picks (60s)
   - Home: return to show both groups side by side (10s)
3. **Error recovery:** what to do if a screen hangs, shows empty state, or the draft board fails to load mid-demo

---

## Out of Scope

- Auto-pick bot (real-time automated draft opponent)
- Trading UI
- Push notifications
- AdMob integration
- New features of any kind
- Real FotMob API integration (mock data is sufficient for the pitch)
- New caching or offline-sync architecture
