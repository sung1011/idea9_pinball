export type HeroId = 'hook' | 'ring';

export function isHeroId(value: string): value is HeroId {
  return value === 'hook' || value === 'ring';
}

export function nextHero(hero: HeroId): HeroId {
  return hero === 'hook' ? 'ring' : 'hook';
}
