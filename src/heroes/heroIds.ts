export type HeroId = 'hook' | 'ring' | 'chain' | 'nail' | 'arc' | 'well' | 'mirror';

export const HERO_IDS: readonly HeroId[] = ['hook', 'ring', 'chain', 'nail', 'arc', 'well', 'mirror'];

export function isHeroId(value: string): value is HeroId {
  return (HERO_IDS as readonly string[]).includes(value);
}

export function nextHero(hero: HeroId): HeroId {
  const idx = HERO_IDS.indexOf(hero);
  return HERO_IDS[(idx + 1) % HERO_IDS.length] ?? 'hook';
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
  if (hero === 'mirror') {
    return '镜卫';
  }
  return '钩刺';
}
