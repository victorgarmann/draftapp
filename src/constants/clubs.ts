// WC 2026 national team registry — 42 confirmed qualifiers (as of Mar 2026)
// Names match FotMob team names (used as team_name in DB).
// fdIds from football-data.org — used by seed script only.
// Flag images from flagcdn.com (ISO 3166-1 alpha-2 codes).

export type Confederation =
  | 'UEFA'
  | 'CONMEBOL'
  | 'CAF'
  | 'AFC'
  | 'CONCACAF'
  | 'OFC';

export interface ClubInfo {
  name: string;        // FotMob team name (used as team_name in DB)
  fotmobName?: string; // alternate FotMob name alias
  shortName: string;   // 3-letter display code
  confederation: Confederation;
  logoUrl: string;
  fdId: number;        // football-data.org team ID (used by seed script)
}

const FLAG = (code: string) => `https://flagcdn.com/w80/${code}.png`;

export const CLUBS: ClubInfo[] = [
  // ── UEFA (12) ───────────────────────────────────────────────
  { name: 'Germany',        shortName: 'GER', confederation: 'UEFA',     fdId: 759,  logoUrl: FLAG('de')     },
  { name: 'France',         shortName: 'FRA', confederation: 'UEFA',     fdId: 773,  logoUrl: FLAG('fr')     },
  { name: 'England',        shortName: 'ENG', confederation: 'UEFA',     fdId: 770,  logoUrl: FLAG('gb-eng') },
  { name: 'Spain',          shortName: 'ESP', confederation: 'UEFA',     fdId: 760,  logoUrl: FLAG('es')     },
  { name: 'Portugal',       shortName: 'POR', confederation: 'UEFA',     fdId: 765,  logoUrl: FLAG('pt')     },
  { name: 'Netherlands',    shortName: 'NED', confederation: 'UEFA',     fdId: 779,  logoUrl: FLAG('nl')     },
  { name: 'Belgium',        shortName: 'BEL', confederation: 'UEFA',     fdId: 805,  logoUrl: FLAG('be')     },
  { name: 'Croatia',        shortName: 'CRO', confederation: 'UEFA',     fdId: 799,  logoUrl: FLAG('hr')     },
  { name: 'Switzerland',    shortName: 'SUI', confederation: 'UEFA',     fdId: 788,  logoUrl: FLAG('ch')     },
  { name: 'Austria',        shortName: 'AUT', confederation: 'UEFA',     fdId: 816,  logoUrl: FLAG('at')     },
  { name: 'Norway',         shortName: 'NOR', confederation: 'UEFA',     fdId: 781,  logoUrl: FLAG('no')     },
  { name: 'Scotland',       shortName: 'SCO', confederation: 'UEFA',     fdId: 771,  logoUrl: FLAG('gb-sct') },
  // ── CONMEBOL (6) ────────────────────────────────────────────
  { name: 'Argentina',      shortName: 'ARG', confederation: 'CONMEBOL', fdId: 762,  logoUrl: FLAG('ar')     },
  { name: 'Brazil',         shortName: 'BRA', confederation: 'CONMEBOL', fdId: 764,  logoUrl: FLAG('br')     },
  { name: 'Colombia',       shortName: 'COL', confederation: 'CONMEBOL', fdId: 800,  logoUrl: FLAG('co')     },
  { name: 'Uruguay',        shortName: 'URU', confederation: 'CONMEBOL', fdId: 775,  logoUrl: FLAG('uy')     },
  { name: 'Ecuador',        shortName: 'ECU', confederation: 'CONMEBOL', fdId: 801,  logoUrl: FLAG('ec')     },
  { name: 'Paraguay',       shortName: 'PAR', confederation: 'CONMEBOL', fdId: 776,  logoUrl: FLAG('py')     },
  // ── CAF (9) ─────────────────────────────────────────────────
  { name: 'Morocco',        shortName: 'MAR', confederation: 'CAF',      fdId: 1001, logoUrl: FLAG('ma')     },
  { name: 'Senegal',        shortName: 'SEN', confederation: 'CAF',      fdId: 843,  logoUrl: FLAG('sn')     },
  { name: 'Egypt',          shortName: 'EGY', confederation: 'CAF',      fdId: 828,  logoUrl: FLAG('eg')     },
  { name: 'Ivory Coast',    fotmobName: "Côte d'Ivoire", shortName: 'CIV', confederation: 'CAF', fdId: 1004, logoUrl: FLAG('ci') },
  { name: 'Nigeria',        shortName: 'NGA', confederation: 'CAF',      fdId: 1003, logoUrl: FLAG('ng')     },
  { name: 'Tunisia',        shortName: 'TUN', confederation: 'CAF',      fdId: 1006, logoUrl: FLAG('tn')     },
  { name: 'Algeria',        shortName: 'ALG', confederation: 'CAF',      fdId: 1005, logoUrl: FLAG('dz')     },
  { name: 'South Africa',   shortName: 'RSA', confederation: 'CAF',      fdId: 1007, logoUrl: FLAG('za')     },
  { name: 'Cape Verde',     shortName: 'CPV', confederation: 'CAF',      fdId: 1008, logoUrl: FLAG('cv')     },
  // ── AFC (8) ─────────────────────────────────────────────────
  { name: 'Japan',          shortName: 'JPN', confederation: 'AFC',      fdId: 796,  logoUrl: FLAG('jp')     },
  { name: 'South Korea',    fotmobName: 'Korea Republic', shortName: 'KOR', confederation: 'AFC', fdId: 766, logoUrl: FLAG('kr') },
  { name: 'Australia',      shortName: 'AUS', confederation: 'AFC',      fdId: 756,  logoUrl: FLAG('au')     },
  { name: 'Saudi Arabia',   shortName: 'KSA', confederation: 'AFC',      fdId: 1010, logoUrl: FLAG('sa')     },
  { name: 'Qatar',          shortName: 'QAT', confederation: 'AFC',      fdId: 1026, logoUrl: FLAG('qa')     },
  { name: 'Jordan',         shortName: 'JOR', confederation: 'AFC',      fdId: 1013, logoUrl: FLAG('jo')     },
  { name: 'Uzbekistan',     shortName: 'UZB', confederation: 'AFC',      fdId: 1014, logoUrl: FLAG('uz')     },
  { name: 'Iran',           fotmobName: 'IR Iran', shortName: 'IRN',     confederation: 'AFC', fdId: 1011, logoUrl: FLAG('ir') },
  // ── CONCACAF (6) ────────────────────────────────────────────
  { name: 'United States',  fotmobName: 'USA', shortName: 'USA', confederation: 'CONCACAF', fdId: 768,  logoUrl: FLAG('us') },
  { name: 'Mexico',         shortName: 'MEX', confederation: 'CONCACAF', fdId: 758,  logoUrl: FLAG('mx')     },
  { name: 'Canada',         shortName: 'CAN', confederation: 'CONCACAF', fdId: 772,  logoUrl: FLAG('ca')     },
  { name: 'Panama',         shortName: 'PAN', confederation: 'CONCACAF', fdId: 1020, logoUrl: FLAG('pa')     },
  { name: 'Haiti',          shortName: 'HAI', confederation: 'CONCACAF', fdId: 1021, logoUrl: FLAG('ht')     },
  { name: 'Curaçao',        shortName: 'CUW', confederation: 'CONCACAF', fdId: 1022, logoUrl: FLAG('cw')     },
  // ── OFC (1) ─────────────────────────────────────────────────
  { name: 'New Zealand',    shortName: 'NZL', confederation: 'OFC',      fdId: 1025, logoUrl: FLAG('nz')     },
];

export const CONFEDERATIONS: Confederation[] = [
  'UEFA', 'CONMEBOL', 'CAF', 'AFC', 'CONCACAF', 'OFC',
];

/** Look up a club by exact team_name. */
export function getClub(teamName: string): ClubInfo | undefined {
  return CLUBS.find((c) => c.name === teamName);
}

/**
 * Try to match a team name — exact first, then fuzzy fallback.
 */
export function findClub(teamName: string): ClubInfo | undefined {
  const exact = CLUBS.find((c) => c.name === teamName || c.fotmobName === teamName);
  if (exact) return exact;
  const lower = teamName.toLowerCase();
  return CLUBS.find(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      lower.includes(c.name.toLowerCase()) ||
      (c.fotmobName && (c.fotmobName.toLowerCase().includes(lower) || lower.includes(c.fotmobName.toLowerCase()))) ||
      lower.includes(c.shortName.toLowerCase()) ||
      c.shortName.toLowerCase() === lower,
  );
}
