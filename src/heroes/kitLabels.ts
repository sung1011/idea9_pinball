import { ARC_KIT_DISPLAY_NAME, ARC_SKILL_SHORT } from './arcKit';
import { CHAIN_KIT_DISPLAY_NAME, CHAIN_SKILL_SHORT } from './chainKit';
import type { HeroId } from './heroIds';
import { HOOK_SKILL_SHORT, KIT_DISPLAY_NAME } from './hookKit';
import { NAIL_KIT_DISPLAY_NAME, NAIL_SKILL_SHORT } from './nailKit';
import { RING_KIT_DISPLAY_NAME, RING_SKILL_SHORT } from './ringKit';
import { WELL_KIT_DISPLAY_NAME, WELL_SKILL_SHORT } from './wellKit';

export function kitTitle(hero: HeroId): string {
  if (hero === 'ring') {
    return RING_KIT_DISPLAY_NAME;
  }
  if (hero === 'chain') {
    return CHAIN_KIT_DISPLAY_NAME;
  }
  if (hero === 'nail') {
    return NAIL_KIT_DISPLAY_NAME;
  }
  if (hero === 'arc') {
    return ARC_KIT_DISPLAY_NAME;
  }
  if (hero === 'well') {
    return WELL_KIT_DISPLAY_NAME;
  }
  return KIT_DISPLAY_NAME;
}

export function skillShorts(hero: HeroId): readonly [string, string, string, string] {
  if (hero === 'ring') {
    return RING_SKILL_SHORT;
  }
  if (hero === 'chain') {
    return CHAIN_SKILL_SHORT;
  }
  if (hero === 'nail') {
    return NAIL_SKILL_SHORT;
  }
  if (hero === 'arc') {
    return ARC_SKILL_SHORT;
  }
  if (hero === 'well') {
    return WELL_SKILL_SHORT;
  }
  return HOOK_SKILL_SHORT;
}

export function kitHudLine(hero: HeroId): string {
  const shorts = skillShorts(hero);
  return `${kitTitle(hero)}：1${shorts[0]} 2${shorts[1]} 3${shorts[2]} 4${shorts[3]} · 点地纠偏 · 同键或左键释放`;
}

export function kitHelpSkills(hero: HeroId): string {
  if (hero === 'ring') {
    return '技能 1–4：1 辉环（身周磁场） / 2 斥波 / 3 壁行 / 4 囚环（困圈）。';
  }
  if (hero === 'chain') {
    return '技能 1–4：1 愈链（治疗链） / 2 盾脉 / 3 援勾 / 4 扰锋（朝向打乱）。';
  }
  if (hero === 'nail') {
    return '技能 1–4：1 甲垒（叠甲） / 2 刺盾 / 3 顶冲 / 4 钉锚（定锚）。';
  }
  if (hero === 'arc') {
    return '技能 1–4：1 侧闪（侧移闪） / 2 掠刃 / 3 回印（标记回响） / 4 虚影（虚晃）。';
  }
  if (hero === 'well') {
    return '技能 1–4：1 双索（双钩，先锁敌再点落点） / 2 易位 / 3 索桩 / 4 回索。';
  }
  return '技能 1–4：1 钩矛 / 2 连刺×3 / 3 盾冲 / 4 蓄势。';
}

export function kitSettingsHint(hero: HeroId): string {
  if (hero === 'ring') {
    return '技能 1 辉环 / 2 斥波 / 3 壁行 / 4 囚环。按下进瞄，再按同键或左键释放。';
  }
  if (hero === 'chain') {
    return '技能 1 愈链 / 2 盾脉 / 3 援勾 / 4 扰锋。按下进瞄，再按同键或左键释放。';
  }
  if (hero === 'nail') {
    return '技能 1 甲垒 / 2 刺盾 / 3 顶冲 / 4 钉锚。按下进瞄，再按同键或左键释放。';
  }
  if (hero === 'arc') {
    return '技能 1 侧闪 / 2 掠刃 / 3 回印 / 4 虚影。按下进瞄，再按同键或左键释放。';
  }
  if (hero === 'well') {
    return '技能 1 双索（先锁敌，再点落点） / 2 易位 / 3 索桩 / 4 回索。按下进瞄，再按同键或左键释放。';
  }
  return '技能 1 钩矛 / 2 连刺 / 3 盾冲 / 4 蓄势。按下进瞄，再按同键或左键释放。';
}
