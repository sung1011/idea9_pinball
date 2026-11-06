import {
  applyArmor,
  createBallBody,
  tickArmor,
  tickPin,
  tickStun,
  type BallBody,
} from './ballBody';
import { applyCollisionCombat, collisionDamage } from './collisionDamage';
import { ACTIVE_RAM_WINDOW, BALL_RADIUS, FLOOR_SPEED, HARD_CC_DIMINISH_WINDOW, MAX_HP } from './constants';
import { CHAIN_HEAL } from '../heroes/chainKit';
import { HOOK_PULL } from '../heroes/hookKit';
import { nextHero } from '../heroes/heroIds';
import { NAIL_ARMOR, NAIL_PIN, NAIL_RAM, NAIL_THORN } from '../heroes/nailKit';
import { RING_FIELD } from '../heroes/ringKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { applyNailReflect } from './nailCombat';
import { scaleHardCc } from './hardCc';
import { stepPhysics } from './physicsStep';
import { createSkillCaster } from './skillCaster';
import { resetTrapZones } from './trapZones';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function sample(partial: Partial<ActionSample>): ActionSample {
  return {
    aimX: 1,
    aimY: 0,
    hasAim: true,
    steerAim: true,
    skillPress: 0,
    confirmRelease: false,
    cancelAim: false,
    ...partial,
  };
}

function redBlue(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  redHero: 'nail' | 'hook' = 'nail',
): [BallBody, BallBody] {
  const a = createBallBody({
    x: x0,
    y: y0,
    color: 0xe24a4a,
    label: '红钉',
    team: 'red',
    facingX: 1,
    facingY: 0,
    hero: redHero,
  });
  const b = createBallBody({
    x: x1,
    y: y1,
    color: 0x3d7cf0,
    label: '蓝',
    team: 'blue',
    facingX: -1,
    facingY: 0,
    hero: 'hook',
  });
  return [a, b];
}

function fire(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  slot: SkillSlot,
  roster: readonly BallBody[] = [],
  extra: Partial<ActionSample> = {},
): void {
  caster.handleInput(ball, sample({ skillPress: slot, ...extra }), roster);
  caster.handleInput(ball, sample({ skillPress: slot, ...extra }), roster);
}

function play(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  dt: number,
): void {
  caster.tick(ball, dt, roster);
  const phys = stepPhysics(roster, dt);
  caster.afterPhysics(ball, dt, roster, phys.wallHitIds.includes(ball.id));
}

function advance(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  sec: number,
): void {
  let left = sec;
  while (left > 1e-9) {
    const dt = Math.min(1 / 60, left);
    play(caster, ball, roster, dt);
    left -= dt;
  }
}

function tickPinned(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  sec: number,
): void {
  let left = sec;
  while (left > 1e-9) {
    const dt = Math.min(1 / 60, left);
    for (const item of roster) {
      item.vx = 0;
      item.vy = 0;
    }
    caster.tick(ball, dt, roster);
    for (const item of roster) {
      tickArmor(item, dt, (target) => {
        target.hp = Math.min(target.maxHp, target.hp + NAIL_ARMOR.heal);
      });
      tickStun(item, dt);
      tickPin(item, dt, NAIL_PIN.breakDist);
    }
    left -= dt;
  }
}

