import type { SquadSlot, Position } from '../types/models';

export const STARTING_SLOTS: SquadSlot[] = [
  'GK', 'CB1', 'CB2', 'RB', 'LB', 'CM1', 'CM2', 'CM3', 'ST', 'W1', 'W2',
];

export const BENCH_SLOTS: SquadSlot[] = [
  'BENCH_GK', 'BENCH_DEF', 'BENCH_MID', 'BENCH_ATT',
];

export const ALL_SLOTS: SquadSlot[] = [...STARTING_SLOTS, ...BENCH_SLOTS];

export const SQUAD_SIZE = 15;
export const STARTING_XI_SIZE = 11;
export const BENCH_SIZE = 4;
export const MAX_PLAYERS_PER_CLUB = 2;

export const SLOT_POSITION_MAP: Record<SquadSlot, Position> = {
  GK: 'GK',
  CB1: 'CB', CB2: 'CB', RB: 'RB', LB: 'LB',
  CM1: 'CM', CM2: 'CM', CM3: 'CM',
  ST: 'ST', W1: 'W', W2: 'W',
  BENCH_GK: 'GK',
  BENCH_DEF: 'CB', // can be any defender
  BENCH_MID: 'CM',
  BENCH_ATT: 'ST', // can be any attacker
};
