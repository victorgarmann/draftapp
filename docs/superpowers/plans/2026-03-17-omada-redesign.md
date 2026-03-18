# Omada-Inspired Teal Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform FotDraft's visual identity from flat dark minimal to a vibrant, playful teal theme with Fredoka font, gradient backgrounds, and glass cards — inspired by the Omada app.

**Architecture:** Pure visual layer change. Update `theme.ts` tokens first, then create two shared components (`GradientScreen`, `GlassCard`), then migrate every screen/component to use them. No business logic, services, hooks, or routing changes.

**Tech Stack:** `expo-linear-gradient`, `@expo-google-fonts/fredoka`, `expo-font`, React Native `StyleSheet`

**Spec:** `docs/superpowers/specs/2026-03-17-omada-redesign-design.md`

---

## File Structure

### New Files
- `src/components/gradient-screen.tsx` — `LinearGradient` wrapper for all screens
- `src/components/glass-card.tsx` — Reusable glass card (standard/bright variants)

### Modified Files (in order)
1. `src/constants/theme.ts` — New color palette, gradient tokens, shadows, font tokens
2. `app/_layout.tsx` — Load Fredoka fonts, update header styles
3. `app/(tabs)/_layout.tsx` — Custom tab bar component
4. `src/components/avatar.tsx` — Gradient avatars seeded from username
5. `src/components/skeleton.tsx` — Glass-tinted shimmer
6. `src/components/empty-state.tsx` — Teal-themed styles
7. `src/components/token-coin.tsx` — Teal-themed dark backgrounds
8. `src/components/formation-field.tsx` — Player bubble border glow
9. `src/components/player-detail-sheet.tsx` — Glass cards, teal sheet bg
10. `app/(tabs)/home.tsx` — Full redesign
11. `app/(tabs)/standings.tsx` — Hero leader, glass rows, coin badges
12. `app/(tabs)/my-team.tsx` — Glass cards, pill tabs, bench cards
13. `app/(tabs)/draft.tsx` — Glass draft list cards
14. `app/draft/[id].tsx` — Glass rows, gradient banner
15. `app/(tabs)/fixtures.tsx` — Glass match cards
16. `app/(tabs)/profile.tsx` — Glass settings cards
17. `app/group/create.tsx` — Gradient bg, glass form
18. `app/group/[id].tsx` — Glass member cards
19. `app/group/join.tsx` — Gradient bg, glass form
20. `app/join/[code].tsx` — Gradient bg, glass card
21. `app/(auth)/login.tsx` — Gradient bg, glass form
22. `app/(auth)/login.tsx` — Gradient bg, glass form
23. `app/(auth)/register.tsx` — Gradient bg, glass form
24. `app/(auth)/_layout.tsx` — Remove any old bg/header styles
25. `app/group/_layout.tsx` — Verify headerShown: false (no changes needed if so)
26. `app/draft/_layout.tsx` — Verify headerShown: false (no changes needed if so)
27. `src/components/champdraft-logo.tsx` — Update hardcoded colors for teal theme
28. `src/components/jersey-icon.tsx` — Review for hardcoded colors
29. `app/+not-found.tsx` — Gradient bg

---

## Task 1: Install Dependencies

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install packages**

```bash
npx expo install expo-linear-gradient @expo-google-fonts/fredoka
```

- [ ] **Step 2: Verify install succeeded**

```bash
npx expo install --check
```

Expected: no critical errors for the new packages. (`expo-font` is already installed.)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add expo-linear-gradient and fredoka font"
```

---

## Task 2: Update Theme Tokens

**Files:**
- Modify: `src/constants/theme.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
// Omada-inspired teal theme for FotDraft

