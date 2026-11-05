export type HeroId = 'hook' | 'ring' | 'chain' | 'nail' | 'arc' | 'well' | 'mirror';

export const HERO_IDS: readonly HeroId[] = ['hook', 'ring', 'chain', 'nail', 'arc', 'well', 'mirror'];

export function isHeroId(value: string): value is HeroId {
  return (HERO_IDS as readonly string[]).includes(value);
}

/** 含镜卫全池均匀随机；同局允许重复。 */
export function pickRandomHero(random: () => number = Math.random): HeroId {
  const n = HERO_IDS.length;
  let idx = Math.floor(random() * n);
  if (!Number.isFinite(idx) || idx < 0) {
    idx = 0;
  }
  if (idx >= n) {
    idx = n - 1;
  }
  return HERO_IDS[idx] ?? 'hook';
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
