# FotDraft Visual Redesign — Omada-Inspired Teal Theme

**Date:** 2026-03-17
**Status:** Approved

## Overview

Redesign FotDraft from a flat dark minimal theme to a vibrant, playful, game-like visual style inspired by the Omada ("Make Sport Social") app. The new design uses teal gradient backgrounds, frosted glass cards, the Fredoka font, bold rank styling, and gold coin badges — transforming the app from "sports data tool" into "fun game with friends."

## Design System

### Color Palette

| Token | Value | Usage |
|---|---|---|
| `bg` (gradient start) | `#0F766E` | Top of screen gradient |
| `bg` (gradient end) | `#134E4A` | Bottom of screen gradient |
| `surface` (glass) | `rgba(255,255,255,0.10)` | Standard glass cards |
| `surface2` (glass bright) | `rgba(255,255,255,0.15)` | Elevated/highlighted cards |
| `glassBorder` | `rgba(255,255,255,0.08)` | Subtle glass card borders |
| `glassBorderStrong` | `rgba(255,255,255,0.12)` | Borders on elevated/bright glass |
| `accent` | `#14B8A6` | Primary actions, active tabs, leader card gradient start |
| `accentDark` | `#0D9488` | Leader card gradient end, pressed states |
| `accentLight` | `#2DD4BF` | Active tab text, secondary accent, border highlights |
| `accentMuted` | `#5EEAD4` | Avatar gradients, lighter accent uses |
| `gold` | `#FFD700` | Points coin badges, 1st place rank |
| `silver` | `#C0C0C0` | 2nd place rank |
| `bronze` | `#CD7F32` | 3rd place rank |
| `text` | `#ffffff` | Primary text |
| `textSecondary` | `rgba(255,255,255,0.45)` | Greeting text, labels |
| `textMuted` | `rgba(255,255,255,0.30)` | Section labels, inactive tabs, placeholders |
| `surface3` | `rgba(255,255,255,0.20)` | Pressed/hover states on glass cards |
| `border` | `rgba(255,255,255,0.08)` | General dividers, input borders |
| `error` | `#EF4444` | Error states, LIVE badge, ATT position |
| `success` | `#22C55E` | Success states |
| `warning` | `#F59E0B` | Warning, GK position |
| `tabBarBg` | `rgba(0,0,0,0.35)` | Tab bar background |

Position colors remain unchanged:
- GK: `#F59E0B`, DEF: `#3B82F6`, MID: `#10B981`, W: `#8B5CF6`, ST: `#EF4444`

### Typography

**Font family:** Fredoka (Google Fonts). Install via `expo-google-fonts` package `@expo-google-fonts/fredoka`.

| Weight | Token | Usage |
|---|---|---|
| 700 (Bold) | `fontBold` | Screen titles, hero text, rank numbers, stat values |
| 600 (SemiBold) | `fontSemiBold` | Card titles, player names, button text |
| 500 (Medium) | `fontMedium` | Body text, descriptions, tab labels |
| 400 (Regular) | `fontRegular` | Secondary text, captions |

### Border Radii

Increased from current values to feel more playful:
- Cards/panels: `16px` (was 12–14)
- Buttons: `14px` (was 9–10)
- Tab bar: `20px` (was 0/flat)
- Chips/badges: `12px` (was 6–8)
- Avatars: fully round (unchanged)
- Leader card: `18px`

### Shadows

Cards use a teal-tinted glow instead of black shadows. Note: on Android, only gray `elevation` shadows are available — teal tint is iOS-only.

- Standard glass: no shadow (transparency provides depth)
- Leader/hero cards (iOS): `shadowColor: '#14B8A6', shadowOffset: {0, 6}, shadowOpacity: 0.3, shadowRadius: 10` / Android: `elevation: 6`
- Primary buttons (iOS): `shadowColor: '#14B8A6', shadowOffset: {0, 4}, shadowOpacity: 0.25, shadowRadius: 6` / Android: `elevation: 3`

