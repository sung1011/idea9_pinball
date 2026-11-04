export type HeroId = 'hook' | 'ring' | 'chain' | 'nail' | 'arc';

const HERO_CYCLE: readonly HeroId[] = ['hook', 'ring', 'chain', 'nail', 'arc'];

export function isHeroId(value: string): value is HeroId {
  return (
    value === 'hook' ||
    value === 'ring' ||
    value === 'chain' ||
    value === 'nail' ||
    value === 'arc'
  );
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
  if (hero === 'nail') {
    return '钉壳';
  }
  if (hero === 'arc') {
    return '闪弧';
  }
  return '钩刺';
}
