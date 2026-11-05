import { isHeroId, type HeroId } from './heroIds';

export const LAST_HERO_STORAGE_KEY = 'ks.lastHeroId';
export const DEFAULT_PLAYER_HERO: HeroId = 'hook';

export function loadLastHeroId(): HeroId {
  try {
    const raw = localStorage.getItem(LAST_HERO_STORAGE_KEY);
    if (raw && isHeroId(raw)) {
      return raw;
    }
  } catch {
    // ignore quota / private mode
  }
  return DEFAULT_PLAYER_HERO;
}

export function saveLastHeroId(hero: HeroId): void {
  try {
    localStorage.setItem(LAST_HERO_STORAGE_KEY, hero);
  } catch {
    // ignore quota / private mode
  }
}