/** 钉壳四技能：叠甲减伤回血、反击刺被动/主动、短冲顶、定锚断钉与额外伤。 */
export function verifyNail(): void {
  resetTrapZones();
  assert(NAIL_ARMOR.cd === 10 && NAIL_ARMOR.duration === 3.5 && NAIL_ARMOR.mul === 0.4, '钉壳：叠甲应为 CD10 / 3.5s / ×0.4');
  assert(NAIL_ARMOR.heal === 8, '钉壳：未破甲结束应回 8');
  assert(NAIL_THORN.cd === 9 && NAIL_THORN.passiveWindow === 2.5 && NAIL_THORN.passiveDamage === 12, '钉壳：反击刺被动应为 2.5s / 12');
  assert(NAIL_THORN.activeWindow === 3 && NAIL_THORN.activeDamage === 16, '钉壳：反击刺主动应为 3s / 16');
  assert(NAIL_RAM.cd === 8 && NAIL_RAM.dashDist === 3, '钉壳：短冲顶应为 CD8 / 冲 3');
  assert(NAIL_PIN.cd === 13 && NAIL_PIN.windup === 0.3 && NAIL_PIN.fanDeg === 45, '钉壳：定锚应为 CD13 / 前摇0.3 / 45°');
  assert(NAIL_PIN.range === 5 && NAIL_PIN.duration === 0.6 && NAIL_PIN.damage === 6, '钉壳：定锚应为距5 / 0.6s / 伤6');
  assert(NAIL_PIN.breakDist === 1 && NAIL_PIN.allyRamExtra === 10, '钉壳：断钉≥1、友军主动撞额外10');
  assert(HARD_CC_DIMINISH_WINDOW === 1.5, '钉壳：二次硬控窗仍为 1.5s');
  assert(nextHero('hook') === 'ring' && nextHero('ring') === 'chain', '钉壳：H 循环前段钩刺→磁环→链生');
  assert(nextHero('chain') === 'nail' && nextHero('nail') === 'arc', '钉壳：H 循环应接到钉壳再接到闪弧');
  assert(Math.abs(scaleHardCc(NAIL_PIN.duration, 0, 0.4) - 0.3) < 1e-6, '钉壳：1.5s 内二次硬控时长减半');

  const armor = createSkillCaster('nail');
  const [armorRed] = redBlue(8, 6, 14, 6);
  armorRed.hp = 70;
  fire(armor, armorRed, 1, [armorRed]);
  assert(Math.abs(armor.getCds()[0] - NAIL_ARMOR.cd) < 1e-6, '钉壳：叠甲应即放进 10s CD');
  assert(armorRed.armorRemain > NAIL_ARMOR.duration - 0.05 && Math.abs(armorRed.armorMul - NAIL_ARMOR.mul) < 1e-6, '钉壳：叠甲应上 3.5s ×0.4');
  tickPinned(armor, armorRed, [armorRed], NAIL_ARMOR.duration + 0.02);
  assert(Math.abs(armorRed.hp - 78) < 1e-6, '钉壳：未破甲结束应回 8');
  assert(armorRed.armorRemain === 0, '钉壳：叠甲结束后应变层应掉');

  resetTrapZones();
  const raw = collisionDamage(8);
  const expected = raw * NAIL_ARMOR.mul;
  const hitA = createBallBody({
    x: 10 - BALL_RADIUS * 1.1,
    y: 4,
    color: 0x3d7cf0,
    team: 'blue',
    vx: 4,
    facingX: 1,
  });
  const hitB = createBallBody({
    x: 10 + BALL_RADIUS * 1.1,
    y: 4,
    color: 0xe24a4a,
    team: 'red',
    vx: -4,
    facingX: -1,
    hero: 'nail',
    hp: 80,
  });
  applyArmor(hitB, NAIL_ARMOR.mul, NAIL_ARMOR.duration);
  const mulHits = applyCollisionCombat(hitA, hitB, 1, 0, 8);
  const victimHit = mulHits.find((h) => h.victimId === hitB.id);
  assert(!!victimHit, '钉壳：叠甲下仍应结算碰撞伤');
  assert(Math.abs((victimHit?.damage ?? 0) - expected) < 1e-6, '钉壳：叠甲碰撞伤应为 ×0.4');
  assert(hitB.armorBroken, '钉壳：吃到碰撞伤应记破甲');
  const afterHitHp = hitB.hp;
  tickArmor(hitB, NAIL_ARMOR.duration + 0.02, (target) => {
    target.hp = Math.min(target.maxHp, target.hp + NAIL_ARMOR.heal);
  });
  assert(Math.abs(hitB.hp - afterHitHp) < 1e-6, '钉壳：破甲结束不应回血');

  resetTrapZones();
  const [thornRed, thornBlue] = redBlue(10, 6, 10 + BALL_RADIUS * 2.2, 6);
  thornBlue.activeRamRemain = ACTIVE_RAM_WINDOW;
  const thornVx = thornBlue.vx;
  const passiveHits = applyCollisionCombat(thornRed, thornBlue, 1, 0, 8);
  const passive = passiveHits.find(
    (h) => h.sourceId === thornRed.id && h.victimId === thornBlue.id && Math.abs(h.damage - NAIL_THORN.passiveDamage) < 1e-6,
  );
  assert(!!passive, '钉壳：被主动撞应反弹 12');
  assert(thornBlue.vx > thornVx + 1, '钉壳：被动反伤应带小推');
  assert(thornRed.reflectRemain > NAIL_THORN.passiveWindow - 0.1, '钉壳：被动应开反伤窗');

  resetTrapZones();
  const isolated = createBallBody({
    x: 10,
    y: 6,
    color: 0xe24a4a,
    team: 'red',
    hero: 'nail',
  });
  const rammer = createBallBody({
    x: 11.2,
    y: 6,
    color: 0x3d7cf0,
    team: 'blue',
    vx: 0,
  });
  const direct = applyNailReflect(isolated, rammer, true);
  assert(Math.abs((direct?.damage ?? 0) - NAIL_THORN.passiveDamage) < 1e-6, '钉壳：被动反伤直算应为 12');
  assert(rammer.vx > 3, '钉壳：被动小推应把撞来的人推开');

  resetTrapZones();
  const [activeRed, activeBlue] = redBlue(10, 6, 10 + BALL_RADIUS * 2.2, 6);
  const active = createSkillCaster('nail');
  fire(active, activeRed, 2, [activeRed, activeBlue]);
  assert(Math.abs(active.getCds()[1] - NAIL_THORN.cd) < 1e-6, '钉壳：反击刺主动应进 9s CD');
  assert(activeRed.reflectArmed && Math.abs(activeRed.reflectDamage - NAIL_THORN.activeDamage) < 1e-6, '钉壳：主动应开 16 反伤窗');
  const first = applyCollisionCombat(activeRed, activeBlue, 1, 0, 8);
  const activeHit = first.find(
    (h) => h.sourceId === activeRed.id && h.victimId === activeBlue.id && Math.abs(h.damage - NAIL_THORN.activeDamage) < 1e-6,
  );
  assert(!!activeHit, '钉壳：主动窗内首次被撞应反 16');
  assert(!activeRed.reflectArmed, '钉壳：主动反伤只吃第一下');
  const secondHits = applyCollisionCombat(activeRed, activeBlue, 1, 0, 8);
  const again = secondHits.find(
    (h) => h.sourceId === activeRed.id && h.victimId === activeBlue.id && Math.abs(h.damage - NAIL_THORN.activeDamage) < 1e-6,
  );
  assert(!again, '钉壳：第二下不应再反 16');

  resetTrapZones();
  const dash = createSkillCaster('nail');
  const dashBall = createBallBody({
    x: 8,
    y: 6,
    color: 0xe24a4a,
    team: 'red',
    facingX: 1,
    hero: 'nail',
  });
  fire(dash, dashBall, 3, [dashBall]);
  assert(dash.isDisplacing(), '钉壳：短冲顶应为位移技');
  assert(Math.abs(dash.getCds()[2] - NAIL_RAM.cd) < 1e-6, '钉壳：短冲顶应进 8s CD');
  advance(dash, dashBall, [dashBall], NAIL_RAM.dashTime + 0.02);
  assert(dashBall.x > 10.7, '钉壳：空放短冲顶应冲约 3 格');
  assert(!dash.isDisplacing(), '钉壳：冲完应结束位移');

  resetTrapZones();
  const [ramRed, ramBlue] = redBlue(8, 6, 10.2, 6);
  const ram = createSkillCaster('nail');
  fire(ram, ramRed, 3, [ramRed, ramBlue]);
  let ramLeft = 0.25;
  while (ramLeft > 1e-9 && ramBlue.hp >= MAX_HP - 1e-6) {
    play(ram, ramRed, [ramRed, ramBlue], 1 / 60);
    ramLeft -= 1 / 60;
  }
  assert(Math.abs(ramBlue.hp - (MAX_HP - NAIL_RAM.damage)) < 1e-6, '钉壳：短冲顶命中应加 10 伤');
  assert(ramRed.activeRamRemain > ACTIVE_RAM_WINDOW - 0.08, '钉壳：短冲顶命中应开主动撞窗');

  resetTrapZones();
  const [pinRed, pinBlue] = redBlue(8, 6, 11, 6);
  pinBlue.facingX = 1;
  pinBlue.facingY = 0;
  const pin = createSkillCaster('nail');
  fire(pin, pinRed, 4, [pinRed, pinBlue]);
  assert(pin.getWindup()?.slot === 4, '钉壳：定锚应走 0.3s 前摇');
  tickPinned(pin, pinRed, [pinRed, pinBlue], 0.28);
  assert(pinBlue.hp === MAX_HP, '钉壳：定锚前摇未结束不应上钉');
  tickPinned(pin, pinRed, [pinRed, pinBlue], 0.05);
  assert(Math.abs(pinBlue.hp - (MAX_HP - NAIL_PIN.damage)) < 1e-6, '钉壳：上钉应伤 6');
  assert(pinBlue.pinRemain > 0.55 && pinBlue.stunRemain > 0.55, '钉壳：定锚硬控应为 0.6s');
  assert(Math.abs(pinBlue.vx) < 1e-6 && Math.abs(pinBlue.vy) < 1e-6, '钉壳：上钉应把目标速度归零');
  const faceX = pinBlue.facingX;
  pinBlue.vx = 5;
  play(pin, pinRed, [pinRed, pinBlue], 1 / 60);
  assert(Math.abs(pinBlue.facingX - faceX) < 1e-6, '钉壳：钉住期间不能改朝向');
  assert(pinBlue.x > 11, '钉壳：钉住仍可被碰撞/速度推动');
  const victimAim = createSkillCaster('hook');
  victimAim.handleInput(pinBlue, sample({ skillPress: 1, aimX: -1, aimY: 0 }), [pinRed, pinBlue]);
  assert(victimAim.getAimingSlot() === 0, '钉壳：钉住期间不能放技能');

  const startX = pinBlue.x;
  pinBlue.x = startX + NAIL_PIN.breakDist + 0.05;
  tickPin(pinBlue, 0, NAIL_PIN.breakDist);
  assert(pinBlue.pinRemain === 0 && pinBlue.stunRemain === 0, '钉壳：被推≥1 格应断钉');

  resetTrapZones();
  const [extraRed, extraBlue] = redBlue(8, 6, 11, 6);
  const extraAlly = createBallBody({
    x: 9.9,
    y: 6,
    color: 0xc43d3d,
    label: '红友',
    team: 'red',
    facingX: 1,
    hero: 'hook',
  });
  const extra = createSkillCaster('nail');
  fire(extra, extraRed, 4, [extraRed, extraBlue, extraAlly]);
  tickPinned(extra, extraRed, [extraRed, extraBlue, extraAlly], 0.35);
  assert(extraBlue.pinRemain > 0.2, '钉壳：定锚后应仍钉着');
  const hpAfterPin = extraBlue.hp;
  extraAlly.activeRamRemain = ACTIVE_RAM_WINDOW;
  extraAlly.vx = 4;
  extraBlue.vx = -4;
  const extraHits = applyCollisionCombat(extraAlly, extraBlue, 1, 0, 8);
  const bonus = extraHits.find(
    (h) => h.sourceId === extraAlly.id && h.victimId === extraBlue.id && Math.abs(h.damage - NAIL_PIN.allyRamExtra) < 1e-6,
  );
  assert(!!bonus, '钉壳：钉住期间友军主动撞应额外 10');
  assert(extraBlue.hp < hpAfterPin - 9, '钉壳：额外伤应扣在被钉目标上');

  resetTrapZones();
  const [ccRed, ccBlue] = redBlue(8, 6, 11, 6);
  const cc = createSkillCaster('nail');
  fire(cc, ccRed, 4, [ccRed, ccBlue]);
  tickPinned(cc, ccRed, [ccRed, ccBlue], 0.35);
  assert(ccBlue.stunRemain > 0.5, '钉壳：首次定锚应为满 0.6s');
  tickPinned(cc, ccRed, [ccRed, ccBlue], 0.7);
  assert(ccBlue.stunRemain === 0 && ccBlue.pinRemain === 0, '钉壳：首次定锚结束后应解开');
  const cc2 = createSkillCaster('nail');
  const ccRed2 = createBallBody({
    x: 8,
    y: 6.15,
    color: 0xc43d3d,
    team: 'red',
    facingX: 1,
    hero: 'nail',
  });
  fire(cc2, ccRed2, 4, [ccRed2, ccBlue]);
  tickPinned(cc2, ccRed2, [ccRed2, ccBlue], 0.35);
  assert(ccBlue.stunRemain < 0.36 && ccBlue.stunRemain > 0.2, '钉壳：1.5s 内二次定锚时长应减半');

  resetTrapZones();
  const hookKeep = createSkillCaster('hook');
  const [hookRed, hookBlue] = redBlue(8, 6, 13, 6, 'hook');
  fire(hookKeep, hookRed, 1, [hookRed, hookBlue]);
  advance(hookKeep, hookRed, [hookRed, hookBlue], HOOK_PULL.windup + 0.03);
  assert(Math.abs(hookBlue.hp - (MAX_HP - HOOK_PULL.damage)) < 1e-6, '钉壳：钩刺 kit 不应被拆坏');
  assert(Math.hypot(hookRed.vx, hookRed.vy) + 1e-6 >= FLOOR_SPEED - 0.2, '钉壳：钩刺勾飞仍可动');

  resetTrapZones();
  const ringKeep = createSkillCaster('ring');
  const ringRed = createBallBody({
    x: 10,
    y: 6,
    color: 0xe24a4a,
    team: 'red',
    facingX: 1,
    hero: 'ring',
  });
  fire(ringKeep, ringRed, 1, [ringRed]);
  assert(Math.abs(ringKeep.getCds()[0] - RING_FIELD.cd) < 1e-6, '钉壳：磁环 kit 不应被拆坏');
  assert(ringRed.fieldRemain > RING_FIELD.duration - 0.05, '钉壳：磁环磁场仍应即放');

  resetTrapZones();
  const chainKeep = createSkillCaster('chain');
  const chainRed = createBallBody({
    x: 8,
    y: 6,
    color: 0xe24a4a,
    team: 'red',
    facingX: 1,
    hero: 'chain',
  });
  const chainBlue = createBallBody({
    x: 11,
    y: 6,
    color: 0x3d7cf0,
    team: 'blue',
    facingX: -1,
    hero: 'hook',
  });
  fire(chainKeep, chainRed, 2, [chainRed, chainBlue]);
  assert(Math.abs(chainKeep.getCds()[1] - 12) < 1e-6, '钉壳：链生 kit 不应被拆坏');
  assert(chainRed.leechRemain > 2.9, '钉壳：链生盾脉仍应贴敌吸血');
  assert(CHAIN_HEAL.cd === 10, '钉壳：链生愈链数值不应被改');

  resetTrapZones();
}
