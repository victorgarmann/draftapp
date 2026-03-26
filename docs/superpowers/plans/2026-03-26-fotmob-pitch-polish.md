# FotMob Pitch Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish FotDraft for a FotMob partnership pitch — remove dev-facing features, tighten layout, add FotMob attribution, and create a demo seed function.

**Architecture:** Purely additive to existing patterns. No new libraries. One new service file (`demo.service.ts`). All UI changes follow the established GlassCard + Fredoka + T theme constants pattern. The demo seed function uses a second Supabase client with the service-role key to bypass RLS for fake profile insertion.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, Supabase (PostgreSQL), Firebase Auth, `@supabase/supabase-js`

---

## File Map

| File | Action | What Changes |
|------|--------|--------------|
| `app/_layout.tsx` | Modify | Remove `requestNotificationPermissions` call + import |
| `app/(tabs)/profile.tsx` | Modify | Remove seed block + dead state/handlers; reduce stats to 4 tiles in 2×2; wrap avatar in TouchableOpacity with long-press |
| `app/(tabs)/my-team.tsx` | Modify | Combine deadline strip + token tray into scroll-pinned header row; remove `scheduleDeadlineReminders` call; FotMob credit color |
| `app/(tabs)/fixtures.tsx` | Modify | Replace 3-row token guide with collapsible row |
| `app/group/[id].tsx` | Modify | Hide `canStartRound2` JSX branch; consolidate creator settings into single GlassCard |
| `src/components/player-detail-sheet.tsx` | Modify | Move FotMob credit text position + color |
| `src/config/env.ts` | Modify | Add `serviceRoleKey` field |
| `src/services/demo.service.ts` | Create | `seedDemoData()` — seeds two demo groups with realistic state |
| `docs/demo/walkthrough.md` | Create | Presenter reference document |

---

## Task 1: Remove Notification Calls and Hide Second Draft Button

These are two-line changes with no dependencies. Do them together, verify with TypeScript.

**Files:**
- Modify: `app/_layout.tsx:10,30-34`
- Modify: `app/(tabs)/my-team.tsx:40,134-140`
- Modify: `app/group/[id].tsx:456-489`

- [ ] **Step 1: Remove `requestNotificationPermissions` from `_layout.tsx`**

  Delete line 10 (the import):
  ```typescript
  // DELETE THIS LINE:
  import { requestNotificationPermissions } from '@/services/notification.service';
  ```

  Delete lines 30–34 (the useEffect that calls it):
  ```typescript
  // DELETE THESE LINES:
  useEffect(() => {
    if (!isLoading && user) {
      requestNotificationPermissions();
    }
  }, [isLoading, user]);
  ```

- [ ] **Step 2: Remove `scheduleDeadlineReminders` from `my-team.tsx`**

  Delete line 40 (the import):
  ```typescript
  // DELETE THIS LINE:
  import { scheduleDeadlineReminders } from '@/services/notification.service';
  ```

  Delete lines 134–140 (the useEffect that calls it):
  ```typescript
  // DELETE THESE LINES:
  useEffect(() => {
    if (!selectedGroup) return;
    const next = getNextMatchday();
    if (next) {
      scheduleDeadlineReminders(next.deadline, next.label);
    }
  }, [selectedGroup?.id]);
  ```

- [ ] **Step 3: Hide the Second Draft button in `group/[id].tsx`**

  Wrap the `canStartRound2` branch (lines 456–489) only. The outer `fabWrap` conditional and the `canStartRound2` variable declaration stay untouched.

  Change:
  ```tsx
  {canStartRound2 && (
    <TouchableOpacity
      style={[s.fab, { backgroundColor: accent, shadowColor: accent }, starting && s.fabDisabled]}
      // ... rest of button
    >
  ```
  To:
  ```tsx
  {false && canStartRound2 && (
    <TouchableOpacity
      style={[s.fab, { backgroundColor: accent, shadowColor: accent }, starting && s.fabDisabled]}
      // ... rest of button
    >
  ```

- [ ] **Step 4: Type-check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: 0 errors.

- [ ] **Step 5: Commit**

  ```bash
  git add app/_layout.tsx app/(tabs)/my-team.tsx app/group/[id].tsx
  git commit -m "chore: remove notification calls and hide second draft button for pitch demo"
  ```

---

## Task 2: Remove Seed Block from Profile and Clean Up Dead Code

Removes all football-data.org / "Real CL Data" code from `profile.tsx`.

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Remove the import on line 16**

  ```typescript
  // DELETE:
  import { seedAllRealData, isRealDataSeeded } from '@/services/real-data.service';
  ```

- [ ] **Step 2: Remove state declarations on lines 31–33**

  ```typescript
  // DELETE these 3 lines:
  const [seeding,       setSeeding]       = useState(false);
  const [seedLog,       setSeedLog]       = useState<string[]>([]);
  const [realDataReady, setRealDataReady] = useState<boolean | null>(null);
  ```

- [ ] **Step 3: Remove the `isRealDataSeeded` call from the useEffect on line 40**

  Change:
  ```typescript
  useEffect(() => {
    if (!user) return;
    getProfileStats(user.uid)
      .then(setStats)
      .finally(() => setStatsLoading(false));
    isRealDataSeeded().then(setRealDataReady);  // DELETE THIS LINE
  }, [user]);
  ```
  To:
  ```typescript
  useEffect(() => {
    if (!user) return;
    getProfileStats(user.uid)
      .then(setStats)
      .finally(() => setStatsLoading(false));
  }, [user]);
  ```

