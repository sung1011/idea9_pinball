import type { HeroId } from './heroIds';
import { HOOK_SKILL_SHORT, KIT_DISPLAY_NAME } from './hookKit';
import { RING_KIT_DISPLAY_NAME, RING_SKILL_SHORT } from './ringKit';

export function kitTitle(hero: HeroId): string {
  return hero === 'ring' ? RING_KIT_DISPLAY_NAME : KIT_DISPLAY_NAME;
}

export function skillShorts(hero: HeroId): readonly [string, string, string, string] {
  return hero === 'ring' ? RING_SKILL_SHORT : HOOK_SKILL_SHORT;
}

export function kitHudLine(hero: HeroId): string {
  const shorts = skillShorts(hero);
  return `${kitTitle(hero)}：1${shorts[0]} 2${shorts[1]} 3${shorts[2]} 4${shorts[3]} · 点地纠偏 · 同键或左键释放`;
}

export function kitHelpSkills(hero: HeroId): string {
  if (hero === 'ring') {
    return '技能 1–4：1 辉环（身周磁场） / 2 斥波 / 3 壁行 / 4 囚环（困圈）。';
  }
  return '技能 1–4：1 钩矛 / 2 连刺×3 / 3 盾冲 / 4 蓄势。';
}

export function kitSettingsHint(hero: HeroId): string {
  if (hero === 'ring') {
    return '技能 1 辉环 / 2 斥波 / 3 壁行 / 4 囚环。按下进瞄，再按同键或左键释放。';
  }
  return '技能 1 钩矛 / 2 连刺 / 3 盾冲 / 4 蓄势。按下进瞄，再按同键或左键释放。';
}