export const T = {
  // Gradient backgrounds
  bgGradientStart: '#0F766E',
  bgGradientEnd:   '#134E4A',
  bg:              '#134E4A',   // fallback flat bg (modals, sheets)

  // Glass surfaces
  surface:  'rgba(255,255,255,0.10)',
  surface2: 'rgba(255,255,255,0.15)',
  surface3: 'rgba(255,255,255,0.20)',

  // Borders
  border:           'rgba(255,255,255,0.08)',
  glassBorder:      'rgba(255,255,255,0.08)',
  glassBorderStrong:'rgba(255,255,255,0.12)',

  // Text
  text:          '#ffffff',
  textSecondary: 'rgba(255,255,255,0.45)',
  textMuted:     'rgba(255,255,255,0.30)',

  // Accent (teal)
  accent:      '#14B8A6',
  accentDark:  '#0D9488',
  accentLight: '#2DD4BF',
  accentMuted: '#5EEAD4',

  // Rank medals
  gold:   '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',

  // Status
  error:   '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',

  // Tab bar
  tabBarBg: 'rgba(0,0,0,0.35)',

  // Position colours
  positions: {
    GK: '#F59E0B',
    CB: '#3B82F6',
    RB: '#3B82F6',
    LB: '#3B82F6',
    CM: '#10B981',
    W:  '#8B5CF6',
    ST: '#EF4444',
  },

  // Coin badge (points display)
  coinBg:   'rgba(255,215,0,0.15)',
  coinText: '#FFD700',
} as const;

// Teal-tinted shadow for hero/leader cards (iOS only; Android uses elevation)
export const heroShadow = {
  shadowColor: '#14B8A6',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.3,
  shadowRadius: 10,
  elevation: 6,
};

// Lighter shadow for primary buttons
export const buttonShadow = {
  shadowColor: '#14B8A6',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 6,
  elevation: 3,
};

// No shadow for standard glass cards (transparency provides depth)
export const cardShadow = {};

