export type Position = 'GK' | 'CB' | 'RB' | 'LB' | 'CM' | 'W' | 'ST';

export type SquadSlot =
  | 'GK1' | 'GK2'
  | 'DEF1' | 'DEF2' | 'DEF3' | 'DEF4' | 'DEF5'
  | 'MID1' | 'MID2' | 'MID3' | 'MID4' | 'MID5'
  | 'ATT1' | 'ATT2' | 'ATT3';

export type DraftStatus = 'pending' | 'in_progress' | 'completed';

export type DraftOrderMode = 'random' | 'manual';


export interface Player {
  id: string;
  fotmobId: string | null;
  name: string;
  teamName: string;
  position: Position;
  imageUrl: string | null;
  isAvailable: boolean;
}

export interface Group {
  id: string;
  name: string;
  creatorId: string;
  inviteCode: string;
  maxMembers: number;
  draftDate: string | null;
  draftStatus: DraftStatus;
  draftOrderMode: DraftOrderMode;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  draftPosition: number | null;
  totalPoints: number;
}

export interface SquadEntry {
  id: string;
  groupMemberId: string;
  playerId: string;
  slot: SquadSlot;
  isStarting: boolean;
}

export interface MatchRating {
  id: string;
  playerId: string;
  matchday: number;
  matchDate: string;
  opponentTeam: string | null;
  fotmobRating: number | null;
  points: number;
  isMock: boolean;
}

