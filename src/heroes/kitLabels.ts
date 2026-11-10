import type { SkillSlot } from '../input/actionTypes';
import { ARC_KIT_DISPLAY_NAME, ARC_SKILL_NAMES, ARC_SKILL_SHORT } from './arcKit';
import { CHAIN_KIT_DISPLAY_NAME, CHAIN_SKILL_NAMES, CHAIN_SKILL_SHORT } from './chainKit';
import type { HeroId } from './heroIds';
import { HOOK_SKILL_NAMES, HOOK_SKILL_SHORT, KIT_DISPLAY_NAME } from './hookKit';
import { NAIL_KIT_DISPLAY_NAME, NAIL_SKILL_NAMES, NAIL_SKILL_SHORT } from './nailKit';
import { RING_KIT_DISPLAY_NAME, RING_SKILL_NAMES, RING_SKILL_SHORT } from './ringKit';
import { MIRROR_KIT_DISPLAY_NAME, MIRROR_SKILL_NAMES, MIRROR_SKILL_SHORT } from './mirrorKit';
import { WELL_KIT_DISPLAY_NAME, WELL_SKILL_NAMES, WELL_SKILL_SHORT } from './wellKit';

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
  if (hero === 'mirror') {
    return MIRROR_KIT_DISPLAY_NAME;
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
  if (hero === 'mirror') {
    return MIRROR_SKILL_SHORT;
  }
  return HOOK_SKILL_SHORT;
}

export function skillNames(hero: HeroId): readonly [string, string, string, string] {
  if (hero === 'ring') {
    return RING_SKILL_NAMES;
  }
  if (hero === 'chain') {
    return CHAIN_SKILL_NAMES;
  }
  if (hero === 'nail') {
    return NAIL_SKILL_NAMES;
  }
  if (hero === 'arc') {
    return ARC_SKILL_NAMES;
  }
  if (hero === 'well') {
    return WELL_SKILL_NAMES;
  }
  if (hero === 'mirror') {
    return MIRROR_SKILL_NAMES;
  }
  return HOOK_SKILL_NAMES;
}

/** 设计表「效果」压成一行，给技能键长按浮层。 */
const HOOK_SKILL_TIPS = [
  '勾中后自己飞向目标贴脸',
  '朝向连捅三次，第三下硬直',
  '冲刺碰敌强推并开撞窗',
  '急停蓄力后按弹出瞬间枪尖方向弹出',
] as const;

const RING_SKILL_TIPS = [
  '身周磁场，敌持续掉血',
  '锥形击退并造成伤害',
  '沿墙滑行后按朝向弹出',
  '点地困圈，物理关死出不去',
] as const;

const CHAIN_SKILL_TIPS = [
  '扇内友持续回血，敌持续掉血',
  '与一名敌人粘住吸血 3 秒',
  '拉向友军或击退敌人',
  '身周范围沉默，敌不能放技能',
] as const;

const NAIL_SKILL_TIPS = [
  '短时减碰撞伤，未破则回血',
  '被撞反击并小推',
  '短冲命中开主动撞窗',
  '钉住敌人短暂不能动',
] as const;

const ARC_SKILL_TIPS = [
  '瞬移到瞄准扇内最近敌背后',
  '刀刃荼毒 8 秒，下次枪尖成功掉血 +6',
  '标记后下次撞击加伤',
  '短暂无碰撞，结束可开撞窗',
] as const;

const WELL_SKILL_TIPS = [
  '身周四次爆炸，有桩则同步炸桩',
  '与敌人交换位置',
  '投桩当墙，己方撞桩开窗',
  '线上敌定身 2 秒不能动',
] as const;

const MIRROR_SKILL_TIPS = [
  '1.5 秒受伤减半并记入账本',
  '消耗账本扇形打首个敌人',
  '自伤 24 入账，周围溅 12',
  '身前短墙，敌弹己开窗',
] as const;

export function skillTips(hero: HeroId): readonly [string, string, string, string] {
  if (hero === 'ring') {
    return RING_SKILL_TIPS;
  }
  if (hero === 'chain') {
    return CHAIN_SKILL_TIPS;
  }
  if (hero === 'nail') {
    return NAIL_SKILL_TIPS;
  }
  if (hero === 'arc') {
    return ARC_SKILL_TIPS;
  }
  if (hero === 'well') {
    return WELL_SKILL_TIPS;
  }
  if (hero === 'mirror') {
    return MIRROR_SKILL_TIPS;
  }
  return HOOK_SKILL_TIPS;
}

export type SkillTipCopy = {
  name: string;
  effect: string;
};

export const ULT_TODO_COPY = 'todo';

export function heroHasUlt(hero: HeroId): boolean {
  return hero === 'hook' || hero === 'ring' || hero === 'chain';
}