// Radii
export const R = {
  card:    16,
  button:  14,
  tabBar:  20,
  chip:    12,
  leader:  18,
} as const;
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: Type errors in files that reference removed tokens (e.g., `T.bg` usage as flat bg is fine since we kept it). Some screens may error on missing `cardShadow` spread if they destructure differently — we'll fix those in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/constants/theme.ts
git commit -m "feat: replace theme with omada-inspired teal palette"
```

---

## Task 3: Create Shared Components

**Files:**
- Create: `src/components/gradient-screen.tsx`
- Create: `src/components/glass-card.tsx`

- [ ] **Step 1: Create GradientScreen**

```typescript
import { type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { T } from '@/constants/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function GradientScreen({ children, style }: Props) {
  return (
    <LinearGradient
      colors={[T.bgGradientStart, T.bgGradientEnd]}
      style={[s.container, style]}
    >
      {children}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
});
```

- [ ] **Step 2: Create GlassCard**

```typescript
import { type ReactNode } from 'react';
import { View, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { T, R } from '@/constants/theme';

type Props = {
  children: ReactNode;
  variant?: 'standard' | 'bright';
  style?: StyleProp<ViewStyle>;
};

export function GlassCard({ children, variant = 'standard', style }: Props) {
  const bg = variant === 'bright' ? T.surface2 : T.surface;
  const border = variant === 'bright' ? T.glassBorderStrong : T.glassBorder;

  return (
    <View style={[s.card, { backgroundColor: bg, borderColor: border }, style]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: R.card,
    borderWidth: 1,
    padding: 14,
  },
});
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/gradient-screen.tsx src/components/glass-card.tsx
git commit -m "feat: add GradientScreen and GlassCard shared components"
```

---

## Task 4: Font Loading & Root Layout

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Update root layout to load Fredoka fonts and update header styles**

Note: This also changes `StatusBar` from `"auto"` to `"light"` since teal backgrounds need light-colored status bar text. Before replacing, diff against the current file to ensure no recent additions are lost.

Replace the entire file content:

```typescript
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useFonts, Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { requestNotificationPermissions } from '@/services/notification.service';
import { T } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isLoading, user } = useAuth();
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  useEffect(() => {
    if (!isLoading && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded]);

  useEffect(() => {
    if (!isLoading && user) {
      requestNotificationPermissions();
    }
  }, [isLoading, user]);

  if (!fontsLoaded) return null;

  const stackHeaderStyle = {
    headerShown: true as const,
    headerStyle: { backgroundColor: T.bgGradientStart },
    headerTintColor: T.accentLight,
    headerTitleStyle: { color: T.text, fontFamily: 'Fredoka_600SemiBold' },
    headerBackTitle: 'Back',
    title: '',
  };

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="group" options={stackHeaderStyle} />
        <Stack.Screen name="draft" options={stackHeaderStyle} />
        <Stack.Screen name="join" options={{ ...stackHeaderStyle, title: 'Joining Group' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: load Fredoka fonts and update header styles to teal"
```

---

## Task 5: Custom Tab Bar

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Replace with custom tab bar**

```typescript
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { T, R } from '@/constants/theme';

const TAB_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  home:      'home',
  fixtures:  'calendar',
  'my-team': 'shirt',
  standings: 'podium',
  profile:   'person',
};

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={s.tabBar}>
      {state.routes
        .filter((r) => descriptors[r.key].options.href !== null)
        .map((route, index) => {
          const { options } = descriptors[route.key];
          const label = (options.title ?? route.name) as string;
          const isFocused = state.index === state.routes.indexOf(route);
          const iconName = TAB_ICONS[route.name] ?? 'ellipse';

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={s.tab} activeOpacity={0.7}>
              <Ionicons name={iconName} size={22} color={isFocused ? T.accentLight : T.textMuted} />
              <Text style={[s.tabLabel, isFocused && s.tabLabelActive]}>{label}</Text>
              {isFocused && <View style={s.tabDot} />}
            </TouchableOpacity>
          );
        })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home"      options={{ title: 'Home' }} />
      <Tabs.Screen name="fixtures"  options={{ title: 'Fixtures' }} />
      <Tabs.Screen name="my-team"   options={{ title: 'My Team' }} />
      <Tabs.Screen name="standings" options={{ title: 'Standings' }} />
      <Tabs.Screen name="profile"   options={{ title: 'Profile' }} />
      <Tabs.Screen name="draft"     options={{ href: null }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: T.tabBarBg,
    borderRadius: R.tabBar,
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: 'Fredoka_500Medium',
    color: T.textMuted,
  },
  tabLabelActive: {
    color: T.accentLight,
    fontFamily: 'Fredoka_700Bold',
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.accentLight,
    marginTop: 2,
  },
});
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/_layout.tsx"
git commit -m "feat: custom pill-shaped tab bar with teal active indicator"
```

---

## Task 6: Update Avatar Component

**Files:**
- Modify: `src/components/avatar.tsx`

- [ ] **Step 1: Replace with gradient avatar seeded from username**

```typescript
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '@/constants/theme';

const GRADIENT_PAIRS: [string, string][] = [
  ['#2DD4BF', '#5EEAD4'], // teal
  ['#FB7185', '#F43F5E'], // coral
  ['#F59E0B', '#FBBF24'], // amber
  ['#A78BFA', '#8B5CF6'], // violet
  ['#60A5FA', '#3B82F6'], // blue
  ['#F472B6', '#EC4899'], // rose
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

type Props = {
  username: string;
  size?: number;
  variant?: 'accent' | 'surface';
  border?: boolean;
  onPress?: () => void;
  style?: object;
};

export function Avatar({ username, size = 40, variant = 'accent', border = false, onPress, style }: Props) {
  const letter = (username[0] ?? '?').toUpperCase();
  const pair = GRADIENT_PAIRS[hashCode(username) % GRADIENT_PAIRS.length];

  const borderStyle = border ? { borderWidth: 3, borderColor: T.accentDark } : {};

  const inner = variant === 'accent' ? (
    <LinearGradient
      colors={pair}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          justifyContent: 'center' as const,
          alignItems: 'center' as const,
        },
        borderStyle,
        style,
      ]}
    >
      <Text style={{ color: T.bg, fontFamily: 'Fredoka_700Bold', fontSize: size * 0.4 }}>{letter}</Text>
    </LinearGradient>
  ) : (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: T.surface2,
          justifyContent: 'center' as const,
          alignItems: 'center' as const,
        },
        borderStyle,
        style,
      ]}
    >
      <Text style={{ color: T.accentLight, fontFamily: 'Fredoka_700Bold', fontSize: size * 0.4 }}>{letter}</Text>
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{inner}</TouchableOpacity>;
  }
  return inner;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/avatar.tsx