- [ ] **Step 4: Remove the `handleSeedRealData` function (lines 43–59)**

  Delete the entire function:
  ```typescript
  // DELETE:
  async function handleSeedRealData() {
    // ... entire function body
  }
  ```

- [ ] **Step 5: Remove the "Real CL Data" JSX card (lines 181–217)**

  Delete from `{/* CL Data seeding */}` comment through `</GlassCard>` (the seedCard), including the section label. Keep everything above (Account card) and below (Sign out button) untouched.

- [ ] **Step 6: Remove now-unused stylesheet entries**

  In the `StyleSheet.create({})` at the bottom of `profile.tsx`, delete these keys: `seedCard`, `seedStatus`, `seedDot`, `seedStatusText`, `seedHint`, `seedBtn`, `seedBtnDisabled`, `seedBtnText`, `seedLog`, `seedLogLine`.

- [ ] **Step 7: Type-check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: 0 errors. If `env` import becomes unused, remove it too (line 17: `import env from '@/config/env'`).

- [ ] **Step 8: Commit**

  ```bash
  git add app/(tabs)/profile.tsx
  git commit -m "chore: remove seed real data section from profile for pitch demo"
  ```

---

## Task 3: Profile Stats Grid — 4 Tiles in 2×2 Layout

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Remove the 2 StatTile calls to be deleted**

  In the stats grid JSX (lines 110–137), remove:
  - The "Predictions" tile (the `${stats?.predictionsCorrect}/${stats?.predictionsTotal}` one with `sub="correct"`)
  - The "Tokens Used" tile

  Result — 4 remaining tiles:
  ```tsx
  <View style={styles.statsGrid}>
    <StatTile
      label="Total Points"
      value={statsLoading ? '…' : String(stats?.totalPoints ?? 0)}
      accent
    />
    <StatTile
      label="Groups Played"
      value={statsLoading ? '…' : String(stats?.groupCount ?? 0)}
    />
    <StatTile
      label="Prediction Accuracy"
      value={statsLoading ? '…' : winRate !== null ? `${winRate}%` : '—'}
    />
    <StatTile
      label="Tokens Earned"
      value={statsLoading ? '…' : String(stats?.tokensEarned ?? 0)}
    />
  </View>
  ```

- [ ] **Step 2: Update statTile style for 2×2 layout**

  In `StyleSheet.create`, find `statTile` (~line 282). Change `minWidth: '28%'` to `width: '48%'`:
  ```typescript
  statTile: {
    flex: 1, width: '48%',   // was: flex: 1, minWidth: '28%'
    backgroundColor: T.surface, borderRadius: R.card,
    // ... rest unchanged
  },
  ```

- [ ] **Step 3: Verify visually**

  Run `npm run android` (or iOS), navigate to Profile. Confirm the grid shows 2 rows of 2 tiles with no orphaned tile.

- [ ] **Step 4: Commit**

  ```bash
  git add app/(tabs)/profile.tsx
  git commit -m "feat: reduce profile stats to 4 tiles in 2x2 grid for pitch demo"
  ```

---

## Task 4: FotMob Branding — Credit Text Repositioning and Color

**Files:**
- Modify: `src/components/player-detail-sheet.tsx`
- Modify: `app/(tabs)/my-team.tsx`

- [ ] **Step 1: Move `fotmobCredit` in player-detail-sheet.tsx**

  Currently the credit text is inside the `ScrollView` at the bottom (line 110):
  ```tsx
  <ScrollView style={s.ratingList} showsVerticalScrollIndicator={false}>
    {MATCHDAY_SCHEDULE.filter(...).map(...)}
    <Text style={s.fotmobCredit}>Ratings powered by FotMob</Text>  {/* REMOVE from here */}
  </ScrollView>
  ```

  Move it to directly after the closing `</View>` of the `stats` section (after line 78), before the `sectionLabel`:
  ```tsx
  </View>  {/* closes s.stats */}

  <Text style={s.fotmobCredit}>Ratings powered by FotMob</Text>  {/* ADD HERE */}

  {/* Rating history */}
  <Text style={s.sectionLabel}>MATCHDAY HISTORY</Text>
  ```

- [ ] **Step 2: Update `fotmobCredit` stylesheet entry in player-detail-sheet.tsx (line 158)**

  Change `color: T.textMuted` to `color: T.textSecondary`:
  ```typescript
  fotmobCredit: { fontSize: 10, fontFamily: 'Fredoka_500Medium', color: T.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 8 },
  ```

- [ ] **Step 3: Update `fotmobCredit` stylesheet entry in my-team.tsx (line 1221)**

  Change `color: T.textMuted` to `color: T.textSecondary`:
  ```typescript
  fotmobCredit: { fontSize: 10, fontFamily: 'Fredoka_400Regular', color: T.textSecondary, textAlign: 'center', marginTop: 16, marginBottom: 4 },
  ```

- [ ] **Step 4: Type-check and commit**

  ```bash
  npx tsc --noEmit
  git add src/components/player-detail-sheet.tsx app/(tabs)/my-team.tsx
  git commit -m "feat: reposition and highlight FotMob credit text for pitch demo"
  ```

---

## Task 5: My Team — Scroll-Pinned Combined Header Row

Replace the per-tab deadline strip and token tray with a single fixed row visible on all tabs.

**Files:**
- Modify: `app/(tabs)/my-team.tsx`

