import type { SkillSlot } from '../input/actionTypes';
import { HERO_IDS, type HeroId } from '../heroes/heroIds';
import { skillNames } from '../heroes/kitLabels';
import { SKILL_ICON_FILES, skillIconUrl } from '../heroes/skillIcons';
import { HOOK_TECH_DEFS } from './hookTech';
import { isHookTechId, type HookTechId } from './techIds';

export const TECH_NORMAL_SLOTS = [1, 2, 3, 4] as const;
export type TechNormalSlot = (typeof TECH_NORMAL_SLOTS)[number];

export type LiveHeroTechSlot = {
  kind: 'live';
  hero: HeroId;
  slot: TechNormalSlot;
  name: string;
  iconFile: string;
  iconUrl: string;
  techId: HookTechId;
  cost: number;
  effect: string;
};

export type TodoHeroTechSlot = {
  kind: 'todo';
  hero: HeroId;
  slot: TechNormalSlot;
  name: string;
  iconFile: string;
  iconUrl: string;
  techId: string;
};

export type HeroTechSlot = LiveHeroTechSlot | TodoHeroTechSlot;

/** 占位键，不是可买科技 ID，不能写入 litTechs。 */
export function todoSlotId(hero: HeroId, slot: TechNormalSlot): string {
  return `todo.${hero}.${slot}`;
}

export function isBuyableTechId(id: string): id is HookTechId {
  return isHookTechId(id);
}

/** 当前英雄普通四技能科技槽：名称/图标/顺序读现有定义；非钩刺一律 todo。必杀不入。 */
export function heroTechSlots(hero: HeroId): readonly HeroTechSlot[] {
  const names = skillNames(hero);
  const files = SKILL_ICON_FILES[hero];
  return TECH_NORMAL_SLOTS.map((slot) => {
    const idx = slot - 1;
    const name = names[idx] ?? '';
    const iconFile = files[idx] ?? '';
    const iconUrl = skillIconUrl(hero, slot as SkillSlot);
    if (hero === 'hook') {
      const def = HOOK_TECH_DEFS.find((item) => item.slot === slot);
      if (def) {
        return {
          kind: 'live',
          hero,
          slot,
          name,
          iconFile,
          iconUrl,
          techId: def.id,
          cost: def.cost,
          effect: def.effect,
        };
      }
    }
    return {
      kind: 'todo',
      hero,
      slot,
      name,
      iconFile,
      iconUrl,
      techId: todoSlotId(hero, slot),
    };
  });
}

export function allHeroTechSlots(): readonly HeroTechSlot[] {
  return HERO_IDS.flatMap((id) => heroTechSlots(id));
}