git commit -m "feat: gradient avatars with username-seeded color pairs"
```

---

## Task 7: Update Small Components (skeleton, empty-state, token-coin)

**Files:**
- Modify: `src/components/skeleton.tsx`
- Modify: `src/components/empty-state.tsx`
- Modify: `src/components/token-coin.tsx`

- [ ] **Step 1: Update skeleton.tsx** — Change `T.surface2` references (already works since we kept the token name, but update the border radius):

In `skeleton.tsx`, change `borderRadius: 10` to `borderRadius: 16` and `borderRadius: 6` to `borderRadius: 12`. The `T.surface2` token now resolves to glass-bright color automatically.

- [ ] **Step 2: Update empty-state.tsx** — Change `borderRadius: 10` to `borderRadius: R.button` (14). Update font families:

```
title style: add fontFamily: 'Fredoka_700Bold'
subtitle style: add fontFamily: 'Fredoka_500Medium'
ctaText style: add fontFamily: 'Fredoka_600SemiBold'
cta style: change borderRadius: 10 → R.button
```

Import `R` from `@/constants/theme`.

- [ ] **Step 3: Update token-coin.tsx** — Change hardcoded dark backgrounds to teal theme:

Replace `'#0c0c1e'` with `T.bg` (the dark teal fallback).
Replace `'#161630'` with `T.bg` (use opaque dark bg for coin face, not transparent `T.surface`).
Replace `'#44445a'` with `T.textMuted`.
Replace `'#18181c'` with `T.bg`.
Replace `'#2a2a3e'` with `T.bg`.

Note: Do NOT use `T.surface` (semi-transparent white) for coin backgrounds — the coin is rendered inside various containers and needs opaque backgrounds to look correct.

Import `T` from `@/constants/theme` (add if missing).

- [ ] **Step 4: Commit**

```bash
git add src/components/skeleton.tsx src/components/empty-state.tsx src/components/token-coin.tsx
git commit -m "feat: update small components to teal theme"
```

---

## Task 8: Update Formation Field

**Files:**
- Modify: `src/components/formation-field.tsx`

- [ ] **Step 1: Add white border glow to player bubbles**

Find the player circle `View` styles in the formation field (there will be multiple places where player position circles are rendered). Add to each:

```
borderWidth: 2,
borderColor: 'rgba(255,255,255,0.3)',
```

Also update any `fontWeight` text styles to include `fontFamily: 'Fredoka_700Bold'` for player initials/names on the pitch.

The green pitch gradient itself stays unchanged.

- [ ] **Step 2: Commit**

```bash
git add src/components/formation-field.tsx
git commit -m "feat: add white border glow to formation player bubbles"
```

---

## Task 9: Update Player Detail Sheet

**Files:**
- Modify: `src/components/player-detail-sheet.tsx`

- [ ] **Step 1: Update styles**

Change all references to old theme values:
- Sheet background (`T.bg` is now `#134E4A` — works automatically)
- Replace card-style containers with `GlassCard` component or apply glass styles manually
- Update `borderRadius` values to use `R.card` (16)
- Add `fontFamily: 'Fredoka_700Bold'` to heading text
- Add `fontFamily: 'Fredoka_500Medium'` to body text
- Update border colors from `T.border` (now `rgba(255,255,255,0.08)` — works automatically)

- [ ] **Step 2: Commit**

```bash
git add src/components/player-detail-sheet.tsx
git commit -m "feat: update player detail sheet to teal glass theme"
```

