# FotDraft — FotMob Pitch Demo Walkthrough

## Pre-Demo Setup

1. **Seed demo data:** Navigate to Profile → long-press the avatar for 3 seconds → tap "Reset".
2. **Verify:** Return to Home. You should see "WC Fantasy 2026" (mid-season state) and "Quick Draft" (live draft in progress).
3. **Network:** Ensure good WiFi or LTE. Demo data is pre-loaded so you can tolerate brief hiccups, but keep it connected.

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

| What happens                           | What to do                                                      |
| -------------------------------------- | --------------------------------------------------------------- |
| Screen shows spinner for >3s           | Pull down to refresh. If it persists, navigate away and back.   |
| Draft board shows empty or wrong state | Re-seed: Profile → long-press avatar → Reset. Then re-navigate. |
| Groups missing from Home               | Pull-to-refresh on Home.                                        |
| Crash or blank screen                  | Restart the app. All data is in Supabase — it will reload.      |