### Avatars

Gradient-filled circles with unique color combos per user (seeded from username hash):
- Gradient pairs: teal, coral, amber, violet, blue, rose
- Initial letter in dark contrast color (`#134E4A`)
- Size variants: 42px (header), 36px (list rows), 28–32px (formation)

### Points Display — Coin Badges

Points shown in gold coin-style badges:
- Background: `rgba(255,215,0,0.15)`
- Border radius: `10px`
- Text: `#FFD700`, font-weight 700
- Padding: `2px 8px`

## Screen-by-Screen Changes

### All Screens (Global)

- **Background:** Replace flat `#18181c` with `LinearGradient` from `#0F766E` (top) to `#134E4A` (bottom) via `expo-linear-gradient`
- **Tab bar:** Rounded pill shape (`borderRadius: 20`), `rgba(0,0,0,0.35)` background, active tab uses `#2DD4BF` with dot indicator below
- **Cards:** Replace solid `#242428` surfaces with glass cards (`rgba(255,255,255,0.10)` + subtle border)
- **Font:** All text uses Fredoka weights

### Home Screen (`app/(tabs)/home.tsx`)

- Header: gradient avatar, Fredoka bold username
- Stats row: glass card with dividers
- Matchday banner: glass-bright card with teal left border accent
- Group cards: glass cards with colored left borders (group color)
- Footer buttons: gradient primary button + outline secondary

### Standings Screen (`app/(tabs)/standings.tsx`)

- Leader card: gradient teal background (`#14B8A6` → `#0D9488`), trophy emoji, coin badge for points, elevated shadow
- Leaderboard rows: glass cards with bold oversized rank numbers (gold/silver/bronze), gradient avatars, coin badges
- Current user row: highlighted with `rgba(45,212,191,0.3)` border
- Sub-tabs: pill-shaped, active uses solid teal fill
- Matchday chips: glass background with rounded pill shape

### My Team Screen (`app/(tabs)/my-team.tsx`)

- Formation field: unchanged green pitch (already looks good)
- Player bubbles: position-colored with white border glow (`2px solid rgba(255,255,255,0.3)`)
- Bench: glass cards for each bench slot
- Sub-tabs: same pill style as standings
- Token cards: glass cards with colored left border

### Draft Board (`app/draft/[id].tsx`)

- LIVE badge: red pill with white text
- "Your pick" banner: gradient teal card with shadow
- Position filter chips: pill-shaped, active uses solid teal
- Player rows: glass cards with position-colored avatar, country flag, "Draft" gradient button
- Taken players: reduced opacity (0.5) with "Taken" muted badge

### Profile Screen (`app/(tabs)/profile.tsx`)

- Glass cards for settings sections
- Gradient avatar (larger, ~64px)
- Teal accent buttons

### Fixtures Screen (`app/(tabs)/fixtures.tsx`)

- Match cards: glass cards
- Matchday headers: teal badge chips
- Prediction inputs: glass-bright style

### Auth Screens (`app/(auth)/`)

- Full gradient background
- Glass card for form container
- Gradient primary buttons

### Draft Tab (`app/(tabs)/draft.tsx`)

- Live/upcoming/completed draft sections: glass cards
- Draft status badges: teal pill for live, glass for others

### Group Screens (`app/group/create.tsx`, `app/group/[id].tsx`, `app/group/join.tsx`, `app/join/[code].tsx`)

- Gradient background
- Form inputs: glass-bright cards with `rgba(255,255,255,0.08)` border
- Group detail: glass cards for member list, settings, draft info
- Buttons: gradient primary + outline secondary (same as home)

### Modals (Group picker, Player detail, Member detail)

- Overlay: `rgba(0,0,0,0.65)` (unchanged)
- Sheet background: `#134E4A` (darkest gradient color) instead of `#18181c`
- Content uses glass cards within

## Implementation Approach

### Glass Effect Clarification