---

## Task 10: Redesign Home Screen

**Files:**
- Modify: `app/(tabs)/home.tsx`

This is one of the most visible screens. Key changes:

- [ ] **Step 1: Replace container and header**

Replace `<View style={s.container}>` with `<GradientScreen>`. Import `GradientScreen` from `@/components/gradient-screen`.

Update header style: remove `backgroundColor: T.surface` and `borderBottomWidth/Color`. The header now sits on the gradient.

Update greeting/username text to use `fontFamily: 'Fredoka_500Medium'` and `fontFamily: 'Fredoka_700Bold'`.

- [ ] **Step 2: Replace cards with GlassCard**

Import `GlassCard` from `@/components/glass-card`.

Update the `rankColor()` helper to use theme tokens: `T.gold`, `T.silver`, `T.bronze` instead of hardcoded hex values.

Replace the stats row `View` with `<GlassCard>`.
Replace the matchday card `View` with `<GlassCard variant="bright">` and add `borderLeftWidth: 4, borderLeftColor: T.accentLight`.
Replace each group card `View` with `<GlassCard>`.

- [ ] **Step 3: Update buttons**

Primary buttons: add `buttonShadow` spread, `borderRadius: R.button`.
Outline buttons: `borderColor: 'rgba(45,212,191,0.4)'`, `borderRadius: R.button`.
Add `fontFamily: 'Fredoka_600SemiBold'` to button text.

- [ ] **Step 4: Update footer**

Remove `backgroundColor: T.surface` and `borderTopWidth/Color` from footer. The footer sits on the gradient.

- [ ] **Step 5: Update all `borderRadius` values**

Cards: `R.card` (16). Buttons: `R.button` (14). Badges: `R.chip` (12).

- [ ] **Step 6: Remove old `cardShadow` spreads**

The old `cardShadow` is now an empty object, so spreads are harmless but can be cleaned up.

- [ ] **Step 7: Add coin badge for rank display**

For the rank badge in group cards, use `T.coinBg` and `T.coinText` for styling.

- [ ] **Step 8: Test visually**

```bash
npm start
```

Open on device/emulator. Verify: gradient bg, glass cards, Fredoka text, teal accents, no visual glitches.

- [ ] **Step 9: Commit**

```bash
git add "app/(tabs)/home.tsx"
git commit -m "feat: redesign home screen with teal gradient and glass cards"
```

---

## Task 11: Redesign Standings Screen

**Files:**
- Modify: `app/(tabs)/standings.tsx`

- [ ] **Step 1: Replace container with GradientScreen**

- [ ] **Step 2: Update leader card**

Replace the flat `leaderCard` with a `LinearGradient` using `[T.accent, T.accentDark]`:
- Add trophy emoji (🏆) at 30px
- Use coin badge styling for points (`T.coinBg`, `T.coinText`)
- Apply `heroShadow`
- `borderRadius: R.leader` (18)

- [ ] **Step 3: Update leaderboard rows**

Replace row `View` with `GlassCard`.
Make rank numbers larger (`fontSize: 22, fontFamily: 'Fredoka_700Bold'`).
Color ranks: use `T.gold`, `T.silver`, `T.bronze` from theme. Update the `rankColor()` helper to use these tokens instead of hardcoded hex values.
Points: wrap in coin badge view (`backgroundColor: T.coinBg`, text color `T.coinText`).
Current user row: `borderColor: 'rgba(45,212,191,0.3)'`.

- [ ] **Step 4: Update sub-tabs**

Active: `backgroundColor: T.accent`, `borderRadius: R.chip`.
Inactive: `backgroundColor: T.surface`, `borderRadius: R.chip`.
Text: `fontFamily: 'Fredoka_700Bold'` active, `fontFamily: 'Fredoka_600SemiBold'` inactive.

- [ ] **Step 5: Update modals**

Group picker modal sheet: `backgroundColor: T.bg`.
Member detail modal sheet: `backgroundColor: T.bg`.
Update all internal card styles to glass.

