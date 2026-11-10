import { HERO_IDS, isHeroId, type HeroId } from '../heroes/heroIds';

export const TECH_SAVE_KEY = 'ks.techSave';
export const TECH_SAVE_VERSION = 1;

export const HOOK_TECH_IDS = ['hookPull', 'hookStab', 'hookShove', 'hookBrake'] as const;
export type HookTechId = (typeof HOOK_TECH_IDS)[number];
export type TechId = HookTechId;

export const HERO_UNLOCK_COST_FIRST = 30;
export const HERO_UNLOCK_COST_LATER = 60;
export const HERO_UNLOCK_CHEAP_COUNT = 3;

export const TECH_REWARD_WIN = 20;
export const TECH_REWARD_LOSE = 10;
export const TECH_REWARD_DRAW = 10;
export const TECH_REWARD_EIGHT_FIRST = 20;
export const TECH_REWARD_EIGHT_REST = 10;

export type CombatTechSnapshot = {
  pull: boolean;
  stab: boolean;
  shove: boolean;
  brake: boolean;
};

export const EMPTY_COMBAT_TECHS: CombatTechSnapshot = {
  pull: false,
  stab: false,
  shove: false,
  brake: false,
};

export function isHookTechId(value: string): value is HookTechId {
  return (HOOK_TECH_IDS as readonly string[]).includes(value);
}

export function copyCombatTechs(src: CombatTechSnapshot = EMPTY_COMBAT_TECHS): CombatTechSnapshot {
  return {
    pull: !!src.pull,
    stab: !!src.stab,
    shove: !!src.shove,
    brake: !!src.brake,
  };
}

export function paidUnlockCount(unlocked: readonly HeroId[]): number {
  let n = 0;
  for (const id of unlocked) {
    if (id !== 'hook') {
      n += 1;
    }
  }
  return n;
}

export function heroUnlockCost(unlocked: readonly HeroId[]): number {
  return paidUnlockCount(unlocked) < HERO_UNLOCK_CHEAP_COUNT ? HERO_UNLOCK_COST_FIRST : HERO_UNLOCK_COST_LATER;
}

export function nextUnlockedHero(current: HeroId, unlocked: readonly HeroId[]): HeroId {
  const allow = new Set<HeroId>(['hook', ...unlocked.filter(isHeroId)]);
  let hero = current;
  for (let i = 0; i < HERO_IDS.length; i += 1) {
    const idx = HERO_IDS.indexOf(hero);
    hero = HERO_IDS[(idx + 1) % HERO_IDS.length] ?? 'hook';
    if (allow.has(hero)) {
      return hero;
    }
  }
  return 'hook';
}