The "frosted glass" effect uses **semi-transparent white overlays only** — no blur. This avoids the performance cost of `expo-blur` / `BlurView` and works consistently across platforms. The transparency against the teal gradient provides sufficient visual depth.

### Dependencies to Add

- `expo-linear-gradient` — gradient backgrounds
- `@expo-google-fonts/fredoka` — Fredoka font family
- `expo-font` — font loading (likely already present)

### Shared Components to Create

- **`GradientScreen`** — Wrapper component using `LinearGradient` with the standard teal gradient. All screens use this instead of `<View style={{ backgroundColor: T.bg }}>`.
- **`GlassCard`** — Reusable card with glass styling (surface bg, glassBorder, borderRadius 16). Accepts `variant` prop for `'standard'` vs `'bright'`. Reduces duplication across all screens.

### Migration Strategy

Replace the `T` object in `theme.ts` first, then update all screens in a single pass. Since every screen references `T`, intermediate states will have visual issues — this is expected. Work through the files list top-to-bottom. The app will look correct once all files are updated.

### Font Loading

Load Fredoka in `app/_layout.tsx` using `useFonts` from `@expo-google-fonts/fredoka`. Call `SplashScreen.preventAutoHideAsync()` on mount and `SplashScreen.hideAsync()` after fonts load to avoid a flash of unstyled text.

### Files to Modify

1. **`src/constants/theme.ts`** — Replace entire `T` object with new palette; add gradient values, glass styles, font tokens, new `cardShadow`
2. **`app/(tabs)/_layout.tsx`** — Restyle tab bar (rounded, dark glass, teal active indicator with dot). Requires a custom `tabBar` component for the pill shape and dot indicator.
3. **`app/_layout.tsx`** — Load Fredoka fonts via `useFonts` hook with SplashScreen guard
4. **`src/components/avatar.tsx`** — Gradient backgrounds seeded from username
5. **`app/(tabs)/home.tsx`** — Gradient bg, glass cards, new button styles
6. **`app/(tabs)/standings.tsx`** — Hero leader card, glass rows, coin badges, bold ranks
7. **`app/(tabs)/my-team.tsx`** — Glass cards, updated sub-tabs, bench styling
8. **`app/draft/[id].tsx`** — Glass player rows, gradient "your pick" banner
9. **`app/(tabs)/draft.tsx`** — Glass draft list cards
10. **`app/(tabs)/fixtures.tsx`** — Glass match cards
11. **`app/(tabs)/profile.tsx`** — Glass settings cards
12. **`app/group/create.tsx`** — Gradient bg, glass form
13. **`app/group/[id].tsx`** — Glass member cards, group detail
14. **`app/group/join.tsx`** — Gradient bg, glass form
15. **`app/join/[code].tsx`** — Gradient bg, glass card
16. **`app/(auth)/login.tsx`, `app/(auth)/register.tsx`** — Gradient bg, glass form
17. **`src/components/player-detail-sheet.tsx`** — Updated sheet bg, glass internal cards
18. **`src/components/formation-field.tsx`** — Player bubble border glow
19. **`src/components/empty-state.tsx`** — Updated for teal theme
20. **`src/components/skeleton.tsx`** — Glass-tinted skeleton colors
21. **`src/components/token-coin.tsx`** — Updated for teal theme
22. **New: `src/components/gradient-screen.tsx`** — Shared gradient background wrapper
23. **New: `src/components/glass-card.tsx`** — Shared glass card component

### What Stays the Same

- All business logic, services, hooks, routing — zero changes
- Position colors (GK amber, DEF blue, MID green, W purple, ST red)
- Formation field green pitch gradient
- Screen layout structures and component hierarchy
- Data flow and state management

## Visual References

Mockups are saved in `.superpowers/brainstorm/1576-1773760841/`:
- `design-direction.html` — Current vs Omada comparison
- `color-palette.html` — Green palette options (teal selected)
- `teal-screens.html` — 4 screen mockups
- `font-options.html` — Font comparison (Fredoka selected)
- `final-preview.html` — Approved final design
