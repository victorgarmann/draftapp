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
