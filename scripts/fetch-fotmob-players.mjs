#!/usr/bin/env node
// Fetch WC 2026 national team players from FotMob and seed into Supabase.
// Run from project root: node scripts/fetch-fotmob-players.mjs
//
// If a team returns 0 players, the script automatically searches FotMob
// for the correct team ID and retries — no manual ID lookup needed.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env ─────────────────────────────────────────────────────────────────

const envLines = readFileSync(resolve(__dirname, "..", ".env"), "utf8").split(
  "\n",
);
for (const line of envLines) {
  const [key, ...rest] = line.split("=");
  if (key?.trim() && rest.length)
    process.env[key.trim()] = rest.join("=").trim();
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── FotMob helpers ────────────────────────────────────────────────────────────

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.fotmob.com/",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fotmobGet(path) {
  const res = await fetch(`https://www.fotmob.com/api${path}`, {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Search FotMob for a national team by name and return its team ID.
// Returns null if no national team result is found.
async function discoverTeamId(teamName) {
  try {
    const data = await fotmobGet(
      `/search?term=${encodeURIComponent(teamName)}`,
    );
    // FotMob search returns hits in various buckets — look for a team entry
    const hits = [
      ...(data?.squadSearch ?? []),
      ...(data?.teamSearch ?? []),
      ...(data?.hits ?? []),
    ];
    for (const hit of hits) {
      const name = hit.name ?? hit.title ?? "";
      const type = hit.type ?? hit.pageType ?? "";
      if (
        type === "team" &&
        name.toLowerCase().includes(teamName.toLowerCase().split(" ")[0])
      ) {
        return { id: hit.id ?? hit.teamId, name: hit.name ?? hit.title };
      }
    }
  } catch {
    // search failed — skip
  }
  return null;
}

// ── Position mapping ──────────────────────────────────────────────────────────

function mapPosition(posDesc, groupTitle) {
  const first = (posDesc ?? "").split(",")[0].trim().toUpperCase();
  if (first === "GK") return "GK";
  if (first === "CB") return "CB";
  if (first === "RB") return "RB";
  if (first === "LB") return "LB";
  if (["LW", "RW", "LM", "RM"].includes(first)) return "W";
  if (["CAM", "AM", "CM", "CDM", "DM"].includes(first)) return "CM";
  if (["ST", "CF", "SS"].includes(first)) return "ST";
  const g = (groupTitle ?? "").toLowerCase();
  if (g === "keepers") return "GK";
  if (g === "defenders") return "CB";
  if (g === "midfielders") return "CM";
  if (g === "attackers") return "ST";
  return "CM";
}

// ── Fetch squad for a given FotMob team ID ────────────────────────────────────

async function fetchSquad(teamId) {
  const data = await fotmobGet(`/teams?id=${teamId}&tab=squad`);
  const groups = data?.squad?.squad ?? [];
  const players = [];
  for (const group of groups) {
    if (!group.members?.length) continue;
    if (
      !["keepers", "defenders", "midfielders", "attackers"].includes(
        group.title,
      )
    )
      continue;
    for (const p of group.members) {
      if (!p.id || !p.name) continue;
      players.push({
        fotmobId: String(p.id),
        name: p.name,
        position: mapPosition(p.positionIdsDesc, group.title),
      });
    }
  }
  return players;
}

// ── WC 2026 national teams (best-guess FotMob IDs) ───────────────────────────
// Wrong IDs are fixed automatically via the search fallback.

const WC_TEAMS = [
  // UEFA (12)
  { id: 8570, name: "Germany" },
  { id: 6723, name: "France" },
  { id: 8491, name: "England" },
  { id: 6720, name: "Spain" },
  { id: 8361, name: "Portugal" },
  { id: 6708, name: "Netherlands" },
  { id: 8263, name: "Belgium" },
  { id: 10155, name: "Croatia" },
  { id: 6717, name: "Switzerland" },
  { id: 8255, name: "Austria" },
  { id: 8492, name: "Norway" },
  { id: 8498, name: "Scotland" },
  // CONMEBOL (6)
  { id: 6706, name: "Argentina" },
  { id: 8256, name: "Brazil" },
  { id: 8258, name: "Colombia" },
  { id: 5796, name: "Uruguay" },
  { id: 6707, name: "Ecuador" },
  { id: 6724, name: "Paraguay" },
  // CAF (9)
  { id: 6262, name: "Morocco" },
  { id: 6395, name: "Senegal" },
  { id: 10255, name: "Egypt" },
  { id: 6709, name: "Ivory Coast" },
  { id: 6346, name: "Nigeria" },
  { id: 6719, name: "Tunisia" },
  { id: 6317, name: "Algeria" },
  { id: 6316, name: "South Africa" },
  { id: 5888, name: "Cape Verde" },
  // AFC (8)
  { id: 6715, name: "Japan" },
  { id: 7804, name: "South Korea" },
  { id: 6716, name: "Australia" },
  { id: 7795, name: "Saudi Arabia" },
  { id: 5902, name: "Qatar" },
  { id: 5816, name: "Jordan" },
  { id: 8700, name: "Uzbekistan" },
  { id: 6711, name: "Iran" },
  // CONCACAF (6)
  { id: 6713, name: "United States" },
  { id: 6710, name: "Mexico" },
  { id: 5810, name: "Canada" },
  { id: 5922, name: "Panama" },
  { id: 5934, name: "Haiti" },
  { id: 287981, name: "Curaçao" },
  // OFC (1)
  { id: 5820, name: "New Zealand" },
];

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log("FotDraft — WC 2026 FotMob player seeder\n");

  const playerRows = [];
  const seenIds = new Set();
  const failed = [];

  for (let i = 0; i < WC_TEAMS.length; i++) {
    const team = WC_TEAMS[i];
    process.stdout.write(
      `  [${String(i + 1).padStart(2)}/${WC_TEAMS.length}] ${team.name.padEnd(20)} `,
    );

    let players = [];
    let usedId = team.id;

    try {
      players = await fetchSquad(team.id);

      // If empty, search FotMob for the correct team ID and retry once
      if (players.length === 0) {
        process.stdout.write(`(0 — searching...) `);
        await sleep(400);
        const found = await discoverTeamId(team.name);
        if (found && found.id && found.id !== team.id) {
          await sleep(400);
          players = await fetchSquad(found.id);
          usedId = found.id;
          if (players.length > 0) {
            process.stdout.write(`found id=${found.id} `);
          }
        }
      }
    } catch (e) {
      console.log(`✗ ${e.message}`);
      failed.push(team.name);
      await sleep(600);
      continue;
    }

    if (players.length === 0) {
      console.log(`⚠ 0 players (squad may not be on FotMob yet)`);
      failed.push(team.name);
    } else {
      for (const p of players) {
        if (seenIds.has(p.fotmobId)) continue;
        seenIds.add(p.fotmobId);
        playerRows.push({
          fotmob_id: p.fotmobId,
          name: p.name,
          team_name: team.name,
          team_fotmob_id: String(usedId),
          position: p.position,
          is_available: true,
        });
      }
      console.log(`✓ ${players.length} players`);
    }

    if (i < WC_TEAMS.length - 1) await sleep(600);
  }

  console.log("");

  if (failed.length > 0) {
    console.warn(`Skipped (0 players or error): ${failed.join(", ")}\n`);
  }

  if (playerRows.length === 0) {
    console.error("No players fetched — all squads empty or requests failed.");
    process.exit(1);
  }

  console.log(`Seeding ${playerRows.length} players into Supabase...`);

  await supabase
    .from("players")
    .update({ is_available: false })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  for (let i = 0; i < playerRows.length; i += 200) {
    const { error } = await supabase
      .from("players")
      .upsert(playerRows.slice(i, i + 200), { onConflict: "fotmob_id" });
    if (error) {
      console.error("Upsert failed:", error.message);
      process.exit(1);
    }
  }

  console.log(`✓ ${playerRows.length} WC 2026 players seeded.\n`);
})();
