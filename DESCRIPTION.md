# ChampDraft

A Champions League fantasy draft app where groups of friends draft real players and compete based on FotMob player ratings. Built in partnership with FotMob.

## Core Concept

Friends create private draft groups (2–20 players), take turns picking Champions League players in a snake draft, and earn points throughout the tournament based on their players' actual FotMob match ratings. The scoring is simple: a FotMob rating of 6.0 is the baseline (0 points), and every tenth above or below counts (7.2 = +1.2 pts, 5.3 = -0.7 pts).

## Draft

- **Format:** Snake draft (e.g., 1-2-3-3-2-1). The group creator decides whether pick order is random or manually set.
- **Timing:** The draft takes place before the Champions League league phase. Groups can schedule their draft for a later date if preferred.
- **Squad structure (15 players):**
  - **Starting XI (4-3-3):** 1 GK, 2 CB, 1 RB, 1 LB, 3 CM, 1 ST, 2 W
  - **Bench (4):** 1 reserve per position group (GK, DEF, MID, ATT)
- **Restrictions:** Maximum 2 players from the same club.

## Scoring

- Points are based on FotMob match ratings (1–10 scale).
- Baseline is 6.0. Points per match = FotMob rating − 6.0.
  - Example: Rating 8.1 → +2.1 points. Rating 4.5 → −1.5 points.
- Only the user's selected starting XI earns points. Bench players earn nothing.
- If a starting XI player does not feature in a match, they earn 0 points (not negative).
- Points accumulate across all Champions League matches throughout the tournament.
- Team performance (advancing rounds, winning matches) does not affect scoring.

## Lineup Management

- Users must set their starting XI before each matchday.
- **Deadline:** 24 hours before the first kickoff of each matchday.
- If a user doesn't update their lineup, the previous matchday's XI carries over.

## Draft Periods

There are two drafts across the season:

### First Draft — League Phase

- Held before or during the Champions League league phase.
- Standard snake draft as described above.
- Squad size: 15 players (starting XI + 4 bench).

### Second Draft — Round of 16

- Triggered when 16 teams remain in the tournament.
- All squads are fully reset — every user drafts a new 15-player squad from scratch.
- **Draft order:** Reverse standings (lowest score picks first), snake format.
- **All tokens are reset** at the start of the second draft period — any banked tokens are cleared.

## Predictions & Tokens

Each week, 3 Champions League matches are auto-selected as the headline fixtures for that matchday, chosen by ranking the participating clubs by their UEFA club coefficient and picking the 3 highest-profile matchups. Before those matches kick off, each match is publicly assigned one token reward — all three matches carry different tokens, chosen at random. The token assignments are visible to all users before predictions are locked in.

Users predict the **exact final score** of each match. A correct prediction earns the token tied to that match.

### Tokens

| Token             | Effect                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Nullify**       | Target any player owned by an opponent in your group. That player earns 0 points for one specific match of your choosing. |
| **Double Points** | Choose one player in your starting XI. They earn 2× points for one specific match.                                        |
| **Bench Boost**   | Activate one bench player. They earn points for that matchday as if they were in the starting XI.                         |

- Tokens **cannot be stacked** — only one token may be active per matchday.
- Unused tokens can be banked indefinitely — there is no maximum.
- The Nullify token applies to a **single match**, not the player's entire matchday.
- The Nullify target can be any player owned by **any opponent** within your group.
- **Nullify limits:** The same player can be Nullified a maximum of **3 times during the league phase** and **1 time during the knockout phase**.

### Token Timing

- **Predictions** are submitted before the relevant matches kick off.
- **Token activation** has its own deadline, set after the starting XI deadline each matchday.
- Unused tokens are **banked** with no limit and can be carried forward to future matchdays.
- All banked tokens are **reset** when the second draft period begins (Round of 16).

## Groups

- One user creates a group and becomes the group creator.
- Other users join via an **invite link** or **passcode**.
- **Group size:** Minimum 2, maximum 20.
- Users can be members of multiple draft groups simultaneously.
- **Creator powers:** Decides whether draft pick order is random or manually assigned, and sets the draft date.

## Notifications

- A starting XI player is ruled out (injured/suspended) before a matchday.
- A player puts in a standout performance (FotMob rating ≥ 9.0 or ≤ 4.0).
- Your position in the group standings changes.
- The group leader changes.
- Draft turn reminders.
- Token activation deadline approaching.
- Second draft period opening.

## Accounts & Platform

- Users must create an account to participate.
- **Primary platform:** Mobile app (iOS & Android).
- **Secondary platform:** Web app.
- Monetization through ads (Google AdMob).

## Tech Stack

| Layer              | Tool                           | Purpose                                             |
| ------------------ | ------------------------------ | --------------------------------------------------- |
| Mobile + Web       | React Native (Expo)            | Cross-platform app from one codebase                |
| Auth               | Firebase Auth                  | Email, Google, and Apple sign-in                    |
| Database           | Supabase (PostgreSQL)          | Relational data — groups, squads, scores, tokens    |
| Backend logic      | Supabase Edge Functions        | Draft engine, scoring, token validation             |
| Data service       | Python Cloud Function          | Abstraction layer for player data and match ratings |
| Push notifications | Firebase Cloud Messaging (FCM) | Matchday alerts, standings changes, token deadlines |
| Ads                | Google AdMob                   | In-app ad monetization                              |

## FotMob Integration

- Player data, match ratings, and stats will ultimately be sourced from FotMob.
- Player profiles display FotMob-style ratings (1–10 scale).
- **Prototype phase:** FotMob's API is behind Cloudflare Turnstile, so unofficial access to detailed data (player ratings, lineups) is blocked. The prototype will use:
  - Real CL player/team/fixture data from FotMob's open endpoints (search, league listings).
  - Mock player match ratings (realistic 1–10 values) to simulate scoring.
- **Production phase:** Official FotMob API access via partnership. The data layer is abstracted behind a single service, so swapping mock data for real FotMob data requires changing one module.
- Partnership with FotMob planned — reach out with working ChampDraft prototype demo.
