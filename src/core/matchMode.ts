export const MATCH_MODE_IDS = ['eightKill', 'controlPoint'] as const;

export type MatchModeId = (typeof MATCH_MODE_IDS)[number];

export const DEFAULT_MATCH_MODE: MatchModeId = 'eightKill';

export const MATCH_MODE_LABEL: Record<MatchModeId, string> = {
  eightKill: '八杀',
  controlPoint: '占点',
};

export function isMatchModeId(value: string): value is MatchModeId {
  return value === 'eightKill' || value === 'controlPoint';
}

export function isEightKill(mode: MatchModeId): boolean {
  return mode === 'eightKill';
}

export function isControlPointMode(mode: MatchModeId): boolean {
  return mode === 'controlPoint';
}
