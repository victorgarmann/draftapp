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
- The stacked header area (group picker + deadline strip + token tray) renders 4 UI layers before any content appears. Combine the deadline strip and token tray into a single compact row: deadline text on the left, token coins on the right. Reduces visual weight before the formation field.

**Fixtures — Predict tab**
- "HOW TOKENS WORK" section (3 stacked token cards) is too heavy above the predictions. Replace with a single collapsible hint row: a muted one-liner ("Earn tokens by predicting correctly ›") that expands inline to show the 3 token types. Collapsed by default.

**Group Detail — Creator Settings**
- Color swatches (8 circles), tokens toggle, and draft order toggle are visually noisy. Consolidate into a clean "Settings" card with standard row layout: label on left, control (Switch or small swatch row) on right. Same information, less clutter.

**Profile**
- Stats grid: reduce from 6 tiles to 4 (Total Points, Groups Played, Prediction Accuracy, Tokens Earned). Remove "Win Rate" (redundant with accuracy) and "Tokens Used" (low signal for a pitch audience).

**Home, Draft tab, Standings, Draft Board**
- No changes needed. Density is appropriate on these screens.

---

## 2. Hide Incomplete / Dev-Facing Features

### Remove entirely
- "Seed Real Data" section on Profile screen (button + status indicator + monospace log output). This is a dev tool and signals "prototype" to a partner.
- Any football-data.org or CL (Champions League) references visible in UI.

### Hide but preserve code
- Second draft trigger: keep `startSecondDraft` logic, but do not expose a UI button unless explicitly needed in the demo.
- Notification permission prompts: suppress during demo (avoid a denied-permission popup mid-walkthrough).
- Trading-related UI: no UI surfaces this currently — confirm nothing leaks through and keep it that way.

---

## 3. FotMob Branding (Minimal)

Two touchpoints only — enough to prompt the conversation, not enough to seem presumptuous:

- **Player Detail Sheet:** Add a small "Rating by FotMob" badge next to the fotmob_rating value. Teal-tinted, small font, subtle.
- **My Team — Points tab:** Existing "Ratings powered by FotMob" footer text stays. Make it slightly more visible (T.textSecondary instead of T.textMuted).

The slide deck carries the "your data powers this" partnership narrative. The app just needs to make FotMob's role legible at a glance.

---

## 4. Demo Flow Preparation

### Pre-Seeded Demo State
A hidden developer utility (accessible only from a dev menu or direct function call — not visible to users) that seeds a convincing mid-season state:

**Group:** "WC Fantasy" — 4 members (authenticated user + 3 fake accounts with real-sounding names)

**Draft:** Complete. 15 players per squad. Realistic player distribution — no team cap violations, valid formations.

**Ratings:** 3 matchdays scored with realistic point spreads. Standings have clear separation (not all tied). Leader has ~20pt gap over last place.

**Predictions:** Each member has predictions for MD1–3. Mix of correct/wrong outcomes. Each member has 1–2 tokens earned.

**Tokens:** 1 token already used (Nullify or Double Points) so the "Used" badge state is visible in the Tokens tab.

**Starting lineups:** Set and locked for past matchdays (so Points tab shows a full breakdown, not empty).

### Live Draft Demo
- A second group pre-created in "waiting" state with 2 members (user + 1 fake account).
- The fake account auto-picks after a short delay (2–3 seconds) to simulate a real opponent without needing a second device.
- Draft has only 2 members to keep the session short (fits in the ~60 second demo window).

### Offline Resilience
- All screens with data lists should show their last-loaded state gracefully if Supabase is slow or unreachable — no blank screens or unhandled errors.
- Pull-to-refresh should complete (success or silent fail) within 2 seconds on cached data.
- Test on airplane mode before the meeting.

### Scripted Walkthrough (~2 minutes)
1. **Home** — app opens to active group, standings preview, upcoming matchday countdown (5s)
2. **Group Detail** — members list, invite code, draft status (10s)
3. **My Team** — formation field, Points tab with matchday breakdown, Tokens tab with used token (15s)
4. **Fixtures** — upcoming matchday predictions, Calendar view (10s)
5. **Standings** — leaderboard, tap member to see their squad (10s)
6. **Live draft** — create group, join with "opponent", run 4–5 picks of snake draft (60s)
7. **Home** — return to show new group alongside mid-season group (10s)

---

## Out of Scope

- Trading UI (schema ready, no UI — do not expose)
- Push notifications
- AdMob integration
- New features of any kind
- Redesigns of screens not listed in Section 1
- Real FotMob API integration (mock data is sufficient for the pitch)
