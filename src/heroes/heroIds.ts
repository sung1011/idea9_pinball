export type HeroId = 'hook' | 'ring' | 'chain';

const HERO_CYCLE: readonly HeroId[] = ['hook', 'ring', 'chain'];

export function isHeroId(value: string): value is HeroId {
  return value === 'hook' || value === 'ring' || value === 'chain';
}

export function nextHero(hero: HeroId): HeroId {
  const idx = HERO_CYCLE.indexOf(hero);
  return HERO_CYCLE[(idx + 1) % HERO_CYCLE.length] ?? 'hook';
}

export function heroZh(hero: HeroId): string {
  if (hero === 'ring') {
    return '磁环';
  }
  if (hero === 'chain') {
    return '链生';
  }
  return '钩刺';
}