export function ultShort(hero: HeroId): string {
  if (hero === 'hook') {
    return '无畏';
  }
  if (hero === 'ring') {
    return '沉磁';
  }
  if (hero === 'chain') {
    return '均血';
  }
  return '必杀';
}

export function ultName(hero: HeroId): string {
  if (hero === 'hook') {
    return '无畏冲锋';
  }
  if (hero === 'ring') {
    return '沉磁井';
  }
  if (hero === 'chain') {
    return '均血';
  }
  return '必杀';
}

export function ultTip(hero: HeroId): string {
  if (hero === 'hook') {
    return '后退三步后沿枪尖加速穿刺，碰敌不回头';
  }
  if (hero === 'ring') {
    return '前方选点落地后强吸 3 秒再爆炸，半径 4 格';
  }
  if (hero === 'chain') {
    return '以自身为圆心半径4格立刻均血，我方再回10%';
  }
  return ULT_TODO_COPY;
}

export function skillTipCopy(hero: HeroId, slot: SkillSlot): SkillTipCopy {
  if (slot === 5) {
    return { name: ultName(hero), effect: ultTip(hero) };
  }
  const names = skillNames(hero);
  const tips = skillTips(hero);
  return {
    name: names[slot - 1] ?? `技能${slot}`,
    effect: tips[slot - 1] ?? '',
  };
}

export function kitHudLine(hero: HeroId): string {
  const shorts = skillShorts(hero);
  return `${kitTitle(hero)}：1${shorts[0]} 2${shorts[1]} 3${shorts[2]} 4${shorts[3]} 5${ultShort(hero)} · 点地纠偏 · 同键或左键释放；触屏瞄准中点空白也可释放`;
}

export function kitHelpSkills(hero: HeroId): string {
  if (hero === 'ring') {
    return '技能 1–4：1 辉环（身周磁场） / 2 斥波 / 3 壁行 / 4 囚环（物理关死出不去）。第五键沉磁井（前方选点，最远 6 格，半径 4，落地即吸 3 秒后爆炸）。';
  }
  if (hero === 'chain') {
    return '技能 1–4：1 愈链（治疗链） / 2 盾脉 / 3 援勾 / 4 扰锋（范围沉默）。第五键均血（以自身为圆心半径 4，立刻按百分比算术平均调血，我方再回 10%）。';
  }
  if (hero === 'nail') {
    return '技能 1–4：1 甲垒（叠甲） / 2 刺盾 / 3 顶冲 / 4 钉锚（定锚）。第五键必杀占位。';
  }
  if (hero === 'arc') {
    return '技能 1–4：1 侧闪（侧移闪） / 2 掠刃 / 3 回印（标记回响） / 4 虚影（虚晃）。第五键必杀占位。';
  }
  if (hero === 'well') {
    return '技能 1–4：1 索爆（身周四脉冲，有桩则同步炸） / 2 易位 / 3 索桩 / 4 回索。第五键必杀占位。';
  }
  if (hero === 'mirror') {
    return '技能 1–4：1 折光（受伤减半入账） / 2 反照 / 3 裂镜 / 4 镜壁。第五键必杀占位。';
  }
  return '技能 1–4：1 钩矛 / 2 连刺×3 / 3 盾冲 / 4 蓄势。第五键无畏冲锋（满能量后退三步，每步 0.4 秒 / 0.8 格，再沿枪尖穿刺）。';
}

export function kitSettingsHint(hero: HeroId): string {
  if (hero === 'ring') {
    return '技能 1 辉环 / 2 斥波 / 3 壁行 / 4 囚环 / 5 沉磁井。按下进瞄，再按同键或左键释放。';
  }
  if (hero === 'chain') {
    return '技能 1 愈链 / 2 盾脉 / 3 援勾 / 4 扰锋 / 5 均血。按下进瞄，再按同键或左键释放。';
  }
  if (hero === 'nail') {
    return '技能 1 甲垒 / 2 刺盾 / 3 顶冲 / 4 钉锚 / 5 必杀。按下进瞄，再按同键或左键释放。';
  }
  if (hero === 'arc') {
    return '技能 1 侧闪 / 2 掠刃 / 3 回印 / 4 虚影 / 5 必杀。按下进瞄，再按同键或左键释放。';
  }
  if (hero === 'well') {
    return '技能 1 索爆 / 2 易位 / 3 索桩 / 4 回索 / 5 必杀。按下进瞄，再按同键或左键释放。';
  }
  if (hero === 'mirror') {
    return '技能 1 折光 / 2 反照 / 3 裂镜 / 4 镜壁 / 5 必杀。按下进瞄，再按同键或左键释放。';
  }
  return '技能 1 钩矛 / 2 连刺 / 3 盾冲 / 4 蓄势 / 5 无畏冲锋。按下进瞄，再按同键或左键释放。';
}