- [ ] **Step 6: Update all fonts**

Every `Text` element gets appropriate Fredoka `fontFamily`.

- [ ] **Step 7: Test visually and commit**

```bash
git add "app/(tabs)/standings.tsx"
git commit -m "feat: redesign standings with hero leader card and glass rows"
```

---

## Task 12: Redesign My Team Screen

**Files:**
- Modify: `app/(tabs)/my-team.tsx` (1,381 lines — largest screen)

- [ ] **Step 1: Replace container with GradientScreen**

- [ ] **Step 2: Update sub-tabs** (Squad / Points / Tokens) — same pill style as standings.

- [ ] **Step 3: Update bench cards** — Use `GlassCard` for each bench slot.

- [ ] **Step 4: Update token cards** — `GlassCard` with colored left border (`borderLeftWidth: 4`).

- [ ] **Step 5: Update all `borderRadius` and font families**

- [ ] **Step 6: Update modal styles** — Sheet bg `T.bg`, internal glass cards.

- [ ] **Step 7: Test visually and commit**

```bash
git add "app/(tabs)/my-team.tsx"
git commit -m "feat: redesign my team screen with glass cards and pill tabs"
```

---

## Task 13: Redesign Draft Screens

**Files:**
- Modify: `app/(tabs)/draft.tsx` (213 lines)
- Modify: `app/draft/[id].tsx` (905 lines)

- [ ] **Step 1: Update draft tab** (`app/(tabs)/draft.tsx`)

Replace container with `GradientScreen`. Replace draft section cards with `GlassCard`. Status badges: LIVE = `backgroundColor: T.error, borderRadius: 20`. Update fonts.

- [ ] **Step 2: Update draft board** (`app/draft/[id].tsx`)

Replace container with `GradientScreen`.
Search for and replace any hardcoded old accent color (`#3d85f7`) with `T.accent` or `T.accentLight`.
"Your pick" banner: `LinearGradient` with `[T.accent, T.accentDark]`, `heroShadow`, `borderRadius: R.card`.
Position filter chips: `borderRadius: 20`, active = `backgroundColor: T.accent`.
Player rows: `GlassCard`. Draft button: gradient style with `buttonShadow`.
Taken players: `opacity: 0.5`.
Update all fonts.

- [ ] **Step 3: Test visually and commit**

```bash
git add "app/(tabs)/draft.tsx" "app/draft/[id].tsx"
git commit -m "feat: redesign draft screens with glass cards and gradient banner"
```

---

## Task 14: Redesign Fixtures Screen

**Files:**
- Modify: `app/(tabs)/fixtures.tsx` (643 lines)

- [ ] **Step 1: Replace container with GradientScreen**

- [ ] **Step 2: Update match cards with GlassCard**, prediction inputs with `GlassCard variant="bright"`, matchday headers with teal badge chips.

- [ ] **Step 3: Update all fonts and border radii**

- [ ] **Step 4: Test visually and commit**

```bash
git add "app/(tabs)/fixtures.tsx"
git commit -m "feat: redesign fixtures screen with glass match cards"
```

---

## Task 15: Redesign Profile Screen

**Files:**
- Modify: `app/(tabs)/profile.tsx` (356 lines)

- [ ] **Step 1: Replace container with GradientScreen**

- [ ] **Step 2: Use larger avatar** (size={64}) at top.

- [ ] **Step 3: Settings sections as GlassCard**

- [ ] **Step 4: Buttons: gradient primary with `buttonShadow`**

