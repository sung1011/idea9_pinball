import type { SkillSlot } from '../input/actionTypes';
import type { HeroId } from './heroIds';

/** 圆形剪影 v1：public/skillIcons 下 256×256 WebP（圆外透明、无木环），按英雄×槽显式映射。第五键必杀不在本包。 */
export const SKILL_ICON_FILES: Record<HeroId, readonly [string, string, string, string]> = {
  hook: [
    'skill-hook-1-spear.webp',
    'skill-hook-2-thrust.webp',
    'skill-hook-3-charge.webp',
    'skill-hook-4-store.webp',
  ],
  ring: [
    'skill-ring-1-glow.webp',
    'skill-ring-2-repulse.webp',
    'skill-ring-3-wallrun.webp',
    'skill-ring-4-cage.webp',
  ],
  chain: [
    'skill-chain-1-heal.webp',
    'skill-chain-2-leech.webp',
    'skill-chain-3-yank.webp',
    'skill-chain-4-silence.webp',
  ],
  nail: [
    'skill-nail-1-armor.webp',
    'skill-nail-2-thorn.webp',
    'skill-nail-3-ram.webp',
    'skill-nail-4-anchor.webp',
  ],
  arc: [
    'skill-arc-1-blink.webp',
    'skill-arc-2-blade.webp',
    'skill-arc-3-mark.webp',
    'skill-arc-4-phase.webp',
  ],
  well: [
    'skill-well-1-burst.webp',
    'skill-well-2-swap.webp',
    'skill-well-3-stake.webp',
    'skill-well-4-bind.webp',
  ],
  mirror: [
    'skill-mirror-1-refract.webp',
    'skill-mirror-2-reflect.webp',
    'skill-mirror-3-crack.webp',
    'skill-mirror-4-wall.webp',
  ],
};

/** 与文件一一对应：钩矛/连刺/盾冲/蓄势 … 镜壁 */
export const SKILL_ICON_LABELS: Record<HeroId, readonly [string, string, string, string]> = {
  hook: ['钩矛', '连刺', '盾冲', '蓄势'],
  ring: ['辉环', '斥波', '壁行', '囚环'],
  chain: ['愈链', '盾脉', '援勾', '扰锋'],
  nail: ['甲垒', '刺盾', '顶冲', '钉锚'],
  arc: ['侧闪', '掠刃', '回印', '虚影'],
  well: ['索爆', '易位', '索桩', '回索'],
  mirror: ['折光', '反照', '裂镜', '镜壁'],
};

export const SKILL_ICON_COUNT = 28;
export const SKILL_ICON_BYTES = 96134;

export function skillIconFile(hero: HeroId, slot: SkillSlot): string {
  return SKILL_ICON_FILES[hero][slot - 1] ?? '';
}

export function skillIconUrl(hero: HeroId, slot: SkillSlot): string {
  const file = skillIconFile(hero, slot);
  if (!file) {
    return '';
  }
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}skillIcons/${file}`;
}
