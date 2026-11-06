import { DEFAULT_MATCH_MODE, isMatchModeId, type MatchModeId } from './matchMode';

export const LAST_MODE_STORAGE_KEY = 'ks.lastModeId';

export function loadLastModeId(): MatchModeId {
  try {
    const raw = localStorage.getItem(LAST_MODE_STORAGE_KEY);
    if (raw && isMatchModeId(raw)) {
      return raw;
    }
  } catch {
    // ignore quota / private mode
  }
  return DEFAULT_MATCH_MODE;
}

export function saveLastModeId(mode: MatchModeId): void {
  try {
    localStorage.setItem(LAST_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore quota / private mode
  }
}