- [ ] **Step 1: Understand current structure**

  The render method currently (starting ~line 340) is structured as:
  ```
  <View ref={containerRef}>
    <GradientScreen>
      <ScrollView>
        <TouchableOpacity>  {/* group picker */}
        <View>  {/* deadline strip — rendered here inside ScrollView */}
        <View style={styles.tokenTray}>  {/* token tray — also inside ScrollView */}
        <View style={styles.tabBar}>
        {/* tab content */}
      </ScrollView>
    </GradientScreen>
  </View>
  ```

  Goal: Extract deadline + token tray OUT of the ScrollView into a fixed View between the GradientScreen and ScrollView.

- [ ] **Step 2: Remove deadline strip and token tray from inside the ScrollView**

  Delete the deadline strip block (lines 361–384) and the token tray block (lines 386–405) from their current location inside the `<ScrollView>`.

- [ ] **Step 3: Add the combined header row between GradientScreen and ScrollView**

  Insert this between `<GradientScreen>` and `<ScrollView ...>`:

  ```tsx
  {/* Combined deadline + token header — scroll-pinned */}
  {(() => {
    const next = getNextMatchday();
    const locked = isLineupLocked();
    const diffMs = next ? new Date(next.deadline).getTime() - Date.now() : 0;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const deadlineText = !next
      ? 'Season complete'
      : locked
        ? `MD${next.matchday} in progress — lineup locked`
        : hours < 24
          ? `Deadline in ${hours}h — save your lineup!`
          : `MD${next.matchday} deadline: ${new Date(next.deadline).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;

    return (
      <View style={styles.pinnedHeader}>
        <View style={styles.pinnedDeadline}>
          <Ionicons
            name={locked ? 'lock-closed' : hours < 24 ? 'warning-outline' : 'time-outline'}
            size={12}
            color={locked ? T.success : hours < 24 ? T.warning : T.accent}
          />
          <Text style={styles.pinnedDeadlineText} numberOfLines={1}>{deadlineText}</Text>
        </View>
        <View style={styles.pinnedTokens}>
          {(['nullify', 'double_points', 'bench_boost'] as TokenType[]).map((type) => {
            const available = tokens.filter((t) => t.tokenType === type && t.usedMatchday === null).length;
            return (
              <TouchableOpacity key={type} onPress={() => setActiveTab('tokens')} activeOpacity={0.8}>
                <TokenCoin type={type} size={32} count={available} dimmed={available === 0} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  })()}
  ```

- [ ] **Step 4: Add pinnedHeader styles to StyleSheet**

  Add to the `StyleSheet.create({})`:
  ```typescript
  pinnedHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: T.glassBorder,
    backgroundColor: T.bgGradientStart,
  },
  pinnedDeadline: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  pinnedDeadlineText: { fontSize: 12, fontFamily: 'Fredoka_500Medium', color: T.textSecondary, flexShrink: 1 },
  pinnedTokens: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ```

- [ ] **Step 5: Remove the now-unused `deadlineStrip`, `deadlineStripLocked`, `deadlineStripText`, `tokenTray`, `tokenTrayItem`, `tokenTrayLabel`, `tokenTrayLabelEmpty` stylesheet entries**

  (These were only used by the blocks removed in Step 2.)

- [ ] **Step 6: Also remove the Tokens tab's separate `deadlineBanner` if it duplicates the pinned header info**

  In the `TokensTab` component, the `deadlineBanner` block (roughly lines 730–760) shows deadline info for using tokens. This is separate from the pinned header and serves a different purpose (it tells you whether the token window is OPEN for use). Keep it — it's different content.

- [ ] **Step 7: Type-check and smoke test**

  ```bash
  npx tsc --noEmit
  ```

  On device: switch between Squad / Points / Tokens tabs and confirm the pinned header stays visible at all times. Confirm token coin taps navigate to Tokens tab.

- [ ] **Step 8: Commit**

  ```bash
  git add app/(tabs)/my-team.tsx
  git commit -m "feat: combine deadline and token tray into scroll-pinned header on My Team"
  ```

---

## Task 6: Fixtures — Collapsible Token Guide

**Files:**
- Modify: `app/(tabs)/fixtures.tsx`

- [ ] **Step 1: Add `tokenGuideOpen` state to the `PredictTab` component**

  Find the `PredictTab` function signature and add state:
  ```typescript
  const [tokenGuideOpen, setTokenGuideOpen] = useState(false);
  ```

- [ ] **Step 2: Replace the token guide block (~lines 215–230)**

  Replace:
  ```tsx
  {/* Token guide */}
  <Text style={s.sectionLabel}>HOW TOKENS WORK</Text>
  <GlassCard style={s.tokenGuide}>
    {(Object.keys(TOKEN_META) as TokenType[]).map((type) => {
      const meta = TOKEN_META[type];
      return (
        <View key={type} style={s.tokenGuideRow}>
          <TokenCoin type={type} size={52} />
          <View style={s.tokenGuideText}>
            <Text style={[s.tokenGuideLabel, { color: meta.color }]}>{meta.label}</Text>
            <Text style={s.tokenGuideDesc}>{meta.description}</Text>
          </View>
        </View>
      );
    })}
  </GlassCard>
  ```

  With:
  ```tsx
  {/* Token guide — collapsible */}
  <TouchableOpacity style={s.tokenGuideToggle} onPress={() => setTokenGuideOpen((v) => !v)} activeOpacity={0.7}>
    <Text style={s.tokenGuideToggleText}>How tokens work {tokenGuideOpen ? '▴' : '▾'}</Text>
  </TouchableOpacity>
  {tokenGuideOpen && (
    <GlassCard style={s.tokenGuide}>
      {(Object.keys(TOKEN_META) as TokenType[]).map((type) => {
        const meta = TOKEN_META[type];
        return (
          <View key={type} style={s.tokenGuideRow}>
            <TokenCoin type={type} size={52} />
            <View style={s.tokenGuideText}>
              <Text style={[s.tokenGuideLabel, { color: meta.color }]}>{meta.label}</Text>
              <Text style={s.tokenGuideDesc}>{meta.description}</Text>
            </View>
          </View>
        );
      })}
    </GlassCard>
  )}
  ```

- [ ] **Step 3: Add toggle styles to the stylesheet**

  ```typescript
  tokenGuideToggle: {
    marginHorizontal: 16, marginBottom: 10, paddingVertical: 6,
  },
  tokenGuideToggleText: {
    fontSize: 13, fontFamily: 'Fredoka_500Medium', color: T.textSecondary,
  },
  ```

- [ ] **Step 4: Remove the `sectionLabel` "HOW TOKENS WORK" text node** (it was above the old GlassCard — it's now replaced by the toggle row).

- [ ] **Step 5: Type-check and smoke test**

  On device: Fixtures → Predict tab. Confirm token guide is collapsed by default. Tap to expand — rows appear. Tap again — rows hide.

- [ ] **Step 6: Commit**

  ```bash
  git add app/(tabs)/fixtures.tsx
  git commit -m "feat: make token guide collapsible on Fixtures predict tab"
  ```

---

## Task 7: Group Detail — Consolidate Creator Settings

**Files:**
- Modify: `app/group/[id].tsx`

- [ ] **Step 1: Locate the creator settings block (~lines 370–430)**

  The current structure is a `GlassCard` (s.settingsCard) with:
  - A `<Text style={s.settingsLabel}>Color</Text>` label
  - A `<View style={s.colorRow}>` with 8 swatch `TouchableOpacity` elements
  - A divider
  - A Tokens row with a custom toggle
  - Conditional divider + draft order row (only when `draftStatus === 'pending'`)
  - Conditional divider + Schedule Draft row (only when `draftStatus === 'pending'`)

  This structure is already close to the spec's "row layout" requirement. The main change is removing the separate `<Text style={s.settingsLabel}>Color</Text>` label that floats above the row, and converting the color swatch row to match the standard row format (label left, control right).

- [ ] **Step 2: Convert the color section to row format**

  Change this:
  ```tsx
  <Text style={s.settingsLabel}>Color</Text>
  <View style={s.colorRow}>
    {GROUP_COLORS.map((c) => (
      <TouchableOpacity key={c} style={[s.colorSwatch, ...]} onPress={...} />
    ))}
  </View>
  ```

  To a standard settingsRow with inline swatch strip:
  ```tsx
  <View style={s.settingsRow}>
    <Text style={s.settingsRowLabel}>Color</Text>
    <View style={s.colorRowInline}>
      {GROUP_COLORS.map((c) => (
        <TouchableOpacity
          key={c}
          style={[s.colorSwatchSmall, { backgroundColor: c }, group.color === c && s.colorSwatchActive]}
          onPress={() => handleColorChange(c)}
        />
      ))}
    </View>
  </View>
  ```

- [ ] **Step 3: Add `colorRowInline` and `colorSwatchSmall` styles**

  ```typescript
  colorRowInline: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  colorSwatchSmall: { width: 18, height: 18, borderRadius: 9 },
  ```

  Keep the existing `colorSwatchActive` style (it adds a white border for the selected state).

- [ ] **Step 4: Remove the now-redundant `settingsLabel` style** (the free-floating "Color" label above the card) if it is no longer used anywhere else.

- [ ] **Step 5: Type-check and verify**

  On device: Group Detail → confirm settings card shows Color row (label left, small swatches right), Tokens toggle, and (when draft pending) Draft Order toggle. Tapping swatches still updates the color.

- [ ] **Step 6: Commit**

  ```bash
  git add app/group/[id].tsx
  git commit -m "feat: consolidate group creator settings into standard row layout"
  ```

---

## Task 8: Add Service Role Key to env.ts

**Files:**
- Modify: `src/config/env.ts`

- [ ] **Step 1: Add `serviceRoleKey` to the `supabase` block**

  ```typescript
  const env = {
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      serviceRoleKey: process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ?? '',  // ADD
    },
    // ... rest unchanged
  };
  ```

- [ ] **Step 2: Add the key to `.env`**

  Add this line to your `.env` file (never commit this file):
  ```
  EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
  ```

  Find the service role key in Supabase Dashboard → Project Settings → API → `service_role` key (the secret one, not the anon key).

- [ ] **Step 3: Confirm `.env` is in `.gitignore`**

  ```bash
  grep ".env" .gitignore
  ```
  Expected: `.env` is listed.

- [ ] **Step 4: Type-check and commit env.ts only (not .env)**

  ```bash
  npx tsc --noEmit
  git add src/config/env.ts
  git commit -m "chore: add Supabase service role key slot to env config"
  ```

---

## Task 9: Create `demo.service.ts` — Scaffold and Admin Client

**Files:**
- Create: `src/services/demo.service.ts`

- [ ] **Step 1: Create the file with the admin client**

  ```typescript
  // src/services/demo.service.ts
  // Demo data seeding — for FotMob pitch only. Not user-facing.

  import { createClient } from '@supabase/supabase-js';
  import env from '@/config/env';
  import { supabase } from '@/lib/supabase';
  import { MATCHDAY_SCHEDULE } from '@/services/rating.service';

  // Admin client bypasses RLS — used ONLY for fake profile creation
  const adminSupabase = createClient(env.supabase.url, env.supabase.serviceRoleKey);

  // Fixed UUIDs for fake demo profiles — never change these
  export const DEMO_FAKE_USERS = [
    { id: '00000000-0000-0000-0000-000000000001', username: 'ErikHansen',  display_name: 'Erik Hansen' },
    { id: '00000000-0000-0000-0000-000000000002', username: 'SofiaBerg',   display_name: 'Sofia Berg'  },
    { id: '00000000-0000-0000-0000-000000000003', username: 'LucasMelo',   display_name: 'Lucas Melo'  },
  ];

  export const DEMO_GROUP_NAME   = 'WC Fantasy 2026';
  export const DEMO_DRAFT_NAME   = 'Quick Draft';

  // Slot names for a 15-player squad: 2 GK, 5 DEF, 5 MID, 3 ATT
  const SQUAD_SLOTS = [
    'GK1', 'GK2',
    'DEF1', 'DEF2', 'DEF3', 'DEF4', 'DEF5',
    'MID1', 'MID2', 'MID3', 'MID4', 'MID5',
    'ATT1', 'ATT2', 'ATT3',
  ];

  // Starting slots for lineup snapshot (11 starters)
  const STARTING_SLOTS = new Set([
    'GK1', 'DEF1', 'DEF2', 'DEF3', 'DEF4', 'MID1', 'MID2', 'MID3', 'ATT1', 'ATT2', 'ATT3',
  ]);

  export async function seedDemoData(currentUserId: string): Promise<void> {
    await seedFakeProfiles();
    await seedMainGroup(currentUserId);
    await seedQuickDraftGroup(currentUserId);
  }
  ```

- [ ] **Step 2: Add the `seedFakeProfiles` helper**

  ```typescript
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
  ```

- [ ] **Step 3: Type-check the scaffold**

  ```bash
  npx tsc --noEmit
  ```
  Expected: 0 errors (some functions called but not yet defined — those will be added in Task 10).

- [ ] **Step 4: Commit the scaffold**

  ```bash
  git add src/services/demo.service.ts src/config/env.ts
  git commit -m "feat: add demo.service.ts scaffold with admin Supabase client"
  ```

---

## Task 10: Seed "WC Fantasy 2026" Group

Continue building `demo.service.ts` — implement `seedMainGroup`.

**Files:**
- Modify: `src/services/demo.service.ts`

- [ ] **Step 1: Add player-fetching helper**

  This helper fetches available players grouped by position slot type. Each user needs 2 GK, 5 DEF, 5 MID, 3 ATT — all from different national teams where possible (team cap: max 2 from same nation per user).

  ```typescript
  type PositionGroup = 'GK' | 'DEF' | 'MID' | 'ATT';

  interface SeedPlayer {
    id: string;
    teamName: string;
    position: string;
  }

  async function fetchPlayersByGroup(): Promise<Record<PositionGroup, SeedPlayer[]>> {
    const { data, error } = await supabase
      .from('players')
      .select('id, team_name, position')
      .eq('is_available', true)
      .limit(1000);
    if (error) throw error;

    const gk  = data.filter((p) => p.position === 'GK');
    const def = data.filter((p) => ['CB', 'RB', 'LB'].includes(p.position));
    const mid = data.filter((p) => p.position === 'CM');
    const att = data.filter((p) => ['W', 'ST'].includes(p.position));

    return { GK: gk, DEF: def, MID: mid, ATT: att };
  }
  ```

- [ ] **Step 2: Add squad assignment helper**

  Assigns 15 players to one user, respecting the max-2-per-team cap. Shuffles differently per user using a seed offset.

  ```typescript
  function assignSquad(
    players: Record<PositionGroup, SeedPlayer[]>,
    alreadyDrafted: Set<string>,
    userIndex: number,
  ): Array<{ playerId: string; slotName: string; teamName: string }> {
    // Deterministic shuffle seeded by userIndex
    function shuffle<T>(arr: T[], seed: number): T[] {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = (seed * 1234567 + i * 9876543) % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    const teamCount: Record<string, number> = {};
    const result: Array<{ playerId: string; slotName: string; teamName: string }> = [];

    const needs: Array<{ group: PositionGroup; count: number; slots: string[] }> = [
      { group: 'GK',  count: 2, slots: ['GK1', 'GK2'] },
      { group: 'DEF', count: 5, slots: ['DEF1', 'DEF2', 'DEF3', 'DEF4', 'DEF5'] },
      { group: 'MID', count: 5, slots: ['MID1', 'MID2', 'MID3', 'MID4', 'MID5'] },
      { group: 'ATT', count: 3, slots: ['ATT1', 'ATT2', 'ATT3'] },
    ];

    for (const { group, slots } of needs) {
      const pool = shuffle(players[group], userIndex * 17 + group.charCodeAt(0))
        .filter((p) => !alreadyDrafted.has(p.id));
      let added = 0;
      for (const p of pool) {
        if (added >= slots.length) break;
        const teamCount_ = teamCount[p.teamName] ?? 0;
        if (teamCount_ >= 2) continue;
        teamCount[p.teamName] = teamCount_ + 1;
        alreadyDrafted.add(p.id);
        result.push({ playerId: p.id, slotName: slots[added], teamName: p.teamName });
        added++;
      }
      if (added < slots.length) throw new Error(`Not enough ${group} players available`);
    }

    return result;
  }
  ```

- [ ] **Step 3: Add `seedMainGroup` function**

  ```typescript
  async function seedMainGroup(currentUserId: string): Promise<void> {
    // 1. Upsert the group
    const groupId = '00000000-demo-0000-0000-000000000001';
    const { error: gErr } = await adminSupabase
      .from('groups')
      .upsert({
        id: groupId,
        name: DEMO_GROUP_NAME,
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

    // 2. Clean up existing data for this group
    for (const table of ['draft_picks', 'match_ratings', 'predictions', 'tokens'] as const) {
      // match_ratings is per player, not per group — skip
    }
    await adminSupabase.from('draft_picks').delete().eq('group_id', groupId);
    await adminSupabase.from('tokens').delete().eq('group_id', groupId);
    await adminSupabase.from('predictions').delete().eq('group_id', groupId);
    // squads: delete by user+group combo
    const allMemberIds = [currentUserId, ...DEMO_FAKE_USERS.map((u) => u.id)];
    for (const uid of allMemberIds) {
      await adminSupabase.from('squads').delete().eq('group_id', groupId).eq('user_id', uid);
    }

    // 3. Upsert group members
    const memberRows = [
      { group_id: groupId, user_id: currentUserId, draft_position: 1, total_points: 0 },
      ...DEMO_FAKE_USERS.map((u, i) => ({ group_id: groupId, user_id: u.id, draft_position: i + 2, total_points: 0 })),
    ];
    const { error: mErr } = await adminSupabase
      .from('group_members')
      .upsert(memberRows, { onConflict: 'group_id,user_id' });
    if (mErr) throw new Error(`Members upsert failed: ${mErr.message}`);

    // 4. Assign and insert squads
    const players = await fetchPlayersByGroup();
    const alreadyDrafted = new Set<string>();
    const allSquads: Array<{ user_id: string; squad: ReturnType<typeof assignSquad> }> = [];

    for (let i = 0; i < allMemberIds.length; i++) {
      const squad = assignSquad(players, alreadyDrafted, i);
      allSquads.push({ user_id: allMemberIds[i], squad });

      const squadRows = squad.map((p) => ({
        group_id: groupId,
        user_id: allMemberIds[i],
        player_id: p.playerId,
        slot_name: p.slotName,
        is_starting: STARTING_SLOTS.has(p.slotName),
        acquired_via: 'draft',
      }));
      const { error: sErr } = await adminSupabase.from('squads').insert(squadRows);
      if (sErr) throw new Error(`Squad insert failed for user ${i}: ${sErr.message}`);
    }

    // 5. Seed mock ratings for MD1–3 (call existing seedMockRatings — it seeds all past MDs)
    // seedMockRatings uses the anon client and is already idempotent
    const { seedMockRatings } = await import('@/services/rating.service');
    await seedMockRatings();

    // 6. Seed lineup snapshots for MD1–3 — insert squads rows with matchday_snapshot set
    // The ensureLineupSnapshots function in draft.service.ts handles this.
    // Call it for each user for each past matchday.
    const { ensureLineupSnapshots } = await import('@/services/draft.service');
    const pastMds = MATCHDAY_SCHEDULE.filter((md) => new Date(md.date) < new Date()).slice(0, 3);
    for (const uid of allMemberIds) {
      for (const md of pastMds) {
        await ensureLineupSnapshots(groupId, uid, md.matchday);
      }
    }

    // 7. Seed predictions for MD1–3
    const fixtures = await supabase.from('matchday_fixtures').select('id, matchday, token_reward_type').in('matchday', [1, 2, 3]);
    for (const uid of allMemberIds) {
      for (const fixture of fixtures.data ?? []) {
        const correct = Math.random() > 0.6;  // ~40% correct rate
        await adminSupabase.from('predictions').upsert({
          user_id: uid,
          group_id: groupId,
          fixture_id: fixture.id,
          matchday: fixture.matchday,
          predicted_home: correct ? 1 : 0,
          predicted_away: correct ? 0 : 1,
          is_correct: correct,
        }, { onConflict: 'user_id,fixture_id' });

        // Earn a token if prediction was correct
        if (correct && fixture.token_reward_type) {
          await adminSupabase.from('tokens').insert({
            user_id: uid,
            group_id: groupId,
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
      .eq('group_id', groupId)
      .eq('status', 'earned')
      .limit(1);
    if (earnedTokens && earnedTokens.length > 0) {
      await adminSupabase.from('tokens').update({
        status: 'used',
        used_matchday: 1,
      }).eq('id', earnedTokens[0].id);
    }

    // 9. Calculate group scores to populate total_points on group_members
    const { calculateGroupScores } = await import('@/services/rating.service');
    await calculateGroupScores(groupId);
  }
  ```

- [ ] **Step 4: Type-check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/services/demo.service.ts
  git commit -m "feat: add seedMainGroup to demo.service.ts"
  ```

---

## Task 11: Seed "Quick Draft" Group

Continue building `demo.service.ts` — implement `seedQuickDraftGroup`.

**Files:**
- Modify: `src/services/demo.service.ts`

- [ ] **Step 1: Add `seedQuickDraftGroup` function**

  This creates a 2-member group in `pending` state with the fake member's even-numbered picks pre-inserted so the draft board opens on the presenter's turn.

  ```typescript
  async function seedQuickDraftGroup(currentUserId: string): Promise<void> {
    const groupId = '00000000-demo-0000-0000-000000000002';
    const fakeUserId = DEMO_FAKE_USERS[0].id;

    // 1. Upsert the group in pending state
    const { error: gErr } = await adminSupabase
      .from('groups')
      .upsert({
        id: groupId,
        name: DEMO_DRAFT_NAME,
        creator_id: currentUserId,
        invite_code: 'DEMO02',
        max_members: 4,
        draft_status: 'pending',
        current_draft_round: 1,
        current_pick_number: 1,
        tokens_enabled: true,
        draft_order_mode: 'random',
        color: '#8B5CF6',
      }, { onConflict: 'id' });
    if (gErr) throw new Error(`Quick Draft group upsert failed: ${gErr.message}`);

    // 2. Upsert members: presenter = position 1 (picks odd), fake = position 2 (picks even)
    await adminSupabase.from('group_members').upsert([
      { group_id: groupId, user_id: currentUserId, draft_position: 1, total_points: 0 },
      { group_id: groupId, user_id: fakeUserId,    draft_position: 2, total_points: 0 },
    ], { onConflict: 'group_id,user_id' });

    // 3. Clean existing draft picks for this group
    await adminSupabase.from('draft_picks').delete().eq('group_id', groupId);

    // 4. Fetch available players to pre-insert fake member's picks
    const { data: available, error: pErr } = await supabase
      .from('players')
      .select('id, team_name, position')
      .eq('is_available', true)
      .limit(200);
    if (pErr) throw pErr;

    // Pre-insert picks for even pick numbers (2, 4, 6... up to 30 picks = 15 players each)
    // In a 2-person 15-pick snake draft: picks 1-15 round 1, picks 16-30 round 2
    // Snake: R1 picks 1,2,3,...15 (odd=presenter, even=fake)
    //        R2 picks 16,17,...30 (16=presenter again — snake reverses at 15)
    // Simplified: just seed picks 2, 4, 6, 8, 10, 12, 14, 17, 19, 21, 23, 25, 27, 29
    // That's 14 picks for fake (they get 7 in R1 + 7 in R2), presenter gets 8 total
    // For a 2-person draft with 15 picks per person (30 total), this is complex.
    // Simpler approach: pre-seed just the first few fake picks (2, 4, 6) so the draft
    // feels alive without fully seeding all 15 fake picks.

    const fakePicks: any[] = [];
    const teamCount: Record<string, number> = {};
    let fakePickCount = 0;

    for (const player of available) {
      if (fakePickCount >= 7) break;  // pre-seed 7 picks for fake user
      const tc = teamCount[player.team_name] ?? 0;
      if (tc >= 2) continue;
      teamCount[player.team_name] = tc + 1;

      const pickNumber = (fakePickCount + 1) * 2;  // 2, 4, 6, 8...
      fakePicks.push({
        group_id: groupId,
        user_id: fakeUserId,
        player_id: player.id,
        pick_number: pickNumber,
        draft_round: 1,
      });
      fakePickCount++;
    }

    if (fakePicks.length > 0) {
      const { error: dpErr } = await adminSupabase.from('draft_picks').insert(fakePicks);
      if (dpErr) throw new Error(`Draft picks insert failed: ${dpErr.message}`);
    }

    // 5. Set current_pick_number = 1 so the draft board opens on presenter's turn
    await adminSupabase
      .from('groups')
      .update({ current_pick_number: 1, draft_status: 'in_progress' })
      .eq('id', groupId);
  }
  ```

  > **Note:** Setting `draft_status = 'in_progress'` means the group will appear in the "Live Now" section of the Draft tab. The presenter navigates there and starts picking. The fake member's even picks are already in `draft_picks`, so the draft engine will advance past them automatically when the board progresses.

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/services/demo.service.ts
  git commit -m "feat: add seedQuickDraftGroup to demo.service.ts"
  ```

---

## Task 12: Wire Seed Function to Profile Avatar Long-Press

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Import `seedDemoData` from demo.service**

  Add to imports at top of `profile.tsx`:
  ```typescript
  import { seedDemoData } from '@/services/demo.service';
  ```

- [ ] **Step 2: Add `handleDemoSeed` function**

  Add inside the `ProfileScreen` component body (near other handlers):
  ```typescript
  async function handleDemoSeed() {
    if (!user) return;
    Alert.alert(
      'Reset demo data?',
      'This will overwrite demo group data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              await seedDemoData(user.uid);
              Alert.alert('Done', 'Demo data seeded successfully.');
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Seed failed.');
            }
          },
        },
      ],
    );
  }
  ```

- [ ] **Step 3: Wrap the avatar View in a TouchableOpacity**

  Change:
  ```tsx
  <View style={styles.avatarSection}>
    <View style={{ marginBottom: 14 }}>
      <Avatar ... />
    </View>
  ```
  To:
  ```tsx
  <View style={styles.avatarSection}>
    <TouchableOpacity
      onLongPress={handleDemoSeed}
      delayLongPress={3000}
      activeOpacity={1}
      style={{ marginBottom: 14 }}
    >
      <Avatar ... />
    </TouchableOpacity>
  ```

- [ ] **Step 4: Type-check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 5: Smoke test the seed**

  - On device: navigate to Profile
  - Long-press avatar for 3 seconds
  - Confirm Alert appears: "Reset demo data?"
  - Tap "Reset"
  - Confirm success alert
  - Navigate to Home — "WC Fantasy 2026" group should appear
  - Navigate to Draft tab — "Quick Draft" should appear in "Live Now"

- [ ] **Step 6: Commit**

  ```bash
  git add app/(tabs)/profile.tsx src/services/demo.service.ts
  git commit -m "feat: wire demo seed function to profile avatar long-press"
  ```

---

## Task 13: Graceful Loading States

Audit the 3 main data screens for error paths that reset state to empty.

**Files:**
- Modify: `app/(tabs)/index.tsx` (Home)
- Modify: `app/(tabs)/standings.tsx`
- Modify: `app/(tabs)/my-team.tsx`

- [ ] **Step 1: Audit error paths in Home screen**

  Search for `setGroups([])` or `setGroups(null)` in `app/(tabs)/index.tsx`. If the fetch error path resets state to empty, change it to:
  ```typescript
  // On error, retain last known state — don't reset to []
  // Just log or show a brief alert, then leave state untouched
  } catch {
    // silently retain last known groups state
  }
  ```

  For pull-to-refresh failure, add:
  ```typescript
  } catch {
    Alert.alert("Couldn't refresh", "Check your connection.");
    // do NOT reset state
  }
  ```

- [ ] **Step 2: Same audit for Standings screen**

  Check `app/(tabs)/standings.tsx` for error paths in the data fetch functions. Apply the same pattern: retain last state on error.

- [ ] **Step 3: Same audit for My Team screen**

  Check `app/(tabs)/my-team.tsx` — the `loadSquad` callback. If it has `setSquad([])` in a catch block, remove it.

- [ ] **Step 4: Airplane mode test**

  - On device: load Home with real data visible
  - Enable airplane mode
  - Pull-to-refresh on Home
  - Confirm: groups still visible, Alert appears ("Couldn't refresh")
  - Repeat for Standings and My Team

- [ ] **Step 5: Commit**

  ```bash
  git add app/(tabs)/index.tsx app/(tabs)/standings.tsx app/(tabs)/my-team.tsx
  git commit -m "fix: retain last-known state on network error for pitch demo resilience"
  ```

---

## Task 14: Demo Walkthrough Document

**Files:**
- Create: `docs/demo/walkthrough.md`

- [ ] **Step 1: Create the directory and file**

  ```bash
  mkdir -p docs/demo
  ```

  Create `docs/demo/walkthrough.md`:

  ````markdown
  # FotDraft — FotMob Pitch Demo Walkthrough

  ## Pre-Demo Setup

  1. **Log in** to the demo account on the test device.
  2. **Seed demo data:** Navigate to Profile → long-press the avatar for 3 seconds → tap "Reset".
  3. **Verify:** Return to Home. You should see "WC Fantasy 2026" (mid-season state) and "Quick Draft" (live draft in progress).
  4. **Network:** Ensure device has a good WiFi or LTE connection. Demo data is pre-loaded so you can tolerate brief hiccups, but keep it connected.

  **Demo account credentials:** [fill in before meeting]

  ---

  ## Scripted Flow (~2 minutes)

  ### 1. Home Screen (5 seconds)
  - Open app → Home shows "WC Fantasy 2026" with standings preview and upcoming matchday countdown.
  - Say: "Here's your home — all your groups, standings at a glance, and when the next matchday is."

  ### 2. Group Detail (10 seconds)
  - Tap the group card → Group Detail shows 4 members, invite code, completed draft status.
  - Say: "Friends join with an invite code. Once everyone's in, you run the draft."

  ### 3. My Team (15 seconds)
  - Tap My Team tab → Show formation field with starting XI.
  - Tap Points tab → Show matchday-by-matchday breakdown. Point at "Ratings powered by FotMob."
  - Tap Tokens tab → Show the used token badge.
  - Say: "Players earn points based on their FotMob match rating. Tokens let you double a star player or nullify an opponent's pick."

  ### 4. Fixtures (10 seconds)
  - Tap Fixtures tab → Show upcoming matchday predictions.
  - Tap Calendar tab → Show the full matchday schedule.
  - Say: "Predict match scores to earn tokens. Correct prediction = bonus power-up for the next matchday."

  ### 5. Standings (10 seconds)
  - Tap Standings tab → Show leaderboard with point gaps between members.
  - Tap a member row → Show their squad in the detail sheet.
  - Say: "Everyone can see each other's squads and total points after matchdays are resolved."

  ### 6. Live Draft (60 seconds)
  - Navigate to Draft tab → "Quick Draft" should show in Live Now.
  - Tap "Go to Draft Board" → Draft board opens, it's your pick.
  - Search for a player, tap, confirm pick.
  - Say: "The snake draft is real-time — everyone picks on their turn. Once it's done, you're locked in for the matchday."
  - Show 4–5 picks total.

  ### 7. Back to Home (10 seconds)
  - Tap Home → Both groups visible side by side.
  - Say: "And once the tournament starts, FotMob match ratings feed directly into everyone's scores automatically."

  ---

  ## Error Recovery

  | What happens | What to do |
  |---|---|
  | Screen shows spinner for >3s | Pull down to refresh. If it persists, navigate away and back. |
  | Draft board shows empty or wrong state | Re-seed: Profile → long-press avatar → Reset. Then re-navigate. |
  | Groups missing from Home | Pull-to-refresh on Home. |
  | Crash or blank screen | Restart the app. All data is in Supabase — it will reload. |

  ````

- [ ] **Step 2: Commit the walkthrough**

  ```bash
  git add docs/demo/walkthrough.md
  git commit -m "docs: add FotMob pitch demo walkthrough document"
  ```

---

## Final Checklist Before Demo

- [ ] Run `npx tsc --noEmit` — 0 errors
- [ ] Run `npm run lint` — 0 warnings on changed files
- [ ] Full end-to-end smoke test: seed → Home → Group Detail → My Team (all 3 tabs) → Fixtures → Standings → Live Draft
- [ ] Airplane mode test: all screens retain state, no crashes
- [ ] Profile: confirm no "Real CL Data" section visible
- [ ] Group Detail: confirm no "Start Round of 16 Draft" button
- [ ] Fixtures: confirm token guide is collapsed by default
- [ ] Slide deck: add screenshots of key screens after UI polish is complete