- [ ] **Step 5: Update fonts and commit**

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "feat: redesign profile screen with glass settings cards"
```

---

## Task 16: Redesign Group Screens

**Files:**
- Modify: `app/group/create.tsx` (180 lines)
- Modify: `app/group/[id].tsx` (785 lines)
- Modify: `app/group/join.tsx` (114 lines)
- Modify: `app/join/[code].tsx` (78 lines)

- [ ] **Step 1: Update group create** — `GradientScreen` bg, `GlassCard variant="bright"` for form, glass inputs, gradient submit button.

- [ ] **Step 2: Update group detail** — `GradientScreen` bg, `GlassCard` for member list, settings, draft info sections.

- [ ] **Step 3: Update group join** — `GradientScreen` bg, `GlassCard variant="bright"` for form.

- [ ] **Step 4: Update join/[code]** — `GradientScreen` bg, `GlassCard` for confirmation card.

- [ ] **Step 5: Update all fonts and border radii**

- [ ] **Step 6: Test and commit**

```bash
git add app/group/create.tsx "app/group/[id].tsx" app/group/join.tsx "app/join/[code].tsx"
git commit -m "feat: redesign group screens with gradient bg and glass forms"
```

---

## Task 17: Update Logo, Jersey Icon, and Layout Files

**Files:**
- Modify: `src/components/champdraft-logo.tsx` (54 lines)
- Modify: `src/components/jersey-icon.tsx` (45 lines)
- Review: `app/(auth)/_layout.tsx` (10 lines)
- Review: `app/group/_layout.tsx` (5 lines)
- Review: `app/draft/_layout.tsx` (5 lines)

- [ ] **Step 1: Update champdraft-logo.tsx**

Search for hardcoded dark colors (`#18181c`, `#242428`, `#3d85f7`, etc.) and replace with theme tokens. The logo appears on auth screens which now have a teal gradient background.

- [ ] **Step 2: Review jersey-icon.tsx**

Check for hardcoded colors. Position colors should use `T.positions.*` tokens. Any dark background colors should use `T.bg`.

- [ ] **Step 3: Review layout files**

Check `app/(auth)/_layout.tsx`, `app/group/_layout.tsx`, and `app/draft/_layout.tsx` for any `backgroundColor` or `headerStyle` properties that use old theme colors. Update if found. If they only set `headerShown: false`, no changes needed.

- [ ] **Step 4: Commit**

```bash
git add src/components/champdraft-logo.tsx src/components/jersey-icon.tsx app/(auth)/_layout.tsx app/group/_layout.tsx app/draft/_layout.tsx
git commit -m "feat: update logo, jersey icon, and layout files for teal theme"
```

---

## Task 18: Redesign Auth Screens

**Files:**
- Modify: `app/(auth)/login.tsx` (185 lines)
- Modify: `app/(auth)/register.tsx` (156 lines)

- [ ] **Step 1: Replace containers with GradientScreen**

- [ ] **Step 2: Wrap forms in GlassCard**

- [ ] **Step 3: Update inputs** — `backgroundColor: T.surface2`, `borderColor: T.glassBorderStrong`, `borderRadius: R.button`, `fontFamily: 'Fredoka_500Medium'`.

- [ ] **Step 4: Update buttons** — Gradient primary with `buttonShadow`, `fontFamily: 'Fredoka_600SemiBold'`.

- [ ] **Step 5: Update all text fonts and commit**

```bash
git add "app/(auth)/login.tsx" "app/(auth)/register.tsx"
git commit -m "feat: redesign auth screens with gradient bg and glass forms"
```

---

## Task 19: Update Not Found Screen & Final Cleanup

**Files:**
- Modify: `app/+not-found.tsx`

- [ ] **Step 1: Update +not-found.tsx** — `GradientScreen` wrapper, Fredoka font.

- [ ] **Step 2: Run full type check**

```bash
npx tsc --noEmit
```

Fix any remaining type errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Fix any lint issues.

- [ ] **Step 4: Full visual test**

```bash
npm start
```

Walk through every screen on device/emulator:
- Home, Fixtures, My Team, Standings, Profile (all tabs)
- Group create, group detail, group join
- Draft tab, draft board
- Login, Register
- Player detail sheet, group picker modal

Verify: gradient backgrounds, glass cards, Fredoka font, teal accents, gold coin badges, gradient avatars, rounded tab bar, no visual glitches.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete omada-inspired teal redesign across all screens"
```
