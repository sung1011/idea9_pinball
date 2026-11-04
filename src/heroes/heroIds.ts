export type HeroId = 'hook' | 'ring' | 'chain' | 'nail' | 'arc' | 'well';

const HERO_CYCLE: readonly HeroId[] = ['hook', 'ring', 'chain', 'nail', 'arc', 'well'];

export function isHeroId(value: string): value is HeroId {
  return (
    value === 'hook' ||
    value === 'ring' ||
    value === 'chain' ||
    value === 'nail' ||
    value === 'arc' ||
    value === 'well'
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
  if (hero === 'well') {
    return '井绳';
  }
  return '钩刺';
}
